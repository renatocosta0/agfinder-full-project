import { api } from './api';

export type PoiTypeApi = 'atm' | 'gasstation';

export interface GetPoisParams {
  lat: number;
  lng: number;
  radius?: number;
  type?: PoiTypeApi;
  page?: number;
  limit?: number;
  include_contributions?: boolean;
  forceRefresh?: boolean;
}

export interface PoiListItemApi {
  id: string | number;
  name: string;
  poi_type: PoiTypeApi;
  latitude: number;
  longitude: number;
  address?: string;
  distance_km?: number;
  total_interactions?: number;
  has_current_contribution?: boolean;
  current_contribution?: {
    id: string | number;
    type: string;
    created_at: string;
  } | null;
}

export interface GetPoisResponse {
  status?: string;
  success?: boolean;
  data: {
    pois: PoiListItemApi[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
    meta?: any;
  };
}

export async function getPois(params: GetPoisParams): Promise<{ pois: PoiListItemApi[]; pagination?: GetPoisResponse['data']['pagination'] }> {
  const res = await api.get<GetPoisResponse>('/api/pois', { params });
  // API might respond with {success:true,data:{...}} or {status:'success', data:{...}}
  const payload = res.data?.data ?? (res.data as any);
  return { pois: (payload.pois as PoiListItemApi[]) || [], pagination: payload.pagination };
}

export async function getPoisSearch(params: { q: string; page?: number; limit?: number; include_contributions?: boolean }): Promise<{ pois: PoiListItemApi[]; pagination?: GetPoisResponse['data']['pagination'] }> {
  const res = await api.get<GetPoisResponse>('/api/pois/search', { params });
  const payload = res.data?.data ?? (res.data as any);
  return { pois: (payload.pois as PoiListItemApi[]) || [], pagination: payload.pagination };
}

export async function getPoisGlobal(params: { type?: PoiTypeApi; orderBy: 'recent' | 'reports'; page?: number; limit?: number; forceRefresh?: boolean }): Promise<{ pois: PoiListItemApi[]; pagination?: GetPoisResponse['data']['pagination'] }> {
  const res = await api.get<GetPoisResponse>('/api/pois/global', { params });
  const payload = res.data?.data ?? (res.data as any);
  return { pois: (payload.pois as PoiListItemApi[]) || [], pagination: payload.pagination };
}

export interface PoiDetailsResponse {
  status?: string;
  success?: boolean;
  data: {
    poi: {
      id: string | number;
      name: string;
      poi_type: PoiTypeApi;
      latitude: number;
      longitude: number;
      contributions?: Array<{
        id: string | number;
        contribution_type: string;
        is_current?: boolean;
        created_at: string;
      }>;
      total_interactions?: number;
    };
  };
}

export async function getPoiDetails(
  id: string | number,
  opts?: { include_contributions?: boolean; forceRefresh?: boolean }
) {
  const doReq = async () => api.get<PoiDetailsResponse>(`/api/pois/${id}`, {
    params: {
      include_contributions: opts?.include_contributions ?? true,
      forceRefresh: opts?.forceRefresh ? 'true' : undefined,
      _ts: opts?.forceRefresh ? Date.now() : undefined,
    },
  });

  let attempt = 0;
  const maxAttempts = 3; // initial + 2 retries
  while (true) {
    try {
      const res = await doReq();
      const payload: any = (res.data as any)?.data ?? res.data;
      return payload?.poi ?? payload;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 429 || attempt >= maxAttempts - 1) throw err;
      const retryAfterHeader = err?.response?.headers?.['retry-after'];
      let delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s
      const parsed = Number(retryAfterHeader);
      if (!Number.isNaN(parsed) && parsed > 0) delayMs = parsed * 1000;
      await new Promise((r) => setTimeout(r, delayMs));
      attempt++;
    }
  }
}

export interface PostContributionBody {
  contribution_type: string;
  details?: Record<string, any>;
}

export async function postContribution(poiId: string | number, body: PostContributionBody) {
  const res = await api.post(`/api/pois/${poiId}/contributions`, body);
  return res.data;
}
