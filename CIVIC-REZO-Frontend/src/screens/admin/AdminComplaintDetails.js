import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { apiClient, makeApiCall } from '../../../config/supabase';

const AdminComplaintDetails = ({ route, navigation }) => {
  const { complaintId } = route.params;
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [newStageStatus, setNewStageStatus] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [officers, setOfficers] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [selectedContractor, setSelectedContractor] = useState('');
  const [gradCamLoading, setGradCamLoading] = useState(false);
  const [gradCamResult, setGradCamResult] = useState(null);
  const [showGradCamModal, setShowGradCamModal] = useState(false);

  useEffect(() => {
    loadComplaintDetails();
    loadOfficers();
    loadContractors();
  }, [complaintId]);

  const loadComplaintDetails = async () => {
    try {
      setLoading(true);
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/details`
      );
      
      if (response.success) {
        setComplaint(response.data);
      } else {
        Alert.alert('Error', response.message || 'Failed to load complaint details');
      }
    } catch (error) {
      console.error('Load complaint details error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const loadOfficers = async () => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/officers`
      );
      if (response.success) {
        setOfficers(response.data);
      }
    } catch (error) {
      console.error('Load officers error:', error);
    }
  };

  const loadContractors = async () => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/contractors`
      );
      if (response.success) {
        setContractors(response.data);
      }
    } catch (error) {
      console.error('Load contractors error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadComplaintDetails();
    setRefreshing(false);
  };

  const openStageModal = (stage) => {
    setSelectedStageId(stage.id);
    // Ensure we always have a valid status, default to 'pending' if undefined
    const validStatus = stage.stage_status && 
      ['pending', 'in_progress', 'completed', 'cancelled'].includes(stage.stage_status) 
      ? stage.stage_status 
      : 'pending';
    setNewStageStatus(validStatus);
    setStageNotes(stage.notes || '');
    setSelectedOfficer(stage.assigned_officer_id || '');
    setSelectedContractor(stage.assigned_contractor_id || '');
    setShowStageModal(true);
    
    console.log('🔧 Opening stage modal:', { 
      stageId: stage.id, 
      originalStatus: stage.stage_status, 
      validStatus,
      stage 
    });
  };

  const updateStage = async () => {
    try {
      if (!selectedStageId) return;

      const updateData = {
        stage_status: newStageStatus,
        notes: stageNotes,
        assigned_officer_id: selectedOfficer || null,
        assigned_contractor_id: selectedContractor || null,
      };

      console.log('🚀 Sending stage update:', {
        selectedStageId,
        newStageStatus,
        updateData
      });

      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/stage/${selectedStageId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData)
        }
      );

      if (response.success) {
        Alert.alert('Success', 'Stage updated successfully');
        setShowStageModal(false);
        await loadComplaintDetails();
      } else {
        Alert.alert('Error', response.message || 'Failed to update stage');
      }
    } catch (error) {
      console.error('Update stage error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    }
  };

  const addNextStage = async () => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/stage/next`,
        {
          method: 'POST'
        }
      );

      if (response.success) {
        Alert.alert('Success', 'Next stage added successfully');
        await loadComplaintDetails();
      } else {
        Alert.alert('Error', response.message || 'Failed to add next stage');
      }
    } catch (error) {
      console.error('Add next stage error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    }
  };

  const fetchGradCamExplanation = async () => {
    if (!complaint?.image_url) return;
    
    setGradCamLoading(true);
    setShowGradCamModal(true);
    
    try {
      const response = await makeApiCall(`${apiClient.baseUrl}/api/gradcam/explain/url`, {
        method: 'POST',
        body: JSON.stringify({
          image_url: complaint.image_url,
          architecture: 'resnet50'
        })
      });

      if (response) {
        setGradCamResult(response);
      } else {
        Alert.alert('Error', response.error || 'Failed to generate explanation');
        setShowGradCamModal(false);
      }
    } catch (error) {
      console.error('Grad-CAM Error:', error);
      Alert.alert('Error', 'Failed to connect to explanation service');
      setShowGradCamModal(false);
    } finally {
      setGradCamLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#1A1A1A',
      'in_progress': '#1A1A1A',
      'completed': '#1A1A1A',
      'cancelled': '#1A1A1A',
      'resolved': '#1A1A1A',
      'rejected': '#1A1A1A'
    };
    return colors[status] || '#95a5a6';
  };

  const getStageIcon = (stageName) => {
    const icons = {
      'initial_assessment': 'document-text-outline',
      'field_verification': 'location-outline',
      'resource_allocation': 'people-outline',
      'work_assignment': 'hammer-outline',
      'work_in_progress': 'construct-outline',
      'quality_check': 'checkmark-circle-outline',
      'final_approval': 'shield-checkmark-outline',
      'completion': 'flag-outline',
    };
    return icons[stageName] || 'ellipse-outline';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading complaint details...</Text>
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={styles.errorContainer}>
        <Text>Complaint not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStage = complaint.complaint_stages?.find(s => s.stage_status === 'in_progress') || 
                     complaint.complaint_stages?.find(s => s.stage_status === 'pending');
  const completedStages = complaint.complaint_stages?.filter(s => s.stage_status === 'completed').length || 0;
  const totalStages = complaint.complaint_stages?.length || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1A1A1A', '#1A1A1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complaint Details</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Basic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(complaint.status) }]}>
              <Text style={styles.statusText}>{complaint.status.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.complaintTitle}>{complaint.title}</Text>
          <Text style={styles.complaintDescription}>{complaint.description}</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Priority Score</Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(complaint.priority_score) }]}>
                <Text style={styles.priorityText}>{complaint.priority_score}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{complaint.category?.replace('_', ' ')}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Submitted By</Text>
              <Text style={styles.infoValue}>{complaint.users?.full_name || 'Unknown'}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{complaint.location_address}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {new Date(complaint.created_at).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>
                {new Date(complaint.updated_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Images */}
        {complaint.image_url && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Images</Text>
              <TouchableOpacity style={styles.explainButton} onPress={fetchGradCamExplanation}>
                <Ionicons name="scan-outline" size={16} color="#fff" />
                <Text style={styles.explainButtonText}>Explain AI</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Image source={{ uri: complaint.image_url }} style={styles.complaintImage} />
            </ScrollView>
          </View>
        )}

        {/* Progress Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress Overview</Text>
          
          <View style={styles.progressOverview}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${totalStages > 0 ? (completedStages / totalStages) * 100 : 0}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {completedStages} of {totalStages} stages completed ({totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0}%)
            </Text>
          </View>

          {currentStage && (
            <View style={styles.currentStageCard}>
              <Text style={styles.currentStageLabel}>Current Stage</Text>
              <Text style={styles.currentStageName}>{currentStage.stage_name}</Text>
              <Text style={styles.currentStageDescription}>{currentStage.stage_description}</Text>
              
              {currentStage.officers && (
                <View style={styles.assignmentInfo}>
                  <Ionicons name="person-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.assignmentText}>
                    Officer: {currentStage.officers.name} ({currentStage.officers.department})
                  </Text>
                </View>
              )}

              {currentStage.contractors && (
                <View style={styles.assignmentInfo}>
                  <Ionicons name="build-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.assignmentText}>
                    Contractor: {currentStage.contractors.name}
                  </Text>
                </View>
              )}

              <TouchableOpacity 
                style={styles.updateStageButton}
                onPress={() => openStageModal(currentStage)}
              >
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.updateStageText}>Update Stage</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stages Timeline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Stages Timeline</Text>
            {complaint.status !== 'resolved' && complaint.status !== 'rejected' && (
              <TouchableOpacity style={styles.addStageButton} onPress={addNextStage}>
                <Ionicons name="add" size={20} color="#1A1A1A" />
                <Text style={styles.addStageText}>Add Next Stage</Text>
              </TouchableOpacity>
            )}
          </View>

          {complaint.complaint_stages?.map((stage, index) => (
            <TouchableOpacity
              key={stage.id}
              style={styles.stageItem}
              onPress={() => openStageModal(stage)}
            >
              <View style={styles.stageIndicator}>
                <View style={[
                  styles.stageCircle,
                  { backgroundColor: getStatusColor(stage.stage_status) }
                ]}>
                  <Ionicons 
                    name={getStageIcon(stage.stage_name)} 
                    size={16} 
                    color="#fff" 
                  />
                </View>
                {index < complaint.complaint_stages.length - 1 && (
                  <View style={styles.stageLine} />
                )}
              </View>

              <View style={styles.stageContent}>
                <View style={styles.stageHeader}>
                  <Text style={styles.stageName}>{stage.stage_name}</Text>
                  <View style={[
                    styles.stageStatusBadge,
                    { backgroundColor: getStatusColor(stage.stage_status) }
                  ]}>
                    <Text style={styles.stageStatusText}>
                      {stage.stage_status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.stageDescription}>{stage.stage_description}</Text>

                {stage.notes && (
                  <Text style={styles.stageNotes}>Notes: {stage.notes}</Text>
                )}

                {stage.officers && (
                  <Text style={styles.stageAssignment}>
                    👮 Officer: {stage.officers.name}
                  </Text>
                )}

                {stage.contractors && (
                  <Text style={styles.stageAssignment}>
                    🔧 Contractor: {stage.contractors.name}
                  </Text>
                )}

                {stage.estimated_cost && (
                  <Text style={styles.stageCost}>
                    💰 Estimated Cost: ₹{stage.estimated_cost}
                  </Text>
                )}

                <Text style={styles.stageTimestamp}>
                  Created: {new Date(stage.created_at).toLocaleDateString()}
                  {stage.updated_at !== stage.created_at && 
                    ` • Updated: ${new Date(stage.updated_at).toLocaleDateString()}`
                  }
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Additional Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#1A1A1A' }]}
              onPress={() => Alert.alert(
                'Contact User', 
                'Contact user feature coming soon!\n\nThis will allow direct communication with the citizen who submitted this complaint.',
                [{ text: 'OK' }]
              )}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Contact User</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#1A1A1A' }]}
              onPress={() => {
                Alert.alert(
                  'Mark as Resolved',
                  'Are you sure you want to mark this complaint as resolved?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Resolve', onPress: () => updateComplaintStatus('resolved') }
                  ]
                );
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Mark Resolved</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#1A1A1A' }]}
              onPress={() => {
                Alert.alert(
                  'Reject Complaint',
                  'Are you sure you want to reject this complaint?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reject', onPress: () => updateComplaintStatus('rejected') }
                  ]
                );
              }}
            >
              <Ionicons name="close-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Stage Update Modal */}
      <Modal
        visible={showStageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stageModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Stage</Text>
              <TouchableOpacity onPress={() => setShowStageModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalLabel}>Stage Status</Text>
              <Picker
                selectedValue={newStageStatus}
                onValueChange={setNewStageStatus}
                style={styles.modalPicker}
              >
                <Picker.Item label="Pending" value="pending" />
                <Picker.Item label="In Progress" value="in_progress" />
                <Picker.Item label="Completed" value="completed" />
                <Picker.Item label="Cancelled" value="cancelled" />
              </Picker>

              <Text style={styles.modalLabel}>Assign Officer</Text>
              <Picker
                selectedValue={selectedOfficer}
                onValueChange={setSelectedOfficer}
                style={styles.modalPicker}
              >
                <Picker.Item label="No Officer Assigned" value="" />
                {officers.map(officer => (
                  <Picker.Item 
                    key={officer.id} 
                    label={`${officer.name} (${officer.department})`} 
                    value={officer.id} 
                  />
                ))}
              </Picker>

              <Text style={styles.modalLabel}>Assign Contractor</Text>
              <Picker
                selectedValue={selectedContractor}
                onValueChange={setSelectedContractor}
                style={styles.modalPicker}
              >
                <Picker.Item label="No Contractor Assigned" value="" />
                {contractors.map(contractor => (
                  <Picker.Item 
                    key={contractor.id} 
                    label={contractor.name} 
                    value={contractor.id} 
                  />
                ))}
              </Picker>

              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput
                style={styles.modalTextArea}
                multiline
                numberOfLines={4}
                placeholder="Add notes about this stage..."
                value={stageNotes}
                onChangeText={setStageNotes}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowStageModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalUpdateButton} onPress={updateStage}>
                <Text style={styles.modalUpdateText}>Update Stage</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Grad-CAM Modal */}
      <Modal
        visible={showGradCamModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGradCamModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stageModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Image Explanation</Text>
              <TouchableOpacity onPress={() => setShowGradCamModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {gradCamLoading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text>Generating AI heatmap explanation...</Text>
                </View>
              ) : gradCamResult ? (
                <View>
                  <Text style={styles.explanationText}>{gradCamResult.explanation_text}</Text>
                  {gradCamResult.overlay_base64 && (
                    <Image
                      source={{ uri: `data:image/png;base64,${gradCamResult.overlay_base64}` }}
                      style={{ width: '100%', height: 250, borderRadius: 8, marginTop: 15, resizeMode: 'contain' }}
                    />
                  )}
                  {gradCamResult.heatmap_base64 && (
                    <Image
                      source={{ uri: `data:image/png;base64,${gradCamResult.heatmap_base64}` }}
                      style={{ width: '100%', height: 250, borderRadius: 8, marginTop: 15, resizeMode: 'contain' }}
                    />
                  )}
                </View>
              ) : (
                <Text style={{ padding: 20 }}>No explanation generated.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );

  function getPriorityColor(score) {
    if (score >= 8) return '#1A1A1A';
    if (score >= 6) return '#1A1A1A';
    if (score >= 4) return '#1A1A1A';
    return '#95a5a6';
  }

  async function updateComplaintStatus(newStatus) {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.success) {
        Alert.alert('Success', `Complaint ${newStatus} successfully`);
        await loadComplaintDetails();
      } else {
        Alert.alert('Error', response.message || `Failed to ${newStatus} complaint`);
      }
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    }
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    color: '#1A1A1A',
    fontSize: 16,
    marginTop: 10,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  complaintTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  complaintDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 24,
    marginBottom: 15,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  priorityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  complaintImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginRight: 10,
  },
  progressOverview: {
    marginBottom: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  currentStageCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1A1A1A',
  },
  currentStageLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 4,
  },
  currentStageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  currentStageDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  assignmentText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 5,
  },
  updateStageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  updateStageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  addStageButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addStageText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  stageItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  stageIndicator: {
    alignItems: 'center',
    marginRight: 15,
  },
  stageCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageLine: {
    width: 2,
    height: 40,
    backgroundColor: '#ecf0f1',
    marginTop: 4,
  },
  stageContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  stageStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  stageDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  stageNotes: {
    fontSize: 14,
    color: '#2c3e50',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  stageAssignment: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  stageCost: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 4,
  },
  stageTimestamp: {
    fontSize: 11,
    color: '#95a5a6',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalContent: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 15,
  },
  modalPicker: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    marginBottom: 15,
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#ecf0f1',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
  },
  modalUpdateButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalUpdateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6', // Blue color for AI explanation
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  explainButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2c3e50',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  }
});

export default AdminComplaintDetails;
