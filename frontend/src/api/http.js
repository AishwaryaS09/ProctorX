import axios from 'axios';

const TOKEN_KEY = 'proctorx_token';
const USER_KEY = 'proctorx_user';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const userStorage = {
  get: () => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  set: (u) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear: () => localStorage.removeItem(USER_KEY),
};

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'Request failed';
    if (status === 401) {
      tokenStorage.clear();
      userStorage.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject({ status, message, data: error.response?.data });
  }
);

export default http;
