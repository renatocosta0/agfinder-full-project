import axios from 'axios';
import { User } from '../types/auth';
import { API_URL } from '@env';

// Configure the base URL for API requests
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

/**
 * Authenticate user with Google token
 */
export const googleSignIn = async (idToken: string): Promise<{ token: string }> => {
  const response = await apiClient.post('/auth/google', { idToken });
  return response.data;
};

/**
 * Get user profile information
 */
export const getUserProfile = async (token: string): Promise<User> => {
  setAuthToken(token);
  const response = await apiClient.get('/users/profile');
  return response.data;
};

/**
 * Verify if the token is valid
 */
export const verifyToken = async (token: string): Promise<boolean> => {
  try {
    setAuthToken(token);
    await apiClient.get('/auth/verify');
    return true;
  } catch (error) {
    return false;
  }
}; 