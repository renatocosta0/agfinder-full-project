import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PaymentMethodModal from '../components/PaymentMethodModal';
import { RootStackParamList } from '../navigation/RootNavigator';
import { createSubscription, getSubscriptionPlans, SubscriptionPlan } from '../services/subscriptions';

type PaymentNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Payment'>;

export default function PaymentScreen() {
  const navigation = useNavigation<PaymentNavigationProp>();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [selectedPlanType, setSelectedPlanType] = useState<'' | 'daily' | 'weekly' | 'monthly'>('');
  const [selectedSubscription, setSelectedSubscription] = useState({ type: '', value: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    hasActive: boolean;
    daysRemaining: number;
    type: string;
  }>({ hasActive: false, daysRemaining: 0, type: 'none' });

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        console.log('Fetching subscription plans...');
        const data = await getSubscriptionPlans();
        console.log('Plans data received:', JSON.stringify(data));
        setPlans(data.plans);

        // Update subscription info
        if (data.current_subscription && data.has_active_subscription) {
          const endDate = new Date(data.current_subscription.end_date);
          const now = new Date();
          const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`Active subscription found: ${diffDays} days remaining`);

          setSubscriptionInfo({
            hasActive: data.has_active_subscription,
            daysRemaining: Math.max(0, diffDays),
            type: data.current_subscription.type
          });
        } else {
          console.log('No active subscription found');
          setSubscriptionInfo({
            hasActive: false,
            daysRemaining: 0,
            type: 'none'
          });
        }
      } catch (error) {
        console.error('Failed to load plans:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const plansByType = useMemo(() => {
    const map: Record<string, SubscriptionPlan> = {};
    (plans || []).forEach((p) => { map[p.type] = p; });
    return map as Record<'daily' | 'weekly' | 'monthly', SubscriptionPlan>;
  }, [plans]);

  const handleSubscriptionSelect = (planType: 'daily' | 'weekly' | 'monthly') => {
    setSelectedPlanType(planType);
    const plan = plansByType?.[planType];
    const displayType = planType === 'daily' ? 'Diária' : planType === 'weekly' ? 'Semanal' : 'Mensal';
    const displayValue = plan ? `AOA ${plan.price}` : '';
    setSelectedSubscription({ type: displayType, value: displayValue });
    setShowPaymentModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Subscription Limit Banner */}
      <View style={styles.limitBanner}>
        <View style={styles.lockIcon}>
          <Text style={styles.lockEmoji}>🔒</Text>
        </View>
        <View style={styles.limitTextContainer}>
          <Text style={styles.limitTitle}>Limite de subscrição</Text>
          <Text style={styles.limitSubtitle}>
            {isLoading ? 'Carregando...' :
              subscriptionInfo.hasActive ? 'Subscrição ativa' : 'Sem subscrição ativa'}
          </Text>
        </View>
        <Text style={styles.daysText}>
          {isLoading ? '...' : '1 dia'}
        </Text>
      </View>

      {/* Subscription Card */}
      <TouchableOpacity
        style={styles.subscriptionCard}
        onPress={() => navigation.navigate('Subscription')}
        disabled={isLoading}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>Subscrição</Text>
            <Text style={styles.cardSubtitle}>Serviço</Text>
            <Text style={styles.cardService}>ATMFinder</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.cardDays}>
              {subscriptionInfo.hasActive ?
                `${subscriptionInfo.daysRemaining} dia${subscriptionInfo.daysRemaining !== 1 ? 's' : ''}` :
                '0 dias'}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Subscription Options */}
      <View style={styles.optionsContainer}>
        <View style={styles.optionsTitleRow}>
          <Text style={styles.optionsTitle}>Opções de Subscrição</Text>
          {isLoading && <ActivityIndicator size="small" color="#fff" style={styles.optionsSpinner} />}
        </View>

        {/* Daily Option */}
        <TouchableOpacity
          style={[styles.optionCard, isLoading && styles.optionCardDisabled]}
          onPress={() => handleSubscriptionSelect('daily')}
          disabled={isLoading || !plansByType?.daily}
        >
          <View style={styles.optionLeft}>
            <Text style={styles.optionTitle}>Diária</Text>
            <Text style={styles.optionDuration}>{plansByType?.daily ? `${plansByType.daily.duration_days * 24} horas` : '24 horas'}</Text>
          </View>
          <Text style={styles.optionPrice}>{plansByType?.daily ? `AOA ${plansByType.daily.price}` : 'AOA 50'}</Text>
        </TouchableOpacity>

        {/* Weekly Option */}
        <TouchableOpacity
          style={[styles.optionCard, styles.optionCardHighlight, isLoading && styles.optionCardDisabled]}
          onPress={() => handleSubscriptionSelect('weekly')}
          disabled={isLoading || !plansByType?.weekly}
        >
          <View style={styles.optionLeft}>
            <Text style={styles.optionTitle}>Semanal</Text>
            <Text style={styles.optionDuration}>{plansByType?.weekly ? `${plansByType.weekly.duration_days} dias` : '7 dias'}</Text>
          </View>
          <View style={styles.optionRight}>
            <Text style={styles.optionPrice}>{plansByType?.weekly ? `AOA ${plansByType.weekly.price}` : 'AOA 300'}</Text>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>Economia de 14%</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Monthly Option */}
        <TouchableOpacity
          style={[styles.optionCard, styles.optionCardHighlight, isLoading && styles.optionCardDisabled]}
          onPress={() => handleSubscriptionSelect('monthly')}
          disabled={isLoading || !plansByType?.monthly}
        >
          <View style={styles.optionLeft}>
            <Text style={styles.optionTitle}>Mensal</Text>
            <Text style={styles.optionDuration}>{plansByType?.monthly ? `${plansByType.monthly.duration_days} dias` : '30 dias'}</Text>
          </View>
          <View style={styles.optionRight}>
            <Text style={styles.optionPrice}>{plansByType?.monthly ? `AOA ${plansByType.monthly.price}` : 'AOA 1.200'}</Text>
            <View style={[styles.savingsBadge, styles.savingsBadgeHighlight]}>
              <Text style={styles.savingsText}>Economia de 20%</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        subscriptionType={selectedSubscription.type}
        subscriptionValue={selectedSubscription.value}
        onContinue={async () => {
          try {
            const data = await createSubscription({ subscription_type: selectedPlanType as 'daily' | 'weekly' | 'monthly' });
            setShowPaymentModal(false);
            navigation.navigate('PaymentDetails', {
              subscriptionType: selectedPlanType as 'daily' | 'weekly' | 'monthly',
              subscriptionValue: `AOA ${data.subscription_transaction.amount}`,
              reference: data.subscription_transaction.reference,
              entity: data.payment_instructions.entity,
              steps: data.payment_instructions.steps,
              expiresAt: data.subscription_transaction.expires_at,
              durationDays: plansByType?.[selectedPlanType as 'daily' | 'weekly' | 'monthly']?.duration_days ?? (selectedPlanType === 'weekly' ? 7 : selectedPlanType === 'monthly' ? 30 : 1),
            });
          } catch (e) {
            setShowPaymentModal(false);
          }
        }}
      />
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
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lockEmoji: {
    fontSize: 20,
  },
  limitTextContainer: {
    flex: 1,
  },
  limitTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  limitSubtitle: {
    color: '#999',
    fontSize: 13,
  },
  daysText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionCard: {
    backgroundColor: '#1c1c1e',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 20,
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#999',
    fontSize: 13,
    marginBottom: 4,
  },
  cardService: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cardDays: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  optionsContainer: {
    paddingHorizontal: 16,
  },
  optionsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  optionsSpinner: {
    marginLeft: 8,
  },
  optionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionCardHighlight: {
    borderWidth: 1,
    borderColor: '#34c759',
  },
  optionCardDisabled: {
    opacity: 0.5,
  },
  optionLeft: {
    flex: 1,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDuration: {
    color: '#999',
    fontSize: 13,
  },
  optionRight: {
    alignItems: 'flex-end',
  },
  optionPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  savingsBadge: {
    backgroundColor: '#34c759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  savingsBadgeHighlight: {
    backgroundColor: '#34c759',
  },
  savingsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
