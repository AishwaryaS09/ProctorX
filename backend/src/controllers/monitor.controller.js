const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ExamSession = require('../models/ExamSession');
const { analyzeFrame } = require('../ai/pythonClient.service');
const { recordFaceEvent, recordBrowserEvent, currentState } = require('../services/event.service');
const { counterState } = require('../utils/sessionState');
const { env } = require('../config/env');

/**
 * Persist a webcam frame as evidence when screenshots are enabled.
 * Returns a relative path stored in the Violation record.
 */
function saveEvidenceFrame(imageBase64, sessionId) {
  if (!env.screenshotEnabled) return null;

  const data = imageBase64.split(',')[1] || imageBase64;
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length < 100) return null;

  fs.mkdirSync(env.evidenceDir, { recursive: true });
  const filename = `${sessionId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
  const filepath = path.join(env.evidenceDir, filename);
  fs.writeFileSync(filepath, buffer);
  return `evidence/${filename}`;
}

/**
 * POST /api/monitor/frame
 * React sends a base64 webcam frame; Node forwards it to the Python AI
 * service and records the outcome (face event + possible violation).
 */
const submitFrame = asyncHandler(async (req, res) => {
  const session = await ExamSession.findOne({
    _id: req.body.sessionId,
    candidate: req.user._id,
    status: 'ACTIVE',
  });
  if (!session) {
    throw ApiError.notFound('No active session found.');
  }

  let result;
  try {
    result = await analyzeFrame(req.body.image);
  } catch (err) {
    return res.status(200).json(
      ApiResponse.ok(
        {
          aiUnavailable: true,
          message: 'AI service unavailable; frame skipped.',
        },
        'Frame received but AI service could not be reached.'
      )
    );
  }

  const screenshotPath = saveEvidenceFrame(req.body.image, session._id.toString());
  const { violation } = await recordFaceEvent({
    session,
    candidate: req.user,
    result,
    screenshotPath,
  });

  res.status(200).json(
    ApiResponse.ok(
      {
        faceStatus: result.faceStatus,
        faceCount: result.faceCount,
        confidence: result.confidence,
        remark: result.remark,
        counters: counterState(session),
        violation: violation ? { ...violation } : null,
      },
      'Frame analyzed.'
    )
  );
});

/**
 * POST /api/monitor/browser
 * React reports tab/window/fullscreen activity.
 */
const submitBrowserEvent = asyncHandler(async (req, res) => {
  const session = await ExamSession.findOne({
    _id: req.body.sessionId,
    candidate: req.user._id,
    status: 'ACTIVE',
  });
  if (!session) {
    throw ApiError.notFound('No active session found.');
  }

  const { status, eventName, detail } = req.body;
  const { violation } = await recordBrowserEvent({
    session,
    candidate: req.user,
    status,
    eventName,
    detail,
  });

  res.status(200).json(
    ApiResponse.ok(
      {
        isViolation: Boolean(violation),
        counters: counterState(session),
        violation: violation ? { ...violation } : null,
      },
      'Browser event recorded.'
    )
  );
});

/**
 * GET /api/monitor/status?sessionId=
 * Polled by the monitor UI (or driven live over Socket.IO).
 */
const status = asyncHandler(async (req, res) => {
  const session = await ExamSession.findOne({
    _id: req.query.sessionId,
    candidate: req.user._id,
  });
  if (!session) {
    throw ApiError.notFound('Session not found.');
  }
  const state = await currentState(session);
  res.status(200).json(ApiResponse.ok(state, 'Session status.'));
});

module.exports = { submitFrame, submitBrowserEvent, status, saveEvidenceFrame };
