const {
  DEFAULT_EXAM_TITLE,
  DEFAULT_EXAM_DURATION_MIN,
  TRUST_SCORE_START,
} = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { durationSeconds, humanizeDuration } = require('../utils/formatters');
const ExamSession = require('../models/ExamSession');
const Violation = require('../models/Violation');
const ExamEvent = require('../models/ExamEvent');
const { recordLifecycleEvent } = require('./event.service');
const { logAudit } = require('./audit.service');

async function getActiveSession(candidateId) {
  return ExamSession.findOne({ candidate: candidateId, status: 'ACTIVE' }).sort({ createdAt: -1 });
}

async function startSession({ candidate, examTitle, deviceInfo, verified }) {
  const active = await getActiveSession(candidate._id);
  if (active) {
    throw ApiError.conflict('You already have an active exam session. Please end it first.');
  }

  const session = await ExamSession.create({
    candidate: candidate._id,
    examName: examTitle || DEFAULT_EXAM_TITLE,
    status: 'ACTIVE',
    trustScore: TRUST_SCORE_START,
    currentRisk: 'LOW',
    deviceInfo: {
      userAgent: (deviceInfo && deviceInfo.userAgent) || '',
      screenSize: (deviceInfo && deviceInfo.screenSize) || '',
    },
  });

  // Persist the GREEN lifecycle events for the result-page timeline.
  if (verified && verified.camera) {
    await recordLifecycleEvent(session, candidate, 'Camera Permission Approved', 'Webcam access granted.');
  }
  if (verified && verified.fullscreen) {
    await recordLifecycleEvent(session, candidate, 'Fullscreen Accepted', 'Fullscreen enabled for the exam.');
  }
  await recordLifecycleEvent(session, candidate, 'Monitoring Active', 'Examination monitoring is live.');

  await logAudit({
    actor: candidate,
    action: 'SESSION_STARTED',
    resource: 'exam_session',
    resourceId: session._id.toString(),
    details: { examName: session.examName },
  });

  return session;
}

async function endSession({ session, candidate, finalRemarks }) {
  if (session.status !== 'ACTIVE') {
    throw ApiError.badRequest('This session is not active.');
  }

  const now = new Date();
  session.endTime = now;
  session.status = 'COMPLETED';
  session.durationSeconds = durationSeconds(session.startTime, now);
  if (finalRemarks) session.finalRemarks = finalRemarks;
  await session.save();

  await logAudit({
    actor: candidate,
    action: 'SESSION_ENDED',
    resource: 'exam_session',
    resourceId: session._id.toString(),
    details: { durationSeconds: session.durationSeconds },
  });

  return session;
}

/**
 * Summary aggregation. Violation counts are EPISODE counts (one per distinct
 * violation) sourced from the Violation collection — the same persisted source
 * of truth used for the trust score and the live counters. The timeline mixes
 * the persisted GREEN lifecycle events with the RED violations.
 */
async function getSessionSummary(session, candidate) {
  const [violations, examEvents] = await Promise.all([
    Violation.find({ session: session._id }).sort({ createdAt: 1 }),
    ExamEvent.find({ session: session._id }).sort({ createdAt: 1 }),
  ]);

  const warnings = violations.filter((v) => v.warningLevel > 0);

  const byType = {};
  violations.forEach((v) => { byType[v.type] = (byType[v.type] || 0) + 1; });

  const faceAbsent = byType.FACE_ABSENT || 0;
  const faceMultiple = byType.MULTIPLE_FACES || 0;
  const lookingAway = byType.LOOKING_AWAY || 0;
  const browserInactive = byType.BROWSER_INACTIVE || 0;
  const fullscreenExits = byType.FULLSCREEN_EXIT || 0;
  const totalViolations = session.violationCount || violations.length;

  const durationStr =
    session.status === 'COMPLETED' && session.durationSeconds
      ? humanizeDuration(session.durationSeconds)
      : 'In Progress';

  const remarks = generateRemarks({ byType, session, autoEnded: session.autoEnded });

  const timeline = [
    ...examEvents.map((e) => ({
      id: `e_${e._id.toString()}`,
      tone: 'positive',
      label: e.status,
      message: e.message,
      timestamp: e.createdAt,
    })),
    ...violations.map((v) => ({
      id: `v_${v._id.toString()}`,
      tone: 'violation',
      label: violationLabel(v),
      message: v.message,
      points: v.points,
      timestamp: v.createdAt,
    })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    sessionId: session._id.toString(),
    candidateName: candidate ? candidate.name : 'Unknown',
    candidateId: candidate ? candidate.candidateId : null,
    examTitle: session.examName,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: durationStr,
    durationSeconds: session.durationSeconds,
    status: session.status,
    autoEnded: session.autoEnded,
    finalRemarks: session.finalRemarks || null,
    faceAbsent,
    faceMultiple,
    lookingAway,
    browserInactive,
    fullscreenExits,
    totalViolations,
    warningCount: warnings.length,
    trustScore: session.trustScore,
    riskLevel: session.currentRisk,
    violationCount: session.violationCount,
    remarks,
    violations: violations.map((v) => ({
      id: v._id.toString(),
      type: v.type,
      severity: v.severity,
      points: v.points,
      message: v.message,
      warningLevel: v.warningLevel,
      screenshotPath: v.screenshotPath,
      createdAt: v.createdAt,
    })),
    warnings: warnings.map((v) => ({
      level: `WARNING_${v.warningLevel}`,
      message: v.message,
      createdAt: v.createdAt,
    })),
    timeline,
  };
}

/** User-facing label for a violation, including the dynamic face count. */
function violationLabel(v) {
  switch (v.type) {
    case 'FACE_ABSENT':
      return 'FACE ABSENT';
    case 'MULTIPLE_FACES': {
      const count = v.metadata && v.metadata.faceCount;
      return count > 1 ? `${count} FACES DETECTED` : 'MULTIPLE FACES DETECTED';
    }
    case 'LOOKING_AWAY':
      return 'LOOKING AWAY';
    case 'BROWSER_INACTIVE':
      return 'BROWSER INACTIVE';
    case 'FULLSCREEN_EXIT':
      return 'FULLSCREEN EXIT';
    default:
      return (v.type || '').replace(/_/g, ' ');
  }
}

function generateRemarks({ byType, session, autoEnded }) {
  const parts = [];
  if (autoEnded && session.finalRemarks) {
    parts.push(session.finalRemarks);
  }
  if (byType.FACE_ABSENT) {
    parts.push('Face absence was detected during the session.');
  }
  if (byType.MULTIPLE_FACES) {
    parts.push('Multiple faces were detected during the session.');
  }
  if (byType.LOOKING_AWAY) {
    parts.push('Candidate looking away was detected.');
  }
  if (byType.BROWSER_INACTIVE) {
    parts.push('Browser inactivity was detected.');
  }
  if (byType.FULLSCREEN_EXIT) {
    parts.push('Fullscreen was exited during the exam.');
  }
  if (!parts.length) {
    return 'Session completed normally.';
  }
  return parts.join(' ');
}

module.exports = {
  getActiveSession,
  startSession,
  endSession,
  getSessionSummary,
  generateRemarks,
};
