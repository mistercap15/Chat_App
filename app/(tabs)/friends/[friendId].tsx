import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeft, Send } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import useSocketStore from '@/store/useSocketStore';
import useUserStore from '@/store/useUserStore';
import useFriendChatStore from '@/store/useFriendChatStore';
import useUnreadStore from '@/store/useUnreadStore';
import api from '@/utils/api';

interface Message {
  messageId?: string;
  backendMessageId?: string;
  text: string;
  sender: 'user' | 'friend';
  timestamp: number;
  seen: boolean;
}

const TypingDots = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    animate(dot1, 0).start();
    animate(dot2, 200).start();
    animate(dot3, 400).start();
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4 }}>
      <View style={{
        backgroundColor: '#1E1E45',
        borderRadius: 16,
        borderTopLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: '#7C3AED',
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            }}
          />
        ))}
      </View>
    </View>
  );
};

const FriendChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastTypingTime, setLastTypingTime] = useState<number | null>(null);
  const lastSentRef = useRef<{ text: string; time: number } | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isChatInitialized = useRef(false);
  const hasInitialized = useRef(false);
  const isMounted = useRef(true);
  const previousFriendId = useRef<string | null>(null);

  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { socket, connectionStatus, connectSocket } = useSocketStore();
  const { user } = useUserStore();
  const {
    partnerId,
    partnerName,
    isPartnerTyping,
    setPartnerTyping,
    setPartner,
    startFriendChat,
    emitTyping,
    emitStopTyping,
    emitMessageSeen,
    fetchChatHistory,
    sendMessage,
    reset,
    initializeListeners,
  } = useFriendChatStore();

  const TYPING_TIMEOUT = 3000;
  const DEDUPE_WINDOW = 2000;

  useEffect(() => {
    isMounted.current = true;
    const cleanup = initializeListeners(socket);
    return () => {
      isMounted.current = false;
      cleanup();
    };
  }, [socket, initializeListeners]);

  // Track which friend chat is active so unread counts are suppressed
  useEffect(() => {
    if (friendId && /^[0-9a-fA-F]{24}$/.test(friendId)) {
      useUnreadStore.getState().setActiveChatFriendId(friendId);
      useUnreadStore.getState().clearUnread(friendId);
    }
    return () => {
      useUnreadStore.getState().setActiveChatFriendId(null);
    };
  }, [friendId]);

  useEffect(() => {
    if (!friendId || !/^[0-9a-fA-F]{24}$/.test(friendId) || !user?._id) {
      navigateToFriends();
      return;
    }
    if (hasInitialized.current && previousFriendId.current === friendId) return;
    hasInitialized.current = true;
    previousFriendId.current = friendId;

    if (!socket?.connected) {
      connectSocket(user._id);
    }

    const initializeChat = async () => {
      try {
        const response = await api.get('/api/users/me/friends');
        const friend = response.data.friends.find((f: any) => f._id === friendId);
        if (!friend) {
          navigateToFriends();
          return;
        }
        setPartner(friendId, friend.user_name || 'Anonymous');
        setMessages([]);
        const fetchedMessages = await fetchChatHistory(friendId);
        setMessages((prev) => {
          const existingIds = new Set(prev.map((msg) => msg.backendMessageId || msg.messageId).filter(Boolean));
          const newMessages = fetchedMessages
            .filter((msg) => !existingIds.has(msg.messageId))
            .map((msg) => ({ ...msg, backendMessageId: msg.messageId }));
          return [...prev, ...newMessages];
        });
        flatListRef.current?.scrollToEnd({ animated: true });
      } catch (error: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat.' });
        navigateToFriends();
      }
    };

    initializeChat();

    return () => {
      socket?.emit('leave_friend_chat', { userId: user._id, friendId });
      setMessages([]);
      isChatInitialized.current = false;
      hasInitialized.current = false;
      previousFriendId.current = null;
    };
  }, [friendId, user?._id, socket, setPartner, fetchChatHistory, connectSocket]);

  useEffect(() => {
    if (!socket?.connected || connectionStatus !== 'connected') return;
    // Room joining is handled server-side by start_friend_chat.
    startFriendChat(socket, friendId, () => {
      isChatInitialized.current = true;
    });
  }, [socket, connectionStatus, friendId, user?._id, startFriendChat]);

  useEffect(() => {
    if (!socket || !partnerId) return;

    const messageListener = ({
      message,
      fromUserId,
      timestamp,
      messageId,
    }: {
      message: string;
      fromUserId: string;
      timestamp: number;
      messageId?: string;
    }) => {
      if (!isMounted.current || fromUserId === user?._id) return;
      if (fromUserId === partnerId) {
        setMessages((prev): any => {
          const existingIds = new Set(prev.map((msg) => msg.backendMessageId || msg.messageId).filter(Boolean));
          const isDuplicate =
            (messageId && existingIds.has(messageId)) ||
            prev.some(
              (msg) =>
                msg.text === message &&
                msg.sender === 'friend' &&
                Math.abs(msg.timestamp - timestamp) < DEDUPE_WINDOW
            );
          if (isDuplicate) return prev;
          const newMessage: Message = { messageId, backendMessageId: messageId, text: message, sender: 'friend', timestamp, seen: false };
          flatListRef.current?.scrollToEnd({ animated: true });
          return [...prev, newMessage];
        });
        emitMessageSeen(socket, timestamp, messageId);
      }
    };

    const messageSeenListener = ({ fromUserId, timestamp, messageId }: { fromUserId: string; timestamp: number; messageId?: string }) => {
      if (!isMounted.current || fromUserId !== partnerId) return;
      setMessages((prev) => {
        // 1) Try matching by backendMessageId (most reliable — backend's _id)
        if (messageId) {
          const updated = prev.map((msg) =>
            msg.sender === 'user' && !msg.seen && msg.backendMessageId === messageId
              ? { ...msg, seen: true }
              : msg
          );
          if (updated.some((msg, i) => msg !== prev[i])) return updated;
        }
        // 2) Try exact client timestamp match (works for random-chat style flows)
        const byTimestamp = prev.map((msg) =>
          msg.sender === 'user' && !msg.seen && msg.timestamp === timestamp
            ? { ...msg, seen: true }
            : msg
        );
        if (byTimestamp.some((msg, i) => msg !== prev[i])) return byTimestamp;
        // 3) Fallback: mark the oldest unseen user message (handles server-time drift)
        let marked = false;
        return prev.map((msg) => {
          if (!marked && msg.sender === 'user' && !msg.seen) {
            marked = true;
            return { ...msg, seen: true };
          }
          return msg;
        });
      });
    };

    socket.on('receive_message', messageListener);
    socket.on('message_seen', messageSeenListener);

    return () => {
      socket.off('receive_message', messageListener);
      socket.off('message_seen', messageSeenListener);
    };
  }, [socket, partnerId, user?._id, emitMessageSeen]);

  useEffect(() => {
    if (isPartnerTyping) {
      const timeout = setTimeout(() => setPartnerTyping(false), TYPING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [isPartnerTyping, setPartnerTyping]);

  const navigateToFriends = () => {
    router.replace('/(tabs)/friends');
  };

  const handleSendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Prevent double-tap sending the exact same message within 500ms
    const now = Date.now();
    if (lastSentRef.current && lastSentRef.current.text === trimmed && now - lastSentRef.current.time < 500) return;
    lastSentRef.current = { text: trimmed, time: now };

    const timestamp = now;
    const clientMessageId = `${user?._id}-${timestamp}`;
    const newMessage: Message = { messageId: clientMessageId, text: trimmed, sender: 'user', timestamp, seen: false };
    setMessages((prev) => [...prev, newMessage]);
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      // HTTP sendMessage saves to DB and emits receive_message to the socket room.
      // Do NOT also emit send_message via socket — that causes double delivery.
      const result = await sendMessage(friendId, trimmed);
      // Update local message with backend's _id so message_seen can match it
      if (result?.messageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === clientMessageId
              ? { ...msg, backendMessageId: result.messageId, timestamp: result.timestamp || msg.timestamp }
              : msg
          )
        );
      }
    } catch (error: any) {
      setMessages((prev) => prev.filter((msg) => msg.messageId !== clientMessageId));
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send message.' });
    }
  };

  const handleTyping = useCallback(() => {
    if (!socket?.connected || !partnerId || !user?._id || !isChatInitialized.current) return;
    const currentTime = Date.now();
    if (!lastTypingTime || currentTime - lastTypingTime > 1000) {
      emitTyping(socket);
      setLastTypingTime(currentTime);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setLastTypingTime(null);
      emitStopTyping(socket);
    }, TYPING_TIMEOUT);
  }, [socket, partnerId, user?._id, lastTypingTime, emitTyping, emitStopTyping]);

  const getInitial = () => (partnerName || 'F').charAt(0).toUpperCase();

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === 'user';
    const showTimestamp = index === messages.length - 1 ||
      messages[index + 1]?.sender !== item.sender ||
      (messages[index + 1]?.timestamp - item.timestamp > 60000);

    return (
      <View style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        marginVertical: 2,
        marginHorizontal: 4,
      }}>
        <View style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderTopRightRadius: isUser ? 4 : 18,
          borderTopLeftRadius: isUser ? 18 : 4,
          backgroundColor: isUser ? '#7C3AED' : '#1E1E45',
        }}>
          <Text style={{ color: 'white', fontSize: 15, lineHeight: 20 }}>{item.text}</Text>
        </View>
        {showTimestamp && (
          <View style={{
            flexDirection: 'row',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            alignItems: 'center',
            marginTop: 3,
            paddingHorizontal: 4,
            gap: 6,
          }}>
            <Text style={{ fontSize: 11, color: '#64648F' }}>
              {moment(item.timestamp).format('h:mm A')}
            </Text>
            {isUser && (
              <Ionicons
                name={item.seen ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.seen ? "#7C3AED" : "#64648F"}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: '#0F0F2D' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(124, 58, 237, 0.1)',
        }}>
          <TouchableOpacity onPress={navigateToFriends} style={{ padding: 4 }}>
            <ChevronLeft size={24} color="#7C3AED" />
          </TouchableOpacity>
          <View style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(124, 58, 237, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
            marginRight: 10,
          }}>
            <Text style={{ color: '#7C3AED', fontSize: 14, fontWeight: '700' }}>{getInitial()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{partnerName || 'Friend'}</Text>
            <Text style={{ color: connectionStatus === 'disconnected' ? '#F59E0B' : '#22C55E', fontSize: 11 }}>
              {connectionStatus === 'disconnected' ? 'Reconnecting...' : 'Online'}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.messageId || `${item.timestamp}-${item.sender}`}
          renderItem={renderMessage}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <Ionicons name="chatbubbles-outline" size={48} color="#2A2A5A" />
              <Text style={{ color: '#64648F', fontSize: 14, marginTop: 12 }}>Start your conversation!</Text>
            </View>
          }
        />

        {/* Typing Indicator */}
        {isPartnerTyping && <TypingDots />}

        {/* Input Area */}
        <View style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          paddingBottom: Platform.OS === 'ios' ? 4 : 8,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#161638',
            borderRadius: 24,
            paddingHorizontal: 6,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: input.trim() ? 'rgba(124, 58, 237, 0.3)' : 'rgba(124, 58, 237, 0.08)',
          }}>
            <TextInput
              value={input}
              onChangeText={(text) => {
                setInput(text);
                handleTyping();
              }}
              placeholder="Type a message..."
              placeholderTextColor="#64648F"
              style={{
                flex: 1,
                color: 'white',
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
              }}
              editable={connectionStatus !== 'disconnected'}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={connectionStatus === 'disconnected' || !input.trim()}
              activeOpacity={0.7}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: input.trim() ? '#7C3AED' : 'rgba(124, 58, 237, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={17} color={input.trim() ? 'white' : '#64648F'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default FriendChat;