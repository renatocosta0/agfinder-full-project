import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function Particles() {
  const particlePositions = [
    { top: '30%' as const, left: '25%' as const },
    { top: '40%' as const, left: '45%' as const },
    { top: '60%' as const, left: '35%' as const },
    { top: '20%' as const, left: '65%' as const },
    { top: '70%' as const, left: '55%' as const },
    { top: '50%' as const, left: '75%' as const },
    { top: '80%' as const, left: '25%' as const },
    { top: '35%' as const, left: '85%' as const },
    { top: '15%' as const, left: '40%' as const },
    { top: '25%' as const, left: '15%' as const },
    { top: '55%' as const, left: '20%' as const },
    { top: '75%' as const, left: '60%' as const },
    { top: '85%' as const, left: '80%' as const },
    { top: '10%' as const, left: '50%' as const },
    { top: '45%' as const, left: '90%' as const },
  ];

  return (
    <View style={styles.particles} pointerEvents="none">
      {particlePositions.map((position, index) => (
        <View
          key={index}
          style={[
            styles.particle,
            {
              top: position.top,
              left: position.left,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particles: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    width: 2,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
    opacity: 0.3,
  },
});
