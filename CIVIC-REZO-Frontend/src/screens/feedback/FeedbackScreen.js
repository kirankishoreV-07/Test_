import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../i18n/useTranslation';

const FeedbackScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { complaintId, complaintTitle } = route.params || {};
  
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [improvements, setImprovements] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = (selectedRating) => {
    setRating(selectedRating);
  };

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      Alert.alert(t('Rating Required'), t('Please provide a rating before submitting.'));
      return;
    }

    setSubmitting(true);
    
    // Simulate processing time
    setTimeout(() => {
      setSubmitting(false);
      
      Alert.alert(
        t('Thank You!'),
        t('Your feedback has been submitted successfully. It helps us improve our service.'),
        [
          {
            text: t('Continue'),
            onPress: () => {
              // Navigate to Instagram-style feed dashboard
              navigation.reset({
                index: 0,
                routes: [{ name: 'InstagramFeed' }],
              });
            }
          }
        ]
      );
    }, 1000); // 1 second delay to simulate processing
  };

  const handleSkip = () => {
    Alert.alert(
      t('Skip Feedback?'),
      t('Your feedback helps us improve our service. Are you sure you want to skip?'),
      [
        { text: t('Provide Feedback'), style: 'cancel' },
        {
          text: t('Skip'),
          style: 'destructive',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'InstagramFeed' }],
            });
          }
        }
      ]
    );
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          style={styles.starButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={i <= rating ? 'star' : 'star-outline'}
            size={40}
            color={i <= rating ? '#1A1A1A' : '#bdc3c7'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const getRatingText = () => {
    switch (rating) {
      case 1: return t('Poor - Needs significant improvement');
      case 2: return t('Fair - Some improvements needed');
      case 3: return t('Good - Satisfactory experience');
      case 4: return t('Very Good - Minor improvements possible');
      case 5: return t('Excellent - Great experience!');
      default: return t('Please rate your experience');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1A1A1A', '#1A1A1A']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>{t('Skip')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Feedback')}</Text>
          <View style={styles.skipButton} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successMessage}>
          <Ionicons name="checkmark-circle" size={60} color="#1A1A1A" />
          <Text style={styles.successTitle}>{t('Complaint Submitted!')}</Text>
          <Text style={styles.successSubtitle}>
            {t('Thank you for reporting:')} {complaintTitle}
          </Text>
        </View>

        <View style={styles.feedbackCard}>
          <Text style={styles.sectionTitle}>{t('How was your experience?')}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('Your feedback helps us improve our complaint submission process')}
          </Text>

          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
            <Text style={styles.ratingText}>{getRatingText()}</Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              {t('General Feedback')} <Text style={styles.optional}>{t('(Optional)')}</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={3}
              placeholder={t('Share your overall experience with the complaint submission process...')}
              value={feedback}
              onChangeText={setFeedback}
              maxLength={500}
            />
            <Text style={styles.charCount}>{feedback.length}/500</Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              {t('Suggestions for Improvement')} <Text style={styles.optional}>{t('(Optional)')}</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={3}
              placeholder={t("How can we make the complaint submission process better? Any features you'd like to see?")}
              value={improvements}
              onChangeText={setImprovements}
              maxLength={500}
            />
            <Text style={styles.charCount}>{improvements.length}/500</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.submitButton, (rating === 0 || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmitFeedback}
          disabled={rating === 0 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>{t('Submit Feedback')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  skipButton: {
    width: 60,
  },
  skipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  successMessage: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    borderRadius: 15,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 15,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  feedbackCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 25,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  starButton: {
    marginHorizontal: 5,
    padding: 5,
  },
  ratingText: {
    fontSize: 16,
    color: '#34495e',
    fontWeight: '500',
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  optional: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#95a5a6',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
    backgroundColor: '#f8f9fa',
    minHeight: 80,
  },
  charCount: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'right',
    marginTop: 5,
  },
  bottomActions: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default FeedbackScreen;
