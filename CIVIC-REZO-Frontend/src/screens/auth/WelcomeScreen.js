import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/useTranslation';
import LanguageSwitcher from '../../components/LanguageSwitcher';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <View style={styles.switcherWrap}>
        <LanguageSwitcher compact />
      </View>

      {/* Top brand section */}
      <View style={styles.brandSection}>
        <View style={styles.logoMark}>
          <Ionicons name="compass-outline" size={36} color="#1A1A1A" />
        </View>

        <Text style={styles.brandName}>{t('app.brandName')}</Text>
        <View style={styles.divider} />
        <Text style={styles.tagline}>{t('app.institutionalPortal')}</Text>
      </View>

      {/* Portal selection */}
      <View style={styles.portalSection}>
        <TouchableOpacity
          style={styles.portalCard}
          onPress={() => navigation.navigate('CitizenAuth')}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={24} color="#1A1A1A" />
          <Text style={styles.portalLabel}>{t('welcome.citizenPortal')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.portalCard}
          onPress={() => navigation.navigate('AdminAuth')}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark-outline" size={24} color="#1A1A1A" />
          <Text style={styles.portalLabel}>{t('welcome.adminAccess')}</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('app.systemValidated')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 64,
  },
  switcherWrap: {
    position: 'absolute',
    top: 52,
    right: 16,
    zIndex: 5,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  brandName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 2,
    marginBottom: 12,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    letterSpacing: 1,
  },
  portalSection: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'center',
  },
  portalCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  portalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    letterSpacing: 2,
  },
});

export default WelcomeScreen;
