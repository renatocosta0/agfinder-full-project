import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { me, User } from '../services/auth';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { setToken } = useAuth();
  const isWeb = Platform.OS === 'web';
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);

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

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await setToken(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{(user?.name?.[0] || 'U').toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name || 'Usuário'}</Text>
          <View style={styles.emailRow}>
            <Text style={styles.emailIcon}>✉</Text>
            <Text style={styles.email}>{user?.email || 'usuario@atmfinder.com'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() =>
            navigation.navigate('EditProfile', {
              name: user?.name,
              email: user?.email,
            })
          }
        >
          <Text style={styles.editIcon}>✎</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <View style={styles.menuContainer}>
        {!isWeb ? (
          <>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Payment')}
            >
              <View style={styles.menuLeft}>
                <View style={styles.iconContainer}>
                  <Text style={styles.menuIcon}>💳</Text>
                </View>
                <Text style={styles.menuText}>Pagamento</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />
          </>
        ) : null}

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => setShowLogoutModal(true)}
        >
          <View style={styles.menuLeft}>
            <View style={styles.iconContainer}>
              <Text style={styles.menuIcon}>🚪</Text>
            </View>
            <Text style={styles.menuText}>Sair</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sair</Text>
            <Text style={styles.modalMessage}>Tem certeza que deseja sair?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleLogout}
              >
                <Text style={styles.confirmButtonText}>Sim, sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5856d6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailIcon: {
    color: '#999',
    fontSize: 14,
    marginRight: 6,
  },
  email: {
    color: '#999',
    fontSize: 14,
  },
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIcon: {
    color: '#fff',
    fontSize: 20,
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  chevron: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    color: '#999',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2c2c2e',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#ff3b30',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
