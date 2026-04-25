import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { makeApiCall, apiClient } from '../../../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TransparencyService from '../../../services/TransparencyService';
import { useTranslation } from '../../i18n/useTranslation';

const { width } = Dimensions.get('window');

const CitizenTransparencyScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [error, setError] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchTransparencyData();
  }, []);

  const fetchTransparencyData = async () => {
    try {
      setError(null);
      console.log('🏛️ Fetching transparency data...');
      
      const data = await TransparencyService.getDashboardData();
      
      console.log('Transparency data received:', {
        totalComplaints: data.totalComplaints,
        resolutionRate: data.resolutionRate,
        categoriesCount: data.categoryStats?.length || 0
      });
      
      setStatsData(data);
      
    } catch (error) {
      console.error('Error fetching transparency data:', error);
      setError(error.message);
      
      // Show user-friendly error message
      Alert.alert(
        t('transparency.dataLoadingError'),
        t('transparency.unableToFetch'),
        [
          { text: t('common.retry'), onPress: () => fetchTransparencyData() },
          { text: t('common.cancel'), style: 'cancel' }
        ]
      );
      
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransparencyData();
  };

  const renderHeader = () => (
    <View
      style={[styles.header, { paddingTop: insets.top + 10 }]}
    >
      <View style={styles.headerContent}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{t('transparency.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('transparency.subtitle')}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color="#374151" 
            style={{
              transform: [{ rotate: refreshing ? '180deg' : '0deg' }]
            }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOverviewCards = () => (
    <View style={styles.overviewContainer}>
      <View style={styles.overviewCard}>
        <View style={styles.overviewIconContainer}>
          <Ionicons name="clipboard" size={24} color="#1A1A1A" />
        </View>
        <Text style={styles.overviewValue}>{statsData.totalComplaints}</Text>
        <Text style={styles.overviewLabel}>{t('transparency.totalReports')}</Text>
      </View>
      
      <View style={styles.overviewCard}>
        <View style={[styles.overviewIconContainer, { backgroundColor: '#e3f5ff' }]}>
          <Ionicons name="checkmark-circle" size={24} color="#1A1A1A" />
        </View>
        <Text style={styles.overviewValue}>{statsData.resolvedComplaints}</Text>
        <Text style={styles.overviewLabel}>{t('transparency.resolved')}</Text>
      </View>
      
      <View style={styles.overviewCard}>
        <View style={[styles.overviewIconContainer, { backgroundColor: '#fff5e3' }]}>
          <Ionicons name="time" size={24} color="#1A1A1A" />
        </View>
        <Text style={styles.overviewValue}>{statsData.pendingComplaints}</Text>
        <Text style={styles.overviewLabel}>{t('transparency.pending')}</Text>
      </View>
    </View>
  );

  const renderResolutionRate = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{t('transparency.resolutionRate')}</Text>
      <View style={styles.resolutionContainer}>
        <View style={styles.progressCircle}>
          <View style={styles.progressInnerCircle}>
            <Text style={styles.progressValue}>
              {TransparencyService.formatResolutionRate(statsData.resolutionRate)}
            </Text>
          </View>
        </View>
        <View style={styles.resolutionText}>
          <Text style={styles.resolutionTitle}>
            {statsData.resolutionRate >= 70 ? t('transparency.excellentProgress') : 
             statsData.resolutionRate >= 60 ? t('transparency.goodProgress') : 
             t('transparency.improving')}
          </Text>
          <Text style={styles.resolutionDescription}>
            {t('transparency.issuesResolved', { resolved: statsData.resolvedComplaints, total: statsData.totalComplaints })}
            {statsData.avgResolutionTime && t('transparency.avgResolutionTime', { days: statsData.avgResolutionTime })}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderCategoryBreakdown = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{t('transparency.categoryBreakdown')}</Text>
      <View style={styles.categoriesContainer}>
        {statsData.categoryStats.map((category, index) => {
          const percentage = Math.round((category.total / statsData.totalComplaints) * 100);
          return (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryBar}>
                <View 
                  style={[
                    styles.categoryFill, 
                    { 
                      width: `${percentage}%`,
                      backgroundColor: TransparencyService.getCategoryColor(category.name)
                    }
                  ]}
                />
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCount}>
                  {t('transparency.issuesSummary', { total: category.total, resolved: category.resolved })}
                </Text>
              </View>
              <Text style={styles.categoryPercentage}>{percentage}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderImpactStats = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{t('transparency.communityImpact')}</Text>
      <View style={styles.impactContainer}>
        <View style={styles.impactItem}>
          <MaterialCommunityIcons name="account-group" size={28} color="#1A1A1A" />
          <Text style={styles.impactValue}>
            {TransparencyService.formatPeopleImpacted(statsData.impactStats.peopleImpacted)}
          </Text>
          <Text style={styles.impactLabel}>{t('transparency.peopleImpacted')}</Text>
        </View>
        
        <View style={styles.impactItem}>
          <MaterialCommunityIcons name="trending-up" size={28} color="#1A1A1A" />
          <Text style={styles.impactValue}>{statsData.impactStats.highPriorityIssues}</Text>
          <Text style={styles.impactLabel}>{t('transparency.highPriority')}</Text>
        </View>
        
        <View style={styles.impactItem}>
          <Ionicons name="timer-outline" size={28} color="#1A1A1A" />
          <Text style={styles.impactValue}>
            {statsData.avgResolutionTime ? t('transparency.days', { days: statsData.avgResolutionTime }) : t('transparency.na')}
          </Text>
          <Text style={styles.impactLabel}>{t('transparency.avgResolution')}</Text>
        </View>
      </View>
      
      {statsData.votingStats && (
        <View style={styles.votingStatsContainer}>
          <Text style={styles.votingStatsTitle}>{t('transparency.communityEngagement')}</Text>
          <View style={styles.votingStatsRow}>
            <Text style={styles.votingStatsText}>
              {t('transparency.votesEngagement', { votes: statsData.votingStats.totalVotes, engagement: statsData.votingStats.engagementRate })}
            </Text>
          </View>
          <Text style={styles.votingStatsSubtext}>
            {t('transparency.highSupportIssues', { count: statsData.votingStats.highEngagementComplaints })}
          </Text>
        </View>
      )}
    </View>
  );

  const renderMonthlyCounts = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{t('transparency.monthlyTrends')}</Text>
      <View style={styles.chartContainer}>
        {statsData.monthlyData.map((item, index) => {
          const maxCount = Math.max(...statsData.monthlyData.map(d => d.total));
          const barHeight = maxCount > 0 ? (item.total / maxCount) * 100 : 0;
          const resolvedHeight = item.total > 0 ? (item.resolved / item.total) * barHeight : 0;
          
          return (
            <View key={index} style={styles.chartColumn}>
              <View style={styles.chartBarContainer}>
                <View 
                  style={[
                    styles.chartBar, 
                    { 
                      height: barHeight,
                      backgroundColor: '#e3f5ff'
                    }
                  ]}
                >
                  <View 
                    style={[
                      styles.chartResolvedBar,
                      {
                        height: resolvedHeight,
                        backgroundColor: index === statsData.monthlyData.length - 1 ? '#1A1A1A' : '#52d681'
                      }
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.chartLabel}>{item.month}</Text>
              <Text style={styles.chartValue}>{item.total}</Text>
            </View>
          );
        })}
      </View>
      
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#e3f5ff' }]} />
          <Text style={styles.legendText}>{t('transparency.totalReports')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#1A1A1A' }]} />
          <Text style={styles.legendText}>{t('transparency.resolved')}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={styles.loadingText}>
            {refreshing ? t('transparency.refreshingData') : t('transparency.loadingData')}
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#1A1A1A']}
              progressBackgroundColor="#ffffff"
            />
          }
        >
          {statsData && (
            <>
              {renderOverviewCards()}
              {renderResolutionRate()}
              {renderCategoryBreakdown()}
              {renderMonthlyCounts()}
              {renderImpactStats()}
            </>
          )}
          
          {error && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={48} color="#1A1A1A" />
              <Text style={styles.errorText}>{t('transparency.failedToLoad')}</Text>
              <Text style={styles.errorSubtext}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchTransparencyData}>
                <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  overviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  overviewIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#777',
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  resolutionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressInnerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resolutionText: {
    flex: 1,
    marginLeft: 16,
  },
  resolutionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  resolutionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  categoriesContainer: {
    marginTop: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
  },
  categoryInfo: {
    width: 100,
    marginLeft: 12,
  },
  categoryName: {
    fontSize: 14,
    color: '#333',
  },
  categoryCount: {
    fontSize: 12,
    color: '#777',
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    width: 45,
    textAlign: 'right',
  },
  chartContainer: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarContainer: {
    height: 120,
    width: 24,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 24,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartLabel: {
    fontSize: 12,
    color: '#777',
    marginTop: 6,
  },
  impactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  impactItem: {
    flex: 1,
    alignItems: 'center',
  },
  impactValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
  },
  votingStatsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  votingStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  votingStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  votingStatsText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  votingStatsSubtext: {
    fontSize: 12,
    color: '#777',
  },
  chartValue: {
    fontSize: 10,
    color: '#777',
    textAlign: 'center',
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  chartResolvedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CitizenTransparencyScreen;
