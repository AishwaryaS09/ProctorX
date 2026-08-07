const {
  FACE_STATE_TO_VIOLATION,
  browserViolationFor,
} = require('../config/constants');
const FaceEvent = require('../models/FaceEvent');
const BrowserEvent = require('../models/BrowserEvent');
const Violation = require('../models/Violation');
const { recordViolation } = require('./trust.service');
const { emitSession } = require('../socket/socketServer');
const { riskFor } = require('../utils/formatters');

/**
 * Persist a face analysis result for a session. When the AI reports a
 * violation state (ABSENT / MULTIPLE / LOOKING_AWAY / ERROR) a violation is
 * recorded through the trust engine.
 */
async function recordFaceEvent({ session, candidate, result, screenshotPath }) {
  const faceStatus = result.faceStatus || result.face_status || 'ERROR';
  const faceCount = result.faceCount ?? result.face_count ?? 0;
  const confidence = result.confidence ?? 0;
  const remark = result.remark || result.remarks || '';

  const event = await FaceEvent.create({
    session: session._id,
    candidate: candidate._id,
    faceStatus,
    faceCount,
    confidence,
    remark,
    screenshotPath: screenshotPath || undefined,
  });

  emitSession(session._id, 'face_event', {
    id: event._id.toString(),
    faceStatus,
    faceCount,
    confidence,
    remark,
    createdAt: event.createdAt,
  });

  const violationType = FACE_STATE_TO_VIOLATION[faceStatus];
  let violation = null;
  if (violationType) {
    violation = await recordViolation({
      session,
      violationType,
      message: remark,
      metadata: { source: 'face', faceStatus, faceCount, screenshotPath },
    });
  }

  return { event, violation };
}

/**
 * Persist a browser activity event. Suspicious statuses map to violations.
 */
async function recordBrowserEvent({ session, candidate, status, eventName, detail }) {
  const violationType = browserViolationFor(status, eventName);
  const isViolation = Boolean(violationType);

  const event = await BrowserEvent.create({
    session: session._id,
    candidate: candidate._id,
    status: status || null,
    eventName: eventName || null,
    detail: detail || null,
    isViolation,
  });

  emitSession(session._id, 'browser_event', {
    id: event._id.toString(),
    status,
    eventName,
    detail,
    isViolation,
    createdAt: event.createdAt,
  });

  let violation = null;
  if (violationType) {
    violation = await recordViolation({
      session,
      violationType,
      message: `${detail || status} detected`,
      metadata: { source: 'browser', status, eventName },
    });
  }

  return { event, violation };
}

/**
 * Fresh state payload used by polling clients (also emitted over socket).
 */
async function currentState(session) {
  const [violationCount, totalPoints, recentEvents] = await Promise.all([
    Violation.countDocuments({ session: session._id }),
    Violation.aggregate([
      { $match: { session: session._id } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]),
    FaceEvent.find({ session: session._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ]);

  const trustScore = Math.max(0, 100 - (totalPoints[0] ? totalPoints[0].total : 0));

  return {
    sessionId: session._id.toString(),
    status: session.status,
    trustScore,
    riskLevel: riskFor(trustScore),
    violationCount,
    lastFaceEvents: recentEvents,
  };
}

module.exports = { recordFaceEvent, recordBrowserEvent, currentState };
