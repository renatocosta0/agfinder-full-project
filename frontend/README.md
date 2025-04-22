# AGFinder

AGFinder is a React Native mobile application that helps users find ATMs and Gas Stations, and contribute to the community by updating their status.

## Features

- Find nearby ATMs and Gas Stations
- View status information (ATM cash/paper availability, Gas Station fuel types)
- Contribute status updates
- Validate or report existing status updates
- Premium subscription features
- User profile and points system

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Expo CLI
- Google account (for Google Sign-In)
- Google Maps API key

## Installation

1. Clone the repository
2. Install dependencies:

```bash
cd AGFinder
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with the following variables:

```
API_URL=http://your-backend-url.com/api
GOOGLE_CLIENT_ID=your-google-client-id
MAPS_API_KEY=your-maps-api-key
```

4. Update the `app.json` file with your Google Maps API key:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_API_KEY"
    }
  }
}
```

## Running the App

Start the development server:

```bash
npm start
# or
yarn start
```

This will open the Expo developer tools in your browser. From there, you can:

- Run on an Android/iOS simulator
- Run on a physical device by scanning the QR code with the Expo Go app
- Run on the web

## Building for Production

### Android

```bash
expo build:android
```

### iOS

```bash
expo build:ios
```

## Project Structure

```
src/
├── api/                 # API service calls
├── assets/              # Images, fonts, etc.
├── components/          # Reusable components
├── constants/           # App constants and configuration
├── context/             # Context providers
├── hooks/               # Custom hooks
├── navigation/          # Navigation configuration
├── screens/             # App screens
├── store/               # Redux store (optional)
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Configuração da Autenticação com Google

O aplicativo utiliza o login com Google para autenticação de usuários. Para configurar corretamente em todas as plataformas (iOS, Android e Web), siga os passos abaixo:

### 1. Crie um projeto no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou use um existente
3. Navegue até a seção "APIs & Services" > "Credentials"

### 2. Configure a tela de consentimento OAuth

1. Navegue até "OAuth consent screen"
2. Selecione o tipo de usuário (External ou Internal)
3. Preencha as informações necessárias (nome do app, email, domínios autorizados, etc.)
4. Adicione os escopos necessários (geralmente apenas `email` e `profile`)
5. Adicione usuários de teste se estiver em modo de desenvolvimento

### 3. Crie credenciais OAuth para cada plataforma

#### Para Web:

1. Crie um novo "OAuth Client ID"
2. Selecione "Web application"
3. Adicione URIs de redirecionamento:
   - `https://auth.expo.io/@seu-usuario/agfinder` (para desenvolvimento com Expo Go)
   - `https://seu-dominio.com/auth/callback` (para produção)

#### Para iOS:

1. Crie um novo "OAuth Client ID"
2. Selecione "iOS"
3. Forneça o Bundle ID: `com.agfinder`
4. Adicione o URI de redirecionamento: `com.agfinder:/oauth2redirect`

#### Para Android:

1. Crie um novo "OAuth Client ID"
2. Selecione "Android"
3. Forneça o package name: `com.agfinder`
4. Gere um certificado SHA-1 e forneça-o
   - Para desenvolvimento: `npx expo-dev-client generate-android-key`
   - Para produção: Use o keystore da sua build de produção

### 4. Configure o arquivo .env

Crie ou atualize o arquivo `.env` na raiz do projeto:

```
API_URL=http://your-backend-url.com/api
GOOGLE_CLIENT_ID=your-web-client-id
MAPS_API_KEY=your-maps-api-key
```

Para produção, é recomendável usar IDs específicos para cada plataforma:

```
GOOGLE_CLIENT_ID_WEB=your-web-client-id
GOOGLE_CLIENT_ID_ANDROID=your-android-client-id
GOOGLE_CLIENT_ID_IOS=your-ios-client-id
```

### 5. Configure o app.json

Atualize o arquivo `app.json`:

1. Para iOS, adicione o URL scheme correto:
   ```json
   "ios": {
     "bundleIdentifier": "com.agfinder",
     "infoPlist": {
       "CFBundleURLTypes": [
         {
           "CFBundleURLSchemes": [
             "com.googleusercontent.apps.YOUR-IOS-CLIENT-ID"
           ]
         }
       ]
     }
   }
   ```

2. Para Android, configure os intent filters:
   ```json
   "android": {
     "package": "com.agfinder",
     "intentFilters": [
       {
         "action": "VIEW",
         "autoVerify": true,
         "data": [
           {
             "scheme": "agfinder",
             "host": "auth"
           }
         ],
         "category": [
           "BROWSABLE",
           "DEFAULT"
         ]
       }
     ]
   }
   ```

3. Configure o scheme geral:
   ```json
   "scheme": "agfinder"
   ```

### 6. Teste a autenticação

Execute o aplicativo em todas as plataformas para garantir que a autenticação funcione corretamente:

```bash
npx expo run:ios
npx expo run:android
npx expo start:web
```

## Solução de problemas

### Problema de redirecionamento no iOS

Se você encontrar problemas com o redirecionamento no iOS, verifique se:
- O URL Scheme no app.json está correto
- O Client ID no .env está correto
- O URI de redirecionamento no Google Cloud Console corresponde ao seu Bundle ID

### Problema de redirecionamento no Android

Se você encontrar problemas com o redirecionamento no Android, verifique se:
- O SHA-1 está correto no Google Cloud Console
- O package name está consistente em todos os lugares
- O intent filter está configurado corretamente no app.json

### Problema na web

Se você encontrar problemas na web, verifique se:
- O domínio está autorizado no Google Cloud Console
- O URI de redirecionamento está correto
- O CORS está configurado corretamente no seu backend 