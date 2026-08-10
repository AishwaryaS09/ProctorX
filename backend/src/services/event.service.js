const {
  FACE_STATE_TO_VIOLATION,
  FACE_STATUS_COUNTER,
  browserViolationFor,
} = require('../config/constants');
const FaceEvent = require('../models/FaceEvent');
const BrowserEvent = require('../models/BrowserEvent');
const ExamEvent = require('../models/ExamEvent');
const Violation = require('../models/Violation');
const { recordViolation } = require('./trust.service');
const { emitSession } = require('../socket/socketServer');
const { riskFor } = require('../utils/formatters');
const { counterState } = require('../utils/sessionState');

/**
 * Episode tracking (in-memory, per process).
 * Violations are created on STATE TRANSITIONS only — never per frame — so a
 * single continuous absence / multiple-face period / looking-away period /
 * browser-inactivity period yields exactly ONE violation. Returning to the
 * normal state resets the episode; leaving again starts a new one.
 */
const lastFaceStatusBySession = new Map();
const absenceStartBySession = new Map();
const browserEpisodeBySession = new Map();

/** Track the last *non-ERROR* face status per session (used for transitions). */
function trackFaceStatus(sessionId, faceStatus) {
  const key = sessionId.toString();
  const previous = lastFaceStatusBySession.get(key);
  if (faceStatus !== 'ERROR') {
    lastFaceStatusBySession.set(key, faceStatus);
  }
  return previous;
}

/** Persist a positive (GREEN) lifecycle event for the session timeline. */
async function recordLifecycleEvent(session, candidate, status, message) {
  return ExamEvent.create({
    session: session._id || session,
    candidate: candidate._id || candidate,
    status,
    message: message || undefined,
  });
}

/**
 * Persist a face analysis result. A violation is created ONLY when the AI
 * reports a violation state (ABSENT / MULTIPLE / LOOKING_AWAY) AND that state
 * is a transition from the previously analysed state. Sustaining the same
 * state never creates additional violations. The matching ExamSession counter
 * is incremented once per episode (the persisted source of truth).
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

  const previous = trackFaceStatus(session._id, faceStatus);

  // Continuous-absence duration (seconds) for the live "Face Absent: Xs" UI.
  let absentDurationSeconds = 0;
  const sessionKey = session._id.toString();
  if (faceStatus === 'ABSENT') {
    if (previous !== 'ABSENT') {
      absenceStartBySession.set(sessionKey, Date.now());
    }
    const start = absenceStartBySession.get(sessionKey);
    absentDurationSeconds = Math.max(0, Math.round((Date.now() - start) / 1000));
  } else {
    absenceStartBySession.delete(sessionKey);
  }

  let violation = null;
  const violationType = FACE_STATE_TO_VIOLATION[faceStatus];

  if (violationType) {
    if (previous !== faceStatus) {
      violation = await recordViolation({
        session,
        violationType,
        message: remark,
        metadata: { source: 'face', faceStatus, faceCount, screenshotPath },
      });
      const counterField = FACE_STATUS_COUNTER[faceStatus];
      if (counterField) {
        session[counterField] = (session[counterField] || 0) + 1;
        await session.save();
      }
    }
  } else if (faceStatus === 'PRESENT' && previous !== 'PRESENT' && previous !== 'LOOKING_AWAY') {
    // A face was (re)detected after an absence / multi-face / start.
    await recordLifecycleEvent(session, candidate, 'Face Detected', 'One face detected.');
  }

  emitSession(session._id, 'face_event', {
    id: event._id.toString(),
    faceStatus,
    faceCount,
    confidence,
    remark,
    absentDurationSeconds,
    counters: counterState(session),
    createdAt: event.createdAt,
  });

  return { event, violation, absentDurationSeconds };
}

/**
 * Persist a browser activity event. All "candidate left the page" signals
 * (tab switch, window blur, minimize, hidden) collapse into a single
 * BROWSER_INACTIVE episode; leaving fullscreen during the exam is a separate
 * FULLSCREEN_EXIT episode. Each episode produces at most one violation.
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

  const sessionKey = session._id.toString();
  let episode = browserEpisodeBySession.get(sessionKey) || { inactive: false, fullscreen: false };
  let violation = null;

  if (violationType === 'BROWSER_INACTIVE') {
    if (!episode.inactive) {
      episode.inactive = true;
      session.browserViolationCount = (session.browserViolationCount || 0) + 1;
      await session.save();
      violation = await recordViolation({
        session,
        violationType,
        message: `${detail || 'Candidate left the examination page'} detected`,
        metadata: { source: 'browser', status, eventName },
      });
    }
  } else if (violationType === 'FULLSCREEN_EXIT') {
    if (!episode.fullscreen) {
      episode.fullscreen = true;
      session.fullscreenExitCount = (session.fullscreenExitCount || 0) + 1;
      await session.save();
      violation = await recordViolation({
        session,
        violationType,
        message: 'Fullscreen exited during the examination',
        metadata: { source: 'browser', status, eventName },
      });
    }
  }

  // Episode resets when the candidate returns to the examination page.
  const normalized = (status || eventName || '').toLowerCase();
  if (['tab_visible', 'visible', 'active', 'focus'].includes(normalized)) {
    episode.inactive = false;
  }
  if (['fullscreen_entered', 'fullscreen_active'].includes(normalized)) {
    episode.fullscreen = false;
  }
  browserEpisodeBySession.set(sessionKey, episode);

  emitSession(session._id, 'browser_event', {
    id: event._id.toString(),
    status,
    eventName,
    detail,
    isViolation,
    counters: counterState(session),
    createdAt: event.createdAt,
  });

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

module.exports = { recordFaceEvent, recordBrowserEvent, recordLifecycleEvent, currentState };
