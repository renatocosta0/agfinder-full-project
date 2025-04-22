import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Platform, Alert, Linking } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/common/Button';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { 
  GOOGLE_CLIENT_ID_WEB, 
  GOOGLE_CLIENT_ID_ANDROID, 
  GOOGLE_CLIENT_ID_IOS,
  GOOGLE_EXPO_CLIENT_ID,
  API_URL
} from '@env';
import * as authApi from '../../api/auth';
import axios from 'axios';

// Finaliza sessões de autenticação do navegador em andamento
WebBrowser.maybeCompleteAuthSession();

/**
 * IMPORTANTE: Configuração do Google Sign-In
 * 
 * Para configurar corretamente:
 * 1. Crie um projeto no Google Cloud Console
 * 2. Configure o OAuth Consent Screen
 * 3. Crie credenciais OAuth com URIs de redirecionamento para cada plataforma:
 *    - Android: com.agfinder:/oauth2redirect
 *    - iOS: com.agfinder:/oauth2redirect
 *    - Web: https://auth.expo.io/@renatocosta0/agfinder
 *    
 * 4. Atualize o arquivo app.json com os esquemas de URL
 * 5. Adicione os IDs de cliente no arquivo .env
 */
const LoginScreen = () => {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  // Use o URI de redirecionamento para o Expo
  // IMPORTANTE: Este URI deve corresponder EXATAMENTE ao que você configurou no console Google Cloud
  const redirectUri = Platform.select({
    web: 'https://auth.expo.io/@renatocosta0/agfinder',
    ios: 'com.agfinder://',
    android: 'com.agfinder://',
    default: undefined,
  });
  
  // Verifica se o backend está funcionando
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        console.log('Verificando se o backend está online:', API_URL);
        await axios.get(`${API_URL}/health`);
        console.log('Backend está online!');
        setBackendStatus('online');
      } catch (error) {
        console.error('Backend parece estar offline ou não responde:', error);
        setBackendStatus('offline');
      }
    };
    
    checkBackendStatus();
  }, []);
  
  useEffect(() => {
    console.log('=== Configuração de Autenticação ===');
    console.log('Platform:', Platform.OS);
    console.log('Redirect URI:', redirectUri);
    console.log('API URL:', API_URL);
    
    // Informações adicionais para ajudar na depuração
    if (Platform.OS === 'web') {
      console.log('Web Client ID:', GOOGLE_CLIENT_ID_WEB);
    } else if (Platform.OS === 'ios') {
      console.log('iOS Client ID:', GOOGLE_CLIENT_ID_IOS);
    } else if (Platform.OS === 'android') {
      console.log('Android Client ID:', GOOGLE_CLIENT_ID_ANDROID);
    }
    
    console.log('Expo Client ID:', GOOGLE_EXPO_CLIENT_ID);
  }, []);

  // Configurar o provedor de autenticação do Google com mais opções de configuração
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: GOOGLE_EXPO_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID_WEB,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    redirectUri,
    // Adicionar scopes necessários
    scopes: ['profile', 'email'],
    // Evita erros de Cross-Origin-Opener-Policy
    usePKCE: true,
    responseType: Platform.OS === 'web' ? 'token' : 'code',
  });

  useEffect(() => {
    console.log('Auth Response:', response);
    
    // Tratar as diferentes possibilidades de resposta
    if (response?.type === 'success') {
      const { authentication } = response;
      console.log('Authentication Successful:', authentication);
      
      // Aqui você pode escolher entre enviar para o backend ou simular um login local
      if (backendStatus === 'online') {
        handleSignIn(authentication?.accessToken);
      } else {
        // Opção para desenvolvimento/teste quando o backend não está disponível
        simulateSignIn(authentication);
      }
    } else if (response?.type === 'error') {
      console.error('Auth Error Detail:', response.error);
      setIsLoading(false);
      
      // Exibir alerta detalhado para o erro de redirecionamento
      if (response.error?.message?.includes('redirect_uri_mismatch')) {
        Alert.alert(
          'Erro de Redirecionamento',
          `O URI de redirecionamento não corresponde ao autorizado no Google Cloud Console. Por favor, verifique as configurações.`,
          [{ text: 'OK' }]
        );
      } else if (response.error?.message?.includes('Something went wrong trying to finish signing in')) {
        Alert.alert(
          'Erro de Autenticação',
          'Ocorreu um erro ao finalizar o login. Isso pode ser causado por problemas de configuração no Google Cloud Console ou bloqueio de pop-ups no navegador.',
          [{ text: 'OK' }]
        );
      } else {
        setError(`Erro de autenticação: ${response.error?.message || 'Erro desconhecido'}`);
      }
    } else if (response?.type === 'dismiss') {
      // O usuário fechou a janela de autenticação sem completar
      console.log('Authentication dismissed by user');
      setIsLoading(false);
    }
  }, [response, backendStatus]);

  // Esta função simula um login local sem backend, útil para desenvolvimento
  const simulateSignIn = async (authentication: any) => {
    try {
      console.log('Simulando login sem backend usando token do Google');
      
      // Extrair dados do JWT (se for um token ID)
      // Ou fazer uma chamada para a API do Google para obter perfil
      const mockUser = {
        id: '12345',
        name: 'Usuário de Teste',
        email: 'teste@example.com',
        profilePicture: 'https://via.placeholder.com/150',
        bonusPoints: 0,
        hasActiveSubscription: false,
        warningCount: 0
      };
      
      // Simular um token JWT para o seu app
      const mockToken = authentication?.accessToken || 'mock-token-123456';
      
      // Chamar a função de login do contexto de autenticação
      await signIn(mockToken);
      
      Alert.alert(
        'Login simulado com sucesso',
        'O backend parece estar offline. Utilizamos um login simulado para desenvolvimento.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Erro ao simular login:', error);
      setError('Não foi possível simular o login.');
      setIsLoading(false);
    }
  };

  const handleSignIn = async (accessToken: string | undefined) => {
    if (!accessToken) {
      setError('Authentication failed. Please try again.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('Sending token to backend...');
      console.log('API URL:', API_URL);
      console.log('Token:', accessToken.substring(0, 10) + '...');
      
      const response = await authApi.googleSignIn(accessToken);
      console.log('Backend response:', response);
      await signIn(response.token);
    } catch (error: any) {
      console.error('Login error:', error);
      // Log detalhado do erro
      if (error.response) {
        // Erro de resposta do servidor
        console.error('Erro do servidor:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        // Erro de requisição sem resposta
        console.error('Erro de requisição (sem resposta):', error.request);
      } else {
        // Outro tipo de erro
        console.error('Erro desconhecido:', error.message);
      }
      
      const errorMessage = error?.response?.data?.message || error.message || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    console.log('Iniciando autenticação Google...');
    
    try {
      // Parâmetros diferentes com base na plataforma
      if (Platform.OS === 'web') {
        // Para web, usamos uma configuração mais simples para evitar problemas de COOP
        await promptAsync({ showInRecents: true });
      } else {
        // Para mobile, temos mais opções
        await promptAsync({ showInRecents: true });
      }
    } catch (err) {
      console.error('Erro ao iniciar autenticação:', err);
      setError('Não foi possível iniciar a autenticação. Tente novamente mais tarde.');
      setIsLoading(false);
    }
  };

  // Para casos em que o usuário encontra problemas, oferecemos uma alternativa
  const openGoogleLoginWeb = () => {
    const googleAuthUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      client_id: GOOGLE_CLIENT_ID_WEB,
      redirect_uri: 'https://auth.expo.io/@renatocosta0/agfinder',
      response_type: 'token',
      scope: 'profile email',
    };
    
    const queryString = Object.entries(options)
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
      .join('&');
      
    const authUrl = `${googleAuthUrl}?${queryString}`;
    
    // Abrir URL em navegador externo
    Linking.openURL(authUrl);
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image 
          source={require('../../../assets/icon.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.title}>AGFinder</Text>
        <Text style={styles.subtitle}>Find ATMs and Gas Stations</Text>
        
        {/* Indicador de status do backend */}
        <View style={styles.statusContainer}>
          <View 
            style={[
              styles.statusDot, 
              backendStatus === 'checking' ? styles.statusChecking : 
              backendStatus === 'online' ? styles.statusOnline : 
              styles.statusOffline
            ]} 
          />
          <Text style={styles.statusText}>
            Backend: {backendStatus === 'checking' ? 'Verificando...' : 
                      backendStatus === 'online' ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Sign in with Google"
          onPress={handleGoogleSignIn}
          loading={isLoading}
          style={styles.button}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        {/* Solução alternativa para problemas na web */}
        {Platform.OS === 'web' && (
          <Button
            title="Método alternativo de login"
            onPress={openGoogleLoginWeb}
            type="secondary"
            style={styles.altButton}
          />
        )}
        
        {/* Mensagem de ajuda */}
        <Text style={styles.helpText}>
          Se você estiver enfrentando problemas de login, por favor verifique:
          {'\n'}- Pop-ups não estão sendo bloqueados pelo navegador
          {'\n'}- Configurações de redirecionamento OAuth estão corretas
          {'\n'}- O servidor backend está acessível
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Layout.padding.large,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Layout.padding.xxl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: Layout.padding.medium,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: Layout.padding.small,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: Layout.padding.medium,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Layout.padding.small,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusChecking: {
    backgroundColor: Colors.warning,
  },
  statusOnline: {
    backgroundColor: Colors.success,
  },
  statusOffline: {
    backgroundColor: Colors.danger,
  },
  statusText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  button: {
    marginBottom: Layout.padding.medium,
  },
  altButton: {
    marginBottom: Layout.padding.medium,
  },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Layout.padding.medium,
  },
  helpText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Layout.padding.medium,
  }
});

export default LoginScreen; 