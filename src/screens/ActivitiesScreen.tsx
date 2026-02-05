import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { ActivitiesScreenProps } from '../navigation/types';
import {
  useAthleteData,
  formatDistance,
  formatDuration,
  formatDate,
  getActivityIcon,
  getActivityColor,
} from '../hooks/useAthleteData';
import { Activity } from '../services/apiService';

const { width } = Dimensions.get('window');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Month Selector Component
const MonthSelector = ({
  selectedMonth,
  selectedYear,
  onPrevMonth,
  onNextMonth,
}: {
  selectedMonth: number;
  selectedYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) => {
  const today = new Date();
  const isCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear();

  return (
    <View style={styles.monthSelector}>
      <TouchableOpacity style={styles.monthNavButton} onPress={onPrevMonth}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.monthYearText}>
        {FULL_MONTHS[selectedMonth]} {selectedYear}
      </Text>
      <TouchableOpacity
        style={[styles.monthNavButton, isCurrentMonth && styles.monthNavButtonDisabled]}
        onPress={onNextMonth}
        disabled={isCurrentMonth}
      >
        <MaterialCommunityIcons
          name="chevron-right"
          size={28}
          color={isCurrentMonth ? colors.textMuted : colors.text}
        />
      </TouchableOpacity>
    </View>
  );
};

// Month Pills Component
const MonthPills = ({
  selectedMonth,
  selectedYear,
  onSelectMonth,
}: {
  selectedMonth: number;
  selectedYear: number;
  onSelectMonth: (month: number) => void;
}) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.monthPillsContainer}
    >
      {MONTHS.map((month, index) => {
        const isSelected = index === selectedMonth;
        const isFutureMonth = selectedYear === currentYear && index > currentMonth;

        return (
          <TouchableOpacity
            key={month}
            style={[
              styles.monthPill,
              isSelected && styles.monthPillSelected,
              isFutureMonth && styles.monthPillDisabled,
            ]}
            onPress={() => !isFutureMonth && onSelectMonth(index)}
            disabled={isFutureMonth}
          >
            <Text
              style={[
                styles.monthPillText,
                isSelected && styles.monthPillTextSelected,
                isFutureMonth && styles.monthPillTextDisabled,
              ]}
            >
              {month}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// Custom Calendar Component
const CalendarView = ({
  activities,
  selectedMonth,
  selectedYear,
}: {
  activities: Activity[];
  selectedMonth: number;
  selectedYear: number;
}) => {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const today = new Date();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();

  // Get days with activities for selected month
  const activityDays = new Set(
    activities
      .filter((a) => {
        const actDate = new Date(a.startDateLocal);
        return (
          actDate.getMonth() === selectedMonth &&
          actDate.getFullYear() === selectedYear
        );
      })
      .map((a) => new Date(a.startDateLocal).getDate())
  );

  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    return dayNum > 0 && dayNum <= daysInMonth ? dayNum : null;
  });

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      selectedMonth === today.getMonth() &&
      selectedYear === today.getFullYear()
    );
  };

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.weekRow}>
        {days.map((d, i) => (
          <Text key={i} style={styles.weekDayText}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {calendarDays.map((day, i) => (
          <View
            key={i}
            style={[styles.dayCell, day !== null && isToday(day) ? styles.todayCell : undefined]}
          >
            {day && (
              <Text
                style={[styles.dayText, isToday(day) && styles.todayText]}
              >
                {day}
              </Text>
            )}
            {day && activityDays.has(day) && <View style={styles.activityDot} />}
          </View>
        ))}
      </View>
    </View>
  );
};

export default function ActivitiesScreen({ navigation }: ActivitiesScreenProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'group'>('individual');
  const [modalVisible, setModalVisible] = useState(false);
  const { data, isLoading, isRefreshing, refresh } = useAthleteData();

  // Month filter state - default to current month
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Filter activities by selected month
  const filteredActivities = useMemo(() => {
    return data.activities.filter((activity) => {
      const actDate = new Date(activity.startDateLocal);
      return (
        actDate.getMonth() === selectedMonth &&
        actDate.getFullYear() === selectedYear
      );
    });
  }, [data.activities, selectedMonth, selectedYear]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Don't go beyond current month
    if (selectedYear === currentYear && selectedMonth >= currentMonth) {
      return;
    }

    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month);
  };

  const renderActivityItem = ({ item }: { item: Activity }) => {
    const activityColor = getActivityColor(item.type);
    return (
      <TouchableOpacity style={styles.activityCard}>
        <View style={[styles.iconContainer, { backgroundColor: activityColor + '15' }]}>
          <MaterialCommunityIcons
            name={getActivityIcon(item.type) as any}
            size={24}
            color={activityColor}
          />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardMeta}>
            {formatDate(item.startDateLocal)} • {formatDuration(item.movingTime)}
          </Text>
        </View>
        <Text style={styles.cardValue}>{formatDistance(item.distance)} km</Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activities</Text>
        <TouchableOpacity style={styles.filterButton}>
          <MaterialCommunityIcons name="filter-variant" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'individual' && styles.activeTab]}
          onPress={() => setActiveTab('individual')}
        >
          <Text
            style={[styles.tabText, activeTab === 'individual' && styles.activeTabText]}
          >
            Individual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'group' && styles.activeTab]}
          onPress={() => setActiveTab('group')}
        >
          <Text style={[styles.tabText, activeTab === 'group' && styles.activeTabText]}>
            Group
          </Text>
        </TouchableOpacity>
      </View>

      {/* Month Selector */}
      <MonthSelector
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* Month Pills */}
      <MonthPills
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelectMonth={handleSelectMonth}
      />

      {/* Activity Count Header */}
      <View style={styles.activityCountHeader}>
        <Text style={styles.activityCountText}>
          {filteredActivities.length} {filteredActivities.length === 1 ? 'Activity' : 'Activities'} in {FULL_MONTHS[selectedMonth]}
        </Text>
      </View>

      <FlatList
        data={filteredActivities}
        ListHeaderComponent={
          <CalendarView
            activities={data.activities}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        }
        keyExtractor={(item) => item.stravaActivityId.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={renderActivityItem}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color={colors.textMuted} />
            <Text style={styles.emptyStateText}>No activities in {FULL_MONTHS[selectedMonth]}</Text>
            <Text style={styles.emptyStateSubtext}>
              Try selecting a different month or start tracking
            </Text>
          </View>
        }
      />

      {/* Set Activity FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Simple Modal for "Set Activity" */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Activity</Text>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setModalVisible(false);
                navigation.navigate('FitnessMap');
              }}
            >
              <View style={[styles.modalIcon, { backgroundColor: colors.primary + '15' }]}>
                <MaterialCommunityIcons name="run" size={24} color={colors.primary} />
              </View>
              <Text style={styles.modalOptionText}>Run</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.textSecondary}
                style={styles.chevronIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setModalVisible(false);
                navigation.navigate('FitnessMap');
              }}
            >
              <View style={[styles.modalIcon, { backgroundColor: colors.primary + '15' }]}>
                <MaterialCommunityIcons name="bike" size={24} color={colors.primary} />
              </View>
              <Text style={styles.modalOptionText}>Ride</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.textSecondary}
                style={styles.chevronIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
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
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  filterButton: {
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
  },
  // Month Selector Styles
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  monthNavButton: {
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
  monthNavButtonDisabled: {
    opacity: 0.5,
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  // Month Pills Styles
  monthPillsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  monthPillSelected: {
    backgroundColor: colors.primary,
  },
  monthPillDisabled: {
    opacity: 0.4,
  },
  monthPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  monthPillTextSelected: {
    color: '#fff',
  },
  monthPillTextDisabled: {
    color: colors.textMuted,
  },
  // Activity Count Header
  activityCountHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  activityCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: 100,
  },
  // Calendar Styles
  calendarContainer: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.lg,
    borderRadius: 24,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekDayText: {
    width: (width - 80) / 7,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: (width - 80) / 7,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 20,
  },
  todayCell: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  todayText: {
    color: '#fff',
    fontWeight: '700',
  },
  activityDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.success,
    position: 'absolute',
    bottom: 6,
  },
  // Activity Card
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginHorizontal: spacing.lg,
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
    textAlign: 'center',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: '#F4F7FE',
    padding: 16,
    borderRadius: 20,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.md,
    color: colors.text,
  },
  chevronIcon: {
    marginLeft: 'auto',
  },
  closeButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    padding: 12,
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
});
