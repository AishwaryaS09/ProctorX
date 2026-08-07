/**
 * Tiny logger. In production it can be swapped for pino/winston without
 * touching any other module.
 */
const { env } = require('../config/env');

const LEVEL = env.nodeEnv === 'test' ? 'silent' : 'debug';

function log(level, message, meta) {
  if (LEVEL === 'silent') return;
  const ts = new Date().toISOString();
  const line = meta ? `${ts} [${level}] ${message} ${JSON.stringify(meta)}` : `${ts} [${level}] ${message}`;
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};

module.exports = logger;
