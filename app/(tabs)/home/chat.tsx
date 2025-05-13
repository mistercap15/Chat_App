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
}

const Chat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastTypingTime, setLastTypingTime] = useState<number | null>(null);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [partnerLeftVisible, setPartnerLeftVisible] = useState(false);
  const [friendRequestModalVisible, setFriendRequestModalVisible] = useState(false);
  const [isIntentionalNavigation, setIsIntentionalNavigation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastDisconnectTime, setLastDisconnectTime] = useState<number | null>(null);
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
    sendFriendRequest,
    friendRequest,
    connectionStatus,
  } = useSocketStore();

  const { user, setUser } = useUserStore();
  const navigation = useNavigation();
  const TYPING_TIMEOUT = 3000;
  const DISCONNECT_GRACE_PERIOD = 60000; // 1 minute

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
      if (fromUserId === partnerId) {
        setMessages((prev):any => {
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

    socket.on('receive_message', messageListener);
    socket.on('partner_disconnected', partnerDisconnectedListener);
    socket.on('message_seen', messageSeenListener);

    return () => {
      console.log(`[${new Date().toISOString()}] Chat: Cleaning up socket listeners`);
      socket.off('receive_message', messageListener);
      socket.off('partner_disconnected', partnerDisconnectedListener);
      socket.off('message_seen', messageSeenListener);
    };
  }, [socket, partnerId, userId, emitMessageSeen, lastDisconnectTime]);

  // Handle friend request modal
  useEffect(() => {
    if (friendRequest) {
      console.log(`[${new Date().toISOString()}] Chat: Showing friend request modal`, { fromUserId: friendRequest.fromUserId });
      setFriendRequestModalVisible(true);
    }
  }, [friendRequest]);

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
    setMessages((prev):any => [...prev, newMessage]);
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      console.log(`[${new Date().toISOString()}] Chat: Sending message to server`, { userId, partnerId, message: input, timestamp });
      await api.post('/api/chats/send-random', {
        userId,
        partnerId,
        message: input,
      });
      socket.emit('send_message', {
        toUserId: partnerId,
        message: input,
        fromUserId: userId,
        timestamp,
      });
      console.log(`[${new Date().toISOString()}] Chat: Message sent successfully to ${partnerId} (random chat), timestamp ${timestamp}`);
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Chat: Error sending message:`, error.message, error.stack);
      setMessages((prev) => prev.filter((msg) => msg.timestamp !== timestamp));
      let errorMessage = 'Failed to send message.';
      if (error.response?.status === 403) {
        errorMessage = 'You are not in a random chat with this user.';
        navigateToHome();
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setIsSending(false);
    }
  };

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

    console.log(`[${new Date().toISOString()}] Chat: Sending friend request from ${userId} to ${partnerId}`);
    try {
      await api.post('/api/users/send-friend-request', { userId, friendId: partnerId });
      socket?.emit('send_friend_request', {
        toUserId: partnerId,
        fromUserId: userId,
        fromUsername: username || user?.user_name || 'Anonymous',
      });
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

  const handleAcceptFriendRequest = async () => {
    if (!userId || !friendRequest?.fromUserId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(friendRequest.fromUserId)) {
      console.warn(`[${new Date().toISOString()}] Chat: Invalid user or friend ID for accepting friend request`, { userId, fromUserId: friendRequest?.fromUserId });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or friend ID.',
      });
      return;
    }

    try {
      await api.post('/api/users/accept-friend-request', {
        userId,
        friendId: friendRequest.fromUserId,
      });

      if (user) {
        const updatedUser = {
          ...user,
          friends: user.friends ? [...user.friends, friendRequest.fromUserId] : [friendRequest.fromUserId],
        };
        setUser(updatedUser);
        console.log(`[${new Date().toISOString()}] Chat: Friend added to user`, { friendId: friendRequest.fromUserId });
      }

      Toast.show({
        type: 'success',
        text1: 'Friend Added',
        text2: `${friendRequest.fromUsername} is now your friend!`,
      });

     router.push({
  pathname: '/(tabs)/home/[friendId]',
  params: { friendId: 'friend_id_here', friendName: 'friend_name_here' },
});
      console.log(`[${new Date().toISOString()}] Chat: Navigated to friend chat`, { friendId: friendRequest.fromUserId });
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
    } finally {
      setFriendRequestModalVisible(false);
    }
  };

  const handleRejectFriendRequest = async () => {
    if (!userId || !friendRequest?.fromUserId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(friendRequest.fromUserId)) {
      console.warn(`[${new Date().toISOString()}] Chat: Invalid user or friend ID for rejecting friend request`, { userId, fromUserId: friendRequest?.fromUserId });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or friend ID.',
      });
      return;
    }

    try {
      await api.post('/api/users/reject-friend-request', {
        userId,
        friendId: friendRequest.fromUserId,
      });
      Toast.show({
        type: 'success',
        text1: 'Request Rejected',
        text2: `Friend request from ${friendRequest.fromUsername} rejected.`,
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
    } finally {
      setFriendRequestModalVisible(false);
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
          <TouchableOpacity onPress={() => setLeaveConfirmVisible(true)}>
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold">
            Chatting with {partnerName || 'Anonymous'} {connectionStatus === 'disconnected' ? '(Reconnecting...)' : ''}
          </Text>
          <View style={{ width: 28 }} />
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
          <TouchableOpacity
            onPress={handleSendFriendRequest}
            disabled={!partnerId || connectionStatus === 'disconnected'}
            className="p-2"
          >
            <AntDesign
              name="adduser"
              size={24}
              color={partnerId && connectionStatus !== 'disconnected' ? 'white' : 'gray'}
            />
          </TouchableOpacity>
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
              console.log(`[${new Date().toISOString()}] Chat: Send button pressed`);
              sendMessage();
            }}
            disabled={isSending || connectionStatus === 'disconnected'}
            className={`ml-2 bg-indigo-500 px-4 py-2 rounded-xl ${isSending || connectionStatus === 'disconnected' ? 'opacity-50' : ''}`}
          >
            <Text className="text-white font-semibold">Send</Text>
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
          <View className="bg-white rounded-2xl p-6 w-full max-w-md">
            <Text className="text-lg font-semibold text-gray-800 mb-3">End Chat?</Text>
            <Text className="text-gray-700 mb-5">
              Leaving will disconnect you from this chat. Are you sure?
            </Text>
            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={() => {
                  console.log(`[${new Date().toISOString()}] Chat: Leave modal cancelled`);
                  setLeaveConfirmVisible(false);
                }}
                className="bg-gray-300 px-4 py-2 rounded-xl"
              >
                <Text className="text-gray-800">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLeaveChat}
                className="bg-red-500 px-4 py-2 rounded-xl"
              >
                <Text className="text-white font-semibold">Leave</Text>
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
          <View className="bg-white rounded-2xl p-6 w-full max-w-md items-center">
            <Ionicons name="close-circle" size={64} color="#EF4444" className="mb-3" />
            <Text className="text-lg font-semibold text-gray-800 mb-2">Chat Ended</Text>
            <Text className="text-gray-700 text-center mb-5">
              Your partner has left the chat.
            </Text>
            <TouchableOpacity onPress={navigateToHome} className="bg-indigo-600 px-4 py-2 rounded-xl">
              <Text className="text-white font-semibold">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={friendRequestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          console.log(`[${new Date().toISOString()}] Chat: Friend request modal closed`);
          setFriendRequestModalVisible(false);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md">
            <Text className="text-lg font-semibold text-gray-800 mb-3">Friend Request</Text>
            <Text className="text-gray-700 mb-5">
              {friendRequest?.fromUsername || 'Anonymous'} wants to be your friend!
            </Text>
            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={handleRejectFriendRequest}
                className="bg-red-500 px-4 py-2 rounded-xl"
              >
                <Text className="text-white font-semibold">Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAcceptFriendRequest}
                className="bg-indigo-600 px-4 py-2 rounded-xl"
              >
                <Text className="text-white font-semibold">Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default Chat;