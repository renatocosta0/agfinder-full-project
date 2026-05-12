import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ListRenderItem,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomTabBar from '../components/BottomTabBar';
import ContributionModal, { StatusType as CMStatusType } from '../components/ContributionModal';
import StatusButtons from '../components/StatusButtons';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { me, User } from '../services/auth';
import { getPois, getPoisSearch, PoiListItemApi, PoiTypeApi } from '../services/pois';
import { getSystemConfig } from '../services/system';
import { recordUserLocation } from '../services/users';
import { subscribeContributions } from '../utils/events';
import { formatSince as formatSinceShared } from '../utils/time';

type PoiType = 'atms' | 'gasstations';
type OrderBy = 'nearest' | 'recent' | 'reports';
type StatusType = 'both' | 'money' | 'paper' | 'none';

interface Poi {
  id: string;
  name: string;
  type: PoiType;
  origType?: PoiTypeApi;
  lastUpdate: string;
  status: StatusType;
  reportCount: number;
  reportsCount?: number;
  validationsCount?: number;
  isRecentlyUpdated?: boolean;
  timeUntilNext?: string;
  distance: number; // in kilometers
  lastUpdateMinutes: number; // for sorting
  hasCurrent?: boolean;
  currentCreatedAt?: string;
  currentType?: string;
  // milliseconds since current contribution was created; lower = more recent
  freshnessMs?: number;
  address?: string;
}

const DEFAULT_TTL_MINUTES = 30;

const initialPOIs: Poi[] = [];

type PoisNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Pois'>;

export default function PoisScreen() {
  const navigation = useNavigation<PoisNavigationProp>();
  const { token } = useAuth();
  const isWeb = Platform.OS === 'web';
  const [poiType, setPoiType] = useState<PoiType>('atms');
  const [orderBy, setOrderBy] = useState<OrderBy>('nearest');
  const [showOrderMenu, setShowOrderMenu] = useState(false);
  const [showPoiTypeMenu, setShowPoiTypeMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);

  const [pois, setPois] = useState<Poi[]>(initialPOIs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const timerRef = useRef<NodeJS.Timer | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const DEFAULT_CENTER = { lat: -8.838333, lng: 13.234444 };
  const [ttlMinutes, setTtlMinutes] = useState<number>(DEFAULT_TTL_MINUTES);
  const initialFetchDoneRef = useRef(false);
  const skipFirstSearchRef = useRef(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFetchingPoisRef = useRef(false);

  const mapApiType = (t: PoiType): PoiTypeApi => (t === 'atms' ? 'atm' : 'gasstation');
  const mapUiType = (t: PoiTypeApi): PoiType => (t === 'atm' ? 'atms' : 'gasstations');

  const computeCountdown = (createdAtIso?: string) => {
    if (!createdAtIso) return { remainingMs: 0, countdownLabel: '', progressiveLabel: '' };
    const created = new Date(createdAtIso).getTime();
    const expires = created + ttlMinutes * 60 * 1000;
    const now = Date.now();
    const remaining = Math.max(0, expires - now);
    const mm = Math.floor(remaining / 60000);
    const ss = Math.floor((remaining % 60000) / 1000);
    const countdownLabel = `Updated in ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    // Progressive since creation: seconds for first 60s, then minutes (1,2,3...)
    const elapsed = ttlMinutes * 60 * 1000 - remaining;
    let progressiveLabel = '';
    if (elapsed < 60000) {
      const secs = Math.max(1, Math.ceil(elapsed / 1000));
      progressiveLabel = `Updated in ${secs}s`;
    } else {
      const minsProgress = Math.max(1, Math.floor(elapsed / 60000));
      progressiveLabel = `Updated in ${minsProgress} ${minsProgress === 1 ? 'minute' : 'minutes'}`;
    }
    return { remainingMs: remaining, countdownLabel, progressiveLabel };
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchPois(true, 1, true);
    } finally {
      setRefreshing(false);
    }
  };

  // Keep list in sync when a contribution is made from PoiDetailsScreen
  useEffect(() => {
    const unsub = subscribeContributions(({ poiId, createdAtIso }) => {
      const { countdownLabel, progressiveLabel } = computeCountdown(createdAtIso);
      setPois((prev) => prev.map((p) => (
        String(p.id) === String(poiId)
          ? {
            ...p,
            currentCreatedAt: createdAtIso,
            hasCurrent: true,
            isRecentlyUpdated: true,
            timeUntilNext: countdownLabel.replace('Updated in ', ''),
            lastUpdate: progressiveLabel,
            lastUpdateMinutes: 0,
          }
          : p
      )));
    });
    return () => { try { unsub(); } catch { } };
  }, []);

  // Haversine distance (km) for fallback when API doesn't provide distance_km (e.g., search endpoint)
  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatSince = formatSinceShared;

  const mapListItemToPoi = (p: PoiListItemApi): Poi => {
    const uiType = mapUiType(p.poi_type);
    // Debug: incoming API type vs UI type
    try { console.log('[mapListItemToPoi]', { api_type: p.poi_type, ui_type: uiType, name: p.name }); } catch { }
    const current = p.current_contribution;

    // Backend sends total_interactions = 1 + validations + reports when there is a current contribution.
    // The list payload does not include validations/reports explicitly, so we derive them:
    // - If total_interactions is 0: none
    // - If >= 1: (validations + reports) = total_interactions - 1
    // We don't know the split between validations and reports; for the UI filter "Most reports"
    // we treat it as "most interactions" to avoid always showing 0 for other users.
    const totalInteractions = Number(p.total_interactions ?? 0);
    const derivedInteractions = Math.max(0, totalInteractions - 1);

    const base: Poi = {
      id: String(p.id),
      name: p.name,
      type: uiType,
      origType: p.poi_type,
      status: 'none',
      reportCount: totalInteractions,
      reportsCount: derivedInteractions,
      validationsCount: 0,
      distance: Number(p.distance_km ?? 0),
      lastUpdateMinutes: 9999,
      hasCurrent: !!current,
      currentCreatedAt: (current as any)?.created_at || (current as any)?.createdAt,
      currentType: (current as any)?.type || (current as any)?.contribution_type,
      lastUpdate: 'No updates today',
      freshnessMs: Number.MAX_SAFE_INTEGER,
      address: p.address,
    };

    const createdAt = (current as any)?.created_at || (current as any)?.createdAt;
    if (createdAt) {
      const { remainingMs, countdownLabel, progressiveLabel } = computeCountdown(createdAt);
      const createdMs = new Date(createdAt).getTime();
      const elapsedMs = Math.max(0, Date.now() - createdMs);
      if (remainingMs > 0) {
        return { ...base, isRecentlyUpdated: true, timeUntilNext: countdownLabel.replace('Updated in ', ''), lastUpdate: progressiveLabel, lastUpdateMinutes: Math.floor(elapsedMs / 60000), freshnessMs: elapsedMs };
      }
      const minsAgo = Math.floor(elapsedMs / 60000);
      return { ...base, isRecentlyUpdated: false, lastUpdate: formatSince(createdAt), lastUpdateMinutes: minsAgo, freshnessMs: elapsedMs };
    }
    return { ...base, isRecentlyUpdated: false, lastUpdate: 'No updates today' };
  };

  const fetchPois = async (
    reset: boolean = true,
    nextPage?: number,
    forceRefresh?: boolean,
    centerOverride?: { lat: number; lng: number } | null,
    orderByOverride?: OrderBy
  ) => {
    if (isFetchingPoisRef.current) return;
    isFetchingPoisRef.current = true;
    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const center = centerOverride ?? coords ?? DEFAULT_CENTER;
      const requestedType = mapApiType(poiType);
      const isSearching = searchQuery.trim().length > 0;
      const radius = 15;
      const pageToLoad = reset ? 1 : (nextPage ?? page + 1);
      const limit = 20;
      const currentOrderBy = orderByOverride ?? orderBy;
      try { console.log('[fetchPois] request', { lat: center.lat, lng: center.lng, radius, type: requestedType, page: pageToLoad, limit, q: searchQuery, search: isSearching, orderBy: currentOrderBy }); } catch { }
      const { pois: apiPois, pagination } = isSearching
        ? await getPoisSearch({ q: searchQuery.trim(), page: pageToLoad, limit, include_contributions: true })
        : await getPois({ lat: center.lat, lng: center.lng, radius, type: requestedType, include_contributions: true, page: pageToLoad, limit, forceRefresh: !!forceRefresh, orderBy: currentOrderBy });
      try { console.log('[fetchPois] response.count', apiPois.length, 'page', pagination?.page, 'pages', pagination?.pages); } catch { }
      let mapped = apiPois.map(mapListItemToPoi);
      // Ensure distance is present also for search results
      const centerForDistance = coords ?? DEFAULT_CENTER;
      mapped = mapped.map((p) => {
        if (!Number.isFinite(p.distance) || p.distance === 0) {
          const item = apiPois.find(x => String(x.id) === p.id);
          const lat = Number((item as any)?.latitude ?? (item as any)?.lat);
          const lng = Number((item as any)?.longitude ?? (item as any)?.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const d = haversineKm(centerForDistance.lat, centerForDistance.lng, lat, lng);
            return { ...p, distance: d };
          }
        }
        return p;
      });
      if (reset) {
        setPois(mapped);
      } else {
        setPois((prev) => [...prev, ...mapped]);
      }
      setPage(pageToLoad);
      const totalPages = pagination?.pages ?? 1;
      setHasMore(pageToLoad < totalPages);
    } catch (e: any) {
      if (reset) {
        setError('Failed to load POIs');
        setPois(initialPOIs);
        setHasMore(false);
      }
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
      isFetchingPoisRef.current = false;
      if (reset && !initialFetchDoneRef.current) {
        initialFetchDoneRef.current = true;
        setInitialFetchDone(true);
      }
    }
  };

  useEffect(() => {
    // Only refetch on type change after the initial fetch is done
    if (initialFetchDoneRef.current) {
      fetchPois(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poiType]);

  useEffect(() => {
    (async () => {
      // Try to fetch TTL from backend config
      try {
        const cfg = await getSystemConfig();
        const v = cfg?.CONTRIBUTION_TTL_MINUTES ?? cfg?.contribution_ttl_minutes ?? cfg?.ttl_minutes;
        if (typeof v === 'number') setTtlMinutes(v);
        else if (typeof v === 'string' && v.trim()) {
          const n = Number(v);
          if (!Number.isNaN(n)) setTtlMinutes(n);
        }
      } catch { }

      if (isWeb) {
        // Web: wait for geolocation (higher accuracy) before first fetch to avoid wrong "Nearest".
        // Fallback to DEFAULT_CENTER only if permission denied / timeout.
        setLoading(true);
        setError(null);
        let centerToUse: { lat: number; lng: number } | null = null;
        try {
          const secureContext =
            typeof window !== 'undefined' &&
            ((window as any).isSecureContext || window.location.hostname === 'localhost');
          const navAny: any = typeof navigator !== 'undefined' ? (navigator as any) : null;

          const webAlert = (title: string, message: string) => {
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
              window.alert(`${title}\n\n${message}`);
              return;
            }
            Alert.alert(title, message);
          };

          try {
            const permApi = navAny?.permissions?.query;
            if (typeof permApi === 'function') {
              const perm = await navAny.permissions.query({ name: 'geolocation' });
              try { console.log('[web geolocation] permission state:', perm?.state); } catch { }
            } else {
              try { console.log('[web geolocation] Permissions API not available'); } catch { }
            }
          } catch (permErr: any) {
            try { console.log('[web geolocation] permissions.query error', permErr); } catch { }
          }

          const getBrowserPosition = () =>
            new Promise<{ lat: number; lng: number; accuracy?: number }>((resolve, reject) => {
              if (!navAny?.geolocation?.getCurrentPosition) {
                reject(new Error('Geolocation is not available'));
                return;
              }
              navAny.geolocation.getCurrentPosition(
                (pos: any) => {
                  resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                  });
                },
                (err: any) => reject(err),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
              );
            });

          if (!secureContext) {
            webAlert(
              'Localização indisponível',
              'No Edge, a geolocalização só funciona em https:// ou em http://localhost. Abra a web pelo localhost ou publique com HTTPS para o “Nearest” ficar correto.'
            );
          } else {
            try {
              const browserPos = await getBrowserPosition();
              if (Number.isFinite(browserPos.lat) && Number.isFinite(browserPos.lng)) {
                centerToUse = { lat: browserPos.lat, lng: browserPos.lng };
                setCoords(centerToUse);
              }
              try {
                await recordUserLocation({
                  lat: browserPos.lat,
                  lng: browserPos.lng,
                  accuracy: browserPos.accuracy ?? undefined,
                  source: 'app',
                  recordedAt: new Date().toISOString(),
                });
              } catch { }
            } catch (geoErr: any) {
              try {
                console.log('[web geolocation] error', {
                  code: geoErr?.code,
                  message: geoErr?.message,
                  geoErr,
                });
              } catch { }
              webAlert(
                'Permissão de localização',
                `O Edge não liberou sua localização. Verifique:\n\n1) Windows: Configurações -> Privacidade e segurança -> Localização = Ativado\n2) Edge: Site settings -> Location = Allow\n3) Recarregue a página`
              );
            }
          }
        } catch {
          // ignore
        }
        await fetchPois(true, 1, true, centerToUse);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          await recordUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
            source: 'app',
            recordedAt: new Date().toISOString(),
          });
        } catch { }
      } catch (e) {
        // ignore and keep default center
      }
    })();
  }, [isWeb]);

  // Fallback: if coords don't arrive quickly, perform an initial fetch with default center after a short timeout
  useEffect(() => {
    if (isWeb) return;
    const t = setTimeout(() => {
      if (!initialFetchDoneRef.current) {
        fetchPois(true, 1, true);
        initialFetchDoneRef.current = true;
        setInitialFetchDone(true);
      }
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeb]);

  useEffect(() => {
    // Refetch when coordinates become available; forceRefresh to bypass any cached defaults
    if (isWeb) return;
    if (coords) {
      fetchPois(true, 1, true);
      initialFetchDoneRef.current = true;
      setInitialFetchDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, isWeb]);

  // Debounce search to avoid loops
  useEffect(() => {
    if (skipFirstSearchRef.current) {
      // Skip the very first debounce on mount
      skipFirstSearchRef.current = false;
      return;
    }
    const h = setTimeout(() => {
      fetchPois(true);
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Refetch when orderBy changes to get globally sorted results
  useEffect(() => {
    if (coords) {
      fetchPois(true, 1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBy]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => {
      setPois((prev) =>
        prev.map((p) => {
          if (!p.currentCreatedAt) return p;
          const createdMs = new Date(p.currentCreatedAt).getTime();
          const elapsedMs = Math.max(0, Date.now() - createdMs);
          const { remainingMs, countdownLabel, progressiveLabel } = computeCountdown(p.currentCreatedAt);
          if (remainingMs > 0) {
            return {
              ...p,
              isRecentlyUpdated: true,
              timeUntilNext: countdownLabel.replace('Updated in ', ''),
              lastUpdate: progressiveLabel,
              lastUpdateMinutes: Math.floor(elapsedMs / 60000),
              freshnessMs: elapsedMs,
            };
          }
          if (p.isRecentlyUpdated) {
            return {
              ...p,
              isRecentlyUpdated: false,
              lastUpdate: formatSince(p.currentCreatedAt),
              lastUpdateMinutes: Math.floor(elapsedMs / 60000),
              freshnessMs: elapsedMs,
            };
          }
          // Already expired previously: still update elapsed for sorting
          return { ...p, lastUpdateMinutes: Math.floor(elapsedMs / 60000), freshnessMs: elapsedMs };
        })
      );
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
    };
  }, []);

  const filteredPois = useMemo(() => {
    const apiType = mapApiType(poiType);
    let list = pois.filter((p) => p.origType === apiType);
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [pois, poiType, searchQuery]);

  // Sort POIs based on orderBy filter
  // When orderBy is 'recent' or 'reports', backend already sorts globally, so no local sort needed
  const sortedPois = orderBy === 'nearest'
    ? [...filteredPois].sort((a, b) => a.distance - b.distance)
    : filteredPois;

  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case 'both': return '#34c759';
      case 'money': return '#ffcc00';
      case 'paper': return '#ff9500';
      case 'none': return '#ff3b30';
    }
  };

  const getStatusIcon = (status: StatusType) => {
    if (poiType === 'gasstations') {
      switch (status) {
        case 'both': return require('../../assets/images/gasdiesel.png');
        case 'money': return require('../../assets/images/gas.png');
        case 'paper': return require('../../assets/images/diesel.png');
        case 'none': return require('../../assets/images/nogasdiesel.png');
      }
    }
    // ATMs
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
    // ATMs
    switch (status) {
      case 'both': return 'Money and paper available';
      case 'money': return 'Money available, no paper';
      case 'paper': return 'Paper available, no money';
      case 'none': return 'No money or paper available';
    }
  };

  const getUpdateColor = (updateText: string) => {
    if (updateText.includes('No updates')) return '#f87171'; // red
    if (updateText.startsWith('Updated in')) return '#facc15'; // yellow within TTL countdown
    return '#fb923c'; // orange when expired (Updated X minutes/hours)
  };

  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      // Converter para metros
      const meters = Math.round(distanceKm * 1000);
      return `${meters} m`;
    }
    const km = Math.round(distanceKm * 10) / 10;
    return `${km.toFixed(1)} km`;
  };

  const handleStatusClick = (poiId: string, status: StatusType) => {
    if (!token) {
      Alert.alert('Login required', 'You must be logged in to contribute.');
      return;
    }
    setSelectedPoiId(poiId);
    setSelectedStatus(status);
    setShowModal(true);
  };

  const handleConfirm = async () => { };

  const [user, setUser] = useState<User | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await me();
        if (mounted) setUser(u);
      } catch { }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const hasActiveSubscription = useMemo(() => {
    if (isWeb) return true;
    if (!user) return false;
    return (
      user.subscription_type !== 'none' &&
      user.subscription_end &&
      new Date(user.subscription_end) > new Date()
    );
  }, [isWeb, user]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{(user?.name?.[0] || 'U').toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
        {!isWeb ? (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Image source={require('../../assets/icons/search.png')} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowOrderMenu(!showOrderMenu)}
        >
          <Image source={require('../../assets/icons/order.png')} style={styles.filterIcon} />
          <Text style={styles.filterText}>
            {orderBy === 'nearest' ? 'Nearest' : orderBy === 'recent' ? 'Recent' : 'Most Reports'}
          </Text>
          <Text style={styles.filterArrow}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowPoiTypeMenu(!showPoiTypeMenu)}
        >
          <Text style={styles.filterText}>{poiType === 'atms' ? 'ATMs' : 'Gas Stations'}</Text>
          <Text style={styles.filterArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Order By Modal */}
      <Modal
        visible={showOrderMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOrderMenu(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowOrderMenu(false)}
        >
          <View style={styles.filterModalContent}>
            <TouchableOpacity
              style={styles.filterModalItem}
              onPress={() => { setOrderBy('nearest'); setShowOrderMenu(false); }}
            >
              <Text style={styles.filterModalText}>Nearest</Text>
            </TouchableOpacity>
            <View style={styles.filterModalDivider} />
            <TouchableOpacity
              style={styles.filterModalItem}
              onPress={() => { setOrderBy('recent'); setShowOrderMenu(false); }}
            >
              <Text style={styles.filterModalText}>Recent Updates</Text>
            </TouchableOpacity>
            <View style={styles.filterModalDivider} />
            <TouchableOpacity
              style={styles.filterModalItem}
              onPress={() => { setOrderBy('reports'); setShowOrderMenu(false); }}
            >
              <Text style={styles.filterModalText}>Most Reports</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* POI Type Modal */}
      <Modal
        visible={showPoiTypeMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPoiTypeMenu(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowPoiTypeMenu(false)}
        >
          <View style={styles.filterModalContent}>
            <TouchableOpacity
              style={styles.filterModalItem}
              onPress={() => { setPoiType('atms'); setShowPoiTypeMenu(false); }}
            >
              <Text style={styles.filterModalText}>ATMs</Text>
            </TouchableOpacity>
            <View style={styles.filterModalDivider} />
            <TouchableOpacity
              style={styles.filterModalItem}
              onPress={() => { setPoiType('gasstations'); setShowPoiTypeMenu(false); }}
            >
              <Text style={styles.filterModalText}>Gas Stations</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* POI List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.centeredText}>Loading POIs…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>{error}</Text>
          <TouchableOpacity style={styles.centeredButton} onPress={() => fetchPois(true)}>
            <Text style={styles.centeredButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : pois.length === 0 ? (
        <View style={styles.centered}>
          {!initialFetchDone ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.centeredText}>Loading POIs…</Text>
            </>
          ) : (
            <>
              <Text style={styles.centeredText}>No POIs found nearby.</Text>
              <TouchableOpacity style={styles.centeredButton} onPress={() => fetchPois(true)}>
                <Text style={styles.centeredButtonText}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          data={sortedPois}
          extraData={{ orderBy, poiType, searchQuery, count: pois.length }}
          keyExtractor={(item) => item.id}
          renderItem={({ item: poi }: Parameters<ListRenderItem<Poi>>[0]) => (
            <View style={styles.poiCard}>
              <TouchableOpacity
                style={styles.poiHeader}
                onPress={() => {
                  if (isWeb || hasActiveSubscription) {
                    navigation.navigate('PoiDetails', {
                      poiId: poi.id,
                      poiType: poi.origType || 'atm',
                      currentCreatedAt: poi.currentCreatedAt,
                      reportCount: poi.reportCount,
                      fallbackType: poi.currentType,
                    });
                  } else {
                    setShowSubscriptionModal(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.poiName}>{poi.name}</Text>
                  {poi.address && (
                    <Text style={styles.poiAddress} numberOfLines={1}>{poi.address}</Text>
                  )}
                  <View style={styles.poiInfoRow}>
                    <Text style={[styles.poiUpdate, { color: getUpdateColor(poi.lastUpdate) }]}>{poi.lastUpdate}</Text>
                    <Text style={styles.poiDistance}> • {formatDistance(poi.distance)}</Text>
                  </View>
                </View>
                {poi.reportCount > 0 && (
                  <View style={styles.reportBadgeContainer}>
                    <Text style={[styles.reportBadgeText, { color: getUpdateColor(poi.lastUpdate) }]}>({poi.reportCount})</Text>
                  </View>
                )}
              </TouchableOpacity>

              {poi.isRecentlyUpdated ? (
                <View style={styles.recentlyUpdatedContainer}>
                  <Text style={styles.recentlyUpdatedText}>
                    Updated recently, check back in {poi.timeUntilNext}
                  </Text>
                </View>
              ) : (
                <StatusButtons
                  poiType={poiType}
                  onSelect={(s) => handleStatusClick(poi.id, s as any)}
                  containerStyle={styles.statusButtons}
                />
              )}
            </View>
          )}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (loading || loadingMore || !hasMore) return;
            fetchPois(false, page + 1);
          }}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : null}
        />
      )}

      {/* Bottom Navigation */}
      <BottomTabBar poiType={poiType} />

      <ContributionModal
        visible={showModal}
        poiId={selectedPoiId || ''}
        poiType={poiType}
        initialStatus={(selectedStatus as CMStatusType) ?? null}
        onClose={() => { setShowModal(false); setSelectedStatus(null); setSelectedPoiId(null); }}
        onAfterSubmit={({ nowIso }) => {
          const { countdownLabel, progressiveLabel } = computeCountdown(nowIso);
          setPois((prev) => prev.map((p) => (
            p.id === selectedPoiId
              ? {
                ...p,
                currentCreatedAt: nowIso,
                hasCurrent: true,
                isRecentlyUpdated: true,
                timeUntilNext: countdownLabel.replace('Updated in ', ''),
                lastUpdate: progressiveLabel,
                lastUpdateMinutes: 0,
                reportCount: 1,
              }
              : p
          )));
        }}
      />

      {!isWeb ? (
        <Modal
          visible={showSubscriptionModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSubscriptionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.subscriptionModalHeader}>
                <Text style={styles.subscriptionModalTitle}>Subscrição Necessária</Text>
              </View>
              <View style={styles.subscriptionModalBody}>
                <Text style={styles.subscriptionModalText}>
                  Para ver detalhes e informações de um ponto de interesse, é necessário ter uma subscrição ativa.
                </Text>
                <TouchableOpacity
                  style={styles.subscriptionModalButton}
                  onPress={() => {
                    setShowSubscriptionModal(false);
                    navigation.navigate('Payment');
                  }}
                >
                  <Text style={styles.subscriptionModalButtonText}>Obter Subscrição</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.subscriptionModalCancelButton}
                  onPress={() => setShowSubscriptionModal(false)}
                >
                  <Text style={styles.subscriptionModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5856d6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  notificationButton: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    width: 20,
    height: 20,
    tintColor: '#666',
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  filterIcon: {
    width: 16,
    height: 16,
    tintColor: '#fff',
  },
  filterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  filterArrow: {
    color: '#fff',
    fontSize: 10,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  filterModalContent: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    marginTop: 180,
    marginHorizontal: 20,
    maxWidth: 250,
    overflow: 'hidden',
  },
  filterModalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  filterModalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  filterModalDivider: {
    height: 1,
    backgroundColor: '#3a3a3c',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  poiCard: {
    backgroundColor: '#2c2c2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  poiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  poiName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  poiAddress: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  poiInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  poiUpdate: {
    fontSize: 12,
  },
  poiDistance: {
    color: '#999',
    fontSize: 12,
  },
  reportBadgeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  reportBadgeText: {
    fontSize: 14,
    fontWeight: '400',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recentlyUpdatedContainer: {
    backgroundColor: '#3a3a3c',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  recentlyUpdatedText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
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
  subscriptionModalHeader: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  subscriptionModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subscriptionModalBody: {
    padding: 20,
    alignItems: 'center',
  },
  subscriptionModalText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  subscriptionModalButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionModalCancelButton: {
    paddingVertical: 12,
  },
  subscriptionModalCancelText: {
    color: '#999',
    fontSize: 14,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  centeredText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 12,
  },
  centeredButton: {
    marginTop: 12,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  centeredButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
