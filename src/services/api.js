import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration from your documentation
export const API_CONFIG = {
  BASE_URL: 'https://e45c-103-59-135-83.ngrok-free.app', // Active Ngrok URL
  AUTH_URL: 'https://e45c-103-59-135-83.ngrok-free.app/api/auth/strava', // GET /api/auth/strava
};

// Helper to get headers with JWT
const getHeaders = async () => {
  const token = await AsyncStorage.getItem('authToken'); // Fixed: Match key used in LoginPage
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

// Generic API Request Handler
const apiRequest = async (endpoint, options = {}) => {
  try {
    const headers = await getHeaders();
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    // console.log(`[API REQUEST] ${url}`); // Commented out to reduce noise, using specific logging in Dashboard
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[API ERROR] ${endpoint}:`, data);
      throw new Error(data.message || 'API Request Failed');
    }

    return data;
  } catch (error) {
    console.error(`[API EXCEPTION] ${endpoint}:`, error);
    throw error;
  }
};

export const api = {
  // 1. Get Athlete Profile
  getProfile: async (athleteId) => {
    return apiRequest(`/api/athlete/${athleteId}/profile`);
  },

  // 2. Get Athlete Stats
  getStats: async (athleteId) => {
    return apiRequest(`/api/athlete/${athleteId}/stats`);
  },

  // 3. Get Activities
  getActivities: async (athleteId, page = 1, limit = 50) => {
    return apiRequest(`/api/athlete/${athleteId}/activities?page=${page}&limit=${limit}`);
  },

  // 4. Get Weekly Stats
  getWeeklyStats: async (athleteId, weeks = 4) => {
    return apiRequest(`/api/athlete/${athleteId}/weekly?weeks=${weeks}`);
  },

  // 5. Get Monthly Stats
  getMonthlyStats: async (athleteId, months = 6) => {
    return apiRequest(`/api/athlete/${athleteId}/monthly?months=${months}`);
  },

  // 6. Sync Data (Trigger backend refresh from Strava)
  syncData: async (athleteId) => {
    return apiRequest(`/api/athlete/${athleteId}/sync`, { method: 'POST' });
  },

  // Helper to fetch ALL data at once (Optional, but we will use individual calls in Dashboard for logging)
  // fetchAllData: async (athleteId) => {
  //   console.log('--- STARTING FULL DATA SYNC ---');
  //   try {
  //     const [profile, stats, activities, weekly, monthly] = await Promise.all([
  //       api.getProfile(athleteId),
  //       api.getStats(athleteId),
  //       api.getActivities(athleteId),
  //       api.getWeeklyStats(athleteId),
  //       api.getMonthlyStats(athleteId)
  //     ]);
  //
  //     console.log('--- FULL DATA SYNC COMPLETE ---');
  //     return { profile, stats, activities, weekly, monthly };
  //   } catch (error) {
  //     console.error('Error fetching all data:', error);
  //     throw error;
  //   }
  // }
};