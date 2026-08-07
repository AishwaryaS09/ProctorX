import http from './http.js';

export const violationApi = {
  list: (params) => http.get('/violations', { params }),
};
