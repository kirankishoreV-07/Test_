import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
 View,
 Text,
 StyleSheet,
 TouchableOpacity,
 Alert,
 ActivityIndicator,
 Image,
 TextInput,
 SafeAreaView,
 Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { API_BASE_URL, makeApiCall, apiClient } from '../../../config/supabase';
import { supabase } from '../../../config/supabase';
import LocationPrivacySelector from '../../components/LocationPrivacySelector';
import LocationService from '../../services/LocationService';
import SarvamSpeechService from '../../services/SarvamSpeechService';
import StableTextInput from '../../components/StableTextInput';

const SubmitComplaintScreen = ({ navigation }) => {
 const [formData, setFormData] = useState({
 title: '',
 description: '',
 location: '',
 category: '',
 });
 const [selectedImage, setSelectedImage] = useState(null);
 const [imageValidation, setImageValidation] = useState(null);
 const [loading, setLoading] = useState(false);
 const [validatingImage, setValidatingImage] = useState(false);
 
 // Voice input related states
 const [selectedLang, setSelectedLang] = useState('hi-IN');
 const [isRecording, setIsRecording] = useState(false);
 const [voiceError, setVoiceError] = useState(null);
 
 // Sarvam Speech Service instance
 const [speechService] = useState(new SarvamSpeechService());
 
 // Location-related state
 const [locationData, setLocationData] = useState(null);
 const [selectedPrivacyLevel, setSelectedPrivacyLevel] = useState(null);
 const [locationPriorityScore, setLocationPriorityScore] = useState(null);
 const [autoCapturingLocation, setAutoCapturingLocation] = useState(false);
 const [locationCaptured, setLocationCaptured] = useState(false);

 // Auto-capture location when category is selected
 useEffect(() => {
 if (formData.category && !locationCaptured) {
 autoCaptureLo‌‌cation();
 }
 }, [formData.category]);

 // Initialize speech service
 useEffect(() => {
 // Initialize SarvamSpeechService with callbacks
 speechService.init({
 onStart: () => {
 setIsRecording(true);
 console.log('Speech recognition started');
 },
 onResult: (result) => {
 if (result && result.value && result.value.length > 0) {
 setFormData(prev => ({ 
 ...prev, 
 description: result.value[0] 
 }));
 }
 },
 onTranslation: (translation) => {
 console.log('Translation received:', translation);
 },
 onError: (error) => {
 console.error('Speech recognition error:', error);
 setVoiceError(error.error?.message || 'Error in speech recognition');
 setIsRecording(false);
 
 Alert.alert(
 'Speech Recognition Error',
 `There was an error processing your speech. Please try again or type your description.`,
 [{ text: 'OK' }]
 );
 },
 onEnd: () => {
 setIsRecording(false);
 console.log('Speech recognition ended');
 }
 });
 
 return () => {
 // Clean up speech service on component unmount
 if (isRecording) {
 speechService.stopSpeech();
 }
 };
 }, []);

 // Create refs for TextInputs to maintain focus
 const titleInputRef = useRef(null);
 const descriptionInputRef = useRef(null);
 const locationInputRef = useRef(null);

 // Simple handlers without unnecessary optimizations
 const handleTitleChange = useCallback((text) => {
 setFormData(prev => ({ ...prev, title: text }));
 }, []);

 const handleDescriptionChange = useCallback((text) => {
 setFormData(prev => ({ ...prev, description: text }));
 }, []);

 const handleLocationChange = useCallback((text) => {
 setFormData(prev => ({ ...prev, location: text }));
 }, []);

 // Complaint categories with their types for location privacy
 const complaintCategories = [
 { value: 'fire_hazard', label: 'Fire Hazard', urgency: 'urgent' },
 { value: 'electrical_danger', label: 'Electrical Danger', urgency: 'urgent' },
 { value: 'sewage_overflow', label: 'Sewage Overflow', urgency: 'urgent' },
 { value: 'pothole', label: 'Pothole', urgency: 'general' },
 { value: 'broken_streetlight', label: 'Broken Streetlight', urgency: 'safety' },
 { value: 'traffic_signal', label: 'Traffic Signal Issue', urgency: 'safety' },
 { value: 'garbage_collection', label: 'Garbage Collection', urgency: 'general' },
 { value: 'water_leakage', label: 'Water Leakage', urgency: 'general' },
 { value: 'road_damage', label: 'Road Damage', urgency: 'general' },
 { value: 'others', label: 'Others', urgency: 'general' },
 ];

 const getComplaintTypeFromCategory = () => {
 const category = complaintCategories.find(cat => cat.value === formData.category);
 return category ? category.value : 'general';
 };

 // Auto-capture location based on complaint category
 const autoCaptureLo‌‌cation = async () => {
 if (autoCapturingLocation || locationCaptured) return;
 
 setAutoCapturingLocation(true);
 
 try {
 // Get recommended privacy level for the complaint type
 const complaintType = getComplaintTypeFromCategory();
 const recommendedPrivacy = LocationService.getRecommendedPrivacyLevel(complaintType);
 setSelectedPrivacyLevel(recommendedPrivacy);
 
 // Show user-friendly message about location capture
 const urgencyLevel = LocationService.determineUrgencyLevel(complaintType);
 const isUrgent = urgencyLevel === 'urgent';
 
 Alert.alert(
 'Location Required',
 isUrgent 
 ? `For ${formData.category} complaints, we need your exact location to prioritize emergency response. This helps us route your complaint to the nearest response team.`
 : `We'll capture your location to help prioritize your complaint and route it to the correct municipal office. Your privacy is protected with street-level accuracy.`,
 [
 { 
 text: 'Cancel', 
 style: 'cancel',
 onPress: () => setAutoCapturingLocation(false)
 },
 { 
 text: isUrgent ? 'Allow Exact Location' : 'Allow Location', 
 onPress: () => proceedWithLocationCapture(recommendedPrivacy, complaintType)
 }
 ]
 );
 
 } catch (error) {
 console.error('Auto location capture error:', error);
 setAutoCapturingLocation(false);
 }
 };

 const proceedWithLocationCapture = async (privacyLevel, complaintType) => {
 try {
 // Capture location with recommended privacy level
 const location = await LocationService.getLocationWithPrivacy(privacyLevel, complaintType);
 
 setLocationData(location);
 setLocationCaptured(true);
 
 // Immediately calculate priority score
 await calculateLocationPriority(location, complaintType);
 
 // Show success message with location info
 Alert.alert(
 'Location Captured Successfully',
 `Accuracy: ±${location.radiusM}m (${location.precision})\n` +
 `Privacy Level: ${location.privacyLevel}\n` +
 `Your complaint will be prioritized based on nearby infrastructure.`,
 [{ text: 'Continue', style: 'default' }]
 );
 
 } catch (error) {
 console.error('Location capture error:', error);
 Alert.alert(
 'Location Error',
 'Unable to capture location. You can try again or submit without location (lower priority).',
 [
 { text: 'Retry', onPress: () => proceedWithLocationCapture(privacyLevel, complaintType) },
 { text: 'Skip Location', style: 'destructive' }
 ]
 );
 } finally {
 setAutoCapturingLocation(false);
 }
 };

 const calculateLocationPriority = async (location, complaintType) => {
 try {
 const response = await fetch(`${API_BASE_URL}/api/location-priority/calculate`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 latitude: location.latitude,
 longitude: location.longitude,
 complaintType: complaintType,
 locationMeta: {
 privacyLevel: location.privacyLevel,
 radiusM: location.radiusM,
 precision: location.precision,
 description: location.description
 }
 }),
 });
 
 if (response.ok) {
 const priorityResult = await response.json();
 setLocationPriorityScore(priorityResult);
 
 // Show priority notification for high-priority complaints
 if (priorityResult.priorityLevel === 'CRITICAL') {
 Alert.alert(
 'High Priority Complaint Detected',
 `Your complaint has been marked as ${priorityResult.priorityLevel} priority due to proximity to critical infrastructure. It will receive immediate attention.`,
 [{ text: 'Understood', style: 'default' }]
 );
 }
 } else {
 console.error('Priority calculation failed:', response.status);
 }
 
 } catch (error) {
 console.error('Failed to calculate location priority:', error);
 }
 };

 const pickImage = async () => {
 try {
 // Request permissions
 const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
 
 if (permissionResult.granted === false) {
 Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
 return;
 }

 const result = await ImagePicker.launchImageLibraryAsync({
 mediaTypes: ImagePicker.MediaTypeOptions.Images,
 allowsEditing: true,
 aspect: [4, 3],
 quality: 0.8,
 base64: false,
 });

 if (!result.canceled) {
 setSelectedImage(result.assets[0]);
 setImageValidation(null); // Reset previous validation
 await validateImage(result.assets[0]);
 }
 } catch (error) {
 console.error('Image picker error:', error);
 Alert.alert('Error', 'Failed to pick image');
 }
 };

 const takePhoto = async () => {
 try {
 // Request permissions
 const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
 
 if (permissionResult.granted === false) {
 Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
 return;
 }

 const result = await ImagePicker.launchCameraAsync({
 allowsEditing: true,
 aspect: [4, 3],
 quality: 0.8,
 base64: false,
 });

 if (!result.canceled) {
 setSelectedImage(result.assets[0]);
 setImageValidation(null); // Reset previous validation
 await validateImage(result.assets[0]);
 }
 } catch (error) {
 console.error('Camera error:', error);
 Alert.alert('Error', 'Failed to take photo');
 }
 };

 const validateImage = async (imageAsset) => {
 if (!imageAsset) return;
 setValidatingImage(true);
 try {
 console.log(' Starting image validation...');
 // 1. Upload image to Cloudinary
 const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dsvc9y4rq/image/upload';
 const UPLOAD_PRESET = 'damage';
 const data = new FormData();
 data.append('file', {
 uri: imageAsset.uri,
 type: imageAsset.mimeType || 'image/jpeg',
 name: imageAsset.fileName || 'civic-image.jpg',
 });
 data.append('upload_preset', UPLOAD_PRESET);
 const cloudRes = await fetch(CLOUDINARY_URL, {
 method: 'POST',
 body: data,
 });
 const cloudResult = await cloudRes.json();
 if (!cloudResult.secure_url) throw new Error('Cloudinary upload failed');
 
 console.log(' Image uploaded to Cloudinary:', cloudResult.secure_url);
 
 // Update selectedImage to use Cloudinary URL instead of local file path
 setSelectedImage({
 ...imageAsset,
 uri: cloudResult.secure_url, // Use Cloudinary URL
 cloudinaryUrl: cloudResult.secure_url,
 publicId: cloudResult.public_id
 });
 // 2. Send imageUrl to backend for validation
 const validateRes = await fetch(`${API_BASE_URL}/api/image-analysis/validate-image`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ imageUrl: cloudResult.secure_url }),
 });
 const result = await validateRes.json();
 console.log(' Validation result:', result);

 // Ensure result has expected fields, provide defaults if missing
 const validationData = {
 confidence: result.confidence || 0,
 modelConfidence: result.modelConfidence || 0,
 openaiConfidence: result.openaiConfidence || 0,
 allowUpload: result.confidence !== undefined && result.confidence >= 0.7,
 message: result.message || 'No validation message provided',
 data: result.data || {},
 raw: result.raw || null,
 };
 setImageValidation(validationData);
 
 // Automatically delete invalid images from Cloudinary via backend
 if (!validationData.allowUpload && cloudResult?.public_id) {
 try {
 console.log('️ Attempting to delete invalid image from Cloudinary:', cloudResult.public_id);
 const deleteRes = await fetch(`${API_BASE_URL}/cloudinary/delete-image`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ public_id: cloudResult.public_id })
 });
 
 if (deleteRes.ok) {
 const deleteResult = await deleteRes.json();
 console.log(' Cloudinary delete response:', deleteResult);
 } else {
 console.warn('️ Cloudinary delete failed with status:', deleteRes.status);
 }
 } catch (deleteErr) {
 console.warn('️ Failed to delete image from Cloudinary:', deleteErr.message);
 }
 } else if (!validationData.allowUpload) {
 console.log('ℹ️ Skipping Cloudinary delete - no public_id available');
 }

 // Determine display confidence
 const displayConfidence = validationData.modelConfidence >= 0.7 ? validationData.modelConfidence : validationData.confidence;
 
 if (validationData.confidence !== undefined) {
 if (validationData.allowUpload) {
 Alert.alert(
 'Valid Civic Issue Detected',
 `Confidence Score: ${(displayConfidence * 100).toFixed(1)}%`,
 [{ text: 'Continue', style: 'default' }]
 );
 } else {
 Alert.alert(
 'Image Validation Failed',
 `Confidence Score: ${(displayConfidence * 100).toFixed(1)}%\nThe selected image does not appear to show a valid civic issue. Please select a different image showing the actual problem.`,
 [
 { text: 'Change Image', onPress: () => setSelectedImage(null) }
 ]
 );
 }
 } else {
 Alert.alert(
 ' Image Validation Failed',
 result.message || 'Validation failed.',
 [
 { text: 'Change Image', onPress: () => setSelectedImage(null) }
 ]
 );
 }
 } catch (error) {
 console.error(' Image validation error:', error);
 Alert.alert(
 'Validation Error',
 'Failed to validate image. Please check your connection and try again.',
 [
 { text: 'Retry', onPress: () => validateImage(imageAsset) },
 { text: 'Skip Validation', style: 'destructive' }
 ]
 );
 } finally {
 setValidatingImage(false);
 }
 };

 // Voice input functions
 const startVoiceInput = async () => {
 setVoiceError(null);
 
 try {
 // Request audio recording permissions
 const { status } = await Audio.requestPermissionsAsync();
 if (status !== 'granted') {
 Alert.alert('Permission Required', 'Please allow microphone access to record your complaint.');
 return;
 }
 
 // Start recording with Sarvam Speech Service using the selected language
 console.log(`Starting speech recognition with language: ${selectedLang}`);
 await speechService.startSpeech(selectedLang);
 
 } catch (err) {
 console.error('Speech recognition setup error:', err);
 setVoiceError(err.message);
 setIsRecording(false);
 Alert.alert('Error', 'Failed to start speech recognition: ' + err.message);
 }
 };

 const stopVoiceInput = async () => {
 try {
 // Stop the speech recording
 await speechService.processAndStopSpeech(selectedLang);
 setIsRecording(false);
 } catch (error) {
 console.error('Error stopping speech:', error);
 setIsRecording(false);
 }
 };

 // Location handling functions (legacy - for manual override)
 const handleLocationSelect = async (location) => {
 setLocationData(location);
 setLocationCaptured(true);
 
 // Calculate location-based priority score
 await calculateLocationPriority(location, getComplaintTypeFromCategory());
 };

 const handlePrivacyLevelChange = (privacyLevel) => {
 setSelectedPrivacyLevel(privacyLevel);
 };

 const submitComplaint = async () => {
 if (!formData.title.trim()) {
 Alert.alert('Error', 'Please enter a complaint title');
 return;
 }

 if (!formData.description.trim()) {
 Alert.alert('Error', 'Please enter a complaint description');
 return;
 }

 if (!selectedImage) {
 Alert.alert('Error', 'Please select an image of the civic issue');
 return;
 }

 if (!locationData) {
 Alert.alert(
 'Location Required', 
 'Location is required for priority assessment. Would you like to capture your location now?',
 [
 { text: 'Cancel', style: 'cancel' },
 { text: 'Get Location', onPress: () => autoCaptureLo‌‌cation() }
 ]
 );
 return;
 }

 if (imageValidation && !imageValidation.allowUpload) {
 Alert.alert(
 'Image Validation Failed',
 `Confidence Score: ${(imageValidation.confidence * 100).toFixed(1)}%\n\nThe selected image does not appear to show a valid civic issue. Please change the image before submitting.`,
 [
 { text: 'Change Image', onPress: () => setSelectedImage(null) }
 ]
 );
 return;
 }

 await proceedWithSubmission();
 };

 const proceedWithSubmission = async () => {
 setLoading(true);
 
 try {
 // Prepare submission data
 const submissionData = {
 title: formData.title.trim(),
 description: formData.description.trim(),
 category: formData.category,
 locationData: {
 latitude: locationData.latitude,
 longitude: locationData.longitude,
 privacyLevel: locationData.privacyLevel || 'street',
 accuracy: locationData.accuracy || locationData.radiusM || 25,
 precision: locationData.precision || 'street',
 description: locationData.description || 'User location',
 address: locationData.address || `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`
 },
 imageValidation: imageValidation || {
 allowUpload: true,
 confidence: 0.5,
 success: true
 },
 imageUrl: selectedImage?.uri || null
 };
 
 console.log(' Submitting complaint with comprehensive data:', submissionData);

 // Submit to new comprehensive endpoint using makeApiCall which automatically includes auth token
 const result = await makeApiCall(apiClient.complaints.submit, {
 method: 'POST',
 body: JSON.stringify(submissionData),
 });

 console.log(' Response data:', result);
 
 if (result.success) {
 // Prepare new complaint object for map display
 const newComplaint = {
 id: result.complaint.id,
 title: result.complaint.title,
 description: submissionData.description,
 category: submissionData.category,
 status: result.complaint.status || 'pending',
 latitude: locationData.latitude,
 longitude: locationData.longitude,
 location: locationData.description || locationData.address,
 created_at: new Date().toISOString()
 };
 
 Alert.alert(
 'Complaint Submitted Successfully',
 `Complaint ID: ${result.complaint.id}\n` +
 `Priority: ${result.complaint.priorityLevel || 'MEDIUM'} (${Math.round((result.complaint.priorityScore || 0) * 100)}%)\n` +
 `Status: ${result.complaint.status}\n\n` +
 `Expected Response: ${result.nextSteps[2] || 'Processing'}\n\n` +
 `Reasoning: ${result.priorityAnalysis.reasoning.substring(0, 150)}...`,
 [{ 
 text: 'View Details', 
 onPress: () => showComplaintDetails(result) 
 }, {
 text: 'View on Map', 
 onPress: () => navigation.navigate('ComplaintMap', { newComplaint })
 }, {
 text: 'Provide Feedback', 
 onPress: () => navigation.navigate('FeedbackScreen', {
 complaintId: result.complaint.id,
 complaintTitle: title
 })
 }]
 );
 } else {
 console.error(' Backend returned error:', result);
 throw new Error(result.error || result.message || 'Submission failed');
 }

 } catch (error) {
 console.error(' Submission error:', error);
 
 let errorMessage = 'Please check your connection and try again.';
 let errorTitle = 'Submission Failed';
 
 if (error.message.includes('Network request failed')) {
 errorMessage = 'Cannot connect to server. Please check your internet connection.';
 errorTitle = 'Connection Error';
 } else if (error.message.includes('HTTP 404')) {
 errorMessage = 'API endpoint not found. Please update the app.';
 errorTitle = 'Service Error';
 } else if (error.message.includes('HTTP 400')) {
 errorMessage = 'Invalid data submitted. Please check all fields.';
 errorTitle = 'Validation Error';
 } else if (error.message.includes('HTTP 500')) {
 errorMessage = 'Server error. Please try again later.';
 errorTitle = 'Server Error';
 } else if (error.message) {
 errorMessage = error.message;
 }
 
 Alert.alert(
 errorTitle, 
 errorMessage,
 [
 { text: 'Retry', onPress: () => proceedWithSubmission() },
 { text: 'Cancel', style: 'cancel' }
 ]
 );
 } finally {
 setLoading(false);
 }
 };

 const showComplaintDetails = (result) => {
 const details = `PRIORITY ANALYSIS:\n` +
 `Total Score: ${Math.round((result.priorityAnalysis.totalScore || 0) * 100)}%\n` +
 `Priority Level: ${result.priorityAnalysis.priorityLevel}\n\n` +
 `LOCATION ANALYSIS:\n` +
 `Score: ${Math.round((result.priorityAnalysis.breakdown.locationScore || 0) * 100)}%\n` +
 `Facilities Nearby: ${result.priorityAnalysis.breakdown.facilitiesNearby}\n` +
 `Privacy: ${result.location.privacyLevel} (${result.location.accuracy})\n\n` +
 `IMAGE ANALYSIS:\n` +
 `Score: ${Math.round((result.priorityAnalysis.breakdown.imageScore || 0) * 100)}%\n\n` +
 `NEXT STEPS:\n` +
 result.nextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n');
 
 Alert.alert('Complaint Details', details, [{ text: 'OK' }]);
 };

 const calculateTotalPriorityScore = () => {
 const imageScore = imageValidation?.data?.priorityScore || 0;
 const locationScore = locationPriorityScore?.priorityScore || 0;
 
 // Weighted combination: 40% image analysis + 60% location analysis
 const totalScore = (imageScore * 0.4) + (locationScore * 0.6);
 return Math.min(totalScore * 100, 100); // Convert to percentage and cap at 100%
 };

 const renderImageValidationStatus = () => {
 if (validatingImage) {
 return (
 <View style={styles.validationStatus}>
 <ActivityIndicator size="small" color="#1A1A1A" />
 <Text style={styles.validationText}>Validating civic issue...</Text>
 </View>
 );
 }

 if (imageValidation) {
 if (imageValidation.allowUpload) {
 // Extract classification from message like "Detected Issue: pothole"
 const extractClassification = (message) => {
 if (!message) return 'Unknown';
 const match = message.match(/Detected Issue:\s*(.+)/i);
 return match ? match[1].trim() : 'Civic Issue';
 };

 const classification = extractClassification(imageValidation.message);
 
 return (
 <View style={[styles.validationStatus, styles.validationSuccess]}>
 <Text style={styles.validationText}>
 Valid civic issue detected (Classification: {classification})
 </Text>
 </View>
 );
 } else {
 return (
 <View style={[styles.validationStatus, styles.validationError]}>
 <Text style={styles.validationText}>{imageValidation.message}</Text>
 </View>
 );
 }
 }

 return null;
 };

 return (
 <KeyboardAwareScrollView 
 style={styles.container}
 enableOnAndroid={true}
 keyboardShouldPersistTaps="handled"
 extraScrollHeight={100}
 showsVerticalScrollIndicator={false}
 >
 <View style={styles.header}>
 <Text style={styles.title}>Submit Civic Complaint</Text>
 <Text style={styles.subtitle}>Report civic issues with AI-powered priority scoring</Text>
 </View>

 <View style={styles.form}>
 <Text style={styles.label}>Complaint Category *</Text>
 <View style={styles.categoryContainer}>
 {complaintCategories.map((category) => (
 <TouchableOpacity
 key={category.value}
 style={[
 styles.categoryButton,
 formData.category === category.value && styles.selectedCategory
 ]}
 onPress={() => setFormData(prev => ({ ...prev, category: category.value }))}
 >
 <Text style={[
 styles.categoryText,
 formData.category === category.value && styles.selectedCategoryText
 ]}>
 {category.label}
 </Text>
 <Text style={styles.urgencyBadge}>
 {category.urgency === 'urgent' ? '' : category.urgency === 'safety' ? '' : ''}
 </Text>
 </TouchableOpacity>
 ))}
 </View>

 <Text style={styles.label}>Complaint Title *</Text>
 <TextInput
 ref={titleInputRef}
 placeholder="Brief title describing the issue"
 value={formData.title}
 onChangeText={handleTitleChange}
 style={styles.input}
 returnKeyType="next"
 onSubmitEditing={() => descriptionInputRef.current?.focus()}
 />

 {/* Language Picker for Voice Input */}
 <Text style={{ fontWeight: 'bold', marginBottom: 4, marginTop: 15 }}>Select Language for Voice Input:</Text>
 <Picker
 selectedValue={selectedLang}
 onValueChange={setSelectedLang}
 style={{ backgroundColor: '#f0f0f0', borderRadius: 8, marginBottom: 12 }}
 >
 <Picker.Item label="Hindi" value="hi-IN" />
 <Picker.Item label="English" value="en-US" />
 <Picker.Item label="Telugu" value="te-IN" />
 <Picker.Item label="Tamil" value="ta-IN" />
 <Picker.Item label="Kannada" value="kn-IN" />
 <Picker.Item label="Marathi" value="mr-IN" />
 <Picker.Item label="Bengali" value="bn-IN" />
 <Picker.Item label="Gujarati" value="gu-IN" />
 <Picker.Item label="Malayalam" value="ml-IN" />
 <Picker.Item label="Punjabi" value="pa-IN" />
 </Picker>

 <Text style={styles.label}>Description *</Text>
 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
 <TextInput
 ref={descriptionInputRef}
 placeholder="Detailed description of the civic issue"
 value={formData.description}
 onChangeText={handleDescriptionChange}
 style={[styles.input, styles.textArea, { flex: 1 }]}
 multiline
 numberOfLines={4}
 textAlignVertical="top"
 />
 <TouchableOpacity 
 onPress={isRecording ? stopVoiceInput : startVoiceInput} 
 style={{ marginLeft: 10 }}
 disabled={loading}
 >
 <Ionicons 
 name={isRecording ? 'mic' : 'mic-outline'} 
 size={28} 
 color={isRecording ? '#1A1A1A' : loading ? '#D1D5DB' : '#6B7280'} 
 />
 {isRecording && <Text style={{fontSize: 10, color: '#1A1A1A', textAlign: 'center'}}>Recording</Text>}
 </TouchableOpacity>
 </View>
 {voiceError && (
 <Text style={styles.errorText}>Error: {voiceError}</Text>
 )}

 <Text style={styles.label}>Location</Text>
 <TextInput
 ref={locationInputRef}
 placeholder="Location or address of the issue (optional)"
 value={formData.location}
 onChangeText={handleLocationChange}
 style={styles.input}
 />

 <Text style={styles.label}>Location Priority Assessment *</Text>
 <Text style={styles.photoHint}>
 Location is automatically captured when you select a complaint category
 </Text>
 
 {autoCapturingLocation && (
 <View style={styles.locationStatusContainer}>
 <ActivityIndicator size="small" color="#1A1A1A" />
 <Text style={styles.locationStatusText}>Capturing your location...</Text>
 </View>
 )}
 
 {locationCaptured && locationData && (
 <View style={styles.locationCapturedContainer}>
 <Text style={styles.locationCapturedTitle}>Location Captured Successfully</Text>
 <Text style={styles.locationDetailText}>
 Accuracy: ±{locationData.radiusM}m ({locationData.precision})
 </Text>
 <Text style={styles.locationDetailText}>
 Privacy: {locationData.description}
 </Text>
 <TouchableOpacity 
 style={styles.recaptureButton}
 onPress={() => {
 setLocationCaptured(false);
 setLocationData(null);
 setLocationPriorityScore(null);
 autoCaptureLo‌‌cation();
 }}
 >
 <Text style={styles.recaptureButtonText}>Recapture Location</Text>
 </TouchableOpacity>
 </View>
 )}
 
 {!locationCaptured && !autoCapturingLocation && formData.category && (
 <TouchableOpacity 
 style={styles.manualLocationButton}
 onPress={autoCaptureLo‌‌cation}
 >
 <Text style={styles.manualLocationButtonText}>Capture Location Now</Text>
 </TouchableOpacity>
 )}

 {/* Manual Location Selector - Hidden by default, shown only if needed */}
 {false && formData.category && (
 <LocationPrivacySelector
 complaintType={getComplaintTypeFromCategory()}
 onLocationSelect={handleLocationSelect}
 onPrivacyLevelChange={handlePrivacyLevelChange}
 visible={true}
 />
 )}

 {locationPriorityScore && (
 <View style={styles.locationScoreContainer}>
 <Text style={styles.locationScoreTitle}>Location Priority Analysis</Text>
 <Text style={styles.locationScoreText}>
 Priority Level: {locationPriorityScore.priorityLevel} ({Math.round((locationPriorityScore.priorityScore || 0) * 100)}%)
 </Text>
 <Text style={styles.locationScoreReason}>
 {locationPriorityScore.reasoning}
 </Text>
 </View>
 )}

 <Text style={styles.label}>Issue Photo *</Text>
 <Text style={styles.photoHint}>
 Upload a clear photo showing the civic issue. Our AI will verify it's a valid civic problem.
 </Text>

 <View style={styles.imageSection}>
 {selectedImage ? (
 <View style={styles.selectedImageContainer}>
 <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
 <TouchableOpacity 
 style={styles.changeImageButton}
 onPress={() => setSelectedImage(null)}
 >
 <Text style={styles.changeImageText}>Change Image</Text>
 </TouchableOpacity>
 </View>
 ) : (
 <View style={styles.imagePickerContainer}>
 <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
 <Text style={styles.imageButtonText}>Take Photo</Text>
 </TouchableOpacity>
 
 <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
 <Text style={styles.imageButtonText}>Choose from Gallery</Text>
 </TouchableOpacity>
 </View>
 )}

 {renderImageValidationStatus()}
 </View>

 <TouchableOpacity
 style={[
 styles.submitButton, 
 (loading || validatingImage || autoCapturingLocation || !formData.category || !locationData) && styles.submitButtonDisabled
 ]}
 onPress={submitComplaint}
 disabled={loading || validatingImage || autoCapturingLocation || !formData.category || !locationData}
 >
 {loading ? (
 <ActivityIndicator color="#fff" />
 ) : (
 <>
 <Text style={styles.submitButtonText}>
 {autoCapturingLocation ? 'Capturing Location...' : 'Submit Complaint'}
 </Text>
 </>
 )}
 </TouchableOpacity>
 </View>
 </KeyboardAwareScrollView>
 );
};

const styles = StyleSheet.create({
 container: {
 flex: 1,
 backgroundColor: '#FAFAFA',
 },
 header: {
 backgroundColor: '#FFFFFF',
 paddingHorizontal: 20,
 paddingTop: 60,
 paddingBottom: 20,
 borderBottomWidth: 1,
 borderBottomColor: '#F3F4F6',
 },
 title: {
 fontSize: 24,
 fontWeight: '700',
 color: '#111827',
 marginBottom: 5,
 letterSpacing: -0.5,
 },
 subtitle: {
 fontSize: 14,
 color: '#6B7280',
 },
 form: {
 padding: 20,
 },
 label: {
 fontSize: 14,
 fontWeight: '600',
 color: '#374151',
 marginBottom: 8,
 marginTop: 15,
 },
 input: {
 backgroundColor: '#fff',
 borderWidth: 1,
 borderColor: '#ddd',
 borderRadius: 8,
 padding: 15,
 fontSize: 16,
 },
 textArea: {
 height: 100,
 textAlignVertical: 'top',
 },
 photoHint: {
 fontSize: 14,
 color: '#666',
 marginBottom: 15,
 fontStyle: 'italic',
 },
 imageSection: {
 marginBottom: 20,
 },
 imagePickerContainer: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 marginBottom: 15,
 },
 imageButton: {
 backgroundColor: '#1A1A1A',
 padding: 15,
 borderRadius: 8,
 flex: 0.48,
 alignItems: 'center',
 },
 imageButtonText: {
 color: '#fff',
 fontSize: 16,
 fontWeight: '600',
 },
 selectedImageContainer: {
 alignItems: 'center',
 },
 selectedImage: {
 width: '100%',
 height: 200,
 borderRadius: 8,
 marginBottom: 10,
 },
 changeImageButton: {
 backgroundColor: '#666',
 paddingHorizontal: 20,
 paddingVertical: 10,
 borderRadius: 5,
 },
 changeImageText: {
 color: '#fff',
 fontSize: 14,
 },
 validationStatus: {
 backgroundColor: '#f0f0f0',
 padding: 15,
 borderRadius: 8,
 flexDirection: 'row',
 alignItems: 'center',
 marginTop: 10,
 },
 validationSuccess: {
 backgroundColor: '#F3F4F6',
 borderColor: '#1A1A1A',
 borderWidth: 1,
 },
 validationError: {
 backgroundColor: '#F3F4F6',
 borderColor: '#1A1A1A',
 borderWidth: 1,
 },
 validationText: {
 fontSize: 14,
 marginLeft: 10,
 flex: 1,
 },
 submitButton: {
 backgroundColor: '#1A1A1A',
 padding: 18,
 borderRadius: 8,
 alignItems: 'center',
 marginTop: 20,
 },
 submitButtonDisabled: {
 backgroundColor: '#ccc',
 },
 submitButtonText: {
 color: '#fff',
 fontSize: 18,
 fontWeight: 'bold',
 },
 submitButtonSubtext: {
 color: '#9CA3AF',
 fontSize: 12,
 marginTop: 2,
 },
 categoryContainer: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 marginBottom: 15,
 },
 categoryButton: {
 backgroundColor: '#f0f0f0',
 paddingHorizontal: 12,
 paddingVertical: 8,
 borderRadius: 20,
 margin: 4,
 flexDirection: 'row',
 alignItems: 'center',
 borderWidth: 1,
 borderColor: '#ddd',
 },
 selectedCategory: {
 backgroundColor: '#1A1A1A',
 borderColor: '#1A1A1A',
 },
 categoryText: {
 fontSize: 12,
 color: '#333',
 marginRight: 4,
 },
 selectedCategoryText: {
 color: '#fff',
 },
 urgencyBadge: {
 fontSize: 12,
 },
 locationScoreContainer: {
 backgroundColor: '#F3F4F6',
 padding: 12,
 borderRadius: 8,
 marginTop: 10,
 borderWidth: 1,
 borderColor: '#E5E7EB',
 },
 locationScoreTitle: {
 fontSize: 14,
 fontWeight: 'bold',
 color: '#111827',
 marginBottom: 4,
 },
 locationScoreText: {
 fontSize: 12,
 color: '#374151',
 marginBottom: 4,
 },
 locationScoreReason: {
 fontSize: 11,
 color: '#6B7280',
 fontStyle: 'italic',
 },
 locationStatusContainer: {
 backgroundColor: '#F3F4F6',
 padding: 12,
 borderRadius: 8,
 flexDirection: 'row',
 alignItems: 'center',
 marginVertical: 10,
 borderWidth: 1,
 borderColor: '#F3F4F6',
 },
 locationStatusText: {
 fontSize: 14,
 color: '#92400E',
 marginLeft: 10,
 },
 locationCapturedContainer: {
 backgroundColor: '#F3F4F6',
 padding: 12,
 borderRadius: 8,
 marginVertical: 10,
 borderWidth: 1,
 borderColor: '#E5E7EB',
 },
 locationCapturedTitle: {
 fontSize: 14,
 fontWeight: 'bold',
 color: '#1F2937',
 marginBottom: 4,
 },
 locationDetailText: {
 fontSize: 12,
 color: '#4B5563',
 marginBottom: 2,
 },
 recaptureButton: {
 backgroundColor: '#374151',
 paddingHorizontal: 12,
 paddingVertical: 6,
 borderRadius: 15,
 marginTop: 8,
 alignSelf: 'flex-start',
 },
 recaptureButtonText: {
 color: '#fff',
 fontSize: 12,
 fontWeight: '500',
 },
 manualLocationButton: {
 backgroundColor: '#1A1A1A',
 padding: 12,
 borderRadius: 8,
 alignItems: 'center',
 marginVertical: 10,
 },
 manualLocationButtonText: {
 color: '#fff',
 fontSize: 14,
 fontWeight: '600',
 },
 errorText: {
 color: '#1A1A1A',
 fontSize: 14,
 marginTop: 5,
 },
});

export default SubmitComplaintScreen;
