import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import useSocketStore from '@/store/useSocketStore';
import useUserStore from '@/store/useUserStore';
import useFriendChatStore from '@/store/useFriendChatStore';
import api from '@/utils/api';

interface Message {
  messageId?: string;
  text: string;
  sender: 'user' | 'friend';
  timestamp: number;
  seen: boolean;
}

const FriendChat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastTypingTime, setLastTypingTime] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
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
    emitMessageSeen,
    fetchChatHistory,
    sendMessage,
    reset,
    initializeListeners,
  } = useFriendChatStore();
  const navigation = useNavigation();

  const TYPING_TIMEOUT = 3000;
  const DEDUPE_WINDOW = 5000; // Increased to 5 seconds to catch larger timestamp differences

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] FriendChat: ${message}`, data || '');
  };

  useEffect(() => {
    log('FriendChat component mounted', { socketId: socket?.id });
    isMounted.current = true;
    const cleanup = initializeListeners(socket);
    return () => {
      log('FriendChat component unmounted', { socketId: socket?.id });
      isMounted.current = false;
      cleanup();
    };
  }, [socket, initializeListeners]);

  useEffect(() => {
    if (!friendId || !/^[0-9a-fA-F]{24}$/.test(friendId) || !user?._id) {
      log('Invalid friendId or userId', { friendId, userId: user?._id });
      navigateToFriends();
      return;
    }
    if (hasInitialized.current && previousFriendId.current === friendId) {
      log('Already initialized for this friendId', { friendId });
      return;
    }
    hasInitialized.current = true;
    previousFriendId.current = friendId;

    if (!socket?.connected) {
      log('Socket not connected, attempting to connect', { userId: user._id });
      connectSocket(user._id);
    }

    const initializeChat = async () => {
      try {
        log('Initializing chat', { friendId });
        const response = await api.get(`/api/users/friends/${user._id}`);
        const friend = response.data.friends.find((f: any) => f._id === friendId);
        if (!friend) {
          log('Friend not found', { friendId });
          navigateToFriends();
          return;
        }
        setPartner(friendId, friend.user_name || 'Anonymous');
        setMessages([]); // Clear messages before fetching new history
        const fetchedMessages = await fetchChatHistory(friendId);
        setMessages((prev) => {
          const existingIds = new Set(prev.map((msg) => msg.messageId));
          const existingContent = new Set(prev.map((msg) => `${msg.text}:${msg.sender}`));
          const newMessages = fetchedMessages.filter(
            (msg) => !existingIds.has(msg.messageId) && !existingContent.has(`${msg.text}:${msg.sender}`)
          );
          log('Fetched chat history', { fetchedMessages: newMessages.length, totalMessages: fetchedMessages.length });
          return [...prev, ...newMessages];
        });
        flatListRef.current?.scrollToEnd({ animated: true });
      } catch (error: any) {
        log('Error initializing chat', { error: error.message });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load friend details.' });
        navigateToFriends();
      }
    };

    initializeChat();

    return () => {
      log('Cleaning up chat', { friendId, socketId: socket?.id });
      socket?.emit('leave_friend_chat', { userId: user._id, friendId });
      setMessages([]);
      isChatInitialized.current = false;
      hasInitialized.current = false;
      previousFriendId.current = null;
    };
  }, [friendId, user?._id, socket, setPartner, fetchChatHistory, connectSocket]);

  useEffect(() => {
    if (!socket?.connected || connectionStatus !== 'connected') {
      log('Socket not connected or not in connected state', { connectionStatus, socketId: socket?.id });
      return;
    }
    startFriendChat(socket, friendId, () => {
      log('Friend chat started', { friendId, socketId: socket?.id });
      isChatInitialized.current = true;
      const roomId = [user?._id, friendId].sort().join('_');
      socket?.emit('join_room', { roomId, userId: user?._id });
    });
  }, [socket, connectionStatus, friendId, user?._id, startFriendChat]);

  useEffect(() => {
    if (!socket || !isChatInitialized.current || !partnerId) {
      log('Skipping message listeners due to invalid state', {
        socket: !!socket,
        isChatInitialized: isChatInitialized.current,
        partnerId,
        socketId: socket?.id,
      });
      return;
    }

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
      if (!isMounted.current || fromUserId === user?._id) {
        log('Ignoring message', {
          reason: !isMounted.current ? 'Component unmounted' : 'Message from self',
          fromUserId,
          socketId: socket?.id,
        });
        return;
      }
      if (fromUserId === partnerId) {
        setMessages((prev):any => {
          const existingIds = new Set(prev.map((msg) => msg.messageId));
          const existingContent = new Set(prev.map((msg) => `${msg.text}:${msg.sender}`));
          const isDuplicate =
            (messageId && existingIds.has(messageId)) ||
            existingContent.has(`${message}:friend`) ||
            prev.some(
              (msg) =>
                msg.text === message &&
                msg.sender === 'friend' &&
                Math.abs(msg.timestamp - timestamp) < DEDUPE_WINDOW
            );
          if (isDuplicate) {
            log('Duplicate message ignored', { messageId, message, timestamp, socketId: socket?.id });
            return prev;
          }
          const newMessage = { messageId, text: message, sender: 'friend', timestamp, seen: false };
          log('Adding new message from socket', { ...newMessage, socketId: socket?.id });
          flatListRef.current?.scrollToEnd({ animated: true });
          return [...prev, newMessage];
        });
        emitMessageSeen(socket, timestamp);
      } else {
        log('Message ignored, fromUserId does not match partnerId', { fromUserId, partnerId, socketId: socket?.id });
      }
    };

    const messageSeenListener = ({ fromUserId, timestamp }: { fromUserId: string; timestamp: number }) => {
      if (!isMounted.current || fromUserId !== partnerId) {
        log('Ignoring message_seen event', { fromUserId, partnerId, socketId: socket?.id });
        return;
      }
      log('Message seen', { fromUserId, timestamp, socketId: socket?.id });
      setMessages((prev) =>
        prev.map((msg) => (msg.sender === 'user' && msg.timestamp === timestamp ? { ...msg, seen: true } : msg))
      );
    };

    log('Registering socket listeners', { socketId: socket?.id });
    socket.on('receive_message', messageListener);
    socket.on('message_seen', messageSeenListener);

    return () => {
      log('Unregistering socket listeners', { socketId: socket?.id });
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
    log('Navigating to friends', { socketId: socket?.id });
    router.replace('/(tabs)/friends');
  };

  const navigateToHome = () => {
    log('Navigating to home', { socketId: socket?.id });
    reset();
    router.replace('/(tabs)/home');
  };

  const handleSendMessage = async () => {
    if (isSending) {
      log('Send message blocked, already sending', { socketId: socket?.id });
      return;
    }
    setIsSending(true);
    if (!input.trim()) {
      log('Empty message', { socketId: socket?.id });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Message cannot be empty.' });
      setIsSending(false);
      return;
    }
    const timestamp = Date.now();
    const messageId = `${user?._id}-${timestamp}`;
    const newMessage = { messageId, text: input, sender: 'user', timestamp, seen: false };
    setMessages((prev): any => [...prev, newMessage]);
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      log('Sending message', { friendId, message: input, timestamp, messageId, socketId: socket?.id });
      await sendMessage(friendId, input);
      socket?.emit('send_message', {
        toUserId: friendId,
        message: input,
        fromUserId: user?._id,
        timestamp,
        messageId,
      });
    } catch (error: any) {
      log('Error sending message', { error: error.message, socketId: socket?.id });
      setMessages((prev) => prev.filter((msg) => msg.messageId !== messageId));
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send message.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = useCallback(() => {
    if (!socket?.connected || !partnerId || !user?._id || !isChatInitialized.current) {
      log('Typing blocked', {
        socketConnected: socket?.connected,
        partnerId,
        userId: user?._id,
        isChatInitialized: isChatInitialized.current,
        socketId: socket?.id,
      });
      return;
    }
    const currentTime = Date.now();
    if (!lastTypingTime || currentTime - lastTypingTime > 1000) {
      log('Emitting typing event', { socketId: socket?.id });
      emitTyping(socket);
      setLastTypingTime(currentTime);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setLastTypingTime(null), TYPING_TIMEOUT);
  }, [socket, partnerId, user?._id, lastTypingTime, emitTyping]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === 'user';
    const isLast = index === messages.length - 1;
    const senderLabel = isUser ? '' : partnerName || 'Anonymous';
    return (
      <View className={`my-1 max-w-[80%] ${isUser ? 'self-end' : 'self-start'}`}>
        <View className={`px-4 py-2 rounded-2xl ${isUser ? 'bg-indigo-500' : 'bg-gray-700'} shadow-md`}>
          {!isUser && <Text className="text-white text-sm font-bold mb-1">{senderLabel}</Text>}
          <Text className="text-white text-base">{item.text}</Text>
        </View>
        <View className="flex-row justify-between">
          {isLast && <Text className="text-xs text-gray-400 mt-1 ml-1">{moment(item.timestamp).format('h:mm A')}</Text>}
          {isUser && item.seen && <Text className="text-xs text-green-400 mt-1 mr-1">Seen</Text>}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-[#1C1C3A]">
        <View className="flex-row items-center justify-between px-4 pt-5 pb-4 border-b border-b-gray-700 bg-[#1C1C3A] z-10">
          <TouchableOpacity onPress={navigateToFriends}>
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold">
            Chatting with {partnerName || 'Friend'} {connectionStatus === 'disconnected' ? '(Reconnecting...)' : ''}
          </Text>
          <TouchableOpacity onPress={navigateToHome}>
            <Ionicons name="home-outline" size={28} color="white" />
          </TouchableOpacity>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.messageId || `${item.timestamp}-${item.sender}`}
          renderItem={renderMessage}
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        {isPartnerTyping && <Text className="text-gray-400 text-sm px-4 pb-1">Typing...</Text>}
        <View className="flex-row items-center bg-gray-800 rounded-xl p-2 mx-4 mb-4">
          <TextInput
            value={input}
            onChangeText={(text) => {
              setInput(text);
              handleTyping();
            }}
            placeholder="Type your message"
            placeholderTextColor="#ccc"
            className="flex-1 text-white px-3"
            editable={connectionStatus !== 'disconnected'}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={isSending || connectionStatus === 'disconnected'}
            className={`ml-2 bg-indigo-500 px-4 py-2 rounded-xl ${isSending || connectionStatus === 'disconnected' ? 'opacity-50' : ''}`}
          >
            <Text className="text-white font-semibold">Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default FriendChat;