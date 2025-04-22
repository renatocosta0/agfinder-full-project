import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { PointOfInterest } from '../../types/pois';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import PoiListItem from '../../components/pois/PoiListItem';
import * as poisApi from '../../api/pois';
import { useAuth } from '../../hooks/useAuth';

const HomeScreen = () => {
  const navigation = useNavigation<any>(); // Use 'any' para simplificar a navegação entre diferentes stacks
  const { user } = useAuth();
  const [recentPois, setRecentPois] = useState<PointOfInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentPois();
  }, []);

  const fetchRecentPois = async () => {
    try {
      setIsLoading(true);
      // Simulação de dados enquanto conectamos com a API real
      // const pois = await poisApi.getRecentPois();
      
      // Dados simulados
      setTimeout(() => {
        const mockData: PointOfInterest[] = [
          {
            id: '1',
            poiType: 'atm',
            name: 'Caixa 24h - Centro',
            address: 'Av. Paulista, 1000 - São Paulo',
            location: { latitude: -23.5505, longitude: -46.6333 },
            distance: 500,
            totalInteractions: 25,
          },
          {
            id: '2',
            poiType: 'gasstation',
            name: 'Posto Ipiranga - Jardins',
            address: 'Rua Oscar Freire, 500 - São Paulo',
            location: { latitude: -23.5615, longitude: -46.6695 },
            distance: 1200,
            totalInteractions: 18,
          },
        ];
        
        setRecentPois(mockData);
        setIsLoading(false);
        setError(null);
      }, 1000);
    } catch (error) {
      console.error('Error fetching recent POIs:', error);
      setError('Failed to load recent data');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToPoiTypeSelection = () => {
    // Navegar para a tela de seleção de tipo de POI dentro do navigation stack principal
    navigation.navigate('PoiSelection');
  };

  const navigateToPoiDetail = (poi: PointOfInterest) => {
    navigation.navigate('PoiDetail', { poiId: poi.id });
  };

  const renderPoiItem = ({ item }: { item: PointOfInterest }) => (
    <PoiListItem poi={item} onPress={navigateToPoiDetail} />
  );

  const renderPoiTypeCard = (
    type: 'atm' | 'gasstation', 
    title: string, 
    icon: string, 
    color: string
  ) => (
    <TouchableOpacity
      style={styles.poiTypeCard}
      onPress={() => navigation.navigate('PoiSelection', { 
        screen: 'PoiList', 
        params: { poiType: type } 
      })}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={32} color="#FFFFFF" />
      </View>
      <Text style={styles.poiTypeTitle}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AGFinder</Text>
        {user?.hasActiveSubscription ? (
          <View style={styles.subscriptionBadge}>
            <Text style={styles.subscriptionText}>Premium</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.subscribeButton}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={styles.subscribeText}>Subscribe</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.poiTypesContainer}>
        {renderPoiTypeCard('atm', 'ATMs', 'cash', Colors.primary)}
        {renderPoiTypeCard('gasstation', 'Gas Stations', 'car', Colors.secondary)}
      </View>

      <View style={styles.searchButtonContainer}>
        <Button
          title="Search Points of Interest"
          onPress={navigateToPoiTypeSelection}
        />
      </View>

      <View style={styles.recentContainer}>
        <Text style={styles.sectionTitle}>Recent Updates</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} />
        ) : error ? (
          <Card>
            <Text style={styles.errorText}>{error}</Text>
            <Button
              title="Retry"
              onPress={fetchRecentPois}
              type="secondary"
              style={styles.retryButton}
            />
          </Card>
        ) : recentPois.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No recent updates available</Text>
          </Card>
        ) : (
          <FlatList
            data={recentPois}
            renderItem={renderPoiItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Layout.padding.medium,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Layout.padding.large,
    marginTop: Layout.padding.large,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  subscriptionBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Layout.padding.medium,
    paddingVertical: Layout.padding.xs,
    borderRadius: Layout.borderRadius.medium,
  },
  subscriptionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subscribeButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Layout.borderRadius.medium,
    paddingHorizontal: Layout.padding.medium,
    paddingVertical: Layout.padding.xs,
  },
  subscribeText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  poiTypesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Layout.padding.large,
  },
  poiTypeCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: Layout.borderRadius.medium,
    padding: Layout.padding.medium,
    alignItems: 'center',
    ...Layout.shadow.small,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Layout.padding.small,
  },
  poiTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  searchButtonContainer: {
    marginBottom: Layout.padding.large,
  },
  recentContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Layout.padding.medium,
  },
  listContent: {
    paddingBottom: Layout.padding.large,
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

export default HomeScreen; 