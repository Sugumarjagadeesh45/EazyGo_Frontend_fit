/**
 * IFIT Club Erode - Fitness Tracking App
 * A Strava-like personal fitness tracking app with Strava integration
 */

import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import 'react-native-get-random-values';

import TabNavigator from './src/navigation/TabNavigator';
import FitnessMapScreen from './src/FitnessMapScreen';
import LoginPage from './src/LoginPage';
import { RootStackParamList } from './src/navigation/types';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep linking configuration for React Navigation
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ifitclub://'],
  config: {
    screens: {
      Login: {
        path: 'auth-success',
      },
      MainTabs: 'home',
      FitnessMap: 'map',
    },
  },
};

// Loading screen component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#1E88E5" />
  </View>
);

// Main navigation component that uses auth state
const AppNavigator = () => {
  const { isLoading, isAuthenticated } = useAuth();

  console.log('📱 [App] Rendering navigator:', { isLoading, isAuthenticated });

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? 'MainTabs' : 'Login'}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginPage}
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="FitnessMap"
        component={FitnessMapScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};

export default function App() {
  console.log('📱 [App] App mounting...');

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer
          linking={linking}
          onStateChange={(state) => {
            console.log('📱 [App] Navigation state changed:', state?.routes[state.index]?.name);
          }}
        >
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
  },
});
