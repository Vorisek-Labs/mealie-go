import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  api, getServerUrl, getToken, saveServerUrl, saveToken, clearCredentials,
} from '../lib/mealieApi';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  serverUrl: string;
  token: string;
  loading: boolean;
  signIn: (serverUrl: string, token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  serverUrl: '',
  token: '',
  loading: true,
  signIn: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const [url, tok] = await Promise.all([getServerUrl(), getToken()]);
      if (!url || !tok) return;
      setServerUrl(url);
      setToken(tok);
      const profile = await api.getSelf();
      setUser(profile);
    } catch {
      await clearCredentials();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const signIn = useCallback(async (url: string, tok: string, profile: UserProfile) => {
    await Promise.all([saveServerUrl(url), saveToken(tok)]);
    setServerUrl(url.replace(/\/$/, ''));
    setToken(tok);
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await clearCredentials();
    setUser(null);
    setServerUrl('');
    setToken('');
  }, []);

  return (
    <AuthContext.Provider value={{ user, serverUrl, token, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
