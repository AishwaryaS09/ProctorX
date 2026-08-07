const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { logAudit } = require('../services/audit.service');

const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json(ApiResponse.ok({ user: req.user.toSafeJSON() }, 'Profile loaded.'));
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;

  if (name !== undefined) {
    if (String(name).trim().length < 2) {
      throw ApiError.badRequest('Name must be at least 2 characters.');
    }
    req.user.name = name.trim();
  }

  if (phone !== undefined) {
    if (String(phone).trim().length > 20) {
      throw ApiError.badRequest('Phone number is too long.');
    }
    req.user.phone = phone ? String(phone).trim() : undefined;
  }

  await req.user.save();
  await logAudit({
    actor: req.user,
    action: 'PROFILE_UPDATED',
    resource: 'user',
    resourceId: req.user._id.toString(),
    ip: req.ip,
  });

  res.status(200).json(ApiResponse.ok({ user: req.user.toSafeJSON() }, 'Profile updated.'));
});

module.exports = { getProfile, updateProfile };
