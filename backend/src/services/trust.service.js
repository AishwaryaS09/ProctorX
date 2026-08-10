const {
  TRUST_SCORE_START,
  VIOLATION_POINTS,
  severityFor,
  SEVERITY_RANK,
  WARNING_MESSAGES,
} = require('../config/constants');

const { env } = require('../config/env');
const { riskFor } = require('../utils/formatters');
const { counterState, liveState } = require('../utils/sessionState');
const Violation = require('../models/Violation');
const { emitSession, emitAdmin } = require('../socket/socketServer');
const { logAudit } = require('./audit.service');

const WARNING_LEVELS = env.warningLevels.length ? env.warningLevels : [1, 2, 3];
const AUTO_END_THRESHOLD = env.autoEndThreshold;
const SCREENSHOT_MIN_SEVERITY = env.screenshotSeverityBelow;

/**
 * Port of the reference trust engine.
 * - A violation deducts points from the candidate's trust score (floor 0).
 * - Risk level is derived from the score bands (LOW >=85, MEDIUM >=60, HIGH >=35, CRITICAL <35).
 * - Warnings are issued when the cumulative violation count hits a configured level.
 * - The session is auto-ended once the violation count reaches the threshold.
 */
async function recordViolation({ session, violationType, message, metadata = {} }) {
  const points = VIOLATION_POINTS[violationType] || 0;
  const severity = severityFor(points);
  const shouldScreenshot = env.screenshotEnabled && SEVERITY_RANK[severity] >= SEVERITY_RANK[SCREENSHOT_MIN_SEVERITY];

  const violation = await Violation.create({
    session: session._id,
    candidate: session.candidate,
    type: violationType,
    points,
    severity,
    message: message || `${violationType} detected`,
    screenshotPath: shouldScreenshot ? metadata.screenshotPath : undefined,
    metadata,
  });

  session.violationCount += 1;
  const totalPoints = await totalPointsFor(session._id);
  session.trustScore = Math.max(0, TRUST_SCORE_START - totalPoints);
  session.currentRisk = riskFor(session.trustScore);
  await session.save();

  let warningLevel = null;
  if (WARNING_LEVELS.includes(session.violationCount)) {
    warningLevel = session.violationCount;
    violation.warningLevel = warningLevel;
    violation.message = `${WARNING_MESSAGES[warningLevel] || 'Warning: suspicious activity detected.'} (${violationType})`;
    await violation.save();
  }

  let autoEnded = false;
  if (session.violationCount >= AUTO_END_THRESHOLD) {
    autoEnded = true;
    const messageText =
      `Session auto-ended after ${session.violationCount} violations (threshold: ${AUTO_END_THRESHOLD}).`;
    await endSession(session, { autoEnded: true, finalRemarks: messageText });
    await logAudit({
      actor: null,
      action: 'SESSION_AUTO_ENDED',
      resource: 'exam_session',
      resourceId: session._id.toString(),
      details: { violations: session.violationCount, threshold: AUTO_END_THRESHOLD },
    });
  }

  const result = {
    violationId: violation._id.toString(),
    violationType: violationType,
    severity,
    points,
    violationCount: session.violationCount,
    trustScore: session.trustScore,
    riskLevel: session.currentRisk,
    warningLevel: warningLevel ? `WARNING_${warningLevel}` : null,
    warningMessage: warningLevel ? WARNING_MESSAGES[warningLevel] : null,
    autoEnded,
    faceCount: metadata.faceCount || null,
    counters: counterState(session),
  };

  emitSession(session._id, 'violation', result);
  emitSession(session._id, 'session_update', liveState(session));
  emitAdmin('violation', { sessionId: session._id.toString(), ...result });

  return result;
}

async function totalPointsFor(sessionId) {
  const [agg] = await Violation.aggregate([
    { $match: { session: sessionId } },
    { $group: { _id: null, total: { $sum: '$points' } } },
  ]);
  return agg ? agg.total : 0;
}

/**
 * Mark a session completed. Used both by manual end and by the auto-end path.
 */
async function endSession(session, { autoEnded = false, finalRemarks = null } = {}) {
  const now = new Date();
  session.endTime = now;
  session.status = 'COMPLETED';
  session.autoEnded = autoEnded;
  if (session.startTime) {
    session.durationSeconds = Math.max(0, Math.floor((now - session.startTime) / 1000));
  }
  if (finalRemarks) {
    session.finalRemarks = finalRemarks;
  }
  await session.save();

  emitSession(session._id, 'session_ended', {
    sessionId: session._id.toString(),
    autoEnded,
    finalRemarks: session.finalRemarks,
  });
  emitAdmin('session_ended', { sessionId: session._id.toString(), status: session.status });

  return session;
}

/**
 * Active session snapshot used by the monitor UI polling.
 */
function publicSessionState(session) {
  return {
    sessionId: session._id.toString(),
    status: session.status,
    trustScore: session.trustScore,
    riskLevel: session.currentRisk,
    violationCount: session.violationCount,
    warningLevel: session.warningLevel,
    autoEnded: session.autoEnded,
  };
}

module.exports = { recordViolation, endSession, publicSessionState, totalPointsFor };
