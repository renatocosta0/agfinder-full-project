export type PoiType = 'atm' | 'gasstation';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface PointOfInterest {
  id: string;
  poiType: PoiType;
  name: string;
  address: string;
  location: Location;
  distance?: number; // in meters
  lastContribution?: Contribution;
  totalInteractions?: number;
}

export type AtmStatusType = 'money_paper' | 'money_only' | 'paper_only' | 'none';
export type GasStationStatusType = 'gasoline_diesel' | 'gasoline_only' | 'diesel_only' | 'none';
export type ContributionType = AtmStatusType | GasStationStatusType;

export interface Contribution {
  id: string;
  poiId: string;
  userId: string;
  userName: string;
  userProfilePicture?: string;
  contributionType: ContributionType;
  createdAt: string;
  expiresAt: string;
  validCount: number;
  reportCount: number;
  isExpired: boolean;
}

export type ValidationActionType = 'valid' | 'report';

export interface Validation {
  id: string;
  contributionId: string;
  userId: string;
  validationType: ValidationActionType;
  createdAt: string;
}

export interface PoisState {
  pois: PointOfInterest[];
  filteredPois: PointOfInterest[];
  selectedPoi: PointOfInterest | null;
  selectedPoiType: PoiType | null;
  isLoading: boolean;
  error: string | null;
  sortBy: SortOption;
  userLocation: Location | null;
}

export type SortOption = 'distance' | 'recency' | 'interactions';

export interface ContributionFormData {
  poiId: string;
  contributionType: ContributionType;
}

export interface ValidationFormData {
  contributionId: string;
  validationType: ValidationActionType;
} 