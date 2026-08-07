const ExamSession = require('../models/ExamSession');
const Violation = require('../models/Violation');
const User = require('../models/User');
const FaceEvent = require('../models/FaceEvent');
const BrowserEvent = require('../models/BrowserEvent');

/**
 * Candidate-scoped dashboard stats.
 */
async function candidateDashboard(candidateId) {
  const [sessions, violations, active] = await Promise.all([
    ExamSession.find({ candidate: candidateId }).sort({ createdAt: -1 }).limit(20).lean(),
    Violation.countDocuments({ candidate: candidateId }),
    ExamSession.findOne({ candidate: candidateId, status: 'ACTIVE' }).lean(),
  ]);

  const completed = sessions.filter((s) => s.status === 'COMPLETED');
  const avgTrust = completed.length
    ? Math.round(completed.reduce((sum, s) => sum + s.trustScore, 0) / completed.length)
    : 100;

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    totalViolations: violations,
    avgTrust,
    activeSession: active
      ? {
          id: active._id.toString(),
          examName: active.examName,
          status: active.status,
          trustScore: active.trustScore,
          currentRisk: active.currentRisk,
        }
      : null,
    recentSessions: sessions.slice(0, 10).map((s) => ({
      id: s._id.toString(),
      examName: s.examName,
      status: s.status,
      trustScore: s.trustScore,
      riskLevel: s.currentRisk,
      violationCount: s.violationCount,
      createdAt: s.createdAt,
    })),
  };
}

/**
 * Admin KPIs and cross-session analytics.
 */
async function adminAnalytics() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalCandidates, totalSessions, activeSessions, totalViolations, violationsByType, sessionsLast7Days] =
    await Promise.all([
      User.countDocuments({ role: 'candidate' }),
      ExamSession.countDocuments(),
      ExamSession.countDocuments({ status: 'ACTIVE' }),
      Violation.countDocuments(),
      Violation.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 }, points: { $sum: '$points' } } },
        { $sort: { count: -1 } },
      ]),
      ExamSession.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const faceViolations = await Violation.countDocuments({
    type: { $in: ['FACE_ABSENT', 'MULTIPLE_FACES', 'LOOKING_AWAY'] },
  });
  const browserViolations = await Violation.countDocuments({
    type: { $in: ['TAB_CHANGED', 'WINDOW_UNFOCUSED', 'BROWSER_INACTIVE', 'BROWSER_MINIMIZED', 'FULLSCREEN_EXIT'] },
  });

  const avgTrust = await ExamSession.aggregate([
    { $match: { status: 'COMPLETED' } },
    { $group: { _id: null, avg: { $avg: '$trustScore' } } },
  ]);

  return {
    kpis: {
      totalCandidates,
      totalSessions,
      activeSessions,
      totalViolations,
      avgTrust: avgTrust.length ? Math.round(avgTrust[0].avg) : 100,
    },
    violationsByType: violationsByType.map((v) => ({
      type: v._id,
      count: v.count,
      points: v.points,
    })),
    sessionsLast7Days,
    split: {
      face: faceViolations,
      browser: browserViolations,
    },
  };
}

/**
 * Admin session listing with search + filters + pagination.
 */
async function listSessions({ page = 1, limit = 10, status, search, sort }) {
  const query = {};
  if (status && status !== 'ALL') query.status = status;
  if (search) {
    query.$or = [{ examName: { $regex: search, $options: 'i' } }];
  }

  const skip = (page - 1) * limit;
  const sortOptions =
    sort === 'trust' ? { trustScore: 1 } : sort === 'duration' ? { durationSeconds: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    ExamSession.find(query)
      .populate('candidate', 'name email candidateId')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    ExamSession.countDocuments(query),
  ]);

  return {
    items: items.map((s) => ({
      id: s._id.toString(),
      candidateName: s.candidate ? s.candidate.name : 'Unknown',
      candidateEmail: s.candidate ? s.candidate.email : '',
      candidateId: s.candidate ? s.candidate.candidateId : null,
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
  };
}

async function listCandidates({ page = 1, limit = 10, search }) {
  const query = { role: 'candidate' };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { candidateId: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(query),
  ]);

  const sessionCounts = await ExamSession.aggregate([
    { $match: { candidate: { $in: items.map((c) => c._id) } } },
    { $group: { _id: '$candidate', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  sessionCounts.forEach((s) => { countMap[s._id.toString()] = s.count; });

  return {
    items: items.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      email: c.email,
      candidateId: c.candidateId,
      createdAt: c.createdAt,
      lastLoginAt: c.lastLoginAt,
      totalSessions: countMap[c._id.toString()] || 0,
    })),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = { candidateDashboard, adminAnalytics, listSessions, listCandidates };
