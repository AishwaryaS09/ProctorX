const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { registerCandidate, login } = require('../services/auth.service');
const { logAudit } = require('../services/audit.service');
const { env } = require('../config/env');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const { user, token } = await registerCandidate({ name, email, password, phone });

  res.status(201)
    .cookie(env.jwtCookieName, token, { httpOnly: true, sameSite: 'lax' })
    .json(ApiResponse.created({ user, token }, 'Registration successful.'));
});

const loginUser = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const { user, token } = await login({ identifier, password }, { ip: req.ip });

  res.status(200)
    .cookie(env.jwtCookieName, token, { httpOnly: true, sameSite: 'lax' })
    .json(ApiResponse.ok({ user, token }, 'Login successful.'));
});

const logout = asyncHandler(async (req, res) => {
  await logAudit({
    actor: req.user || null,
    action: 'LOGOUT',
    resource: 'user',
    resourceId: req.user ? req.user._id.toString() : null,
    ip: req.ip,
  });
  res.clearCookie(env.jwtCookieName);
  res.status(200).json(ApiResponse.ok(null, 'Logged out successfully.'));
});

const me = asyncHandler(async (req, res) => {
  res.status(200).json(ApiResponse.ok({ user: req.user.toSafeJSON() }, 'Current user.'));
});

module.exports = { register, loginUser, logout, me };
