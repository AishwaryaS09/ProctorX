const express = require('express');

const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const validators = require('../validators/exam.validators');
const controller = require('../controllers/exam.controller');

const router = express.Router();

router.post('/start', protect, validators.start, validate, controller.start);
router.post('/end/:id', protect, validators.end, validators.sessionIdParam, validate, controller.end);
router.get('/active', protect, controller.active);
router.get('/history', protect, controller.history);
router.get('/sessions/:id', protect, validators.sessionIdParam, validate, controller.summary);

module.exports = router;
