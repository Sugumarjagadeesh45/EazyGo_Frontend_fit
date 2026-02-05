/**
 * useStravaAppLink Hook
 *
 * Handles opening the Strava mobile application using deep linking.
 * Provides fallback to app store or web browser if Strava is not installed.
 *
 * Flow:
 * 1. Attempt to open Strava app via URL scheme
 * 2. If Strava not installed, redirect to platform-specific app store
 * 3. If app store fails, open store URL in default web browser
 */

import { useCallback, useState } from 'react';
import { Linking, Platform, Alert } from 'react-native';

// Strava URL schemes and store links
const STRAVA_CONFIG = {
  // Strava app URL scheme - opens the Strava app
  appScheme: 'strava://',

  // Store URLs for downloading Strava
  stores: {
    android: 'https://play.google.com/store/apps/details?id=com.strava&pcampaignid=web_share',
    ios: 'https://apps.apple.com/us/app/strava-run-bike-walk/id426826309',
  },
} as const;

export interface StravaLinkState {
  isLoading: boolean;
  error: string | null;
  lastAttempt: 'app' | 'store' | 'browser' | null;
}

export interface StravaLinkResult {
  success: boolean;
  method: 'app' | 'store' | 'browser';
  error?: string;
}

export interface UseStravaAppLinkReturn {
  openStrava: () => Promise<StravaLinkResult>;
  openStravaStore: () => Promise<StravaLinkResult>;
  state: StravaLinkState;
  resetState: () => void;
}

/**
 * Get the appropriate store URL based on the current platform
 */
const getStoreUrl = (): string => {
  return Platform.OS === 'ios' ? STRAVA_CONFIG.stores.ios : STRAVA_CONFIG.stores.android;
};

/**
 * Custom hook for opening Strava app with automatic fallback
 *
 * @returns Object containing openStrava function and current state
 *
 * @example
 * ```tsx
 * const { openStrava, state } = useStravaAppLink();
 *
 * const handlePress = async () => {
 *   const result = await openStrava();
 *   if (result.success) {
 *     console.log(`Opened via: ${result.method}`);
 *   }
 * };
 * ```
 */
export const useStravaAppLink = (): UseStravaAppLinkReturn => {
  const [state, setState] = useState<StravaLinkState>({
    isLoading: false,
    error: null,
    lastAttempt: null,
  });

  /**
   * Reset the hook state
   */
  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      lastAttempt: null,
    });
  }, []);

  /**
   * Attempt to open a URL using React Native Linking
   */
  const tryOpenUrl = useCallback(async (url: string): Promise<boolean> => {
    try {
      // Check if the URL can be opened
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
        return true;
      }

      return false;
    } catch (error) {
      console.warn(`[StravaLink] Failed to open URL: ${url}`, error);
      return false;
    }
  }, []);

  /**
   * Open the platform-specific app store
   */
  const openStravaStore = useCallback(async (): Promise<StravaLinkResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const storeUrl = getStoreUrl();

    try {
      // Try to open the app store
      const storeOpened = await tryOpenUrl(storeUrl);

      if (storeOpened) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastAttempt: 'store',
        }));
        return { success: true, method: 'store' };
      }

      // Fallback: Open in web browser
      await Linking.openURL(storeUrl);

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastAttempt: 'browser',
      }));

      return { success: true, method: 'browser' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open store';

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        lastAttempt: 'browser',
      }));

      return { success: false, method: 'browser', error: errorMessage };
    }
  }, [tryOpenUrl]);

  /**
   * Open Strava app with automatic fallback to app store
   */
  const openStrava = useCallback(async (): Promise<StravaLinkResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Step 1: Try to open Strava app directly
      const appOpened = await tryOpenUrl(STRAVA_CONFIG.appScheme);

      if (appOpened) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastAttempt: 'app',
        }));
        return { success: true, method: 'app' };
      }

      // Step 2: Strava not installed - redirect to app store
      console.log('[StravaLink] Strava app not installed, opening store...');

      const storeUrl = getStoreUrl();
      const storeOpened = await tryOpenUrl(storeUrl);

      if (storeOpened) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastAttempt: 'store',
        }));
        return { success: true, method: 'store' };
      }

      // Step 3: Fallback - open store URL in web browser
      console.log('[StravaLink] Store app not available, opening in browser...');

      await Linking.openURL(storeUrl);

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastAttempt: 'browser',
      }));

      return { success: true, method: 'browser' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      console.error('[StravaLink] Error opening Strava:', error);

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      // Show user-friendly error alert
      Alert.alert(
        'Unable to Open Strava',
        'We could not open Strava or the app store. Please try again later.',
        [{ text: 'OK' }]
      );

      return { success: false, method: 'browser', error: errorMessage };
    }
  }, [tryOpenUrl]);

  return {
    openStrava,
    openStravaStore,
    state,
    resetState,
  };
};

export default useStravaAppLink;
