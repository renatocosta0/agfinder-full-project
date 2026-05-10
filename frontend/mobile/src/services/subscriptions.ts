import { api } from './api';

export type SubscriptionStatus = 'pending' | 'completed' | 'failed' | 'expired';

export interface SubscriptionTransaction {
  id: string;
  amount: number;
  subscription_type: 'daily' | 'weekly' | 'monthly';
  status: SubscriptionStatus | 'pending';
  created_at: string;
  completed_at?: string | null;
  expires_at: string;
}

export interface CheckStatusResponse {
  status: 'success';
  data: {
    subscription_transaction: SubscriptionTransaction;
  };
}

export async function checkSubscriptionStatus(reference: string): Promise<SubscriptionTransaction> {
  const res = await api.get<CheckStatusResponse>(`/api/subscriptions/status/${encodeURIComponent(reference)}`);
  return res.data.data.subscription_transaction;
}

export interface SubscriptionPlan {
  type: 'daily' | 'weekly' | 'monthly';
  name: string;
  price: number;
  duration_days: number;
  description: string;
}

export interface GetPlansResponse {
  status: 'success';
  data: {
    plans: SubscriptionPlan[];
    has_active_subscription: boolean;
    current_subscription: null | { type: string; end_date: string };
    bonus_info: {
      bonus_points: number;
      exchange_rate: number;
      info_message: string;
    };
  };
}

export async function getSubscriptionPlans(): Promise<GetPlansResponse['data']> {
  const res = await api.get<GetPlansResponse>('/api/subscriptions/plans');
  return res.data.data;
}

export interface CreateSubscriptionBody {
  subscription_type: 'daily' | 'weekly' | 'monthly';
}

export interface CreateSubscriptionResponse {
  status: 'success';
  message: string;
  data: {
    subscription_transaction: {
      id: string;
      amount: number;
      subscription_type: 'daily' | 'weekly' | 'monthly';
      entity: string;
      reference: string;
      expires_at: string;
    };
    payment_instructions: {
      entity: string;
      reference: string;
      amount: number;
      expires_at: string;
      steps: string[];
    };
  };
}

export async function createSubscription(body: CreateSubscriptionBody): Promise<CreateSubscriptionResponse['data']> {
  const res = await api.post<CreateSubscriptionResponse>('/api/subscriptions', body);
  return res.data.data;
}

export async function simulateSubscription(reference: string, action: 'complete' | 'fail'):
  Promise<{ status: 'success' | 'error'; message?: string }>
{
  const res = await api.post<{ status: 'success' | 'error'; message?: string }>(
    `/api/subscriptions/dev/simulate/${encodeURIComponent(reference)}`,
    { action }
  );
  return res.data;
}

export interface SubscriptionTxDisplayInfo {
  subscription_type_name: string;
  duration_days: number;
  amount_formatted: string;
  payment_method_name: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  is_completed: boolean;
  is_pending: boolean;
  is_failed: boolean;
  is_expired: boolean;
}

export interface SubscriptionTxFormattedDates {
  created_at: { date: string; datetime: string };
  completed_at: { date: string; datetime: string } | null;
  expires_at: { date: string; datetime: string };
}

export interface SubscriptionTransactionRow {
  id: string;
  amount: number;
  subscription_type: 'daily' | 'weekly' | 'monthly';
  payment_method: 'proxypay' | 'bonus';
  status: 'pending' | 'completed' | 'failed' | 'expired';
  entity?: string | null;
  reference?: string | null;
  created_at: string;
  completed_at?: string | null;
  expires_at: string;
  formatted_dates: SubscriptionTxFormattedDates;
  display_info: SubscriptionTxDisplayInfo;
}

export interface GetUserTransactionsResponse {
  status: 'success';
  data: {
    transactions: SubscriptionTransactionRow[];
    pagination: { total: number; page: number; limit: number; pages: number };
    summary: {
      subscription: {
        type: 'none' | 'daily' | 'weekly' | 'monthly';
        is_active: boolean;
        days_remaining: number;
        type_name: string;
      };
      has_pending_transactions: boolean;
      has_completed_transactions: boolean;
    };
  };
}

export async function getUserSubscriptionTransactions(params?: {
  status?: 'pending' | 'completed' | 'failed' | 'expired';
  page?: number;
  limit?: number;
  sortBy?: 'created_at:desc' | 'created_at:asc' | 'amount:desc' | 'amount:asc';
}): Promise<GetUserTransactionsResponse['data']> {
  const res = await api.get<GetUserTransactionsResponse>('/api/subscriptions/transactions', { params });
  return res.data.data;
}
