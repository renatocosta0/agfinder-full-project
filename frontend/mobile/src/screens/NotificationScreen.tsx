import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';

type NotificationNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

interface Notification {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  type: 'payment' | 'bonus';
  amount?: string;
  isRead: boolean;
}

const notifications: Notification[] = [
  { 
    id: '1',
    date: '20 abril', 
    time: '10:30', 
    title: 'Bônus recebido',
    description: 'Bônus de boas-vindas creditado', 
    amount: 'AOA 100',
    type: 'bonus',
    isRead: false,
  },
  { 
    id: '2',
    date: '19 abril', 
    time: '21:29', 
    title: 'Pagamento realizado',
    description: 'Subscrição Diária ATMFinder', 
    amount: 'AOA 50',
    type: 'payment',
    isRead: false,
  },
  { 
    id: '3',
    date: '19 abril', 
    time: '14:15', 
    title: 'Pagamento falhou',
    description: 'Erro ao processar pagamento da subscrição', 
    amount: 'AOA 50',
    type: 'payment',
    isRead: true,
  },
  { 
    id: '4',
    date: '15 abril', 
    time: '18:45', 
    title: 'Bônus recebido',
    description: 'Bônus por indicação de amigo', 
    amount: 'AOA 50',
    type: 'bonus',
    isRead: true,
  },
  { 
    id: '5',
    date: '5 abril', 
    time: '14:20', 
    title: 'Bônus recebido',
    description: 'Bônus de fidelidade', 
    amount: 'AOA 75',
    type: 'bonus',
    isRead: true,
  },
];

export default function NotificationScreen() {
  const navigation = useNavigation<NotificationNavigationProp>();

  const getIcon = (type: 'payment' | 'bonus') => {
    return type === 'bonus' ? '🎁' : '💳';
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
      <Text style={styles.title}>Notificações</Text>

      {/* Notifications List */}
      <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
        {notifications.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={[
              styles.notificationItem,
              !item.isRead && styles.notificationItemUnread,
            ]}
          >
            <View style={styles.notificationIcon}>
              <Text style={styles.icon}>{getIcon(item.type)}</Text>
            </View>
            <View style={styles.notificationContent}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                {!item.isRead && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notificationDescription}>{item.description}</Text>
              <Text style={styles.notificationDate}>{item.date}, {item.time}</Text>
            </View>
            {item.amount && (
              <Text style={[
                styles.notificationAmount,
                item.type === 'bonus' && styles.bonusAmount,
              ]}>
                {item.amount}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    marginBottom: 24,
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  notificationItemUnread: {
    backgroundColor: '#252527',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginLeft: 8,
  },
  notificationDescription: {
    color: '#999',
    fontSize: 13,
    marginBottom: 4,
  },
  notificationDate: {
    color: '#666',
    fontSize: 12,
  },
  notificationAmount: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  bonusAmount: {
    color: '#34c759',
  },
});
