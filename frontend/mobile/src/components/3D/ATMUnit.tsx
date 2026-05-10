import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ATMUnit() {
  return (
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
          <Text style={styles.atmLogoSubtext}>STATUS</Text>
        </View>

        {/* Screen */}
        <View style={styles.atmScreen}>
          <LinearGradient
            colors={['#0d141e', '#141c2b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.screenGradient}
          >
            <View style={styles.screenContent}>
              <View style={styles.statusWarning}>
                <Text style={styles.statusText}>Última atualização: 2{'\n'}horas atrás</Text>
              </View>
              <View style={styles.actionButtons}>
                <View style={styles.screenButton}>
                  <Text style={styles.buttonText}>Ver detalhes do status</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Keypad */}
        <View style={styles.atmKeypad}>
          {[...Array(6)].map((_, index) => (
            <View key={index} style={styles.atmKey} />
          ))}
        </View>

        {/* Card Slot */}
        <LinearGradient
          colors={['#111', '#222']}
          style={styles.atmSlot}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  atmUnit: {
    width: 180,
    height: 300,
    position: 'relative',
  },
  atmBody: {
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
  atmTopPanel: {
    width: '100%',
    height: 12,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  atmLogoContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  atmLogo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffd700',
    letterSpacing: 2,
    textShadowColor: 'rgba(255, 215, 0, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  atmLogoSubtext: {
    fontSize: 8,
    color: '#fff',
    opacity: 0.8,
    letterSpacing: 1,
    marginTop: 4,
  },
  atmScreen: {
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
  atmKeypad: {
    width: 140,
    height: 60,
    marginTop: 8,
    marginLeft: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 8,
  },
  atmKey: {
    width: 36,
    height: 22,
    backgroundColor: '#3a3a3a',
    borderRadius: 4,
  },
  atmSlot: {
    width: 120,
    height: 12,
    marginTop: 8,
    marginLeft: 30,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
});
