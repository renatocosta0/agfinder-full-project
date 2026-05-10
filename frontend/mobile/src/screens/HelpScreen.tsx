import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import BottomTabBar from '../components/BottomTabBar';

export default function HelpScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Sobre o projeto</Text>
        <Text style={styles.paragraph}>
          O AGFinder é um projeto criado para ajudar a encontrar ATMs e postos com informações atualizadas pela comunidade.
        </Text>
        <Text style={styles.paragraph}>
          De momento, ele está no ar sem fins lucrativos. Se você quiser apoiar o desenvolvimento e a manutenção, pode fazer uma doação de qualquer valor.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Doação por Transferência Express</Text>
          <Text style={styles.value}>+942905394</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Doação por Transferência Bancária</Text>
          <Text style={styles.label}>IBAN</Text>
          <Text style={styles.value}>0040.0000.4600.9795.1016.9</Text>
        </View>

        <Text style={styles.footer}>
          Obrigado por fazer parte e por ajudar a manter o projeto vivo.
        </Text>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  paragraph: {
    color: '#d4d4d8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginTop: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  label: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  value: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
  },
});
