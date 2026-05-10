import { api } from './api';

export type LoginRequest = { email: string; password: string };
export type RegisterRequest = { name: string; email: string; password: string };

export interface User {
  id: string;
  name: string;
  email: string;
  profile_picture?: string;
  bonus_points: number;
  subscription_type: string;
  subscription_end?: string;
  is_banned: boolean;
}

export interface AuthResponse {
  status: 'success' | 'error';
  message: string;
  token: string;
  data: {
    user: User;
  };
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/api/auth/login', body);
  return res.data;
}

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/api/auth/register', body);
  return res.data;
}

export interface MeResponse {
  status: 'success';
  data: {
    user: User;
  };
}

export type UpdateMeRequest = { name?: string; email?: string };

export interface UpdateMeResponse {
  status: 'success' | 'error';
  message?: string;
  data?: {
    user: User;
  };
}

export async function me(): Promise<User> {
  const res = await api.get<MeResponse>('/api/auth/me');
  return res.data?.data?.user ?? (res.data as unknown as User);
}

export async function updateMe(body: UpdateMeRequest): Promise<User> {
  const res = await api.put<UpdateMeResponse>('/api/users/me', body);
  return res.data?.data?.user ?? (res.data as unknown as User);
}
