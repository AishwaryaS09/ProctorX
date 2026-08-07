const express = require('express');

const { protect, requireRole } = require('../middleware/auth.middleware');
const controller = require('../controllers/admin.controller');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(protect, requireRole(ROLES.ADMIN));

router.get('/dashboard', controller.dashboard);
router.get('/analytics', controller.analytics);
router.get('/sessions', controller.sessions);
router.get('/sessions/:id', controller.sessionDetail);
router.get('/sessions/:id/report', controller.report);
router.get('/candidates', controller.candidates);
router.get('/violations', controller.violations);
router.get('/audit-logs', controller.auditLogs);

module.exports = router;
