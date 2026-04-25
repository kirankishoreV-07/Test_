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
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslation } from '../../i18n/useTranslation';

const CitizenSignupScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.fullName || !formData.phoneNumber) {
      Alert.alert(t('common.error'), t('auth.errors.fillRequiredFields'));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert(t('common.error'), t('auth.errors.passwordMismatch'));
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert(t('common.error'), t('auth.errors.passwordMin6'));
      return false;
    }

    if (!formData.email.includes('@')) {
      Alert.alert(t('common.error'), t('auth.errors.validEmail'));
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const signupData = {
        ...formData,
        userType: 'citizen',
      };
      delete signupData.confirmPassword;

      const response = await makeApiCall(apiClient.auth.signup, {
        method: 'POST',
        body: JSON.stringify(signupData),
      });

      if (response.success) {
        Alert.alert(
          t('auth.common.successTitle'),
          t('auth.citizen.signupSuccessBody'),
          [
            {
              text: t('common.ok'),
              onPress: () => navigation.navigate('CitizenLogin'),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message || t('auth.errors.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'fullName', label: t('auth.common.fullName').toUpperCase(), placeholder: t('auth.common.enterFullName'), icon: 'person-outline', required: true },
    { key: 'email', label: t('auth.common.emailAddress').toUpperCase(), placeholder: t('auth.common.enterEmail'), icon: 'mail-outline', keyboard: 'email-address', required: true },
    { key: 'phoneNumber', label: t('auth.common.phoneNumber').toUpperCase(), placeholder: t('auth.common.enterPhoneNumber'), icon: 'call-outline', keyboard: 'phone-pad', required: true },
    { key: 'address', label: t('auth.common.address').toUpperCase(), placeholder: t('auth.common.enterAddressOptional'), icon: 'location-outline', multiline: true },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#374151" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.citizen.createAccount')}</Text>
          <Text style={styles.subtitle}>{t('auth.citizen.registerSubtitle')}</Text>
        </View>

        {/* Form fields */}
        {fields.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name={field.icon} size={18} color="#9CA3AF" />
              <TextInput
                style={[styles.input, field.multiline && styles.multilineInput]}
                placeholder={field.placeholder}
                value={formData[field.key]}
                onChangeText={(value) => handleInputChange(field.key, value)}
                keyboardType={field.keyboard || 'default'}
                autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'words'}
                multiline={field.multiline}
                numberOfLines={field.multiline ? 2 : 1}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        ))}

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.common.password').toUpperCase()} <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.input}
              placeholder={t('auth.common.min6Characters')}
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

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.common.confirmPassword').toUpperCase()} <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.input}
              placeholder={t('auth.common.reenterPassword')}
              value={formData.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons
                name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info notice */}
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
          <Text style={styles.noticeText}>
            {t('auth.citizen.noticeInfo')}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitDisabled]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={styles.submitContent}>
              <Text style={styles.submitText}>{t('auth.citizen.createAccount').toUpperCase()}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.common.alreadyHaveAccount')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('CitizenLogin')}>
            <Text style={styles.footerLink}>{t('auth.common.loginHere')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  required: {
    color: '#1A1A1A',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  multilineInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  noticeCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  noticeText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  footer: {
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

export default CitizenSignupScreen;
