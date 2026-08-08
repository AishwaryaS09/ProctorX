const { env } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Client for the isolated Python FastAPI AI service.
 * The Node backend is the only consumer; the browser never talks to Python.
 */

async function requestPython(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiServiceTimeoutMs);

  let response;
  try {
    response = await fetch(`${env.aiServiceUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    logger.warn('[ai] Python service unreachable', { path, error: err.message });
    throw new Error('AI service unavailable');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.warn('[ai] Python service error', { path, status: response.status, text });
    throw new Error(`AI service error (${response.status})`);
  }

  return response.json();
}

/**
 * Analyze a single webcam frame (base64, optionally data-URL prefixed).
 * Normalises snake_case responses from the Python service into camelCase.
 */
async function analyzeFrame(imageBase64) {
  const data = await requestPython('/api/ai/analyze-frame', { image: imageBase64 });
  return normalizeFaceResult(data);
}

async function detectFace(imageBase64) {
  const data = await requestPython('/api/ai/detect-face', { image: imageBase64 });
  return normalizeFaceResult(data);
}

async function validateFrame(imageBase64) {
  return requestPython('/api/ai/validate-frame', { image: imageBase64 });
}

function normalizeFaceResult(data) {
  return {
    faceStatus: (data.faceStatus || data.face_status || 'ERROR').toUpperCase(),
    faceCount: data.faceCount ?? data.face_count ?? 0,
    confidence: data.confidence ?? 0,
    multipleFaces: data.multipleFaces ?? data.multiple_faces ?? false,
    lookingAway: data.lookingAway ?? data.looking_away ?? false,
    remark: data.remark || data.remarks || '',
  };
}

module.exports = { analyzeFrame, detectFace, validateFrame };
