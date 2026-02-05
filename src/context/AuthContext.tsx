/**
 * AuthContext
 * Global authentication state management with deep link handling
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDeepLink, DeepLinkResult, parseDeepLink } from '../hooks/useDeepLink';
import { Linking } from 'react-native';

interface AuthUser {
  athleteId: number;
  firstName: string;
  lastName: string;
  profile: string;
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  pendingDeepLink: DeepLinkResult | null;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  clearPendingDeepLink: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLinkResult | null>(null);

  // Check existing authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔐 [Auth] Checking existing authentication...');
      try {
        const [storedToken, storedAthleteId, storedIsLoggedIn] = await Promise.all([
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('athleteId'),
          AsyncStorage.getItem('isLoggedIn'),
        ]);

        console.log('🔐 [Auth] Stored auth:', {
          hasToken: !!storedToken,
          athleteId: storedAthleteId,
          isLoggedIn: storedIsLoggedIn,
        });

        if (storedIsLoggedIn === 'true' && storedToken && storedAthleteId) {
          // Try to get cached user data
          const cachedProfile = await AsyncStorage.getItem('athleteProfile');
          let userData: AuthUser | null = null;

          if (cachedProfile) {
            const profile = JSON.parse(cachedProfile);
            userData = {
              athleteId: parseInt(storedAthleteId, 10),
              firstName: profile.firstName || '',
              lastName: profile.lastName || '',
              profile: profile.profile || profile.profileMedium || '',
            };
          } else {
            userData = {
              athleteId: parseInt(storedAthleteId, 10),
              firstName: '',
              lastName: '',
              profile: '',
            };
          }

          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
          console.log('🔐 [Auth] User authenticated from storage');
        }
      } catch (error) {
        console.error('🔐 [Auth] Error checking auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Handle deep link callback - this is called from useDeepLink
  const handleDeepLink = useCallback((result: DeepLinkResult) => {
    console.log('🔐 [Auth] Deep link received in AuthContext:', result.type);

    if (result.type === 'auth-success') {
      // Store pending deep link for LoginPage to process
      setPendingDeepLink(result);
    } else if (result.type === 'auth-error') {
      setPendingDeepLink(result);
    }
  }, []);

  // Listen for deep links
  useDeepLink(handleDeepLink, true);

  // Also check for initial URL on mount (important for cold start)
  useEffect(() => {
    const checkInitialDeepLink = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log('🔐 [Auth] Initial URL on mount:', initialUrl);
        if (initialUrl && initialUrl.startsWith('ifitclub://')) {
          const result = parseDeepLink(initialUrl);
          if (result.type === 'auth-success' || result.type === 'auth-error') {
            console.log('🔐 [Auth] Setting pending deep link from initial URL');
            setPendingDeepLink(result);
          }
        }
      } catch (error) {
        console.error('🔐 [Auth] Error checking initial URL:', error);
      }
    };

    // Small delay to ensure app is ready
    setTimeout(checkInitialDeepLink, 100);
  }, []);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    console.log('🔐 [Auth] Logging in user:', newUser.athleteId);
    try {
      await Promise.all([
        AsyncStorage.setItem('authToken', newToken),
        AsyncStorage.setItem('athleteId', newUser.athleteId.toString()),
        AsyncStorage.setItem('isLoggedIn', 'true'),
        AsyncStorage.setItem('athleteProfile', JSON.stringify({
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          profile: newUser.profile,
        })),
      ]);

      setToken(newToken);
      setUser(newUser);
      setIsAuthenticated(true);
      console.log('🔐 [Auth] Login successful');
    } catch (error) {
      console.error('🔐 [Auth] Login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('🔐 [Auth] Logging out...');
    try {
      await AsyncStorage.multiRemove([
        'authToken',
        'athleteId',
        'isLoggedIn',
        'athleteProfile',
        'athleteStats',
        'athleteActivities',
      ]);

      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      console.log('🔐 [Auth] Logout successful');
    } catch (error) {
      console.error('🔐 [Auth] Logout error:', error);
      throw error;
    }
  }, []);

  const clearPendingDeepLink = useCallback(() => {
    console.log('🔐 [Auth] Clearing pending deep link');
    setPendingDeepLink(null);
  }, []);

  const value: AuthContextType = {
    isLoading,
    isAuthenticated,
    user,
    token,
    pendingDeepLink,
    login,
    logout,
    clearPendingDeepLink,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
