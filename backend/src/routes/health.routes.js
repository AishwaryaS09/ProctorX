const express = require('express');
const { env } = require('../config/env');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    service: 'proctorx-backend',
    status: 'ok',
    time: new Date().toISOString(),
    env: env.nodeEnv,
  });
});

module.exports = router;
