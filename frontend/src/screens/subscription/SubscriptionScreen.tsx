import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import Button from '../../components/common/Button';

const SubscriptionScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assinatura Premium</Text>
      <Text style={styles.description}>
        Obtenha acesso a recursos exclusivos e remova anúncios com a assinatura premium.
      </Text>
      
      <View style={styles.planContainer}>
        <View style={styles.plan}>
          <Text style={styles.planTitle}>Plano Mensal</Text>
          <Text style={styles.planPrice}>R$9,90/mês</Text>
          <Text style={styles.planFeature}>• Sem anúncios</Text>
          <Text style={styles.planFeature}>• Contribuições ilimitadas</Text>
          <Text style={styles.planFeature}>• Suporte prioritário</Text>
          <Button 
            title="Assinar Plano Mensal" 
            onPress={() => {}} 
            style={styles.button}
          />
        </View>
        
        <View style={[styles.plan, styles.highlightedPlan]}>
          <Text style={styles.planTitle}>Plano Anual</Text>
          <Text style={styles.planPrice}>R$89,90/ano</Text>
          <Text style={styles.savings}>Economize 25%</Text>
          <Text style={styles.planFeature}>• Sem anúncios</Text>
          <Text style={styles.planFeature}>• Contribuições ilimitadas</Text>
          <Text style={styles.planFeature}>• Suporte prioritário</Text>
          <Text style={styles.planFeature}>• Bônus mensais</Text>
          <Button 
            title="Assinar Plano Anual" 
            onPress={() => {}} 
            style={styles.button}
            type="secondary"
          />
        </View>
      </View>
      
      <Text style={styles.note}>
        Pagamentos serão processados via ProxyPay. Você pode cancelar sua assinatura a qualquer momento.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Layout.padding.large,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Layout.padding.small,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Layout.padding.large,
  },
  planContainer: {
    marginVertical: Layout.padding.large,
  },
  plan: {
    backgroundColor: Colors.card,
    borderRadius: Layout.borderRadius.medium,
    padding: Layout.padding.large,
    marginBottom: Layout.padding.large,
    ...Layout.shadow.medium,
  },
  highlightedPlan: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Layout.padding.small,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Layout.padding.small,
  },
  savings: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.success,
    marginBottom: Layout.padding.medium,
  },
  planFeature: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: Layout.padding.small,
  },
  button: {
    marginTop: Layout.padding.medium,
  },
  note: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Layout.padding.large,
  },
});

export default SubscriptionScreen; 