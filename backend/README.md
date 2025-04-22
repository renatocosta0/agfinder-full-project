# AGFinder

AGFinder is a mobile application that helps users find ATMs and Gas Stations with real-time information about their availability. The app relies on community contributions to keep information up-to-date and includes a validation system for ensuring information reliability.

## Features

- **Google Authentication**: Sign in with your Google account to access all features
- **Location-based Discovery**: Find ATMs and Gas Stations near your current location
- **Real-time Status Updates**: Get up-to-date information about money and paper availability at ATMs, and fuel availability at Gas Stations
- **Community Contributions**: Contribute status updates about ATMs and Gas Stations you visit
- **Validation System**: Validate or report contributions from other users to ensure information accuracy
- **Subscription Model**: Premium features are available through daily, weekly, or monthly subscriptions
- **Bonus System**: Earn bonus points by contributing accurate information, redeemable for free subscription days

## Technology Stack

- **Frontend**: React Native with TypeScript, Expo
- **State Management**: React Context API (with optional Redux implementation)
- **Navigation**: React Navigation
- **UI Components**: Custom components with React Native Paper
- **Maps**: Google Maps API
- **Authentication**: Google Sign-In
- **Payment**: ProxyPay integration for Multicaixa payments

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Google Cloud Platform account (for Google Sign-In and Maps API)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/agfinder.git
   cd agfinder
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   API_URL=http://your-backend-url.com/api
   GOOGLE_CLIENT_ID=your-google-client-id
   MAPS_API_KEY=your-google-maps-api-key
   ```

4. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

5. Open the app in Expo Go on your device or use an emulator.

## Project Structure

The project follows a modular structure:

- `src/api/`: API service calls to the backend
- `src/components/`: Reusable UI components
- `src/constants/`: App constants and configuration
- `src/context/`: React Context providers
- `src/hooks/`: Custom React hooks
- `src/navigation/`: Navigation configuration
- `src/screens/`: Application screens
- `src/store/`: Redux store configuration (optional)
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions

## Key Workflows

### Authentication Flow

1. User opens the app
2. If not authenticated, the Login screen is displayed
3. User signs in with Google
4. On successful authentication, user is redirected to the Home screen

### POI Browsing Flow

1. User taps "View" on the Home screen
2. User selects either "ATMs" or "Gas Stations"
3. A list of nearby POIs is displayed, sorted by distance by default
4. User can filter and sort the list as needed
5. Tapping on a POI opens its details

### Contribution Flow

1. User views a POI's details
2. If no current update exists, or if the current update has expired, user can contribute
3. User selects the current status of the POI
4. User submits the contribution
5. Contribution becomes visible to other users

### Validation Flow

1. User views a POI with an active contribution
2. User can validate or report the contribution
3. Validation/report is recorded and affects the contribution's credibility
4. User cannot validate or report again for the same contribution

### Subscription Flow

1. User navigates to the Subscription screen
2. User selects a subscription plan (daily, weekly, or monthly)
3. User initiates payment via Multicaixa reference
4. Once payment is confirmed, subscription is activated

## Backend Integration

The app is designed to work with the AGFinder backend API. The API endpoints are organized as follows:

- `/api/auth/*`: Authentication endpoints
- `/api/pois/*`: Points of Interest endpoints
- `/api/contributions/*`: Contribution endpoints
- `/api/validations/*`: Validation endpoints
- `/api/subscriptions/*`: Subscription endpoints
- `/api/payments/*`: Payment endpoints
- `/api/users/*`: User endpoints

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Expo](https://expo.dev/) - React Native framework
- [React Navigation](https://reactnavigation.org/) - Navigation library
- [React Native Paper](https://callstack.github.io/react-native-paper/) - Material Design components
- [Google Maps](https://developers.google.com/maps) - Maps API
- [ProxyPay](https://proxypay.co.ao/) - Payment processing

# AGFINDER Backend

Backend API for the AGFINDER application. This service allows users to find and contribute information about ATMs and gas stations.

## Features

- Google OAuth authentication
- Points of interest (ATMs and gas stations)
- User contributions and validations
- Bonus points system
- Subscription management via ProxyPay
- Daily status resets

## Tech Stack

- Node.js with Express
- PostgreSQL (with PostGIS extension)
- Redis for caching
- Docker and Docker Compose
- JWT for API authentication
- Google OAuth for user authentication
- ProxyPay integration for payments

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agfinder.git
cd agfinder
```

2. Create a `.env` file based on the example:
```bash
cp .env.example .env
```

3. Fill in the required environment variables in the `.env` file.

4. Start the development environment with Docker:
```bash
docker-compose up -d
```

5. For local development without Docker:
```bash
npm install
npm run dev
```

## API Documentation

API documentation is available at `/api-docs` when the server is running.

## Testing

Run tests with:
```bash
npm test
```

## License

[MIT](LICENSE)

# AGFinder

Aplicativo para encontrar ATMs e postos de gasolina, com contribuições em tempo real dos usuários.

## Funcionalidades

- Mapa com ATMs e postos de gasolina próximos
- Contribuições e validações dos usuários sobre o status dos locais
- Sistema de pontos e recompensas
- Assinaturas para acesso premium

## Configuração

### Requisitos

- Node.js 14+
- PostgreSQL 12+
- Conta Google Maps API

### Configuração do Google Maps API

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto (ou selecione um existente)
3. Ative as seguintes APIs:
   - Places API
   - Maps JavaScript API
   - Geocoding API
4. Crie uma chave de API com as seguintes restrições:
   - Restrição de APIs: Places API, Maps JavaScript API, Geocoding API
   - Restrição de aplicação: HTTP (para o backend) e/ou referentes (para o frontend)

### Configuração do ambiente

1. Clone o repositório:
   ```
   git clone https://github.com/seu-usuario/agfinder.git
   cd agfinder
   ```

2. Instale as dependências:
   ```
   npm install
   ```

3. Copie o arquivo `.env.example` para `.env` e configure as variáveis:
   ```
   cp .env.example .env
   ```

4. Configure as variáveis de ambiente, especialmente:
   - Configurações do banco de dados PostgreSQL
   - GOOGLE_MAPS_API_KEY com a chave criada anteriormente
   - Configurações da API de pagamento (ProxyPay)

5. Execute as migrações do banco de dados:
   ```
   npx sequelize-cli db:migrate
   ```

6. Execute as seeds iniciais (opcional):
   ```
   npx sequelize-cli db:seed:all
   ```

7. Inicie o servidor:
   ```
   npm start
   ```

## Sincronização de dados do Google Maps

### Sincronização manual

Para sincronizar manualmente os dados de ATMs e postos de gasolina do Google Maps:

```
node src/scripts/syncGoogleMapsPOIs.js --city=luanda --radius=20 --type=all
```

Parâmetros:
- `--city`: Nome da cidade (luanda, benguela, lubango, huambo, lobito)
- `--radius`: Raio em km (máximo 50)
- `--type`: Tipo de POI (atm, gasstation, all)

### Sincronização automática

Configure um cron job para executar sincronizações periódicas:

```
# Exemplo de crontab - sincronizar todos os dias às 3:00 da manhã
0 3 * * * cd /path/to/agfinder && node src/scripts/syncGoogleMapsPOIs.js --city=luanda --radius=20 --type=all >> /var/log/agfinder-sync.log 2>&1
```

## Endpoints da API

### POIs (Points of Interest)

- **GET /api/pois**: Obter POIs próximos
  - Parâmetros: lat, lng, radius, type, orderBy, page, limit, forceRefresh
  
- **GET /api/pois/:id**: Obter detalhes de um POI
  - Parâmetros: id, refresh
  
- **GET /api/pois/:id/contributions/history**: Obter histórico de contribuições para um POI
  - Parâmetros: id, page, limit, sortBy

### Contribuições

- **POST /api/pois/:id/contributions**: Adicionar uma contribuição
- **GET /api/pois/:id/contributions/current**: Obter contribuição atual

### Assinaturas

- **GET /api/subscriptions/plans**: Obter planos de assinatura
- **POST /api/subscriptions**: Criar solicitação de pagamento de assinatura
- **GET /api/subscriptions/status/:reference**: Verificar status de pagamento
- **GET /api/subscriptions/transactions**: Obter transações de assinatura com paginação

### Autenticação

- **POST /api/auth/login**: Login de usuário
- **POST /api/auth/register**: Registro de usuário
- **POST /api/auth/refresh-token**: Renovar token de acesso
- **POST /api/auth/logout**: Logout de usuário
- **GET /api/auth/google**: Iniciar autenticação Google OAuth
- **GET /api/auth/google/callback**: Callback para autenticação Google OAuth

### Usuários

- **GET /api/users/me**: Obter informações do usuário autenticado
- **PATCH /api/users/me**: Atualizar informações do usuário autenticado
- **GET /api/users/:id**: Obter informações de um usuário (admin)
- **PATCH /api/users/:id**: Atualizar informações de um usuário (admin)
- **DELETE /api/users/:id**: Deletar um usuário (admin)

### Bônus

- **GET /api/bonus**: Obter status de bônus do usuário atual
- **GET /api/bonus/history**: Obter histórico de bônus
  - Parâmetros: userId, status, startDate, endDate, sortBy, limit, page
- **POST /api/bonus/admin/distribute**: Distribuir bônus para usuários (admin)
- **POST /api/bonus/admin/update**: Atualizar bônus de um usuário (admin)
- **POST /api/bonus/admin/cleanup**: Limpar registros antigos de bônus (admin)

### Avisos ao Usuário

- **GET /api/warnings/user/:userId**: Obter avisos para um usuário
- **POST /api/warnings**: Criar um aviso para um usuário (admin)
- **PATCH /api/warnings/:id**: Atualizar um aviso (admin)
- **DELETE /api/warnings/:id**: Deletar um aviso (admin)

### Pagamentos

- **POST /api/payments**: Criar um novo pagamento
  - Corpo: amount, currency, description, method, metadata
- **GET /api/payments**: Obter lista de pagamentos do usuário atual
  - Parâmetros: userId (admin), status, sortBy, limit, page
- **GET /api/payments/:reference**: Obter detalhes de um pagamento
- **GET /api/payments/:reference/verify**: Verificar status de um pagamento

### Webhooks

- **POST /api/webhooks/proxypay**: Receber notificações do ProxyPay

## Implementação no Frontend

### Exemplo React

```jsx
import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const MapComponent = () => {
  const [pois, setPois] = useState([]);
  const [selectedType, setSelectedType] = useState('atm');
  const [center, setCenter] = useState({ lat: -8.838333, lng: 13.234444 }); // Luanda
  
  useEffect(() => {
    // Obter localização do usuário
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        console.error("Erro ao obter localização:", error);
      }
    );
  }, []);
  
  useEffect(() => {
    if (center) {
      fetchPOIs();
    }
  }, [center, selectedType]);
  
  const fetchPOIs = async () => {
    try {
      const response = await fetch(
        `/api/pois?lat=${center.lat}&lng=${center.lng}&radius=5&type=${selectedType}`
      );
      const data = await response.json();
      
      if (data.status === 'success') {
        setPois(data.data.pois);
      }
    } catch (error) {
      console.error("Erro ao buscar POIs:", error);
    }
  };
  
  return (
    <div className="map-container">
      <div className="type-selector">
        <button 
          className={selectedType === 'atm' ? 'active' : ''} 
          onClick={() => setSelectedType('atm')}
        >
          Caixas Eletrônicos
        </button>
        <button 
          className={selectedType === 'gasstation' ? 'active' : ''} 
          onClick={() => setSelectedType('gasstation')}
        >
          Postos de Gasolina
        </button>
      </div>
      
      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '500px' }}
          center={center}
          zoom={14}
        >
          {pois.map(poi => (
            <Marker
              key={poi.id}
              position={{ lat: parseFloat(poi.latitude), lng: parseFloat(poi.longitude) }}
              title={poi.name}
              onClick={() => window.location.href = `/pois/${poi.id}`}
              icon={selectedType === 'atm' 
                ? '/icons/atm-marker.png' 
                : '/icons/gas-marker.png'
              }
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default MapComponent;
```

## Licença

MIT 

## Autenticação com Google

O AGFinder suporta autenticação com Google em múltiplas plataformas:
- Web
- Android
- iOS 
- Expo

As credenciais foram configuradas para todas as plataformas. Para mais detalhes sobre a implementação, consulte a [Documentação de Autenticação Google](docs/GOOGLE_AUTH.md). 