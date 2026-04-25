import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeApiCall, apiClient } from '../../../config/supabase';
import { useTranslation } from '../../i18n/useTranslation';

const { width, height } = Dimensions.get('window');

const CivicChatbotScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage = {
      id: Date.now().toString(),
      text: t('chatbot.welcomeMessage'),
      isBot: true,
      timestamp: new Date(),
      type: 'welcome'
    };
    setMessages([welcomeMessage]);
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    setIsLoading(true);

    try {
      // Send message to chatbot API
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/chatbot/message`,
        {
          method: 'POST',
          body: JSON.stringify({
            message: userMessage.text,
            conversationHistory: messages.slice(-5) // Send last 5 messages for context
          })
        }
      );

      if (response.success) {
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: response.reply,
          isBot: true,
          timestamp: new Date(),
          confidence: response.confidence,
          category: response.category,
          suggestedActions: response.suggestedActions
        };

        setTimeout(() => {
          setMessages(prev => [...prev, botMessage]);
          setIsTyping(false);
          setIsLoading(false);
        }, 1000); // Simulate typing delay
      } else {
        throw new Error(response.error || t('chatbot.failedToGetResponse'));
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      
      // Fallback response with helpful information
      const fallbackMessage = {
        id: (Date.now() + 1).toString(),
        text: t('chatbot.fallbackMessage'),
        isBot: true,
        timestamp: new Date(),
        type: 'fallback'
      };

      setTimeout(() => {
        setMessages(prev => [...prev, fallbackMessage]);
        setIsTyping(false);
        setIsLoading(false);
      }, 1000);
    }
  };

  const handleQuickAction = async (action) => {
    switch (action.type) {
      case 'navigate':
        navigation.navigate(action.screen, action.params || {});
        break;
      case 'submit_complaint':
        navigation.navigate('SubmitComplaint');
        break;
      case 'view_feed':
        navigation.navigate('ComplaintFeed');
        break;
      case 'view_map':
        navigation.navigate('ComplaintMap');
        break;
      case 'personal_reports':
        navigation.navigate('PersonalReports');
        break;
      default:
        Alert.alert(t('Action'), t(action.label));
    }
  };

  const renderQuickActions = (actions) => {
    if (!actions || actions.length === 0) return null;

    return (
      <View style={styles.quickActionsContainer}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickActionButton}
            onPress={() => handleQuickAction(action)}
          >
            <Text style={styles.quickActionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderMessage = ({ item, index }) => {
    const isBot = item.isBot;
    const isWelcome = item.type === 'welcome';
    const isFallback = item.type === 'fallback';

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isBot ? styles.botMessageContainer : styles.userMessageContainer,
          { opacity: fadeAnim }
        ]}
      >
        {isBot && (
          <View style={styles.botAvatar}>
            <MaterialCommunityIcons 
              name="robot" 
              size={20} 
              color="#fff" 
            />
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isBot ? styles.botMessageBubble : styles.userMessageBubble,
          isWelcome && styles.welcomeMessageBubble,
          isFallback && styles.fallbackMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isBot ? styles.botMessageText : styles.userMessageText,
            isWelcome && styles.welcomeMessageText
          ]}>
            {item.text}
          </Text>
          
          {item.confidence && (
            <Text style={styles.confidenceText}>
              {t('chatbot.confidence')}: {Math.round(item.confidence * 100)}%
            </Text>
          )}
          
          <Text style={[
            styles.timestampText,
            isBot ? styles.botTimestamp : styles.userTimestamp
          ]}>
            {item.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
        
        {!isBot && (
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}
        
        {renderQuickActions(item.suggestedActions)}
      </Animated.View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <View style={[styles.messageContainer, styles.botMessageContainer]}>
        <View style={styles.botAvatar}>
          <MaterialCommunityIcons name="robot" size={20} color="#fff" />
        </View>
        <View style={[styles.messageBubble, styles.botMessageBubble, styles.typingBubble]}>
          <View style={styles.typingIndicator}>
            <View style={[styles.typingDot, { animationDelay: '0ms' }]} />
            <View style={[styles.typingDot, { animationDelay: '150ms' }]} />
            <View style={[styles.typingDot, { animationDelay: '300ms' }]} />
          </View>
        </View>
      </View>
    );
  };

  const quickSuggestions = [
    { text: t('chatbot.suggestions.submitComplaint'), icon: 'document-text' },
    { text: t('chatbot.suggestions.civicIssues'), icon: 'help-circle' },
    { text: t('chatbot.suggestions.voting'), icon: 'thumbs-up' },
    { text: t('chatbot.suggestions.features'), icon: 'apps' },
    { text: t('chatbot.suggestions.troubleshooting'), icon: 'construct' },
    { text: t('chatbot.suggestions.emergency'), icon: 'warning' }
  ];

  const handleQuickSuggestion = (suggestion) => {
    setInputText(suggestion.text);
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="robot" size={28} color="#fff" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t('chatbot.title')}</Text>
            <Text style={styles.headerSubtitle}>
              {isLoading ? t('chatbot.thinking') : t('chatbot.alwaysHere')}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderTypingIndicator}
      />

      {/* Quick Suggestions (shown when no messages) */}
      {messages.length <= 1 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>{t('chatbot.quickQuestions')}</Text>
          <View style={styles.suggestionsGrid}>
            {quickSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionButton}
                onPress={() => handleQuickSuggestion(suggestion)}
              >
                <Ionicons name={suggestion.icon} size={20} color="#1A1A1A" />
                <Text style={styles.suggestionText}>{suggestion.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder={t('chatbot.placeholder')}
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons 
                name="send" 
                size={20} 
                color={inputText.trim() ? "#fff" : "#ccc"} 
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#e3f2fd',
    marginTop: 2,
  },
  helpButton: {
    padding: 8,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: width * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  botMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  userMessageBubble: {
    backgroundColor: '#1A1A1A',
    borderBottomRightRadius: 4,
  },
  welcomeMessageBubble: {
    backgroundColor: '#e8f5e8',
    borderColor: '#1A1A1A',
    borderWidth: 1,
  },
  fallbackMessageBubble: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  botMessageText: {
    color: '#333',
  },
  userMessageText: {
    color: '#fff',
  },
  welcomeMessageText: {
    color: '#2d5a2d',
    fontWeight: '500',
  },
  confidenceText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  timestampText: {
    fontSize: 11,
    marginTop: 4,
  },
  botTimestamp: {
    color: '#999',
  },
  userTimestamp: {
    color: '#e3f2fd',
  },
  typingBubble: {
    paddingVertical: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1A1A1A',
    marginHorizontal: 2,
    opacity: 0.4,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginLeft: 40,
  },
  quickActionButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  quickActionText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  suggestionsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  suggestionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  suggestionText: {
    fontSize: 12,
    color: '#495057',
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f9fa',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    minHeight: 20,
    paddingVertical: 8,
  },
  sendButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: '#1A1A1A',
  },
  sendButtonInactive: {
    backgroundColor: '#e9ecef',
  },
});

export default CivicChatbotScreen;
