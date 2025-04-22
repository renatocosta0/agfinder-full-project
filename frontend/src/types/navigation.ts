import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { PoiType } from './pois';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
};

export type AppStackParamList = {
  Main: undefined;
  PoiSelection: undefined;
  PoiDetail: { poiId: string };
  Contribute: { poiId: string };
  Subscription: undefined;
  Profile: undefined;
};

export type TabParamList = {
  Home: undefined;
  Map: undefined;
  Profile: undefined;
};

export type PoiSelectionParamList = {
  PoiTypeSelection: undefined;
  PoiList: { poiType: PoiType };
};

export type WelcomeScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Welcome'>;
export type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

export type HomeScreenNavigationProp = StackNavigationProp<TabParamList, 'Home'>;

export type PoiTypeSelectionScreenNavigationProp = StackNavigationProp<PoiSelectionParamList, 'PoiTypeSelection'>;
export type PoiTypeSelectionScreenRouteProp = RouteProp<PoiSelectionParamList, 'PoiTypeSelection'>;

export type PoiListScreenNavigationProp = StackNavigationProp<PoiSelectionParamList, 'PoiList'>;
export type PoiListScreenRouteProp = RouteProp<PoiSelectionParamList, 'PoiList'>;

export type PoiDetailScreenNavigationProp = StackNavigationProp<AppStackParamList, 'PoiDetail'>;
export type PoiDetailScreenRouteProp = RouteProp<AppStackParamList, 'PoiDetail'>;

export type ContributeScreenNavigationProp = StackNavigationProp<AppStackParamList, 'Contribute'>;
export type ContributeScreenRouteProp = RouteProp<AppStackParamList, 'Contribute'>;

export type SubscriptionScreenNavigationProp = StackNavigationProp<AppStackParamList, 'Subscription'>;

export type ProfileScreenNavigationProp = StackNavigationProp<TabParamList, 'Profile'>; 