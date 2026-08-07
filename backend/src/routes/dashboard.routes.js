const express = require('express');

const { protect } = require('../middleware/auth.middleware');
const controller = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/', protect, controller.dashboard);

module.exports = router;
