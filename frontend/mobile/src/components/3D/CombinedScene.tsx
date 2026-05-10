import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CombinedScene() {
  return (
    <View style={styles.sceneContainer}>
      {/* Ground/Floor */}
      <View style={styles.ground} />
      
      {/* Lighting Effects */}
      <View style={styles.spotLight} />
      <View style={styles.glowAtm} />
      <View style={styles.glowGas} />
      
      {/* ATM Unit */}
      <View style={styles.atmUnit}>
        <LinearGradient
          colors={['#054a2d', '#0a6940', '#054a2d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.atmBody}
        >
          {/* Top Panel */}
          <LinearGradient
            colors={['#043e23', '#065a35']}
            style={styles.atmTopPanel}
          />

          {/* Logo */}
          <View style={styles.atmLogoContainer}>
            <Text style={styles.atmLogo}>ATM</Text>
            <Text style={styles.atmLogoSubtext}>BANCO NACIONAL</Text>
            <View style={styles.atmLogoDivider} />
          </View>

          {/* Screen Recess */}
          <View style={styles.atmScreenRecess}>
            {/* Screen Icons */}
            <View style={styles.atmScreenIcons}>
              <View style={styles.atmScreenIcon} />
              <View style={styles.atmScreenIcon} />
            </View>

            {/* Screen */}
            <View style={styles.atmScreen}>
              <LinearGradient
                colors={['#2a3544', '#1e2936']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.screenGradient}
              >
                <View style={styles.screenContent}>
                  <View style={styles.screenInterface}>
                    <View style={styles.screenHeader}>
                      <Text style={styles.screenHeaderText}>BANCO 24H</Text>
                      <Text style={styles.screenHeaderText}>12:45</Text>
                    </View>
                    <Text style={styles.screenWelcome}>BEM-VINDO, SELECIONE UMA{'\n'}OPÇÃO</Text>
                    <View style={styles.screenMenuItem}>
                      <View style={styles.menuItemIndicator} />
                    </View>
                    <View style={styles.screenMenuItem}>
                      <View style={styles.menuItemIndicator} />
                    </View>
                    <View style={[styles.screenMenuItem, styles.menuItemActive]}>
                      <View style={[styles.menuItemIndicator, styles.menuItemIndicatorActive]} />
                    </View>
                    <View style={styles.screenMenuItem}>
                      <View style={styles.menuItemIndicator} />
                    </View>
                  </View>
                </View>
                <View style={styles.screenReflection} />
              </LinearGradient>
            </View>
          </View>

          {/* Keypad */}
          <View style={styles.atmKeypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'X', 0, '✓'].map((key, index) => (
              <View key={index} style={styles.atmKey}>
                <Text style={[
                  styles.keyText,
                  key === 'X' && styles.keyTextRed,
                  key === '✓' && styles.keyTextGreen
                ]}>{key}</Text>
              </View>
            ))}
          </View>

          {/* Card Slot */}
          <LinearGradient
            colors={['#111', '#222']}
            style={styles.atmSlot}
          >
            <View style={styles.slotLine} />
          </LinearGradient>
        </LinearGradient>
      </View>

      {/* Gas Station */}
      <View style={styles.gasStation}>
        {/* Roof */}
        <LinearGradient
          colors={['#a41212', '#d92b2b']}
          style={styles.gasRoof}
        >
          <View style={styles.gasRoofHighlight} />
          <Text style={styles.gasRoofText}>POSTO</Text>
        </LinearGradient>

        {/* Logo */}
        <View style={styles.gasLogo}>
          <LinearGradient
            colors={['#ff4500', '#cc0000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gasLogoGradient}
          />
          <Text style={styles.gasLogoText}>GAS</Text>
        </View>

        {/* Ceiling Light */}
        <View style={styles.gasCeilingLight} />

        {/* Pillars */}
        <LinearGradient
          colors={['#d0d0d0', '#f5f5f5', '#d0d0d0']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gasPillarLeft}
        />
        <LinearGradient
          colors={['#d0d0d0', '#f5f5f5', '#d0d0d0']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gasPillarRight}
        />

        {/* Pump */}
        <LinearGradient
          colors={['#9e0d0d', '#cc1212']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gasPump}
        >
          {/* Pump Header */}
          <View style={styles.pumpHeader} />

          {/* Pump Display */}
          <View style={styles.pumpDisplay}>
            <Text style={styles.pumpDisplayLabel}>LITROS</Text>
            <Text style={styles.pumpPrice}>R$ 5,79</Text>
          </View>

          {/* Fuel Types */}
          <View style={styles.pumpFuelTypes}>
            <View style={[styles.pumpFuelType, { backgroundColor: '#cc0000' }]} />
            <View style={[styles.pumpFuelType, { backgroundColor: '#009900' }]} />
            <View style={[styles.pumpFuelType, { backgroundColor: '#0066cc' }]} />
          </View>

          {/* Buttons */}
          <View style={styles.pumpButtons}>
            <View style={styles.pumpButton} />
            <View style={[styles.pumpButton, styles.pumpButtonGreen]} />
            <View style={styles.pumpButton} />
            <View style={styles.pumpButton} />
            <View style={[styles.pumpButton, styles.pumpButtonBlue]} />
            <View style={styles.pumpButton} />
          </View>

          {/* Nozzle */}
          <LinearGradient
            colors={['#444', '#222']}
            style={styles.pumpNozzle}
          >
            <View style={styles.pumpNozzleTip} />
          </LinearGradient>

          {/* Hose */}
          <View style={styles.pumpHose} />
        </LinearGradient>
      </View>

      {/* Fog */}
      <View style={styles.fog} />
    </View>
  );
}

const styles = StyleSheet.create({
  sceneContainer: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  ground: {
    position: 'absolute',
    width: '120%',
    height: 200,
    bottom: -10,
    left: '-10%',
    backgroundColor: 'rgba(5, 37, 78, 0.3)',
    opacity: 0.5,
  },
  spotLight: {
    position: 'absolute',
    width: 300,
    height: 300,
    top: '50%',
    left: '50%',
    marginLeft: -150,
    marginTop: -150,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 150,
  },
  glowAtm: {
    position: 'absolute',
    width: 200,
    height: 200,
    top: '50%',
    left: '30%',
    marginLeft: -100,
    marginTop: -100,
    backgroundColor: 'rgba(0, 255, 60, 0.1)',
    borderRadius: 100,
  },
  glowGas: {
    position: 'absolute',
    width: 200,
    height: 200,
    top: '50%',
    left: '70%',
    marginLeft: -100,
    marginTop: -100,
    backgroundColor: 'rgba(255, 60, 0, 0.1)',
    borderRadius: 100,
  },
  fog: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    opacity: 0.3,
    pointerEvents: 'none',
  },

  // ATM Styles
  atmUnit: {
    position: 'absolute',
    width: 140,
    height: 240,
    top: '50%',
    left: '30%',
    marginTop: -120,
    marginLeft: -70,
  },
  atmBody: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 20,
  },
  atmTopPanel: {
    width: '100%',
    height: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  atmLogoContainer: {
    alignItems: 'center',
    marginTop: 8,
    position: 'relative',
  },
  atmLogo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffd700',
    letterSpacing: 2,
    textShadowColor: 'rgba(255, 215, 0, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  atmLogoSubtext: {
    fontSize: 6,
    color: '#fff',
    opacity: 0.8,
    letterSpacing: 1,
    marginTop: 2,
  },
  atmLogoDivider: {
    width: 100,
    height: 1,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    marginTop: 4,
  },
  atmScreenRecess: {
    width: 110,
    height: 88,
    marginTop: 6,
    marginLeft: 15,
    backgroundColor: '#1a1f2e',
    borderRadius: 4,
    position: 'relative',
  },
  atmScreenIcons: {
    position: 'absolute',
    right: -18,
    top: 8,
    width: 16,
    height: 72,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  atmScreenIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#065a35',
  },
  atmScreen: {
    width: 104,
    height: 80,
    marginTop: 4,
    marginLeft: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  screenGradient: {
    width: '100%',
    height: '100%',
  },
  screenContent: {
    flex: 1,
    padding: 5,
  },
  screenInterface: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  screenHeaderText: {
    fontSize: 5,
    color: '#ffffff',
  },
  screenWelcome: {
    fontSize: 5,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    opacity: 0.9,
  },
  screenMenuItem: {
    height: 8,
    width: '90%',
    backgroundColor: 'rgba(70, 85, 100, 0.6)',
    borderRadius: 2,
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
  },
  menuItemActive: {
    backgroundColor: 'rgba(80, 150, 100, 0.5)',
  },
  menuItemIndicator: {
    width: 3,
    height: '70%',
    backgroundColor: 'rgba(100, 150, 180, 0.6)',
    borderRadius: 1,
  },
  menuItemIndicatorActive: {
    backgroundColor: 'rgba(100, 200, 120, 0.8)',
  },
  screenStatus: {
    position: 'absolute',
    bottom: 4,
    left: '5%',
    width: '90%',
    height: 8,
    backgroundColor: 'rgba(0, 255, 100, 0.15)',
    borderRadius: 2,
  },
  screenReflection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ skewX: '-20deg' }],
    marginTop: -10,
  },
  screenGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 150, 255, 0.15)',
    opacity: 0.4,
  },
  atmKeypad: {
    width: 110,
    height: 72,
    marginTop: 6,
    marginLeft: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 6,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 4,
  },
  atmKey: {
    width: 30,
    height: 16,
    backgroundColor: '#4a4a4a',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
  },
  keyTextRed: {
    color: '#ff3b30',
  },
  keyTextGreen: {
    color: '#34c759',
  },
  atmSlot: {
    width: 96,
    height: 10,
    marginTop: 4,
    marginLeft: 22,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#000',
  },

  // Gas Station Styles
  gasStation: {
    position: 'absolute',
    width: 176,
    height: 208,
    top: '50%',
    left: '70%',
    marginTop: -104,
    marginLeft: -88,
  },
  gasRoof: {
    position: 'absolute',
    width: 176,
    height: 24,
    top: -24,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  gasRoofHighlight: {
    position: 'absolute',
    width: '100%',
    height: 4,
    top: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
  },
  gasRoofText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 11,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gasLogo: {
    position: 'absolute',
    width: 48,
    height: 48,
    top: -48,
    left: '50%',
    marginLeft: -24,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  gasLogoGradient: {
    position: 'absolute',
    width: '100%',
    height: '50%',
    top: 0,
  },
  gasLogoText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 11,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    zIndex: 1,
  },
  gasCeilingLight: {
    position: 'absolute',
    width: 144,
    height: 8,
    top: -12,
    left: '50%',
    marginLeft: -72,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    shadowColor: 'rgba(255, 255, 150, 0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  gasPillarLeft: {
    position: 'absolute',
    width: 12,
    height: 200,
    left: 8,
    top: -24,
  },
  gasPillarRight: {
    position: 'absolute',
    width: 12,
    height: 200,
    right: 8,
    top: -24,
  },
  gasPump: {
    position: 'absolute',
    width: 56,
    height: 144,
    left: '50%',
    bottom: 0,
    marginLeft: -28,
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 20,
  },
  pumpHeader: {
    width: 32,
    height: 12,
    marginTop: 8,
    marginLeft: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
  },
  pumpDisplay: {
    width: 40,
    height: 32,
    marginTop: 8,
    marginLeft: 8,
    backgroundColor: '#0a0a0a',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pumpDisplayLabel: {
    fontSize: 5,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 2,
  },
  pumpPrice: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ff3b30',
    textShadowColor: 'rgba(255, 59, 48, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  pumpFuelTypes: {
    width: 40,
    marginTop: 8,
    marginLeft: 8,
    gap: 5,
  },
  pumpFuelType: {
    height: 6,
    borderRadius: 1,
  },
  pumpButtons: {
    width: 44,
    height: 24,
    marginTop: 8,
    marginLeft: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 2,
  },
  pumpButton: {
    width: 12,
    height: 9,
    backgroundColor: '#3a3a3a',
    borderRadius: 2,
  },
  pumpButtonGreen: {
    backgroundColor: '#009900',
  },
  pumpButtonBlue: {
    backgroundColor: '#0066cc',
  },
  pumpNozzle: {
    position: 'absolute',
    width: 24,
    height: 16,
    bottom: 24,
    left: -20,
    borderRadius: 4,
    transform: [{ rotate: '-10deg' }],
  },
  pumpNozzleTip: {
    position: 'absolute',
    width: 6,
    height: 10,
    backgroundColor: '#111',
    left: -4,
    top: 3,
    borderRadius: 2,
  },
  pumpHose: {
    position: 'absolute',
    width: 4,
    height: 48,
    bottom: 36,
    left: -12,
    backgroundColor: '#222',
    borderRadius: 2,
  },
});
