import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import HeroCarousel from '../components/HeroCarousel';
import { useAuth } from '../contexts/AuthContext';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { login } from '../services/auth';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { setToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Reset errors
    setEmailError('');
    setPasswordError('');
    setGeneralError('');

    // Validate
    if (!trimmedEmail) {
      setEmailError('Email é obrigatório');
      return;
    }
    if (!trimmedPassword) {
      setPasswordError('Senha é obrigatória');
      return;
    }

    setLoading(true);
    try {
      const response = await login({ email: trimmedEmail, password: trimmedPassword });
      if (response.status === 'success' && response.token) {
        await setToken(response.token);
        navigation.navigate('Onboarding1');
      } else {
        setGeneralError(response.message || 'Falha no login');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erro de rede. Tente novamente.';
      if (err.response?.status === 401) {
        setPasswordError('Email ou senha inválidos');
      } else {
        setGeneralError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.languageButton}>
            <Image
              source={require('../../assets/images/language.png')}
              style={styles.languageIcon}
              resizeMode="contain"
            />
            <Text style={styles.languageText}>Português</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Carousel */}
        <HeroCarousel />

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.subtitle}>Bem-vindo de volta!</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={[styles.input, emailError && styles.inputError]}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <TextInput
            style={[styles.input, passwordError && styles.inputError]}
            placeholder="Senha"
            placeholderTextColor="#666"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
            }}
            secureTextEntry
            editable={!loading}
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          {generalError ? <Text style={styles.generalErrorText}>{generalError}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          >
            <Text style={styles.linkText}>Não tem conta? Cadastre-se</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          Ao entrar ou cadastrar-se, você concorda com nossos Termos de Serviço{' \n'}e Política de Privacidade
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  logoImage: { width: 120, height: 40 },
  languageButton: { backgroundColor: '#1f1f1f', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  languageIcon: { width: 20, height: 20, marginRight: 6 },
  languageText: { color: '#fff', fontSize: 14 },
  titleContainer: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#999' },
  form: { marginBottom: 40 },
  input: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginBottom: 16,
  },
  generalErrorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#d1d1d1',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#fff', fontSize: 14 },
  terms: { textAlign: 'center', color: '#666', fontSize: 12, marginTop: 'auto' },
});
