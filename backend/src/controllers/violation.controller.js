const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const Violation = require('../models/Violation');

/**
 * GET /api/violations - candidate's own violation history with pagination.
 */
const listMyViolations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const type = req.query.type || null;

  const query = { candidate: req.user._id };
  if (type && type !== 'ALL') query.type = type;

  const [items, total] = await Promise.all([
    Violation.find(query)
      .populate('session', 'examName')
      .sort({ createdAt: -1 })
      .skip(skip)
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
          type: v.type,
          severity: v.severity,
          points: v.points,
          message: v.message,
          warningLevel: v.warningLevel,
          createdAt: v.createdAt,
        })),
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
      },
      'Violations.'
    )
  );
});

module.exports = { listMyViolations };
