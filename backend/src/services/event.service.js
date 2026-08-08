const {
  FACE_STATE_TO_VIOLATION,
  FACE_STATUS_COUNTER,
  browserViolationFor,
} = require('../config/constants');
const FaceEvent = require('../models/FaceEvent');
const BrowserEvent = require('../models/BrowserEvent');
const Violation = require('../models/Violation');
const { recordViolation } = require('./trust.service');
const { emitSession } = require('../socket/socketServer');
const { riskFor } = require('../utils/formatters');
const { counterState } = require('../utils/sessionState');

/**
 * Tracks the last *non-ERROR* face status per session (in-memory) so that a
 * FACE violation is recorded on a state transition (e.g. PRESENT -> ABSENT)
 * rather than on every frame of a sustained absence. This mirrors real
 * proctoring behaviour: leaving the camera triggers one violation, returning
 * resets, and leaving again triggers another.
 */
const lastFaceStatusBySession = new Map();

function trackFaceStatus(sessionId, faceStatus) {
  const key = sessionId.toString();
  const previous = lastFaceStatusBySession.get(key);
  if (faceStatus !== 'ERROR') {
    lastFaceStatusBySession.set(key, faceStatus);
  }
  return previous;
}

/**
 * Persist a face analysis result for a session. When the AI reports a
 * violation state (ABSENT / MULTIPLE / LOOKING_AWAY) AND that state is a
 * transition from the previous analysed frame, a violation is recorded
 * through the trust engine.
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

  const counterField = FACE_STATUS_COUNTER[faceStatus];
  if (counterField) {
    session[counterField] = (session[counterField] || 0) + 1;
    await session.save();
  }

  emitSession(session._id, 'face_event', {
    id: event._id.toString(),
    faceStatus,
    faceCount,
    confidence,
    remark,
    counters: counterState(session),
    createdAt: event.createdAt,
  });

  let violation = null;
  const violationType = FACE_STATE_TO_VIOLATION[faceStatus];
  if (violationType && faceStatus !== 'ERROR') {
    const previous = trackFaceStatus(session._id, faceStatus);
    if (previous !== faceStatus) {
      violation = await recordViolation({
        session,
        violationType,
        message: remark,
        metadata: { source: 'face', faceStatus, faceCount, screenshotPath },
      });
    }
  } else {
    trackFaceStatus(session._id, faceStatus);
  }

  return { event, violation };
}

/**
 * Persist a browser activity event. Suspicious statuses map to violations.
 * Each discrete browser event is treated independently (no transition gate).
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

  let violation = null;
  if (violationType) {
    session.browserViolationCount = (session.browserViolationCount || 0) + 1;
    if (violationType === 'FULLSCREEN_EXIT') {
      session.fullscreenExitCount = (session.fullscreenExitCount || 0) + 1;
    }
    await session.save();
  }

  emitSession(session._id, 'browser_event', {
    id: event._id.toString(),
    status,
    eventName,
    detail,
    isViolation,
    counters: counterState(session),
    createdAt: event.createdAt,
  });

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
    counters: counterState(session),
    lastFaceEvents: recentEvents,
  };
}

module.exports = { recordFaceEvent, recordBrowserEvent, currentState };
