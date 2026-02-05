import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { ProfileScreenProps } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useAthleteData, formatDistance } from '../hooks/useAthleteData';

const SettingsItem = ({ icon, label, value, onPress, color = colors.text }: any) => (
  <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
    <View style={styles.settingsLeft}>
      <View style={styles.settingsIconBox}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.textSecondary} />
      </View>
      <Text style={[styles.settingsLabel, { color }]}>{label}</Text>
    </View>
    <View style={styles.settingsRight}>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </View>
  </TouchableOpacity>
);

export default function ProfileScreen({}: ProfileScreenProps) {
  const { user, logout } = useAuth();
  const { data, isLoading, isRefreshing, refresh, syncFromStrava } = useAthleteData();

  // Get user display name
  const displayName = data.profile
    ? `${data.profile.firstName} ${data.profile.lastName}`.trim()
    : user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : 'Athlete';

  // Get initials
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Get profile image
  const profileImage = data.profile?.profile || data.profile?.profileMedium || null;

  // Get location
  const location = data.profile
    ? [data.profile.city, data.profile.state, data.profile.country].filter(Boolean).join(', ')
    : '';

  // Calculate stats from API data
  const dynamicStats = data.profile?.dynamicStats;
  const totalActivities = dynamicStats?.totalActivities || 0;
  const totalDistance = dynamicStats?.totalDistanceKM || 0;
  const totalHours = dynamicStats?.totalHours || 0;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} colors={[colors.primary]} />
        }
      >
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.editBadge}>
              <MaterialCommunityIcons name="pencil" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {location ? (
            <Text style={styles.location}>{location}</Text>
          ) : (
            <Text style={styles.location}>Location not set</Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="run" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{totalActivities}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="map-marker-distance" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{totalDistance.toFixed(0)}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.statValue}>{totalHours.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Hours</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <SettingsItem icon="account-outline" label="Personal Details" />
            <SettingsItem icon="trophy-outline" label="Achievements" />
            <SettingsItem icon="history" label="Activity History" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strava</Text>
          <View style={styles.card}>
            <SettingsItem
              icon="refresh"
              label="Sync from Strava"
              onPress={syncFromStrava}
            />
            <SettingsItem
              icon="strava"
              label="Connected Account"
              value={data.profile?.username || 'Connected'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <SettingsItem icon="bell-outline" label="Notifications" value="On" />
            <SettingsItem icon="shield-outline" label="Privacy" />
            <SettingsItem icon="cog-outline" label="Settings" />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 60 : 60,
    paddingBottom: spacing.xl,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '85%',
    justifyContent: 'space-between',
    backgroundColor: '#F4F7FE',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#D0D7E5',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconBox: {
    width: 36,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  settingsLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsValue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: spacing.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  logoutText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 16,
  },
});
