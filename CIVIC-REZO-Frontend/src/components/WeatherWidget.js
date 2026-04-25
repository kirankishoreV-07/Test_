import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { makeApiCall, apiClient } from '../../config/supabase';

const WeatherWidget = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await makeApiCall(`${apiClient.baseUrl}/api/weather`, {
        method: 'GET'
      });

      if (response && response.success && response.data) {
        setWeatherData(response.data);
      } else {
        setError('Weather data unavailable');
      }
    } catch (err) {
      console.error('Failed to fetch weather:', err);
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (weatherCode, isDay = 1) => {
    // Open-Meteo WMO codes mapping to Ionicons
    if (weatherCode === 0) return isDay ? 'sunny' : 'moon';
    if (weatherCode >= 1 && weatherCode <= 3) return isDay ? 'partly-sunny' : 'cloudy-night';
    if (weatherCode >= 45 && weatherCode <= 48) return 'cloud'; // Fog
    if (weatherCode >= 51 && weatherCode <= 57) return 'rainy-outline'; // Drizzle
    if (weatherCode >= 61 && weatherCode <= 67) return 'rainy'; // Rain
    if (weatherCode >= 71 && weatherCode <= 77) return 'snow'; // Snow
    if (weatherCode >= 80 && weatherCode <= 82) return 'water'; // Showers
    if (weatherCode >= 95 && weatherCode <= 99) return 'thunderstorm'; // Thunderstorm
    return 'partly-sunny'; // Default
  };

  const getBackgroundColors = (weatherCode) => {
    // Blue for rain/water, gray for fog, orange/blue for clear
    if (weatherCode >= 51 && weatherCode <= 67) return ['#3b82f6', '#1e40af']; // Rain
    if (weatherCode >= 80 && weatherCode <= 82) return ['#2563eb', '#1e3a8a']; // Showers
    if (weatherCode >= 95 && weatherCode <= 99) return ['#1e3a8a', '#0f172a']; // Thunderstorm
    if (weatherCode >= 71 && weatherCode <= 77) return ['#93c5fd', '#3b82f6']; // Snow
    if (weatherCode >= 45 && weatherCode <= 48) return ['#94a3b8', '#475569']; // Fog
    if (weatherCode >= 1 && weatherCode <= 3) return ['#38bdf8', '#0284c7']; // Cloudy
    return ['#38bdf8', '#0ea5e9']; // Clear sky
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#1A1A1A" />
        <Text style={styles.loadingText}>Loading live weather...</Text>
      </View>
    );
  }

  if (error || !weatherData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="cloud-offline" size={24} color="#999" />
        <Text style={styles.errorText}>{error || 'Weather not available'}</Text>
      </View>
    );
  }

  const { current, forecast, isHeavyRainExpected, alertMessage, location } = weatherData;
  const bgColors = getBackgroundColors(current.weatherCode);

  return (
    <View style={styles.container}>
      {/* Smart Contextual Warning Banner */}
      {isHeavyRainExpected && alertMessage && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={styles.alertText}>{alertMessage}</Text>
        </View>
      )}

      {/* Main Weather Card */}
      <LinearGradient colors={bgColors} style={styles.weatherCard}>
        <View style={styles.currentWeatherTop}>
          <View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#fff" />
              <Text style={styles.locationText}>{location}</Text>
            </View>
            <Text style={styles.tempText}>{Math.round(current.temp)}°C</Text>
            <Text style={styles.conditionText}>{current.condition}</Text>
          </View>
          
          <View style={styles.iconContainer}>
            <Ionicons name={getWeatherIcon(current.weatherCode, current.isDay)} size={70} color="#fff" />
          </View>
        </View>

        <View style={styles.currentDetailsRow}>
          <View style={styles.detailItem}>
            <MaterialCommunityIcons name="thermometer-lines" size={18} color="#rgba(255,255,255,0.8)" />
            <Text style={styles.detailText}>Feels {Math.round(current.feelsLike)}°</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="water-outline" size={18} color="#rgba(255,255,255,0.8)" />
            <Text style={styles.detailText}>{current.humidity}%</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="speedometer-outline" size={18} color="#rgba(255,255,255,0.8)" />
            <Text style={styles.detailText}>{Math.round(current.windSpeed)} km/h</Text>
          </View>
        </View>

        {/* 7-Day Forecast */}
        <View style={styles.forecastContainer}>
          <Text style={styles.forecastTitle}>7-Day Forecast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forecastScroll}>
            {forecast && forecast.slice(0, 7).map((day, index) => {
              const dateObj = new Date(day.date);
              const dayName = index === 0 ? 'Today' : index === 1 ? 'Tom' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              
              return (
                <View key={index} style={styles.forecastItem}>
                  <Text style={styles.forecastDay}>{dayName}</Text>
                  <Ionicons name={getWeatherIcon(day.weatherCode, 1)} size={24} color="#fff" style={{ marginVertical: 4 }} />
                  <Text style={styles.forecastTemp}>{Math.round(day.minTemp)}° / {Math.round(day.maxTemp)}°</Text>
                  {day.rainProbability > 20 && (
                    <Text style={styles.rainProbText}>{day.rainProbability}%</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  errorText: {
    color: '#999',
    marginLeft: 8,
    fontSize: 14,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444', // Red-500
    padding: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginBottom: -8, // Pulls the card up slightly to overlap
    paddingBottom: 20, // Extra padding at bottom for overlap
    zIndex: 0,
  },
  alertText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 13,
    flex: 1,
  },
  weatherCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1,
  },
  currentWeatherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  tempText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
  conditionText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginLeft: 4,
  },
  forecastContainer: {
    marginTop: 16,
  },
  forecastTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  forecastScroll: {
    flexDirection: 'row',
  },
  forecastItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  forecastDay: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
  forecastTemp: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  rainProbText: {
    color: '#bae6fd', // light blue
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  }
});

export default WeatherWidget;
