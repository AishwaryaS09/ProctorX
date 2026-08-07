import http from './http.js';

export const examApi = {
  start: (payload) => http.post('/exam/start', payload),
  end: (sessionId, payload = {}) => http.post(`/exam/end/${sessionId}`, payload),
  active: () => http.get('/exam/active'),
  history: (params) => http.get('/exam/history', { params }),
  summary: (id) => http.get(`/exam/sessions/${id}`),
};
