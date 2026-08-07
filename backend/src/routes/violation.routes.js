const express = require('express');

const { protect } = require('../middleware/auth.middleware');
const controller = require('../controllers/violation.controller');

const router = express.Router();

router.get('/', protect, controller.listMyViolations);

module.exports = router;
