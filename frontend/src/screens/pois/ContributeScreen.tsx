import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { ContributeScreenRouteProp } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const ContributeScreen = () => {
  const route = useRoute<ContributeScreenRouteProp>();
  const { poiId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Contribuir para POI {poiId}</Text>
      <Text style={styles.subtext}>Será implementado em breve</Text>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.padding.small,
  },
  subtext: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

export default ContributeScreen; 