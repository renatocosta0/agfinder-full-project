import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AppStackParamList, TabParamList } from '../types/navigation';
import { 
  HomeScreen, 
  MapScreen, 
  ProfileScreen, 
  PoiDetailScreen, 
  ContributeScreen, 
  SubscriptionScreen 
} from '../screens';
import PoiSelectionNavigator from './PoiSelectionNavigator';
import { Colors } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

const Stack = createStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-circle';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PoiSelection"
        component={PoiSelectionNavigator}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PoiDetail"
        component={PoiDetailScreen}
        options={{
          title: 'Detalhes',
        }}
      />
      <Stack.Screen
        name="Contribute"
        component={ContributeScreen}
        options={{
          title: 'Atualizar Status',
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          title: 'Assinatura',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Meu Perfil',
        }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator; 