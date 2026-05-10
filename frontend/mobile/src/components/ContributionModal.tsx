import React, { useEffect, useState } from 'react';
import { Modal, View, Image, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { postContribution } from '../services/pois';
import { useAuth } from '../contexts/AuthContext';

export type StatusType = 'both' | 'money' | 'paper' | 'none';

interface Props {
  visible: boolean;
  poiId: string;
  poiType: 'atms' | 'gasstations';
  initialStatus?: StatusType | null;
  onClose: () => void;
  onAfterSubmit?: (args: { selectedStatus: StatusType; nowIso: string }) => void;
}

export default function ContributionModal({ visible, poiId, poiType, initialStatus = null, onClose, onAfterSubmit }: Props) {
  const { token } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(initialStatus ?? null);

  useEffect(() => {
    setSelectedStatus(initialStatus ?? null);
  }, [initialStatus, visible]);

  const getStatusIcon = (status: StatusType) => {
    if (poiType === 'gasstations') {
      switch (status) {
        case 'both': return require('../../assets/images/gasdiesel.png');
        case 'money': return require('../../assets/images/gas.png');
        case 'paper': return require('../../assets/images/diesel.png');
        case 'none': return require('../../assets/images/nogasdiesel.png');
      }
    }
    switch (status) {
      case 'both': return require('../../assets/images/moneypaper.png');
      case 'money': return require('../../assets/images/nopaper (1).png');
      case 'paper': return require('../../assets/images/nomoney (1).png');
      case 'none': return require('../../assets/images/nomoneypaper.png');
    }
  };

  const getStatusText = (status: StatusType) => {
    if (poiType === 'gasstations') {
      switch (status) {
        case 'both': return 'Gas and diesel available';
        case 'money': return 'Gas available, no diesel';
        case 'paper': return 'Diesel available, no gas';
        case 'none': return 'No gas or diesel available';
      }
    }
    switch (status) {
      case 'both': return 'Money and paper available';
      case 'money': return 'Money available, no paper';
      case 'paper': return 'Paper available, no money';
      case 'none': return 'No money or paper available';
    }
  };

  const confirm = async () => {
    if (!token) {
      Alert.alert('Login required', 'You must be logged in to contribute.');
      return;
    }
    if (!selectedStatus) {
      onClose();
      return;
    }
    try {
      const types: { t: string; d?: Record<string, any> }[] = [];
      if (poiType === 'atms') {
        if (selectedStatus === 'both') types.push({ t: 'money_paper' });
        else if (selectedStatus === 'money') types.push({ t: 'money_only' });
        else if (selectedStatus === 'paper') types.push({ t: 'paper_only' });
        else types.push({ t: 'none' });
      } else {
        if (selectedStatus === 'both') types.push({ t: 'gasoline_diesel' });
        else if (selectedStatus === 'money') types.push({ t: 'gasoline_only' });
        else if (selectedStatus === 'paper') types.push({ t: 'diesel_only' });
        else types.push({ t: 'none' });
      }
      for (const entry of types) {
        await postContribution(poiId, { contribution_type: entry.t, details: entry.d });
      }
      const nowIso = new Date().toISOString();
      if (onAfterSubmit && selectedStatus) onAfterSubmit({ selectedStatus, nowIso });
      Alert.alert('Thank you!', 'Your contribution was submitted.');
    } catch (e) {
      Alert.alert('Error', 'Failed to submit contribution. Please try again.');
    } finally {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalImageContainer}>
            {selectedStatus && (
              <Image source={getStatusIcon(selectedStatus)} style={styles.modalHeaderImage} resizeMode="cover" />
            )}
          </View>
          <View style={styles.modalTextContainer}>
            <Text style={styles.modalTitle}>{selectedStatus ? getStatusText(selectedStatus) : ''}</Text>
            <Text style={styles.modalDescription}>
              Are you sure you want to contribute with this info? This action cannot be undone.
            </Text>
          </View>
          <View style={styles.modalButtonsContainer}>
            <TouchableOpacity style={styles.confirmButton} onPress={confirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  modalImageContainer: {
    width: '100%',
    height: 200,
    overflow: 'hidden',
  },
  modalHeaderImage: {
    width: '100%',
    height: '100%',
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
