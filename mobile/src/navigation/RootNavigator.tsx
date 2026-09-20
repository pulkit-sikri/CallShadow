import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { LandingScreen } from '../screens/LandingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { VoiceAnalysisScreen } from '../screens/VoiceAnalysisScreen';
import { RiskResultsScreen } from '../screens/RiskResultsScreen';
import { LiveCallScreen } from '../screens/LiveCallScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Landing"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="VoiceAnalysis" component={VoiceAnalysisScreen} />
        <Stack.Screen name="RiskResults" component={RiskResultsScreen} />
        <Stack.Screen name="LiveCall" component={LiveCallScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
