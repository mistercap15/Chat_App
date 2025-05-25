import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';
import useSocketStore from '@/store/useSocketStore';
import useUserStore from '@/store/useUserStore';
import { router, useLocalSearchParams } from 'expo-router';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';

interface Message {
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
  const navigation = useNavigation();
  const {
    socket,
    userId,
    friendPartnerId,
    setFriendPartnerId,
    friendPartnerName,
    setFriendPartnerName,
    isPartnerTyping,
    setPartnerTyping,
    emitTyping,
    emitMessageSeen,
    connectionStatus,
    startFriendChat,
    connectSocket,
    friendChatType,
    resetFriendChatState,
  } = useSocketStore();
  const { user } = useUserStore();

  const TYPING_TIMEOUT = 3000;
  const DEDUPE_WINDOW = 1000;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      console.log(`[${new Date().toISOString()}] FriendChat: Component unmounted`);
    };
  }, []);

  useEffect(() => {
    if (!friendId || !/^[0-9a-fA-F]{24}$/.test(friendId) || !userId) {
      console.warn(`[${new Date().toISOString()}] FriendChat: Invalid friendId or userId`, { friendId, userId });
      navigateToFriends();
      return;
    }

    // Prevent reinitialization if friendId hasn't changed
    if (hasInitialized.current && previousFriendId.current === friendId) {
      console.log(`[${new Date().toISOString()}] FriendChat: Already initialized for this friend, skipping`, { friendId });
      return;
    }

    hasInitialized.current = true;
    previousFriendId.current = friendId;

    console.log(`[${new Date().toISOString()}] FriendChat: Initializing friend chat`, { userId, friendId });

    // Ensure socket is connected before proceeding
    if (!socket?.connected) {
      console.log(`[${new Date().toISOString()}] FriendChat: Socket not connected, connecting`, { userId });
      connectSocket(userId);
    }

    const fetchFriendDetails = async () => {
      try {
        const response = await api.get(`/api/users/friends/${userId}`);
        const friend = response.data.friends.find((f: any) => f._id === friendId);
        if (!friend) {
          console.warn(`[${new Date().toISOString()}] FriendChat: Friend not found`, { friendId });
          navigateToFriends();
          return;
        }
        setFriendPartnerId(friendId, 'friend');
        setFriendPartnerName(friend.user_name || 'Anonymous');
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] FriendChat: Error fetching friend details`, error.message);
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load friend details.' });
        navigateToFriends();
      }
    };

    const fetchChatHistory = async () => {
      try {
        const response = await api.get(`/api/chats/${userId}/${friendId}`);
        const fetchedMessages = response.data.messages.map((msg: any) => ({
          text: msg.text,
          sender: msg.senderId === userId ? 'user' : 'friend',
          timestamp: new Date(msg.timestamp).getTime(),
          seen: msg.seen,
        }));
        setMessages(fetchedMessages);
        console.log(`[${new Date().toISOString()}] FriendChat: Chat history loaded`, { messageCount: fetchedMessages.length });
        flatListRef.current?.scrollToEnd({ animated: true });
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] FriendChat: Error fetching chat history`, error.message);
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat history.' });
      }
    };

    fetchFriendDetails();
    fetchChatHistory();

    return () => {
      console.log(`[${new Date().toISOString()}] FriendChat: Cleaning up`);
      socket?.emit('leave_friend_chat', { userId, friendId });
      setFriendPartnerId(null, 'friend');
      setFriendPartnerName(null);
      setMessages([]);
      isChatInitialized.current = false;
      hasInitialized.current = false;
      previousFriendId.current = null;
    };
  }, [friendId, userId, socket, startFriendChat, setFriendPartnerId, setFriendPartnerName, connectSocket]);

  useEffect(() => {
    if (!socket?.connected || connectionStatus !== 'connected') {
      console.log(`[${new Date().toISOString()}] FriendChat: Waiting for socket connection`, { connectionStatus });
      return;
    }

    const initializeChat = () => {
      startFriendChat(friendId, () => {
        isChatInitialized.current = true;
        const roomId = [userId, friendId].sort().join('_');
        socket?.emit('join_room', { roomId, userId });
        console.log(`[${new Date().toISOString()}] FriendChat: Friend chat started, joined room`, { roomId });
      });
    };

    initializeChat();
  }, [socket, connectionStatus, friendId, userId, startFriendChat]);

  useEffect(() => {
    if (!socket || !isChatInitialized.current || !friendPartnerId || friendChatType !== 'friend') {
      console.log(`[${new Date().toISOString()}] FriendChat: Socket or chat not initialized, or not a friend chat, skipping event listeners`, { socketConnected: socket?.connected, isChatInitialized: isChatInitialized.current, friendPartnerId, friendChatType });
      return;
    }

    const messageListener = ({ message, fromUserId, timestamp }: { message: string; fromUserId: string; timestamp: number }) => {
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] FriendChat: Received message`, { fromUserId, message, timestamp });
      if (fromUserId === userId) {
        console.log(`[${new Date().toISOString()}] FriendChat: Ignored own message`, { message, timestamp });
        return;
      }
      if (fromUserId === friendPartnerId) {
        setMessages((prev: any) => {
          const recentMessages = prev.filter((msg: any) => Math.abs(msg.timestamp - timestamp) < DEDUPE_WINDOW);
          if (recentMessages.some((msg: any) => msg.text === message && msg.sender === 'friend')) {
            console.log(`[${new Date().toISOString()}] FriendChat: Ignored duplicate message`, { message, timestamp });
            return prev;
          }
          const newMessage = { text: message, sender: 'friend', timestamp, seen: false };
          console.log(`[${new Date().toISOString()}] FriendChat: Added friend message`, { message, timestamp });
          flatListRef.current?.scrollToEnd({ animated: true });
          return [...prev, newMessage];
        });
        emitMessageSeen(timestamp, true);
      } else {
        console.warn(`[${new Date().toISOString()}] FriendChat: Message ignored: from ${fromUserId}, expected partnerId ${friendPartnerId}`);
      }
    };

    const partnerDisconnectedListener = ({ disconnectedUserId }: { disconnectedUserId: string }) => {
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] FriendChat: Partner disconnected`, { disconnectedUserId });
      if (disconnectedUserId === friendPartnerId) {
        Toast.show({ type: 'info', text1: 'Friend Offline', text2: `${friendPartnerName || 'Friend'} has disconnected.` });
      }
    };

    const messageSeenListener = ({ fromUserId, timestamp }: { fromUserId: string; timestamp: number }) => {
      if (!isMounted.current) return;
      if (fromUserId === friendPartnerId) {
        console.log(`[${new Date().toISOString()}] FriendChat: Message seen by friend`, { timestamp });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender === 'user' && msg.timestamp === timestamp ? { ...msg, seen: true } : msg
          )
        );
      }
    };

    const friendRemovedListener = ({ removedUserId }: { removedUserId: string }) => {
      if (!isMounted.current) return;
      if (removedUserId === friendPartnerId) {
        console.log(`[${new Date().toISOString()}] FriendChat: Friend removed`, { removedUserId });
        Toast.show({ type: 'info', text1: 'Friend Removed', text2: 'This friend has been removed.' });
        navigateToFriends();
      }
    };

    socket.on('receive_message', messageListener);
    socket.on('partner_disconnected', partnerDisconnectedListener);
    socket.on('message_seen', messageSeenListener);
    socket.on('friend_removed', friendRemovedListener);

    return () => {
      console.log(`[${new Date().toISOString()}] FriendChat: Cleaning up socket listeners`);
      socket.off('receive_message', messageListener);
      socket.off('partner_disconnected', partnerDisconnectedListener);
      socket.off('message_seen', messageSeenListener);
      socket.off('friend_removed', friendRemovedListener);
    };
  }, [socket, friendPartnerId, friendPartnerName, userId, emitMessageSeen, connectionStatus, friendChatType]);

  useEffect(() => {
    if (isPartnerTyping) {
      const timeout = setTimeout(() => {
        setPartnerTyping(false);
      }, TYPING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [isPartnerTyping, setPartnerTyping]);

  const navigateToFriends = () => {
    console.log(`[${new Date().toISOString()}] FriendChat: Navigating to friends list`);
    router.replace('/(tabs)/friends');
  };

  const navigateToHome = () => {
    console.log(`[${new Date().toISOString()}] FriendChat: Navigating to home`);
    resetFriendChatState();
    router.replace('/(tabs)/home');
  };

  const sendMessage = async () => {
    if (isSending) {
      console.warn(`[${new Date().toISOString()}] FriendChat: Send message aborted: Previous send in progress`);
      return;
    }
    setIsSending(true);

    if (!input.trim()) {
      console.warn(`[${new Date().toISOString()}] FriendChat: Cannot send message: Empty input`);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Message cannot be empty.' });
      setIsSending(false);
      return;
    }

    if (!userId || !friendId || !socket?.connected) {
      console.warn(`[${new Date().toISOString()}] FriendChat: Cannot send message: Invalid state`, { userId, friendId, socketConnected: socket?.connected });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Chat is not properly initialized.' });
      setIsSending(false);
      return;
    }

    const timestamp = Date.now();
    const newMessage = { text: input, sender: 'user', timestamp, seen: false };
    setMessages((prev: any) => [...prev, newMessage]);
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      console.log(`[${new Date().toISOString()}] FriendChat: Sending message`, { userId, friendId, message: input, timestamp });
      await api.post('/api/chats/send', {
        userId,
        friendId,
        message: input,
      });
      console.log(`[${new Date().toISOString()}] FriendChat: Message sent successfully`, { friendId, timestamp });
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] FriendChat: Error sending message`, error.message);
      setMessages((prev) => prev.filter((msg) => msg.timestamp !== timestamp));
      let errorMessage = 'Failed to send message.';
      if (error.response?.status === 403) {
        errorMessage = 'You are not friends with this user.';
        navigateToFriends();
      }
      Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = useCallback(() => {
    if (!socket?.connected || !friendPartnerId || !userId || !isChatInitialized.current) {
      console.log(`[${new Date().toISOString()}] FriendChat: Cannot emit typing`, { socketConnected: socket?.connected, friendPartnerId, userId });
      return;
    }

    const currentTime = Date.now();
    if (!lastTypingTime || currentTime - lastTypingTime > 1000) {
      emitTyping(true);
      setLastTypingTime(currentTime);
      console.log(`[${new Date().toISOString()}] FriendChat: Emitted typing event`);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setLastTypingTime(null);
    }, TYPING_TIMEOUT);
  }, [socket, friendPartnerId, userId, lastTypingTime, emitTyping]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === 'user';
    const isLast = index === messages.length - 1;
    const senderLabel = isUser ? '' : friendPartnerName || 'Anonymous';

    return (
      <View className={`my-1 max-w-[80%] ${isUser ? 'self-end' : 'self-start'}`}>
        <View
          className={`px-4 py-2 rounded-2xl ${isUser ? 'bg-indigo-500' : 'bg-gray-700'} shadow-md`}
        >
          {!isUser && (
            <Text className="text-white text-sm font-bold mb-1">{senderLabel}</Text>
          )}
          <Text className="text-white text-base">{item.text}</Text>
        </View>
        <View className="flex-row justify-between">
          {isLast && (
            <Text className="text-xs text-gray-400 mt-1 ml-1">
              {moment(item.timestamp).format('h:mm A')}
            </Text>
          )}
          {isUser && item.seen && (
            <Text className="text-xs text-green-400 mt-1 mr-1">Seen</Text>
          )}
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
            Chatting with {friendPartnerName || 'Friend'} {connectionStatus === 'disconnected' ? '(Reconnecting...)' : ''}
          </Text>
          <TouchableOpacity onPress={navigateToHome}>
            <Ionicons name="home-outline" size={28} color="white" />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
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
            onPress={() => {
              console.log(`[${new Date().toISOString()}] FriendChat: Send button pressed`);
              sendMessage();
            }}
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