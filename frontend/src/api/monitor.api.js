import http from './http.js';

export const monitorApi = {
  submitFrame: (payload) => http.post('/monitor/frame', payload),
  submitBrowserEvent: (payload) => http.post('/monitor/browser', payload),
  status: (sessionId) => http.get('/monitor/status', { params: { sessionId } }),
};
