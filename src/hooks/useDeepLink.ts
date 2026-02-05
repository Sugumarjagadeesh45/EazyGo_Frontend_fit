/**
 * useDeepLink Hook
 * Handles deep link detection and parsing for Strava OAuth callback
 */

import { useEffect, useCallback, useRef } from 'react';
import { Linking } from 'react-native';

export interface DeepLinkParams {
  athleteId: string | null;
  token: string | null;
  firstName: string | null;
  lastName: string | null;
  profile: string | null;
  error: string | null;
}

export interface DeepLinkResult {
  type: 'auth-success' | 'auth-error' | 'unknown' | null;
  params: DeepLinkParams;
  rawUrl: string | null;
}

/**
 * Parse deep link URL and extract parameters
 */
export const parseDeepLink = (url: string | null): DeepLinkResult => {
  console.log('🔗 [DeepLink] Parsing URL:', url);

  if (!url) {
    return {
      type: null,
      params: {
        athleteId: null,
        token: null,
        firstName: null,
        lastName: null,
        profile: null,
        error: null,
      },
      rawUrl: null,
    };
  }

  try {
    // Check if it's our app's deep link
    if (!url.startsWith('ifitclub://')) {
      console.log('🔗 [DeepLink] Not an ifitclub:// URL, ignoring');
      return {
        type: 'unknown',
        params: {
          athleteId: null,
          token: null,
          firstName: null,
          lastName: null,
          profile: null,
          error: null,
        },
        rawUrl: url,
      };
    }

    // Determine the type based on host
    let type: 'auth-success' | 'auth-error' | 'unknown' = 'unknown';
    if (url.includes('auth-success')) {
      type = 'auth-success';
    } else if (url.includes('auth-error')) {
      type = 'auth-error';
    }

    console.log('🔗 [DeepLink] Type detected:', type);

    // Parse query parameters
    const queryString = url.split('?')[1];
    const params: DeepLinkParams = {
      athleteId: null,
      token: null,
      firstName: null,
      lastName: null,
      profile: null,
      error: null,
    };

    if (queryString) {
      const urlParams = new URLSearchParams(queryString);
      params.athleteId = urlParams.get('athleteId');
      params.token = urlParams.get('token');
      params.firstName = urlParams.get('firstName');
      params.lastName = urlParams.get('lastName');
      params.profile = urlParams.get('profile') ? decodeURIComponent(urlParams.get('profile')!) : null;
      params.error = urlParams.get('error') ? decodeURIComponent(urlParams.get('error')!) : null;

      console.log('🔗 [DeepLink] Parsed params:', {
        athleteId: params.athleteId,
        token: params.token ? '***received***' : null,
        firstName: params.firstName,
        lastName: params.lastName,
        profile: params.profile ? '***received***' : null,
        error: params.error,
      });
    }

    return { type, params, rawUrl: url };
  } catch (error) {
    console.error('🔗 [DeepLink] Error parsing URL:', error);
    return {
      type: 'unknown',
      params: {
        athleteId: null,
        token: null,
        firstName: null,
        lastName: null,
        profile: null,
        error: null,
      },
      rawUrl: url,
    };
  }
};

/**
 * Hook to listen for deep links
 */
export const useDeepLink = (
  onDeepLink: (result: DeepLinkResult) => void,
  enabled: boolean = true
) => {
  const callbackRef = useRef(onDeepLink);
  const processedUrls = useRef<Set<string>>(new Set());

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onDeepLink;
  }, [onDeepLink]);

  const handleUrl = useCallback((url: string | null) => {
    if (!url || !enabled) return;

    // Prevent processing the same URL twice
    if (processedUrls.current.has(url)) {
      console.log('🔗 [DeepLink] URL already processed, skipping:', url);
      return;
    }

    console.log('🔗 [DeepLink] Processing URL:', url);
    processedUrls.current.add(url);

    const result = parseDeepLink(url);
    if (result.type && result.type !== 'unknown') {
      callbackRef.current(result);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      console.log('🔗 [DeepLink] Hook disabled');
      return;
    }

    console.log('🔗 [DeepLink] Setting up listeners...');

    // Check for initial URL (app opened via deep link - cold start)
    const checkInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log('🔗 [DeepLink] Initial URL check:', initialUrl);
        if (initialUrl) {
          handleUrl(initialUrl);
        }
      } catch (error) {
        console.error('🔗 [DeepLink] Error getting initial URL:', error);
      }
    };

    checkInitialUrl();

    // Listen for deep links while app is running (warm start)
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 [DeepLink] URL event received:', event.url);
      handleUrl(event.url);
    });

    return () => {
      console.log('🔗 [DeepLink] Cleaning up listeners');
      subscription.remove();
    };
  }, [enabled, handleUrl]);

  // Clear processed URLs when disabled
  useEffect(() => {
    if (!enabled) {
      processedUrls.current.clear();
    }
  }, [enabled]);
};

export default useDeepLink;
