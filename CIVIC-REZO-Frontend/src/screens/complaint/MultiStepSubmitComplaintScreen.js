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
  Modal,
  ScrollView,
  Linking,

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
import CustomTextInput from '../../components/CustomTextInput';
import InfrastructureService from '../../services/InfrastructureService';
import { useTranslation } from '../../i18n/useTranslation';
import { useAppLanguage } from '../../i18n/AppLanguageContext';
import { getSpeechLocaleForAppLanguage } from '../../i18n/languageConfig';

const MultiStepSubmitComplaintScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { language, speechLocale } = useAppLanguage();

  // Overall flow state
  const [currentStep, setCurrentStep] = useState(1);
  const [complaintData, setComplaintData] = useState({
    // Step 1: Issue type and location
    category: '',
    locationData: null,
    locationPriorityScore: null,

    // Step 2: Title and description
    title: '',
    description: '',
    selectedLang: getSpeechLocaleForAppLanguage(language),
    emotionScore: null,

    // Step 3: Image and validation
    selectedImage: null,
    imageValidation: null,
  });

  // Loading states
  const [loading, setLoading] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [autoCapturingLocation, setAutoCapturingLocation] = useState(false);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [runSocialScraping, setRunSocialScraping] = useState(false);

  // Voice input states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [speechService] = useState(new SarvamSpeechService());
  const lastTranslationRef = useRef(null);

  // Language picker modal state
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // Infrastructure modal state
  const [showInfrastructureModal, setShowInfrastructureModal] = useState(false);

  // Submission result
  const [submissionResult, setSubmissionResult] = useState(null);
  const [nearbyInfrastructure, setNearbyInfrastructure] = useState(null);
  const [isLoadingInfrastructure, setIsLoadingInfrastructure] = useState(false);

  useEffect(() => {
    setComplaintData((prev) => ({
      ...prev,
      selectedLang: speechLocale || getSpeechLocaleForAppLanguage(language)
    }));
  }, [language, speechLocale]);

  // Refs for speech service
  // const descriptionInputRef = useRef(null); // Not needed with custom component

  // Language options for voice input
  const languageOptions = [
    { value: 'hi-IN', label: 'Hindi (हिंदी)', nativeName: 'हिंदी' },
    { value: 'en-US', label: 'English', nativeName: 'English' },
    { value: 'te-IN', label: 'Telugu (తెలుగు)', nativeName: 'తెలుగు' },
    { value: 'ta-IN', label: 'Tamil (தமிழ்)', nativeName: 'தமிழ்' },
    { value: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)', nativeName: 'ಕನ್ನಡ' },
    { value: 'mr-IN', label: 'Marathi (मराठी)', nativeName: 'मराठी' },
    { value: 'bn-IN', label: 'Bengali (বাংলা)', nativeName: 'বাংলা' },
    { value: 'gu-IN', label: 'Gujarati (ગુજરાતી)', nativeName: 'ગુજરાતી' },
    { value: 'ml-IN', label: 'Malayalam (മലയാളം)', nativeName: 'മലയാളം' },
    { value: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)', nativeName: 'ਪੰਜਾਬੀ' },
  ];

  // Complaint categories
  const complaintCategories = [
    // Urgent Issues
    { value: 'fire_hazard', label: 'Fire Hazard', urgency: 'urgent', icon: '🚨' },
    { value: 'electrical_danger', label: 'Electrical Danger', urgency: 'urgent', icon: '⚡' },
    { value: 'sewage_overflow', label: 'Sewage Overflow', urgency: 'urgent', icon: '🚰' },

    // Safety Issues
    { value: 'broken_streetlight', label: 'Broken Streetlight', urgency: 'safety', icon: '💡' },
    { value: 'traffic_signal', label: 'Traffic Signal Issue', urgency: 'safety', icon: '🚦' },

    // General Infrastructure
    { value: 'pothole', label: 'Pothole', urgency: 'general', icon: '🕳️' },
    { value: 'road_damage', label: 'Road Damage', urgency: 'general', icon: '�️' },
    { value: 'water_leakage', label: 'Water Leakage', urgency: 'general', icon: '💧' },
    { value: 'garbage_collection', label: 'Garbage Collection', urgency: 'general', icon: '🗑️' },

    // Other Issues
    { value: 'others', label: 'Others', urgency: 'general', icon: '�' },
  ];

  // Memoized category lookup to prevent re-renders
  const selectedCategory = useMemo(() => {
    return complaintCategories.find(cat => cat.value === complaintData.category);
  }, [complaintData.category]);

  // Simple text change handlers - completely fresh approach
  const handleTitleChange = useCallback((text) => {
    setComplaintData(prev => ({ ...prev, title: text }));
  }, []);

  const handleDescriptionChange = useCallback((text) => {
    setComplaintData(prev => ({ ...prev, description: text }));

    // Debounced emotion analysis
    if (text.trim().length > 10) {
      setTimeout(() => {
        analyzeEmotion(text);
      }, 1000); // 1 second delay to avoid too many API calls
    } else {
      // Clear emotion score for short text
      setComplaintData(prev => ({ ...prev, emotionScore: null }));
    }
  }, [analyzeEmotion]);

  // Emotion analysis function
  const analyzeEmotion = useCallback(async (text) => {
    if (!text || text.trim().length < 10) return;

    console.log('🧠 Starting emotion analysis for text:', text.substring(0, 50) + '...');
    console.log('🌐 API_BASE_URL:', API_BASE_URL);

    try {
      const apiUrl = `${API_BASE_URL}/api/emotion/analyze`;
      console.log('📡 Calling emotion API:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          translation: lastTranslationRef.current || null,
          category: complaintData.category || 'general'
        }),
      });

      console.log('📊 Emotion API response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Emotion analysis result:', result);

        if (result.success && result.data) {
          const emotionData = {
            score: (result.data.emotionScore * 100).toFixed(1),
            emotions: result.data.emotions,
            analysisMethod: result.data.analysisMethod,
            language: result.data.language
          };

          console.log('💡 Setting emotion data:', emotionData);

          setComplaintData(prev => ({
            ...prev,
            emotionScore: emotionData
          }));
        } else {
          console.log('❌ Emotion analysis failed: Invalid response structure');
        }
      } else {
        console.log('❌ Emotion API failed with status:', response.status);
        const errorText = await response.text();
        console.log('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Emotion analysis failed:', error);
      console.error('❌ Error details:', error.message);
    }
  }, [complaintData.category]);

  const handleLanguageChange = useCallback((itemValue) => {
    setComplaintData(prev => ({ ...prev, selectedLang: itemValue }));
  }, []);

  const handleOpenPostLink = useCallback(async (postUrl) => {
    try {
      const postIdMatch = String(postUrl || '').match(/status\/(\d+)/i);
      const postId = postIdMatch?.[1];
      const appDeepLink = postId ? `twitter://status?id=${postId}` : null;

      if (appDeepLink) {
        const canOpenApp = await Linking.canOpenURL(appDeepLink);
        if (canOpenApp) {
          await Linking.openURL(appDeepLink);
          return;
        }
      }

      if (postUrl) {
        await Linking.openURL(postUrl);
      }
    } catch (error) {
      console.error('Failed to open post URL:', error);
    }
  }, []);

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
          const voiceText = result.value[0];
          console.log('🎤 Voice input result:', voiceText);

          // Use handleDescriptionChange to ensure emotion analysis is triggered
          handleDescriptionChange(voiceText);
        }
      },
      onTranslation: (translation) => {
        console.log('Translation received:', translation);
        if (translation && translation.trim().length > 0) {
          lastTranslationRef.current = translation;
          console.log('🌐 Stored English translation for emotion analysis:', translation);
        }
      },
      onError: (error) => {
        console.error('Speech recognition error:', error);
        setVoiceError(error.error?.message || 'Error in speech recognition');
        setIsRecording(false);

        Alert.alert(
          t('voice.speechRecognitionError'),
          t('voice.speechRecognitionErrorBody'),
          [{ text: t('common.ok') }]
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

  // Progress indicator
  const renderProgressIndicator = () => {
    const steps = [
      { number: 1, title: 'Issue Type', icon: 'list-outline' },
      { number: 2, title: 'Details', icon: 'create-outline' },
      { number: 3, title: 'Photo', icon: 'camera-outline' },
      { number: 4, title: 'Success', icon: 'checkmark-circle-outline' }
    ];

    return (
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <View style={[
              styles.progressStep,
              currentStep >= step.number && styles.progressStepActive,
              currentStep === step.number && styles.progressStepCurrent
            ]}>
              <Ionicons
                name={step.icon}
                size={20}
                color={currentStep >= step.number ? '#fff' : '#666'}
              />
              <Text style={[
                styles.progressStepText,
                currentStep >= step.number && styles.progressStepTextActive
              ]}>
                {step.title}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View style={[
                styles.progressLine,
                currentStep > step.number && styles.progressLineActive
              ]} />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  // Navigate between steps
  const goToNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(current => current - 1);
    }
  };

  const renderContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1IssueTypeSelection />;
      case 2:
        return <Step2TitleAndDescription />;
      case 3:
        return <Step3ImageUpload />;
      case 4:
        return <Step4Success />;
      default:
        return <Step1IssueTypeSelection />;
    }
  };

  // Step 1: Issue Type Selection and Location Capture
  const Step1IssueTypeSelection = () => {
    const handleCategorySelect = async (category) => {
      setComplaintData(prev => ({ ...prev, category }));

      // Auto-capture location after category selection
      if (!locationCaptured) {
        await autoCaptureLo‌‌cation(category);
      }
    };

    const autoCaptureLo‌‌cation = async (category) => {
      if (autoCapturingLocation || locationCaptured) return;

      setAutoCapturingLocation(true);

      try {
        // Get recommended privacy level for the complaint type
        const recommendedPrivacy = LocationService.getRecommendedPrivacyLevel(category);

        // Show user-friendly message about location capture
        const urgencyLevel = LocationService.determineUrgencyLevel(category);
        const isUrgent = urgencyLevel === 'urgent';

        Alert.alert(
          '📍 Location Required',
          isUrgent
            ? `For ${category} complaints, we need your exact location to prioritize emergency response. This helps us route your complaint to the nearest response team.`
            : `We'll capture your location to help prioritize your complaint and route it to the correct municipal office. Your privacy is protected with street-level accuracy.`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setAutoCapturingLocation(false)
            },
            {
              text: isUrgent ? 'Allow Exact Location' : 'Allow Location',
              onPress: () => proceedWithLocationCapture(recommendedPrivacy, category)
            }
          ]
        );

      } catch (error) {
        console.error('Auto location capture error:', error);
        setAutoCapturingLocation(false);
      }
    };

    const proceedWithLocationCapture = async (privacyLevel, category) => {
      try {
        // Capture location with recommended privacy level
        const location = await LocationService.getLocationWithPrivacy(privacyLevel, category);

        setComplaintData(prev => ({ ...prev, locationData: location }));
        setLocationCaptured(true);

        // Immediately calculate priority score
        await calculateLocationPriority(location, category);

        // Get nearby infrastructure after location capture
        await loadNearbyInfrastructure(location);

        // Show success message with location info
        Alert.alert(
          '✅ Location Captured Successfully!',
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
            { text: 'Retry', onPress: () => proceedWithLocationCapture(privacyLevel, category) },
            { text: 'Skip Location', style: 'destructive' }
          ]
        );
      } finally {
        setAutoCapturingLocation(false);
      }
    };

    const calculateLocationPriority = async (location, category) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/location-priority/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: location.latitude,
            longitude: location.longitude,
            complaintType: category,
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
          setComplaintData(prev => ({ ...prev, locationPriorityScore: priorityResult }));

          // Show priority notification for high-priority complaints
          if (priorityResult.priorityLevel === 'CRITICAL') {
            Alert.alert(
              '🚨 High Priority Complaint Detected',
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

    const loadNearbyInfrastructure = async (location) => {
      if (!location || !location.latitude || !location.longitude) {
        console.log('Invalid location for infrastructure search');
        return;
      }

      setIsLoadingInfrastructure(true);
      try {
        console.log('Loading nearby infrastructure for location:', location);

        const infrastructure = await InfrastructureService.getNearbyInfrastructure(
          location.latitude,
          location.longitude,
          2000 // 2km radius
        );

        console.log('Nearby infrastructure found:', infrastructure);
        setNearbyInfrastructure(infrastructure);

        // Show infrastructure report to user in a custom modal
        if (infrastructure && (infrastructure.infrastructure?.length > 0 || infrastructure.summary)) {
          setShowInfrastructureModal(true);
        }

      } catch (error) {
        console.error('Error loading nearby infrastructure:', error);
      } finally {
        setIsLoadingInfrastructure(false);
      }
    };

    const handleContinue = () => {
      if (!complaintData.category) {
        Alert.alert('Error', 'Please select a complaint category');
        return;
      }

      if (!complaintData.locationData) {
        Alert.alert(
          'Location Required',
          'Location is required for priority assessment. Would you like to capture your location now?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Location', onPress: () => autoCaptureLo‌‌cation(complaintData.category) }
          ]
        );
        return;
      }

      goToNextStep();
    };

    return (
      <KeyboardAwareScrollView
        style={styles.stepContainer}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{t('submitComplaint.step1Title')}</Text>
          <Text style={styles.stepSubtitle}>{t('submitComplaint.step1Subtitle')}</Text>
        </View>

        <View style={styles.categoriesGrid}>
          {/* Create rows with 2 categories each */}
          {Array.from({ length: Math.ceil(complaintCategories.length / 2) }, (_, rowIndex) => (
            <View key={rowIndex} style={styles.categoryRow}>
              {complaintCategories.slice(rowIndex * 2, rowIndex * 2 + 2).map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryCard,
                    complaintData.category === category.value && styles.categoryCardSelected
                  ]}
                  onPress={() => handleCategorySelect(category.value)}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={[
                    styles.categoryTitle,
                    complaintData.category === category.value && styles.selectedCategoryLabel
                  ]}>
                    {category.label}
                  </Text>
                  <Text style={[
                    styles.categoryUrgency,
                    category.urgency === 'urgent' && styles.categoryUrgencyHigh
                  ]}>
                    {category.urgency === 'urgent' ? `🚨 ${t('submitComplaint.urgent')}` :
                      category.urgency === 'safety' ? `⚠️ ${t('submitComplaint.safety')}` : `📋 ${t('submitComplaint.general')}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* Location Status */}
        {autoCapturingLocation && (
          <View style={styles.locationStatusContainer}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.locationStatusText}>🔍 {t('submitComplaint.capturingLocation')}</Text>
          </View>
        )}

        {locationCaptured && complaintData.locationData && (
          <View style={styles.locationCapturedContainer}>
            <Text style={styles.locationCapturedTitle}>✅ {t('submitComplaint.locationCaptured')}</Text>
            <Text style={styles.locationDetailText}>
              📍 Accuracy: ±{complaintData.locationData.radiusM}m ({complaintData.locationData.precision})
            </Text>
            <Text style={styles.locationDetailText}>
              🔒 Privacy: {complaintData.locationData.description}
            </Text>
            {complaintData.locationPriorityScore && (
              <View style={styles.priorityScoreContainer}>
                <Text style={styles.priorityScoreText}>
                  📊 Priority: {complaintData.locationPriorityScore.priorityLevel} ({Math.round((complaintData.locationPriorityScore.priorityScore || 0) * 100)}%)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Infrastructure Loading */}
        {isLoadingInfrastructure && (
          <View style={styles.infrastructureLoadingContainer}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.infrastructureLoadingText}>🏢 {t('submitComplaint.analyzingInfrastructure')}</Text>
          </View>
        )}

        {/* Nearby Infrastructure Display */}
        {nearbyInfrastructure && nearbyInfrastructure.places && nearbyInfrastructure.places.length > 0 && (
          <View style={styles.infrastructureContainer}>
            <Text style={styles.infrastructureTitle}>🏢 {t('submitComplaint.nearbyInfrastructure')}</Text>
            <Text style={styles.infrastructureSummary}>{nearbyInfrastructure.summary}</Text>

            <View style={styles.infrastructureList}>
              {nearbyInfrastructure.places.slice(0, 3).map((place, index) => (
                <View key={index} style={styles.infrastructureItem}>
                  <Text style={styles.infrastructureName}>
                    {place.name} ({place.types[0].replace('_', ' ')})
                  </Text>
                  <Text style={styles.infrastructureDistance}>
                    📍 {place.distance}m away
                  </Text>
                </View>
              ))}
              {nearbyInfrastructure.places.length > 3 && (
                <Text style={styles.infrastructureMore}>
                  {t('submitComplaint.moreNearby', { count: nearbyInfrastructure.places.length - 3 })}
                </Text>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!complaintData.category || !complaintData.locationData || autoCapturingLocation) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!complaintData.category || !complaintData.locationData || autoCapturingLocation}
        >
          {autoCapturingLocation ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>{t('submitComplaint.continueToDetails')}</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    );
  };

  // Step 2: Title and Description with Speech-to-Text
  const Step2TitleAndDescription = () => {
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
        console.log(`Starting speech recognition with language: ${complaintData.selectedLang}`);
        await speechService.startSpeech(complaintData.selectedLang);

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
        await speechService.processAndStopSpeech(complaintData.selectedLang);
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping speech:', error);
        setIsRecording(false);
      }
    };

    const handleContinue = () => {
      if (!complaintData.title.trim()) {
        Alert.alert('Error', 'Please enter a complaint title');
        return;
      }

      if (!complaintData.description.trim()) {
        Alert.alert('Error', 'Please enter a complaint description');
        return;
      }

      goToNextStep();
    };

    return (
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContentContainer}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        keyboardShouldPersistTaps="handled"
        extraHeight={120}
        extraScrollHeight={120}
        showsVerticalScrollIndicator={false}
        keyboardOpeningTime={0}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
      >
        <View style={styles.stepContainer}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>{t('submitComplaint.step2Title')}</Text>
            <Text style={styles.stepSubtitle}>{t('submitComplaint.step2Subtitle')}</Text>
          </View>

          {/* Selected Category Display */}
          <View style={styles.selectedCategoryDisplay}>
            <Text style={styles.selectedCategoryTitle}>{t('submitComplaint.selectedIssueType')}</Text>
            <View style={styles.selectedCategoryChip}>
              <Text style={styles.selectedCategoryChipText}>
                {selectedCategory?.icon} {' '}
                {selectedCategory?.label}
              </Text>
            </View>
          </View>

          {/* Title Input - Custom Component */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{t('submitComplaint.complaintTitle')}</Text>
            <CustomTextInput
              value={complaintData.title}
              onChangeText={handleTitleChange}
              placeholder={t('submitComplaint.titlePlaceholder')}
              maxLength={100}
              multiline={false}
              style={styles.customInputContainer}
            />
            <Text style={styles.characterCount}>{complaintData.title.length}/100</Text>
          </View>

          {/* Language Picker - Enhanced */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{t('submitComplaint.voiceLanguage')}</Text>
            <TouchableOpacity
              style={styles.customLanguageSelector}
              onPress={() => setShowLanguagePicker(true)}
            >
              <View style={styles.languageSelectorContent}>
                <View style={styles.selectedLanguageDisplay}>
                  <Ionicons name="language" size={24} color="#2E7D32" />
                  <View style={styles.languageTextContainer}>
                    <Text style={styles.selectedLanguageText}>
                      {languageOptions.find(lang => lang.value === complaintData.selectedLang)?.label || 'Hindi (हिंदी)'}
                    </Text>
                    <Text style={styles.selectedLanguageSubtext}>
                      {languageOptions.find(lang => lang.value === complaintData.selectedLang)?.nativeName || 'हिंदी'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </View>
            </TouchableOpacity>
            <Text style={styles.languageHelper}>
              🎙️ Voice input will be processed in the selected language




            </Text>
          </View>

          {/* Description Input - Custom Component */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{t('submitComplaint.descriptionLabel')}</Text>
            <View style={styles.descriptionWrapper}>
              <CustomTextInput
                value={complaintData.description}
                onChangeText={handleDescriptionChange}
                placeholder={t('submitComplaint.descriptionPlaceholder')}
                maxLength={500}
                multiline={true}
                style={styles.customInputContainer}
              />
            </View>

            {/* Voice Button - Separate from input */}
            <View style={styles.voiceButtonContainer}>
              <TouchableOpacity
                style={styles.voiceButtonEnhanced}
                onPress={isRecording ? stopVoiceInput : startVoiceInput}
                disabled={loading}
              >
                <Ionicons
                  name={isRecording ? 'mic' : 'mic-outline'}
                  size={24}
                  color={isRecording ? '#2E7D32' : loading ? '#ccc' : '#666'}
                />
                <Text style={[
                  styles.voiceButtonText,
                  isRecording && styles.voiceButtonTextActive
                ]}>
                  {isRecording ? t('voice.stopRecording') : t('voice.voiceInput')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.characterCount}>{complaintData.description.length}/500</Text>

            {/* Emotion Analysis Score */}
            {complaintData.emotionScore ? (
              <View style={styles.emotionScoreContainer}>
                <Text style={styles.emotionScoreLabel}>🧠 {t('complaintDetail.emotionAnalysisResults')}</Text>
                <Text style={styles.emotionScoreValue}>
                  {t('complaintDetail.priorityImpact')}: {complaintData.emotionScore.score}%
                </Text>
                <Text style={styles.emotionScoreMethod}>
                  {t('complaintDetail.method')}: {complaintData.emotionScore.analysisMethod || 'ai-powered'} ({complaintData.emotionScore.language || 'en'})
                </Text>
                {complaintData.emotionScore.emotions && (
                  <View style={styles.emotionDetails}>
                    <Text style={styles.emotionDetailText}>
                      {t('complaintDetail.urgency')}: {(complaintData.emotionScore.emotions.urgency * 100).toFixed(0)}% |
                      {t('complaintDetail.concern')}: {(complaintData.emotionScore.emotions.concern * 100).toFixed(0)}% |
                      {t('complaintDetail.frustration')}: {(complaintData.emotionScore.emotions.frustration * 100).toFixed(0)}%
                    </Text>
                    {complaintData.emotionScore.emotions.anger && (
                      <Text style={styles.emotionDetailText}>
                        {t('complaintDetail.anger')}: {(complaintData.emotionScore.emotions.anger * 100).toFixed(0)}%
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emotionScoreContainer}>
                <Text style={styles.emotionScoreLabel}>🧠 {t('complaintDetail.emotionAnalysisTitle')}</Text>
                <Text style={styles.emotionScoreMethod}>
                  {complaintData.description.length < 10
                    ? t('complaintDetail.writeMore')
                    : t('complaintDetail.analyzingAuto')}
                </Text>
              </View>
            )}

            {complaintData.description.length > 10 && !complaintData.emotionScore && (
              <View style={styles.emotionAnalyzingContainer}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={styles.emotionAnalyzingText}>{t('complaintDetail.analyzing')}</Text>
              </View>
            )}
          </View>

          {voiceError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {voiceError}</Text>
            </View>
          )}

          {/* Voice Recording Status */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.recordingText}>🎤 Recording... Speak clearly</Text>
            </View>
          )}

          {/* Navigation Buttons */}
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              style={styles.backNavigationButton}
              onPress={goToPreviousStep}
            >
              <Ionicons name="chevron-back" size={20} color="#666" />
              <Text style={styles.backNavigationText}>{t('common.back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.continueButton,
                (!complaintData.title.trim() || !complaintData.description.trim()) && styles.continueButtonDisabled
              ]}
              onPress={handleContinue}
              disabled={!complaintData.title.trim() || !complaintData.description.trim()}
            >
              <Text style={styles.continueButtonText}>{t('submitComplaint.continueToPhoto')}</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Language Picker Modal */}
          <Modal
            visible={showLanguagePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowLanguagePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.languagePickerModal}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('language.switcherTitle')}</Text>
                  <TouchableOpacity
                    onPress={() => setShowLanguagePicker(false)}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
                  {languageOptions.map((language) => (
                    <TouchableOpacity
                      key={language.value}
                      style={[
                        styles.languageOption,
                        complaintData.selectedLang === language.value && styles.selectedLanguageOption
                      ]}
                      onPress={() => {
                        handleLanguageChange(language.value);
                        setShowLanguagePicker(false);
                      }}
                    >
                      <View style={styles.languageOptionContent}>
                        <View style={styles.languageInfo}>
                          <Text style={[
                            styles.languageOptionLabel,
                            complaintData.selectedLang === language.value && styles.selectedLanguageOptionText
                          ]}>
                            {language.label}
                          </Text>
                          <Text style={[
                            styles.languageNativeName,
                            complaintData.selectedLang === language.value && styles.selectedLanguageNativeText
                          ]}>
                            {language.nativeName}
                          </Text>
                        </View>
                        {complaintData.selectedLang === language.value && (
                          <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  // Step 3: Image Upload and Validation
  const Step3ImageUpload = () => {
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
          setComplaintData(prev => ({ ...prev, selectedImage: result.assets[0], imageValidation: null }));
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
          setComplaintData(prev => ({ ...prev, selectedImage: result.assets[0], imageValidation: null }));
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
        console.log('🔍 Starting image validation...');

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

        console.log('✅ Image uploaded to Cloudinary:', cloudResult.secure_url);

        // Update selectedImage to use Cloudinary URL
        setComplaintData(prev => ({
          ...prev,
          selectedImage: {
            ...imageAsset,
            uri: cloudResult.secure_url,
            cloudinaryUrl: cloudResult.secure_url,
            publicId: cloudResult.public_id
          }
        }));

        // 2. Send imageUrl to backend for validation
        const validateRes = await fetch(`${API_BASE_URL}/api/image-analysis/validate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: cloudResult.secure_url }),
        });
        const result = await validateRes.json();

        console.log('📋 Validation result:', result);

        // Process validation result
        const validationData = {
          confidence: result.confidence || 0,
          modelConfidence: result.modelConfidence || 0,
          openaiConfidence: result.openaiConfidence || 0,
          allowUpload: result.confidence !== undefined && result.confidence >= 0.7,
          message: result.message || 'No validation message provided',
          data: result.data || {},
          raw: result.raw || null,
        };

        setComplaintData(prev => ({ ...prev, imageValidation: validationData }));

        // Show validation result
        const displayConfidence = validationData.modelConfidence >= 0.7 ? validationData.modelConfidence : validationData.confidence;

        if (validationData.allowUpload) {
          Alert.alert(
            '✅ Valid Civic Issue Detected!',
            `Confidence Score: ${(displayConfidence * 100).toFixed(1)}%\n\nYour image has been validated and is ready for submission.`,
            [{ text: 'Continue', style: 'default' }]
          );
        } else {
          Alert.alert(
            '❌ Image Validation Failed',
            `Confidence Score: ${(displayConfidence * 100).toFixed(1)}%\n\nThe selected image does not appear to show a valid civic issue. Please select a different image showing the actual problem.`,
            [
              { text: 'Change Image', onPress: () => setComplaintData(prev => ({ ...prev, selectedImage: null, imageValidation: null })) },
              { text: 'Submit Anyway', style: 'destructive' }
            ]
          );
        }

      } catch (error) {
        console.error('❌ Image validation error:', error);
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

    const handleSubmit = async () => {
      if (!complaintData.selectedImage) {
        Alert.alert('Error', 'Please select an image of the civic issue');
        return;
      }

      if (complaintData.imageValidation && !complaintData.imageValidation.allowUpload) {
        Alert.alert(
          'Image Validation Failed',
          `The selected image does not appear to show a valid civic issue. You can still submit anyway for urgent issues.`,
          [
            { text: 'Change Image', onPress: () => setComplaintData(prev => ({ ...prev, selectedImage: null, imageValidation: null })) },
            { text: 'Submit Anyway', style: 'destructive', onPress: () => submitComplaint() }
          ]
        );
        return;
      }

      await submitComplaint();
    };

    const submitComplaint = async () => {
      setLoading(true);

      try {
        // Prepare submission data
        const submissionData = {
          title: complaintData.title.trim(),
          description: complaintData.description.trim(),
          category: complaintData.category,
          locationData: {
            latitude: complaintData.locationData.latitude,
            longitude: complaintData.locationData.longitude,
            privacyLevel: complaintData.locationData.privacyLevel || 'street',
            accuracy: complaintData.locationData.accuracy || complaintData.locationData.radiusM || 25,
            precision: complaintData.locationData.precision || 'street',
            description: complaintData.locationData.description || 'User location',
            address: complaintData.locationData.address || `${complaintData.locationData.latitude.toFixed(4)}, ${complaintData.locationData.longitude.toFixed(4)}`
          },
          imageValidation: complaintData.imageValidation || {
            allowUpload: true,
            confidence: 0.5,
            success: true
          },
          imageUrl: complaintData.selectedImage?.uri || null,
          emotionAnalysis: complaintData.emotionScore ? {
            score: parseFloat(complaintData.emotionScore.score) / 100, // Convert back to 0-1 range
            emotions: complaintData.emotionScore.emotions,
            analysisMethod: complaintData.emotionScore.analysisMethod,
            language: complaintData.emotionScore.language
          } : null,
          runSocialScraping,
          includeSocialDebug: true
        };

        console.log('📤 Submitting complaint with comprehensive data:', submissionData);

        // Submit to comprehensive endpoint using makeApiCall
        const result = await makeApiCall(apiClient.complaints.submit, {
          method: 'POST',
          body: JSON.stringify(submissionData),
        });

        console.log('📋 Response data:', result);

        if (result.success) {
          setSubmissionResult(result);
          goToNextStep(); // Go to success page
        } else {
          console.error('❌ Backend returned error:', result);
          throw new Error(result.error || result.message || 'Submission failed');
        }

      } catch (error) {
        console.error('❌ Submission error:', error);

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
            { text: 'Retry', onPress: () => submitComplaint() },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } finally {
        setLoading(false);
      }
    };

    const renderImageValidationStatus = () => {
      if (validatingImage) {
        return (
          <View style={styles.validationStatus}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.validationText}>🔍 Validating civic issue...</Text>
          </View>
        );
      }

      if (complaintData.imageValidation) {
        if (complaintData.imageValidation.allowUpload) {
          return (
            <View style={[styles.validationStatus, styles.validationSuccess]}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.validationText}>✅ Valid civic issue detected!</Text>
            </View>
          );
        } else {
          return (
            <View style={[styles.validationStatus, styles.validationError]}>
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={styles.validationText}>❌ {complaintData.imageValidation.message}</Text>
            </View>
          );
        }
      }

      return null;
    };

    return (
      <KeyboardAwareScrollView
        style={styles.stepContainer}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{t('submitComplaint.step3Title')}</Text>
          <Text style={styles.stepSubtitle}>
            {t('submitComplaint.step3Subtitle')}
          </Text>
        </View>

        <View style={styles.imageSection}>
          {complaintData.selectedImage ? (
            <View style={styles.selectedImageContainer}>
              <Image source={{ uri: complaintData.selectedImage.uri }} style={styles.selectedImage} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={() => setComplaintData(prev => ({ ...prev, selectedImage: null, imageValidation: null }))}
              >
                <Text style={styles.changeImageText}>{t('submitComplaint.changeImage')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity style={styles.imagePickerButton} onPress={takePhoto}>
                <Ionicons name="camera" size={32} color="#2E7D32" />
                <Text style={styles.imagePickerText}>{t('submitComplaint.takePhoto')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                <Ionicons name="images" size={32} color="#2E7D32" />
                <Text style={styles.imagePickerText}>{t('submitComplaint.chooseFromGallery')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {renderImageValidationStatus()}

          <View style={styles.socialToggleCard}>
            <Text style={styles.socialToggleTitle}>X Scraping Verification</Text>
            <Text style={styles.socialToggleSubtitle}>
              Scraping now runs only if you enable it here before submission.
            </Text>
            <TouchableOpacity
              style={[styles.socialToggleButton, runSocialScraping && styles.socialToggleButtonActive]}
              onPress={() => setRunSocialScraping(prev => !prev)}
            >
              <Ionicons
                name={runSocialScraping ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={runSocialScraping ? '#fff' : '#2E7D32'}
              />
              <Text style={[styles.socialToggleButtonText, runSocialScraping && styles.socialToggleButtonTextActive]}>
                {runSocialScraping ? 'Enabled: Run X scraping on submit' : 'Disabled: Skip X scraping on submit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={styles.backNavigationButton}
            onPress={goToPreviousStep}
          >
            <Ionicons name="chevron-back" size={20} color="#666" />
            <Text style={styles.backNavigationText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (loading || validatingImage || !complaintData.selectedImage) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={loading || validatingImage || !complaintData.selectedImage}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>{t('submitComplaint.submit')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  // Step 4: Success Screen
  const Step4Success = () => {
    if (!submissionResult) {
      return (
        <View style={styles.stepContainer}>
          <Text>Error: No submission result available</Text>
        </View>
      );
    }

    const viewOnMap = () => {
      const newComplaint = {
        id: submissionResult.complaint.id,
        title: submissionResult.complaint.title,
        description: complaintData.description,
        category: complaintData.category,
        status: submissionResult.complaint.status || 'pending',
        latitude: complaintData.locationData.latitude,
        longitude: complaintData.locationData.longitude,
        location: complaintData.locationData.description || complaintData.locationData.address,
        created_at: new Date().toISOString()
      };

      navigation.navigate('ComplaintMap', { newComplaint });
    };

    return (
      <KeyboardAwareScrollView
        style={styles.stepContainer}
        contentContainerStyle={styles.successContainer}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successHeader}>
          <Ionicons name="checkmark-circle" size={80} color="#2E7D32" />
          <Text style={styles.successTitle}>{t('submitComplaint.step4Title')}</Text>
          <Text style={styles.successSubtitle}>
            {t('submitComplaint.successSubtitle')}
          </Text>
        </View>

        <View style={styles.complaintDetailsCard}>
          <Text style={styles.detailsCardTitle}>📋 {t('submitComplaint.complaintDetails')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('complaintDetail.complaintId')}:</Text>
            <Text style={styles.detailValue}>{submissionResult.complaint.id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitComplaint.titleLabel')}:</Text>
            <Text style={styles.detailValue}>{complaintData.title}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitComplaint.categoryLabel')}:</Text>
            <Text style={styles.detailValue}>
              {complaintCategories.find(cat => cat.value === complaintData.category)?.icon} {' '}
              {complaintCategories.find(cat => cat.value === complaintData.category)?.label}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitComplaint.statusLabel')}:</Text>
            <Text style={styles.detailValue}>{submissionResult.complaint.status || 'Pending'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitComplaint.priorityLevelLabel')}:</Text>
            <Text style={[styles.detailValue, styles.priorityText]}>
              {submissionResult.priorityAnalysis?.priorityLevel || 'MEDIUM'}
              ({Math.round((submissionResult.priorityAnalysis?.totalScore || 0) * 100)}%)
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitComplaint.locationAccuracyLabel')}:</Text>
            <Text style={styles.detailValue}>
              ±{complaintData.locationData.radiusM}m ({complaintData.locationData.precision})
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('submitComplaint.submittedLabel')}:</Text>
            <Text style={styles.detailValue}>{new Date().toLocaleString()}</Text>
          </View>
        </View>

        {submissionResult.priorityAnalysis && (
          <View style={styles.priorityAnalysisCard}>
            <Text style={styles.detailsCardTitle}>🎯 {t('submitComplaint.priorityAnalysis')}</Text>
            <Text style={styles.reasoningText}>
              {submissionResult.priorityAnalysis.reasoning}
            </Text>
          </View>
        )}

        {submissionResult.socialSignals && (
          <View style={styles.socialSignalsCard}>
            <Text style={styles.detailsCardTitle}>🐦 {t('social.relatedPublicPosts')}</Text>
            <Text style={styles.reasoningText}>
              {t('social.status')}: {submissionResult.socialSignals.status || 'pending'}
              {'\n'}{t('social.matchedPosts')}: {submissionResult.socialSignals.matchedCount || 0}
              {'\n'}{t('social.fetchedPosts')}: {submissionResult.socialSignals.fetchedCount || 0}
              {'\n'}{t('social.textMatches')}: {submissionResult.socialSignals.verifiedMatchCount || 0}
              {'\n'}{t('social.severityBoost')}: +{Math.round((submissionResult.priorityAnalysis?.socialBoost || 0) * 100)}%
            </Text>

            {(submissionResult.socialSignals.topPosts || []).map((post, index) => (
              <View key={`${post.postId || index}`} style={styles.socialPostCard}>
                <Text style={styles.socialPostMeta}>
                  {post.authorHandle || 'Unknown user'} • Score {(post.matchScore || 0).toFixed(2)}
                </Text>
                <Text style={styles.socialPostStatus}>
                  {post.classificationVerified
                    ? t('social.matchFound')
                    : `${t('social.matchStatus')}: ${post.correlationStatus || 'not_evaluated'}`}
                </Text>
                <Text style={styles.socialPostText} numberOfLines={4}>
                  {post.textExcerpt || 'No text available'}
                </Text>
                <TouchableOpacity onPress={() => handleOpenPostLink(post.postUrl)}>
                  <Text style={[styles.socialPostLink, { color: '#1DA1F2', textDecorationLine: 'underline' }]} numberOfLines={1}>
                    {post.postUrl}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {submissionResult.socialDebug && (
          <View style={styles.debugCard}>
            <Text style={styles.detailsCardTitle}>🛠️ Social Scraping Debug</Text>
            <Text style={styles.debugText}>
              Manual Trigger: {submissionResult.socialDebug.manualTriggerRequested ? 'YES' : 'NO'}
              {'\n'}X API Enabled: {submissionResult.socialDebug.xApiEnabled ? 'YES' : 'NO'}
              {'\n'}Location Text Used: {submissionResult.socialDebug.locationInput?.locationTextForSearch || 'N/A'}
              {'\n'}Search Query: {submissionResult.socialDebug.search?.query || 'N/A'}
              {'\n'}Keywords: {(submissionResult.socialDebug.search?.keywords || []).join(', ') || 'N/A'}
              {'\n'}Classification Terms: {(submissionResult.socialDebug.search?.classificationTerms || []).join(', ') || 'N/A'}
              {'\n'}Hashtags: {(submissionResult.socialDebug.search?.hashtags || []).join(', ') || 'N/A'}
              {'\n'}Location Terms: {(submissionResult.socialDebug.search?.locationTerms || []).join(', ') || 'N/A'}
              {'\n'}Execution Status: {submissionResult.socialDebug.execution?.status || 'N/A'}
              {'\n'}Fetched Count: {submissionResult.socialDebug.execution?.fetchedCount || 0}
              {'\n'}Matched Count: {submissionResult.socialDebug.execution?.matchedCount || 0}
              {'\n'}Verified Count: {submissionResult.socialDebug.execution?.verifiedCount || 0}
              {'\n'}Processing Time: {submissionResult.socialDebug.execution?.processingTimeMs || 0} ms
              {'\n'}Error: {submissionResult.socialDebug.execution?.error || 'None'}
            </Text>
          </View>
        )}

        <View style={styles.nextStepsCard}>
          <Text style={styles.detailsCardTitle}>📅 {t('submitComplaint.nextSteps')}</Text>
          {submissionResult.nextSteps?.map((step, index) => (
            <Text key={index} style={styles.nextStepText}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>

        <View style={styles.successActions}>
          <TouchableOpacity style={styles.mapButton} onPress={viewOnMap}>
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.mapButtonText}>{t('submitComplaint.viewOnMap')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('FeedbackScreen', {
              complaintId: submissionResult.complaint.id,
              complaintTitle: complaintData.title
            })}
          >
            <Text style={styles.doneButtonText}>{t('auth.common.continue')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={currentStep > 1 ? goToPreviousStep : () => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit Complaint</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderProgressIndicator()}

      {renderContent()}

      {/* Infrastructure Report Modal */}
      <Modal
        visible={showInfrastructureModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInfrastructureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infrastructureModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🏢 Nearby Infrastructure Report</Text>
              <TouchableOpacity
                onPress={() => setShowInfrastructureModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infrastructureModalContent} showsVerticalScrollIndicator={false}>
              {nearbyInfrastructure?.infrastructure?.length > 0 ? (
                <>
                  <Text style={styles.infrastructureModalSubtitle}>
                    📍 Location captured successfully! Here are the facilities near your location:
                  </Text>

                  {/* Essential Services */}
                  {nearbyInfrastructure.infrastructure
                    .filter(infra => infra.priority === 'high')
                    .reduce((unique, infra) => {
                      if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                        unique.push(infra);
                      }
                      return unique;
                    }, [])
                    .length > 0 && (
                      <>
                        <Text style={styles.infrastructureSectionTitle}>🚨 Essential Services</Text>
                        {nearbyInfrastructure.infrastructure
                          .filter(infra => infra.priority === 'high')
                          .reduce((unique, infra) => {
                            if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                              unique.push(infra);
                            }
                            return unique;
                          }, [])
                          .map((infra, index) => (
                            <View key={`high-${index}`} style={styles.infrastructureModalItem}>
                              <View style={styles.infrastructureItemHeader}>
                                <Text style={styles.infrastructureItemType}>
                                  {infra.infrastructureType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Text>
                                <Text style={styles.infrastructureItemDistance}>{infra.distance}m away</Text>
                              </View>
                              <Text style={styles.infrastructureItemName}>{infra.name}</Text>
                              {infra.vicinity && (
                                <Text style={styles.infrastructureItemVicinity}>{infra.vicinity}</Text>
                              )}
                            </View>
                          ))}
                      </>
                    )}

                  {/* Other Facilities */}
                  {nearbyInfrastructure.infrastructure
                    .filter(infra => infra.priority === 'medium')
                    .reduce((unique, infra) => {
                      if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                        unique.push(infra);
                      }
                      return unique;
                    }, [])
                    .length > 0 && (
                      <>
                        <Text style={styles.infrastructureSectionTitle}>🏢 Other Facilities</Text>
                        {nearbyInfrastructure.infrastructure
                          .filter(infra => infra.priority === 'medium')
                          .reduce((unique, infra) => {
                            if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                              unique.push(infra);
                            }
                            return unique;
                          }, [])
                          .slice(0, 4)
                          .map((infra, index) => (
                            <View key={`medium-${index}`} style={styles.infrastructureModalItem}>
                              <View style={styles.infrastructureItemHeader}>
                                <Text style={styles.infrastructureItemType}>
                                  {infra.infrastructureType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Text>
                                <Text style={styles.infrastructureItemDistance}>{infra.distance}m away</Text>
                              </View>
                              <Text style={styles.infrastructureItemName}>{infra.name}</Text>
                            </View>
                          ))}
                      </>
                    )}

                  <View style={styles.infrastructureModalFooter}>
                    <Text style={styles.infrastructureModalSummary}>
                      📊 Total facilities found: {nearbyInfrastructure.totalFound || nearbyInfrastructure.infrastructure.length}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.infrastructureModalSubtitle}>
                  📍 Location captured successfully. No nearby infrastructure detected in the immediate area.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.infrastructureModalButton}
              onPress={() => setShowInfrastructureModal(false)}
            >
              <Text style={styles.infrastructureModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

};

// Base styles for the multi-step flow
const styles = StyleSheet.create({
 container: {
 flex: 1,
 backgroundColor: '#f8f9fa',
 },
 scrollContentContainer: {
 flexGrow: 1,
 paddingBottom: 120,
 },
 header: {
 backgroundColor: '#1A1A1A',
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: 20,
 paddingVertical: 15,
 },
 backButton: {
 padding: 5,
 },
 headerTitle: {
 flex: 1,
 fontSize: 20,
 fontWeight: 'bold',
 color: '#fff',
 textAlign: 'center',
 },
 headerSpacer: {
 width: 34,
 },
 progressContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 paddingHorizontal: 20,
 paddingVertical: 20,
 backgroundColor: '#fff',
 marginBottom: 10,
 },
 progressStep: {
 alignItems: 'center',
 flex: 1,
 },
 progressStepActive: {
 opacity: 1,
 },
 progressStepCurrent: {
 backgroundColor: '#1A1A1A',
 borderRadius: 20,
 paddingVertical: 8,
 paddingHorizontal: 12,
 },
 progressStepText: {
 fontSize: 12,
 color: '#666',
 marginTop: 4,
 textAlign: 'center',
 },
 progressStepTextActive: {
 color: '#1A1A1A',
 fontWeight: 'bold',
 },
 progressLine: {
 height: 2,
 backgroundColor: '#ddd',
 flex: 0.3,
 marginHorizontal: 10,
 },
 progressLineActive: {
 backgroundColor: '#1A1A1A',
 },
 stepContainer: {
 flex: 1,
 backgroundColor: '#fff',
 margin: 10,
 borderRadius: 10,
 padding: 20,
 },
 stepHeader: {
 marginBottom: 30,
 },
 stepTitle: {
 fontSize: 24,
 fontWeight: 'bold',
 color: '#333',
 marginBottom: 8,
 },
 stepSubtitle: {
 fontSize: 16,
 color: '#666',
 lineHeight: 24,
 },
 // Step 1: Category Selection
 categoriesGrid: {
 marginBottom: 24,
 },
 categoryRow: {
 flexDirection: 'row',
 marginBottom: 12,
 },
 categoryGrid: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 justifyContent: 'space-between',
 marginBottom: 30,
 },
 categoryCard: {
 flex: 1,
 backgroundColor: '#fff',
 borderRadius: 12,
 padding: 16,
 marginHorizontal: 6,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 borderWidth: 2,
 borderColor: 'transparent',
 },
 categoryCardSelected: {
 borderColor: '#1A1A1A',
 backgroundColor: '#F3F4F6',
 },
 selectedCategoryCard: {
 backgroundColor: '#F3F4F6',
 borderColor: '#1A1A1A',
 },
 categoryIcon: {
 fontSize: 28,
 marginBottom: 8,
 },
 categoryTitle: {
 fontSize: 14,
 fontWeight: '600',
 color: '#333',
 textAlign: 'center',
 marginBottom: 4,
 },
 categoryLabel: {
 fontSize: 14,
 fontWeight: '600',
 color: '#333',
 textAlign: 'center',
 marginBottom: 5,
 },
 selectedCategoryLabel: {
 color: '#1A1A1A',
 },
 categoryUrgency: {
 fontSize: 11,
 color: '#666',
 textAlign: 'center',
 },
 categoryUrgencyHigh: {
 color: '#1A1A1A',
 fontWeight: '600',
 },
 urgencyIndicator: {
 fontSize: 11,
 color: '#666',
 textAlign: 'center',
 },
 locationStatusContainer: {
 backgroundColor: '#F3F4F6',
 padding: 15,
 borderRadius: 8,
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 20,
 borderWidth: 1,
 borderColor: '#1A1A1A',
 },
 locationStatusText: {
 fontSize: 14,
 color: '#856404',
 marginLeft: 10,
 },
 locationCapturedContainer: {
 backgroundColor: '#d4edda',
 padding: 15,
 borderRadius: 8,
 marginBottom: 20,
 borderWidth: 1,
 borderColor: '#28a745',
 },
 locationCapturedTitle: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#155724',
 marginBottom: 8,
 },
 locationDetailText: {
 fontSize: 14,
 color: '#155724',
 marginBottom: 4,
 },
 priorityScoreContainer: {
 marginTop: 8,
 padding: 8,
 backgroundColor: '#cce5ff',
 borderRadius: 6,
 },
 priorityScoreText: {
 fontSize: 13,
 color: '#0066cc',
 fontWeight: '600',
 },

 // Step 2: Title and Description
 selectedCategoryDisplay: {
 backgroundColor: '#fff',
 borderRadius: 12,
 padding: 16,
 marginBottom: 20,
 elevation: 1,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 },
 selectedCategoryTitle: {
 fontSize: 14,
 fontWeight: '600',
 color: '#666',
 marginBottom: 8,
 },
 selectedCategoryChip: {
 backgroundColor: '#F3F4F6',
 borderRadius: 20,
 paddingHorizontal: 12,
 paddingVertical: 6,
 alignSelf: 'flex-start',
 },
 selectedCategoryChipText: {
 fontSize: 14,
 color: '#1A1A1A',
 fontWeight: '600',
 },
 inputSection: {
 marginBottom: 20,
 },
 inputLabel: {
 fontSize: 16,
 fontWeight: '600',
 color: '#333',
 marginBottom: 8,
 },
 textInput: {
 backgroundColor: '#fff',
 borderRadius: 8,
 paddingHorizontal: 16,
 paddingVertical: 12,
 fontSize: 16,
 borderWidth: 1,
 borderColor: '#E0E0E0',
 minHeight: 48,
 },
 customInputContainer: {
 marginBottom: 0,
 },
 simpleTextInput: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 10,
 paddingHorizontal: 16,
 paddingVertical: 14,
 fontSize: 16,
 color: '#333333',
 fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
 minHeight: 50,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 elevation: 2,
 },
 simpleTextArea: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 10,
 paddingHorizontal: 16,
 paddingVertical: 14,
 fontSize: 15,
 color: '#333333',
 fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
 minHeight: 120,
 maxHeight: 200,
 textAlignVertical: 'top',
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 elevation: 2,
 },
 titleInput: {
 fontSize: 16,
 fontWeight: '500',
 },
 descriptionInput: {
 fontSize: 15,
 lineHeight: 20,
 },
 textArea: {
 minHeight: 120,
 textAlignVertical: 'top',
 },
 characterCount: {
 textAlign: 'right',
 fontSize: 12,
 color: '#666',
 marginTop: 4,
 },
 // Emotion Analysis Styles
 emotionScoreContainer: {
 backgroundColor: '#F8F9FA',
 borderRadius: 8,
 padding: 12,
 marginTop: 8,
 borderLeftWidth: 3,
 borderLeftColor: '#1A1A1A',
 },
 emotionScoreLabel: {
 fontSize: 14,
 fontWeight: '600',
 color: '#1A1A1A',
 marginBottom: 4,
 },
 emotionScoreValue: {
 fontSize: 16,
 fontWeight: '700',
 color: '#1B5E20',
 marginBottom: 2,
 },
 emotionScoreMethod: {
 fontSize: 12,
 color: '#666',
 fontStyle: 'italic',
 marginBottom: 4,
 },
 emotionDetails: {
 marginTop: 4,
 },
 emotionDetailText: {
 fontSize: 11,
 color: '#444',
 lineHeight: 16,
 },
 emotionAnalyzingContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: '#F5F5F5',
 borderRadius: 6,
 padding: 8,
 marginTop: 8,
 },
 emotionAnalyzingText: {
 fontSize: 12,
 color: '#666',
 marginLeft: 6,
 fontStyle: 'italic',
 },
 pickerContainer: {
 backgroundColor: '#fff',
 borderRadius: 8,
 borderWidth: 1,
 borderColor: '#E0E0E0',
 },
 // Custom Language Picker Styles
 customLanguageSelector: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 12,
 paddingHorizontal: 16,
 paddingVertical: 16,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 elevation: 3,
 },
 languageSelectorContent: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 },
 selectedLanguageDisplay: {
 flexDirection: 'row',
 alignItems: 'center',
 flex: 1,
 },
 languageTextContainer: {
 marginLeft: 12,
 flex: 1,
 },
 selectedLanguageText: {
 fontSize: 16,
 fontWeight: '600',
 color: '#333',
 },
 selectedLanguageSubtext: {
 fontSize: 14,
 color: '#1A1A1A',
 marginTop: 2,
 },

 // Modal Styles
 modalOverlay: {
 flex: 1,
 backgroundColor: 'rgba(0, 0, 0, 0.5)',
 justifyContent: 'flex-end',
 },
 languagePickerModal: {
 backgroundColor: '#fff',
 borderTopLeftRadius: 20,
 borderTopRightRadius: 20,
 maxHeight: '70%',
 paddingBottom: 20,
 },
 modalHeader: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 paddingHorizontal: 20,
 paddingVertical: 16,
 borderBottomWidth: 1,
 borderBottomColor: '#E0E0E0',
 },
 modalTitle: {
 fontSize: 18,
 fontWeight: '600',
 color: '#333',
 },
 modalCloseButton: {
 padding: 4,
 },
 languageList: {
 paddingHorizontal: 20,
 },
 languageOption: {
 paddingVertical: 16,
 borderBottomWidth: 1,
 borderBottomColor: '#F0F0F0',
 },
 selectedLanguageOption: {
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 borderBottomColor: 'transparent',
 marginVertical: 2,
 paddingHorizontal: 12,
 },
 languageOptionContent: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 },
 languageInfo: {
 flex: 1,
 },
 languageOptionLabel: {
 fontSize: 16,
 fontWeight: '500',
 color: '#333',
 },
 selectedLanguageOptionText: {
 color: '#1A1A1A',
 fontWeight: '600',
 },
 languageNativeName: {
 fontSize: 14,
 color: '#666',
 marginTop: 2,
 },
 selectedLanguageNativeText: {
 color: '#1A1A1A',
 },

 languagePickerContainer: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 10,
 position: 'relative',
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 elevation: 2,
 },
 languagePicker: {
 height: 50,
 color: '#333',
 },
 pickerItem: {
 fontSize: 16,
 color: '#333',
 },
 pickerIcon: {
 position: 'absolute',
 right: 15,
 top: 15,
 pointerEvents: 'none',
 },
 languageHelper: {
 fontSize: 13,
 color: '#1A1A1A',
 marginTop: 8,
 fontWeight: '500',
 backgroundColor: '#F3F4F6',
 padding: 10,
 borderRadius: 8,
 textAlign: 'center',
 borderLeftWidth: 3,
 borderLeftColor: '#1A1A1A',
 },
 picker: {
 height: 50,
 },
 descriptionContainer: {
 position: 'relative',
 },
 descriptionWrapper: {
 marginBottom: 12,
 },
 voiceButtonContainer: {
 alignItems: 'center',
 marginBottom: 8,
 },
 voiceButtonEnhanced: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F8F9FA',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 25,
 paddingHorizontal: 20,
 paddingVertical: 12,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 elevation: 3,
 },
 voiceButton: {
 position: 'absolute',
 bottom: 8,
 right: 8,
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F5F5F5',
 borderRadius: 20,
 paddingHorizontal: 12,
 paddingVertical: 6,
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 },
 voiceButtonText: {
 marginLeft: 4,
 fontSize: 12,
 color: '#666',
 fontWeight: '500',
 },
 voiceButtonTextActive: {
 color: '#1A1A1A',
 fontWeight: '600',
 },
 recordingIndicator: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 padding: 12,
 marginBottom: 16,
 },
 recordingText: {
 marginLeft: 8,
 fontSize: 14,
 color: '#1A1A1A',
 fontWeight: '600',
 },
 errorContainer: {
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 padding: 12,
 marginBottom: 16,
 },
 errorText: {
 color: '#1A1A1A',
 fontSize: 14,
 },

 // Step 3: Image Upload
 imageSection: {
 marginBottom: 24,
 },
 imagePickerContainer: {
 flexDirection: 'row',
 justifyContent: 'space-around',
 marginBottom: 20,
 },
 imagePickerButton: {
 backgroundColor: '#fff',
 borderRadius: 12,
 padding: 20,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 minWidth: 140,
 },
 imagePickerText: {
 marginTop: 8,
 fontSize: 14,
 fontWeight: '600',
 color: '#333',
 textAlign: 'center',
 },
 selectedImageContainer: {
 alignItems: 'center',
 marginBottom: 16,
 },
 selectedImage: {
 width: 200,
 height: 200,
 borderRadius: 12,
 marginBottom: 12,
 },
 changeImageButton: {
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 paddingHorizontal: 16,
 paddingVertical: 8,
 },
 changeImageText: {
 color: '#1A1A1A',
 fontSize: 14,
 fontWeight: '600',
 },
 validationStatus: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F5F5F5',
 borderRadius: 8,
 padding: 12,
 marginTop: 16,
 },
 validationSuccess: {
 backgroundColor: '#F3F4F6',
 },
 validationError: {
 backgroundColor: '#F3F4F6',
 },
 validationText: {
 marginLeft: 8,
 fontSize: 14,
 color: '#333',
 },


  // Step 4: Success Screen
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  complaintDetailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  detailsCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  priorityText: {
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  priorityAnalysisCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  reasoningText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  socialSignalsCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  socialPostCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    padding: 12,
    marginTop: 12,
  },
  socialPostMeta: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 6,
  },
  socialPostText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 6,
  },
  socialPostStatus: {
    fontSize: 12,
    color: '#1B5E20',
    marginBottom: 6,
  },
  socialPostLink: {
    fontSize: 12,
    color: '#1565C0',
  },
  socialToggleCard: {
    marginTop: 14,
    backgroundColor: '#F1F8E9',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C5E1A5',
  },
  socialToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#33691E',
  },
  socialToggleSubtitle: {
    fontSize: 12,
    color: '#546E7A',
    marginTop: 4,
    marginBottom: 8,
  },
  socialToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  socialToggleButtonActive: {
    backgroundColor: '#2E7D32',
  },
  socialToggleButtonText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  socialToggleButtonTextActive: {
    color: '#fff',
  },
  debugCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 20,
    marginBottom: 20,
    width: '100%',
  },
  debugText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#37474F',
  },
  nextStepsCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  nextStepText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  successActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  mapButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.48,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  doneButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flex: 0.48,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },


 // Navigation Buttons
 navigationButtons: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginTop: 32,
 },
 backNavigationButton: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingVertical: 12,
 paddingHorizontal: 16,
 borderRadius: 8,
 backgroundColor: '#F5F5F5',
 },
 backNavigationText: {
 marginLeft: 4,
 fontSize: 16,
 color: '#666',
 fontWeight: '600',
 },
 continueButton: {
 backgroundColor: '#1A1A1A',
 borderRadius: 12,
 paddingVertical: 16,
 paddingHorizontal: 32,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 },
 continueButtonDisabled: {
 backgroundColor: '#BDBDBD',
 },
 continueButtonText: {
 color: '#fff',
 fontSize: 16,
 fontWeight: 'bold',
 },
 submitButton: {
 backgroundColor: '#1A1A1A',
 borderRadius: 12,
 paddingVertical: 16,
 paddingHorizontal: 32,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 },
 submitButtonDisabled: {
 backgroundColor: '#BDBDBD',
 },
 submitButtonText: {
 color: '#fff',
 fontSize: 16,
 fontWeight: 'bold',
 },

 // Infrastructure Display Styles
 infrastructureLoadingContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F3F4F6',
 padding: 12,
 borderRadius: 8,
 marginVertical: 12,
 },
 infrastructureLoadingText: {
 marginLeft: 8,
 fontSize: 14,
 color: '#1A1A1A',
 fontWeight: '600',
 },
 infrastructureContainer: {
 backgroundColor: '#F3F4F6',
 padding: 16,
 borderRadius: 12,
 marginVertical: 12,
 borderLeftWidth: 4,
 borderLeftColor: '#1A1A1A',
 },
 infrastructureTitle: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#4A148C',
 marginBottom: 8,
 },
 infrastructureSummary: {
 fontSize: 14,
 color: '#6A1B9A',
 marginBottom: 12,
 lineHeight: 20,
 },
 infrastructureList: {
 marginTop: 8,
 },
 infrastructureItem: {
 backgroundColor: 'rgba(156, 39, 176, 0.1)',
 padding: 10,
 borderRadius: 8,
 marginBottom: 6,
 },
 infrastructureName: {
 fontSize: 14,
 fontWeight: '600',
 color: '#4A148C',
 textTransform: 'capitalize',
 },
 infrastructureDistance: {
 fontSize: 12,
 color: '#6A1B9A',
 marginTop: 2,
 },
 infrastructureMore: {
 fontSize: 12,
 color: '#1A1A1A',
 fontStyle: 'italic',
 textAlign: 'center',
 marginTop: 4,
 },

 // Infrastructure Modal Styles
 infrastructureModal: {
 backgroundColor: '#fff',
 borderTopLeftRadius: 20,
 borderTopRightRadius: 20,
 paddingBottom: 20,
 maxHeight: '85%',
 minHeight: '50%',
 },
 infrastructureModalContent: {
 paddingHorizontal: 20,
 paddingVertical: 10,
 },
 infrastructureModalSubtitle: {
 fontSize: 14,
 color: '#666',
 marginBottom: 20,
 lineHeight: 20,
 textAlign: 'center',
 },
 infrastructureSectionTitle: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#1A1A1A',
 marginTop: 15,
 marginBottom: 10,
 },
 infrastructureModalItem: {
 backgroundColor: '#f8f9fa',
 padding: 12,
 borderRadius: 10,
 marginBottom: 8,
 borderLeftWidth: 3,
 borderLeftColor: '#1A1A1A',
 },
 infrastructureItemHeader: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginBottom: 4,
 },
 infrastructureItemType: {
 fontSize: 14,
 fontWeight: '600',
 color: '#1A1A1A',
 flex: 1,
 },
 infrastructureItemDistance: {
 fontSize: 12,
 color: '#666',
 backgroundColor: '#F3F4F6',
 paddingHorizontal: 8,
 paddingVertical: 2,
 borderRadius: 10,
 },
 infrastructureItemName: {
 fontSize: 13,
 color: '#444',
 fontWeight: '500',
 },
 infrastructureItemVicinity: {
 fontSize: 11,
 color: '#777',
 marginTop: 2,
 fontStyle: 'italic',
 },
 infrastructureModalFooter: {
 marginTop: 20,
 paddingTop: 15,
 borderTopWidth: 1,
 borderTopColor: '#eee',
 },
 infrastructureModalSummary: {
 fontSize: 13,
 color: '#666',
 textAlign: 'center',
 fontWeight: '500',
 },
 infrastructureModalButton: {
 backgroundColor: '#1A1A1A',
 borderRadius: 10,
 paddingVertical: 12,
 paddingHorizontal: 30,
 alignItems: 'center',
 marginHorizontal: 20,
 marginTop: 10,
 },
 infrastructureModalButtonText: {
 color: '#fff',
 fontSize: 16,
 fontWeight: '600',
 },
});

export default MultiStepSubmitComplaintScreen;