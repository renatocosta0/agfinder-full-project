import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { PoiListScreenRouteProp, PoiDetailScreenNavigationProp } from '../../types/navigation';
import { PointOfInterest } from '../../types/pois';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import PoiListItem from '../../components/pois/PoiListItem';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import * as poisApi from '../../api/pois';

const PoiListScreen = () => {
  const route = useRoute<PoiListScreenRouteProp>();
  const navigation = useNavigation<PoiDetailScreenNavigationProp>();
  const { poiType } = route.params;
  
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPois();
  }, []);

  const fetchPois = async () => {
    try {
      setIsLoading(true);
      // Simulação de dados enquanto conectamos com a API real
      // const data = await poisApi.getPoisByType(poiType);
      
      // Dados simulados
      setTimeout(() => {
        const mockData: PointOfInterest[] = [
          {
            id: '1',
            poiType: poiType,
            name: `${poiType === 'atm' ? 'Caixa 24h' : 'Posto Shell'} - Centro`,
            address: 'Av. Paulista, 1000 - São Paulo',
            location: { latitude: -23.5505, longitude: -46.6333 },
            distance: 500,
            totalInteractions: 25,
          },
          {
            id: '2',
            poiType: poiType,
            name: `${poiType === 'atm' ? 'Banco Itaú' : 'Posto Ipiranga'} - Jardins`,
            address: 'Rua Oscar Freire, 500 - São Paulo',
            location: { latitude: -23.5615, longitude: -46.6695 },
            distance: 1200,
            totalInteractions: 18,
          },
          {
            id: '3',
            poiType: poiType,
            name: `${poiType === 'atm' ? 'Banco do Brasil' : 'Posto BR'} - Pinheiros`,
            address: 'Rua dos Pinheiros, 300 - São Paulo',
            location: { latitude: -23.5664, longitude: -46.6907 },
            distance: 2300,
            totalInteractions: 42,
          },
        ];
        
        setPois(mockData);
        setIsLoading(false);
        setError(null);
      }, 1000);
    } catch (error) {
      console.error('Error fetching POIs:', error);
      setError('Falha ao carregar locais. Tente novamente.');
      setIsLoading(false);
    }
  };

  const handlePoiPress = (poi: PointOfInterest) => {
    navigation.navigate('PoiDetail', { poiId: poi.id });
  };

  const renderItem = ({ item }: { item: PointOfInterest }) => (
    <PoiListItem poi={item} onPress={handlePoiPress} />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {poiType === 'atm' ? 'Caixas Eletrônicos' : 'Postos de Gasolina'} Próximos
      </Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Carregando locais próximos...</Text>
        </View>
      ) : error ? (
        <Card>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Tentar Novamente"
            onPress={fetchPois}
            type="secondary"
            style={styles.retryButton}
          />
        </Card>
      ) : pois.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            Nenhum {poiType === 'atm' ? 'caixa eletrônico' : 'posto de gasolina'} encontrado nas proximidades.
          </Text>
        </Card>
      ) : (
        <FlatList
          data={pois}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Layout.padding.medium,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.padding.medium,
  },
  listContent: {
    paddingBottom: Layout.padding.large,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Layout.padding.medium,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Layout.padding.small,
  },
  retryButton: {
    marginTop: Layout.padding.small,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
  },
});

export default PoiListScreen; 