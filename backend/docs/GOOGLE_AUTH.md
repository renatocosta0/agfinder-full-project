# Implementação de Autenticação Google

Este documento descreve como implementar a autenticação com Google em diferentes plataformas para o aplicativo AGFinder.

## Visão Geral

AGFinder suporta login com Google em várias plataformas:
- Web
- Android
- iOS
- Expo (que pode ser usado tanto no Android quanto no iOS)

## Configuração do Servidor

O backend está configurado para aceitar tokens do Google de diferentes plataformas. Ao enviar uma solicitação de autenticação, você deve especificar a plataforma junto com o token.

### Credenciais configuradas

```
GOOGLE_CLIENT_ID_WEB=918990827278-154icpdfd1dr1h3sp698cgq9g6999vcm.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=918990827278-of2casvfof0n5imldg950sne02guu9d2.apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=918990827278-of2casvfof0n5imldg950sne02guu9d2.apps.googleusercontent.com
GOOGLE_EXPO_CLIENT_ID=https://auth.expo.io/@renatocosta0/agfinder
```

## Implementações por Plataforma

### Web

1. Instale a biblioteca Google Identity:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

2. Configure o botão de login:
```html
<div id="g_id_onload"
     data-client_id="918990827278-154icpdfd1dr1h3sp698cgq9g6999vcm.apps.googleusercontent.com"
     data-callback="handleCredentialResponse">
</div>
<div class="g_id_signin" data-type="standard"></div>
```

3. Implemente o callback para enviar o token para o backend:
```javascript
function handleCredentialResponse(response) {
  fetch('/api/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: response.credential,
      platform: 'web'
    })
  })
  .then(response => response.json())
  .then(data => {
    // Armazenar o token JWT e informações do usuário
    localStorage.setItem('token', data.data.token);
    // Redirecionar ou atualizar a UI
  });
}
```

### Android (React Native)

1. Instale a biblioteca necessária:
```bash
npm install @react-native-google-signin/google-signin
```

2. Configure a biblioteca:
```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure as credenciais
GoogleSignin.configure({
  webClientId: '918990827278-154icpdfd1dr1h3sp698cgq9g6999vcm.apps.googleusercontent.com', // necessário para obter email, profile, etc.
  androidClientId: '918990827278-of2casvfof0n5imldg950sne02guu9d2.apps.googleusercontent.com',
  offlineAccess: true,
});
```

3. Implemente a função de login:
```javascript
const signIn = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    
    // Envie o token para o backend
    const response = await fetch('https://seu-api.com/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: userInfo.idToken,
        platform: 'android'
      })
    });
    
    const data = await response.json();
    // Armazenar o token JWT
  } catch (error) {
    console.error(error);
  }
};
```

### iOS (React Native)

1. Instale a biblioteca necessária (mesma do Android):
```bash
npm install @react-native-google-signin/google-signin
```

2. Configure a biblioteca:
```javascript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure as credenciais
GoogleSignin.configure({
  webClientId: '918990827278-154icpdfd1dr1h3sp698cgq9g6999vcm.apps.googleusercontent.com',
  iosClientId: '918990827278-of2casvfof0n5imldg950sne02guu9d2.apps.googleusercontent.com',
  offlineAccess: true,
});
```

3. O resto da implementação é igual ao Android.

### Expo

1. Instale as bibliotecas necessárias:
```bash
expo install expo-auth-session expo-random
```

2. Configure a autenticação:
```javascript
import * as AuthSession from 'expo-auth-session';
import * as Random from 'expo-random';

const useGoogleAuth = () => {
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.select({
        ios: '918990827278-of2casvfof0n5imldg950sne02guu9d2.apps.googleusercontent.com',
        android: '918990827278-of2casvfof0n5imldg950sne02guu9d2.apps.googleusercontent.com',
        web: '918990827278-154icpdfd1dr1h3sp698cgq9g6999vcm.apps.googleusercontent.com',
      }),
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'agfinder'
      }),
      scopes: ['profile', 'email'],
    },
    discovery
  );

  return {
    request,
    response,
    promptAsync,
  };
};
```

3. Implemente a função de login:
```javascript
const { promptAsync, response } = useGoogleAuth();

// Quando o botão de login é pressionado
const handleGoogleLogin = async () => {
  const result = await promptAsync();
  if (result.type === 'success') {
    const { id_token } = result.params;
    
    // Envie o token para o backend
    const backendResponse = await fetch('https://seu-api.com/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: id_token,
        platform: 'expo'
      })
    });
    
    const data = await backendResponse.json();
    // Armazenar o token JWT
  }
};
```

## Configuração no Console de Desenvolvedor Google

Para cada plataforma, você deve configurar o projeto no [Console de Desenvolvedor Google](https://console.developers.google.com/):

1. Crie um projeto (se ainda não tiver um)
2. Configure as Credenciais OAuth 2.0
3. Adicione os URIs de redirecionamento autorizados:
   - Para Web: `http://localhost:3000`, `https://seudominio.com`
   - Para Expo: `https://auth.expo.io/@renatocosta0/agfinder`
4. Adicione os tipos de aplicativos:
   - Web
   - Android (adicione a impressão digital SHA-1)
   - iOS (adicione o ID do pacote)

## Testando

Após implementar a autenticação, você pode testá-la:

1. Web: Abra o aplicativo no navegador e tente fazer login
2. Android/iOS: Use um dispositivo real ou emulador
3. Expo: Use o aplicativo Expo Go ou uma build standalone

## Solução de Problemas

- **Erro "Invalid token"**: Verifique se está enviando o `platform` correto junto com o token
- **Erro em dispositivos iOS**: Verifique se o ID do pacote está configurado corretamente
- **Erro em dispositivos Android**: Verifique a configuração SHA-1
- **Erro no Expo**: Verifique se o URI de redirecionamento está configurado corretamente 