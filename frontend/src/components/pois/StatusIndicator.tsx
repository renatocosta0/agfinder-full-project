import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { AtmStatusType, GasStationStatusType } from '../../types/pois';

interface StatusIndicatorProps {
  status: AtmStatusType | GasStationStatusType;
  poiType: 'atm' | 'gasstation';
  size?: 'small' | 'medium' | 'large';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  poiType, 
  size = 'medium' 
}) => {
  const getStatusColor = () => {
    return Colors[status] || Colors.none;
  };

  const getStatusText = () => {
    if (poiType === 'atm') {
      switch (status) {
        case 'money_paper':
          return 'Money & Paper';
        case 'money_only':
          return 'Money Only';
        case 'paper_only':
          return 'Paper Only';
        case 'none':
          return 'Not Working';
        default:
          return 'Unknown';
      }
    } else if (poiType === 'gasstation') {
      switch (status) {
        case 'gasoline_diesel':
          return 'Gasoline & Diesel';
        case 'gasoline_only':
          return 'Gasoline Only';
        case 'diesel_only':
          return 'Diesel Only';
        case 'none':
          return 'Not Working';
        default:
          return 'Unknown';
      }
    }
    return 'Unknown';
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.small;
      case 'large':
        return styles.large;
      default:
        return styles.medium;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallText;
      case 'large':
        return styles.largeText;
      default:
        return styles.mediumText;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() }, getSizeStyle()]}>
      <Text style={[styles.text, getTextSizeStyle()]}>{getStatusText()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  small: {
    paddingVertical: 2,
  },
  medium: {
    paddingVertical: 4,
  },
  large: {
    paddingVertical: 6,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
  largeText: {
    fontSize: 14,
  },
});

export default StatusIndicator; 