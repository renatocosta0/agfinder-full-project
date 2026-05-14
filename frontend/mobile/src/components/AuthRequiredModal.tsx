import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';

type AuthRequiredNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Pois'>;

interface AuthRequiredModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AuthRequiredModal({ visible, onClose }: AuthRequiredModalProps) {
  const navigation = useNavigation<AuthRequiredNavigationProp>();

  const handleSignIn = () => {
    onClose();
    navigation.navigate('Login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalTextContainer}>
            <Text style={styles.modalTitle}>Sign In Required</Text>
            <Text style={styles.modalDescription}>
              You need to sign in to view POI details and contribute information.
            </Text>
          </View>
          <View style={styles.modalButtonsContainer}>
            <TouchableOpacity style={styles.confirmButton} onPress={handleSignIn}>
              <Text style={styles.confirmButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#000',
    borderRadius: 24,
    width: '90%',
    maxWidth: 320,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#000',
  },
  modalTextContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  modalButtonsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  confirmButton: {
    backgroundColor: '#5856d6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
});
