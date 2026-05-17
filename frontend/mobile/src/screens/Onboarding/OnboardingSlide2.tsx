import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ATMUnit from '../../components/3D/ATMUnit';
import Particles from '../../components/3D/Particles';
import { useAuth } from '../../contexts/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';

type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding2'>;

export default function OnboardingSlide2() {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const { setOnboardingCompleted } = useAuth();

  const handleSkipOnboarding = () => {
    setOnboardingCompleted();
    navigation.navigate('Pois');
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20,
    onPanResponderRelease: (_, g) => {
      if (g.dx < -30) navigation.navigate('Onboarding3');
      else if (g.dx > 30) navigation.navigate('Onboarding1');
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
        <Text style={styles.skipText}>Pular</Text>
      </TouchableOpacity>

      {/* Particles */}
      <Particles />

      {/* Brand Logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>
          AG<Text style={styles.logoHighlight}>FINDER</Text>
        </Text>
      </View>

      {/* ATM 3D */}
      <View style={styles.sceneContainer}>
        <View style={styles.deviceWrapper}>
          <ATMUnit />
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description}>
        Acesse informações atualizadas sobre disponibilidade de dinheiro e papel nos caixas eletrônicos próximos a você. Contribua com atualizações e ajude outros usuários a economizarem tempo.
      </Text>

      {/* Page Indicators */}
      <View style={styles.pagination}>
        <View style={[styles.dot, styles.dotInactive]} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotInactive]} />
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => navigation.navigate('Onboarding3')}
      >
        <Text style={styles.nextButtonText}>Próximo</Text>
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
    height: 320,
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceWrapper: {
    width: 220,
    height: 320,
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
