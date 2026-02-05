import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { LeaderboardScreenProps } from '../navigation/types';
import { apiService, LeaderboardUser } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { formatDuration } from '../hooks/useAthleteData';

// Format distance in km
const formatDistance = (meters: number): string => {
  const km = meters / 1000;
  return km.toFixed(1);
};

const ACTIVITY_TYPES = ['All Activities', 'Walk', 'Run', 'Cycle Ride', 'Swim', 'Hike', 'WeightTraining', 'Workout', 'Yoga'];

export default function LeaderboardScreen({}: LeaderboardScreenProps) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [activityType, setActivityType] = useState('All Activities');
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async (fetchPeriod: 'week' | 'month', fetchType: string, isRefresh = false) => {
    console.log(`🔄 [Leaderboard] Fetching: period=${fetchPeriod}, type=${fetchType}`);
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await apiService.getLeaderboard(fetchPeriod, fetchType);
      
      // Handle new backend response format (users) with fallback to data
      const rawData = response.users || response.data || [];

      if (response.success) {
        // Mark current user in the leaderboard
        const dataWithCurrentUser = rawData.map((item, index) => ({
          ...item,
          rank: index + 1, // Ensure rank is set based on array order
          // Fallback for name if using old data structure
          name: item.name || `${(item as any).firstName || ''} ${(item as any).lastName || ''}`.trim() || (item as any).username,
          isCurrentUser: item.athleteId === user?.athleteId, // Note: Backend might need to return athleteId for this to work
        }));
        setLeaderboard(dataWithCurrentUser);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.athleteId]);

  useEffect(() => {
    fetchLeaderboard(period, activityType);
  }, [period, activityType, fetchLeaderboard]);

  const handleRefresh = () => {
    fetchLeaderboard(period, activityType, true);
  };

  const topThree = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const renderPodium = () => {
    if (topThree.length < 3) {
      return null;
    }

    return (
      <View style={styles.podiumContainer}>
        {/* 2nd Place */}
        <View style={styles.podiumItem}>
          <View style={[styles.podiumAvatar, { borderColor: colors.silver }]}>
            {topThree[1].profile ? (
              <Image source={{ uri: topThree[1].profile }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {(topThree[1].name || '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>
            {topThree[1].name}
          </Text>
          <Text style={styles.podiumValue}>{topThree[1].totalDistanceKM?.toFixed(1) || formatDistance((topThree[1] as any).totalDistance || 0)} km</Text>
          <View style={[styles.podiumRank, { backgroundColor: colors.silver, height: 70 }]}>
            <Text style={styles.rankNumber}>2</Text>
          </View>
        </View>

        {/* 1st Place */}
        <View style={[styles.podiumItem, { marginHorizontal: 12, marginBottom: 20 }]}>
          <MaterialCommunityIcons
            name="crown"
            size={28}
            color={colors.gold}
            style={{ marginBottom: 8 }}
          />
          <View
            style={[
              styles.podiumAvatar,
              { borderColor: colors.gold, width: 80, height: 80, borderRadius: 40 },
            ]}
          >
            {topThree[0].profile ? (
              <Image
                source={{ uri: topThree[0].profile }}
                style={[styles.avatarImage, { width: 72, height: 72, borderRadius: 36 }]}
              />
            ) : (
              <Text style={[styles.avatarText, { fontSize: 28 }]}>
                {(topThree[0].name || '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={[styles.podiumName, { fontWeight: '700', fontSize: 12 }]} numberOfLines={1}>
            {topThree[0].name}
          </Text>
          <Text style={styles.podiumValue}>{topThree[0].totalDistanceKM?.toFixed(1) || formatDistance((topThree[0] as any).totalDistance || 0)} km</Text>
          <View style={[styles.podiumRank, { backgroundColor: colors.gold, height: 100 }]}>
            <Text style={styles.rankNumber}>1</Text>
          </View>
        </View>

        {/* 3rd Place */}
        <View style={styles.podiumItem}>
          <View style={[styles.podiumAvatar, { borderColor: colors.bronze }]}>
            {topThree[2].profile ? (
              <Image source={{ uri: topThree[2].profile }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {(topThree[2].name || '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>
            {topThree[2].name}
          </Text>
          <Text style={styles.podiumValue}>{topThree[2].totalDistanceKM?.toFixed(1) || formatDistance((topThree[2] as any).totalDistance || 0)} km</Text>
          <View style={[styles.podiumRank, { backgroundColor: colors.bronze, height: 50 }]}>
            <Text style={styles.rankNumber}>3</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTopThreeStats = () => {
    if (topThree.length === 0) {
      return null;
    }

    return (
      <View style={styles.topThreeStatsContainer}>
        <Text style={styles.topThreeStatsTitle}>Top 3 Stats</Text>
        {topThree.map((item, index) => (
          <View key={index} style={styles.topThreeStatRow}>
            <View style={styles.topThreeRankBadge}>
              <Text style={styles.topThreeRankText}>{index + 1}</Text>
            </View>
            <View style={styles.topThreeInfo}>
              <Text style={styles.topThreeName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <View style={styles.topThreeStatsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.primary} />
                <Text style={styles.statValue}>{item.totalDistanceKM?.toFixed(1) || formatDistance((item as any).totalDistance || 0)} km</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="fire" size={14} color={colors.error} />
                <Text style={styles.statValue}>{item.caloriesBurned || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.warning} />
                <Text style={styles.statValue}>{formatDuration((item.totalTimeMinutes || 0) * 60)}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <View style={styles.periodSelector}>
          {[
            { key: 'week', label: '7 Days' },
            { key: 'month', label: '30 Days' },
          ].map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodTab, period === p.key && styles.activePeriodTab]}
              onPress={() => setPeriod(p.key as 'week' | 'month')}
            >
              <Text style={[styles.periodText, period === p.key && styles.activePeriodText]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Activity Type Selector */}
        <View style={styles.typeSelectorContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeSelectorContent}>
            {ACTIVITY_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, activityType === type && styles.typeChipActive]}
                onPress={() => setActivityType(type)}
              >
                <Text style={[styles.typeText, activityType === type && styles.typeTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {leaderboard.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="podium" size={64} color={colors.textMuted} />
          <Text style={styles.emptyStateTitle}>No Rankings Yet</Text>
          <Text style={styles.emptyStateText}>
            Be the first to log activities and climb the leaderboard!
          </Text>
        </View>
      ) : (
        <FlatList
          data={rest}
          ListHeaderComponent={
            <>
              {renderPodium()}
              {renderTopThreeStats()}
              {rest.length > 0 && (
                <Text style={styles.othersTitle}>Other Rankings</Text>
              )}
            </>
          }
          keyExtractor={(item, index) => (item.athleteId ? item.athleteId.toString() : index.toString())}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item, index }) => (
            <View style={[styles.rankRow, item.isCurrentUser && styles.currentUserRow]}>
              <View style={styles.rankContainer}>
                <Text style={styles.rankIndex}>{item.rank || (index + 4)}</Text>
              </View>
              <View style={styles.listAvatar}>
                {item.profile ? (
                  <Image source={{ uri: item.profile }} style={styles.listAvatarImage} />
                ) : (
                  <Text style={styles.listAvatarText}>
                    {(item.name || '?')[0].toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {item.name}
                  {item.isCurrentUser && ' (You)'}
                </Text>
                <View style={styles.userStatsRow}>
                  <Text style={styles.userStats}>
                    {item.caloriesBurned ? `${item.caloriesBurned} kcal` : ''} 
                    {item.caloriesBurned && item.totalElevationGainMeters ? ' • ' : ''}
                    {item.totalElevationGainMeters ? `${item.totalElevationGainMeters}m elev` : ''}
                    {(!item.caloriesBurned && !item.totalElevationGainMeters) ? formatDuration((item.totalTimeMinutes || 0) * 60) : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.distanceText}>{item.totalDistanceKM?.toFixed(1) || formatDistance((item as any).totalDistance || 0)} km</Text>
            </View>
          )}
          ListEmptyComponent={
            topThree.length > 0 ? null : (
              <View style={styles.emptyListState}>
                <Text style={styles.emptyListText}>No other rankings available</Text>
              </View>
            )
          }
        />
      )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: spacing.md,
    backgroundColor: '#F4F7FE',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.lg,
    letterSpacing: -1,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: spacing.md,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activePeriodTab: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activePeriodText: {
    color: '#fff',
    fontWeight: '700',
  },
  // Type Selector Styles
  typeSelectorContainer: {
    marginBottom: spacing.xs,
  },
  typeSelectorContent: {
    paddingRight: spacing.lg,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: spacing.xl,
    paddingBottom: 0,
    marginBottom: spacing.lg,
  },
  podiumItem: {
    alignItems: 'center',
    width: 100,
  },
  podiumAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 20,
  },
  podiumName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    maxWidth: 90,
  },
  podiumValue: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  podiumRank: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rankNumber: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 24,
    marginTop: 12,
  },
  // Top 3 Stats Section
  topThreeStatsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.lg,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topThreeStatsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  topThreeStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F7FE',
  },
  topThreeRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  topThreeRankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  topThreeInfo: {
    flex: 1,
  },
  topThreeName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  topThreeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Others Section
  othersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  currentUserRow: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#F4F7FE',
  },
  rankContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  rankIndex: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  listAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  listAvatarText: {
    fontWeight: '700',
    color: colors.text,
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userStats: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyListState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyListText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
