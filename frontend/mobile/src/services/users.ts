import { api } from './api';

export interface RecordUserLocationBody {
  lat: number;
  lng: number;
  accuracy?: number;
  source?: string;
  recordedAt?: string; // ISO string
}

export async function recordUserLocation(body: RecordUserLocationBody) {
  const res = await api.post('/api/users/location', body);
  return res.data;
}
