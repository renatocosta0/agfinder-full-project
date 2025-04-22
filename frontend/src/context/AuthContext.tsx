import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/auth';
import * as authApi from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load token from storage
    const loadToken = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('userToken');
        
        if (savedToken) {
          setToken(savedToken);
          await fetchUserProfile(savedToken);
        }
      } catch (e) {
        console.error('Failed to load authentication token', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  const fetchUserProfile = async (accessToken: string) => {
    try {
      const userData = await authApi.getUserProfile(accessToken);
      setUser(userData);
    } catch (e) {
      console.error('Failed to fetch user profile', e);
      setError('Failed to fetch user profile');
      setToken(null);
      await AsyncStorage.removeItem('userToken');
    }
  };

  const signIn = async (accessToken: string) => {
    setIsLoading(true);
    try {
      await AsyncStorage.setItem('userToken', accessToken);
      setToken(accessToken);
      await fetchUserProfile(accessToken);
      setError(null);
    } catch (e) {
      console.error('Sign in error', e);
      setError('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem('userToken');
      setToken(null);
      setUser(null);
    } catch (e) {
      console.error('Sign out error', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}; 