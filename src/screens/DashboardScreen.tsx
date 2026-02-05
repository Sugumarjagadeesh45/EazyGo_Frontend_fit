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
import { apiService, WeatherData } from '../services/apiService';

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

// ============ MAIN SCREEN ============

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { user } = useAuth();
  const { data, isLoading, isRefreshing, refresh } = useAthleteData();
  const [modalVisible, setModalVisible] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

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
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[colors.primary]} />
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

        {/* Stats Section - Cumulative from account creation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Total Distance" value={totalDistance.toFixed(1)} unit="km" icon="map-marker-distance" />
            <StatCard label="Total Activities" value={totalActivities} icon="run" />
            <StatCard label="Total Hours" value={totalHours.toFixed(0)} unit="hrs" icon="clock-outline" />
            <StatCard label="Avg Pace" value={avgPace} unit="/km" icon="speedometer" />
          </View>
        </View>

        {/* Map Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Location</Text>
          <View style={styles.mapContainer}>
            <MapLibreGL.MapView
              style={styles.map}
              mapStyle={MAP_STYLE}
              logoEnabled={false}
              attributionEnabled={false}
              scrollEnabled={true}
              zoomEnabled={true}
            >
              <MapLibreGL.Camera
                defaultSettings={{
                  centerCoordinate: location ? [location.longitude, location.latitude] : [77.5946, 12.9716],
                  zoomLevel: 14,
                }}
                followUserLocation={!!location}
              />
              {location && (
                <MapLibreGL.PointAnnotation
                  id="userLocation"
                  coordinate={[location.longitude, location.latitude]}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <UserLocationDot />
                </MapLibreGL.PointAnnotation>
              )}
            </MapLibreGL.MapView>

            <View style={styles.mapOverlay}>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.9}
              >
                <Text style={styles.startButtonText}>START ACTIVITY</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Recent Activities - Last 3 Days */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Activities')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtitle}>Last 3 days</Text>

          {recentActivities.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="run" size={48} color={colors.textMuted} />
              <Text style={styles.emptyStateText}>No activities in the last 3 days</Text>
              <Text style={styles.emptyStateSubtext}>Start tracking to see your activities here</Text>
            </View>
          ) : (
            recentActivities.slice(0, 5).map((activity) => {
              const activityColor = getActivityColor(activity.type);
              const activityLabel = activity.name || getActivityTimeLabel(activity.startDateLocal, activity.type);
              return (
                <TouchableOpacity key={activity.stravaActivityId} style={styles.activityCard} activeOpacity={0.7}>
                  <View style={[styles.activityIcon, { backgroundColor: activityColor + '15' }]}>
                    <MaterialCommunityIcons
                      name={getActivityIcon(activity.type) as any}
                      size={24}
                      color={activityColor}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>{activityLabel}</Text>
                    <Text style={styles.activityMeta}>
                      {formatDate(activity.startDateLocal)} • {formatDuration(activity.movingTime)}
                    </Text>
                  </View>
                  <View style={styles.activityValue}>
                    <Text style={styles.distanceText}>{formatDistance(activity.distance)} km</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      <ActivityModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onStart={handleStartActivity}
      />
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
