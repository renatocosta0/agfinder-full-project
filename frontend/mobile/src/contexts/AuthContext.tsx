import React, { createContext, useContext, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface AuthContextValue {
  token: string | null;
  setToken: (t: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);

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
        } catch {}
      }
      // Ignore storage errors to not block app flow
    }
  };

  const value = useMemo(() => ({ token, setToken }), [token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
