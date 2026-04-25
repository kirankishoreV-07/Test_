import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslation } from '../../i18n/useTranslation';

const { width } = Dimensions.get('window');

const CitizenLoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert(t('common.error'), t('auth.errors.fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const response = await makeApiCall(apiClient.auth.login, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (response.success) {
        // Verify user type is citizen
        if (response.data.user.userType !== 'citizen') {
          Alert.alert(t('auth.errors.accessDeniedTitle'), t('auth.errors.citizenPortalOnly'));
          setLoading(false);
          return;
        }

        // Store auth token and user data
        await AsyncStorage.setItem('authToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));

        Alert.alert(t('auth.common.successTitle'), t('auth.common.loginSuccess'));
        navigation.replace('InstagramFeed');
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />

      {/* Left panel — brand identity */}
      <View style={styles.brandPanel}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.brandContent}>
          <Text style={styles.brandName}>CIVIC{'\n'}REZO</Text>
          <View style={styles.brandDivider} />
          <View style={styles.accessBadge}>
            <Text style={styles.accessTitle}>{t('auth.citizen.secureAccess')}</Text>
          </View>
          <Text style={styles.accessDescription}>
            {t('auth.citizen.secureAccessDescription')}
          </Text>
        </View>
      </View>

      {/* Right panel — form */}
      <ScrollView
        style={styles.formPanel}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'login' && styles.activeTab]}
            onPress={() => setActiveTab('login')}
          >
            <Text style={[styles.tabText, activeTab === 'login' && styles.activeTabText]}>{t('auth.common.login').toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'register' && styles.activeTab]}
            onPress={() => {
              setActiveTab('register');
              navigation.navigate('CitizenSignup');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'register' && styles.activeTabText]}>{t('auth.common.register').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Form fields */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.citizen.citizenIdOrEmail').toUpperCase()}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t('auth.citizen.enterCredentials')}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
            <Ionicons name="finger-print-outline" size={20} color="#9CA3AF" />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.citizen.accessKey').toUpperCase()}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry={!showPassword}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Options row */}
        <View style={styles.optionsRow}>
          <View style={styles.checkRow}>
            <View style={styles.checkbox} />
            <Text style={styles.optionText}>{t('auth.citizen.maintainSession')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => Alert.alert(t('auth.citizen.passwordResetTitle'), t('auth.citizen.passwordResetBody'))}
          >
            <Text style={styles.recoverText}>{t('auth.citizen.recoverKey').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.submitContent}>
              <Text style={styles.submitText}>{t('auth.citizen.authenticateSession').toUpperCase()}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Security notice */}
        <View style={styles.securityNotice}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#9CA3AF" />
          <Text style={styles.securityText}>{t('auth.citizen.securityNotice')}</Text>
        </View>

        {/* Footer link */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{t('auth.citizen.needAdminAccess')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
            <Text style={styles.footerLink}>{t('auth.common.switchPortal')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Brand panel
  brandPanel: {
    backgroundColor: '#1A1A1A',
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  brandContent: {
    paddingLeft: 4,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 42,
    letterSpacing: 1,
    marginBottom: 16,
  },
  brandDivider: {
    width: 32,
    height: 2,
    backgroundColor: '#1A1A1A',
    marginBottom: 20,
  },
  accessBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  accessTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  accessDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
  },
  // Form panel
  formPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    paddingBottom: 12,
    marginRight: 28,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
    letterSpacing: 1.5,
  },
  activeTabText: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: '#FAFAFA',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    letterSpacing: 0.2,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 3,
  },
  optionText: {
    fontSize: 13,
    color: '#6B7280',
  },
  recoverText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 0.8,
  },
  submitButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  submitDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  securityText: {
    fontSize: 11,
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textDecorationLine: 'underline',
  },
});

export default CitizenLoginScreen;
