import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { PoiSelectionParamList } from '../types/navigation';
import { PoiTypeSelectionScreen, PoiListScreen } from '../screens';
import { Colors } from '../constants/colors';

const Stack = createStackNavigator<PoiSelectionParamList>();

const PoiSelectionNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="PoiTypeSelection"
        component={PoiTypeSelectionScreen}
        options={{ title: 'Selecionar Tipo' }}
      />
      <Stack.Screen
        name="PoiList"
        component={PoiListScreen}
        options={({ route }) => ({
          title: route.params.poiType === 'atm' ? 'Caixas Eletrônicos' : 'Postos de Gasolina',
        })}
      />
    </Stack.Navigator>
  );
};

export default PoiSelectionNavigator; 