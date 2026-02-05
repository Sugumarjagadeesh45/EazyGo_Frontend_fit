import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '../constants/colors';
import { spacing, borderRadius } from '../constants/spacing';

import { ChallengesScreenProps } from '../navigation/types';
import apiService, { Challenge } from '../services/apiService';

export default function ChallengesScreen({ }: ChallengesScreenProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      const response = await apiService.getChallenges();
      if (response.success && response.data) {
        setChallenges(response.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not fetch challenges.');
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    Alert.alert('Joining Challenge', 'This feature is coming soon!');
    // TODO: Implement apiService.joinChallenge(challengeId) and update UI
  };

  const activeChallenges = challenges.filter(c => c.isActive && c.userProgress?.joined);
  const discoverChallenges = challenges.filter(c => !c.userProgress?.joined);
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Challenges</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>My Challenges</Text>
            {activeChallenges.length > 0 ? activeChallenges.map((challenge) => (
              <TouchableOpacity key={challenge._id || challenge.id} style={styles.challengeCard} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: (challenge.badge?.color || colors.primary) + '15' }]}>
                    <MaterialCommunityIcons name={(challenge.badge?.icon || 'trophy') as any} size={28} color={challenge.badge?.color || colors.primary} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Text style={styles.challengeEnds}>Ends in {challenge.daysRemaining} days</Text>
                  </View>
                  {challenge.isActive && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Active</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.description}>{challenge.description}</Text>
                
                {challenge.userProgress && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>Progress</Text>
                      <Text style={styles.progressPercent}>{challenge.userProgress.percentage || 0}%</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { width: `${challenge.userProgress.percentage || 0}%`, backgroundColor: challenge.badge?.color || colors.primary }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressStats}>
                      {((challenge.userProgress.currentValue || 0) / 1000).toFixed(1)} / {(challenge.targetValue / 1000).toFixed(1)} {challenge.targetType === 'distance' ? 'km' : 'activities'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )) : (
              <Text style={styles.emptyText}>You haven't joined any challenges yet.</Text>
            )}

            <Text style={styles.sectionTitle}>Discover</Text>
            {discoverChallenges.length > 0 ? discoverChallenges.map(challenge => (
              <View key={challenge._id || challenge.id} style={styles.discoverCard}>
                <View style={styles.discoverContent}>
                  <Text style={styles.discoverTitle}>{challenge.title}</Text>
                  <Text style={styles.discoverDesc}>{challenge.description}</Text>
                  <TouchableOpacity style={styles.joinButton} onPress={() => handleJoinChallenge(challenge.id)}>
                    <Text style={styles.joinButtonText}>Join Challenge</Text>
                  </TouchableOpacity>
                </View>
                <MaterialCommunityIcons name={(challenge.badge?.icon || 'trophy-outline') as any} size={80} color={(challenge.badge?.color || colors.primary) + '20'} style={styles.discoverIcon} />
              </View>
            )) : (
              <Text style={styles.emptyText}>No new challenges to discover right now.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F7FE',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    letterSpacing: -0.5,
  },
  challengeCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  challengeEnds: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: colors.success + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#F4F7FE',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressStats: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    fontWeight: '500',
  },
  discoverCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  discoverContent: {
    flex: 1,
    paddingRight: spacing.md,
    zIndex: 1,
  },
  discoverTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  discoverDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  joinButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  discoverIcon: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    transform: [{ rotate: '-15deg' }],
  },
});
