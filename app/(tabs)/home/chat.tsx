import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import useSocketStore from '@/store/useSocketStore';
import useUserStore from '@/store/useUserStore';
import useRandomChatStore from '@/store/useRandomChatStore';
import useFriendRequestStore from '@/store/useFriendRequestStore';
import api from '@/utils/api';

interface Message {
  text: string;
  sender: 'user' | 'partner' | 'system';
  timestamp: number;
  seen?: boolean;
  type?: 'friendRequestSent' | 'friendRequestReceived' | 'system';
}

const Chat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastTypingTime, setLastTypingTime] = useState<number | null>(null);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastDisconnectTime, setLastDisconnectTime] = useState<number | null>(null);
  const [isPartnerInfoVisible, setIsPartnerInfoVisible] = useState(true);
  const [showExtraButtons, setShowExtraButtons] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isChatInitialized = useRef(false);
  const isMounted = useRef(true);
  const hasJoinedRoom = useRef(false);
  const isIntentionallyLeaving = useRef(false);

  const { socket, connectionStatus } = useSocketStore();
  const { user } = useUserStore();
  const {
    partnerId,
    partnerName,
    isPartnerTyping,
    friendRequestAccepted,
    setPartnerTyping,
    emitTyping,
    emitMessageSeen,
    friendRequest,
    friendRequestSent,
    emitFriendRequestSent,
    reset,
    setFriendRequestAccepted,
    initializeListeners,
  } = useRandomChatStore();
  const { sendFriendRequest, acceptFriendRequest, rejectFriendRequest } = useFriendRequestStore();
  const navigation = useNavigation();
const [partnerBio, setPartnerBio] = useState<string | null>(null);

// Add useEffect to fetch partner bio when partnerId changes
useEffect(() => {
  if (!partnerId) {
    setPartnerBio(null);
    return;
  }

  const fetchPartnerBio = async () => {
    try {
      log('Fetching partner bio', { partnerId });
      const response = await api.get(`/api/users/${partnerId}`);
      const { bio, gender } = response.data;
      setPartnerBio(bio || 'No bio available');
      log('Partner bio fetched', { bio, gender });
    } catch (error: any) {
      log('Error fetching partner bio', { error: error.message });
      setPartnerBio('No bio available');
    }
  };

  fetchPartnerBio();
}, [partnerId]);

  const TYPING_TIMEOUT = 3000;
  const DISCONNECT_GRACE_PERIOD = 60000;
  const DEDUPE_WINDOW = 1000;

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Chat: ${message}`, data || '');
  };

  const navigateToFriends = useCallback(
    (skipModal = false) => {
      if (!isMounted.current) return;
      if (!skipModal) setLeaveConfirmVisible(false);
      setMessages([]);
      reset();
      isIntentionallyLeaving.current = true;
      hasJoinedRoom.current = false;
      isChatInitialized.current = false;
      setChatEnded(true);
      router.replace('/(tabs)/friends');
    },
    [reset]
  );

  useEffect(() => {
    log('Chat component mounted');
    isMounted.current = true;
    const cleanup = initializeListeners(socket);

    socket?.onAnyOutgoing((event: any, ...args: any) => {
      log(`Outgoing socket event: ${event}`, args);
    });

    const chatReadyListener = () => {
      log('Chat ready confirmed');
      isChatInitialized.current = true;
    };

    socket?.on('chat_ready', chatReadyListener);

    return () => {
      log('Chat component unmounted');
      isMounted.current = false;
      cleanup();
      socket?.offAnyOutgoing();
      socket?.off('chat_ready', chatReadyListener);
    };
  }, [socket, initializeListeners]);

  useEffect(() => {
    if (friendRequestAccepted) {
      log('Friend request accepted, navigating to friends list');
      navigateToFriends(true);
      setFriendRequestAccepted(false);
    }
  }, [friendRequestAccepted, navigateToFriends, setFriendRequestAccepted]);

  useFocusEffect(
    useCallback(() => {
      if (!partnerId || !partnerName || !user?._id || !socket?.connected) {
        if (friendRequestAccepted) {
          log('Friend request accepted, skipping home navigation');
          return;
        }
        log('Invalid chat state, navigating to home', {
          partnerId,
          partnerName,
          userId: user?._id,
          socketConnected: socket?.connected,
        });
        navigateToHome(true);
        return;
      }

      if (!hasJoinedRoom.current) {
        const roomId = [user._id, partnerId].sort().join('-');
        log('Joining room', { roomId, userId: user._id, partnerId });
        socket.emit('join_room', { roomId, userId: user._id });
        hasJoinedRoom.current = true;
      }

      return () => {
        if (isIntentionallyLeaving.current && !leaveConfirmVisible && socket?.connected && partnerId && !chatEnded) {
          log('Leaving chat room', { partnerId });
          socket.emit('leave_chat', { toUserId: partnerId });
        }
      };
    }, [partnerId, partnerName, user?._id, socket, leaveConfirmVisible, chatEnded, friendRequestAccepted])
  );

  useEffect(() => {
    if (!socket) return;

    const messageListener = ({
      message,
      fromUserId,
      timestamp,
    }: {
      message: string;
      fromUserId: string;
      timestamp: number;
    }) => {
      if (!isMounted.current) return;
      log('Received message event', { message, fromUserId, timestamp, partnerId, chatEnded });
      if (fromUserId === partnerId && isChatInitialized.current) {
        setMessages((prev): any => {
          const recentMessages = prev.filter((msg) => Math.abs(msg.timestamp - timestamp) < DEDUPE_WINDOW);
          if (recentMessages.some((msg) => msg.text === message && msg.sender === 'partner')) {
            log('Duplicate message ignored', { message, timestamp });
            return prev;
          }
          const newMessage = { text: message, sender: 'partner', timestamp, seen: false };
          log('Adding message to state', newMessage);
          flatListRef.current?.scrollToEnd({ animated: true });
          return [...prev, newMessage];
        });
        emitMessageSeen(socket, timestamp);
      } else {
        log('Message ignored', { reason: fromUserId === partnerId ? 'Not initialized' : 'Invalid sender', fromUserId });
      }
    };

    const partnerDisconnectedListener = ({ disconnectedUserId }: { disconnectedUserId: string }) => {
      if (!isMounted.current || disconnectedUserId !== partnerId || !isChatInitialized.current || chatEnded) {
        log('Ignoring partner_disconnected event', {
          disconnectedUserId,
          partnerId,
          isChatInitialized: isChatInitialized.current,
          chatEnded,
        });
        return;
      }
      const now = Date.now();
      if (lastDisconnectTime && now - lastDisconnectTime < DISCONNECT_GRACE_PERIOD) {
        log('Ignoring duplicate disconnect event', { disconnectedUserId, lastDisconnectTime });
        return;
      }
      log('Partner disconnected', { disconnectedUserId });
      setLastDisconnectTime(now);
      setChatEnded(true);
      setMessages((prev) => [
        ...prev,
        {
          text: 'User has disconnected',
          sender: 'system',
          timestamp: Date.now(),
          type: 'system',
        },
      ]);
      flatListRef.current?.scrollToEnd({ animated: true });
    };

    const messageSeenListener = ({ fromUserId, timestamp }: { fromUserId: string; timestamp: number }) => {
      if (!isMounted.current || fromUserId !== partnerId) return;
      log('Message seen', { fromUserId, timestamp });
      setMessages((prev) =>
        prev.map((msg) => (msg.sender === 'user' && msg.timestamp === timestamp ? { ...msg, seen: true } : msg))
      );
    };

    socket.on('receive_message', messageListener);
    socket.on('partner_disconnected', partnerDisconnectedListener);
    socket.on('message_seen', messageSeenListener);

    return () => {
      socket.off('receive_message', messageListener);
      socket.off('partner_disconnected', partnerDisconnectedListener);
      socket.off('message_seen', messageSeenListener);
    };
  }, [socket, partnerId, user?._id, emitMessageSeen, chatEnded]);

  useEffect(() => {
    if (isPartnerTyping) {
      const timeout = setTimeout(() => setPartnerTyping(false), TYPING_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [isPartnerTyping, setPartnerTyping]);

  useEffect(() => {
    if (friendRequest && isMounted.current && isChatInitialized.current && !chatEnded) {
      log('Friend request received, adding to messages', { friendRequest });
      setMessages((prev) => {
        if (prev.some((msg) => msg.type === 'friendRequestReceived' && msg.sender === 'partner')) {
          log('Duplicate friend request message ignored');
          return prev;
        }
        return [
          ...prev,
          {
            text: `${friendRequest.fromUsername} sent you a friend request!`,
            sender: 'partner',
            timestamp: Date.now(),
            type: 'friendRequestReceived',
          },
        ];
      });
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [friendRequest, chatEnded]);

  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (chatEnded) return false;
        setLeaveConfirmVisible(true);
        return true;
      });
      return () => backHandler.remove();
    }, [chatEnded])
  );

  const handleTyping = useCallback(() => {
    if (!socket?.connected || !partnerId || !user?._id || !isChatInitialized.current || chatEnded) return;
    const currentTime = Date.now();
    if (!lastTypingTime || currentTime - lastTypingTime > 1000) {
      emitTyping(socket);
      setLastTypingTime(currentTime);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setLastTypingTime(null), TYPING_TIMEOUT);
  }, [socket, partnerId, user?._id, lastTypingTime, emitTyping, chatEnded]);

  const navigateToHome = useCallback(
    (skipModal = false) => {
      if (!isMounted.current) return;
      if (!skipModal) setLeaveConfirmVisible(false);
      setMessages([]);
      reset();
      isIntentionallyLeaving.current = true;
      hasJoinedRoom.current = false;
      isChatInitialized.current = false;
      setChatEnded(true);
      router.replace('/(tabs)/home');
    },
    [reset]
  );

  const sendMessage = async () => {
    if (isSending || chatEnded || !isChatInitialized.current) {
      log('Send message blocked', { isSending, chatEnded, isChatInitialized: isChatInitialized.current });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Cannot send message.' });
      return;
    }
    setIsSending(true);
    if (!input.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Message cannot be empty.' });
      setIsSending(false);
      return;
    }
    if (!user?._id || !partnerId || !socket?.connected) {
      log('Invalid state for sending message', { userId: user?._id, partnerId, socketConnected: socket?.connected });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Chat is not properly initialized.' });
      setIsSending(false);
      return;
    }
    const timestamp = Date.now();
    const newMessage = { text: input, sender: 'user', timestamp, seen: false };
    setMessages((prev): any => [...prev, newMessage]);
    setInput('');
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      log('Emitting send_message', { toUserId: partnerId, message: input, fromUserId: user._id, timestamp });
      socket.emit('send_message', { toUserId: partnerId, message: input, fromUserId: user._id, timestamp });
    } catch (error: any) {
      log('Error sending message', { error: error.message });
      setMessages((prev) => prev.filter((msg) => msg.timestamp !== timestamp));
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send message.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user?._id || !partnerId || chatEnded) return;
    await sendFriendRequest(partnerId);
    emitFriendRequestSent(socket);
    setMessages((prev) => [
      ...prev,
      {
        text: 'Friend request sent!',
        sender: 'user',
        timestamp: Date.now(),
        seen: false,
        type: 'friendRequestSent',
      },
    ]);
  };

  const handleAcceptFriendRequest = async (timestamp: number) => {
    if (!user?._id || !partnerId) return;
    await acceptFriendRequest(partnerId);
    navigateToFriends(true);
  };

  const handleRejectFriendRequest = async (timestamp: number) => {
    if (!user?._id || !partnerId) return;
    await rejectFriendRequest(partnerId);
    setMessages((prev) =>
      prev.map((msg) => (msg.timestamp === timestamp ? { ...msg, text: 'Friend request rejected.' } : msg))
    );
  };

  const handleLeaveChat = useCallback(() => {
    if (!isMounted.current || chatEnded) return;
    isIntentionallyLeaving.current = true;
    if (socket?.connected && partnerId) {
      log('Emitting leave_chat', { toUserId: partnerId });
      socket.emit('leave_chat', { toUserId: partnerId });
    }
    setChatEnded(true);
    setMessages((prev) => [
      ...prev,
      {
        text: 'You have left the chat',
        sender: 'system',
        timestamp: Date.now(),
        type: 'system',
      },
    ]);
    setLeaveConfirmVisible(false);
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [socket, partnerId]);

  const handleCancelLeave = useCallback(() => {
    log('Leave confirmation cancelled');
    setLeaveConfirmVisible(false);
  }, []);

  const handleNewPartner = () => {
    handleLeaveChat();
    navigateToHome(true);
  };

  const toggleExtraButtons = () => {
    setShowExtraButtons((prev) => !prev);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === 'user';
    const isSystem = item.sender === 'system';
    if (isSystem || item.type === 'friendRequestSent') {
      return (
        <View className="my-2 self-center bg-[#2E2E4D] rounded-lg px-4 py-2">
          <Text className="text-gray-300 text-sm">{item.text}</Text>
        </View>
      );
    }
    if (item.type === 'friendRequestReceived') {
      return (
        <View className="my-2 self-center bg-[#2E2E4D] rounded-lg px-4 py-2">
          <Text className="text-gray-300 text-sm mb-2">{item.text}</Text>
          <View className="flex-row justify-center gap-3">
            <TouchableOpacity
              onPress={() => handleAcceptFriendRequest(item.timestamp)}
              className="bg-indigo-600 px-4 py-2 rounded-xl shadow-sm active:scale-95"
              disabled={chatEnded}
            >
              <Text className="text-white text-sm font-semibold">Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRejectFriendRequest(item.timestamp)}
              className="bg-red-600 px-4 py-2 rounded-xl shadow-sm active:scale-95"
              disabled={chatEnded}
            >
              <Text className="text-white text-sm font-semibold">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View className={`my-2 max-w-[75%] ${isUser ? 'self-end' : 'self-start'}`}>
        <View className={`px-4 py-3 rounded-2xl shadow-sm ${isUser ? 'bg-indigo-600' : 'bg-[#2E2E4D]'}`}>
          <Text className="text-white text-base leading-5">{item.text}</Text>
        </View>
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-gray-400">{moment(item.timestamp).format('h:mm A')}</Text>
          {isUser && item.seen && <Text className="text-xs text-green-400">Seen</Text>}
        </View>
      </View>
    );
  };

  const isSendFriendRequestDisabled: any =
    !partnerId ||
    connectionStatus === 'disconnected' ||
    chatEnded ||
    (friendRequestSent && (friendRequestSent.fromUserId === user?._id || friendRequestSent.fromUserId === partnerId));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-[#1C1C3A] px-4 pt-10">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => setLeaveConfirmVisible(true)} disabled={chatEnded}>
            <Ionicons name="chevron-back" size={28} color={chatEnded ? '#A0A0A0' : '#5B2EFF'} />
          </TouchableOpacity>
          <Text className="text-white text-lg font-semibold">{partnerName || 'Anonymous'}</Text>
          <TouchableOpacity onPress={toggleExtraButtons} disabled={chatEnded}>
            <Ionicons
              name="ellipsis-vertical"
              size={24}
              color={showExtraButtons && !chatEnded ? '#5B2EFF' : '#A0A0A0'}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setIsPartnerInfoVisible(!isPartnerInfoVisible)}
          className="self-center bg-[#2E2E4D] rounded-lg px-4 py-2 my-2 flex-row items-center"
          disabled={chatEnded}
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
          <View className="self-center bg-[#2E2E4D] rounded-lg px-4 py-2 mb-4">
            <Text className="text-gray-300 text-sm">{partnerBio || 'Loading...'}</Text>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          renderItem={renderMessage}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 150 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        {isPartnerTyping && !chatEnded && (
          <View className="px-4 pb-2">
            <Text className="text-white text-sm">...</Text>
            <Text className="text-gray-400 text-xs">typing</Text>
          </View>
        )}
        <View className="mb-4">
          <View className="flex-row items-center bg-[#2E2E4D] rounded-full p-2 shadow-sm">
            <TouchableOpacity className="p-2" disabled={chatEnded}>
              <Ionicons name="camera-outline" size={24} color={chatEnded ? '#A0A0A0' : '#5B2EFF'} />
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
              editable={connectionStatus !== 'disconnected' && !chatEnded}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={isSending || connectionStatus === 'disconnected' || !input.trim() || chatEnded}
              className={`p-2 ${
                isSending || connectionStatus === 'disconnected' || !input.trim() || chatEnded ? 'opacity-50' : ''
              }`}
            >
              <Ionicons name="send" size={24} color={chatEnded ? '#A0A0A0' : '#5B2EFF'} />
            </TouchableOpacity>
          </View>
          {showExtraButtons && (
            <View className="mt-3 gap-2">
              <TouchableOpacity
                onPress={handleSendFriendRequest}
                disabled={isSendFriendRequestDisabled}
                className={`flex-row items-center justify-center py-3 rounded-xl shadow-sm active:scale-95 ${
                  isSendFriendRequestDisabled ? 'bg-gray-600 opacity-50' : 'bg-indigo-600'
                }`}
              >
                <Ionicons name="person-add-outline" size={20} color="white" className="mr-2" />
                <Text className="text-white text-base font-semibold">Send Friend Request</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLeaveConfirmVisible(true)}
                disabled={chatEnded}
                className={`flex-row items-center justify-center py-3 rounded-xl shadow-sm active:scale-95 ${
                  chatEnded ? 'bg-gray-600 opacity-50' : 'bg-red-600'
                }`}
              >
                <Ionicons name="close-circle-outline" size={20} color="white" className="mr-2" />
                <Text className="text-white text-base font-semibold">End Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNewPartner}
                disabled={chatEnded}
                className={`flex-row items-center justify-center py-3 rounded-xl shadow-sm active:scale-95 ${
                  chatEnded ? 'bg-gray-600 opacity-50' : 'bg-[#2E2E4D]'
                }`}
              >
                <Ionicons name="refresh-outline" size={20} color={chatEnded ? '#A0A0A0' : '#5B2EFF'} className="mr-2" />
                <Text className="text-white text-base font-semibold">New Partner</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <Modal
          visible={leaveConfirmVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCancelLeave}
        >
          <View className="flex-1 justify-center items-center bg-black/50 px-6">
            <View className="bg-[#2E2E4D] rounded-xl p-6 w-full max-w-md shadow-lg">
              <Text className="text-white text-lg font-semibold mb-3">End Chat?</Text>
              <Text className="text-gray-300 mb-5">Leaving will disconnect you from this chat. Are you sure?</Text>
              <View className="flex-row justify-end gap-3">
                <TouchableOpacity
                  onPress={handleCancelLeave}
                  className="bg-gray-500 px-4 py-2 rounded-xl shadow-sm active:scale-95"
                >
                  <Text className="text-white font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLeaveChat}
                  className="bg-red-600 px-4 py-2 rounded-xl shadow-sm active:scale-95"
                >
                  <Text className="text-white font-medium">Leave</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Chat;