import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { AtmStatusType, GasStationStatusType, ContributionType, PoiType } from '../../types/pois';

interface ContributionButtonsProps {
  poiType: PoiType;
  onSelect: (contributionType: ContributionType) => void;
  initialValue?: ContributionType;
}

const ContributionButtons: React.FC<ContributionButtonsProps> = ({
  poiType,
  onSelect,
  initialValue,
}) => {
  const [selected, setSelected] = useState<ContributionType | undefined>(initialValue);

  const handleSelect = (contributionType: ContributionType) => {
    setSelected(contributionType);
    onSelect(contributionType);
  };

  const getButtonStyle = (contributionType: ContributionType) => {
    return [
      styles.button,
      selected === contributionType && styles.selectedButton,
    ];
  };

  const getButtonTextStyle = (contributionType: ContributionType) => {
    return [
      styles.buttonText,
      selected === contributionType && styles.selectedButtonText,
    ];
  };

  const renderAtmButtons = () => {
    const options: AtmStatusType[] = ['money_paper', 'money_only', 'paper_only', 'none'];
    
    return (
      <View>
        <Text style={styles.title}>Select ATM Status</Text>
        <View style={styles.buttonsContainer}>
          {options.map((status) => (
            <TouchableOpacity
              key={status}
              style={getButtonStyle(status)}
              onPress={() => handleSelect(status)}
            >
              <Text style={getButtonTextStyle(status)}>
                {status === 'money_paper' && 'Money & Paper'}
                {status === 'money_only' && 'Money Only'}
                {status === 'paper_only' && 'Paper Only'}
                {status === 'none' && 'Not Working'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderGasStationButtons = () => {
    const options: GasStationStatusType[] = ['gasoline_diesel', 'gasoline_only', 'diesel_only', 'none'];
    
    return (
      <View>
        <Text style={styles.title}>Select Gas Station Status</Text>
        <View style={styles.buttonsContainer}>
          {options.map((status) => (
            <TouchableOpacity
              key={status}
              style={getButtonStyle(status)}
              onPress={() => handleSelect(status)}
            >
              <Text style={getButtonTextStyle(status)}>
                {status === 'gasoline_diesel' && 'Gasoline & Diesel'}
                {status === 'gasoline_only' && 'Gasoline Only'}
                {status === 'diesel_only' && 'Diesel Only'}
                {status === 'none' && 'Not Working'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {poiType === 'atm' ? renderAtmButtons() : renderGasStationButtons()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Layout.padding.medium,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Layout.padding.medium,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Layout.padding.small / 2,
  },
  button: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.medium,
    padding: Layout.padding.medium,
    marginHorizontal: Layout.padding.small / 2,
    marginBottom: Layout.padding.small,
    minWidth: '45%',
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  buttonText: {
    color: Colors.text,
    fontWeight: '500',
  },
  selectedButtonText: {
    color: '#FFFFFF',
  },
});

export default ContributionButtons; 