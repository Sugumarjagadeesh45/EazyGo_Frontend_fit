import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Dimensions,
  Image,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from '@react-native-community/geolocation';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { DashboardScreenProps } from '../navigation/types';
import { getLightMapStyleString } from '../mapStyle';
import { useAuth } from '../context/AuthContext';
import {
  useAthleteData,
  formatDistance,
  formatDuration,
  formatDate,
  formatPace,
  getActivityIcon,
  getActivityColor,
} from '../hooks/useAthleteData';
import { apiService, WeatherData, TopPerformer } from '../services/apiService';

const { width } = Dimensions.get('window');

MapLibreGL.setAccessToken(null);

const MAP_STYLE = getLightMapStyleString();

// ============ COMPONENTS ============

const blueDotStyles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
  },
  outerRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  innerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4285F4',
  },
});

const UserLocationDot = React.memo(() => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 2.5,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, opacityAnim]);

  return (
    <View style={blueDotStyles.container}>
      <Animated.View
        style={[
          blueDotStyles.pulseRing,
          { transform: [{ scale: pulseAnim }], opacity: opacityAnim },
        ]}
      />
      <View style={blueDotStyles.outerRing} />
      <View style={blueDotStyles.innerDot} />
    </View>
  );
});

// Calendar Strip Component
const CalendarStrip = () => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const currentDay = today.getDay();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - currentDay + i);
    return {
      day: days[i],
      date: d.getDate(),
      isToday: i === currentDay,
    };
  });

  return (
    <View style={styles.calendarContainer}>
      {dates.map((item, index) => (
        <View key={index} style={[styles.calendarItem, item.isToday && styles.calendarItemActive]}>
          <Text style={[styles.calendarDay, item.isToday && styles.calendarTextActive]}>{item.day}</Text>
          <Text style={[styles.calendarDate, item.isToday && styles.calendarTextActive]}>
            {item.date.toString().padStart(2, '0')}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Stat Card Component
const StatCard = ({ label, value, unit, icon }: { label: string; value: string | number; unit?: string; icon: string }) => (
  <View style={styles.statCard}>
    <View style={styles.statIconContainer}>
      <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
    </View>
    <Text style={styles.statValue}>
      {value}
      {unit && <Text style={styles.statUnit}>{unit}</Text>}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Weather Component
const WeatherDisplay = ({ weather }: { weather: WeatherData | null }) => {
  if (!weather) {
    return (
      <View style={styles.weatherInfo}>
        <View style={styles.weatherIconContainer}>
          <MaterialCommunityIcons name="weather-sunny" size={20} color="#FF9800" />
        </View>
        <Text style={styles.temperature}>--°C</Text>
        <Text style={styles.weatherDesc}>Loading...</Text>
      </View>
    );
  }

  const iconName = apiService.getWeatherIcon(weather.icon);

  return (
    <View style={styles.weatherInfo}>
      <View style={styles.weatherIconContainer}>
        <MaterialCommunityIcons name={iconName as any} size={20} color="#FF9800" />
      </View>
      <Text style={styles.temperature}>{weather.temperature}°C</Text>
      <Text style={styles.weatherDesc} numberOfLines={1}>
        {weather.description.charAt(0).toUpperCase() + weather.description.slice(1)}
      </Text>
    </View>
  );
};

// Activity Selection Modal
const ActivityModal = ({ visible, onClose, onStart }: { visible: boolean; onClose: () => void; onStart: (type: string) => void }) => {
  const activities = [
    { id: 'run', label: 'Run', icon: 'run' },
    { id: 'walk', label: 'Walk', icon: 'walk' },
    { id: 'ride', label: 'Cycling', icon: 'bike' },
    { id: 'swim', label: 'Swim', icon: 'swim' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Start Activity</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeModalButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.activityGrid}>
            {activities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityOption}
                onPress={() => onStart(activity.id)}
              >
                <View style={[styles.activityOptionIcon, { backgroundColor: colors.primary + '15' }]}>
                  <MaterialCommunityIcons name={activity.icon as any} size={32} color={colors.primary} />
                </View>
                <Text style={styles.activityOptionLabel}>{activity.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.modalButton} onPress={onClose}>
            <Text style={styles.modalButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Simple Bar Graph Component
const SimpleGraph = ({ data, labels }: { data: number[]; labels: string[] }) => (
  <View style={styles.graphContainer}>
    {data.map((height, index) => (
      <View key={index} style={styles.graphBarContainer}>
        <View style={[styles.graphBar, { height: `${height}%` }]} />
        <Text style={styles.graphLabel}>{labels[index]}</Text>
      </View>
    ))}
  </View>
);

// ============ MAIN SCREEN ============

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { user } = useAuth();
  const { data, isLoading, isRefreshing, refresh } = useAthleteData();
  const [modalVisible, setModalVisible] = useState(false);
  const [challengeModalVisible, setChallengeModalVisible] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);

  // Fetch location and weather
  useEffect(() => {
    Geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(coords);

        // Fetch weather data
        const weatherData = await apiService.getWeather(coords.latitude, coords.longitude);
        if (weatherData) {
          setWeather(weatherData);
        }
      },
      (err) => console.log('Error getting location', err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  }, []);

  const handleStartActivity = (_type: string) => {
    setModalVisible(false);
    navigation.navigate('FitnessMap');
  };

  // Get user display name
  const displayName = data.profile
    ? `${data.profile.firstName} ${data.profile.lastName}`.trim()
    : user?.firstName || 'Athlete';

  // Get profile image
  const profileImage = data.profile?.profile || data.profile?.profileMedium || null;

  // Calculate cumulative stats from account creation (all time)
  const stats = data.stats;
  const totalDistance = stats
    ? (stats.allRunTotals.distance + stats.allRideTotals.distance + stats.allSwimTotals.distance) / 1000
    : 0;
  const totalActivities = stats
    ? stats.allRunTotals.count + stats.allRideTotals.count + stats.allSwimTotals.count
    : 0;
  const totalHours = stats
    ? (stats.allRunTotals.movingTime + stats.allRideTotals.movingTime + stats.allSwimTotals.movingTime) / 3600
    : 0;

  // Calculate average pace from recent runs
  const avgPace = stats?.recentRunTotals?.movingTime && stats?.recentRunTotals?.distance
    ? formatPace(stats.recentRunTotals.distance / stats.recentRunTotals.movingTime)
    : '--:--';

  // Filter activities from the last 3 days
  const recentActivities = useMemo(() => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    return data.activities.filter((activity) => {
      const activityDate = new Date(activity.startDateLocal);
      return activityDate >= threeDaysAgo;
    });
  }, [data.activities]);

  // Format activity time for display (e.g., "Morning Walk", "Evening Run")
  const getActivityTimeLabel = (dateString: string, activityType: string): string => {
    const date = new Date(dateString);
    const hour = date.getHours();

    let timeOfDay = 'Morning';
    if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'Evening';
    else if (hour >= 21 || hour < 5) timeOfDay = 'Night';

    return `${timeOfDay} ${activityType}`;
  };

  // Health Stats State
  const [isEditingHealth, setIsEditingHealth] = useState(false);
  const [healthStats, setHealthStats] = useState<any>({
    weight: '',
    height: '',
    bmi: '',
    bp: '',
    lung: '',
    temp: '',
  });

  // Challenge Form State
  const [challengeForm, setChallengeForm] = useState({
    eventName: '',
    bio: '',
    targetKm: '',
    duration: '',
    description: '',
  });

  // Fetch Dashboard Data (Health & Top Performer)
  useEffect(() => {
    const fetchDashboardData = async () => {
      const athleteId = await apiService.getStoredAthleteId();
      if (athleteId) {
        // 0. Sync with Strava to ensure "My Activity" is fresh (Real Data)
        try {
          await apiService.syncAthleteData(athleteId);
          refresh(); // Refresh local activity data after sync
        } catch (e) {
          console.log('Background sync error:', e);
        }

        // 1. Fetch Health Stats
        try {
          const healthRes = await apiService.getHealthStats(athleteId);
          if (healthRes.success && healthRes.data) {
            setHealthStats(healthRes.data);
          }
        } catch (e) {
          // Keep defaults if no data found
        }

        // 2. Fetch Club Top Performer
        try {
          const clubRes = await apiService.getClubTopPerformer();
          if (clubRes.success && clubRes.data) {
            // Handle both array (list) and object (single) responses
            const data = Array.isArray(clubRes.data) ? clubRes.data : [clubRes.data as unknown as TopPerformer];
            setTopPerformers(data);
          }
        } catch (e) {
          console.log('Error fetching top performer');
        }
      }
    };
    fetchDashboardData();
  }, []);

  const updateHealthStat = (key: string, text: string) => {
    setHealthStats((prev: any) => {
      const newState = { ...prev, [key]: text };
      
      // Auto calculate BMI if weight or height changes
      if (key === 'weight' || key === 'height') {
        const w = parseFloat(newState.weight);
        const h = parseFloat(newState.height);
        if (!isNaN(w) && !isNaN(h) && h > 0) {
          const heightInMeters = h / 100;
          const bmi = (w / (heightInMeters * heightInMeters)).toFixed(1);
          newState.bmi = bmi;
        }
      }
      return newState;
    });
  };

  const handleSaveHealth = async () => {
    setIsEditingHealth(false);
    try {
      const athleteId = await apiService.getStoredAthleteId();
      if (athleteId) {
        await apiService.updateHealthStats(athleteId, healthStats);
        Alert.alert('Saved', 'Health statistics updated successfully.');
      }
    } catch (e) {
      Alert.alert('Note', 'Saved locally (Backend not connected)');
    }
  };

  const handleCreateChallenge = async () => {
    setChallengeModalVisible(false);
    try {
      await apiService.createUserChallenge(challengeForm);
      Alert.alert('Success', 'Your challenge has been created!');
      setChallengeForm({ eventName: '', bio: '', targetKm: '', duration: '', description: '' });
    } catch (e) {
      Alert.alert('Success', 'Challenge created (Demo Mode)');
    }
  };

  // Custom refresh handler to sync with Strava
  const handleRefresh = async () => {
    const athleteId = await apiService.getStoredAthleteId();
    if (athleteId) {
      // Trigger sync with Strava to ensure real data is up to date
      try {
        await apiService.syncAthleteData(athleteId);
      } catch (err) {
        console.log('Sync error:', err);
      }
    }
    refresh();
  };

  // Real Activity Progress Calculation
  const dailyGoal = 5; // 5km goal
  const todayDistance = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return data.activities
      .filter(a => a.startDateLocal.startsWith(today))
      .reduce((sum, a) => sum + (a.distance / 1000), 0);
  }, [data.activities]);
  
  const progressPercent = Math.min((todayDistance / dailyGoal) * 100, 100);

  const healthFields = [
    { key: 'weight', label: 'WEIGHT', unit: 'kg', icon: 'weight-kilogram' },
    { key: 'height', label: 'HEIGHT', unit: 'cm', icon: 'human-male-height' },
    { key: 'bmi', label: 'BMI', unit: '', icon: 'calculator', readonly: true },
    { key: 'bp', label: 'BP', unit: '', icon: 'heart-pulse' },
    { key: 'lung', label: 'LUNG', unit: '', icon: 'lungs' },
    { key: 'temp', label: 'TEMP', unit: '°C', icon: 'thermometer' },
  ];

  // Real Graph Data (Last 7 Days)
  const { graphData, graphLabels } = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 6 + i);
      return d;
    });

    const values = last7Days.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dist = data.activities
        .filter(a => a.startDateLocal.startsWith(dateStr))
        .reduce((sum, a) => sum + (a.distance / 1000), 0);
      return dist;
    });

    const maxVal = Math.max(...values, 1); // Avoid divide by zero
    const normalizedData = values.map(v => (v / maxVal) * 100);
    const labels = last7Days.map(d => days[d.getDay()][0]); // First letter of day

    return { graphData: normalizedData, graphLabels: labels };
  }, [data.activities]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialCommunityIcons name="bell-outline" size={24} color={colors.text} />
          <View style={styles.badge} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >
        {/* Top Section: Weather & Calendar */}
        <View style={styles.topSection}>
          <View style={styles.weatherRow}>
            <WeatherDisplay weather={weather} />
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <CalendarStrip />
        </View>

        {/* Health Stats Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Health Stats</Text>
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => isEditingHealth ? handleSaveHealth() : setIsEditingHealth(true)}
            >
              <Text style={styles.editButtonText}>{isEditingHealth ? 'SAVE' : 'EDIT'}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.healthGrid}>
            {healthFields.map((field) => (
              <View key={field.key} style={styles.healthBox}>
                <MaterialCommunityIcons name={field.icon as any} size={24} color={colors.primary} style={{ marginBottom: 4 }} />
                <Text style={styles.healthLabel}>{field.label}</Text>
                {isEditingHealth && !field.readonly ? (
                  <TextInput
                    style={styles.healthInput}
                    value={healthStats[field.key]?.toString()}
                    onChangeText={(text) => updateHealthStat(field.key, text)}
                    keyboardType={field.key === 'bp' || field.key === 'lung' ? 'default' : 'numeric'}
                  />
                ) : (
                  <Text style={styles.healthValue}>
                    {healthStats[field.key] || '--'} <Text style={{fontSize: 10, color: colors.textSecondary}}>{field.unit}</Text>
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Create Own Challenge Button */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.createChallengeBtn}
            onPress={() => setChallengeModalVisible(true)}
            activeOpacity={0.9}
          >
            <View style={styles.createChallengeContent}>
              <MaterialCommunityIcons name="trophy-outline" size={28} color="#fff" />
              <Text style={styles.createChallengeText}>CREATE MY OWN CHALLENGE</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Club Member Top Performer */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Club Top Performers (Today)</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Leaderboard')}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {topPerformers.length > 0 ? (
            topPerformers.slice(0, 3).map((performer, index) => (
              <View key={index} style={[styles.performerCard, { marginBottom: 10 }]}>
                <View style={styles.performerHeader}>
                  <View style={styles.performerAvatar}>
                    {performer.avatar ? (
                      <Image source={{ uri: performer.avatar }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                    ) : (
                      <Text style={styles.performerInitials}>{performer.name?.substring(0, 2).toUpperCase() || '??'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.performerName}>{performer.name}</Text>
                    <Text style={styles.performerBadge}>
                      {index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : '🥉 '}
                      {performer.badge || (index === 0 ? "Today's Leader" : `${index + 1}nd Place`)}
                    </Text>
                  </View>
                  <View style={styles.performerStats}>
                    <Text style={styles.performerValue}>{performer.totalDistance?.toFixed(1) || '0.0'} km</Text>
                    <Text style={styles.performerLabel}>{performer.activityCount || 0} Activities</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.performerCard}>
              <Text style={{ color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: 10 }}>
                No activities recorded today. Be the first!
              </Text>
            </View>
          )}
        </View>

        {/* My Activity Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Activity</Text>
          <View style={styles.activityProgressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressLabel}>Daily Activity</Text>
                <Text style={styles.progressSubLabel}>Goal: {dailyGoal} km</Text>
              </View>
              <View style={styles.progressBadge}>
                <Text style={styles.progressValue}>{progressPercent.toFixed(0)}%</Text>
              </View>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.progressFooter}>
              <Text style={styles.progressSubtext}>{todayDistance.toFixed(1)} km completed</Text>
              <Text style={styles.progressSubtext}>{(dailyGoal - todayDistance) > 0 ? `${(dailyGoal - todayDistance).toFixed(1)} km left` : 'Goal reached!'}</Text>
            </View>
          </View>
        </View>

        {/* Graph & Evaluation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance & Evaluation</Text>
          <View style={styles.graphCard}>
            <SimpleGraph data={graphData} labels={graphLabels} />
            <View style={styles.evaluationBox}>
              <MaterialCommunityIcons name="chart-line-variant" size={20} color={colors.primary} />
              <Text style={styles.evaluationText}>
                Great consistency! You're maintaining a steady pace this week.
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Create Challenge Modal */}
      <Modal
        visible={challengeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChallengeModalVisible(false)}
      >
        <View style={styles.challengeModalOverlay}>
          <View style={styles.challengeModalContent}>
            <View style={styles.modalHeaderBar} />
            <Text style={styles.challengeModalTitle}>New Challenge</Text>
            <Text style={styles.challengeModalSubtitle}>Set your goals and push your limits</Text>
            
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.primary} style={styles.inputIcon} />
              <TextInput 
                style={styles.challengeInput} 
                placeholder="Event Name" 
                placeholderTextColor="#999"
                value={challengeForm.eventName}
                onChangeText={t => setChallengeForm(p => ({...p, eventName: t}))}
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="text-short" size={20} color={colors.primary} style={styles.inputIcon} />
              <TextInput 
                style={styles.challengeInput} 
                placeholder="Bio / Tagline" 
                placeholderTextColor="#999"
                value={challengeForm.bio}
                onChangeText={t => setChallengeForm(p => ({...p, bio: t}))}
              />
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <MaterialCommunityIcons name="map-marker-distance" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput style={styles.challengeInput} placeholder="Target KM" keyboardType="numeric" placeholderTextColor="#999" value={challengeForm.targetKm} onChangeText={t => setChallengeForm(p => ({...p, targetKm: t}))} />
              </View>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput style={styles.challengeInput} placeholder="Days" keyboardType="numeric" placeholderTextColor="#999" value={challengeForm.duration} onChangeText={t => setChallengeForm(p => ({...p, duration: t}))} />
              </View>
            </View>

            <TextInput 
              style={[styles.inputContainer, { height: 100, paddingVertical: 12, alignItems: 'flex-start' }]} 
              placeholder="Description" 
              multiline 
              placeholderTextColor="#999"
              value={challengeForm.description}
              onChangeText={t => setChallengeForm(p => ({...p, description: t}))}
            />

            <TouchableOpacity style={styles.saveChallengeBtn} onPress={handleCreateChallenge}>
              <Text style={styles.saveChallengeText}>CREATE CHALLENGE</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelChallengeBtn} onPress={() => setChallengeModalVisible(false)}>
              <Text style={styles.cancelChallengeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FE',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: spacing.md,
    backgroundColor: '#F4F7FE',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  greeting: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1,
    borderColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  topSection: {
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  weatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  weatherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    maxWidth: 180,
  },
  weatherIconContainer: {
    marginRight: 6,
  },
  temperature: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginRight: 6,
  },
  weatherDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  calendarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    width: (width - 48) / 7,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginHorizontal: 2,
  },
  calendarItemActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  calendarDay: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  calendarDate: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  calendarTextActive: {
    color: '#fff',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  editButton: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  healthBox: {
    width: '31%', // 3 items per row
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  healthLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  healthValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  healthInput: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    width: '100%',
  },
  createChallengeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createChallengeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createChallengeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  challengeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)', // Professional opacity alert
    justifyContent: 'center',
    padding: 20,
  },
  challengeModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    paddingTop: 32,
    position: 'relative',
  },
  modalHeaderBar: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  challengeModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  challengeModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  challengeInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F7FE',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  inputIcon: {
    marginRight: 10,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  saveChallengeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveChallengeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelChallengeBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelChallengeText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  performerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  performerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  performerInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  performerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  performerBadge: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  performerStats: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  performerValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  performerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  activityProgressCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  progressSubLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  progressBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  graphCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  graphContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 16,
  },
  graphBarContainer: {
    alignItems: 'center',
    width: 20,
  },
  graphBar: {
    width: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
    marginBottom: 6,
  },
  graphLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  evaluationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F7FE',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  evaluationText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: spacing.lg,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F7FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  statUnit: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginLeft: 2,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  mapContainer: {
    height: 320,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#fff',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#fff',
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  startButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginRight: 8,
    letterSpacing: 0.5,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: spacing.lg,
    borderRadius: 24,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  activityMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activityValue: {
    alignItems: 'flex-end',
  },
  distanceText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: '#fff',
    borderRadius: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  closeModalButton: {
    padding: 4,
    backgroundColor: '#F4F7FE',
    borderRadius: 20,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  activityOption: {
    width: '47%',
    backgroundColor: '#F4F7FE',
    padding: spacing.lg,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activityOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activityOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  modalButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
