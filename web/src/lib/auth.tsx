import React, { useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, getAuthToken } from './api';
import { AuthContext, type AuthContextValue, type AuthUser } from './authContext';

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(() => getAuthToken());

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const t = getAuthToken();
      setToken(t);
      if (!t) {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<{ user: AuthUser }>('/api/auth/me');
        if (!mounted) return;
        setUser(me.user);
      } catch {
        if (!mounted) return;
        setAuthToken(null);
        setToken(null);
        setUser(null);
      }
      if (!mounted) return;
      setLoading(false);
    }
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  async function login(username: string, password: string) {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', {
      username,
      password
    });
    setAuthToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, token, login, logout }),
    [user, loading, token]
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

