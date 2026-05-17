import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { checkSubscriptionStatus, simulateSubscription, SubscriptionStatus } from '../services/subscriptions';

type PaymentDetailsRouteProp = RouteProp<RootStackParamList, 'PaymentDetails'>;
type PaymentDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PaymentDetails'>;

export default function PaymentDetailsScreen() {
  const navigation = useNavigation<PaymentDetailsNavigationProp>();
  const route = useRoute<PaymentDetailsRouteProp>();
  const { subscriptionType, subscriptionValue, reference, entity, steps, expiresAt: expiresAtParam, durationDays } = route.params;

  const initialSeconds = (() => {
    if (expiresAtParam) {
      const diff = Math.max(0, Math.floor((new Date(expiresAtParam).getTime() - Date.now()) / 1000));
      return diff;
    }
    return 0;
  })();
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [status, setStatus] = useState<SubscriptionStatus>('pending');
  const [expiresAt, setExpiresAt] = useState<string | null>(expiresAtParam ?? null);
  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const pollDelayRef = useRef<number>(5000);
  const [showNetworkError, setShowNetworkError] = useState(false);

  const handleSimulate = useCallback(async (action: 'complete' | 'fail') => {
    try {
      if (!reference) return;
      await simulateSubscription(reference, action);
      // Refresh immediately for faster feedback
      const tx = await checkSubscriptionStatus(reference);
      setStatus(tx.status as SubscriptionStatus);
      if (tx.expires_at) setExpiresAt(tx.expires_at);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao simular o pagamento.');
    }
  }, [reference]);

  useEffect(() => {
    // immediate compute to avoid initial flash
    const compute = () => {
      if (expiresAt) {
        const diffSec = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
        setTimeLeft(diffSec);
        if (diffSec === 0) {
          setStatus('expired');
          if (pollerRef.current) {
            clearTimeout(pollerRef.current);
            pollerRef.current = null;
          }
        }
      } else {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        if (timeLeft <= 1) {
          setStatus('expired');
          if (pollerRef.current) {
            clearTimeout(pollerRef.current);
            pollerRef.current = null;
          }
        }
      }
    };
    compute();
    const timer = setInterval(compute, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, timeLeft]);

  const handleNetworkError = useCallback(() => {
    if (showNetworkError) return; // Prevent multiple alerts
    setShowNetworkError(true);
    Alert.alert(
      'Erro de conexão',
      'Não foi possível verificar o status do pagamento. Verifique sua conexão e tente novamente.',
      [{ text: 'OK', onPress: () => setShowNetworkError(false) }]
    );
  }, [showNetworkError]);

  useEffect(() => {
    if (!reference) return;
    const scheduleNext = () => {
      if (pollerRef.current) clearTimeout(pollerRef.current);
      pollerRef.current = setTimeout(poll, pollDelayRef.current);
    };
    const poll = async () => {
      // Stop polling if expired by time
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        setStatus('expired');
        if (pollerRef.current) {
          clearTimeout(pollerRef.current);
          pollerRef.current = null;
        }
        return;
      }
      try {
        const tx = await checkSubscriptionStatus(reference);
        setStatus((tx.status as SubscriptionStatus) || 'pending');
        if (tx.expires_at) setExpiresAt(tx.expires_at);
        if (tx.status && tx.status !== 'pending') {
          if (pollerRef.current) {
            clearTimeout(pollerRef.current);
            pollerRef.current = null;
          }
          return;
        }
        pollDelayRef.current = 5000;
        scheduleNext();
      } catch (e: any) {
        if (e && e.response && e.response.status === 429) {
          pollDelayRef.current = 60000;
          scheduleNext();
          return;
        }
        handleNetworkError();
        pollDelayRef.current = 15000;
        scheduleNext();
      }
    };
    poll();
    return () => {
      if (pollerRef.current) clearTimeout(pollerRef.current);
      pollerRef.current = null;
    };
  }, [reference, handleNetworkError]);

  useEffect(() => {
    if (status === 'completed') {
      const t = setTimeout(() => {
        navigation.navigate('Subscription');
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [status, navigation]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs >= 1) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.title}>Detalhes do Pagamento</Text>
      <View style={[
        styles.statusBadge,
        status === 'completed' ? styles.statusCompleted :
          status === 'failed' ? styles.statusFailed :
            status === 'expired' ? styles.statusExpired : styles.statusPending,
      ]}>
        <Text style={styles.statusText}>
          {status === 'completed' ? 'Concluído' : status === 'failed' ? 'Falhou' : status === 'expired' ? 'Expirado' : 'Pendente'}
        </Text>
      </View>

      {/* Payment Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Valor</Text>
          <Text style={styles.infoValue}>{subscriptionValue}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo de Subscrição</Text>
          <Text style={styles.infoValue}>{subscriptionType}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Entidade</Text>
          <Text style={styles.infoValue}>{entity ?? '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Referência</Text>
          <Text style={styles.infoValue}>{reference ?? '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Expira em</Text>
          <Text style={[styles.infoValue, styles.expiresValue]}>{formatTime(timeLeft)}</Text>
        </View>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instruções de Pagamento</Text>
        {(
          (steps && steps.length > 0)
            ? steps
            : [
              'Vá ao app do seu banco ou internet banking',
              'Selecione "Pagamentos" ou "Transferências"',
              'Escolha "Pagamento por referência"',
              `Digite a entidade: ${entity ?? '—'}`,
              `Digite a referência: ${reference ?? '—'}`,
              `Digite o valor: ${subscriptionValue}`,
              'Confirme o pagamento',
              'Aguarde a confirmação (pode levar alguns minutos)',
            ]
        ).map((s, i) => (
          <Text key={i} style={styles.instructionStep}>{`${i + 1}. ${s}`}</Text>
        ))}
      </View>

      {__DEV__ && (
        <View style={styles.devToolsContainer}>
          <Text style={styles.devToolsTitle}>DEV Tools</Text>
          <View style={styles.devButtonsRow}>
            <TouchableOpacity
              style={[styles.devButton, styles.devSuccessButton]}
              onPress={() => handleSimulate('complete')}
            >
              <Text style={styles.devButtonText}>Sucesso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.devButton, styles.devFailButton]}
              onPress={() => handleSimulate('fail')}
            >
              <Text style={styles.devButtonText}>Falha</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* View Subscription Button (when completed) */}
      {status === 'completed' && (
        <TouchableOpacity
          style={styles.viewSubscriptionButton}
          onPress={() => navigation.navigate('Subscription')}
        >
          <Text style={styles.viewSubscriptionText}>Ver Subscrição</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backIcon: {
    color: '#fff',
    fontSize: 28,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#3b82f6',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPending: { backgroundColor: '#a3a3a3' },
  statusCompleted: { backgroundColor: '#34c759' },
  statusFailed: { backgroundColor: '#ff3b30' },
  statusExpired: { backgroundColor: '#f59e0b' },
  viewSubscriptionButton: {
    backgroundColor: '#3b82f6',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  viewSubscriptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1c1c1e',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#2c2c2e',
  },
  infoLabel: {
    color: '#999',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  expiresValue: {
    color: '#ff3b30',
  },
  instructionsContainer: {
    paddingHorizontal: 16,
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  instructionStep: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  devToolsContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  devToolsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  devButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  devButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devSuccessButton: {
    backgroundColor: '#34c759',
  },
  devFailButton: {
    backgroundColor: '#ff3b30',
  },
  devButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
