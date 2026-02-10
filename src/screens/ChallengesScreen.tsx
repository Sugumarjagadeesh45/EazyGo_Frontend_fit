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
  Image,
  RefreshControl,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '../constants/colors';
import { spacing, borderRadius } from '../constants/spacing';

import { ChallengesScreenProps } from '../navigation/types';
import apiService, { Challenge } from '../services/apiService';

// Define a local interface to handle the mapped data including images
interface UIChallenge {
  id: string;
  title: string;
  description: string;
  daysRemaining: number;
  isActive: boolean;
  targetValue: number;
  targetType: string;
  badge?: {
    icon: string;
    color: string;
  };
  userProgress?: {
    joined: boolean;
    percentage: number;
    currentValue: number;
  };
  image?: string;
  startDate?: string;
  endDate?: string;
  distance?: number;
  duration?: string | number;
}

interface UIAward {
  id: string;
  title: string;
  date: string;
  time: string;
  image?: string;
  description: string;
}

// Helper to calculate days remaining
const calculateDaysRemaining = (dateString: string) => {
  if (!dateString) return 0;
  const end = new Date(dateString);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// Helper to format date
const formatDate = (dateString?: string) => {
  if (!dateString) return 'Date TBD';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

// Helper to get icon based on event type
const getEventIcon = (type: string) => {
  const t = type?.toLowerCase() || '';
  if (t.includes('run')) return 'run';
  if (t.includes('cycle') || t.includes('ride') || t.includes('bike')) return 'bike';
  if (t.includes('swim')) return 'swim';
  if (t.includes('walk')) return 'walk';
  return 'trophy';
};

// Helper to get color based on event type
const getEventColor = (type: string) => {
  const t = type?.toLowerCase() || '';
  if (t.includes('run')) return colors.primary;
  if (t.includes('cycle') || t.includes('ride')) return colors.secondary || '#FF9800';
  if (t.includes('swim')) return '#00BCD4';
  return colors.primary;
};

export default function ChallengesScreen({ }: ChallengesScreenProps) {
  const [challenges, setChallenges] = useState<UIChallenge[]>([]);
  const [myChallenges, setMyChallenges] = useState<UIChallenge[]>([]);
  const [awards, setAwards] = useState<UIAward[]>([]);
  const [activeTab, setActiveTab] = useState<'discover' | 'my_challenges' | 'awards'>('discover');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchChallenges();
    fetchAwards();
  }, []);

  const fetchChallenges = async () => {
    try {
      // Only show loading indicator on initial load, not refresh
      // if (!refreshing) setLoading(true); // Handled by combined loading state if needed
      
      console.log('🚀 Fetching challenges from API...');
      const athleteId = await apiService.getStoredAthleteId();

      // 1. Fetch All Events (Discover)
      const response = await apiService.getChallenges(); // Calls /api/events
      
      // Handle response structure: { success: true, events: [...] } or { data: [...] } or direct Array
      let eventsList = [];
      if (Array.isArray(response)) {
        eventsList = response;
      } else if (response && typeof response === 'object') {
        eventsList = response.events || response.data || [];
      }
      
      console.log(`✅ Found ${eventsList.length} challenges`);

      // 2. Fetch My Challenges
      let myEventsList = [];
      if (athleteId) {
        try {
          const myResponse = await apiService.getMyChallenges(athleteId);
          if (Array.isArray(myResponse)) {
            myEventsList = myResponse;
          } else if (myResponse && typeof myResponse === 'object') {
            myEventsList = (myResponse as any).data || [];
          }
        } catch (e) {
          console.log('ℹ️ My Challenges endpoint not available yet (skipping)');
        }
      }

      // Map My Challenges
      const mappedMyChallenges: UIChallenge[] = myEventsList.map((event: any) => ({
        id: event._id || event.id,
        title: event.eventName || event.title || 'Untitled Event',
        description: event.description || '',
        daysRemaining: calculateDaysRemaining(event.endDate),
        isActive: true,
        targetValue: (event.distance || 0) * 1000,
        targetType: 'distance',
        badge: {
          icon: getEventIcon(event.eventType),
          color: getEventColor(event.eventType),
        },
        image: event.eventBanner,
        userProgress: { joined: true, percentage: 0, currentValue: 0 },
        startDate: event.startDate,
        endDate: event.endDate,
        distance: event.distance,
        duration: event.duration,
      }));
      setMyChallenges(mappedMyChallenges);
      
      const joinedIds = new Set(myEventsList.map((e: any) => e._id || e.id));
      
      if (Array.isArray(eventsList)) {
        const mappedChallenges: UIChallenge[] = eventsList.map((event: any) => ({
          id: event._id || event.id,
          title: event.eventName || event.title || 'Untitled Event',
          description: event.description || '',
          daysRemaining: calculateDaysRemaining(event.endDate),
          isActive: true, // Assuming listed events are active
          targetValue: (event.distance || 0) * 1000, // Convert KM to meters
          targetType: 'distance',
          badge: {
            icon: getEventIcon(event.eventType),
            color: getEventColor(event.eventType),
          },
          image: event.eventBanner, // Relative path from backend
          userProgress: { 
            joined: joinedIds.has(event._id || event.id), 
            percentage: 0, 
            currentValue: 0 
          },
          startDate: event.startDate,
          endDate: event.endDate,
          distance: event.distance,
          duration: event.duration,
        }));
        setChallenges(mappedChallenges);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
      Alert.alert('Error', 'Could not fetch challenges. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAwards = async () => {
    try {
      console.log('🏆 Fetching awards...');
      const response = await apiService.getAwards();
      
      // Handle response structure robustly
      let awardsList = [];
      if (Array.isArray(response)) {
        awardsList = response;
      } else if (response && typeof response === 'object') {
        awardsList = (response as any).awards || response.data || [];
      }
      
      console.log(`🏆 Found ${awardsList.length} awards`);

      if (Array.isArray(awardsList)) {
        const mappedAwards: UIAward[] = awardsList.map((award: any) => ({
          id: award._id || award.id,
          title: award.eventName || 'Untitled Award',
          date: award.startDate || award.eventDate,
          time: (award.startTime && award.endTime) ? `${award.startTime} - ${award.endTime}` : (award.startTime || 'Time TBD'),
          image: award.eventBanner,
          description: award.description || '',
        }));
        setAwards(mappedAwards);
      }
    } catch (error) {
      console.error('Error fetching awards:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchChallenges(), fetchAwards()]).finally(() => {
      setRefreshing(false);
    });
  };

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      const athleteId = await apiService.getStoredAthleteId();
      if (!athleteId) {
        Alert.alert('Error', 'You must be logged in to join challenges.');
        return;
      }

      let success = false;
      try {
        await apiService.joinChallenge(challengeId, athleteId);
        success = true;
      } catch (e) {
        console.log('Backend join endpoint missing, using optimistic update');
      }

      if (success) {
        // Refresh to update lists from server
        fetchChallenges();
      } else {
        // Optimistic update: Manually update local state if backend is missing
        const challengeIndex = challenges.findIndex(c => c.id === challengeId);
        if (challengeIndex !== -1) {
          const updatedChallenge = {
            ...challenges[challengeIndex],
            userProgress: {
              joined: true,
              percentage: 0,
              currentValue: 0
            }
          };

          // Update Discover list state
          const newChallenges = [...challenges];
          newChallenges[challengeIndex] = updatedChallenge;
          setChallenges(newChallenges);

          // Add to My Challenges state
          setMyChallenges(prev => [updatedChallenge, ...prev]);
        }
      }

      Alert.alert('Success', 'You have joined the challenge!');
      setActiveTab('my_challenges'); // Switch to My Challenges tab
    } catch (error) {
      Alert.alert('Error', 'Failed to join challenge.');
    }
  };

  // Helper to construct full image URL
  const getImageUrl = (path?: string) => {
    if (!path) return null;
    
    // Fix localhost URLs for Android Emulator (localhost -> 10.0.2.2)
    if (path.includes('localhost')) {
      return path.replace('localhost', '10.0.2.2');
    }

    if (path.startsWith('http')) return path;
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${apiService.getBaseUrl()}/${cleanPath}`;
  };

  const handleAddReminder = (title: string, dateString?: string) => {
    if (!dateString) {
      Alert.alert('Error', 'No date available for this event');
      return;
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      Alert.alert('Error', 'Invalid event date');
      return;
    }

    const url = Platform.select({
      ios: 'calshow:',
      android: `content://com.android.calendar/time/${date.getTime()}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open calendar app');
      });
    }
  };

  const renderChallengeCard = (challenge: UIChallenge, isJoined: boolean) => (
    <TouchableOpacity 
      key={challenge.id} 
      style={styles.proCard} 
      activeOpacity={0.9}
      onPress={() => isJoined ? null : handleJoinChallenge(challenge.id)}
    >
      {/* Banner Image */}
      <View style={styles.proCardImageContainer}>
        {challenge.image ? (
          <Image 
            source={{ uri: getImageUrl(challenge.image) }} 
            style={styles.proCardImage} 
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.proCardImagePlaceholder, { backgroundColor: challenge.badge?.color || colors.primary }]}>
            <MaterialCommunityIcons name={(challenge.badge?.icon || 'trophy') as any} size={64} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        <View style={styles.proCardTypeBadge}>
          <MaterialCommunityIcons name={(challenge.badge?.icon || 'trophy') as any} size={16} color="#fff" />
          <Text style={styles.proCardTypeText}>{challenge.targetType === 'distance' ? 'Distance' : 'Challenge'}</Text>
        </View>
      </View>

      <View style={styles.proCardContent}>
        <View style={styles.proCardHeader}>
          <Text style={styles.proCardTitle}>{challenge.title}</Text>
          {isJoined && <View style={styles.joinedBadge}><Text style={styles.joinedText}>Joined</Text></View>}
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar-start" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(challenge.startDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar-end" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(challenge.endDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{challenge.distance ? `${challenge.distance} km` : 'Open'}</Text>
          </View>
          {challenge.duration && (
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>{challenge.duration} mins</Text>
            </View>
          )}
        </View>

        <Text style={styles.proCardDescription} numberOfLines={2}>{challenge.description}</Text>

        {isJoined ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressPercent}>{challenge.userProgress?.percentage || 0}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${challenge.userProgress?.percentage || 0}%`, backgroundColor: challenge.badge?.color || colors.primary }
                ]} 
              />
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.proJoinButton} onPress={() => handleJoinChallenge(challenge.id)}>
            <Text style={styles.proJoinButtonText}>Join Challenge</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderAwardCard = (award: UIAward) => (
    <View key={award.id} style={styles.proCard}>
      <View style={styles.proCardImageContainer}>
        {award.image ? (
          <Image 
            source={{ uri: getImageUrl(award.image) }} 
            style={styles.proCardImage} 
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.proCardImagePlaceholder, { backgroundColor: '#FFD700' }]}>
            <MaterialCommunityIcons name="medal" size={64} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        <View style={[styles.proCardTypeBadge, { backgroundColor: 'rgba(255, 215, 0, 0.9)' }]}>
          <MaterialCommunityIcons name="star" size={16} color="#fff" />
          <Text style={styles.proCardTypeText}>Award Event</Text>
        </View>
      </View>

      <View style={styles.proCardContent}>
        <Text style={styles.proCardTitle}>{award.title}</Text>
        
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(award.date)}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>{award.time}</Text>
          </View>
        </View>

        <Text style={styles.proCardDescription}>{award.description}</Text>

        <TouchableOpacity 
          style={styles.reminderButton} 
          onPress={() => handleAddReminder(award.title, award.date)}
        >
          <MaterialCommunityIcons name="bell-ring-outline" size={16} color={colors.primary} />
          <Text style={styles.reminderButtonText}>Remind Me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const discoverChallenges = challenges; // Show all challenges in Discover

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Challenges</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'discover' && styles.activeTab]} onPress={() => setActiveTab('discover')}>
          <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>Discover</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'my_challenges' && styles.activeTab]} onPress={() => setActiveTab('my_challenges')}>
          <Text style={[styles.tabText, activeTab === 'my_challenges' && styles.activeTabText]}>My Challenges</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'awards' && styles.activeTab]} onPress={() => setActiveTab('awards')}>
          <Text style={[styles.tabText, activeTab === 'awards' && styles.activeTabText]}>Awards</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            {activeTab === 'my_challenges' && (
              myChallenges.length > 0 ? myChallenges.map(c => renderChallengeCard(c, true)) : (
                <Text style={styles.emptyText}>You haven't joined any challenges yet.</Text>
              )
            )}

            {activeTab === 'discover' && (
              discoverChallenges.length > 0 ? discoverChallenges.map(c => renderChallengeCard(c, !!c.userProgress?.joined)) : (
                <Text style={styles.emptyText}>No new challenges to discover right now.</Text>
              )
            )}

            {activeTab === 'awards' && (
              awards.length > 0 ? awards.map(a => renderAwardCard(a)) : (
                <Text style={styles.emptyText}>No upcoming award events.</Text>
              )
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
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
  // Professional Card Styles
  proCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  proCardImageContainer: {
    height: 160,
    width: '100%',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  proCardImage: {
    width: '100%',
    height: '100%',
  },
  proCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proCardTypeBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proCardTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  proCardContent: {
    padding: spacing.lg,
  },
  proCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  proCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  joinedBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  joinedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  proCardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  proJoinButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  proJoinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reminderButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 6,
  },
});
