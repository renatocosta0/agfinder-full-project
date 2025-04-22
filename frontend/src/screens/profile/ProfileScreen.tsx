import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const ProfileScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Perfil será implementado em breve</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

export default ProfileScreen; 