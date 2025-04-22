import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PointOfInterest, ContributionType } from '../../types/pois';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import StatusIndicator from './StatusIndicator';
import Card from '../common/Card';

interface PoiListItemProps {
  poi: PointOfInterest;
  onPress: (poi: PointOfInterest) => void;
}

const PoiListItem: React.FC<PoiListItemProps> = ({ poi, onPress }) => {
  const formatDistance = (distance?: number) => {
    if (!distance) return 'Unknown';
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const getStatus = (): ContributionType => {
    if (poi.lastContribution && !poi.lastContribution.isExpired) {
      return poi.lastContribution.contributionType;
    }
    return 'none';
  };

  const getTimestamp = () => {
    if (!poi.lastContribution) return 'No data';
    
    const date = new Date(poi.lastContribution.createdAt);
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity onPress={() => onPress(poi)}>
      <Card>
        <View style={styles.container}>
          <View style={styles.mainContent}>
            <Text style={styles.name}>{poi.name}</Text>
            <Text style={styles.address}>{poi.address}</Text>
            <View style={styles.detailsRow}>
              <StatusIndicator 
                status={getStatus()} 
                poiType={poi.poiType} 
                size="small" 
              />
              <Text style={styles.timestamp}>Updated: {getTimestamp()}</Text>
            </View>
          </View>
          <View style={styles.rightContent}>
            <Text style={styles.distance}>{formatDistance(poi.distance)}</Text>
            {poi.totalInteractions ? (
              <Text style={styles.interactions}>{poi.totalInteractions} interactions</Text>
            ) : null}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  distance: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
    marginBottom: 4,
  },
  interactions: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});

export default PoiListItem; 