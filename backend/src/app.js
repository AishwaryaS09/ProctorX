const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const { env } = require('./config/env');
const { sanitize } = require('./middleware/sanitize.middleware');
const { apiLimiter } = require('./middleware/rateLimiter.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const candidateRoutes = require('./routes/candidate.routes');
const examRoutes = require('./routes/exam.routes');
const monitorRoutes = require('./routes/monitor.routes');
const violationRoutes = require('./routes/violation.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(sanitize());

app.use('/api', apiLimiter);

app.use('/healthz', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/candidate', candidateRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/violations', violationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
