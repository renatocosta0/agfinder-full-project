import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PoiTypeSelectionScreenNavigationProp } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { PoiType } from '../../types/pois';

const PoiTypeSelectionScreen = () => {
  const navigation = useNavigation<PoiTypeSelectionScreenNavigationProp>();

  const handleSelectType = (type: PoiType) => {
    navigation.navigate('PoiList', { poiType: type });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Selecione o tipo de local</Text>
      <Text style={styles.subtitle}>O que você está procurando?</Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity 
          style={styles.option}
          onPress={() => handleSelectType('atm')}
        >
          <View style={[styles.iconContainer, { backgroundColor: Colors.primary }]}>
            <Text style={styles.icon}>💰</Text>
          </View>
          <Text style={styles.optionTitle}>Caixas Eletrônicos (ATMs)</Text>
          <Text style={styles.optionDescription}>
            Encontre ATMs próximos e verifique se têm dinheiro e papel disponíveis
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.option}
          onPress={() => handleSelectType('gasstation')}
        >
          <View style={[styles.iconContainer, { backgroundColor: Colors.secondary }]}>
            <Text style={styles.icon}>⛽</Text>
          </View>
          <Text style={styles.optionTitle}>Postos de Gasolina</Text>
          <Text style={styles.optionDescription}>
            Localize postos próximos e veja se têm gasolina e diesel disponíveis
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Layout.padding.large,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.padding.small,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: Layout.padding.xl,
  },
  optionsContainer: {
    flex: 1,
  },
  option: {
    backgroundColor: Colors.card,
    borderRadius: Layout.borderRadius.medium,
    padding: Layout.padding.large,
    marginBottom: Layout.padding.large,
    ...Layout.shadow.medium,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Layout.padding.medium,
  },
  icon: {
    fontSize: 32,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.padding.small,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});

export default PoiTypeSelectionScreen; 