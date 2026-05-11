import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/env';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Attach Authorization header if token exists
api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    // quick debug log for web
    console.log('API Request', config.method?.toUpperCase(), `${config.baseURL}${config.url}`);
  }
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync('auth_token');
  } catch (e) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        token = window.localStorage.getItem('auth_token');
      } catch { }
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (typeof window !== 'undefined') {
      console.log('API Response', res.status, res.config.url);
    }
    return res;
  },
  (err) => {
    // Handle 401 unauthorized (token expired/invalid)
    if (err.response?.status === 401) {
      // Clear token and redirect to login (handled by AuthContext)
      SecureStore.deleteItemAsync('auth_token');
    }
    if (typeof window !== 'undefined') {
      console.log('API Error', err?.response?.status, err?.config?.url, err?.response?.data);
    }
    return Promise.reject(err);
  }
);
