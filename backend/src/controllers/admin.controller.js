const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const ExamSession = require('../models/ExamSession');
const Violation = require('../models/Violation');
const FaceEvent = require('../models/FaceEvent');
const BrowserEvent = require('../models/BrowserEvent');
const AuditLog = require('../models/AuditLog');
const { adminAnalytics, listSessions, listCandidates } = require('../services/analytics.service');
const { getSessionSummary } = require('../services/exam.service');
const { generateSessionPdf } = require('../services/report.service');
const { logAudit } = require('../services/audit.service');

const dashboard = asyncHandler(async (req, res) => {
  const analytics = await adminAnalytics();

  const activeSessions = await ExamSession.find({ status: 'ACTIVE' })
    .populate('candidate', 'name email candidateId')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.status(200).json(
    ApiResponse.ok(
      {
        kpis: analytics.kpis,
        violationsByType: analytics.violationsByType,
        sessionsLast7Days: analytics.sessionsLast7Days,
        split: analytics.split,
        activeSessions: activeSessions.map((s) => ({
          id: s._id.toString(),
          candidateName: s.candidate ? s.candidate.name : 'Unknown',
          examName: s.examName,
          trustScore: s.trustScore,
          riskLevel: s.currentRisk,
          violationCount: s.violationCount,
          startedAt: s.startTime,
        })),
      },
      'Admin dashboard.'
    )
  );
});

const sessions = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const { status, search, sort } = req.query;

  const result = await listSessions({ page, limit, status, search, sort });
  res.status(200).json(ApiResponse.ok(result, 'Sessions.'));
});

const sessionDetail = asyncHandler(async (req, res) => {
  const session = await ExamSession.findById(req.params.id);
  if (!session) {
    throw ApiError.notFound('Session not found.');
  }

  const [violations, warnings, faceEvents, browserEvents] = await Promise.all([
    Violation.find({ session: session._id }).sort({ createdAt: 1 }).lean(),
    Violation.find({ session: session._id, warningLevel: { $gt: 0 } }).sort({ createdAt: 1 }).lean(),
    FaceEvent.find({ session: session._id }).sort({ createdAt: 1 }).limit(200).lean(),
    BrowserEvent.find({ session: session._id }).sort({ createdAt: 1 }).limit(200).lean(),
  ]);

  res.status(200).json(
    ApiResponse.ok(
      {
        session: {
          id: session._id.toString(),
          candidate: session.candidate,
          examName: session.examName,
          status: session.status,
          autoEnded: session.autoEnded,
          finalRemarks: session.finalRemarks,
          startTime: session.startTime,
          endTime: session.endTime,
          durationSeconds: session.durationSeconds,
          trustScore: session.trustScore,
          riskLevel: session.currentRisk,
          violationCount: session.violationCount,
          deviceInfo: session.deviceInfo,
        },
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
        faceEvents: faceEvents.map((e) => ({
          id: e._id.toString(),
          faceStatus: e.faceStatus,
          faceCount: e.faceCount,
          confidence: e.confidence,
          remark: e.remark,
          createdAt: e.createdAt,
        })),
        browserEvents: browserEvents.map((e) => ({
          id: e._id.toString(),
          status: e.status,
          eventName: e.eventName,
          detail: e.detail,
          isViolation: e.isViolation,
          createdAt: e.createdAt,
        })),
      },
      'Session detail.'
    )
  );
});

const candidates = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const result = await listCandidates({ page, limit, search: req.query.search });
  res.status(200).json(ApiResponse.ok(result, 'Candidates.'));
});

const violations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const { type, severity, search } = req.query;

  const query = {};
  if (type && type !== 'ALL') query.type = type;
  if (severity && severity !== 'ALL') query.severity = severity;
  if (search) {
    query.$or = [{ message: { $regex: search, $options: 'i' } }, { type: { $regex: search, $options: 'i' } }];
  }

  const [items, total] = await Promise.all([
    Violation.find(query)
      .populate('candidate', 'name email candidateId')
      .populate('session', 'examName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Violation.countDocuments(query),
  ]);

  res.status(200).json(
    ApiResponse.ok(
      {
        items: items.map((v) => ({
          id: v._id.toString(),
          sessionId: v.session ? v.session._id.toString() : null,
          examName: v.session ? v.session.examName : 'Unknown',
          candidateName: v.candidate ? v.candidate.name : 'Unknown',
          type: v.type,
          severity: v.severity,
          points: v.points,
          message: v.message,
          createdAt: v.createdAt,
        })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      },
      'Violations.'
    )
  );
});

const analytics = asyncHandler(async (req, res) => {
  const data = await adminAnalytics();
  res.status(200).json(ApiResponse.ok(data, 'Analytics.'));
});

const auditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const [items, total] = await Promise.all([
    AuditLog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(),
  ]);

  res.status(200).json(
    ApiResponse.ok(
      {
        items: items.map((l) => ({
          id: l._id.toString(),
          actorName: l.actorName,
          actorRole: l.actorRole,
          action: l.action,
          resource: l.resource,
          resourceId: l.resourceId,
          details: l.details,
          ip: l.ip,
          createdAt: l.createdAt,
        })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      },
      'Audit logs.'
    )
  );
});

const report = asyncHandler(async (req, res) => {
  const session = await ExamSession.findById(req.params.id);
  if (!session) {
    throw ApiError.notFound('Session not found.');
  }

  await session.populate('candidate', 'name email candidateId');
  const summary = await getSessionSummary(session, session.candidate);
  const violations = await Violation.find({ session: session._id }).sort({ createdAt: 1 }).lean();

  const pdf = await generateSessionPdf(summary, violations);

  await logAudit({
    actor: req.user,
    action: 'REPORT_DOWNLOADED',
    resource: 'exam_session',
    resourceId: session._id.toString(),
    ip: req.ip,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="session-${session._id}.pdf"`);
  res.send(pdf);
});

module.exports = {
  dashboard,
  sessions,
  sessionDetail,
  candidates,
  violations,
  analytics,
  auditLogs,
  report,
};
