import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface PaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  subscriptionType: string;
  subscriptionValue: string;
  onContinue: () => void;
}

export default function PaymentMethodModal({
  visible,
  onClose,
  subscriptionType,
  subscriptionValue,
  onContinue,
}: PaymentMethodModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedMethod(null);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          {/* Modal Title */}
          <Text style={styles.modalTitle}>Método de Pagamento</Text>

          {/* Summary Section */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Resumo</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subscrição</Text>
              <Text style={styles.summaryValue}>{subscriptionType}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Valor</Text>
              <Text style={styles.summaryValue}>{subscriptionValue}</Text>
            </View>
          </View>

          {/* Payment Method Selection */}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Selecione o método de pagamento</Text>

            <TouchableOpacity
              style={[
                styles.paymentOption,
                selectedMethod === 'proxypay' && styles.paymentOptionSelected,
              ]}
              onPress={() => setSelectedMethod(selectedMethod === 'proxypay' ? null : 'proxypay')}
            >
              <View style={styles.paymentLeft}>
                <Text style={styles.paymentName}>Referência Multicaixa</Text>
                <Text style={styles.paymentFee}>Taxa: 0+1%</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              selectedMethod && styles.actionButtonActive,
            ]}
            onPress={selectedMethod ? onContinue : onClose}
          >
            <Text style={styles.actionButtonText}>
              {selectedMethod ? 'Continuar' : 'Cancelar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#2c2c2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#999',
    fontSize: 14,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3a3a3c',
    padding: 16,
    borderRadius: 12,
  },
  paymentOptionSelected: {
    backgroundColor: '#1c5aa8',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  paymentLeft: {
    flex: 1,
  },
  paymentName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentFee: {
    color: '#999',
    fontSize: 13,
  },
  chevron: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  actionButton: {
    backgroundColor: '#3a3a3c',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
