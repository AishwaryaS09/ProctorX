import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { authApi } from '../api/auth.api.js';
import { tokenStorage, userStorage } from '../api/http.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(userStorage.get());
  const [token, setToken] = useState(tokenStorage.get());
  const [loading, setLoading] = useState(Boolean(tokenStorage.get()));

  const persist = useCallback((newUser, newToken) => {
    setUser(newUser);
    setToken(newToken);
    if (newToken) tokenStorage.set(newToken);
    if (newUser) userStorage.set(newUser);
  }, []);

  const login = useCallback(
    async (payload) => {
      const { data } = await authApi.login(payload);
      persist(data.user, data.token);
      return data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await authApi.register(payload);
      persist(data.user, data.token);
      return data.user;
    },
    [persist]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore network errors on logout
    }
    persist(null, null);
  }, [persist]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setUser(data.user);
      userStorage.set(data.user);
    } catch {
      persist(null, null);
    }
  }, [persist]);

  useEffect(() => {
    if (tokenStorage.get()) {
      refresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
