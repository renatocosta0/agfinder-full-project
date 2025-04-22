import axios from 'axios';
import { PointOfInterest, PoiType, Location, Contribution, ValidationFormData, ContributionFormData } from '../types/pois';
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
 * Get POIs by type
 */
export const getPoisByType = async (
  poiType: PoiType,
  userLocation?: Location,
  sortBy: string = 'distance'
): Promise<PointOfInterest[]> => {
  const params: any = { poiType, sortBy };
  
  if (userLocation) {
    params.latitude = userLocation.latitude;
    params.longitude = userLocation.longitude;
  }
  
  const response = await apiClient.get('/pois', { params });
  return response.data;
};

/**
 * Get POI by ID
 */
export const getPoiById = async (poiId: string): Promise<PointOfInterest> => {
  const response = await apiClient.get(`/pois/${poiId}`);
  return response.data;
};

/**
 * Get recent POIs
 */
export const getRecentPois = async (): Promise<PointOfInterest[]> => {
  const response = await apiClient.get('/pois/recent');
  return response.data;
};

/**
 * Search POIs by query and type
 */
export const searchPois = async (
  query: string,
  poiType?: PoiType,
  userLocation?: Location
): Promise<PointOfInterest[]> => {
  const params: any = { query };
  
  if (poiType) {
    params.poiType = poiType;
  }
  
  if (userLocation) {
    params.latitude = userLocation.latitude;
    params.longitude = userLocation.longitude;
  }
  
  const response = await apiClient.get('/pois/search', { params });
  return response.data;
};

/**
 * Get POI contributions
 */
export const getPoiContributions = async (poiId: string): Promise<Contribution[]> => {
  const response = await apiClient.get(`/pois/${poiId}/contributions`);
  return response.data;
};

/**
 * Add contribution to POI
 */
export const addContribution = async (data: ContributionFormData): Promise<Contribution> => {
  const response = await apiClient.post('/contributions', data);
  return response.data;
};

/**
 * Validate a contribution
 */
export const validateContribution = async (data: ValidationFormData): Promise<void> => {
  await apiClient.post('/validations', data);
}; 