import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import EditProfileScreen from '../screens/EditProfileScreen';
import HelpScreen from '../screens/HelpScreen';
import LoginScreen from '../screens/LoginScreen';
import NotificationScreen from '../screens/NotificationScreen';
import OnboardingSlide1 from '../screens/Onboarding/OnboardingSlide1';
import OnboardingSlide2 from '../screens/Onboarding/OnboardingSlide2';
import OnboardingSlide3 from '../screens/Onboarding/OnboardingSlide3';
import PaymentDetailsScreen from '../screens/PaymentDetailsScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PoiDetailsScreen from '../screens/PoiDetailsScreen';
import PoisScreen from '../screens/PoisScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RegisterScreen from '../screens/RegisterScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Onboarding1: undefined;
  Onboarding2: undefined;
  Onboarding3: undefined;
  Pois: undefined;
  EditProfile: { name?: string; email?: string };
  PoiDetails: {
    poiId: string | number;
    poiType: 'atm' | 'gasstation';
    currentCreatedAt?: string;
    reportCount?: number;
    fallbackType?: string;
  };
  Help: undefined;
  Profile: undefined;
  Notifications: undefined;
  Payment: undefined;
  Subscription: undefined;
  PaymentDetails: {
    subscriptionType: string;
    subscriptionValue: string;
    reference?: string;
    entity?: string;
    steps?: string[];
    expiresAt?: string;
    durationDays?: number;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { token, hasCompletedOnboarding } = useAuth();
  const isWeb = Platform.OS === 'web';
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          {!hasCompletedOnboarding ? (
            <>
              <Stack.Screen name="Onboarding1" component={OnboardingSlide1} />
              <Stack.Screen name="Onboarding2" component={OnboardingSlide2} />
              <Stack.Screen name="Onboarding3" component={OnboardingSlide3} />
            </>
          ) : null}
          <Stack.Screen name="Pois" component={PoisScreen} />
          <Stack.Screen name="PoiDetails" component={PoiDetailsScreen} />
          <Stack.Screen name="Help" component={HelpScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Notifications" component={NotificationScreen} />
          {!isWeb ? (
            <>
              <Stack.Screen name="Payment" component={PaymentScreen} />
              <Stack.Screen name="Subscription" component={SubscriptionScreen} />
              <Stack.Screen name="PaymentDetails" component={PaymentDetailsScreen} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <Stack.Screen name="Pois" component={PoisScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
