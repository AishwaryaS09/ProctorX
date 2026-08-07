const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const { candidateDashboard } = require('../services/analytics.service');

const dashboard = asyncHandler(async (req, res) => {
  const stats = await candidateDashboard(req.user._id);
  res.status(200).json(ApiResponse.ok(stats, 'Dashboard stats.'));
});

module.exports = { dashboard };
