import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/useTranslation';
import { apiClient, makeApiCall } from '../../../config/supabase';
import LanguageSwitcher from '../../components/LanguageSwitcher';

const { width } = Dimensions.get('window');

const PersonalReports = ({ navigation }) => {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  useEffect(() => {
    loadPersonalReports();
  }, []);

  const loadPersonalReports = async () => {
    try {
      setLoading(true);
      const response = await makeApiCall(apiClient.complaints.personalReports);
      if (!response.success) {
        Alert.alert(t('common.error'), response.message || t('reports.loading'));
        return;
      }
      setReports(response.data.complaints || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Load personal reports error:', error);
      Alert.alert(t('common.error'), t('reports.loading'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPersonalReports();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      t('dashboard.logoutConfirmTitle'),
      t('dashboard.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['authToken', 'userData']);
              navigation.replace('Welcome');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(t('common.error'), t('dashboard.logoutConfirmTitle'));
            }
          }
        }
      ]
    );
  };

  const openTrackingDetails = (report) => {
    setSelectedReport(report);
    setShowTrackingModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f39c12',
      in_progress: '#3498db',
      resolved: '#27ae60',
      cancelled: '#95a5a6'
    };
    return colors[status] || '#95a5a6';
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: t('reports.status.pending'),
      in_progress: t('reports.status.in_progress'),
      resolved: t('reports.status.resolved'),
      cancelled: t('reports.status.cancelled')
    };
    return statusMap[status] || String(status || '').toUpperCase();
  };

  const renderTrackingStage = (stage, isActive, isCompleted, isLast) => {
    const stageColor = isCompleted ? '#27ae60' : isActive ? '#3498db' : '#bdc3c7';
    const stageIcon = isCompleted ? 'checkmark-circle' : isActive ? 'radio-button-on' : 'radio-button-off';

    return (
      <View key={stage.id} style={styles.trackingStage}>
        <View style={styles.stageIconContainer}>
          <Ionicons name={stageIcon} size={24} color={stageColor} />
          {!isLast ? (
            <View style={[styles.stageLine, { backgroundColor: isCompleted ? '#27ae60' : '#bdc3c7' }]} />
          ) : null}
        </View>

        <View style={styles.stageContent}>
          <View style={styles.stageHeader}>
            <Text style={[styles.stageName, { color: stageColor }]}>{stage.icon} {stage.name}</Text>
            {stage.date ? <Text style={styles.stageDate}>{new Date(stage.date).toLocaleDateString()}</Text> : null}
          </View>
          <Text style={styles.stageDescription}>{stage.description}</Text>
          {stage.officer ? <Text style={styles.stageAssignment}>Officer: {stage.officer}</Text> : null}
          {stage.contractor ? <Text style={styles.stageAssignment}>Contractor: {stage.contractor}</Text> : null}
          {stage.estimatedCost ? <Text style={styles.stageAssignment}>Estimated Cost: ₹{stage.estimatedCost}</Text> : null}
        </View>
      </View>
    );
  };

  const renderReportCard = (report) => (
    <TouchableOpacity key={report.id} style={styles.reportCard} onPress={() => openTrackingDetails(report)}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle} numberOfLines={2}>{report.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
          <Text style={styles.statusText}>{getStatusText(report.status)}</Text>
        </View>
      </View>

      <Text style={styles.reportDescription} numberOfLines={3}>{report.description}</Text>

      {report.image_url ? <Image source={{ uri: report.image_url }} style={styles.reportImage} /> : null}

      <View style={styles.reportMeta}>
        <Text style={styles.reportDate}>📅 {t('reports.submitted')}: {new Date(report.created_at).toLocaleDateString()}</Text>
        <Text style={styles.reportLocation}>📍 {report.location_address || t('common.notSpecified')}</Text>
        <Text style={styles.reportCategory}>📋 {report.category || t('common.notSpecified')}</Text>
      </View>

      <View style={styles.progressIndicator}>
        <Text style={styles.progressText}>{t('reports.stage', { current: report.currentStage })}</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(report.currentStage / 5) * 100}%`,
                backgroundColor: getStatusColor(report.status)
              }
            ]}
          />
        </View>
      </View>

      <View style={styles.trackingButton}>
        <Ionicons name="eye-outline" size={16} color="#3498db" />
        <Text style={styles.trackingButtonText}>{t('reports.viewTracking')}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('reports.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('reports.myReports')}</Text>
          <View style={styles.headerControls}>
            <LanguageSwitcher compact />
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalComplaints || 0}</Text>
          <Text style={styles.statLabel}>{t('reports.stats.total')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#27ae60' }]}>{stats.resolved || 0}</Text>
          <Text style={styles.statLabel}>{t('reports.stats.resolved')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#3498db' }]}>{stats.inProgress || 0}</Text>
          <Text style={styles.statLabel}>{t('reports.stats.inProgress')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f39c12' }]}>{stats.pending || 0}</Text>
          <Text style={styles.statLabel}>{t('reports.stats.pending')}</Text>
        </View>
      </View>

      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>{t('reports.yourComplaintReports')}</Text>
        {reports.length === 0 ? (
          <View style={styles.noReports}>
            <Ionicons name="document-outline" size={60} color="#bdc3c7" />
            <Text style={styles.noReportsText}>{t('reports.noReports')}</Text>
            <Text style={styles.noReportsSubtext}>{t('reports.noReportsSub')}</Text>
            <TouchableOpacity style={styles.submitButton} onPress={() => navigation.navigate('SubmitComplaint')}>
              <Text style={styles.submitButtonText}>{t('reports.submitComplaint')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          reports.map((report) => renderReportCard(report))
        )}
      </View>

      <Modal visible={showTrackingModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📦 {t('reports.trackingTitle')}</Text>
            <TouchableOpacity onPress={() => setShowTrackingModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {selectedReport ? (
            <ScrollView style={styles.modalContent}>
              <View style={styles.reportInfo}>
                <Text style={styles.reportModalTitle}>{selectedReport.title}</Text>
                <Text style={styles.reportModalDescription}>{selectedReport.description}</Text>
                {selectedReport.image_url ? (
                  <Image source={{ uri: selectedReport.image_url }} style={styles.reportModalImage} />
                ) : null}

                <View style={styles.reportModalMeta}>
                  <Text style={styles.modalMetaText}>📅 {t('reports.submitted')}: {new Date(selectedReport.created_at).toLocaleDateString()} at {new Date(selectedReport.created_at).toLocaleTimeString()}</Text>
                  <Text style={styles.modalMetaText}>📍 {t('reports.location')}: {selectedReport.location_address || t('common.notSpecified')}</Text>
                  <Text style={styles.modalMetaText}>📋 {t('reports.category')}: {selectedReport.category || t('common.notSpecified')}</Text>
                  <Text style={styles.modalMetaText}>⚡ {t('reports.priority')}: {selectedReport.priority || t('common.notSpecified')}</Text>
                </View>
              </View>

              <View style={styles.trackingContainer}>
                <Text style={styles.trackingTitle}>{t('reports.progressTracking')}</Text>
                {selectedReport.trackingStages?.map((stage, index) =>
                  renderTrackingStage(
                    stage,
                    index + 1 === selectedReport.currentStage,
                    stage.status === 'completed',
                    index === selectedReport.trackingStages.length - 1
                  )
                )}
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  loadingText: { fontSize: 16, color: '#7f8c8d' },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  logoutButton: { padding: 8 },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-around',
    marginTop: -10
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    minWidth: 70,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50' },
  statLabel: { fontSize: 12, color: '#7f8c8d', marginTop: 5 },
  reportsSection: { padding: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15 },
  noReports: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  noReportsText: { fontSize: 18, fontWeight: 'bold', color: '#7f8c8d', marginTop: 15 },
  noReportsSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 20
  },
  submitButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25
  },
  submitButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  reportTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', flex: 1, marginRight: 10 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: 'bold', color: 'white' },
  reportDescription: { fontSize: 14, color: '#7f8c8d', marginBottom: 10, lineHeight: 20 },
  reportImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  reportMeta: { marginBottom: 15 },
  reportDate: { fontSize: 12, color: '#95a5a6', marginBottom: 3 },
  reportLocation: { fontSize: 12, color: '#95a5a6', marginBottom: 3 },
  reportCategory: { fontSize: 12, color: '#95a5a6' },
  progressIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  progressText: { fontSize: 12, color: '#7f8c8d', marginRight: 10 },
  progressBar: { flex: 1, height: 4, backgroundColor: '#ecf0f1', borderRadius: 2 },
  progressFill: { height: '100%', borderRadius: 2 },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1'
  },
  trackingButtonText: { fontSize: 14, color: '#3498db', marginLeft: 5, fontWeight: '500' },
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1'
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
  closeButton: { padding: 8 },
  modalContent: { flex: 1, padding: 20 },
  reportInfo: { marginBottom: 30 },
  reportModalTitle: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', marginBottom: 10 },
  reportModalDescription: { fontSize: 16, color: '#7f8c8d', marginBottom: 15, lineHeight: 24 },
  reportModalImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 15 },
  reportModalMeta: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 10 },
  modalMetaText: { fontSize: 14, color: '#5a6c7d', marginBottom: 8 },
  trackingContainer: { backgroundColor: 'white', borderRadius: 10, padding: 20 },
  trackingTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 20 },
  trackingStage: { flexDirection: 'row', marginBottom: 20 },
  stageIconContainer: { alignItems: 'center', marginRight: 15 },
  stageLine: { width: 2, flex: 1, marginTop: 8 },
  stageContent: { flex: 1 },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  stageName: { fontSize: 16, fontWeight: 'bold' },
  stageDate: { fontSize: 12, color: '#7f8c8d' },
  stageDescription: { fontSize: 14, color: '#7f8c8d', marginBottom: 5 },
  stageAssignment: { fontSize: 12, color: '#3498db', marginBottom: 2 }
});

export default PersonalReports;
