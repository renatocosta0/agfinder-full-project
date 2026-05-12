import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

interface AuthContextValue {
  token: string | null;
  setToken: (t: string | null) => Promise<void>;
  hasCompletedOnboarding: boolean;
  setOnboardingCompleted: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [hasCompletedOnboarding, setOnboardingCompletedState] = useState(false);

  // Load persisted token and onboarding state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let stored: string | null = null;
        try {
          stored = await SecureStore.getItemAsync('auth_token');
        } catch (e) {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try {
              stored = window.localStorage.getItem('auth_token');
            } catch { }
          }
        }
        if (!cancelled) setTokenState(stored);
      } catch {
        // ignore load errors
      }

      try {
        let onboardingCompleted: string | null = null;
        try {
          onboardingCompleted = await SecureStore.getItemAsync('onboarding_completed');
        } catch (e) {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            try {
              onboardingCompleted = window.localStorage.getItem('onboarding_completed');
            } catch { }
          }
        }
        if (!cancelled) setOnboardingCompletedState(onboardingCompleted === 'true');
      } catch {
        // ignore load errors
      }
    })();
    return () => { cancelled = true; };
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

  const setOnboardingCompleted = async () => {
    setOnboardingCompletedState(true);
    try {
      await SecureStore.setItemAsync('onboarding_completed', 'true');
    } catch (e) {
      // Fallback for web: use localStorage if available
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('onboarding_completed', 'true');
        } catch { }
      }
      // Ignore storage errors to not block app flow
    }
  };

  const value = useMemo(() => ({ token, setToken, hasCompletedOnboarding, setOnboardingCompleted }), [token, hasCompletedOnboarding]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
