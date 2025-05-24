import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  BackHandler,
} from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import useSocketStore from '@/store/useSocketStore';
import useUserStore from '@/store/useUserStore';
import { router } from 'expo-router';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';

interface Message {
  text: string;
  sender: 'user' | 'partner';
  timestamp: number;
  seen: boolean;
  type?: 'friendRequestSent' | 'friendRequestReceived'; // For friend request messages
}

const Chat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastTypingTime, setLastTypingTime] = useState<number | null>(null);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [partnerLeftVisible, setPartnerLeftVisible] = useState(false);
  const [isIntentionalNavigation, setIsIntentionalNavigation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastDisconnectTime, setLastDisconnectTime] = useState<number | null>(null);
  const [partnerBio, setPartnerBio] = useState<string>(''); // State for partner's bio
  const [hasSentFriendRequest, setHasSentFriendRequest] = useState(false); // Track if user sent a friend request
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isChatInitialized = useRef(false);

  const {
    socket,
    partnerId,
    userId,
    resetState,
    username,
    partnerName,
    isPartnerTyping,
    setPartnerTyping,
    emitTyping,
    emitMessageSeen,
    friendRequest,
    connectionStatus,
  } = useSocketStore();

  const { user, setUser } = useUserStore();
  const navigation = useNavigation();
  const TYPING_TIMEOUT = 3000;
  const DISCONNECT_GRACE_PERIOD = 60000; // 1 minute
  const DEDUPE_WINDOW = 1000; // 1 second window for deduplication

  // Fetch partner's bio
  useEffect(() => {
    const fetchPartnerBio = async () => {
      if (!partnerId) {
        console.log(`[${new Date().toISOString()}] Chat: Cannot fetch bio: missing partnerId`, { partnerId });
        return;
      }
      try {
        const response = await api.get(`/api/users/${partnerId}`);
        setPartnerBio(response.data.bio || 'No bio available.');
        console.log(`[${new Date().toISOString()}] Chat: Partner bio fetched`, { partnerId, bio: response.data.bio });
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Chat: Error fetching partner bio`, error.message);
        setPartnerBio('No bio available.');
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load partner bio.',
        });
      }
    };

    fetchPartnerBio();
  }, [partnerId]);

  // Initialize random chat and join room
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] Chat: Initializing chat`, { userId, partnerId, partnerName, socketConnected: socket?.connected });
    if (partnerId && partnerName && userId && socket?.connected) {
      isChatInitialized.current = true;
      const roomId = [userId, partnerId].sort().join('-');
      socket.emit('join_room', { roomId, userId });
      console.log(`[${new Date().toISOString()}] Chat: Random chat initialized for user ${userId} with partner ${partnerId} (${partnerName}), joined room ${roomId}`);
    } else {
      console.warn(`[${new Date().toISOString()}] Chat: Random chat not initialized: missing partnerId, userId, or socket`, { partnerId, userId, partnerName, socketConnected: socket?.connected });
      navigateToHome();
    }
  }, [partnerId, partnerName, userId, socket]);

  // Handle socket events for random chat
  useEffect(() => {
    if (!socket || !isChatInitialized.current) {
      console.log(`[${new Date().toISOString()}] Chat: Socket or chat not initialized, skipping event listeners`);
      return;
    }

    const messageListener = ({ message, fromUserId, timestamp }: { message: string; fromUserId: string; timestamp: number }) => {
      console.log(`[${new Date().toISOString()}] Chat: Received message: from ${fromUserId}, to user ${userId}, partner ${partnerId}, message: ${message}, timestamp: ${timestamp}`);
      if (fromUserId === userId) {
        console.log(`[${new Date().toISOString()}] Chat: Ignored own message: ${message}, timestamp ${timestamp}`);
        return; // Ignore messages sent by the current user
      }
      if (fromUserId === partnerId) {
        setMessages((prev): any => {
          // Deduplication check: skip if a message with the same text and sender exists within the dedupe window
          const recentMessages = prev.filter((msg) => Math.abs(msg.timestamp - timestamp) < DEDUPE_WINDOW);
          if (recentMessages.some((msg) => msg.text === message && msg.sender === 'partner')) {
            console.log(`[${new Date().toISOString()}] Chat: Ignored duplicate message: ${message}, timestamp ${timestamp}`);
            return prev;
          }
          const newMessage = { text: message, sender: 'partner', timestamp, seen: false };
          console.log(`[${new Date().toISOString()}] Chat: Added partner message: ${message}, timestamp ${timestamp}`);
          flatListRef.current?.scrollToEnd({ animated: true });
          return [...prev, newMessage];
        });
        emitMessageSeen(timestamp);
      } else {
        console.warn(`[${new Date().toISOString()}] Chat: Message ignored: from ${fromUserId}, expected partnerId ${partnerId}`);
      }
    };

    const partnerDisconnectedListener = ({ disconnectedUserId }: { disconnectedUserId: string }) => {
      console.log(`[${new Date().toISOString()}] Chat: Partner disconnected event received: ${disconnectedUserId}`);
      if (disconnectedUserId === partnerId) {
        const now = Date.now();
        if (lastDisconnectTime && now - lastDisconnectTime < DISCONNECT_GRACE_PERIOD) {
          console.log(`[${new Date().toISOString()}] Chat: Ignoring partner disconnect within grace period`, { lastDisconnectTime, now });
          return;
        }
        setLastDisconnectTime(now);
        setPartnerLeftVisible(true);
      }
    };

    const messageSeenListener = ({ fromUserId, timestamp }: { fromUserId: string; timestamp: number }) => {
      if (fromUserId === partnerId) {
        console.log(`[${new Date().toISOString()}] Chat: Message seen by partner: timestamp ${timestamp}`);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender === 'user' && msg.timestamp === timestamp ? { ...msg, seen: true } : msg
          )
        );
      }
    };

    const friendRequestListener = ({ fromUserId, fromUsername }: { fromUserId: string; fromUsername: string }) => {
      console.log(`[${new Date().toISOString()}] Chat: Friend request received`, { fromUserId, fromUsername });
      if (fromUserId === partnerId) {
        setMessages((prev) => [
          ...prev,
          {
            text: `Friend request received from ${fromUsername || 'Anonymous'}`,
            sender: 'partner',
            timestamp: Date.now(),
            seen: false,
            type: 'friendRequestReceived',
          },
        ]);
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    };

    socket.on('receive_message', messageListener);
    socket.on('partner_disconnected', partnerDisconnectedListener);
    socket.on('message_seen', messageSeenListener);
    socket.on('friend_request_received', friendRequestListener);

    return () => {
      console.log(`[${new Date().toISOString()}] Chat: Cleaning up socket listeners`);
      socket.off('receive_message', messageListener);
      socket.off('partner_disconnected', partnerDisconnectedListener);
      socket.off('message_seen', messageSeenListener);
      socket.off('friend_request_received', friendRequestListener);
    };
  }, [socket, partnerId, userId, emitMessageSeen, lastDisconnectTime]);

  // Handle partner typing timeout
  useEffect(() => {
    if (isPartnerTyping) {
      const timeout = setTimeout(() => {
        setPartnerTyping(false);
      }, TYPING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [isPartnerTyping, setPartnerTyping]);

  // Handle back navigation
  useFocusEffect(
    useCallback(() => {
      const beforeRemoveListener = (e: any) => {
        if (partnerLeftVisible || isIntentionalNavigation) {
          console.log(`[${new Date().toISOString()}] Chat: Allowing navigation due to partnerLeftVisible or intentional navigation`);
          return;
        }
        if (!leaveConfirmVisible) {
          e.preventDefault();
          setLeaveConfirmVisible(true);
          console.log(`[${new Date().toISOString()}] Chat: Showing leave confirmation modal`);
        }
      };

      const backHandler = () => {
        if (partnerLeftVisible || isIntentionalNavigation) {
          console.log(`[${new Date().toISOString()}] Chat: Allowing back press due to partnerLeftVisible or intentional navigation`);
          return false;
        }
        if (!leaveConfirmVisible) {
          setLeaveConfirmVisible(true);
          console.log(`[${new Date().toISOString()}] Chat: Showing leave confirmation modal on back press`);
          return true;
        }
        return false;
      };

      const unsubscribe = navigation.addListener('beforeRemove', beforeRemoveListener);
      const backHandlerSub = BackHandler.addEventListener('hardwareBackPress', backHandler);

      return () => {
        console.log(`[${new Date().toISOString()}] Chat: Cleaning up navigation listeners`);
        unsubscribe();
        backHandlerSub.remove();
      };
    }, [navigation, leaveConfirmVisible, partnerLeftVisible, isIntentionalNavigation])
  );

  // Add handleTyping function to emit typing events
  const handleTyping = useCallback(() => {
    if (!socket?.connected || !partnerId || !userId || !isChatInitialized.current) {
      console.log(`[${new Date().toISOString()}] Chat: Cannot emit typing: invalid state`, { socketConnected: socket?.connected, partnerId, userId, isChatInitialized: isChatInitialized.current });
      return;
    }

    const currentTime = Date.now();
    if (!lastTypingTime || currentTime - lastTypingTime > 1000) {
      emitTyping();
      setLastTypingTime(currentTime);
      console.log(`[${new Date().toISOString()}] Chat: Emitted typing event`);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setLastTypingTime(null);
    }, TYPING_TIMEOUT);
  }, [socket, partnerId, userId, lastTypingTime, emitTyping]);

  const navigateToHome = () => {
    console.log(`[${new Date().toISOString()}] Chat: Navigating to home`);
    setIsIntentionalNavigation(true);
    setMessages([]);
    resetState();
    router.replace('/(tabs)/home');
    setTimeout(() => setIsIntentionalNavigation(false), 500);
  };

  const sendMessage = async () => {
    if (isSending) {
      console.warn(`[${new Date().toISOString()}] Chat: Send message aborted: Previous send in progress`);
      return;
    }
    setIsSending(true);

    console.log(`[${new Date().toISOString()}] Chat: sendMessage called`, { input, userId, partnerId, socketConnected: socket?.connected });

    if (!input.trim()) {
      console.warn(`[${new Date().toISOString()}] Chat: Cannot send message: Empty input`);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Message cannot be empty.',
      });
      setIsSending(false);
      return;
    }

    if (!userId || !partnerId || !socket?.connected) {
      console.warn(`[${new Date().toISOString()}] Chat: Cannot send message: Missing userId, partnerId, or socket`, { userId, partnerId, socketConnected: socket?.connected });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Chat is not properly initialized. Please try again.',
      });
      setIsSending(false);
      return;
    }

    const timestamp = Date.now();
    const newMessage = { text: input, sender: 'user', timestamp, seen: false };
    setMessages((prev): any => [...prev, newMessage]);
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      console.log(`[${new Date().toISOString()}] Chat: Emitting send_message`, { userId, partnerId, message: input, timestamp });
      socket.emit('send_message', {
        toUserId: partnerId,
        message: input,
        fromUserId: userId,
        timestamp,
      });
      console.log(`[${new Date().toISOString()}] Chat: Message sent via socket to ${partnerId} (random chat), timestamp ${timestamp}`);
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Chat: Error sending message:`, error.message, error.stack);
      setMessages((prev) => prev.filter((msg) => msg.timestamp !== timestamp));
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!userId || !partnerId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      console.warn(`[${new Date().toISOString()}] Chat: Invalid user or partner ID for friend request`, { userId, partnerId });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or partner ID.',
      });
      return;
    }

    if (hasSentFriendRequest) {
      console.log(`[${new Date().toISOString()}] Chat: Friend request already sent`);
      Toast.show({
        type: 'info',
        text1: 'Request Already Sent',
        text2: 'You have already sent a friend request.',
      });
      return;
    }

    console.log(`[${new Date().toISOString()}] Chat: Sending friend request from ${userId} to ${partnerId}`);
    try {
      await api.post('/api/users/send-friend-request', { userId, friendId: partnerId });
      setHasSentFriendRequest(true);
      setMessages((prev) => [
        ...prev,
        {
          text: 'You have sent a friend request.',
          sender: 'user',
          timestamp: Date.now(),
          seen: false,
          type: 'friendRequestSent',
        },
      ]);
      flatListRef.current?.scrollToEnd({ animated: true });
      Toast.show({
        type: 'success',
        text1: 'Request Sent',
        text2: `Friend request sent to ${partnerName || 'Anonymous'}!`,
      });
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Chat: Error sending friend request:`, error.message, error.stack);
      let errorMessage = 'Failed to send friend request.';
      if (error.response?.status === 400) {
        errorMessage = error.response.data.message || 'Invalid request.';
      } else if (error.response?.status === 404) {
        errorMessage = 'User or recipient not found.';
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    }
  };

  const handleAcceptFriendRequest = async (timestamp: number) => {
    if (!userId || !partnerId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      console.warn(`[${new Date().toISOString()}] Chat: Invalid user or partner ID for accepting friend request`, { userId, partnerId });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or partner ID.',
      });
      return;
    }

    try {
      await api.post('/api/users/accept-friend-request', {
        userId,
        friendId: partnerId,
      });

      if (user) {
        const updatedUser = {
          ...user,
          friends: user.friends ? [...user.friends, partnerId] : [partnerId],
        };
        setUser(updatedUser);
        console.log(`[${new Date().toISOString()}] Chat: Friend added to user`, { friendId: partnerId });
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.timestamp === timestamp
            ? { ...msg, text: `${partnerName || 'Anonymous'} is now your friend!` }
            : msg
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Friend Added',
        text2: `${partnerName || 'Anonymous'} is now your friend!`,
      });

      router.push({
        pathname: '/(tabs)/friends/[friendId]',
        params: { friendId: partnerId, friendName: partnerName },
      });
      console.log(`[${new Date().toISOString()}] Chat: Navigated to friend chat`, { friendId: partnerId });
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Chat: Error accepting friend request:`, error.message, error.stack);
      let errorMessage = 'Failed to accept friend request.';
      if (error.response?.status === 400) {
        errorMessage = error.response.data.message || 'Invalid request.';
      } else if (error.response?.status === 404) {
        errorMessage = 'User or friend not found.';
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    }
  };

  const handleRejectFriendRequest = async (timestamp: number) => {
    if (!userId || !partnerId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(partnerId)) {
      console.warn(`[${new Date().toISOString()}] Chat: Invalid user or partner ID for rejecting friend request`, { userId, partnerId });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or partner ID.',
      });
      return;
    }

    try {
      await api.post('/api/users/reject-friend-request', {
        userId,
        friendId: partnerId,
      });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.timestamp === timestamp
            ? { ...msg, text: 'Friend request rejected.' }
            : msg
        )
      );
      Toast.show({
        type: 'success',
        text1: 'Request Rejected',
        text2: `Friend request from ${partnerName || 'Anonymous'} rejected.`,
      });
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Chat: Error rejecting friend request:`, error.message, error.stack);
      let errorMessage = 'Failed to reject friend request.';
      if (error.response?.status === 400) {
        errorMessage = error.response.data.message || 'Invalid request.';
      } else if (error.response?.status === 404) {
        errorMessage = 'User or friend not found.';
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    }
  };

  const handleLeaveChat = () => {
    console.log(`[${new Date().toISOString()}] Chat: Leaving chat`);
    socket?.emit('leave_chat', { toUserId: partnerId });
    setLeaveConfirmVisible(false);
    navigateToHome();
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === 'user';
    const isLast = index === messages.length - 1;
    const senderLabel = isUser ? '' : partnerName || 'Anonymous';

    if (item.type === 'friendRequestSent') {
      return (
        <View className="my-2 self-center bg-indigo-600/20 rounded-lg px-4 py-2">
          <Text className="text-indigo-200 text-sm">{item.text}</Text>
        </View>
      );
    }

    if (item.type === 'friendRequestReceived') {
      return (
        <View className="my-2 self-center bg-gray-600/20 rounded-lg px-4 py-2">
          <Text className="text-gray-200 text-sm mb-2">{item.text}</Text>
          <View className="flex-row justify-center space-x-3">
            <TouchableOpacity
              onPress={() => handleAcceptFriendRequest(item.timestamp)}
              className="bg-indigo-500 px-3 py-1 rounded-lg"
            >
              <Text className="text-white text-sm font-semibold">Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRejectFriendRequest(item.timestamp)}
              className="bg-red-500 px-3 py-1 rounded-lg"
            >
              <Text className="text-white text-sm font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View className={`my-2 max-w-[75%] ${isUser ? 'self-end' : 'self-start'}`}>
        <View
          className={`px-4 py-3 rounded-2xl shadow-sm ${
            isUser ? 'bg-indigo-500' : 'bg-gray-700'
          }`}
        >
          {!isUser && (
            <Text className="text-white text-sm font-semibold mb-1">{senderLabel}</Text>
          )}
          <Text className="text-white text-base leading-5">{item.text}</Text>
        </View>
        <View className="flex-row justify-between mt-1">
          {isLast && (
            <Text className="text-xs text-gray-400">
              {moment(item.timestamp).format('h:mm A')}
            </Text>
          )}
          {isUser && item.seen && (
            <Text className="text-xs text-green-400">Seen</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-[#141432]">
        <View className="flex-row items-center justify-between px-4 pt-5 pb-3 border-b border-gray-800 bg-[#141432] z-10">
          <TouchableOpacity onPress={() => setLeaveConfirmVisible(true)}>
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-white text-lg font-semibold">
              {partnerName || 'Anonymous'}
            </Text>
            {connectionStatus === 'disconnected' && (
              <Text className="text-gray-400 text-xs mt-1">Reconnecting...</Text>
            )}
          </View>
          <View style={{ width: 28 }} />
        </View>

        <View className="px-4 py-3 bg-[#1A1A38] border-b border-gray-800">
          <Text className="text-white text-sm font-semibold">About {partnerName || 'Anonymous'}</Text>
          <Text className="text-gray-300 text-sm mt-1">{partnerBio}</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          renderItem={renderMessage}
          className="flex-1 px-4 pt-3"
          contentContainerStyle={{ paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isPartnerTyping && (
          <Text className="text-gray-400 text-sm px-4 pb-2">Typing...</Text>
        )}

        <View className="flex-row items-center bg-[#1A1A38] rounded-full p-3 mx-4 mb-4 shadow-sm">
          <TouchableOpacity
            onPress={handleSendFriendRequest}
            disabled={!partnerId || connectionStatus === 'disconnected' || hasSentFriendRequest}
            className="p-2"
          >
            <AntDesign
              name="adduser"
              size={24}
              color={partnerId && connectionStatus !== 'disconnected' && !hasSentFriendRequest ? '#5B2EFF' : 'gray'}
            />
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={(text) => {
              setInput(text);
              handleTyping();
            }}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-white px-3 text-base"
            editable={connectionStatus !== 'disconnected'}
          />
          <TouchableOpacity
            onPress={() => {
              console.log(`[${new Date().toISOString()}] Chat: Send button pressed`);
              sendMessage();
            }}
            disabled={isSending || connectionStatus === 'disconnected'}
            className={`ml-2 bg-indigo-500 px-4 py-2 rounded-full ${
              isSending || connectionStatus === 'disconnected' ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-white font-semibold text-base">Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={leaveConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaveConfirmVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-[#1A1A38] rounded-2xl p-6 w-full max-w-md shadow-lg">
            <Text className="text-white text-lg font-semibold mb-3">End Chat?</Text>
            <Text className="text-gray-300 mb-5">
              Leaving will disconnect you from this chat. Are you sure?
            </Text>
            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={() => {
                  console.log(`[${new Date().toISOString()}] Chat: Leave modal cancelled`);
                  setLeaveConfirmVisible(false);
                }}
                className="bg-gray-600 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLeaveChat}
                className="bg-red-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={partnerLeftVisible}
        transparent
        animationType="fade"
        onRequestClose={navigateToHome}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-[#1A1A38] rounded-2xl p-6 w-full max-w-md items-center shadow-lg">
            <Ionicons name="close-circle" size={64} color="#EF4444" className="mb-3" />
            <Text className="text-white text-lg font-semibold mb-2">Chat Ended</Text>
            <Text className="text-gray-300 text-center mb-5">
              Your partner has left the chat.
            </Text>
            <TouchableOpacity onPress={navigateToHome} className="bg-indigo-500 px-4 py-2 rounded-lg">
              <Text className="text-white font-semibold">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default Chat;