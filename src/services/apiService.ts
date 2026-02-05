import AsyncStorage from '@react-native-async-storage/async-storage';

// API Configuration
const API_CONFIG = {
  // Ngrok URL for live location/socket (update this when ngrok restarts)
  NGROK_URL: 'https://d1c37b7aa116.ngrok-free.app',
  // Local development URL
  LOCAL_URL: 'https://eazygo-strava-fit.onrender.com',
  // Weather API (OpenWeatherMap - free tier)
  WEATHER_API_KEY: '4d8fb5b93d4af21d66a2948710284366', // Free API key
  WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
  TIMEOUT: 30000,
};

// Get the active base URL
const getBaseUrl = () => {
  return API_CONFIG.NGROK_URL;
};

// Types
export interface Athlete {
  stravaId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileMedium: string;
  profile: string;
  city: string;
  state: string;
  country: string;
  gender: string;
  weight: number;
  followerCount: number;
  friendCount: number;
  premium: boolean;
  summit: boolean;
  stravaCreatedAt: string;
  stravaUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  dynamicStats?: {
    totalActivities: number;
    totalDistanceKM: number;
    totalHours: number;
  };
}

export interface Activity {
  stravaActivityId: number;
  athleteId: number;
  name: string;
  type: string;
  sportType: string;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  totalElevationGain: number;
  startDate: string;
  startDateLocal: string;
  timezone: string;
  averageSpeed: number;
  maxSpeed: number;
  averageHeartrate?: number;
  maxHeartrate?: number;
  calories?: number;
  map?: {
    id: string;
    summaryPolyline: string;
  };
}

export interface ActivityTotals {
  count: number;
  distance: number;
  movingTime: number;
  elevationGain: number;
}

export interface AthleteStats {
  athleteId: number;
  biggestRideDistance: number;
  biggestClimbElevationGain: number;
  recentRideTotals: ActivityTotals;
  recentRunTotals: ActivityTotals;
  recentSwimTotals: ActivityTotals;
  ytdRideTotals: ActivityTotals;
  ytdRunTotals: ActivityTotals;
  ytdSwimTotals: ActivityTotals;
  allRideTotals: ActivityTotals;
  allRunTotals: ActivityTotals;
  allSwimTotals: ActivityTotals;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SyncResponse {
  success: boolean;
  message: string;
  data: {
    newActivities: number;
    updatedActivities: number;
    totalActivities: number;
  };
}

// Leaderboard Types
export interface LeaderboardUser {
  name: string;
  profile?: string;
  totalDistanceKM: number;
  activityType: string;
  totalTimeMinutes: number;
  totalElevationGainMeters: number;
  caloriesBurned: number;
  // Optional fields for backward compatibility or specific UI logic
  rank?: number;
  athleteId?: number;
}

export interface LeaderboardResponse {
  success: boolean;
  users?: LeaderboardUser[]; // New format per backend notes
  data?: LeaderboardUser[];  // Fallback
  period: string;
}

// Challenge Types
export interface Challenge {
  _id: string; // MongoDB ID
  id?: string;
  title: string;
  description: string;
  activityType: string;
  targetType: 'distance' | 'time' | 'activities';
  targetValue: number;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isActive: boolean;
  participants: number;
  userProgress?: {
    currentValue: number;
    percentage: number;
    joined: boolean;
  };
  badge?: {
    icon: string;
    color: string;
  };
}

export interface ChallengesResponse {
  success: boolean;
  data: Challenge[];
}

// Weather Types
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  city: string;
}

interface ApiRequestOptions extends RequestInit {
  silent?: boolean; // If true, suppresses console.error on failure
}

// Helper function for making API requests
const apiRequest = async <T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const token = await AsyncStorage.getItem('authToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error: any) {
    if (!options.silent) {
      console.error(`API Error [${endpoint}]:`, error.message);
    }
    throw error;
  }
};

// API Service
export const apiService = {
  getBaseUrl,

  getStravaAuthUrl: (): string => {
    return `${getBaseUrl()}/api/auth/strava`;
  },

  healthCheck: async (): Promise<{ status: string; message: string }> => {
    return apiRequest('/api/health');
  },

  // ============ ATHLETE ENDPOINTS ============

  getAthleteProfile: async (athleteId: number): Promise<ApiResponse<Athlete>> => {
    return apiRequest(`/api/athlete/${athleteId}/profile`);
  },

  getAthleteActivities: async (
    athleteId: number,
    options?: {
      page?: number;
      limit?: number;
      type?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PaginatedResponse<Activity>> => {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const queryString = params.toString();
    const endpoint = `/api/athlete/${athleteId}/activities${queryString ? `?${queryString}` : ''}`;
    return apiRequest(endpoint);
  },

  getAthleteStats: async (athleteId: number): Promise<ApiResponse<AthleteStats>> => {
    return apiRequest(`/api/athlete/${athleteId}/stats`);
  },

  syncAthleteData: async (athleteId: number): Promise<SyncResponse> => {
    return apiRequest(`/api/athlete/${athleteId}/sync`, {
      method: 'POST',
    });
  },

  getSyncHistory: async (
    athleteId: number,
    limit: number = 10
  ): Promise<ApiResponse<any[]>> => {
    return apiRequest(`/api/athlete/${athleteId}/sync-history?limit=${limit}`);
  },

  disconnectStrava: async (athleteId: number): Promise<ApiResponse<null>> => {
    return apiRequest(`/api/athlete/${athleteId}/disconnect`, {
      method: 'DELETE',
    });
  },

  // ============ LEADERBOARD ENDPOINTS ============

  getLeaderboard: async (
    period: 'week' | 'month' = 'week',
    type: string = 'All Activities'
  ): Promise<LeaderboardResponse> => {
    try {
      const params = new URLSearchParams();
      params.append('period', period);
      if (type && type !== 'All Activities') {
        params.append('type', type);
      }
      // Add timestamp to prevent caching
      params.append('_t', Date.now().toString());
      return await apiRequest(`/api/leaderboard?${params.toString()}`, { silent: true });
    } catch {
      // Return empty leaderboard if endpoint doesn't exist yet
      return { success: true, users: [], period };
    }
  },

  // ============ CHALLENGES ENDPOINTS ============

  getChallenges: async (): Promise<ChallengesResponse> => {
    try {
      return await apiRequest('/api/challenges', { silent: true });
    } catch {
      // Return empty challenges if endpoint doesn't exist yet
      return { success: true, data: [] };
    }
  },

  joinChallenge: async (challengeId: string): Promise<ApiResponse<null>> => {
    return apiRequest(`/api/challenges/${challengeId}/join`, {
      method: 'POST',
    });
  },

  // ============ WEATHER API ============

  getWeather: async (lat: number, lon: number): Promise<WeatherData | null> => {
    try {
      const url = `${API_CONFIG.WEATHER_URL}?lat=${lat}&lon=${lon}&appid=${API_CONFIG.WEATHER_API_KEY}&units=metric`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Weather API failed');
      }

      return {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        description: data.weather[0]?.description || 'Unknown',
        icon: data.weather[0]?.icon || '01d',
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        city: data.name,
      };
    } catch (error) {
      console.error('Weather API Error:', error);
      return null;
    }
  },

  getWeatherIcon: (iconCode: string): string => {
    const iconMap: Record<string, string> = {
      '01d': 'weather-sunny',
      '01n': 'weather-night',
      '02d': 'weather-partly-cloudy',
      '02n': 'weather-night-partly-cloudy',
      '03d': 'weather-cloudy',
      '03n': 'weather-cloudy',
      '04d': 'weather-cloudy',
      '04n': 'weather-cloudy',
      '09d': 'weather-rainy',
      '09n': 'weather-rainy',
      '10d': 'weather-pouring',
      '10n': 'weather-pouring',
      '11d': 'weather-lightning',
      '11n': 'weather-lightning',
      '13d': 'weather-snowy',
      '13n': 'weather-snowy',
      '50d': 'weather-fog',
      '50n': 'weather-fog',
    };
    return iconMap[iconCode] || 'weather-sunny';
  },

  // ============ LOCAL STORAGE HELPERS ============

  storeAuthData: async (token: string, athleteId: number): Promise<void> => {
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('athleteId', athleteId.toString());
    await AsyncStorage.setItem('isLoggedIn', 'true');
  },

  getStoredAthleteId: async (): Promise<number | null> => {
    const athleteId = await AsyncStorage.getItem('athleteId');
    return athleteId ? parseInt(athleteId, 10) : null;
  },

  isLoggedIn: async (): Promise<boolean> => {
    const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');
    return isLoggedIn === 'true';
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.multiRemove([
      'authToken',
      'athleteId',
      'isLoggedIn',
      'athleteProfile',
      'athleteStats',
      'athleteActivities',
    ]);
  },

  cacheAthleteProfile: async (profile: Athlete): Promise<void> => {
    await AsyncStorage.setItem('athleteProfile', JSON.stringify(profile));
  },

  getCachedAthleteProfile: async (): Promise<Athlete | null> => {
    const profile = await AsyncStorage.getItem('athleteProfile');
    return profile ? JSON.parse(profile) : null;
  },

  cacheAthleteStats: async (stats: AthleteStats): Promise<void> => {
    await AsyncStorage.setItem('athleteStats', JSON.stringify(stats));
  },

  getCachedAthleteStats: async (): Promise<AthleteStats | null> => {
    const stats = await AsyncStorage.getItem('athleteStats');
    return stats ? JSON.parse(stats) : null;
  },

  cacheAthleteActivities: async (activities: Activity[]): Promise<void> => {
    await AsyncStorage.setItem('athleteActivities', JSON.stringify(activities));
  },

  getCachedAthleteActivities: async (): Promise<Activity[] | null> => {
    const activities = await AsyncStorage.getItem('athleteActivities');
    return activities ? JSON.parse(activities) : null;
  },
};

export default apiService;
