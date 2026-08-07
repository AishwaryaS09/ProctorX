import http from './http.js';

export const dashboardApi = {
  candidate: () => http.get('/dashboard'),
};
