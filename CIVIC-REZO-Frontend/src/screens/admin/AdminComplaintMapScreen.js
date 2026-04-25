import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Modal,
  ScrollView,
  Image,
  TextInput,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../../../config/supabase';

const AdminComplaintMapScreen = ({ navigation, route }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [region, setRegion] = useState({
    latitude: 10.9837,
    longitude: 76.9266,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);
  const [isMarkerInteracting, setIsMarkerInteracting] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true); // Toggle for heatmap vs markers
  const [filterStatus, setFilterStatus] = useState('all'); // Admin filter
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [heatMapData, setHeatMapData] = useState([]);
  const [gradCamLoading, setGradCamLoading] = useState(false);
  const [gradCamResult, setGradCamResult] = useState(null);
  const [showGradCamModal, setShowGradCamModal] = useState(false);
  const [selectedImageForGradCam, setSelectedImageForGradCam] = useState(null);
  const mapRef = useRef(null);
  const regionChangeTimeoutRef = useRef(null);

  // Fetch Grad-CAM Explanation
  const fetchGradCamExplanation = async (imageUrl) => {
    if (!imageUrl) return;
    
    setSelectedImageForGradCam(imageUrl);
    setGradCamLoading(true);
    setShowGradCamModal(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/gradcam/explain/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          architecture: 'resnet50'
        })
      });

      const data = await response.json();

      if (data.success) {
        setGradCamResult(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to generate explanation');
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

  // Get user's current location
  const getUserLocation = async () => {
    try {
      console.log(' Admin requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log(' Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to see complaints near you.',
          [{ text: 'OK' }]
        );
        setLocationLoading(false);
        return;
      }

      console.log(' Getting admin current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05, // Closer zoom to user area
        longitudeDelta: 0.05,
      };

      console.log(' Admin location obtained:', userCoords);
      setUserLocation(location.coords);
      setRegion(userCoords);
      
    } catch (error) {
      console.error(' Error getting admin location:', error);
      Alert.alert(
        'Location Error', 
        'Could not get your location. Showing default area.',
        [{ text: 'OK' }]
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // Admin-specific search function
  const searchLocation = async (query) => {
    console.log(' ADMIN SEARCH TRIGGERED - Query:', query);
    
    if (!query || !query.trim()) {
      console.log(' Empty query, clearing results');
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchResults(true);
    
    try {
      const results = [];
      const queryLower = query.toLowerCase().trim();
      console.log(' Admin searching for:', queryLower);

      // 1. Search predefined cities (most reliable)
      const cities = {
        'delhi': { lat: 28.6139, lng: 77.2090, name: 'Delhi, India' },
        'new delhi': { lat: 28.6139, lng: 77.2090, name: 'New Delhi, India' },
        'mumbai': { lat: 19.0760, lng: 72.8777, name: 'Mumbai, India' },
        'bangalore': { lat: 12.9716, lng: 77.5946, name: 'Bangalore, India' },
        'chennai': { lat: 13.0827, lng: 80.2707, name: 'Chennai, India' },
        'kolkata': { lat: 22.5726, lng: 88.3639, name: 'Kolkata, India' },
        'hyderabad': { lat: 17.3850, lng: 78.4867, name: 'Hyderabad, India' },
        'pune': { lat: 18.5204, lng: 73.8567, name: 'Pune, India' },
        'kochi': { lat: 9.9312, lng: 76.2673, name: 'Kochi, Kerala' },
        'ernakulam': { lat: 9.9816, lng: 76.2999, name: 'Ernakulam, Kerala' },
      };

      // Exact match
      if (cities[queryLower]) {
        const city = cities[queryLower];
        results.push({
          id: `city_${queryLower}`,
          latitude: city.lat,
          longitude: city.lng,
          title: city.name,
          subtitle: 'Major City',
          type: 'city'
        });
        console.log(' Found exact city match:', city.name);
      }

      // 2. Admin-specific: Search in complaints with priority filter
      if (complaints && complaints.length > 0) {
        const matchingComplaints = complaints.filter(complaint => {
          const matchesQuery = 
            complaint.title?.toLowerCase().includes(queryLower) ||
            complaint.description?.toLowerCase().includes(queryLower) ||
            complaint.category?.toLowerCase().includes(queryLower) ||
            complaint.status?.toLowerCase().includes(queryLower);
          
          // Admin filter by status if selected
          if (filterStatus !== 'all') {
            return matchesQuery && complaint.status === filterStatus;
          }
          
          return matchesQuery;
        });

        // Sort by priority score for admin
        matchingComplaints
          .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
          .slice(0, 5)
          .forEach(complaint => {
            results.push({
              id: `complaint_${complaint.id}`,
              latitude: parseFloat(complaint.location_latitude),
              longitude: parseFloat(complaint.location_longitude),
              title: complaint.title,
              subtitle: `${complaint.category} • ${complaint.status} • Priority: ${Math.round(complaint.priority_score || 0)}`,
              complaint: complaint,
              type: 'complaint'
            });
          });
        console.log(` Found ${matchingComplaints.length} matching complaints for admin`);
      }

      // Show results
      if (results.length > 0) {
        console.log(` Setting ${results.length} admin search results:`, results.map(r => `${r.title} (${r.type})`));
        setSearchResults(results);
        setShowSearchResults(true);

        // Auto-select high priority complaints
        if (results.length === 1 && results[0].type === 'complaint' && results[0].complaint?.priority_score > 70) {
          console.log(' High priority complaint found, auto-selecting:', results[0].title);
          Alert.alert(
            'High Priority Complaint!', 
            `Priority ${Math.round(results[0].complaint.priority_score)}: ${results[0].title}`, 
            [{ text: 'View' }], 
            { cancelable: true }
          );
          setTimeout(() => {
            selectSearchResult(results[0]);
          }, 800);
        }
      } else {
        console.log(' No results found for admin search');
        setSearchResults([]);
        setShowSearchResults(false);
        Alert.alert('No Results', `No results found for "${query}". Try searching for complaint keywords, status, or city names.`);
      }

    } catch (error) {
      console.error(' Admin search error:', error);
      setSearchResults([]);
      Alert.alert('Search Error', 'Search failed. Please try again.');
    } finally {
      setSearchLoading(false);
      console.log(' Admin search completed');
    }
  };

  // Handle search result selection
  const selectSearchResult = (result) => {
    console.log(' ADMIN SEARCH RESULT SELECTED:', result);
    
    const newRegion = {
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
    
    console.log(' Admin moving to region:', newRegion);
    
    setIsProgrammaticMove(true);
    
    if (mapRef.current) {
      console.log(' Admin animating map to region');
      mapRef.current.animateToRegion(newRegion, 1000);
    }
    
    setRegion(newRegion);
    setSearchQuery(result.title);
    setShowSearchResults(false);
    Keyboard.dismiss();
    
    setTimeout(() => {
      setIsProgrammaticMove(false);
      console.log(' Admin animation completed');
    }, 1500);
    
    // If it's a complaint result, show the complaint details
    if (result.complaint) {
      setTimeout(() => {
        setSelectedComplaint(result.complaint);
        setShowComplaintModal(true);
      }, 500);
    }
  };

  // Fetch heat map data
  const fetchHeatMapData = async () => {
    try {
      console.log('️ Admin fetching heat map data...');
      const response = await fetch(`${API_BASE_URL}/api/heat-map/data?days=30`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.points) {
        console.log(' Admin heat map data received:', data.data.points.length, 'points');
        setHeatMapData(data.data.points);
      }
    } catch (error) {
      console.error(' Error fetching admin heat map data:', error);
    }
  };

  // Fetch complaints data with admin filters
  const fetchComplaints = async () => {
    try {
      console.log(' Admin fetching complaints from:', `${API_BASE_URL}/api/complaints/all`);
      const response = await fetch(`${API_BASE_URL}/api/complaints/all`);
      const data = await response.json();
      
      if (data.success && data.complaints) {
        console.log(' Admin fetched complaints:', data.complaints.length);
        setComplaints(data.complaints);
      }
    } catch (error) {
      console.error(' Error fetching admin complaints:', error);
      Alert.alert('Error', 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAdminMap = async () => {
      await getUserLocation();
      await fetchComplaints();
      await fetchHeatMapData();
    };
    
    initializeAdminMap();
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      if (regionChangeTimeoutRef.current) {
        clearTimeout(regionChangeTimeoutRef.current);
      }
    };
  }, []);

  // Admin search function
  const handleSearch = () => {
    console.log(' ADMIN MANUAL SEARCH TRIGGERED');
    console.log('Current searchQuery state:', searchQuery);
    
    if (!searchQuery || !searchQuery.trim()) {
      console.log(' Empty search query, showing alert');
      Alert.alert('Search Required', 'Please enter a city name, complaint keyword, or status.');
      return;
    }
    
    console.log(' Admin calling searchLocation with:', searchQuery);
    searchLocation(searchQuery);
  };

  // Filter complaints by status
  const getFilteredComplaints = () => {
    if (filterStatus === 'all') return complaints;
    return complaints.filter(c => c.status === filterStatus);
  };

  // Calculate admin statistics
  const statsData = (() => {
    const filteredComplaints = getFilteredComplaints();
    const pending = filteredComplaints.filter(c => c.status?.toLowerCase() === 'pending').length;
    const inProgress = filteredComplaints.filter(c => c.status?.toLowerCase() === 'in_progress').length;
    const resolved = filteredComplaints.filter(c => c.status?.toLowerCase() === 'completed' || c.status?.toLowerCase() === 'resolved').length;
    const highPriority = filteredComplaints.filter(c => (c.priority_score || 0) > 70).length;
    
    console.log(` Admin Statistics - Total: ${filteredComplaints.length}, High Priority: ${highPriority}, Pending: ${pending}, Progress: ${inProgress}, Resolved: ${resolved}`);
    
    return { pending, inProgress, resolved, highPriority, total: filteredComplaints.length };
  })();

  // Get status color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'resolved':
        return '#4CAF50'; // Green
      case 'in_progress':
        return '#FF9800'; // Orange
      case 'pending':
      default:
        return '#F44336'; // Red
    }
  };

  // Get priority color
  const getPriorityColor = (priorityScore) => {
    const score = priorityScore || 0;
    if (score > 80) return '#D32F2F'; // Critical - Dark Red
    if (score > 60) return '#F57C00'; // High - Orange
    if (score > 40) return '#FBC02D'; // Medium - Yellow
    if (score > 20) return '#689F38'; // Low - Green
    return '#9E9E9E'; // Minimal - Gray
  };

  // Get category icon for map markers
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'pothole':
      case 'road_damage':
        return 'car';
      case 'water_issue':
      case 'water_leakage':
        return 'water';
      case 'sewage_overflow':
        return 'warning';
      case 'garbage':
        return 'trash';
      case 'streetlight':
        return 'bulb';
      case 'electricity':
      case 'electrical_danger':
        return 'flash';
      case 'tree_issue':
        return 'leaf';
      case 'flooding':
        return 'rainy';
      case 'fire_hazard':
        return 'flame';
      case 'traffic_signal':
        return 'stop';
      default:
        return 'alert-circle';
    }
  };

  // Create admin density clusters for heatmap visualization
  const createAdminDensityClusters = () => {
    const filteredComplaints = getFilteredComplaints();
    const clusters = [];
    const radius = 0.008; // Roughly 800m radius
    
    const processed = new Set();
    
    filteredComplaints.forEach((complaint, index) => {
      if (processed.has(index)) return;
      
      const lat = parseFloat(complaint.location_latitude);
      const lng = parseFloat(complaint.location_longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;
      
      const nearbyComplaints = [complaint];
      processed.add(index);
      
      // Find nearby complaints
      filteredComplaints.forEach((other, otherIndex) => {
        if (processed.has(otherIndex) || index === otherIndex) return;
        
        const otherLat = parseFloat(other.location_latitude);
        const otherLng = parseFloat(other.location_longitude);
        
        if (isNaN(otherLat) || isNaN(otherLng)) return;
        
        const distance = Math.sqrt(
          Math.pow(lat - otherLat, 2) + Math.pow(lng - otherLng, 2)
        );
        
        if (distance <= radius) {
          nearbyComplaints.push(other);
          processed.add(otherIndex);
        }
      });
      
      // Calculate average priority for admin clusters
      const avgPriority = nearbyComplaints.reduce((sum, c) => sum + (c.priority_score || 0), 0) / nearbyComplaints.length;
      
      clusters.push({
        latitude: lat,
        longitude: lng,
        complaints: nearbyComplaints,
        density: nearbyComplaints.length,
        avgPriority: avgPriority,
        id: `cluster_${index}`
      });
    });
    
    return clusters;
  };

  // Render admin heatmap overlay circles
  const renderAdminHeatmapOverlays = () => {
    const clusters = createAdminDensityClusters();
    
    return clusters.map((cluster) => {
      const density = cluster.density;
      const maxDensity = Math.max(...clusters.map(c => c.density));
      const intensity = density / maxDensity;
      const priority = cluster.avgPriority;
      
      // Admin-specific color coding: Priority + Density
      const getAdminHeatmapColor = (intensity, priority) => {
        if (priority > 80) return 'rgba(211, 47, 47, 0.5)'; // Critical priority - dark red
        if (priority > 60) return 'rgba(245, 124, 0, 0.5)'; // High priority - orange
        if (intensity >= 0.8) return 'rgba(231, 76, 60, 0.4)'; // High density - red
        if (intensity >= 0.6) return 'rgba(230, 126, 34, 0.4)'; // Medium-high - orange
        if (intensity >= 0.4) return 'rgba(241, 196, 15, 0.4)'; // Medium - yellow
        if (intensity >= 0.2) return 'rgba(52, 152, 219, 0.4)'; // Low-medium - blue
        return 'rgba(46, 125, 50, 0.4)'; // Low density - green
      };
      
      const radius = Math.max(100, intensity * 600 + (priority * 2)); // Priority affects radius
      
      return (
        <Circle
          key={cluster.id}
          center={{
            latitude: cluster.latitude,
            longitude: cluster.longitude
          }}
          radius={radius}
          fillColor={getAdminHeatmapColor(intensity, priority)}
          strokeColor={getAdminHeatmapColor(intensity, priority).replace('0.4', '0.7')}
          strokeWidth={priority > 70 ? 3 : 2} // Thicker border for high priority
          onPress={() => {
            setSelectedComplaint({
              id: cluster.id,
              title: `${density} Complaint${density > 1 ? 's' : ''} in this area`,
              description: `Average Priority: ${Math.round(cluster.avgPriority)}\n\n` + 
                          cluster.complaints.map(c => `• ${c.title} (${c.status})`).join('\n'),
              status: 'cluster',
              complaints: cluster.complaints,
              avgPriority: cluster.avgPriority,
              latitude: cluster.latitude,
              longitude: cluster.longitude,
            });
            setShowComplaintModal(true);
          }}
        />
      );
    });
  };

  // Render admin markers
  const renderAdminMarkers = () => {
    const filteredComplaints = getFilteredComplaints();
    
    return filteredComplaints.map((complaint, index) => {
      const lat = parseFloat(complaint.location_latitude);
      const lng = parseFloat(complaint.location_longitude);
      
      if (isNaN(lat) || isNaN(lng)) return null;
      
      const priorityScore = complaint.priority_score || 0;
      const isHighPriority = priorityScore > 70;
      
      return (
        <Marker
          key={complaint.id}
          coordinate={{
            latitude: lat,
            longitude: lng
          }}
          title={complaint.title}
          description={`Priority: ${Math.round(priorityScore)} | Status: ${complaint.status}`}
          onPress={() => {
            console.log(' Admin marker pressed:', complaint.title);
            setIsMarkerInteracting(true);
            setSelectedComplaint(complaint);
            setShowComplaintModal(true);
            
            setTimeout(() => {
              setIsMarkerInteracting(false);
            }, 1000);
          }}
        >
          <View style={styles.adminPinContainer}>
            <View style={[
              styles.adminPinHead, 
              { 
                backgroundColor: getStatusColor(complaint.status),
                borderColor: isHighPriority ? '#FFD700' : 'white',
                borderWidth: isHighPriority ? 3 : 2,
                elevation: isHighPriority ? 12 : 8
              }
            ]}>
              <Ionicons 
                name={getCategoryIcon(complaint.category)} 
                size={isHighPriority ? 18 : 16} 
                color="white" 
              />
              {isHighPriority && (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityText}>!</Text>
                </View>
              )}
            </View>
            <View style={[
              styles.adminPinTail, 
              { borderTopColor: getStatusColor(complaint.status) }
            ]} />
          </View>
        </Marker>
      );
    });
  };

  // Admin Filter Modal
  const FilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModalContent}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filter Complaints</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.filterOptions}>
            {['all', 'pending', 'in_progress', 'completed', 'resolved'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterOption,
                  filterStatus === status && styles.filterOptionActive
                ]}
                onPress={() => {
                  setFilterStatus(status);
                  setShowFilterModal(false);
                }}
              >
                <Text style={[
                  styles.filterOptionText,
                  filterStatus === status && styles.filterOptionTextActive
                ]}>
                  {status === 'all' ? 'All Complaints' : status.toUpperCase().replace('_', ' ')}
                </Text>
                {filterStatus === status && (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Admin Complaint Details Modal
  const AdminComplaintDetailsModal = () => {
    if (!selectedComplaint) return null;

    return (
      <Modal
        visible={showComplaintModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowComplaintModal(false);
          setIsMarkerInteracting(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedComplaint.title}</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowComplaintModal(false);
                  setIsMarkerInteracting(false);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {selectedComplaint.status === 'cluster' ? (
                // Admin cluster view
                <>
                  <View style={styles.statusSection}>
                    <View style={[styles.statusBadge, { backgroundColor: '#1A1A1A' }]}>
                      <Text style={styles.statusText}>ADMIN CLUSTER VIEW</Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedComplaint.avgPriority) }]}>
                      <Text style={styles.statusText}>AVG PRIORITY: {Math.round(selectedComplaint.avgPriority || 0)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Area Summary</Text>
                    <Text style={styles.description}>{selectedComplaint.description}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Individual Complaints</Text>
                    {selectedComplaint.complaints?.map((complaint, index) => (
                      <TouchableOpacity 
                        key={complaint.id}
                        style={styles.adminClusterItem}
                        onPress={() => {
                          setSelectedComplaint(complaint);
                        }}
                      >
                        <View style={[styles.clusterBadge, { backgroundColor: getStatusColor(complaint.status) }]}>
                          <Text style={styles.clusterBadgeText}>{index + 1}</Text>
                        </View>
                        <View style={styles.clusterInfo}>
                          <Text style={styles.clusterTitle}>{complaint.title}</Text>
                          <Text style={styles.clusterStatus}>Status: {complaint.status.replace('_', ' ')}</Text>
                          <Text style={styles.clusterCategory}>Category: {complaint.category}</Text>
                          <Text style={[styles.clusterPriority, { color: getPriorityColor(complaint.priority_score) }]}>
                            Priority: {Math.round(complaint.priority_score || 0)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.adminActionButton}
                          onPress={() => navigation.navigate('ComplaintDetails', { complaintId: complaint.id })}
                        >
                          <Ionicons name="settings" size={20} color="#1A1A1A" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                // Individual complaint view for admin
                <>
                  <View style={styles.statusSection}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedComplaint.status) }]}>
                      <Text style={styles.statusText}>{selectedComplaint.status.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedComplaint.priority_score) }]}>
                      <Text style={styles.statusText}>PRIORITY: {Math.round(selectedComplaint.priority_score || 0)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{selectedComplaint.description}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Admin Details</Text>
                    <Text style={styles.detailText}>ID: {selectedComplaint.id}</Text>
                    <Text style={styles.detailText}>Category: {selectedComplaint.category}</Text>
                    <Text style={styles.detailText}>
                      Location: {selectedComplaint.location_latitude}, {selectedComplaint.location_longitude}
                    </Text>
                    <Text style={styles.detailText}>
                      Priority Score: {Math.round((selectedComplaint.priority_score || 0))}
                    </Text>
                    <Text style={styles.detailText}>
                      Created: {selectedComplaint.created_at ? new Date(selectedComplaint.created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                    {selectedComplaint.assigned_to && (
                      <Text style={styles.detailText}>
                        Assigned to: {selectedComplaint.assigned_to}
                      </Text>
                    )}
                  </View>

                  {/* Admin Actions */}
                  <View style={styles.adminActionsSection}>
                    <Text style={styles.sectionTitle}>Admin Actions</Text>
                    <View style={styles.adminActionsRow}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#1A1A1A' }]}
                        onPress={() => navigation.navigate('ComplaintDetails', { complaintId: selectedComplaint.id })}
                      >
                        <Ionicons name="create" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                        onPress={() => navigation.navigate('PriorityQueue')}
                      >
                        <Ionicons name="list" size={20} color="white" />
                        <Text style={styles.actionButtonText}>Queue</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}

              {selectedComplaint.image_urls && selectedComplaint.image_urls.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Images</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedComplaint.image_urls.map((imageUrl, index) => (
                      <View key={index} style={{ marginRight: 15 }}>
                        <Image 
                          source={{ uri: imageUrl }} 
                          style={styles.complaintImage}
                          resizeMode="cover"
                        />
                        <TouchableOpacity 
                          style={styles.explainButtonMap} 
                          onPress={() => fetchGradCamExplanation(imageUrl)}
                        >
                          <Ionicons name="scan-outline" size={16} color="#fff" />
                          <Text style={styles.explainButtonText}>Explain AI</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Grad-CAM Display Modal
  const GradCamModal = () => (
    <Modal
      visible={showGradCamModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowGradCamModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { width: '90%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Image Explanation</Text>
            <TouchableOpacity onPress={() => setShowGradCamModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }}>
            {gradCamLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1A1A1A" />
                <Text style={{ marginTop: 10 }}>Generating AI heatmap explanation...</Text>
              </View>
            ) : gradCamResult ? (
              <View style={{ padding: 10 }}>
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
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      
      <LinearGradient
        colors={['#1A1A1A', '#1A1A1A']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Complaint Map</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              onPress={() => setShowFilterModal(true)} 
              style={styles.filterButton}
            >
              <Ionicons name="filter" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={getUserLocation} 
              style={styles.locationButton}
            >
              <Ionicons name="location" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              fetchComplaints();
              fetchHeatMapData();
            }}>
              <Ionicons name="refresh" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Admin Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Admin search: complaints, status, priority, cities..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={(text) => {
              console.log(' Admin text input changed:', text);
              setSearchQuery(text);
              
              if (searchTimeout) {
                clearTimeout(searchTimeout);
              }
              
              if (text.trim().length === 0) {
                setSearchResults([]);
                setShowSearchResults(false);
              } else if (text.trim().length >= 2) {
                const newTimeout = setTimeout(() => {
                  console.log('️ Admin auto-searching after typing pause:', text);
                  searchLocation(text);
                }, 500);
                setSearchTimeout(newTimeout);
              }
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
          />
          <TouchableOpacity 
            onPress={handleSearch}
            style={styles.searchButton}
          >
            <Ionicons name="search-circle" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                console.log('️ Admin clearing search');
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        
        {searchLoading && (
          <ActivityIndicator size="small" color="#1A1A1A" style={styles.searchLoader} />
        )}
      </View>

      {/* Admin Search Results */}
      {showSearchResults && (
        <View style={styles.searchResultsContainer}>
          {searchResults.length > 0 ? (
          <ScrollView style={styles.searchResultsList}>
            {searchResults.map((result) => {
              let iconName, iconColor;
              switch (result.type) {
                case 'complaint':
                  iconName = 'flag';
                  iconColor = result.complaint?.priority_score > 70 ? '#F44336' : '#FF9800';
                  break;
                case 'city':
                  iconName = 'business';
                  iconColor = '#1A1A1A';
                  break;
                default:
                  iconName = 'location';
                  iconColor = '#1A1A1A';
              }

              return (
                <TouchableOpacity
                  key={result.id}
                  style={styles.searchResultItem}
                  onPress={() => selectSearchResult(result)}
                >
                  <Ionicons 
                    name={iconName} 
                    size={20} 
                    color={iconColor} 
                  />
                  <View style={styles.searchResultText}>
                    <Text style={styles.searchResultTitle}>{result.title}</Text>
                    <Text style={styles.searchResultSubtitle}>{result.subtitle}</Text>
                  </View>
                  {result.complaint?.priority_score > 70 && (
                    <View style={styles.highPriorityIndicator}>
                      <Text style={styles.highPriorityText}>HIGH</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                {searchLoading ? 'Searching...' : 'No results found'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        {loading || locationLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1A1A1A" />
            <Text style={styles.loadingText}>
              {locationLoading ? 'Getting admin location...' : 'Loading complaints...'}
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            region={region}
            showsUserLocation={true}
            showsMyLocationButton={true}
            followsUserLocation={false}
            moveOnMarkerPress={false}
            zoomEnabled={true}
            scrollEnabled={true}
            pitchEnabled={false}
            rotateEnabled={false}
            onRegionChangeComplete={(newRegion) => {
              if (regionChangeTimeoutRef.current) {
                clearTimeout(regionChangeTimeoutRef.current);
              }

              regionChangeTimeoutRef.current = setTimeout(() => {
                if (!isProgrammaticMove && !showComplaintModal && !isMarkerInteracting) {
                  console.log(' Admin manually moved map to:', newRegion);
                  setRegion(newRegion);
                } else {
                  console.log(' Ignoring admin region change (programmatic move, modal open, or marker interaction)');
                }
              }, 200);
            }}
          >
            {showHeatmap ? renderAdminHeatmapOverlays() : renderAdminMarkers()}
          </MapView>
        )}
      </View>

      {/* Admin View Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, showHeatmap && styles.toggleButtonActive]}
          onPress={() => setShowHeatmap(true)}
        >
          <Ionicons 
            name="analytics" 
            size={20} 
            color={showHeatmap ? '#fff' : '#666'} 
          />
          <Text style={[styles.toggleText, showHeatmap && styles.toggleTextActive]}>
            Heatmap
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, !showHeatmap && styles.toggleButtonActive]}
          onPress={() => setShowHeatmap(false)}
        >
          <Ionicons 
            name="location" 
            size={20} 
            color={!showHeatmap ? '#fff' : '#666'} 
          />
          <Text style={[styles.toggleText, !showHeatmap && styles.toggleTextActive]}>
            Markers
          </Text>
        </TouchableOpacity>
      </View>

      {/* Admin Stats */}
      <View style={styles.adminStatsContainer}>
        <Text style={styles.adminStatsTitle}>
          Admin Dashboard • Filter: {filterStatus === 'all' ? 'All' : filterStatus.toUpperCase()}
        </Text>
        <Text style={styles.statsText}>
          {statsData.total} Complaints {showHeatmap ? 'in Priority Heatmap' : 'as Markers'} 
          {statsData.highPriority > 0 && ` • ${statsData.highPriority} High Priority`}
        </Text>
        <Text style={styles.adminStatsText}>
          {statsData.pending} Pending • 
          {statsData.inProgress} Progress • 
          {statsData.resolved} Resolved
        </Text>
      </View>

      <FilterModal />
      <AdminComplaintDetailsModal />
      <GradCamModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    marginRight: 12,
    padding: 4,
  },
  locationButton: {
    marginRight: 12,
    padding: 4,
  },
  searchContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 45,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    marginLeft: 10,
  },
  searchButton: {
    marginLeft: 10,
    padding: 2,
  },
  searchLoader: {
    position: 'absolute',
    right: 20,
    top: 24,
  },
  searchResultsContainer: {
    backgroundColor: 'white',
    maxHeight: 250,
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: '#1A1A1A',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginHorizontal: 16,
    borderRadius: 8,
    marginTop: 4,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultText: {
    marginLeft: 12,
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  searchResultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  highPriorityIndicator: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  highPriorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#1A1A1A',
  },
  // Admin-specific pin styles
  adminPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminPinHead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  adminPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  priorityBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  priorityText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  adminStatsContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  adminStatsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    padding: 16,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  complaintImage: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  toggleButtonActive: {
    backgroundColor: '#1A1A1A',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  toggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  // Filter Modal Styles
  filterModalContent: {
    backgroundColor: 'white',
    width: '85%',
    maxHeight: '60%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1A1A1A',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  filterOptions: {
    padding: 16,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: '#F5F5F5',
  },
  filterOptionActive: {
    backgroundColor: '#1A1A1A',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Admin cluster item styles
  adminClusterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    marginVertical: 4,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1A1A1A',
  },
  clusterBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clusterBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  clusterInfo: {
    flex: 1,
  },
  clusterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  clusterStatus: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  clusterCategory: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  clusterPriority: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  adminActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  adminActionsSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  adminActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  explainButtonMap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
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

export default AdminComplaintMapScreen;
