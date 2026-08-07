const mongoose = require('mongoose');

/**
 * Connect to MongoDB. Env vars are read at call time (see env.js) so the
 * connection string can never be frozen at import time.
 */
async function connectDB() {
  const { env } = require('./env');
  const uri = env.mongoUri;

  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log('[mongo] connected');
  });
  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[mongo] connection error:', err.message);
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
