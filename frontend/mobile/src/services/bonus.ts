import { api } from './api';

export interface BonusHistoryItem {
  id: string;
  amount: number;
  type: string;
  description: string;
  status: string;
  created_at: string;
}

export interface GetBonusHistoryResponse {
  success?: boolean;
  status?: 'success'|'error';
  data?: {
    results: BonusHistoryItem[];
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
  };
  // Some controllers may return a direct payload without wrapping
  results?: BonusHistoryItem[];
  page?: number;
  limit?: number;
  totalPages?: number;
  totalResults?: number;
}

export async function getBonusHistory(params?: { page?: number; limit?: number; status?: string; startDate?: string; endDate?: string; }): Promise<{ items: BonusHistoryItem[]; page: number; totalPages: number; }> {
  const res = await api.get<GetBonusHistoryResponse>('/api/bonus/history', { params });
  if (res.data.data) {
    return { items: res.data.data.results, page: res.data.data.page, totalPages: res.data.data.totalPages };
  }
  return { items: res.data.results || [], page: res.data.page || 1, totalPages: res.data.totalPages || 1 };
}
