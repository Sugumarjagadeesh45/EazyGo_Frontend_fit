/**
 * LoginPage - Strava OAuth Connection Screen
 * Handles deep link callback from Strava OAuth
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './navigation/types';
import { apiService } from './services/apiService';
import { useAuth } from './context/AuthContext';
import { parseDeepLink, DeepLinkResult } from './hooks/useDeepLink';

const { height } = Dimensions.get('window');

type LoginPageProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

const LoginPage: React.FC<LoginPageProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const { login, pendingDeepLink, clearPendingDeepLink } = useAuth();

  // Process deep link authentication
  const processAuthSuccess = useCallback(async (result: DeepLinkResult) => {
    console.log('🔐 [Login] Processing auth success...');

    const { params } = result;

    if (!params.athleteId || !params.token) {
      console.error('🔐 [Login] Missing required params:', params);
      Alert.alert(
        'Authentication Error',
        'Missing authentication data. Please try again.',
        [{ text: 'OK', onPress: () => setIsLoading(false) }]
      );
      return;
    }

    try {
      setIsLoading(true);
      setLoadingMessage('Processing authentication...');

      // Login using AuthContext
      await login(params.token, {
        athleteId: parseInt(params.athleteId, 10),
        firstName: params.firstName || '',
        lastName: params.lastName || '',
        profile: params.profile || '',
      });

      console.log('🔐 [Login] Auth data saved, fetching profile...');

      // Fetch and cache additional data in background
      const athleteId = parseInt(params.athleteId, 10);

      setLoadingMessage('Loading your profile...');
      try {
        const profileResponse = await apiService.getAthleteProfile(athleteId);
        if (profileResponse.success && profileResponse.data) {
          await apiService.cacheAthleteProfile(profileResponse.data);
          console.log('🔐 [Login] Profile cached');
        }
      } catch (error) {
        console.log('🔐 [Login] Profile fetch skipped:', error);
      }

      setLoadingMessage('Loading your statistics...');
      try {
        const statsResponse = await apiService.getAthleteStats(athleteId);
        if (statsResponse.success && statsResponse.data) {
          await apiService.cacheAthleteStats(statsResponse.data);
          console.log('🔐 [Login] Stats cached');
        }
      } catch (error) {
        console.log('🔐 [Login] Stats fetch skipped:', error);
      }

      setLoadingMessage('Loading your activities...');
      try {
        const activitiesResponse = await apiService.getAthleteActivities(athleteId, { limit: 20 });
        if (activitiesResponse.success && activitiesResponse.data) {
          await apiService.cacheAthleteActivities(activitiesResponse.data);
          console.log('🔐 [Login] Activities cached');
        }
      } catch (error) {
        console.log('🔐 [Login] Activities fetch skipped:', error);
      }

      // Success - navigate to main app
      setLoadingMessage(`Welcome, ${params.firstName || 'Athlete'}!`);
      console.log('🔐 [Login] Navigation to MainTabs...');

      // Small delay for UX
      setTimeout(() => {
        setIsLoading(false);
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }, 500);

    } catch (error: any) {
      console.error('🔐 [Login] Auth processing error:', error);
      Alert.alert(
        'Authentication Error',
        error.message || 'Failed to complete authentication. Please try again.',
        [{ text: 'OK', onPress: () => setIsLoading(false) }]
      );
    }
  }, [login, navigation]);

  // Process auth error
  const processAuthError = useCallback((result: DeepLinkResult) => {
    console.error('🔐 [Login] Auth error received:', result.params.error);
    setIsLoading(false);
    Alert.alert(
      'Authentication Failed',
      result.params.error || 'Authentication failed. Please try again.',
      [{ text: 'Try Again' }]
    );
  }, []);

  // Handle pending deep link from AuthContext
  useEffect(() => {
    if (pendingDeepLink) {
      console.log('🔐 [Login] Processing pending deep link:', pendingDeepLink.type);

      if (pendingDeepLink.type === 'auth-success') {
        processAuthSuccess(pendingDeepLink);
      } else if (pendingDeepLink.type === 'auth-error') {
        processAuthError(pendingDeepLink);
      }

      clearPendingDeepLink();
    }
  }, [pendingDeepLink, processAuthSuccess, processAuthError, clearPendingDeepLink]);

  // Also listen for deep links directly (backup)
  useEffect(() => {
    console.log('🔐 [Login] Setting up direct deep link listener...');

    const handleUrl = (event: { url: string }) => {
      console.log('🔐 [Login] Direct URL received:', event.url);
      const result = parseDeepLink(event.url);

      if (result.type === 'auth-success') {
        processAuthSuccess(result);
      } else if (result.type === 'auth-error') {
        processAuthError(result);
      }
    };

    // Check initial URL
    const checkInitialUrl = async () => {
      try {
        const url = await Linking.getInitialURL();
        console.log('🔐 [Login] Initial URL:', url);
        if (url && url.includes('auth-success')) {
          handleUrl({ url });
        }
      } catch (error) {
        console.error('🔐 [Login] Initial URL error:', error);
      }
    };

    checkInitialUrl();

    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription.remove();
    };
  }, [processAuthSuccess, processAuthError]);

  // Handle Strava Connect button press
  const handleStravaConnect = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Connecting to Strava...');

      const stravaAuthUrl = apiService.getStravaAuthUrl();
      console.log('🔐 [Login] Opening Strava Auth URL:', stravaAuthUrl);

      // Note: Don't use canOpenURL for http/https - it's unreliable on Android emulator
      // Just try to open the URL directly
      setLoadingMessage('Opening browser...');

      await Linking.openURL(stravaAuthUrl);
      console.log('🔐 [Login] Browser opened successfully');
      setLoadingMessage('Waiting for Strava authorization...');

      // Note: Loading will be stopped when deep link is received
      // or after timeout
      setTimeout(() => {
        if (isLoading) {
          console.log('🔐 [Login] Auth timeout - user may have cancelled');
        }
      }, 60000); // 1 minute timeout for logging

    } catch (error: any) {
      console.error('🔐 [Login] Strava connection error:', error);

      // More helpful error message
      let errorMessage = 'Failed to connect with Strava. Please try again.';
      if (error.message?.includes('No Activity found')) {
        errorMessage = 'No browser app found. Please install a browser to continue.';
      }

      Alert.alert(
        'Connection Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Cancel loading
  const handleCancelLoading = () => {
    setIsLoading(false);
    setLoadingMessage('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E3F2FD" />

      {/* Background Decoration */}
      <View style={styles.backgroundDecoration}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="run-fast" size={80} color="#1E88E5" />
          </View>
          <Text style={styles.appName}>IFit Club</Text>
          <Text style={styles.location}>Erode</Text>
        </View>

        {/* Bio Section */}
        <View style={styles.bioSection}>
          <Text style={styles.tagline}>Your Fitness Journey Starts Here</Text>
          <Text style={styles.bioText}>
            Track your runs, rides, and workouts with GPS precision.
            Connect with local athletes in Erode and challenge yourself
            to reach new fitness goals every day.
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="map-marker-path" size={24} color="#1E88E5" />
              <Text style={styles.featureText}>GPS Tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#1E88E5" />
              <Text style={styles.featureText}>Performance Stats</Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="account-group" size={24} color="#1E88E5" />
              <Text style={styles.featureText}>Local Community</Text>
            </View>
          </View>
        </View>

        {/* Strava Connect Button */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.stravaButton, isLoading && styles.stravaButtonDisabled]}
            onPress={handleStravaConnect}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </View>
            ) : (
              <>
                <View style={styles.stravaIconContainer}>
                  <MaterialCommunityIcons name="strava" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.stravaButtonText}>Connect with Strava</Text>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {isLoading && (
            <TouchableOpacity onPress={handleCancelLoading} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.disclaimerText}>
            By connecting, you agree to sync your Strava activities with IFit Club Erode
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Strava</Text>
          <View style={styles.footerDivider} />
          <Text style={styles.versionText}>v1.0.0</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  backgroundDecoration: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    top: -100,
    right: -100,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(33, 150, 243, 0.08)',
    bottom: 100,
    left: -50,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(33, 150, 243, 0.06)',
    top: height * 0.4,
    right: -30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 20,
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1565C0',
    letterSpacing: 1,
  },
  location: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1E88E5',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  bioSection: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1565C0',
    textAlign: 'center',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 15,
    color: '#546E7A',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    fontSize: 12,
    color: '#1565C0',
    marginTop: 6,
    fontWeight: '600',
  },
  buttonSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  stravaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FC4C02',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#FC4C02',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  stravaButtonDisabled: {
    backgroundColor: '#FF8A65',
  },
  stravaIconContainer: {
    marginRight: 12,
  },
  stravaButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    padding: 8,
  },
  cancelText: {
    fontSize: 14,
    color: '#78909C',
    fontWeight: '500',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#78909C',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#90A4AE',
  },
  footerDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#90A4AE',
    marginHorizontal: 10,
  },
  versionText: {
    fontSize: 12,
    color: '#90A4AE',
  },
});

export default LoginPage;
