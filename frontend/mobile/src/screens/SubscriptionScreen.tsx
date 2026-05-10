import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getUserSubscriptionTransactions, SubscriptionTransactionRow } from '../services/subscriptions';
import { getBonusHistory, BonusHistoryItem } from '../services/bonus';

type SubscriptionNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Subscription'>;

export default function SubscriptionScreen() {
  const navigation = useNavigation<SubscriptionNavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [items, setItems] = useState<SubscriptionTransactionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed' | 'expired'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isFetchingRef = useRef(false);

  // Bonus history
  const [bonusItems, setBonusItems] = useState<BonusHistoryItem[]>([]);
  const [bonusPage, setBonusPage] = useState(1);
  const [bonusTotalPages, setBonusTotalPages] = useState(1);

  const fetchData = async (filter?: typeof statusFilter) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setError(null);
    try {
      const effectiveFilter = filter ?? statusFilter;
      const data = await getUserSubscriptionTransactions({ sortBy: 'created_at:desc', limit: 20, page: 1, status: effectiveFilter === 'all' ? undefined : effectiveFilter });
      setItems(data.transactions);
      setDaysRemaining(data.summary.subscription.days_remaining);
      setIsActive(data.summary.subscription.is_active);
      setPage(1);
      setTotalPages(data.pagination.pages);
      // Fetch bonus first page
      const bh = await getBonusHistory({ page: 1, limit: 20 });
      setBonusItems(bh.items);
      setBonusPage(bh.page);
      setBonusTotalPages(bh.totalPages);
    } catch (e) {
      setError('Falha ao carregar histórico de subscrição');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      const id = setTimeout(() => { fetchData(); }, 100);
      return () => { clearTimeout(id); };
    }, [statusFilter])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore) return;
    if (page >= totalPages) return;
    try {
      setIsLoadingMore(true);
      const nextPage = page + 1;
      const data = await getUserSubscriptionTransactions({ sortBy: 'created_at:desc', limit: 20, page: nextPage, status: statusFilter === 'all' ? undefined : statusFilter });
      setItems(prev => [...prev, ...data.transactions]);
      setPage(nextPage);
      setTotalPages(data.pagination.pages);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoading, isLoadingMore, page, totalPages, statusFilter]);

  const loadMoreBonus = useCallback(async () => {
    if (isLoading || isLoadingMore) return;
    if (bonusPage >= bonusTotalPages) return;
    try {
      setIsLoadingMore(true);
      const nextPage = bonusPage + 1;
      const bh = await getBonusHistory({ page: nextPage, limit: 20 });
      setBonusItems(prev => [...prev, ...bh.items]);
      setBonusPage(nextPage);
      setBonusTotalPages(bh.totalPages);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoading, isLoadingMore, bonusPage, bonusTotalPages]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.title}>Subscrição</Text>

      {/* Days Display */}
      {isLoading ? (
        <ActivityIndicator color="#fff" style={{ marginBottom: 32 }} />
      ) : (
        <Text style={styles.daysText}>{isActive ? `${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}` : '0 dias'}</Text>
      )}

      {/* Transaction History */}
      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Histórico de transacções</Text>
        {/* Status Filters */}
        <View style={styles.filtersRow}>
          {(['all','pending','completed','failed','expired'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterButton, statusFilter === s && styles.filterButtonActive]}
              onPress={async () => {
                if (statusFilter === s) return;
                setStatusFilter(s);
                // reset listado e paginação antes de buscar com novo filtro
                setItems([]);
                setPage(1);
                setTotalPages(1);
                setIsLoadingMore(false);
                setIsLoading(true);
                await fetchData(s);
              }}
            >
              <Text style={[styles.filterText, statusFilter === s && styles.filterTextActive]}>
                {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && !isLoading ? <Text style={{ color: '#ff3b30', marginBottom: 8 }}>{error}</Text> : null}

        <FlatList
          data={items}
          keyExtractor={(tx) => tx.id}
          renderItem={({ item: tx }) => (
            <TouchableOpacity
              style={styles.transactionItem}
              onPress={() => {
                if (tx.display_info.is_pending) {
                  navigation.navigate('PaymentDetails', {
                    subscriptionType: tx.subscription_type,
                    subscriptionValue: tx.display_info.amount_formatted,
                    reference: tx.reference ?? undefined,
                    entity: tx.entity ?? undefined,
                    steps: undefined,
                    expiresAt: tx.expires_at,
                    durationDays: tx.display_info.duration_days,
                  });
                }
              }}
            >
              <View style={styles.transactionIcon}>
                {tx.payment_method === 'bonus' ? (
                  <Text style={styles.giftIcon}>🎁</Text>
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDate}>{tx.formatted_dates.created_at.date}, {tx.formatted_dates.created_at.datetime.split(' ')[1]}</Text>
                <Text style={styles.transactionDescription}>Subscrição {tx.display_info.subscription_type_name} ATMFinder</Text>
                {tx.display_info.status !== 'completed' && (
                  <Text style={styles.transactionStatus}>{tx.display_info.status}</Text>
                )}
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, tx.payment_method === 'bonus' && styles.bonusAmount]}>
                  {tx.display_info.amount_formatted}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          )}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListEmptyComponent={isLoading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
          ) : (
            <Text style={{ color: '#999' }}>Sem transacções</Text>
          )}
          ListFooterComponent={isLoadingMore ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
          ) : null}
        />
      </View>

      {/* Bonus History */}
      <View style={[styles.historyContainer, { marginTop: 16 }] }>
        <Text style={styles.historyTitle}>Histórico de bónus</Text>
        <FlatList
          data={bonusItems}
          keyExtractor={(b) => b.id}
          renderItem={({ item: b }) => (
            <View style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Text style={styles.giftIcon}>🎁</Text>
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionDate}>{new Date(b.created_at).toISOString().split('T')[0]}</Text>
                <Text style={styles.transactionDescription}>{b.description || b.type}</Text>
                {b.status && (
                  <Text style={styles.transactionStatus}>{b.status}</Text>
                )}
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, styles.bonusAmount]}>
                  {`AOA ${b.amount}`}
                </Text>
              </View>
            </View>
          )}
          onEndReachedThreshold={0.5}
          onEndReached={loadMoreBonus}
          ListEmptyComponent={isLoading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
          ) : (
            <Text style={{ color: '#999' }}>Sem histórico de bónus</Text>
          )}
          ListFooterComponent={isLoadingMore ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
          ) : null}
        />
      </View>
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
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  daysText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    marginHorizontal: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  transactionList: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  giftIcon: {
    fontSize: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDate: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDescription: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 2,
  },
  transactionStatus: {
    color: '#ff3b30',
    fontSize: 12,
  },
  transactionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionAmount: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  bonusAmount: {
    color: '#34c759',
  },
  chevron: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#2c2c2e',
    marginBottom: 4,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
});
