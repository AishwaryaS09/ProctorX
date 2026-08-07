const { RISK } = require('../config/constants');

/**
 * Duration between two timestamps in seconds.
 */
function durationSeconds(start, end = new Date()) {
  if (!start) return 0;
  return Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000));
}

/**
 * Human readable duration from seconds, e.g. "1h 2m 3s".
 */
function humanizeDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/**
 * Map a trust score to a risk label using the configured bands.
 */
function riskFor(trustScore) {
  if (trustScore >= RISK.LOW.min) return RISK.LOW.label;
  if (trustScore >= RISK.MEDIUM.min) return RISK.MEDIUM.label;
  if (trustScore >= RISK.HIGH.min) return RISK.HIGH.label;
  return RISK.CRITICAL.label;
}

/**
 * Small helper used by admin filtering to parse an optional status string.
 */
function normalizeStatus(status) {
  return status ? String(status).toUpperCase() : undefined;
}

module.exports = { durationSeconds, humanizeDuration, riskFor, normalizeStatus };
