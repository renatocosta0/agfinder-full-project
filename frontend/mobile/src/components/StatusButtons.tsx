import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

export type StatusType = 'both' | 'money' | 'paper' | 'none';

interface Props {
  poiType: 'atms' | 'gasstations';
  onSelect: (status: StatusType) => void;
  containerStyle?: ViewStyle;
}

export default function StatusButtons({ poiType, onSelect, containerStyle }: Props) {
  return (
    <View style={[styles.statusButtons, containerStyle]}> 
      <TouchableOpacity
        style={[styles.statusButton, { backgroundColor: '#34c759' }]}
        onPress={() => onSelect('both')}
      >
        <Text style={styles.statusButtonText}>
          {poiType === 'gasstations' ? '⛽ + 🛢️' : '$ + 📄'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.statusButton, { backgroundColor: '#ffcc00' }]}
        onPress={() => onSelect('money')}
      >
        <Text style={styles.statusButtonText}>
          {poiType === 'gasstations' ? '⛽ only' : '$ only'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.statusButton, { backgroundColor: '#ff9500' }]}
        onPress={() => onSelect('paper')}
      >
        <Text style={styles.statusButtonText}>
          {poiType === 'gasstations' ? '🛢️ only' : '📄 only'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.statusButton, { backgroundColor: '#ff3b30' }]}
        onPress={() => onSelect('none')}
      >
        <Text style={styles.statusButtonText}>None</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
