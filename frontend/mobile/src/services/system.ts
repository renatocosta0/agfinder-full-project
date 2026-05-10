import { api } from './api';

export interface SystemConfigResponse {
  success?: boolean;
  status?: string;
  data?: any;
}

export async function getSystemConfig() {
  try {
    const res = await api.get<SystemConfigResponse>('/api/system/config');
    return res.data?.data ?? res.data;
  } catch {
    return null;
  }
}
