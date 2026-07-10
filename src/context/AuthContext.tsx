import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  api, getServerUrl, getToken, saveServerUrl, saveToken, clearCredentials,
} from '../lib/mealieApi';
import type { UserProfile } from '../types';

// Refresh well before typical JWT expiry so the user is never forced to a
// surprise re-login mid-session. /api/auth/refresh only works on a token
// that's still valid, so this must run proactively, not on 401.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface AuthContextType {
  user: UserProfile | null;
  serverUrl: string;
  token: string;
  loading: boolean;
  // True only immediately after an explicit signIn() this app session — never
  // true for a session auto-restored from a saved token on cold start. Used
  // to gate the Welcome screen so it only ever appears right after a real
  // login action, not every time an already-logged-in user reopens the app.
  justSignedIn: boolean;
  signIn: (serverUrl: string, token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  serverUrl: '',
  token: '',
  loading: true,
  justSignedIn: false,
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
  const [justSignedIn, setJustSignedIn] = useState(false);
  const signedInRef = useRef(false);

  const checkSession = useCallback(async () => {
    try {
      const [url, tok] = await Promise.all([getServerUrl(), getToken()]);
      if (!url || !tok) return;
      setServerUrl(url);
      setToken(tok);
      const profile = await api.getSelf();
      setUser(profile);
      signedInRef.current = true;
    } catch {
      await clearCredentials();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const silentRefresh = useCallback(async () => {
    if (!signedInRef.current) return;
    try {
      const { access_token } = await api.refreshToken();
      await saveToken(access_token);
      setToken(access_token);
    } catch {
      // Non-fatal — the existing token may still be valid, or the user will
      // be prompted to re-login next time a request actually fails with 401.
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(silentRefresh, REFRESH_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') silentRefresh();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [silentRefresh]);

  const signIn = useCallback(async (url: string, tok: string, profile: UserProfile) => {
    await Promise.all([saveServerUrl(url), saveToken(tok)]);
    setServerUrl(url.replace(/\/$/, ''));
    setToken(tok);
    setUser(profile);
    signedInRef.current = true;
    setJustSignedIn(true);
  }, []);

  const logout = useCallback(async () => {
    await clearCredentials();
    signedInRef.current = false;
    setJustSignedIn(false);
    setUser(null);
    setServerUrl('');
    setToken('');
  }, []);

  return (
    <AuthContext.Provider value={{ user, serverUrl, token, loading, justSignedIn, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
