import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { getPoiDetails } from '../services/pois';
import { getSystemConfig } from '../services/system';
import { useAuth } from '../contexts/AuthContext';
import { postValidation } from '../services/contributions';
import ContributionModal, { StatusType as CMStatusType } from '../components/ContributionModal';
import StatusButtons from '../components/StatusButtons';
import { computeCountdown, formatSince } from '../utils/time';
import { emitContribution } from '../utils/events';

type PoiDetailsRouteProp = RouteProp<RootStackParamList, 'PoiDetails'>;
type PoiDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PoiDetails'>;

type ContributionType = 'money_paper' | 'money_only' | 'paper_only' | 'none' | 'gasoline_diesel' | 'gasoline_only' | 'diesel_only';

interface CurrentContribution {
  id: string | number;
  contribution_type: ContributionType;
  created_at: string;
  expires_at: string;
  user: {
    id: string | number;
    name: string;
    profile_picture?: string;
  };
  validations: number;
  reports: number;
  is_owner?: boolean;
  can_validate?: boolean;
}

interface PoiDetails {
  id: string | number;
  name: string;
  poi_type: 'atm' | 'gasstation';
  latitude: number;
  longitude: number;
  address?: string;
  current_contribution?: CurrentContribution;
  total_interactions?: number;
}

const DEFAULT_TTL_MINUTES = 30;

export default function PoiDetailsScreen() {
  const navigation = useNavigation<PoiDetailsNavigationProp>();
  const route = useRoute<PoiDetailsRouteProp>();
  const { token } = useAuth();
  const { poiId, poiType } = route.params;

  const [poi, setPoi] = useState<PoiDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ttlMinutes, setTtlMinutes] = useState<number>(DEFAULT_TTL_MINUTES);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [elapsedLabel, setElapsedLabel] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CMStatusType | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');
  const lastFetchAtRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationType, setValidationType] = useState<'valid' | 'report' | null>(null);
  const [alreadyValidated, setAlreadyValidated] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await getSystemConfig();
        if (cfg?.CONTRIBUTION_TTL_MINUTES) setTtlMinutes(Number(cfg.CONTRIBUTION_TTL_MINUTES));
      } catch {}
      await loadPoiDetails();
    };
    load();
  }, [poiId]);

  // Ensure fresh data whenever screen gains focus (handles navigating from list into details)
  useFocusEffect(
    React.useCallback(() => {
      loadPoiDetails(true);
      return () => {};
    }, [poiId])
  );

  useEffect(() => {
    // Start ticking for this specific contribution timestamp
    updateCountdown();
    const interval = setInterval(() => updateCountdown(), 1000);
    return () => clearInterval(interval);
  }, [poi?.current_contribution?.created_at, ttlMinutes]);

  const loadPoiDetails = async (forceRefresh?: boolean) => {
    const now = Date.now();
    if (!forceRefresh) {
      if (inFlightRef.current) return;
      if (now - lastFetchAtRef.current < 1500) return;
    }
    inFlightRef.current = true;
    lastFetchAtRef.current = now;
    setLoading(true);
    setError(null);
    try {
      const data = await getPoiDetails(poiId, { include_contributions: true, forceRefresh: !!forceRefresh });
      const raw: any = data;
      try {
        console.log('PoiDetails route.params:', route.params);
        console.log('PoiDetails raw:', JSON.stringify(raw));
      } catch {}
      let current: any = raw.current_contribution || raw.currentContribution || undefined;
      if (!current) {
        const list: any[] = Array.isArray(raw.contributions) ? raw.contributions : [];
        if (list.length > 0) current = list.find((c) => c.is_current) || list[0];
        // Some backends may return a single joined object in raw.contributions
        if (!current && raw.contributions && typeof raw.contributions === 'object' && raw.contributions.id) {
          const c = raw.contributions;
          current = {
            id: c.id,
            contribution_type: c.contribution_type || c.type,
            created_at: c.created_at || c.createdAt,
            user: c.user || { id: c.user_id, name: c.user?.name },
            validations_count: c.validations_count ?? c.verification_count,
            reports_count: c.reports_count ?? c.dispute_count,
          };
        }
        // Some backends may use singular 'contribution'
        if (!current && raw.contribution && typeof raw.contribution === 'object' && raw.contribution.id) {
          const c = raw.contribution;
          current = {
            id: c.id,
            contribution_type: c.contribution_type || c.type,
            created_at: c.created_at || c.createdAt,
            user: c.user || { id: c.user_id, name: c.user?.name },
            validations_count: c.validations_count ?? c.verification_count,
            reports_count: c.reports_count ?? c.dispute_count,
          };
        }
        // Backend variant: nested aggregator object raw.contributions.current with 'type', 'contributor', and 'validations'
        if (!current && raw.contributions && raw.contributions.current) {
          const c = raw.contributions.current;
          current = {
            id: c.id,
            contribution_type: c.type || c.contribution_type,
            created_at: c.created_at || c.createdAt,
            user: c.contributor ? { id: c.contributor.id, name: c.contributor.name } : undefined,
            validations_count: c.validations?.valid,
            reports_count: c.validations?.reports,
          };
        }
      }
      // Handle flattened join keys e.g., 'contributions.id'
      if (!current && (raw['contributions.id'] || raw['contributions.created_at'] || raw['contributions.createdAt'])) {
        current = {
          id: raw['contributions.id'],
          contribution_type: raw['contributions.contribution_type'] || raw['contributions.type'],
          created_at: raw['contributions.created_at'] || raw['contributions.createdAt'],
          user: {
            id: raw['contributions.user.id'],
            name: raw['contributions.user.name'],
          },
          validations_count: raw['contributions.verification_count'],
          reports_count: raw['contributions.dispute_count'],
        };
      }
      let mapped: PoiDetails = {
        id: raw.id,
        name: raw.name,
        poi_type: raw.poi_type,
        latitude: raw.latitude,
        longitude: raw.longitude,
        address: raw.address,
        total_interactions: raw.total_interactions,
        current_contribution: current
          ? {
              id: current.id,
              contribution_type: (current.contribution_type || current.type) as ContributionType,
              created_at: current.created_at || current.createdAt,
              expires_at: new Date(new Date(current.created_at || current.createdAt).getTime() + ttlMinutes * 60000).toISOString(),
              user: {
                id: current.user?.id ?? current['user.id'] ?? 'unknown',
                name: current.user?.full_name || current.user?.name || current['user.name'] || 'User',
              },
              validations:
                current.validations ?? current.validations_count ?? current.verification_count ?? 0,
              reports:
                current.reports ?? current.reports_count ?? current.dispute_count ?? 0,
            }
          : undefined,
      };
      // Fallback: use route params if backend didn't return current contribution
      if (!mapped.current_contribution && (route.params.currentCreatedAt || (raw as any)?.last_contribution)) {
        const last = (raw as any)?.last_contribution;
        const fallbackType = (route.params as any).fallbackType as string | undefined;
        const fbUserId = (raw as any)?.current_contribution?.user?.id
          ?? (raw as any)?.contributions?.current?.contributor?.id
          ?? (raw as any)?.['contributions.user.id']
          ?? (Array.isArray((raw as any)?.contributions) && (raw as any).contributions[0]?.user?.id)
          ?? last?.user?.id
          ?? 'unknown';
        const fbUserName = (raw as any)?.current_contribution?.user?.full_name
          ?? (raw as any)?.current_contribution?.user?.name
          ?? (raw as any)?.contributions?.current?.contributor?.name
          ?? (raw as any)?.['contributions.user.name']
          ?? (Array.isArray((raw as any)?.contributions) && ((raw as any).contributions[0]?.user?.full_name || (raw as any).contributions[0]?.user?.name))
          ?? last?.user?.name
          ?? (poi?.current_contribution?.user?.name)
          ?? 'Unknown';
        const fbCreatedAt = route.params.currentCreatedAt || last?.created_at;
        const fbType = (fallbackType as ContributionType)
          || (last?.contribution_type as ContributionType)
          || ((route.params.poiType === 'atm' ? 'money_paper' : 'gasoline_diesel') as ContributionType);
        mapped = {
          ...mapped,
          current_contribution: {
            id: 'route-fallback',
            contribution_type: fbType,
            created_at: fbCreatedAt,
            expires_at: new Date(new Date(fbCreatedAt).getTime() + ttlMinutes * 60000).toISOString(),
            user: { id: fbUserId, name: fbUserName },
            validations: (last?.validations ?? (raw as any)?.['contributions.verification_count'] ?? 0) as number,
            reports: (last?.reports ?? (raw as any)?.['contributions.dispute_count'] ?? (route.params.reportCount ?? 0)) as number,
            // Prefer backend to compute can_validate; leave undefined here as fallback
          },
        } as any;
      }
      // If backend returned current contribution but omitted type, use fallbackType if provided
      if (mapped.current_contribution && !(mapped.current_contribution as any).contribution_type) {
        const ft = (route.params as any).fallbackType as string | undefined;
        if (ft) {
          (mapped.current_contribution as any).contribution_type = ft as ContributionType;
        }
      }
      // If backend provided can_validate on last_contribution, propagate to current mapping when absent
      if (
        mapped.current_contribution &&
        typeof (mapped.current_contribution as any).can_validate === 'undefined' &&
        (raw as any)?.last_contribution &&
        typeof (raw as any).last_contribution.can_validate === 'boolean'
      ) {
        (mapped.current_contribution as any).can_validate = (raw as any).last_contribution.can_validate as boolean;
      }
      // If backend provided is_owner on last_contribution, propagate to current mapping when absent
      if (
        mapped.current_contribution &&
        typeof (mapped.current_contribution as any).is_owner === 'undefined' &&
        (raw as any)?.last_contribution &&
        typeof (raw as any).last_contribution.is_owner === 'boolean'
      ) {
        (mapped.current_contribution as any).is_owner = (raw as any).last_contribution.is_owner as boolean;
      }
      try { console.log('Mapped current contribution:', mapped.current_contribution); } catch {}
      setPoi(mapped);
      // Prime countdown/labels immediately
      setTimeout(() => updateCountdown(), 0);
    } catch (e) {
      setError('Failed to load POI details');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const updateCountdown = () => {
    if (!poi?.current_contribution) return;
    const { remainingMs: rem, countdownLabel, progressiveLabel } = computeCountdown(
      poi.current_contribution.created_at,
      ttlMinutes
    );
    setRemainingMs(rem);
    // Within TTL, show progressive seconds/minutes; after TTL, match list behavior (minutes -> hours)
    setElapsedLabel(rem > 0 ? progressiveLabel : formatSince(poi.current_contribution.created_at));
    setTimeUntilNext(countdownLabel.replace('Updated in ', ''));
  };

  const formatTimeRemaining = (ms: number): string => {
    const mm = Math.floor(ms / 60000);
    const ss = Math.floor((ms % 60000) / 1000);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };


  const getContributionImage = (type: ContributionType) => {
    if (poiType === 'gasstation') {
      switch (type) {
        case 'gasoline_diesel': return require('../../assets/images/gasdiesel.png');
        case 'gasoline_only': return require('../../assets/images/gas.png');
        case 'diesel_only': return require('../../assets/images/diesel.png');
        case 'none': return require('../../assets/images/nogasdiesel.png');
      }
    }
    // ATM
    switch (type) {
      case 'money_paper': return require('../../assets/images/moneypaper.png');
      case 'money_only': return require('../../assets/images/nopaper (1).png');
      case 'paper_only': return require('../../assets/images/nomoney (1).png');
      case 'none': return require('../../assets/images/nomoneypaper.png');
    }
  };

  const handleValidate = async () => {
    if (!token) {
      Alert.alert('Login required', 'You must be logged in to validate.');
      return;
    }
    if (!poi?.current_contribution) return;
    try {
      await postValidation(poi.current_contribution.id, { validation_type: 'confirm' });
      Alert.alert('Success', 'Validation submitted.');
      loadPoiDetails();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit validation.');
    }
  };

  const handleReport = async () => {
    if (!token) {
      Alert.alert('Login required', 'You must be logged in to report.');
      return;
    }
    if (!poi?.current_contribution) return;
    try {
      await postValidation(poi.current_contribution.id, { validation_type: 'dispute' });
      Alert.alert('Success', 'Report submitted.');
      loadPoiDetails();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit report.');
    }
  };

  const handleStatusClick = (status: 'both' | 'money' | 'paper' | 'none') => {
    if (!token) {
      Alert.alert('Login required', 'You must be logged in to contribute.');
      return;
    }
    setSelectedStatus(status as CMStatusType);
    setShowModal(true);
  };

  const handleOpenInMaps = async () => {
    if (!poi) return;
    const lat = Number(poi.latitude);
    const lng = Number(poi.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert('Error', 'Location coordinates are not available.');
      return;
    }
    const label = encodeURIComponent(poi.name || poi.address || 'Location');
    let url = '';
    if (Platform.OS === 'ios') {
      // Try Google Maps first if installed (check bare scheme per iOS rules)
      const googleScheme = 'comgooglemaps://';
      const googleMapsUrl = `comgooglemaps://?q=${lat},${lng}(${label})`;
      const canOpenGoogle = await Linking.canOpenURL(googleScheme);
      if (canOpenGoogle) {
        url = googleMapsUrl;
      } else {
        // Fallback to Apple Maps
        url = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
      }
    } else {
      // Android: try Google Maps navigation or geo link
      url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Web fallback
        const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        await Linking.openURL(webUrl);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open maps.');
    }
  };

  const isWithinTTL = remainingMs > 0;
  const hasContribution = !!poi?.current_contribution;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.centeredText}>Loading POI details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !poi) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.centeredText}>{error || 'POI not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadPoiDetails()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      {/* POI Name */}
      <View style={styles.nameContainer}>
        <Text style={styles.poiName} numberOfLines={2} ellipsizeMode="tail">{poi.name}</Text>
        {poi.address && (
          <Text style={styles.poiAddress} numberOfLines={1} ellipsizeMode="tail">{poi.address}</Text>
        )}
        <TouchableOpacity style={styles.openMapsButton} onPress={handleOpenInMaps}>
          <View style={styles.openMapsButtonContent}>
            <Text style={styles.openMapsIcon}>📍</Text>
            <Text style={styles.openMapsButtonText}>Open in Maps</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Image */}
      <View style={styles.imageContainer}>
        {hasContribution ? (
          <Image
            source={getContributionImage((poi.current_contribution!.contribution_type as any) || ((route.params as any).fallbackType as any))}
            style={styles.mainImage}
            resizeMode="cover"
          />
        ) : (
          <Image
            source={poiType === 'gasstation' ? require('../../assets/images/noupdatesgas.png') : require('../../assets/images/noupdates.png')}
            style={styles.mainImage}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Status Label */}
      {!hasContribution ? (
        <Text style={styles.noUpdatesLabel}>No updates today</Text>
      ) : (
        <Text style={styles.updatedLabel}>{elapsedLabel}</Text>
      )}

      {/* Content Section */}
      {!hasContribution ? (
        // State 1: No contribution
        <View style={styles.contentSection}>
          <Text style={styles.infoText}>
            Este {poiType === 'atm' ? 'ATM' : 'posto'} não tem atualizações recentes.
          </Text>
          <Text style={styles.infoText}>Selecione o estado atual:</Text>
        </View>
      ) : isWithinTTL ? (
        // State 3: Within TTL - show contributor, counts, validation buttons, and banner
        <>
          <Text style={styles.infoGivenByText}>
            Info given by {poi.current_contribution?.is_owner ? 'you' : (poi.current_contribution?.user.name || 'User')}
          </Text>
          {(poi.current_contribution?.is_owner || alreadyValidated || (poi.current_contribution?.can_validate === false && !poi.current_contribution?.is_owner)) && (
            <Text style={styles.cannotValidateText}>
              {poi.current_contribution?.is_owner
                ? 'Não é possível validar sua própria contribuição'
                : 'Você já validou esta contribuição anteriormente'}
            </Text>
          )}
          <View style={styles.validationButtonsContainer}>
            <View style={styles.validationButtonWrapper}>
              <Text style={styles.validationCount}>({poi.current_contribution?.validations ?? 0})</Text>
              <TouchableOpacity
                style={[
                  styles.validButton,
                  (poi.current_contribution?.is_owner || alreadyValidated || poi.current_contribution?.can_validate === false) && styles.disabledButton,
                ]}
                onPress={() => {
                  if (!(poi.current_contribution?.is_owner || alreadyValidated || poi.current_contribution?.can_validate === false)) {
                    setValidationType('valid');
                    setShowValidationModal(true);
                  }
                }}
                disabled={poi.current_contribution?.is_owner || alreadyValidated || poi.current_contribution?.can_validate === false}
              >
                <Text style={styles.validButtonText}>VALID</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.validationButtonWrapper}>
              <Text style={styles.validationCount}>({poi.current_contribution?.reports ?? 0})</Text>
              <TouchableOpacity
                style={[
                  styles.reportButton,
                  (poi.current_contribution?.is_owner || alreadyValidated || poi.current_contribution?.can_validate === false) && styles.disabledButton,
                ]}
                onPress={() => {
                  if (!(poi.current_contribution?.is_owner || alreadyValidated || poi.current_contribution?.can_validate === false)) {
                    setValidationType('report');
                    setShowValidationModal(true);
                  }
                }}
                disabled={poi.current_contribution?.is_owner || alreadyValidated || poi.current_contribution?.can_validate === false}
              >
                <Text style={styles.reportButtonText}>REPORT</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.recentlyUpdatedContainer}>
            <Text style={styles.recentlyUpdatedText}>
              Updated recently, check back in {timeUntilNext}
            </Text>
          </View>
        </>
      ) : (
        // State 2: Expired - show previous contributions info
        <View style={styles.contentSection}>
          <Text style={styles.previousContributionsTitle}>Previous Contributions</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Last contributor:</Text>
            <Text style={styles.statsValue}>{poi.current_contribution?.user.name}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Validations:</Text>
            <Text style={[styles.statsValue, { color: '#34c759' }]}>{poi.current_contribution?.validations ?? 0}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Reports:</Text>
            <Text style={[styles.statsValue, { color: '#ff3b30' }]}>{poi.current_contribution?.reports ?? 0}</Text>
          </View>
          <Text style={styles.infoText}>
            Forneça uma nova atualização para este {poiType === 'atm' ? 'ATM' : 'posto'}:
          </Text>
        </View>
      )}

      <ContributionModal
        visible={showModal}
        poiId={String(poi.id)}
        poiType={poiType === 'atm' ? 'atms' : 'gasstations'}
        initialStatus={selectedStatus}
        onClose={() => { setShowModal(false); setSelectedStatus(null); }}
        onAfterSubmit={({ selectedStatus, nowIso }) => {
          // Map status to contribution type string
          let contribution_type: ContributionType = 'none';
          if (poiType === 'atm') {
            contribution_type = selectedStatus === 'both' ? 'money_paper' : selectedStatus === 'money' ? 'money_only' : selectedStatus === 'paper' ? 'paper_only' : 'none';
          } else {
            contribution_type = selectedStatus === 'both' ? 'gasoline_diesel' : selectedStatus === 'money' ? 'gasoline_only' : selectedStatus === 'paper' ? 'diesel_only' : 'none';
          }
          // Optimistically update current contribution
          setPoi((prev) => {
            if (!prev) return prev;
            const updated: PoiDetails = {
              ...prev,
              current_contribution: {
                id: prev.current_contribution?.id ?? 'temp',
                contribution_type,
                created_at: nowIso,
                expires_at: nowIso,
                user: { id: 'me', name: 'You' },
                validations: 0,
                reports: 0,
              },
            } as any;
            return updated;
          });
          updateCountdown();
          emitContribution({ poiId, createdAtIso: nowIso });
          // Refetch with forceRefresh to sync with backend and cache
          loadPoiDetails(true);
        }}
      />

      {/* Validation Confirmation Modal */}
      {showValidationModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.validationModalContainer}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowValidationModal(false);
                setValidationType(null);
              }}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <View style={[styles.modalIcon, validationType === 'valid' ? styles.validIcon : styles.reportIcon]}>
              <Text style={styles.modalIconText}>{validationType === 'valid' ? '✓' : '🗑'}</Text>
            </View>
            <Text style={styles.validationModalTitle}>
              {validationType === 'valid' ? 'Validate info' : 'Report info'}
            </Text>
            <Text style={styles.validationModalText}>
              Are you sure you want to {validationType === 'valid' ? 'validate' : 'report'} this info?{' '}
              This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[styles.validationModalButton, validationType === 'valid' ? styles.validateButton : styles.reportModalButton]}
              onPress={async () => {
                if (!token) {
                  Alert.alert('Login required', 'You must be logged in.');
                  setShowValidationModal(false);
                  return;
                }
                if (!poi?.current_contribution) return;
                try {
                  const vt = (validationType === 'valid' ? 'confirm' : 'dispute') as 'confirm' | 'dispute';
                  await postValidation(poi.current_contribution.id, { validation_type: vt });
                  setShowValidationModal(false);
                  setValidationType(null);
                  Alert.alert('Success', `${validationType === 'valid' ? 'Validation' : 'Report'} submitted.`);
                  // Immediately reflect that this user has validated: disable actions
                  setAlreadyValidated(true);
                  setPoi(prev => {
                    if (!prev?.current_contribution) return prev;
                    return {
                      ...prev,
                      current_contribution: {
                        ...prev.current_contribution,
                        can_validate: false,
                        validations: prev.current_contribution.validations ?? 0,
                        reports: prev.current_contribution.reports ?? 0,
                      },
                    } as any;
                  });
                  loadPoiDetails(true);
                } catch (e: any) {
                  // If backend says user already validated, reflect disabled UI
                  const msg = e?.response?.data?.error || '';
                  if (typeof msg === 'string' && (msg.includes('já validou') || msg.includes('validou esta contribuição'))) {
                    setAlreadyValidated(true);
                    setPoi(prev => {
                      if (!prev?.current_contribution) return prev;
                      return {
                        ...prev,
                        current_contribution: {
                          ...prev.current_contribution,
                          can_validate: false,
                        },
                      } as any;
                    });
                  }
                  Alert.alert('Error', `Failed to submit ${validationType}.`);
                }
              }}
            >
              <Text style={styles.validationModalButtonText}>
                {validationType === 'valid' ? 'Validate' : 'Report'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.validationModalCancelButton}
              onPress={() => {
                setShowValidationModal(false);
                setValidationType(null);
              }}
            >
              <Text style={styles.validationModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status Buttons (always visible except within TTL) */}
      {(!hasContribution || !isWithinTTL) && (
        <StatusButtons
          poiType={poiType === 'atm' ? 'atms' : 'gasstations'}
          onSelect={(s) => handleStatusClick(s)}
          containerStyle={styles.statusButtons}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#5856d6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  nameContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  poiName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  poiAddress: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  openMapsButton: {
    marginTop: 12,
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  openMapsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openMapsIcon: {
    fontSize: 16,
  },
  openMapsButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  imageContainer: {
    backgroundColor: '#d1d5db',
    height: 220,
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  noUpdatesLabel: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  updatedLabel: {
    color: '#ff9500',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  contentSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  previousContributionsTitle: {
    color: '#ff9500',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2c2c2e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  statsLabel: {
    color: '#999',
    fontSize: 14,
  },
  statsValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  timeRemainingContainer: {
    backgroundColor: '#6b7280',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeRemainingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recentlyUpdatedContainer: {
    backgroundColor: '#3a3a3c',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  recentlyUpdatedText: {
    color: '#ffcc00',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoGivenByText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  cannotValidateText: {
    color: '#ff9500',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  disabledButton: {
    opacity: 0.4,
  },
  validationButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  validationButtonWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  validationCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  validButton: {
    width: '100%',
    backgroundColor: '#34c759',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  validButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reportButton: {
    width: '100%',
    backgroundColor: '#ff3b30',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  validationModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#999',
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  validIcon: {
    backgroundColor: '#d4f4dd',
  },
  reportIcon: {
    backgroundColor: '#ffe5e5',
  },
  modalIconText: {
    fontSize: 24,
  },
  validationModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  validationModalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  validationModalButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  validateButton: {
    backgroundColor: '#007aff',
  },
  reportModalButton: {
    backgroundColor: '#ff3b30',
  },
  validationModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  validationModalCancelButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  validationModalCancelText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
