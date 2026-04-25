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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslation } from '../../i18n/useTranslation';

const SignupScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    userType: 'citizen',
    address: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSignup = async () => {
    // Validation
    if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.password) {
      Alert.alert(t('Error'), t('Please fill in all required fields'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert(t('Error'), t('Passwords do not match'));
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert(t('Error'), t('Password must be at least 6 characters long'));
      return;
    }

    setLoading(true);
    try {
      const signupData = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
        userType: formData.userType,
        address: formData.address,
      };

      const response = await makeApiCall(apiClient.auth.signup, {
        method: 'POST',
        body: JSON.stringify(signupData),
      });

      if (response.success) {
        // Store auth token and user data
        await AsyncStorage.setItem('authToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));

        Alert.alert(t('Success'), t('Account created successfully!'));
        
        // Navigate based on user type
        if (response.data.user.userType === 'admin') {
          navigation.replace('EnhancedAdminDashboard');
        } else {
          navigation.replace('InstagramFeed');
        }
      }
    } catch (error) {
      Alert.alert(t('Error'), error.message || t('Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('Create Account')}</Text>
        <Text style={styles.subtitle}>{t('Join CivicStack Community')}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('Full Name *')}
            value={formData.fullName}
            onChangeText={(value) => handleInputChange('fullName', value)}
          />

          <TextInput
            style={styles.input}
            placeholder={t('Email *')}
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder={t('Phone Number *')}
            value={formData.phoneNumber}
            onChangeText={(value) => handleInputChange('phoneNumber', value)}
            keyboardType="phone-pad"
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>{t('User Type *')}</Text>
            <Picker
              selectedValue={formData.userType}
              style={styles.picker}
              onValueChange={(value) => handleInputChange('userType', value)}
            >
              <Picker.Item label={t('Citizen')} value="citizen" />
              <Picker.Item label={t('Admin')} value="admin" />
            </Picker>
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('Address (Optional)')}
            value={formData.address}
            onChangeText={(value) => handleInputChange('address', value)}
            multiline
            numberOfLines={3}
          />

          <TextInput
            style={styles.input}
            placeholder={t('Password *')}
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder={t('Confirm Password *')}
            value={formData.confirmPassword}
            onChangeText={(value) => handleInputChange('confirmPassword', value)}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('Create Account')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>
              {t('Already have an account? Login')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  picker: {
    height: 50,
  },
  button: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  linkText: {
    color: '#2E7D32',
    fontSize: 16,
  },
});

export default SignupScreen;
