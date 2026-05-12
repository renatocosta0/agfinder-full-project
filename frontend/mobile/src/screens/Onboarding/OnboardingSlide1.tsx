import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CombinedScene from '../../components/3D/CombinedScene';
import Particles from '../../components/3D/Particles';
import { useAuth } from '../../contexts/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';

type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding1'>;

export default function OnboardingSlide1() {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const { setOnboardingCompleted } = useAuth();

  const handleSkipOnboarding = () => {
    setOnboardingCompleted();
    navigation.navigate('Pois');
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 20,
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -30) {
        navigation.navigate('Onboarding2');
      }
    },
  }), [navigation]);

  return (
    <LinearGradient
      colors={['#0f1722', '#1e2b3a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
      {...panResponder.panHandlers}
    >
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkipOnboarding}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Particles */}
      <Particles />

      {/* Brand Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>
          AG<Text style={styles.logoHighlight}>FINDER</Text>
        </Text>
      </View>

      {/* 3D Scene with both ATM and Gas Station */}
      <View style={styles.sceneContainer}>
        <CombinedScene />
      </View>

      {/* Description */}
      <Text style={styles.description}>
        Veja informação sobre ATMs e Postos de gasolina onde quer que esteja
      </Text>

      {/* Page Indicators */}
      <View style={styles.pagination}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotInactive]} />
        <View style={[styles.dot, styles.dotInactive]} />
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => navigation.navigate('Onboarding2')}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  skipButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 20,
  },
  skipText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  logoHighlight: {
    color: '#ff3b30',
  },
  sceneContainer: {
    width: '100%',
    maxWidth: 400,
    height: 400,
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 22,
    marginBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 30,
    height: 3,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#ffd700',
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  nextButton: {
    backgroundColor: '#0d141e',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 9999,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
