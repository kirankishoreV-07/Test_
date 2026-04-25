import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  StatusBar,
  ScrollView,
  Linking,
  Easing
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { makeApiCall, apiClient } from '../../../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { refetchComplaintVotes } from '../../utils/voteUtils';
import { handleVoting } from '../../utils/enhancedVoteUtils';
import LocationService from '../../services/LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ComplaintProgressModal from '../../components/ComplaintProgressModal';

/**
 * Get guest vote status from local storage
 */
const getGuestVoteStatus = async (complaintId) => {
  try {
    const guestVotes = await AsyncStorage.getItem('guestVotes');
    if (guestVotes) {
      const votesMap = JSON.parse(guestVotes);
      return votesMap[complaintId] || false;
    }
    return false;
  } catch (error) {
    console.error(' Error getting guest vote status:', error);
    return false;
  }
};
import NewsCarousel from '../../components/NewsCarousel';
import NewsCard from '../../components/NewsCard';
import NewsService from '../../services/NewsService';
import WeatherWidget from '../../components/WeatherWidget';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width;

const InstagramStyleFeedScreen = ({ navigation }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  // News state
  const [topNews, setTopNews] = useState([]);
  const [allNews, setAllNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [feedData, setFeedData] = useState([]);
  
  const insets = useSafeAreaInsets();

  // Progress modal state
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [selectedComplaintTitle, setSelectedComplaintTitle] = useState('');

  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const likeAnimations = useRef({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [1, 0.9, 0.8],
    extrapolate: 'clamp',
  });

  const [imageLoadErrors, setImageLoadErrors] = useState({});
  const [cardAnimations] = useState(() => new Map());
  
  // Remove the problematic navigation reset code that was causing infinite loops
  
  // Check if this is the initial route to prevent back navigation
  const isInitialRoute = useRef(true);
  
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      isInitialRoute.current = false;
    });
    return unsubscribe;
  }, [navigation]);
  
  // Get user data and current location on component mount
  useEffect(() => {
    loadUserData();
    fetchUserLocation();
    
    // ALWAYS fetch news on component mount
    console.log(' Component mounted - fetching news immediately');
    fetchNews();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.2)),
      })
    ]).start();
  }, []);

  // Fetch complaints when location is available
  useEffect(() => {
    if (userLocation) {
      fetchNearbyComplaints();
      // Also refresh news when location is available
      console.log(' Location available - refreshing news with location data');
      fetchNews();
    }
  }, [userLocation]);

  const loadUserData = async () => {
    try {
      const storedUserData = await AsyncStorage.getItem('userData');
      if (storedUserData) {
        setUserData(JSON.parse(storedUserData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  } // <-- Add this closing brace to fix the error

  const fetchUserLocation = async () => {
    setLocationLoading(true);
    try {
      // Use the LocationService singleton instance directly
      const locationData = await LocationService.getExactLocation();

      if (locationData) {
        console.log(' User location:', locationData);
        setUserLocation({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
      } else {
        Alert.alert(
          "Location Error",
          "We couldn't determine your current location. Please check your device settings and try again.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error(' Error getting location:', error);
      Alert.alert(
        "Location Error",
        "We need your location to show nearby complaints. Please enable location services.",
        [
          { text: "Cancel" },
          { 
            text: "Settings", 
            onPress: async () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          }
        ]
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // New function to preload images when the component mounts
  useEffect(() => {
    if (complaints && complaints.length > 0) {
      // Create image elements to cache images
      complaints.forEach(complaint => {
        if (complaint.image_urls && complaint.image_urls.length > 0) {
          const imageUrl = complaint.image_urls[0];
          
          // Skip prefetching for file:// URLs since they can't be prefetched
          if (imageUrl.startsWith('file:///')) {
            console.log(`Skipping prefetch for local file URL for complaint ${complaint.id}`);
            return;
          }
          
          Image.prefetch(imageUrl).then(() => {
            console.log(`Successfully prefetched image for complaint ${complaint.id}`);
          }).catch(error => {
            console.log(`Failed to prefetch image for complaint ${complaint.id}:`, error);
          });
        }
      });
    }
  }, [complaints]);

  const fetchNearbyComplaints = async () => {
    if (!userLocation) return;
    
    setLoading(true);
    try {
      // Call the backend API to get complaints within 3km (changed from 5km)
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/complaints?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radius=3000`,
        { method: 'GET' }
      );
      
      if (response.success && response.complaints) {
        // Log the complete response to understand the image URL structure
        console.log('COMPLAINTS WITH IMAGE URLS:', response.complaints.map(c => ({
          id: c.id,
          title: c.title,
          image_urls: c.image_urls,
          image_url: c.image_url
        })));
        
        // Create animation refs for each complaint and check guest vote status
        const complaintsWithDetails = await Promise.all(
          response.complaints.map(async (complaint) => {
            // Check guest vote status for this complaint
            const guestVoteStatus = await getGuestVoteStatus(complaint.id);
            
            // Determine the final userVoted status:
            // Use server userVoted if authenticated, otherwise use guest vote status
            const finalUserVoted = complaint.userVoted || guestVoteStatus;
            
            // Initialize like animation if it doesn't exist
            if (!likeAnimations.current[complaint.id]) {
              likeAnimations.current[complaint.id] = new Animated.Value(finalUserVoted ? 1 : 0);
            }
          
          // Calculate time ago
          const timeAgo = getTimeAgo(new Date(complaint.created_at));
          
          // Extract image URLs from various possible fields in the API response
          let imageUrls = [];
          
          // Log raw image data for debugging
          console.log(`Raw image data for complaint ${complaint.id}:`, {
            image_urls: complaint.image_urls,
            image_url: complaint.image_url,
            imageUrl: complaint.imageUrl,
            secure_url: complaint.secure_url
          });
          
          // Case 1: image_urls array field
          if (complaint.image_urls && Array.isArray(complaint.image_urls) && complaint.image_urls.length > 0) {
            imageUrls = [...complaint.image_urls];
          } 
          // Case 2: image_urls string field that might be JSON
          else if (complaint.image_urls && typeof complaint.image_urls === 'string') {
            try {
              // Check if it's a JSON string
              if (complaint.image_urls.startsWith('[') || complaint.image_urls.startsWith('{')) {
                const parsedUrls = JSON.parse(complaint.image_urls);
                if (Array.isArray(parsedUrls)) {
                  imageUrls = [...parsedUrls];
                } else if (typeof parsedUrls === 'string') {
                  imageUrls = [parsedUrls];
                } else if (parsedUrls && typeof parsedUrls === 'object') {
                  // If it's an object with URLs as values
                  imageUrls = Object.values(parsedUrls).filter(url => url && typeof url === 'string');
                }
              } else {
                // If it's just a single URL string
                imageUrls = [complaint.image_urls];
              }
            } catch (error) {
              // If it's not valid JSON but is a simple string URL
              console.log(`Error parsing image_urls as JSON for complaint ${complaint.id}:`, error);
              
              // Just use it as a regular URL if it looks like one
              if (complaint.image_urls.includes('http') || 
                  complaint.image_urls.includes('cloudinary') || 
                  complaint.image_urls.includes('://')) {
                imageUrls = [complaint.image_urls];
              }
            }
          }
          // Case 3: image_url string field (single URL)
          else if (complaint.image_url && typeof complaint.image_url === 'string') {
            imageUrls = [complaint.image_url];
          }
          // Case 4: imageUrl string field (single URL, camelCase)
          else if (complaint.imageUrl && typeof complaint.imageUrl === 'string') {
            imageUrls = [complaint.imageUrl];
          }
          // Case 5: images array field (alternate name)
          else if (complaint.images && Array.isArray(complaint.images) && complaint.images.length > 0) {
            imageUrls = [...complaint.images];
          }
          // Case 6: secure_url directly from Cloudinary
          else if (complaint.secure_url && typeof complaint.secure_url === 'string') {
            imageUrls = [complaint.secure_url];
          }
          
          // If no images found, leave imageUrls empty - the UI will handle showing "No Image Available"
          if (imageUrls.length === 0) {
            console.log(`No image URLs found for complaint ${complaint.id} - will show placeholder`);
          }
          
          // Process image URLs to ensure they're valid and prioritize cloud URLs
          const processedImageUrls = imageUrls
            .filter(url => url && typeof url === 'string' && url.trim() !== '') // Remove empty/null entries
            .map(url => {
              // Clean up the URL
              let trimmedUrl = url.trim();
              
              // Special handling for file:// URLs - these are local files
              if (trimmedUrl.startsWith('file:///')) {
                console.log(`Found local file URL for complaint ${complaint.id}, will use fallback`);
                return trimmedUrl; // Keep as is, will be handled by renderComplaintImage
              }
              
              // Handle URLs that might be missing the protocol
              if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('file://')) {
                if (trimmedUrl.includes('cloudinary.com') || trimmedUrl.includes('res.cloudinary.com')) {
                  trimmedUrl = 'https://' + trimmedUrl;
                }
              }
              
              return trimmedUrl;
            })
            // Sort to prioritize cloud URLs over local file URLs
            .sort((a, b) => {
              const aIsCloud = a.startsWith('http://') || a.startsWith('https://');
              const bIsCloud = b.startsWith('http://') || b.startsWith('https://');
              
              if (aIsCloud && !bIsCloud) return -1; // a comes first (cloud URL)
              if (!aIsCloud && bIsCloud) return 1;  // b comes first (cloud URL)
              
              // Both are cloud URLs or both are file URLs, prioritize Cloudinary
              if (a.includes('cloudinary.com') && !b.includes('cloudinary.com')) return -1;
              if (!a.includes('cloudinary.com') && b.includes('cloudinary.com')) return 1;
              
              return 0; // Keep original order
            });

          console.log(`Processed image URLs for complaint ${complaint.id}:`, processedImageUrls);
          console.log(`Final vote status for complaint ${complaint.id}: server=${complaint.userVoted}, guest=${guestVoteStatus}, final=${finalUserVoted}`);
          
          // Only use sample if there are NO image URLs at all
          if (processedImageUrls.length === 0) {
            console.log(`No image URLs found for complaint ${complaint.id}, will show placeholder`);
            // Don't add sample image, let the component handle the "no image" case
          } else {
            console.log(`Using ${processedImageUrls.length} image URLs for complaint ${complaint.id}:`, processedImageUrls);
          }
          
          return {
            ...complaint,
            timeAgo,
            voteCount: complaint.vote_count || 0,
            userVoted: finalUserVoted,
            image_urls: processedImageUrls // Use actual URLs from database, empty array if none
          };
        })
        );
        
        setComplaints(complaintsWithDetails);
      } else {
        console.error(' Error fetching complaints:', response);
        setComplaints([]);
      }
    } catch (error) {
      console.error(' Error fetching nearby complaints:', error);
      Alert.alert(
        "Couldn't Load Complaints",
        "There was a problem loading complaints. Please try again later.",
        [{ text: "OK" }]
      );
      setComplaints([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserLocation();
    if (userLocation) {
      await fetchNearbyComplaints();
    } else {
      setRefreshing(false);
    }
    // Also refresh news
    await fetchNews();
  };

  // Fetch location-based news (real API integration)
  const fetchNews = async () => {
    try {
      setNewsLoading(true);
      console.log(' Starting to fetch location-based news...');
      
      // DEBUG: Test NewsAPI directly before using NewsService
      console.log(' DEBUG: Testing NewsAPI directly...');
      const directTestUrl = 'https://newsapi.org/v2/top-headlines?country=in&pageSize=3&apiKey=a7c4dd34b48e43ef843e3a9e9743b0b0';
      try {
        const directResponse = await fetch(directTestUrl);
        const directData = await directResponse.json();
        console.log(' Direct API test result:', directData.status, 'Articles:', directData.articles?.length || 0);
        if (directData.articles && directData.articles.length > 0) {
          console.log(' Direct API first headline:', directData.articles[0].title);
        }
        if (directData.status === 'error') {
          console.log(' Direct API error:', directData.message, directData.code);
        }
      } catch (directError) {
        console.log(' Direct API test failed:', directError.message);
      }
      
      // Clear cache to force fresh API call
      NewsService.clearCache();
      console.log(' Cache cleared, forcing fresh news fetch');
      
      // Fetch top 10 news for carousel (increased from 3)
      console.log(' Calling NewsService.getTopNews(10)...');
      const topNewsResult = await NewsService.getTopNews(10);
      console.log(' Top news result received:', topNewsResult);
      console.log(' Top news success:', topNewsResult.success);
      console.log(' Top news count:', topNewsResult.news?.length || 0);
      
      if (topNewsResult.success && topNewsResult.news && topNewsResult.news.length > 0) {
        console.log(' Setting topNews state with', topNewsResult.news.length, 'articles');
        console.log(' First headline:', topNewsResult.news[0]?.headline);
        setTopNews(topNewsResult.news);
        console.log(' topNews state should now be updated');
        console.log(' News source:', topNewsResult.source); // Log if real API or placeholder
      } else {
        console.log(' Top news result failed or empty, not setting topNews state');
        console.log(' Received:', topNewsResult);
      }
      
      // Fetch all news for interspersing
      const allNewsResult = await NewsService.getLocationNews();
      console.log(' All news result:', allNewsResult);
      if (allNewsResult.success) {
        setAllNews(allNewsResult.news);
        console.log(' Set all news:', allNewsResult.news.length, 'articles');
        console.log(' Location:', allNewsResult.location); // Log user location
        console.log(' News source:', allNewsResult.source); // Log if real API or placeholder
        
        // Log first few headlines to verify they're real/location-based
        if (allNewsResult.news.length > 0) {
          console.log(' First few headlines:');
          allNewsResult.news.slice(0, 3).forEach((article, index) => {
            console.log(` ${index + 1}. ${article.headline} (${article.source})`);
          });
        }
      }
      
      console.log(` Fetched ${topNewsResult.news?.length || 0} top news and ${allNewsResult.news?.length || 0} total news`);
    } catch (error) {
      console.error(' Error fetching news:', error);
    } finally {
      setNewsLoading(false);
    }
  };

  // Handle news press
  const handleNewsPress = (article) => {
    console.log(' News pressed:', article.headline);
    Alert.alert(
      article.headline,
      `${article.summary}\n\nSource: ${article.source}`,
      [{ text: 'Close' }]
    );
  };

  // Create feed data (only complaints - news shown in header)
  const createCombinedFeedData = () => {
    console.log(' Creating feed data...');
    console.log(' Complaints:', complaints.length);
    console.log(' All news:', allNews.length);
    
    if (!complaints.length) {
      console.log('️ No complaints available for feed');
      return [];
    }
    
    // Only return complaints - news will be shown in header carousel
    const feedData = complaints.map(complaint => ({
      id: complaint.id,
      type: 'complaint',
      data: complaint
    }));
    
    console.log(' Feed data created:', feedData.length, 'complaint items');
    console.log('� News items will be shown in header carousel:', allNews.length);
    
    return feedData;
  };

  // Update feed data when complaints or news change
  useEffect(() => {
    console.log(' Feed data update triggered');
    console.log(' Current complaints:', complaints.length);
    console.log(' Current all news:', allNews.length);
    
    const combined = createCombinedFeedData();
    setFeedData(combined);
    console.log(' Feed data updated with', combined.length, 'items');
  }, [complaints, allNews]);

  // Fetch news on component mount
  useEffect(() => {
    fetchNews();
  }, []);

  const handleUpvote = async (complaintId, index) => {
    // Find the complaint in the state
    const complaint = complaints.find(c => c.id === complaintId);
    if (!complaint) return;
    
    // Animate the like button immediately for better UX
    Animated.sequence([
      Animated.timing(likeAnimations.current[complaintId], {
        toValue: complaint.userVoted ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(100),
      Animated.spring(likeAnimations.current[complaintId], {
        toValue: complaint.userVoted ? 0 : 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Make API call to update vote and refetch current vote count
    const complaintIndex = complaints.findIndex(c => c.id === complaintId);
    
    try {
      // Use enhanced voting that handles both authenticated and guest voting
      const voteResponse = await handleVoting(complaintId, apiClient, makeApiCall);
      
      if (!voteResponse.success) {
        console.error(' Vote failed:', voteResponse);
        Alert.alert(
          "Vote Failed",
          "There was a problem recording your vote. Please try again.",
          [{ text: "OK" }]
        );
        return;
      }

      // Always refetch the current vote count from server for accuracy
      const refetchResponse = await refetchComplaintVotes(complaintId, apiClient);
      
      if (refetchResponse.success && complaintIndex > -1) {
        const updatedComplaints = [...complaints];
        updatedComplaints[complaintIndex] = {
          ...updatedComplaints[complaintIndex],
          voteCount: refetchResponse.voteCount,
          userVoted: refetchResponse.userVoted
        };
        setComplaints(updatedComplaints);
        
        // Update animation to match server state
        if (likeAnimations.current[complaintId]) {
          Animated.spring(likeAnimations.current[complaintId], {
            toValue: refetchResponse.userVoted ? 1 : 0,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
        
        console.log(` Vote updated: ${refetchResponse.userVoted ? 'Voted' : 'Unvoted'}, Count: ${refetchResponse.voteCount}`);
      } else {
        console.error(' Failed to refetch vote count');
      }
    } catch (error) {
      console.error(' Error voting for complaint:', error);
      // Revert changes if API call errors
      const revertedComplaints = [...complaints];
      revertedComplaints[complaintIndex] = complaint;
      setComplaints(revertedComplaints);
    }
  };

  // New function to fetch a specific complaint's details if we have image loading issues
  const fetchComplaintDetails = async (complaintId) => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/complaints/${complaintId}`,
        { method: 'GET' }
      );
      
      if (response.success && response.complaint) {
        console.log('Fetched detailed complaint data:', response.complaint);
        
        // Update the complaint in our state with more detailed info
        const updatedComplaints = [...complaints];
        const complaintIndex = updatedComplaints.findIndex(c => c.id === complaintId);
        
        if (complaintIndex > -1) {
          // Process image URLs from the detailed response
          let imageUrls = [];
          const complaint = response.complaint;
          
          // Extract image URLs with the same logic as in fetchNearbyComplaints
          if (complaint.image_urls && Array.isArray(complaint.image_urls) && complaint.image_urls.length > 0) {
            imageUrls = [...complaint.image_urls];
          } else if (complaint.image_urls && typeof complaint.image_urls === 'string') {
            try {
              const parsedUrls = JSON.parse(complaint.image_urls);
              if (Array.isArray(parsedUrls)) {
                imageUrls = [...parsedUrls];
              } else if (typeof parsedUrls === 'string') {
                imageUrls = [parsedUrls];
              } else if (parsedUrls && typeof parsedUrls === 'object') {
                imageUrls = Object.values(parsedUrls).filter(url => url && typeof url === 'string');
              }
            } catch (error) {
              if (complaint.image_urls.includes('http')) {
                imageUrls = [complaint.image_urls];
              }
            }
          } else if (complaint.image_url && typeof complaint.image_url === 'string') {
            imageUrls = [complaint.image_url];
          } else if (complaint.imageUrl && typeof complaint.imageUrl === 'string') {
            imageUrls = [complaint.imageUrl];
          } else if (complaint.images && Array.isArray(complaint.images) && complaint.images.length > 0) {
            imageUrls = [...complaint.images];
          }
          
          // Process the URLs to ensure they're valid
          const processedImageUrls = imageUrls
            .filter(url => url && typeof url === 'string' && url.trim() !== '')
            .map(url => {
              const trimmedUrl = url.trim();
              if (trimmedUrl.startsWith('http:')) {
                return trimmedUrl.replace('http:', 'https:');
              }
              if (!trimmedUrl.startsWith('http')) {
                if (trimmedUrl.startsWith('//')) {
                  return `https:${trimmedUrl}`;
                }
                return `https://${trimmedUrl}`;
              }
              return trimmedUrl;
            });
          
          // Update the complaint with new data
          updatedComplaints[complaintIndex] = {
            ...updatedComplaints[complaintIndex],
            ...response.complaint,
            image_urls: processedImageUrls
          };
          
          // Reset error state if we have new images
          if (processedImageUrls.length > 0) {
            setImageLoadErrors(prev => ({...prev, [complaintId]: false}));
          }
          
          setComplaints(updatedComplaints);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error(` Error fetching complaint details for ID ${complaintId}:`, error);
      return false;
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'road_damage':
        return <MaterialCommunityIcons name="road-variant" size={18} color="#ff9800" />;
      case 'pothole':
        return <FontAwesome5 name="dot-circle" size={16} color="#f44336" />;
      case 'water_issue':
        return <Ionicons name="water" size={18} color="#2196f3" />;
      case 'sewage_overflow':
        return <MaterialCommunityIcons name="water-pump" size={18} color="#795548" />;
      case 'garbage':
        return <MaterialCommunityIcons name="delete" size={18} color="#8bc34a" />;
      case 'streetlight':
        return <Ionicons name="flashlight" size={18} color="#ffc107" />;
      case 'electricity':
        return <Ionicons name="flash" size={18} color="#ffeb3b" />;
      case 'tree_issue':
        return <MaterialCommunityIcons name="tree" size={18} color="#4caf50" />;
      case 'flooding':
        return <MaterialCommunityIcons name="home-flood" size={18} color="#03a9f4" />;
      default:
        return <MaterialCommunityIcons name="alert-circle" size={18} color="#9e9e9e" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#1A1A1A';
      case 'in_progress':
        return '#1A1A1A';
      case 'resolved':
        return '#1A1A1A';
      case 'rejected':
        return '#1A1A1A';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusGradient = (status) => {
    switch (status) {
      case 'pending':
        return ['#1A1A1A', '#1A1A1A'];
      case 'in_progress':
        return ['#1A1A1A', '#1A1A1A'];
      case 'resolved':
        return ['#1A1A1A', '#1A1A1A'];
      case 'rejected':
        return ['#1A1A1A', '#1A1A1A'];
      default:
        return ['#1A1A1A', '#1A1A1A'];
    }
  };

  const handleMoreButtonPress = (complaint) => {
    Alert.alert(
      'Complaint Options',
      'What would you like to do?',
      [
        {
          text: 'View Details',
          onPress: () => navigation.navigate('ComplaintDetail', { complaintId: complaint.id }),
          style: 'default'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ],
      { cancelable: true }
    );
  };

  const renderHeader = () => {
    return (
      <View>
        <WeatherWidget />
        <View style={styles.storiesContainer}>
          <ScrollView 
            horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScrollView}
        >
          {/* New Report Button (Like Instagram's "+" story) */}
          <TouchableOpacity 
            style={styles.storyButton}
            onPress={() => navigation.navigate('SubmitComplaint')}
          >
            <View style={styles.storyAdd}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
            <Text style={styles.storyText}>New Report</Text>
          </TouchableOpacity>
          
          {/* Quick actions */}
          <TouchableOpacity 
            style={styles.storyItem}
            onPress={() => navigation.navigate('ComplaintMap')}
          >
            <LinearGradient
              colors={['#374151', '#1A1A1A']}
              style={styles.storyRing}
            >
              <View style={styles.storyIcon}>
                <Ionicons name="map" size={22} color="#fff" />
              </View>
            </LinearGradient>
            <Text style={styles.storyText}>Map</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.storyItem}
            onPress={() => navigation.navigate('CitizenTransparency')}
          >
            <LinearGradient
              colors={['#6B7280', '#374151']}
              style={styles.storyRing}
            >
              <View style={styles.storyIcon}>
                <Ionicons name="bar-chart" size={22} color="#fff" />
              </View>
            </LinearGradient>
            <Text style={styles.storyText}>Stats</Text>
          </TouchableOpacity>

          {/* Dynamic stories from categories */}
          {['water_issue', 'road_damage', 'garbage', 'tree_issue'].map((category, index) => (
            <TouchableOpacity 
              key={category}
              style={styles.storyItem}
              onPress={() => {
                // Future feature: Filter by category
                Alert.alert("Coming Soon", "Filter by category will be available soon");
              }}
            >
              <LinearGradient
                colors={index % 2 === 0 ? ['#374151', '#111827'] : ['#6B7280', '#374151']}
                style={styles.storyRing}
              >
                <View style={styles.storyIcon}>
                  {getCategoryIcon(category)}
                </View>
              </LinearGradient>
              <Text style={styles.storyText}>
                {category.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        </View>
      </View>
    );
  };

  // Function to render complaint image with proper fallback handling
  const renderComplaintImage = (item) => {
    const imageUrl = item.image_urls && item.image_urls.length > 0 ? item.image_urls[0] : null;
    
    if (!imageUrl) {
      // No image URL available, show placeholder
      return (
        <View style={[styles.postImage, styles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={60} color="#ccc" />
          <Text style={styles.placeholderText}>No Image Available</Text>
        </View>
      );
    }

    // Check if it's a local file URL that can't be displayed
    if (imageUrl.startsWith('file:///')) {
      console.log(`Local file URL cannot be displayed for complaint ${item.id}, showing placeholder`);
      return (
        <View style={[styles.postImage, styles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={60} color="#95a5a6" />
          <Text style={styles.placeholderText}>Local Image Not Available</Text>
        </View>
      );
    }

    // For valid HTTP/HTTPS URLs (especially Cloudinary)
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      let finalImageUrl = imageUrl;
      
      // If it's a Cloudinary URL, optimize it for mobile display
      if (imageUrl.includes('cloudinary.com')) {
        // Add Cloudinary transformations for better performance
        finalImageUrl = imageUrl.replace('/upload/', '/upload/c_fill,w_400,h_400,q_auto,f_auto/');
        console.log(`Optimized Cloudinary URL for complaint ${item.id}:`, finalImageUrl);
      }
      
      return (
        <Image 
          source={{ 
            uri: finalImageUrl,
            cache: 'force-cache'
          }}
          style={styles.postImage}
          resizeMode="cover"
          onLoadStart={() => console.log(`Started loading image for complaint ${item.id}: ${finalImageUrl}`)}
          onLoad={() => console.log(`Successfully loaded image for complaint ${item.id}`)}
          onError={(e) => {
            console.log(`Image loading error for complaint ${item.id}:`, e.nativeEvent.error);
            
            // Try a different Cloudinary optimization or fallback
            if (imageUrl.includes('cloudinary.com') && !imageLoadErrors[item.id]) {
              console.log(`Retrying with basic Cloudinary URL for complaint ${item.id}`);
              setImageLoadErrors(prev => ({ ...prev, [item.id]: 'retrying' }));
              
              // Try the original URL without transformations
              setTimeout(() => {
                const updatedComplaints = [...complaints];
                const complaintIndex = updatedComplaints.findIndex(c => c.id === item.id);
                
                if (complaintIndex > -1) {
                  updatedComplaints[complaintIndex] = {
                    ...updatedComplaints[complaintIndex],
                    image_urls: [imageUrl] // Use original URL
                  };
                  setComplaints(updatedComplaints);
                  setImageLoadErrors(prev => ({ ...prev, [item.id]: false }));
                }
              }, 1000);
              
              return;
            }
            
            // Mark as failed - will show placeholder
            console.log(`Image failed to load for complaint ${item.id}`);
            setImageLoadErrors(prev => ({ ...prev, [item.id]: true }));
          }}
        />
      );
    }

    // For any other invalid URL formats
    return (
      <View style={[styles.postImage, styles.imagePlaceholder]}>
        <Ionicons name="warning-outline" size={60} color="#1A1A1A" />
        <Text style={styles.placeholderText}>Invalid Image URL</Text>
      </View>
    );
  };

  // Render function for feed items (only complaints)
  const renderFeedItem = ({ item, index }) => {
    console.log(` Rendering complaint item ${index}:`, item.data.title);
    
    // Only render complaint cards - news is shown in header
    return renderComplaintCard({ item: item.data, index });
  };

  const renderComplaintCard = ({ item, index }) => {
    // Initialize animation for this card if it doesn't exist
    if (!cardAnimations.has(item.id)) {
      cardAnimations.set(item.id, new Animated.Value(0));
      
      // Staggered entrance animation
      setTimeout(() => {
        Animated.spring(cardAnimations.get(item.id), {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }, index * 150);
    }

    // Like button animation
    const likeScale = likeAnimations.current[item.id].interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.3, 1],
    });

    const cardAnimation = cardAnimations.get(item.id);

    return (
      <Animated.View 
        style={[
          styles.modernPostContainer, 
          {
            opacity: cardAnimation,
            transform: [
              {
                translateY: cardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                })
              },
              {
                scale: cardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1],
                })
              }
            ]
          }
        ]}
      >
        {/* Modern Post Header with enhanced styling */}
        <View style={styles.modernPostHeader}>
          <View style={styles.userContainer}>
            <LinearGradient
              colors={['#374151', '#1A1A1A']}
              style={styles.modernUserAvatar}
            >
              <Text style={styles.modernUserAvatarText}>
                {item.user?.full_name ? item.user.full_name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </LinearGradient>
            <View style={styles.userInfo}>
              <Text style={styles.modernUserName}>
                {item.users?.full_name || 'Anonymous User'}
              </Text>
              <View style={styles.modernLocationContainer}>
                <Ionicons name="location" size={11} color="#666" />
                <Text style={styles.modernLocationText} numberOfLines={1}>
                  {item.location_address?.substring(0, 35) || 'Unknown location'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.postHeaderRight}>
            <LinearGradient
              colors={getStatusGradient(item.status)}
              style={styles.modernStatusBadge}
            >
              <Text style={styles.modernStatusText}>
                {item.status?.charAt(0).toUpperCase() + item.status?.slice(1).replace('_', ' ')}
              </Text>
            </LinearGradient>
            <TouchableOpacity 
              style={styles.modernMoreButton} 
              activeOpacity={0.7}
              onPress={() => handleMoreButtonPress(item)}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Post Image */}
        <View style={styles.postImageContainer}>
          {renderComplaintImage(item)}
          
          <View style={styles.categoryBadge}>
            {getCategoryIcon(item.category)}
            <Text style={styles.categoryText}>
              {item.category?.replace('_', ' ')}
            </Text>
          </View>
        </View>
        
        {/* Post Actions */}
        <View style={styles.actionsContainer}>
          <View style={styles.leftActions}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleUpvote(item.id, index)}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Ionicons 
                  name={item.userVoted ? "arrow-up-circle" : "arrow-up-circle-outline"} 
                  size={28} 
                  color={item.userVoted ? "#1A1A1A" : "#9CA3AF"} 
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Vote count */}
        <View style={styles.likesContainer}>
          <Text style={styles.likesText}>
            {item.voteCount || 0} {item.voteCount === 1 ? 'vote' : 'votes'}
          </Text>
        </View>
        
        {/* Caption */}
        <View style={styles.captionContainer}>
          <Text style={styles.captionName}>{item.users?.full_name || 'Anonymous User'}</Text>
          <Text style={styles.captionText}>{item.title}</Text>
        </View>
        
        {/* Description */}
        <TouchableOpacity 
          style={styles.descriptionContainer}
          onPress={() => navigation.navigate('ComplaintDetail', { complaintId: item.id })}
        >
          <Text style={styles.descriptionText} numberOfLines={2}>
            {item.description}
          </Text>
          {item.description && item.description.length > 80 && (
            <Text style={styles.readMore}>more</Text>
          )}
        </TouchableOpacity>
        
        {/* Time ago */}
        <Text style={styles.timeAgoText}>{item.timeAgo}</Text>
      </Animated.View>
    );
  };

  if (locationLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top, opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Modern Header with Gradient */}
      <Animated.View style={[styles.modernHeader, { opacity: headerOpacity }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(250,250,250,0.9)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.modernHeaderTitle}>CIVIC-REZO</Text>
              <Text style={styles.headerSubtitle}>Nearby Reports</Text>
            </View>
            <View style={styles.headerRight}>
              {userLocation && (
                <TouchableOpacity 
                  style={styles.modernLocationButton}
                  onPress={fetchUserLocation}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#374151', '#1A1A1A']}
                    style={styles.locationGradient}
                  >
                    <Ionicons name="locate" size={14} color="#fff" />
                    <Text style={styles.modernLocationText}>3km</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.modernIconButton}
                onPress={() => navigation.navigate('SubmitComplaint')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#1A1A1A', '#000000']}
                  style={styles.iconButtonGradient}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modernIconButton}
                onPress={() => navigation.navigate('PersonalReports')}
                activeOpacity={0.8}
              >
                <View style={styles.profileButton}>
                  <Ionicons name="person" size={18} color="#333" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
      
      {loading && !refreshing ? (
        <Animated.View style={[styles.modernLoadingContainer, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={['#374151', '#1A1A1A']}
            style={styles.loadingGradient}
          >
            <ActivityIndicator size="large" color="#fff" />
          </LinearGradient>
          <Text style={styles.modernLoadingText}>Loading nearby reports...</Text>
          <Text style={styles.loadingSubtext}>Finding issues around you</Text>
        </Animated.View>
      ) : complaints.length === 0 ? (
        <Animated.View style={[styles.modernEmptyContainer, { transform: [{ translateY: slideAnim }] }]}>
          <View
            style={[styles.emptyIconContainer, { backgroundColor: '#F3F4F6' }]}
          >
            <Ionicons name="checkmark-circle-outline" size={50} color="#9CA3AF" />
          </View>
          <Text style={styles.modernEmptyTitle}>No Reports Nearby</Text>
          <Text style={styles.modernEmptyText}>
            No issues reported within 3km.{'\n'}
            Be the first to submit a report.
          </Text>
          <TouchableOpacity 
            style={styles.modernReportButton}
            onPress={() => navigation.navigate('SubmitComplaint')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#1A1A1A', '#374151']}
              style={styles.reportButtonGradient}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.modernReportButtonText}>Report an Issue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: slideAnim }] }]}>
          <FlatList
            data={feedData}
            renderItem={renderFeedItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing || newsLoading}
                onRefresh={onRefresh}
                colors={['#1A1A1A', '#374151']}
                tintColor="#1A1A1A"
                progressBackgroundColor="#FAFAFA"
              />
            }
            contentContainerStyle={styles.flatListContainer}
            ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
            ListHeaderComponent={() => {
              console.log(' Rendering ListHeaderComponent');
              console.log(' Top news length:', topNews.length);
              console.log(' Top news:', topNews.map(n => n.headline));
              return (
              <View>
                {/* Weather Widget */}
                <WeatherWidget />
                
                {/* News Carousel */}
                {topNews.length > 0 ? (
                  <>
                    {console.log(' Rendering NewsCarousel with', topNews.length, 'items')}
                    <NewsCarousel
                      news={topNews}
                      onNewsPress={handleNewsPress}
                    />
                  </>
                ) : (
                  <>
                    {console.log('️ No top news to display')}
                    <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 10, borderRadius: 8 }}>
                      <Text style={{ textAlign: 'center', color: '#666' }}>
                        Loading Location News... (Debug: {topNews.length} news available)
                      </Text>
                    </View>
                  </>
                )}
              </View>
              );
            }}
          />
        </Animated.View>
      )}
      
      {/* Modern bottom tab bar with gradients */}
      <View style={styles.modernBottomTabBar}>
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,1)']}
          style={styles.tabBarGradient}
        >
          <TouchableOpacity 
            style={styles.modernTabButton}
            onPress={() => {/* Already on feed */}}
            activeOpacity={0.8}
          >
            <View style={styles.activeTabContainer}>
              <Ionicons name="home" size={22} color="#1A1A1A" />
              <Text style={styles.activeTabText}>Feed</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modernTabButton}
            onPress={() => navigation.navigate('ComplaintMap')}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={22} color="#9CA3AF" />
            <Text style={styles.tabText}>Map</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modernTabButton}
            onPress={() => navigation.navigate('SubmitComplaint')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#1A1A1A', '#000000']}
              style={styles.modernAddButtonContainer}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modernTabButton}
            onPress={() => navigation.navigate('CitizenTransparency')}
            activeOpacity={0.8}
          >
            <Ionicons name="stats-chart-outline" size={22} color="#9CA3AF" />
            <Text style={styles.tabText}>Stats</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modernTabButton}
            onPress={() => navigation.navigate('PersonalReports')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={22} color="#9CA3AF" />
            <Text style={styles.tabText}>Profile</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Complaint Progress Modal */}
      <ComplaintProgressModal
        visible={progressModalVisible}
        onClose={() => setProgressModalVisible(false)}
        complaintId={selectedComplaintId}
        complaintTitle={selectedComplaintTitle}
      />

      {/* ELEGANT BLUE CHATBOT BUTTON */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#1A1A1A',
          justifyContent: 'center',
          alignItems: 'center',
          elevation: 6,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          zIndex: 1000,
        }}
        onPress={() => {
          console.log('Chatbot button pressed from feed');
          navigation.navigate('CivicChatbot');
        }}
        activeOpacity={0.8}
      >
        <Ionicons 
          name="chatbubble-ellipses" 
          size={24} 
          color="#FFFFFF" 
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  
  // Modern Header Styles
  modernHeader: {
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerGradient: {
    paddingBottom: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerLeft: {
    flex: 1,
  },
  modernHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '400',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modernLocationButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  locationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modernLocationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  modernIconButton: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  iconButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Modern Loading Styles
  modernLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 40,
  },
  loadingGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modernLoadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },

  // Modern Empty State Styles
  modernEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modernEmptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  modernEmptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  modernReportButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  reportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modernReportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },

  // FlatList Container
  flatListContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cardSeparator: {
    height: 16,
  },

  // Modern Post Container
  modernPostContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },

  // Modern Post Header
  modernPostHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  modernUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modernUserAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modernUserName: {
    fontWeight: '600',
    color: '#111827',
    fontSize: 15,
    marginBottom: 2,
  },
  modernLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  modernLocationText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginLeft: 4,
    flex: 1,
  },
  modernStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  modernStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernMoreButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },

  // Modern Bottom Tab Bar
  modernBottomTabBar: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  tabBarGradient: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  modernTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  activeTabContainer: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  activeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },
  modernAddButtonContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // Legacy styles (keeping for compatibility)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Legacy styles for compatibility
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  locationButtonText: {
    color: '#333',
    fontSize: 12,
    marginLeft: 3,
    fontWeight: '500',
  },
  iconButton: {
    marginLeft: 16,
  },
  
  // Post styles (keeping minimal for compatibility)
  postContainer: {
    backgroundColor: '#fff',
    marginVertical: 4,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userInfo: {
    justifyContent: 'center',
  },
  userName: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 13,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 11,
    color: '#777',
    marginLeft: 2,
  },
  postHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  moreButton: {
    padding: 5,
  },

  // Post image
  postImageContainer: {
    width: CARD_WIDTH - 32,
    height: width - 32,
    position: 'relative',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
  },
  postImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imagePlaceholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  // Post actions
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
  },
  bookmarkButton: {},

  // Post content
  likesContainer: {
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  likesText: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 13,
  },
  captionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  captionName: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 13,
    marginRight: 6,
  },
  captionText: {
    color: '#333',
    fontSize: 13,
    flex: 1,
  },
  descriptionContainer: {
    paddingHorizontal: 12,
    marginBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  descriptionText: {
    color: '#666',
    fontSize: 13,
  },
  readMore: {
    color: '#777',
    fontSize: 13,
    marginLeft: 4,
  },
  timeAgoText: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontSize: 11,
    color: '#999',
  },

  // Legacy bottom tab bar
  bottomTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 48,
    borderTopWidth: 0.5,
    borderTopColor: '#dbdbdb',
    backgroundColor: '#fff',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  addButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading and Empty states (legacy)
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default InstagramStyleFeedScreen;
  