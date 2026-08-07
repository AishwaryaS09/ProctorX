const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ExamSession = require('../models/ExamSession');
const {
  startSession,
  endSession,
  getSessionSummary,
  getActiveSession,
} = require('../services/exam.service');
const { emitAdmin } = require('../socket/socketServer');

const start = asyncHandler(async (req, res) => {
  const { examTitle, deviceInfo } = req.body;
  const session = await startSession({
    candidate: req.user,
    examTitle,
    deviceInfo: deviceInfo || {},
  });

  emitAdmin('session_started', { sessionId: session._id.toString(), examName: session.examName });

  res.status(201).json(
    ApiResponse.created(
      {
        sessionId: session._id.toString(),
        examName: session.examName,
        status: session.status,
        trustScore: session.trustScore,
        riskLevel: session.currentRisk,
      },
      'Exam session started. Monitoring is now live.'
    )
  );
});

const end = asyncHandler(async (req, res) => {
  const session = await ExamSession.findOne({
    _id: req.params.id,
    candidate: req.user._id,
    status: 'ACTIVE',
  });
  if (!session) {
    throw ApiError.notFound('No active session found for this id.');
  }

  const updated = await endSession({
    session,
    candidate: req.user,
    finalRemarks: req.body.finalRemarks || null,
  });

  res.status(200).json(
    ApiResponse.ok(
      {
        sessionId: updated._id.toString(),
        status: updated.status,
        durationSeconds: updated.durationSeconds,
        trustScore: updated.trustScore,
        riskLevel: updated.currentRisk,
        violationCount: updated.violationCount,
      },
      'Exam session ended.'
    )
  );
});

const active = asyncHandler(async (req, res) => {
  const session = await getActiveSession(req.user._id);
  res.status(200).json(
    ApiResponse.ok(
      session
        ? {
            sessionId: session._id.toString(),
            examName: session.examName,
            status: session.status,
            startTime: session.startTime,
            trustScore: session.trustScore,
            riskLevel: session.currentRisk,
            violationCount: session.violationCount,
            autoEnded: session.autoEnded,
          }
        : null,
      'Active session.'
    )
  );
});

const history = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ExamSession.find({ candidate: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ExamSession.countDocuments({ candidate: req.user._id }),
  ]);

  res.status(200).json(
    ApiResponse.ok(
      {
        items: items.map((s) => ({
          id: s._id.toString(),
          examName: s.examName,
          status: s.status,
          trustScore: s.trustScore,
          riskLevel: s.currentRisk,
          violationCount: s.violationCount,
          autoEnded: s.autoEnded,
          startTime: s.startTime,
          endTime: s.endTime,
          durationSeconds: s.durationSeconds,
        })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      },
      'Session history.'
    )
  );
});

const summary = asyncHandler(async (req, res) => {
  const session = await ExamSession.findOne({
    _id: req.params.id,
    candidate: req.user._id,
  });
  if (!session) {
    throw ApiError.notFound('Session not found.');
  }
  const summary = await getSessionSummary(session, req.user);
  res.status(200).json(ApiResponse.ok(summary, 'Session summary.'));
});

module.exports = { start, end, active, history, summary };
