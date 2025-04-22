export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  bonusPoints: number;
  hasActiveSubscription: boolean;
  currentSubscriptionEnd?: string;
  warningCount: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
} 