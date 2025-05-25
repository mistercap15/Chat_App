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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';
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
  type?: 'friendRequestSent' | 'friendRequestReceived';
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
  const [isPartnerInfoVisible, setIsPartnerInfoVisible] = useState(true);
  const [showExtraButtons, setShowExtraButtons] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isChatInitialized = useRef(false);
  const isMounted = useRef(true);

  const {
    socket,
    userId,
    randomPartnerId,
    randomChatType,
    resetRandomChatState,
    username,
    randomPartnerName,
    isPartnerTyping,
    setPartnerTyping,
    emitTyping,
    emitMessageSeen,
    friendRequest,
    connectionStatus,
    friendRequestSent,
    emitFriendRequestSent,
  } = useSocketStore();

  const { user, setUser } = useUserStore();
  const navigation = useNavigation();
  const route = useRoute();
  const TYPING_TIMEOUT = 3000;
  const DISCONNECT_GRACE_PERIOD = 60000;
  const DEDUPE_WINDOW = 1000;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      console.log(`[${new Date().toISOString()}] Chat: Component unmounted`);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!randomPartnerId || !randomPartnerName || !userId || !socket?.connected || randomChatType !== 'random') {
        console.warn(`[${new Date().toISOString()}] Chat: Random chat not initialized: missing partnerId, userId, socket, or incorrect chat type`, { randomPartnerId, userId, randomPartnerName, socketConnected: socket?.connected, randomChatType });
        navigateToHome();
        return;
      }

      console.log(`[${new Date().toISOString()}] Chat: Initializing random chat`, { userId, randomPartnerId, randomPartnerName, socketConnected: socket?.connected });
      isChatInitialized.current = true;
      const roomId = [userId, randomPartnerId].sort().join('-');
      socket.emit('join_room', { roomId, userId });
      console.log(`[${new Date().toISOString()}] Chat: Random chat initialized for user ${userId} with partner ${randomPartnerId} (${randomPartnerName}), joined room ${roomId}`);

      return () => {
        console.log(`[${new Date().toISOString()}] Chat: Cleaning up on unfocus`);
        if (isChatInitialized.current) {
          socket?.emit('leave_chat', { toUserId: randomPartnerId });
        }
        isChatInitialized.current = false;
      };
    }, [randomPartnerId, randomPartnerName, userId, socket, randomChatType])
  );

  useEffect(() => {
    if (!socket || !isChatInitialized.current || randomChatType !== 'random') {
      console.log(`[${new Date().toISOString()}] Chat: Socket or chat not initialized, or not a random chat, skipping event listeners`, { socketConnected: socket?.connected, isChatInitialized: isChatInitialized.current, randomChatType });
      return;
    }

    const messageListener = ({ message, fromUserId, timestamp }: { message: string; fromUserId: string; timestamp: number }) => {
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] Chat: Received message: from ${fromUserId}, to user ${userId}, partner ${randomPartnerId}, message: ${message}, timestamp: ${timestamp}`);
      if (fromUserId === userId) {
        console.log(`[${new Date().toISOString()}] Chat: Ignored own message: ${message}, timestamp ${timestamp}`);
        return;
      }
      if (fromUserId === randomPartnerId) {
        setMessages((prev): any => {
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
        emitMessageSeen(timestamp, false);
      } else {
        console.warn(`[${new Date().toISOString()}] Chat: Message ignored: from ${fromUserId}, expected partnerId ${randomPartnerId}`);
      }
    };

    const partnerDisconnectedListener = ({ disconnectedUserId }: { disconnectedUserId: string }) => {
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] Chat: Partner disconnected event received: ${disconnectedUserId}`);
      if (disconnectedUserId === randomPartnerId) {
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
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] Chat: Message seen by partner: timestamp ${timestamp}`);
      if (fromUserId === randomPartnerId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender === 'user' && msg.timestamp === timestamp ? { ...msg, seen: true } : msg
          )
        );
      }
    };

    const friendRequestListener = ({ fromUserId, fromUsername }: { fromUserId: string; fromUsername: string }) => {
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] Chat: Friend request received`, { fromUserId, fromUsername });
      if (fromUserId === randomPartnerId) {
        setMessages((prev) => [
          ...prev,
          {
            text: `You have received a friend request from ${fromUsername || 'Anonymous'}`,
            sender: 'partner',
            timestamp: Date.now(),
            seen: false,
            type: 'friendRequestReceived',
          },
        ]);
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    };

    const friendRequestAcceptedListener = ({ userId: acceptorId, friendId }: { userId: string; friendId: string }) => {
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] Chat: Friend request accepted`, { acceptorId, friendId });
      if ((acceptorId === userId && friendId === randomPartnerId) || (acceptorId === randomPartnerId && friendId === userId)) {
        Toast.show({
          type: 'success',
          text1: 'Friend Added',
          text2: `${randomPartnerName || 'Anonymous'} is now your friend!`,
        });
        navigateToFriends();
      }
    };

    const friendRequestStatusListener = ({ fromUserId, toUserId, fromUsername, status }: { fromUserId: string; toUserId: string; fromUsername: string; status: string }) => {
      if (!isMounted.current) return;
      console.log(`[${new Date().toISOString()}] Chat: Friend request status updated`, { fromUserId, toUserId, status });
      if (status === 'sent' && (fromUserId === userId || fromUserId === randomPartnerId) && (toUserId === randomPartnerId || toUserId === userId)) {
        setMessages((prev) => [
          ...prev,
          {
            text: `${fromUsername || 'Anonymous'} has sent a friend request.`,
            sender: fromUserId === userId ? 'user' : 'partner',
            timestamp: Date.now(),
            seen: false,
            type: 'friendRequestSent',
          },
        ]);
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    };

    socket.on('receive_message', messageListener);
    socket.on('partner_disconnected', partnerDisconnectedListener);
    socket.on('message_seen', messageSeenListener);
    socket.on('friend_request_received', friendRequestListener);
    socket.on('friend_request_accepted', friendRequestAcceptedListener);
    socket.on('friend_request_status', friendRequestStatusListener);

    return () => {
      console.log(`[${new Date().toISOString()}] Chat: Cleaning up socket listeners`);
      socket.off('receive_message', messageListener);
      socket.off('partner_disconnected', partnerDisconnectedListener);
      socket.off('message_seen', messageSeenListener);
      socket.off('friend_request_received', friendRequestListener);
      socket.off('friend_request_accepted', friendRequestAcceptedListener);
      socket.off('friend_request_status', friendRequestStatusListener);
    };
  }, [socket, randomPartnerId, userId, randomPartnerName, randomChatType, emitMessageSeen]);

  useEffect(() => {
    if (isPartnerTyping) {
      const timeout = setTimeout(() => setPartnerTyping(false), TYPING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [isPartnerTyping, setPartnerTyping]);

  useFocusEffect(
    useCallback(() => {
      const beforeRemoveListener = (e: any) => {
        if (partnerLeftVisible || isIntentionalNavigation) return;
        if (!leaveConfirmVisible) {
          e.preventDefault();
          setLeaveConfirmVisible(true);
        }
      };

      const backHandler = () => {
        if (partnerLeftVisible || isIntentionalNavigation) return false;
        if (!leaveConfirmVisible) {
          setLeaveConfirmVisible(true);
          return true;
        }
        return false;
      };

      const unsubscribe = navigation.addListener('beforeRemove', beforeRemoveListener);
      const backHandlerSub = BackHandler.addEventListener('hardwareBackPress', backHandler);

      return () => {
        unsubscribe();
        backHandlerSub.remove();
      };
    }, [navigation, leaveConfirmVisible, partnerLeftVisible, isIntentionalNavigation])
  );

  const handleTyping = useCallback(() => {
    if (!socket?.connected || !randomPartnerId || !userId || !isChatInitialized.current) return;
    const currentTime = Date.now();
    if (!lastTypingTime || currentTime - lastTypingTime > 1000) {
      emitTyping(false);
      setLastTypingTime(currentTime);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setLastTypingTime(null), TYPING_TIMEOUT);
  }, [socket, randomPartnerId, userId, lastTypingTime, emitTyping]);

  const navigateToHome = () => {
    if (!isMounted.current) return;
    console.log(`[${new Date().toISOString()}] Chat: Navigating to home`);
    setIsIntentionalNavigation(true);
    setMessages([]);
    resetRandomChatState();
    router.replace('/(tabs)/home');
    setTimeout(() => setIsIntentionalNavigation(false), 500);
  };

  const navigateToFriends = () => {
    if (!isMounted.current) return;
    console.log(`[${new Date().toISOString()}] Chat: Navigating to friends listing page`);
    setIsIntentionalNavigation(true);
    setMessages([]);
    // Reset random chat state since we're leaving the random chat session
    resetRandomChatState();
    router.replace('/(tabs)/friends');
    setTimeout(() => setIsIntentionalNavigation(false), 500);
  };

  const sendMessage = async () => {
    if (isSending) return;
    setIsSending(true);

    if (!input.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Message cannot be empty.' });
      setIsSending(false);
      return;
    }

    if (!userId || !randomPartnerId || !socket?.connected) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Chat is not properly initialized. Please try again.' });
      setIsSending(false);
      return;
    }

    const timestamp = Date.now();
    const newMessage = { text: input, sender: 'user', timestamp, seen: false };
    setMessages((prev): any => [...prev, newMessage]);
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      socket.emit('send_message', {
        toUserId: randomPartnerId,
        message: input,
        fromUserId: userId,
        timestamp,
      });
    } catch (error: any) {
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
    if (!userId || !randomPartnerId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(randomPartnerId)) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or partner ID.' });
      return;
    }

    try {
      await api.post('/api/users/send-friend-request', { userId, friendId: randomPartnerId });
      emitFriendRequestSent();
      Toast.show({
        type: 'success',
        text1: 'Request Sent',
        text2: `Friend request sent to ${randomPartnerName || 'Anonymous'}!`,
      });
    } catch (error: any) {
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
    if (!userId || !randomPartnerId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(randomPartnerId)) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or partner ID.' });
      return;
    }

    try {
      await api.post('/api/users/accept-friend-request', {
        userId,
        friendId: randomPartnerId,
      });

      if (user) {
        const updatedUser = {
          ...user,
          friends: user.friends ? [...user.friends, randomPartnerId] : [randomPartnerId],
        };
        setUser(updatedUser);
        console.log(`[${new Date().toISOString()}] Chat: Friend added to user`, { friendId: randomPartnerId });
      }
    } catch (error: any) {
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
    if (!userId || !randomPartnerId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(randomPartnerId)) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or partner ID.' });
      return;
    }

    try {
      await api.post('/api/users/reject-friend-request', {
        userId,
        friendId: randomPartnerId,
      });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.timestamp === timestamp ? { ...msg, text: 'Friend request rejected.' } : msg
        )
      );
      socket.emit('friend_request_rejected', { userId, friendId: randomPartnerId });
      Toast.show({
        type: 'success',
        text1: 'Request Rejected',
        text2: `Friend request from ${randomPartnerName || 'Anonymous'} rejected.`,
      });
    } catch (error: any) {
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
    socket?.emit('leave_chat', { toUserId: randomPartnerId });
    setLeaveConfirmVisible(false);
    navigateToHome();
  };

  const handleNewPartner = () => {
    handleLeaveChat();
  };

  const toggleExtraButtons = () => {
    setShowExtraButtons((prev) => !prev);
    console.log(`[${new Date().toISOString()}] Chat: Toggled extra buttons visibility`, { showExtraButtons: !showExtraButtons });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === 'user';

    if (item.type === 'friendRequestSent') {
      return (
        <View className="my-2 self-center bg-[#2F2F2F] rounded-lg px-4 py-2">
          <Text className="text-white text-sm">{item.text}</Text>
        </View>
      );
    }

    if (item.type === 'friendRequestReceived') {
      return (
        <View className="my-2 self-center bg-[#2F2F2F] rounded-lg px-4 py-2">
          <Text className="text-white text-sm mb-2">{item.text}</Text>
          <View className="flex-row justify-center space-x-3">
            <TouchableOpacity
              onPress={() => handleAcceptFriendRequest(item.timestamp)}
              className="bg-[#4A90E2] px-3 py-1 rounded-lg"
            >
              <Text className="text-white text-sm font-semibold">Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRejectFriendRequest(item.timestamp)}
              className="bg-[#EF4444] px-3 py-1 rounded-lg"
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
            isUser ? 'bg-[#4A90E2]' : 'bg-[#2F2F2F]'
          }`}
        >
          <Text className="text-white text-base leading-5">{item.text}</Text>
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-[#A0A0A0]">
            {moment(item.timestamp).format('h:mm A')}
          </Text>
          {isUser && item.seen && (
            <Text className="text-xs text-green-400">Seen</Text>
          )}
        </View>
      </View>
    );
  };

  const isSendFriendRequestDisabled:any =
    !randomPartnerId ||
    connectionStatus === 'disconnected' ||
    (friendRequestSent && (friendRequestSent.fromUserId === userId || friendRequestSent.fromUserId === randomPartnerId));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-[#141432]">
        <View className="flex-row items-center px-4 pt-10 pb-3 bg-[#141432]">
          <TouchableOpacity onPress={() => setLeaveConfirmVisible(true)}>
            <Ionicons name="chevron-back" size={28} color="#4A90E2" />
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-white text-lg font-semibold">
              {randomPartnerName || 'Anonymous'}
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <TouchableOpacity
          onPress={() => setIsPartnerInfoVisible(!isPartnerInfoVisible)}
          className="self-center bg-[#2F2F2F] rounded-lg px-4 py-2 my-2 flex-row items-center"
        >
          <Text className="text-white text-sm font-semibold">About partner</Text>
          <Ionicons
            name={isPartnerInfoVisible ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#A0A0A0"
            className="ml-2"
          />
        </TouchableOpacity>
        {isPartnerInfoVisible && (
          <View className="self-center bg-[#2F2F2F] rounded-lg px-4 py-2 mb-2">
            <Text className="text-white text-sm">Male</Text>
            <Text className="text-white text-sm">Indian</Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          renderItem={renderMessage}
          className="flex-1 px-4 pt-3"
          contentContainerStyle={{ paddingBottom: 150 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isPartnerTyping && (
          <View className="px-4 pb-2">
            <Text className="text-white text-sm">...</Text>
            <Text className="text-[#A0A0A0] text-xs">typing</Text>
          </View>
        )}

        <View className="mx-4 mb-4">
          <View className="flex-row items-center bg-[#2F2F2F] rounded-full p-2 shadow-sm">
            <TouchableOpacity className="p-2">
              <Ionicons name="camera-outline" size={24} color="#4A90E2" />
            </TouchableOpacity>
            <TextInput
              value={input}
              onChangeText={(text) => {
                setInput(text);
                handleTyping();
              }}
              placeholder="Write a message..."
              placeholderTextColor="#A0A0A0"
              className="flex-1 text-white px-3 text-base"
              editable={connectionStatus !== 'disconnected'}
            />
            <TouchableOpacity
              onPress={toggleExtraButtons}
              className="p-2"
            >
              <Ionicons
                name="apps"
                size={24}
                color={showExtraButtons ? '#4A90E2' : '#A0A0A0'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={sendMessage}
              disabled={isSending || connectionStatus === 'disconnected' || !input.trim()}
              className={`p-2 ${isSending || connectionStatus === 'disconnected' || !input.trim() ? 'opacity-50' : ''}`}
            >
              <Ionicons name="send" size={24} color="#4A90E2" />
            </TouchableOpacity>
          </View>

          {showExtraButtons && (
            <View className="mt-2 space-y-2">
              <TouchableOpacity
                onPress={handleSendFriendRequest}
                disabled={isSendFriendRequestDisabled}
                className={`flex-row items-center justify-center py-3 rounded-lg ${
                  isSendFriendRequestDisabled ? 'bg-gray-600 opacity-50' : 'bg-[#4A90E2]'
                }`}
              >
                <Ionicons
                  name="person-add-outline"
                  size={20}
                  color="white"
                  className="mr-2"
                />
                <Text className="text-white text-sm font-semibold">Send friend request</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLeaveChat}
                className="flex-row items-center justify-center bg-[#2F2F2F] py-3 rounded-lg"
              >
                <Ionicons name="close-circle-outline" size={20} color="#EF4444" className="mr-2" />
                <Text className="text-[#EF4444] text-sm font-semibold">End chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNewPartner}
                className="flex-row items-center justify-center bg-[#2F2F2F] py-3 rounded-lg"
              >
                <Ionicons name="refresh-outline" size={20} color="#4A90E2" className="mr-2" />
                <Text className="text-[#4A90E2] text-sm font-semibold">New partner</Text>
              </TouchableOpacity>
            </View>
          )}
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
                onPress={() => setLeaveConfirmVisible(false)}
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
            <TouchableOpacity onPress={navigateToHome} className="bg-[#4A90E2] px-4 py-2 rounded-lg">
              <Text className="text-white font-semibold">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default Chat;