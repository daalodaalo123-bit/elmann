import { createContext, useContext } from 'react';

export type AuthUser = {
  id: string;
  username: string;
  role: 'owner' | 'cashier';
};

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

