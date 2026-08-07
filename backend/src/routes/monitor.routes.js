const express = require('express');

const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const validators = require('../validators/monitor.validators');
const controller = require('../controllers/monitor.controller');

const router = express.Router();

router.post('/frame', protect, validators.frame, validate, controller.submitFrame);
router.post('/browser', protect, validators.browser, validate, controller.submitBrowserEvent);
router.get('/status', protect, controller.status);

module.exports = router;
