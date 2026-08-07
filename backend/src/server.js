const http = require('http');

const app = require('./app');
const { env } = require('./config/env');
const { connectDB } = require('./config/db');
const { attachSocket } = require('./socket/socketServer');
const { seedAdmin } = require('./scripts/seedAdmin');

async function start() {
  await connectDB();
  await seedAdmin();

  const server = http.createServer(app);
  attachSocket(server);

  server.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] ProctorX backend listening on http://${env.host}:${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[server] ${signal} received, shutting down...`);
    server.close();
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
