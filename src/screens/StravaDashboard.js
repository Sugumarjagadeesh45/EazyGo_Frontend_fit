import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../services/api';

const { width } = Dimensions.get('window');

const StravaDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('Home'); // Home, Activity, Challenges, Leaderboard
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('week'); // 'week' or 'month'
  const [leaderboardType, setLeaderboardType] = useState('All Activities');

  // REAL DATA STATES (Initialized as null to ensure no fake data is shown)
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenges, setChallenges] = useState([]);

  const ACTIVITY_TYPES = ['All Activities', 'Walk', 'Run', 'Cycle Ride', 'Swim', 'Hike', 'WeightTraining', 'Workout', 'Yoga'];

  // 1. Handle Deep Links (Auth Return)
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const url = event.url;
      if (url && url.includes('auth-success')) {
        try {
          setLoading(true);
          const regex = /[?&]([^=#]+)=([^&#]*)/g;
          let params = {};
          let match;
          while ((match = regex.exec(url))) {
            params[match[1]] = decodeURIComponent(match[2]);
          }

          const { athleteId, token } = params;

          if (athleteId && token) {
            await AsyncStorage.setItem('athleteId', athleteId);
            await AsyncStorage.setItem('authToken', token); // Fixed: Match key used in LoginPage
            setConnected(true);
            await fetchAndLogUserData(athleteId, token);
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to process Strava login.');
        } finally {
          setLoading(false);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
    checkExistingLogin();
    return () => subscription.remove();
  }, []);

  const checkExistingLogin = async () => {
    const token = await AsyncStorage.getItem('authToken'); // Fixed: Match key used in LoginPage
    const athleteId = await AsyncStorage.getItem('athleteId');
    if (token && athleteId) {
      setConnected(true);
      await loadCachedData(); // Load cached data immediately for instant UI
      fetchAndLogUserData(athleteId, token);
    }
  };

  // NEW: Load data cached by LoginPage for instant render
  const loadCachedData = async () => {
    try {
      const [profileStr, statsStr, activitiesStr] = await Promise.all([
        AsyncStorage.getItem('athleteProfile'),
        AsyncStorage.getItem('athleteStats'),
        AsyncStorage.getItem('athleteActivities')
      ]);

      if (profileStr) {
        setProfile(JSON.parse(profileStr));
        console.log('👤 [FRONTEND] Loaded Cached Profile');
      }
      if (statsStr) {
        setStats(JSON.parse(statsStr));
        console.log('📊 [FRONTEND] Loaded Cached Stats');
      }
      if (activitiesStr) {
        setActivities(JSON.parse(activitiesStr));
        console.log('🚴 [FRONTEND] Loaded Cached Activities');
      }
    } catch (e) {
      console.log('Error loading cache', e);
    }
  };

  // 2. FETCH & LOG DATA (STRICTLY FOLLOWING YOUR DOCUMENTATION)
  const fetchAndLogUserData = async (athleteId, token) => {
    const BASE_URL = API_CONFIG.BASE_URL;
    const headers = { Authorization: `Bearer ${token}` };

    console.log('🚀 STARTING DATA FETCH FOR:', athleteId);

    try {
      // 1. Fetch Profile
      const profileRes = await fetch(`${BASE_URL}/api/athlete/${athleteId}/profile`, { headers });
      const profileData = await profileRes.json();
      console.log('👤 [FRONTEND] COMPLETE PROFILE DATA:', JSON.stringify(profileData, null, 2));
      if (profileData.success) setProfile(profileData.data);

      // 2. Fetch Stats
      const statsRes = await fetch(`${BASE_URL}/api/athlete/${athleteId}/stats`, { headers });
      const statsData = await statsRes.json();
      console.log('📊 [FRONTEND] COMPLETE STATS DATA:', JSON.stringify(statsData, null, 2));
      if (statsData.success) setStats(statsData.data);

      // 3. Fetch Activities
      const activitiesRes = await fetch(`${BASE_URL}/api/athlete/${athleteId}/activities?limit=20`, { headers });
      const activitiesData = await activitiesRes.json();
      console.log('🚴 [FRONTEND] RECENT ACTIVITIES:', JSON.stringify(activitiesData, null, 2));
      if (activitiesData.success) setActivities(activitiesData.data);

      // 4. Fetch Weekly (Optional but good for Home)
      const weeklyRes = await fetch(`${BASE_URL}/api/athlete/${athleteId}/weekly`, { headers });
      const weeklyData = await weeklyRes.json();
      if (weeklyData.success) setWeeklyStats(weeklyData.data);
      console.log('📅 [FRONTEND] WEEKLY STATS:', JSON.stringify(weeklyData, null, 2));

      // 5. Fetch Leaderboard
      const lbRes = await fetch(`${BASE_URL}/api/leaderboard?period=week&type=All Activities`, { headers });
      const lbData = await lbRes.json();
      console.log('🏆 [FRONTEND] LEADERBOARD DATA:', JSON.stringify(lbData, null, 2));
      if (lbData.success) setLeaderboard(lbData.users || lbData.data || []);

      // 6. Fetch Challenges
      const chRes = await fetch(`${BASE_URL}/api/challenges`, { headers });
      const chData = await chRes.json();
      console.log('🎯 [FRONTEND] CHALLENGES DATA:', JSON.stringify(chData, null, 2));
      if (chData.success) setChallenges(chData.data);

    } catch (error) {
      console.error('❌ [FRONTEND] DATA FETCH ERROR:', error);
      Alert.alert('Sync Error', 'Could not fetch data. Check if backend is running on ' + API_CONFIG.BASE_URL);
    }
  };

  const fetchLeaderboard = async (period, type) => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    console.log(`🏆 Fetching leaderboard: ${period} | ${type}`);
    setLeaderboard([]); // Clear for loading state
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const lbRes = await fetch(`${API_CONFIG.BASE_URL}/api/leaderboard?period=${period}&type=${type}`, { headers });
      const lbData = await lbRes.json();
      console.log(`🏆 [FRONTEND] ${period.toUpperCase()} LEADERBOARD DATA:`, JSON.stringify(lbData, null, 2));
      if (lbData.success) setLeaderboard(lbData.users || lbData.data || []);
    } catch (e) {
      console.error(`Failed to fetch ${period} leaderboard`, e);
    }
  };

  const handlePeriodChange = (newPeriod) => {
    setLeaderboardPeriod(newPeriod);
    fetchLeaderboard(newPeriod, leaderboardType);
  };

  const handleTypeChange = (newType) => {
    setLeaderboardType(newType);
    fetchLeaderboard(leaderboardPeriod, newType);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const token = await AsyncStorage.getItem('authToken');
    const athleteId = await AsyncStorage.getItem('athleteId');
    if (token && athleteId) {
      // Trigger backend sync first
      try {
        await fetch(`${API_CONFIG.BASE_URL}/api/athlete/${athleteId}/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) { console.log('Sync trigger failed', e); }
      
      await fetchAndLogUserData(athleteId, token);
    }
    setRefreshing(false);
  };

  // --- UI HELPERS ---
  const formatDistance = (meters) => (meters / 1000).toFixed(2) + ' km';
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const isToday = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // --- RENDER SECTIONS ---

  const renderWeekCalendar = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    // Generate last 7 days
    const weekDates = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      return d;
    });

    return (
      <View style={styles.calendarContainer}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.calendarRow}>
          {weekDates.map((date, index) => {
            const isCurrentDay = date.getDate() === today.getDate();
            // Check if we have activity on this day (Real Data Check)
            const hasActivity = activities.some(a => {
              const aDate = new Date(a.startDateLocal);
              return aDate.getDate() === date.getDate() && aDate.getMonth() === date.getMonth();
            });

            return (
              <View key={index} style={[styles.calendarDay, isCurrentDay && styles.calendarDayActive]}>
                <Text style={[styles.dayName, isCurrentDay && styles.dayTextActive]}>{days[date.getDay()]}</Text>
                <Text style={[styles.dayNum, isCurrentDay && styles.dayTextActive]}>{date.getDate()}</Text>
                {hasActivity && <View style={styles.activityDot} />}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderHome = () => {
    if (!profile) {
      return (
        <View style={{marginTop: 50, alignItems: 'center'}}>
          <ActivityIndicator size="large" color="#FC4C02" />
          <Text style={{marginTop: 10, color: '#666'}}>Fetching Profile...</Text>
          <Text style={{fontSize: 10, color: '#999', marginTop: 5}}>URL: {API_CONFIG.BASE_URL}</Text>
        </View>
      );
    }

    const todaysActivities = activities.filter(a => isToday(a.startDateLocal));

    return (
      <View>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Image source={{ uri: profile.profile }} style={styles.avatar} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.firstName} {profile.lastName}</Text>
            <Text style={styles.profileLoc}>{profile.city}, {profile.state}</Text>
          </View>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats?.allRideTotals?.count + stats?.allRunTotals?.count || 0}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance((stats?.allRideTotals?.distance || 0) + (stats?.allRunTotals?.distance || 0))}</Text>
            <Text style={styles.statLabel}>Total Dist</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime((stats?.allRideTotals?.movingTime || 0) + (stats?.allRunTotals?.movingTime || 0))}</Text>
            <Text style={styles.statLabel}>Total Time</Text>
          </View>
        </View>

        {/* Real Calendar Strip */}
        {renderWeekCalendar()}

        {/* Today's Activities */}
        <Text style={styles.sectionTitle}>Today's Activity</Text>
        {todaysActivities.length > 0 ? (
          todaysActivities.map(activity => (
            <View key={activity._id} style={styles.activityCard}>
              <View style={styles.activityIcon}><Text style={{fontSize: 20}}>🔥</Text></View>
              <View style={{flex: 1}}>
                <Text style={styles.activityTitle}>{activity.name}</Text>
                <Text style={styles.activitySub}>{activity.type} • {formatTime(activity.movingTime)}</Text>
              </View>
              <Text style={styles.activityDist}>{formatDistance(activity.distance)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No activities today. Time to move! 🏃‍♂️</Text>
          </View>
        )}
      </View>
    );
  };

  const renderActivityTab = () => (
    <View>
      <Text style={styles.headerTitle}>My Activities</Text>
      {renderWeekCalendar()}
      <Text style={[styles.sectionTitle, {marginTop: 20}]}>Recent History</Text>
      {activities.map((activity) => (
        <View key={activity._id} style={styles.activityCard}>
          <View style={[styles.activityIcon, {backgroundColor: '#f0f0f0'}]}>
            <Text style={{fontSize: 20}}>{activity.type === 'Run' ? '🏃' : activity.type === 'Ride' ? '🚴' : '👟'}</Text>
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>{activity.name}</Text>
            <Text style={styles.activitySub}>{new Date(activity.startDateLocal).toDateString()}</Text>
          </View>
          <View style={{alignItems: 'flex-end'}}>
            <Text style={styles.activityDist}>{formatDistance(activity.distance)}</Text>
            <Text style={styles.activitySub}>{formatTime(activity.movingTime)}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderChallenges = () => (
    <View>
      <Text style={styles.headerTitle}>Active Challenges</Text>
      {challenges.length > 0 ? (
        challenges.map((challenge) => (
          <View key={challenge._id || challenge.id} style={styles.challengeCard}>
            <View style={{flex: 1}}>
              <Text style={styles.activityTitle}>{challenge.title}</Text>
              <Text style={styles.activitySub}>{challenge.description}</Text>
              <Text style={[styles.activitySub, {color: '#FC4C02'}]}>Goal: {challenge.goalValue / 1000}km {challenge.type}</Text>
            </View>
            <TouchableOpacity style={styles.joinBtn}>
              <Text style={styles.joinBtnText}>JOIN</Text>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active challenges found.</Text>
        </View>
      )}
    </View>
  );

  const renderLeaderboard = () => (
    <View>
      <Text style={styles.headerTitle}>Club Leaderboard</Text>

      {/* Time Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity 
          style={[styles.periodButton, leaderboardPeriod === 'week' && styles.periodButtonActive]}
          onPress={() => handlePeriodChange('week')}
        >
          <Text style={[styles.periodButtonText, leaderboardPeriod === 'week' && styles.periodButtonTextActive]}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.periodButton, leaderboardPeriod === 'month' && styles.periodButtonActive]}
          onPress={() => handlePeriodChange('month')}
        >
          <Text style={[styles.periodButtonText, leaderboardPeriod === 'month' && styles.periodButtonTextActive]}>This Month</Text>
        </TouchableOpacity>
      </View>

      {/* Activity Type Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelector} contentContainerStyle={{paddingRight: 20}}>
        {ACTIVITY_TYPES.map((type) => (
          <TouchableOpacity 
            key={type} 
            style={[styles.typeChip, leaderboardType === type && styles.typeChipActive]}
            onPress={() => handleTypeChange(type)}
          >
            <Text style={[styles.typeChipText, leaderboardType === type && styles.typeChipTextActive]}>{type}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Leaderboard List */}
      {leaderboard.length > 0 ? (
        leaderboard.map((user, index) => (
          <View key={index} style={styles.lbRow}>
            <View style={styles.lbHeaderRow}>
              <Text style={styles.lbRank}>#{index + 1}</Text>
              <Text style={styles.lbName} numberOfLines={1}>{user.name || user.fullName}</Text>
              <Text style={styles.lbDist}>{user.totalDistanceKM?.toFixed(1) || 0} km</Text>
            </View>
            
            <View style={styles.lbStatsRow}>
              <View style={styles.lbStatItem}>
                <Text style={styles.lbStatLabel}>Time</Text>
                <Text style={styles.lbStatValue}>{formatTime((user.totalTimeMinutes || 0) * 60)}</Text>
              </View>
              <View style={styles.lbStatItem}>
                <Text style={styles.lbStatLabel}>Elev</Text>
                <Text style={styles.lbStatValue}>{user.totalElevationGainMeters || 0}m</Text>
              </View>
              <View style={styles.lbStatItem}>
                <Text style={styles.lbStatLabel}>Cals</Text>
                <Text style={styles.lbStatValue}>{user.caloriesBurned || 0}</Text>
              </View>
            </View>
          </View>
        ))
      ) : (
        <ActivityIndicator style={{marginTop: 20}} color="#FC4C02" />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {!connected ? (
        <View style={styles.connectContainer}>
          <Text style={styles.welcomeTitle}>iFit Club Erode</Text>
          <Text style={styles.welcomeText}>Connect with Strava to sync your real activities.</Text>
          <TouchableOpacity 
            style={styles.connectButton} 
            onPress={() => Linking.openURL(API_CONFIG.AUTH_URL)}
          >
            <Text style={styles.connectButtonText}>Connect Strava</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView 
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {activeTab === 'Home' && renderHome()}
            {activeTab === 'Activity' && renderActivityTab()}
            {activeTab === 'Challenges' && renderChallenges()}
            {activeTab === 'Leaderboard' && renderLeaderboard()}
            <View style={{height: 100}} />
          </ScrollView>

          {/* Bottom Tab Bar */}
          <View style={styles.tabBar}>
            {['Home', 'Activity', 'Challenges', 'Leaderboard'].map(tab => (
              <TouchableOpacity 
                key={tab} 
                style={styles.tabItem} 
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'Home' ? '🏠' : tab === 'Activity' ? '👟' : tab === 'Challenges' ? '🏆' : '📊'}
                </Text>
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FC4C02" />
          <Text style={{marginTop: 10}}>Syncing Real Data...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { flex: 1, padding: 16 },
  
  // Connect Screen
  connectContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  welcomeTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  welcomeText: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 },
  connectButton: { backgroundColor: '#FC4C02', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 8 },
  connectButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Profile
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ddd' },
  profileInfo: { marginLeft: 15 },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  profileLoc: { fontSize: 14, color: '#666' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#fff', padding: 15, borderRadius: 12 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },

  // Calendar
  calendarContainer: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20 },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  calendarDay: { alignItems: 'center', padding: 8, borderRadius: 8, width: 40 },
  calendarDayActive: { backgroundColor: '#FC4C02' },
  dayName: { fontSize: 12, color: '#888', marginBottom: 4 },
  dayNum: { fontSize: 16, fontWeight: '600', color: '#000' },
  dayTextActive: { color: '#fff' },
  activityDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FC4C02', marginTop: 4 },

  // Activity Card
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#000' },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10 },
  activityIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  activitySub: { fontSize: 13, color: '#888', marginTop: 2 },
  activityDist: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  emptyState: { padding: 20, alignItems: 'center', backgroundColor: '#fff', borderRadius: 12 },
  emptyText: { color: '#888' },

  // Challenges
  challengeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10 },
  joinBtn: { backgroundColor: '#FC4C02', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  // Leaderboard
  lbHeader: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 10 },
  lbHeadText: { fontSize: 12, color: '#888', fontWeight: '600' },
  lbRow: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10 },
  lbHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 8 },
  lbRank: { fontSize: 16, fontWeight: 'bold', color: '#FC4C02', width: 40 },
  lbName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#000' },
  lbDist: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  lbStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lbStatItem: { alignItems: 'center', flex: 1 },
  lbStatLabel: { fontSize: 11, color: '#888', marginBottom: 2 },
  lbStatValue: { fontSize: 13, fontWeight: '600', color: '#333' },

  // Type Selector
  typeSelector: { flexDirection: 'row', marginBottom: 15 },
  typeChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#eee' },
  typeChipActive: { backgroundColor: '#FC4C02', borderColor: '#FC4C02' },
  typeChipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: 'bold' },

  // Leaderboard Period Selector
  periodSelector: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#e9e9eb', borderRadius: 8, padding: 4 },
  periodButton: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  periodButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  periodButtonText: { fontWeight: '600', color: '#666' },
  periodButtonTextActive: { color: '#FC4C02' },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 20, paddingTop: 10, borderTopWidth: 1, borderColor: '#eee' },
  tabItem: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 20, marginBottom: 4 },
  tabTextActive: { opacity: 1 },
  tabLabel: { fontSize: 10, color: '#888' },
  tabLabelActive: { color: '#FC4C02', fontWeight: 'bold' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#000' },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center' }
});

export default StravaDashboard;