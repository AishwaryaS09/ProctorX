const {
  DEFAULT_EXAM_TITLE,
  DEFAULT_EXAM_DURATION_MIN,
  TRUST_SCORE_START,
} = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { durationSeconds, humanizeDuration } = require('../utils/formatters');
const ExamSession = require('../models/ExamSession');
const Violation = require('../models/Violation');
const FaceEvent = require('../models/FaceEvent');
const BrowserEvent = require('../models/BrowserEvent');
const { logAudit } = require('./audit.service');

async function getActiveSession(candidateId) {
  return ExamSession.findOne({ candidate: candidateId, status: 'ACTIVE' }).sort({ createdAt: -1 });
}

async function startSession({ candidate, examTitle, deviceInfo }) {
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
 * Summary aggregation ported from the reference get_session_summary:
 * face/browser event counts, generated remarks and duration string.
 */
async function getSessionSummary(session, candidate) {
  const [faceAgg, browserAgg] = await Promise.all([
    FaceEvent.aggregate([
      { $match: { session: session._id } },
      { $group: { _id: '$faceStatus', count: { $sum: 1 } } },
    ]),
    BrowserEvent.aggregate([
      { $match: { session: session._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const faceSummary = {};
  faceAgg.forEach((r) => { faceSummary[r._id] = r.count; });
  const browserSummary = {};
  browserAgg.forEach((r) => { browserSummary[r._id] = r.count; });

  const violations = await Violation.find({ session: session._id }).sort({ createdAt: 1 });
  const warnings = violations.filter((v) => v.warningLevel > 0);

  const durationStr =
    session.status === 'COMPLETED' && session.durationSeconds
      ? humanizeDuration(session.durationSeconds)
      : 'In Progress';

  const remarks = generateRemarks({
    faceSummary,
    browserSummary,
    session,
    autoEnded: session.autoEnded,
  });

  const browserInactive =
    (browserSummary.INACTIVE || 0) +
    (browserSummary.HIDDEN || 0) +
    (browserSummary.UNFOCUSED || 0) +
    (browserSummary.minimized || 0);

  const browserEventsTotal = Object.values(browserSummary).reduce((sum, count) => sum + count, 0);

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
    facePresent: faceSummary.PRESENT || 0,
    faceAbsent: faceSummary.ABSENT || 0,
    faceMultiple: faceSummary.MULTIPLE || 0,
    lookingAway: faceSummary.LOOKING_AWAY || 0,
    faceError: faceSummary.ERROR || 0,
    browserActive: browserSummary.ACTIVE || 0,
    browserInactive,
    browserEvents: browserEventsTotal,
    fullscreenExits: browserSummary.fullscreen_exit || browserSummary.FULLSCREEN_EXIT || 0,
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
  };
}

function generateRemarks({ faceSummary, browserSummary, session, autoEnded }) {
  const hasFaceAbsent = (faceSummary.ABSENT || 0) > 0;
  const hasLookingAway = (faceSummary.LOOKING_AWAY || 0) > 0;
  const hasBrowserInactive =
    (browserSummary.INACTIVE || 0) > 0 ||
    (browserSummary.HIDDEN || 0) > 0 ||
    (browserSummary.UNFOCUSED || 0) > 0 ||
    (browserSummary.minimized || 0) > 0;

  const parts = [];
  if (autoEnded && session.finalRemarks) {
    parts.push(session.finalRemarks);
  }
  if (hasFaceAbsent && hasBrowserInactive) {
    parts.push('Both face absence and browser inactivity were detected.');
  } else if (hasFaceAbsent) {
    parts.push('Face absence was detected during the session.');
  }
  if (hasLookingAway) {
    parts.push('Candidate looking away was detected.');
  }
  if (hasBrowserInactive) {
    parts.push('Browser inactivity was detected.');
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
