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
import { register } from '../services/auth';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { setToken } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const handleRegister = async () => {
    if (loading) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    // Reset errors
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setGeneralError('');

    // Basic validations
    if (!trimmedName) {
      setNameError('Nome é obrigatório');
      return;
    }
    if (!trimmedEmail) {
      setEmailError('Email é obrigatório');
      return;
    }
    const emailOk = /.+@.+\..+/.test(trimmedEmail);
    if (!emailOk) {
      setEmailError('Por favor, insira um endereço de email válido');
      return;
    }
    if (!trimmedPassword) {
      setPasswordError('Senha é obrigatória');
      return;
    }
    if (trimmedPassword.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const response = await register({ name: trimmedName, email: trimmedEmail, password: trimmedPassword });
      if (response.status === 'success' && response.token) {
        await setToken(response.token);
        navigation.navigate('Onboarding1');
      } else {
        setGeneralError(response.message || 'Falha no cadastro');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      if (status === 409) {
        setEmailError(serverMsg || 'Este email já está cadastrado');
      } else if (status === 400) {
        setGeneralError(serverMsg || 'Por favor, revise suas informações e tente novamente');
      } else if (status === 500) {
        setGeneralError('Algo deu errado no servidor. Tente novamente mais tarde');
      } else if (status) {
        setGeneralError(serverMsg || 'Falha na requisição');
      } else {
        setGeneralError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente');
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
          <Text style={styles.title}>Cadastrar</Text>
          <Text style={styles.subtitle}>Crie sua conta</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={[styles.input, nameError && styles.inputError]}
            placeholder="Nome completo"
            placeholderTextColor="#666"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNameError('');
            }}
            onBlur={() => setName(name.trim())}
            autoCapitalize="words"
            editable={!loading}
          />
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

          <TextInput
            style={[styles.input, emailError && styles.inputError]}
            placeholder="Email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
            }}
            onBlur={() => setEmail(email.trim())}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <TextInput
            style={[styles.input, passwordError && styles.inputError]}
            placeholder="Senha (mínimo 6 caracteres)"
            placeholderTextColor="#666"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
            }}
            onBlur={() => setPassword(password.trim())}
            secureTextEntry
            editable={!loading}
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          {generalError ? <Text style={styles.generalErrorText}>{generalError}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>Cadastrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={styles.linkText}>Já tem conta? Entrar</Text>
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
