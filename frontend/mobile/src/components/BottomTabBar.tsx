import React from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface BottomTabBarProps {
  poiType?: 'atms' | 'gasstations';
}

export default function BottomTabBar({ poiType = 'atms' }: BottomTabBarProps) {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  
  const isPoisScreen = route.name === 'Pois';
  const isHelpScreen = route.name === 'Help';

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity 
        style={styles.navItem}
        onPress={() => navigation.navigate('Pois')}
      >
        <Image 
          source={require('../../assets/icons/atms.png')} 
          style={[styles.navIcon, isPoisScreen && styles.navIconActive]} 
        />
        <Text style={isPoisScreen ? styles.navTextActive : styles.navText}>
          {poiType === 'atms' ? 'Atms' : 'Gas Stations'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.navItem}
        onPress={() => navigation.navigate('Help')}
      >
        <Image 
          source={require('../../assets/icons/help.png')} 
          style={[styles.navIcon, isHelpScreen && styles.navIconActive]} 
        />
        <Text style={isHelpScreen ? styles.navTextActive : styles.navText}>
          Help
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1c1c1e',
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navIcon: {
    width: 24,
    height: 24,
    tintColor: '#666',
  },
  navIconActive: {
    tintColor: '#3b82f6',
  },
  navText: {
    color: '#666',
    fontSize: 12,
  },
  navTextActive: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
});
