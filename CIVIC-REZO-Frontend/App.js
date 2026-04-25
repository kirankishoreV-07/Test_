import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AppLanguageProvider } from './src/i18n/AppLanguageContext';

// Import screens
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import CitizenAuthScreen from './src/screens/auth/CitizenAuthScreen';
import AdminAuthScreen from './src/screens/auth/AdminAuthScreen';
import CitizenLoginScreen from './src/screens/auth/CitizenLoginScreen';
import AdminLoginScreen from './src/screens/auth/AdminLoginScreen';
import CitizenSignupScreen from './src/screens/auth/CitizenSignupScreen';
import AdminSignupScreen from './src/screens/auth/AdminSignupScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import CitizenDashboard from './src/screens/citizen/CitizenDashboard';
import AdminDashboard from './src/screens/admin/AdminDashboard';
import EnhancedAdminDashboard from './src/screens/admin/EnhancedAdminDashboard';
import ModernAdminDashboard from './src/screens/admin/ModernAdminDashboard';
import PriorityQueue from './src/screens/admin/PriorityQueue';
import CitizenManagement from './src/screens/admin/CitizenManagement';
import CitizenDetails from './src/screens/admin/CitizenDetails';
import AdminComplaintDetails from './src/screens/admin/AdminComplaintDetails';
import AdminComplaintMapScreen from './src/screens/admin/AdminComplaintMapScreen';
import MultiStepSubmitComplaintScreen from './src/screens/complaint/MultiStepSubmitComplaintScreen';
import ComplaintMapScreen from './src/screens/citizen/ComplaintMapScreen';
import ComplaintDetailScreen from './src/screens/citizen/ComplaintDetailScreen';
import LeaderboardScreen from './src/screens/citizen/LeaderboardScreen';
import ComplaintFeedScreen from './src/screens/citizen/ComplaintFeedScreen';
import InstagramStyleFeedScreen from './src/screens/citizen/InstagramStyleFeedScreen';
import CitizenTransparencyScreen from './src/screens/citizen/CitizenTransparencyScreen';
import PersonalReports from './src/screens/citizen/PersonalReports';
import CivicChatbotScreen from './src/screens/citizen/CivicChatbotScreen';
import FeedbackScreen from './src/screens/feedback/FeedbackScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(false);

  // Remove automatic authentication check - always start from Welcome screen

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <AppLanguageProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false
          }}
          initialRouteName="Welcome"
        >
          {/* Welcome & Auth Selection Screens */}
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="CitizenAuth" component={CitizenAuthScreen} />
          <Stack.Screen name="AdminAuth" component={AdminAuthScreen} />
          
          {/* Citizen Auth Screens */}
          <Stack.Screen name="CitizenLogin" component={CitizenLoginScreen} />
          <Stack.Screen name="CitizenSignup" component={CitizenSignupScreen} />
          
          {/* Admin Auth Screens */}
          <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          <Stack.Screen name="AdminSignup" component={AdminSignupScreen} />
          
          {/* Legacy Auth Screens (for backward compatibility) */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          
          {/* Citizen Screens */}
          <Stack.Screen name="CitizenDashboard" component={CitizenDashboard} />
          <Stack.Screen name="SubmitComplaint" component={MultiStepSubmitComplaintScreen} />
          <Stack.Screen name="ComplaintMap" component={ComplaintMapScreen} />
          <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} />
          <Stack.Screen name="ComplaintFeed" component={ComplaintFeedScreen} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="InstagramFeed" component={InstagramStyleFeedScreen} />
          <Stack.Screen name="CitizenTransparency" component={CitizenTransparencyScreen} />
          <Stack.Screen name="PersonalReports" component={PersonalReports} />
          <Stack.Screen name="CivicChatbot" component={CivicChatbotScreen} />
          <Stack.Screen name="FeedbackScreen" component={FeedbackScreen} />
          
          {/* Admin Screens */}
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
          <Stack.Screen name="EnhancedAdminDashboard" component={EnhancedAdminDashboard} />
          <Stack.Screen name="ModernAdminDashboard" component={ModernAdminDashboard} />
          <Stack.Screen name="PriorityQueue" component={PriorityQueue} />
          <Stack.Screen name="CitizenManagement" component={CitizenManagement} />
          <Stack.Screen name="CitizenDetails" component={CitizenDetails} />
          <Stack.Screen name="ComplaintDetails" component={AdminComplaintDetails} />
          <Stack.Screen name="AdminComplaintMap" component={AdminComplaintMapScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppLanguageProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
