import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { makeApiCall, apiClient } from '../../../config/supabase';

const LeaderboardScreen = ({ navigation }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await makeApiCall(`${apiClient.baseUrl}/api/volunteer/leaderboard`, { method: 'GET' });
      if (response && response.success) {
        setLeaderboard(response.leaderboard);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const renderLeaderboardItem = ({ item, index }) => {
    let medalColor = '#A9A9A9'; // default grey
    if (index === 0) medalColor = '#FFD700'; // Gold
    else if (index === 1) medalColor = '#C0C0C0'; // Silver
    else if (index === 2) medalColor = '#CD7F32'; // Bronze

    return (
      <View style={styles.card}>
        <View style={styles.rankContainer}>
          {index < 3 ? (
            <MaterialCommunityIcons name="medal" size={32} color={medalColor} />
          ) : (
            <Text style={styles.rankText}>#{index + 1}</Text>
          )}
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{item.name}</Text>
          <Text style={styles.typeText}>{item.type === 'rotary' ? 'Rotary Member' : 'Volunteer'}</Text>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreNumber}>{item.missionsCompleted}</Text>
          <Text style={styles.scoreLabel}>Missions</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rotary Leaderboard</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f39c12" />
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="trophy-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No volunteers yet.</Text>
          <Text style={styles.emptySubText}>Be the first to step up and make an impact!</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaderboardItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f39c12']} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    paddingTop: 15,
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 15,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#777',
  },
  infoContainer: {
    flex: 1,
    paddingLeft: 10,
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  typeText: {
    fontSize: 13,
    color: '#f39c12',
    marginTop: 2,
    fontWeight: '500',
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#eee',
    minWidth: 70,
  },
  scoreNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
  },
});

export default LeaderboardScreen;
