import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

interface AuthContextValue {
  token: string | null | undefined;
  hydrated: boolean;
  setToken: (t: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let t: string | null = null;
      try {
        t = await SecureStore.getItemAsync('auth_token');
      } catch {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          try {
            t = window.localStorage.getItem('auth_token');
          } catch {
            t = null;
          }
        }
      }
      if (!cancelled) setTokenState(t);
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setToken = async (t: string | null) => {
    setTokenState(t);
    try {
      if (t) await SecureStore.setItemAsync('auth_token', t);
      else await SecureStore.deleteItemAsync('auth_token');
    } catch (e) {
      // Fallback for web: use localStorage if available
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          if (t) window.localStorage.setItem('auth_token', t);
          else window.localStorage.removeItem('auth_token');
        } catch { }
      }
      // Ignore storage errors to not block app flow
    }
  };

  const value = useMemo(() => ({ token, hydrated, setToken }), [token, hydrated]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
