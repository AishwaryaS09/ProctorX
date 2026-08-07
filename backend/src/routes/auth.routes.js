const express = require('express');

const { validate } = require('../middleware/validate.middleware');
const { protect, requireRole } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');
const validators = require('../validators/auth.validators');
const controller = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', authLimiter, validators.register, validate, controller.register);
router.post('/login', authLimiter, validators.login, validate, controller.loginUser);
router.post('/logout', protect, controller.logout);
router.get('/me', protect, controller.me);

module.exports = router;
