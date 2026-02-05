/**
 * useAthleteData Hook
 *
 * Fetches and manages athlete data from the backend API.
 * Includes profile, stats, and activities with caching support.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiService, Athlete, AthleteStats, Activity } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

export interface AthleteData {
  profile: Athlete | null;
  stats: AthleteStats | null;
  activities: Activity[];
}

export interface UseAthleteDataReturn {
  data: AthleteData;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  syncFromStrava: () => Promise<void>;
}

// Helper functions for formatting
export const formatDistance = (meters: number): string => {
  const km = meters / 1000;
  return km.toFixed(2);
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatPace = (speedMps: number): string => {
  if (!speedMps || speedMps === 0) return '--:--';
  const paceMinPerKm = 1000 / (speedMps * 60);
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const getActivityIcon = (type: string): string => {
  const typeMap: Record<string, string> = {
    Run: 'run',
    Ride: 'bike',
    Walk: 'walk',
    Swim: 'swim',
    Hike: 'hiking',
    WeightTraining: 'weight-lifter',
    Workout: 'dumbbell',
    Yoga: 'yoga',
  };
  return typeMap[type] || 'run';
};

export const getActivityColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    Run: '#FF5722',
    Ride: '#4285F4',
    Walk: '#4CAF50',
    Swim: '#00BCD4',
    Hike: '#8BC34A',
    WeightTraining: '#9C27B0',
    Workout: '#FF9800',
    Yoga: '#E91E63',
  };
  return colorMap[type] || '#4285F4';
};

export const useAthleteData = (): UseAthleteDataReturn => {
  const { user, isAuthenticated } = useAuth();
  const [data, setData] = useState<AthleteData>({
    profile: null,
    stats: null,
    activities: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (!user?.athleteId) {
      setIsLoading(false);
      return;
    }

    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      // First try to load cached data for instant display
      const [cachedProfile, cachedStats, cachedActivities] = await Promise.all([
        apiService.getCachedAthleteProfile(),
        apiService.getCachedAthleteStats(),
        apiService.getCachedAthleteActivities(),
      ]);

      if (cachedProfile || cachedStats || cachedActivities) {
        setData({
          profile: cachedProfile,
          stats: cachedStats,
          activities: cachedActivities || [],
        });
      }

      // Then fetch fresh data from API
      const [profileRes, statsRes, activitiesRes] = await Promise.all([
        apiService.getAthleteProfile(user.athleteId),
        apiService.getAthleteStats(user.athleteId),
        apiService.getAthleteActivities(user.athleteId, { limit: 20 }),
      ]);

      const newData: AthleteData = {
        profile: profileRes.data || null,
        stats: statsRes.data || null,
        activities: activitiesRes.data || [],
      };

      setData(newData);

      // Cache the fresh data
      if (newData.profile) {
        await apiService.cacheAthleteProfile(newData.profile);
      }
      if (newData.stats) {
        await apiService.cacheAthleteStats(newData.stats);
      }
      if (newData.activities.length > 0) {
        await apiService.cacheAthleteActivities(newData.activities);
      }

      console.log('✅ [AthleteData] Fetched fresh data:', {
        profile: !!newData.profile,
        stats: !!newData.stats,
        activities: newData.activities.length,
      });
    } catch (err: any) {
      console.error('❌ [AthleteData] Error fetching data:', err.message);
      setError(err.message || 'Failed to fetch athlete data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.athleteId]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  const syncFromStrava = useCallback(async () => {
    if (!user?.athleteId) return;

    setIsRefreshing(true);
    try {
      await apiService.syncAthleteData(user.athleteId);
      await fetchData(true);
    } catch (err: any) {
      console.error('❌ [AthleteData] Sync error:', err.message);
      setError(err.message || 'Failed to sync from Strava');
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.athleteId, fetchData]);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.athleteId) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.athleteId, fetchData]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refresh,
    syncFromStrava,
  };
};

export default useAthleteData;
