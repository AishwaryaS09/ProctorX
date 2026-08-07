import http from './http.js';

export const adminApi = {
  dashboard: () => http.get('/admin/dashboard'),
  sessions: (params) => http.get('/admin/sessions', { params }),
  sessionDetail: (id) => http.get(`/admin/sessions/${id}`),
  reportUrl: (id) => `/api/admin/sessions/${id}/report`,
  candidates: (params) => http.get('/admin/candidates', { params }),
  violations: (params) => http.get('/admin/violations', { params }),
  analytics: () => http.get('/admin/analytics'),
  auditLogs: (params) => http.get('/admin/audit-logs', { params }),
};
