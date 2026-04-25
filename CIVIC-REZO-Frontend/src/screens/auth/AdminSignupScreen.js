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

const AdminSignupScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    department: '',
    employeeId: '',
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
    if (!formData.email || !formData.password || !formData.fullName || 
        !formData.phoneNumber || !formData.department || !formData.employeeId) {
      Alert.alert(t('common.error'), t('auth.errors.fillRequiredFields'));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert(t('common.error'), t('auth.errors.passwordMismatch'));
      return false;
    }

    if (formData.password.length < 8) {
      Alert.alert(t('common.error'), t('auth.errors.adminPasswordMin8'));
      return false;
    }

    if (!formData.email.includes('@')) {
      Alert.alert(t('common.error'), t('auth.errors.validEmail'));
      return false;
    }

    if (!formData.email.includes('gov') && !formData.email.includes('civic')) {
      Alert.alert(
        t('auth.common.warningTitle'), 
        t('auth.admin.govEmailWarning'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('auth.common.continue'), onPress: () => null }
        ]
      );
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    Alert.alert(
      t('auth.admin.registrationTitle'),
      t('auth.admin.registrationApprovalNotice'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('auth.common.proceed'), 
          onPress: async () => {
            setLoading(true);
            try {
              const signupData = {
                ...formData,
                userType: 'admin',
                address: `Department: ${formData.department}, Employee ID: ${formData.employeeId}`,
              };
              delete signupData.confirmPassword;
              delete signupData.department;
              delete signupData.employeeId;

              const response = await makeApiCall(apiClient.auth.signup, {
                method: 'POST',
                body: JSON.stringify(signupData),
              });

              if (response.success) {
                Alert.alert(
                  t('auth.admin.registrationSubmittedTitle'),
                  t('auth.admin.registrationSubmittedBody'),
                  [
                    {
                      text: t('common.ok'),
                      onPress: () => navigation.navigate('AdminLogin'),
                    },
                  ]
                );
              }
            } catch (error) {
              Alert.alert(t('common.error'), error.message || t('auth.errors.registrationFailed'));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const fields = [
    { key: 'fullName', label: t('auth.common.fullName').toUpperCase(), placeholder: t('auth.common.enterFullName'), icon: 'person-outline', required: true },
    { key: 'email', label: t('auth.admin.officialEmail').toUpperCase(), placeholder: t('auth.common.enterEmail'), icon: 'mail-outline', keyboard: 'email-address', required: true },
    { key: 'department', label: t('auth.admin.department').toUpperCase(), placeholder: t('auth.admin.enterDepartment'), icon: 'business-outline', required: true },
    { key: 'employeeId', label: t('auth.admin.employeeId').toUpperCase(), placeholder: t('auth.admin.enterEmployeeId'), icon: 'card-outline', required: true },
    { key: 'phoneNumber', label: t('auth.common.phoneNumber').toUpperCase(), placeholder: t('auth.common.enterPhoneNumber'), icon: 'call-outline', keyboard: 'phone-pad', required: true },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#374151" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.admin.registrationTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.admin.requestAccessSubtitle')}</Text>
        </View>

        {/* Warning */}
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={18} color="#1A1A1A" />
          <Text style={styles.noticeText}>
            {t('auth.admin.registrationApprovalNotice')}
          </Text>
        </View>

        {/* Fields */}
        {fields.map((field) => (
          <View key={field.key} style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {field.label} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name={field.icon} size={18} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder={field.placeholder}
                value={formData[field.key]}
                onChangeText={(value) => handleInputChange(field.key, value)}
                keyboardType={field.keyboard || 'default'}
                autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'words'}
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
              placeholder={t('auth.common.min8Characters')}
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry={!showPassword}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9CA3AF" />
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
              <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Requirements */}
        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>{t('auth.admin.requiredForAccess').toUpperCase()}</Text>
          <Text style={styles.requirementItem}>{t('auth.admin.reqGovEmail')}</Text>
          <Text style={styles.requirementItem}>{t('auth.admin.reqDepartmentInfo')}</Text>
          <Text style={styles.requirementItem}>{t('auth.admin.reqEmployeeId')}</Text>
          <Text style={styles.requirementItem}>{t('auth.admin.reqVerification')}</Text>
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
              <Text style={styles.submitText}>{t('auth.admin.submitRegistration').toUpperCase()}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.admin.alreadyHaveAdminAccess')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('AdminLogin')}>
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
    marginBottom: 20,
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
  noticeCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  noticeText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
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
  requirementsCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  requirementItem: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    paddingLeft: 8,
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

export default AdminSignupScreen;
