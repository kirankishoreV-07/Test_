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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslation } from '../../i18n/useTranslation';

const AdminLoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        // Verify user type is admin
        if (response.data.user.userType !== 'admin') {
          Alert.alert(t('auth.errors.accessDeniedTitle'), t('auth.errors.adminPortalOnly'));
          setLoading(false);
          return;
        }

        // Store auth token and user data
        await AsyncStorage.setItem('authToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));

        Alert.alert(t('auth.common.successTitle'), t('auth.admin.loginSuccess'));
        navigation.replace('ModernAdminDashboard');
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('auth.errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Brand panel */}
      <View style={styles.brandPanel}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.brandContent}>
          <Text style={styles.brandName}>CIVIC{'\n'}REZO</Text>
          <Text style={styles.brandSub}>{t('app.institutionalPortal').toUpperCase()}</Text>
        </View>
      </View>

      {/* Form */}
      <ScrollView
        style={styles.formPanel}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.formTitle}>{t('auth.admin.adminAccess')}</Text>
        <Text style={styles.formSubtitle}>{t('auth.admin.secureLoginSubtitle')}</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.admin.adminIdOrCredential').toUpperCase()}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="shield-outline" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.input}
              placeholder={t('auth.admin.enterIdentifier')}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.admin.securityPasskey').toUpperCase()}</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="key-outline" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.input}
              placeholder="••••••••••••••"
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry={!showPassword}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
        </View>

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
              <Text style={styles.submitText}>{t('auth.admin.verifyIdentity').toUpperCase()}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('AdminSignup')}>
            <Text style={styles.linkText}>{t('auth.admin.requestAccess').toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert(t('auth.admin.adminSupportTitle'), t('auth.admin.adminSupportBody'))}
          >
            <Text style={styles.linkText}>{t('auth.admin.protocolHelp').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.admin.citizenUserPrompt')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
            <Text style={styles.footerLink}>{t('auth.admin.switchToCitizenPortal')}</Text>
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
  brandPanel: {
    backgroundColor: '#0A0A0A',
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  brandContent: {},
  brandName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 40,
    letterSpacing: 1,
    marginBottom: 8,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
  },
  formPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
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
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 13,
  },
  footerLink: {
    color: '#1A1A1A',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default AdminLoginScreen;
