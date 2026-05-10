import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function GasStationUnit() {
  return (
    <View style={styles.gasUnit}>
      <LinearGradient
        colors={['#4a0505', '#940a0a', '#4a0505']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gasBody}
      >
        {/* Top Panel */}
        <LinearGradient
          colors={['#3e0404', '#5a0606']}
          style={styles.gasTopPanel}
        />

        {/* Logo */}
        <View style={styles.gasLogoContainer}>
          <Text style={styles.gasLogo}>GAS</Text>
          <Text style={styles.gasLogoSubtext}>STATUS</Text>
        </View>

        {/* Screen */}
        <View style={styles.gasScreen}>
          <LinearGradient
            colors={['#0d141e', '#141c2b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.screenGradient}
          >
            <View style={styles.screenContent}>
              <View style={styles.statusWarning}>
                <Text style={styles.statusText}>Última atualização: 3{' \n'}horas atrás</Text>
              </View>
              <View style={styles.actionButtons}>
                <View style={styles.screenButton}>
                  <Text style={styles.buttonText}>Ver detalhes do status</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Buttons */}
        <View style={styles.gasButtons}>
          {[...Array(6)].map((_, index) => (
            <View key={index} style={styles.gasButton} />
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  gasUnit: {
    width: 180,
    height: 300,
    position: 'relative',
  },
  gasBody: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
    elevation: 20,
  },
  gasTopPanel: {
    width: '100%',
    height: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  gasLogoContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  gasLogo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffd700',
    letterSpacing: 2,
    textShadowColor: 'rgba(255, 215, 0, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  gasLogoSubtext: {
    fontSize: 8,
    color: '#fff',
    opacity: 0.8,
    letterSpacing: 1,
    marginTop: 4,
  },
  gasScreen: {
    width: 150,
    height: 120,
    marginTop: 8,
    marginLeft: 15,
    borderRadius: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  screenGradient: {
    width: '100%',
    height: '100%',
    padding: 10,
  },
  screenContent: {
    flex: 1,
  },
  statusWarning: {
    backgroundColor: 'rgba(255, 204, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.5)',
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
  },
  actionButtons: {
    gap: 8,
  },
  screenButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    padding: 6,
  },
  contributeButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderColor: 'rgba(52, 199, 89, 0.5)',
  },
  reportButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  buttonText: {
    fontSize: 9,
    color: '#fff',
    textAlign: 'center',
  },
  gasButtons: {
    width: 140,
    height: 60,
    marginTop: 8,
    marginLeft: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 8,
  },
  gasButton: {
    width: 36,
    height: 22,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
  },
});
