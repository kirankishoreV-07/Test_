import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/useTranslation';

const CitizenAuthScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const features = [
    { icon: 'create-outline', text: t('auth.citizen.features.submitTrack') },
    { icon: 'bar-chart-outline', text: t('auth.citizen.features.analytics') },
    { icon: 'map-outline', text: t('auth.citizen.features.heatmaps') },
    { icon: 'chatbubbles-outline', text: t('auth.citizen.features.chatbot') },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={20} color="#374151" />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="people-outline" size={32} color="#1A1A1A" />
        </View>
        <Text style={styles.title}>{t('auth.citizen.title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.citizen.subtitle')}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CitizenLogin')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>{t('auth.citizen.loginToAccount')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('CitizenSignup')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>{t('auth.citizen.createNewAccount')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <View style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>{t('auth.citizen.capabilities')}</Text>
        {features.map((item, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name={item.icon} size={18} color="#6B7280" />
            <Text style={styles.featureText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 32,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 1.2,
  },
  featuresCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 20,
  },
  featuresTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});

export default CitizenAuthScreen;
