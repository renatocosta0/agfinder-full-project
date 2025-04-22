import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import Button from '../common/Button';

interface ValidationButtonsProps {
  onValidate: () => void;
  onReport: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const ValidationButtons: React.FC<ValidationButtonsProps> = ({
  onValidate,
  onReport,
  isLoading = false,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.button}>
        <Button
          title="Valid"
          type="success"
          onPress={onValidate}
          disabled={disabled}
          loading={isLoading}
        />
      </View>
      <View style={styles.button}>
        <Button
          title="Report"
          type="danger"
          onPress={onReport}
          disabled={disabled}
          loading={isLoading}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Layout.padding.medium,
  },
  button: {
    flex: 1,
    marginHorizontal: Layout.padding.small / 2,
  },
});

export default ValidationButtons; 