import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Animated,
  Easing,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import moment from "moment";
import { Ionicons } from "@expo/vector-icons";
import { UserPlus, LogOut, Shuffle, X, Check, Send, ChevronLeft, MoreVertical, ChevronDown, ChevronUp } from "lucide-react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";
import useSocketStore from "@/store/useSocketStore";
import useUserStore from "@/store/useUserStore";
import useRandomChatStore from "@/store/useRandomChatStore";
import useFriendRequestStore from "@/store/useFriendRequestStore";
import api from "@/utils/api";

interface Message {
  text: string;
  sender: "user" | "partner" | "system";
  timestamp: number;
  seen?: boolean;
  type?: "friendRequestSent" | "friendRequestReceived" | "system";
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

const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastTypingTime, setLastTypingTime] = useState<number | null>(null);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastDisconnectTime, setLastDisconnectTime] = useState<number | null>(null);
  const [isPartnerInfoVisible, setIsPartnerInfoVisible] = useState(false);
  const [showExtraButtons, setShowExtraButtons] = useState(false);
  const [chatEnded, setChatEnded] = useState(false);
  const [partnerBio, setPartnerBio] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isChatInitialized = useRef(false);
  const isMounted = useRef(true);
  const hasJoinedRoom = useRef(false);
  const isIntentionallyLeaving = useRef(false);
  const isInitialMount = useRef(true);

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

  useEffect(() => {
    if (!partnerId) {
      setPartnerBio(null);
      return;
    }

    const fetchPartnerBio = async () => {
      try {
        const response = await api.get(`/api/users/${partnerId}`);
        const { bio } = response.data;
        setPartnerBio(bio || "No bio available");
      } catch (error: any) {
        setPartnerBio("No bio available");
      }
    };

    fetchPartnerBio();
  }, [partnerId]);

  const TYPING_TIMEOUT = 3000;
  const DISCONNECT_GRACE_PERIOD = 60000;
  const DEDUPE_WINDOW = 1000;

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Chat: ${message}`, data || "");
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
      router.replace("/(tabs)/friends");
    },
    [reset]
  );

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
      router.replace("/(tabs)/home");
    },
    [reset]
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      if (!isMounted.current || chatEnded || friendRequestAccepted || isIntentionallyLeaving.current) {
        return;
      }
      e.preventDefault();
      setLeaveConfirmVisible(true);
    });

    return unsubscribe;
  }, [navigation, chatEnded, friendRequestAccepted]);

  useEffect(() => {
    isMounted.current = true;
    isInitialMount.current = true;
    const cleanup = initializeListeners(socket);

    const chatReadyListener = () => {
      isChatInitialized.current = true;
      isInitialMount.current = false;
    };

    socket?.on("chat_ready", chatReadyListener);

    return () => {
      isMounted.current = false;
      isInitialMount.current = false;
      cleanup();
      socket?.offAnyOutgoing();
      socket?.off("chat_ready", chatReadyListener);
    };
  }, [socket, initializeListeners]);

  useEffect(() => {
    if (friendRequestAccepted) {
      navigateToFriends(true);
      setFriendRequestAccepted(false);
    }
  }, [friendRequestAccepted, navigateToFriends, setFriendRequestAccepted]);

  useFocusEffect(
    useCallback(() => {
      if (!partnerId || !partnerName || !user?._id || !socket?.connected) {
        if (friendRequestAccepted) return;
        navigateToHome(true);
        return;
      }

      if (!hasJoinedRoom.current) {
        const roomId = [user._id, partnerId].sort().join("-");
        socket.emit("join_room", { roomId, userId: user._id });
        hasJoinedRoom.current = true;
      }

      return () => {
        if (isIntentionallyLeaving.current && !leaveConfirmVisible && socket?.connected && partnerId && !chatEnded) {
          socket.emit("leave_chat", { toUserId: partnerId });
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
      if (fromUserId === partnerId && isChatInitialized.current) {
        setMessages((prev): any => {
          const recentMessages = prev.filter((msg) => Math.abs(msg.timestamp - timestamp) < DEDUPE_WINDOW);
          if (recentMessages.some((msg) => msg.text === message && msg.sender === "partner")) {
            return prev;
          }
          const newMessage = { text: message, sender: "partner", timestamp, seen: false };
          flatListRef.current?.scrollToEnd({ animated: true });
          return [...prev, newMessage];
        });
        emitMessageSeen(socket, timestamp);
      }
    };

    const partnerDisconnectedListener = ({ disconnectedUserId }: { disconnectedUserId: string }) => {
      if (!isMounted.current || disconnectedUserId !== partnerId || !isChatInitialized.current || chatEnded) return;
      const now = Date.now();
      if (lastDisconnectTime && now - lastDisconnectTime < DISCONNECT_GRACE_PERIOD) return;
      setLastDisconnectTime(now);
      setChatEnded(true);
      setMessages((prev) => [
        ...prev,
        { text: "Partner has left the chat", sender: "system", timestamp: Date.now(), type: "system" },
      ]);
      flatListRef.current?.scrollToEnd({ animated: true });
    };

    const messageSeenListener = ({ fromUserId, timestamp }: { fromUserId: string; timestamp: number }) => {
      if (!isMounted.current || fromUserId !== partnerId) return;
      setMessages((prev) =>
        prev.map((msg) => (msg.sender === "user" && msg.timestamp === timestamp ? { ...msg, seen: true } : msg))
      );
    };

    socket.on("receive_message", messageListener);
    socket.on("partner_disconnected", partnerDisconnectedListener);
    socket.on("message_seen", messageSeenListener);

    return () => {
      socket.off("receive_message", messageListener);
      socket.off("partner_disconnected", partnerDisconnectedListener);
      socket.off("message_seen", messageSeenListener);
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
      setMessages((prev) => {
        if (prev.some((msg) => msg.type === "friendRequestReceived" && msg.sender === "partner")) return prev;
        return [
          ...prev,
          {
            text: `${friendRequest.fromUsername} wants to be friends!`,
            sender: "partner",
            timestamp: Date.now(),
            type: "friendRequestReceived",
          },
        ];
      });
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [friendRequest, chatEnded]);

  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
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

  const sendMessageHandler = async () => {
    if (isSending || chatEnded || !isChatInitialized.current) return;
    setIsSending(true);
    if (!input.trim()) {
      setIsSending(false);
      return;
    }
    if (!user?._id || !partnerId || !socket?.connected) {
      Toast.show({ type: "error", text1: "Error", text2: "Chat is not properly initialized." });
      setIsSending(false);
      return;
    }
    const timestamp = Date.now();
    const newMessage = { text: input, sender: "user", timestamp, seen: false };
    setMessages((prev): any => [...prev, newMessage]);
    setInput("");
    flatListRef.current?.scrollToEnd({ animated: true });

    try {
      socket.emit("send_message", { toUserId: partnerId, message: input, fromUserId: user._id, timestamp });
    } catch (error: any) {
      setMessages((prev) => prev.filter((msg) => msg.timestamp !== timestamp));
      Toast.show({ type: "error", text1: "Error", text2: "Failed to send message." });
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
      { text: "Friend request sent!", sender: "user", timestamp: Date.now(), seen: false, type: "friendRequestSent" },
    ]);
    setShowExtraButtons(false);
  };

  const handleAcceptFriendRequest = async (timestamp: number) => {
    if (!user?._id || !partnerId) return;
    await acceptFriendRequest(partnerId);
    navigateToFriends(true);
  };

  const handleRejectFriendRequest = async (timestamp: number) => {
    if (!user?._id || !partnerId) return;
    try {
      await rejectFriendRequest(partnerId);
      setMessages((prev) =>
        prev.filter((msg) => !(msg.type === "friendRequestReceived" && msg.timestamp === timestamp))
      );
      socket?.emit("friend_request_rejected", { fromUserId: partnerId, toUserId: user._id });
      Toast.show({ type: "success", text1: "Rejected", text2: "Friend request rejected." });
    } catch (error: any) {
      Toast.show({ type: "error", text1: "Error", text2: "Failed to reject friend request." });
    }
  };

  const handleLeaveChat = useCallback(() => {
    if (!isMounted.current || chatEnded) return;
    isIntentionallyLeaving.current = true;
    if (socket?.connected && partnerId) {
      socket.emit("leave_chat", { toUserId: partnerId });
    }
    setChatEnded(true);
    setMessages((prev) => [
      ...prev,
      { text: "You left the chat", sender: "system", timestamp: Date.now(), type: "system" },
    ]);
    setLeaveConfirmVisible(false);
    flatListRef.current?.scrollToEnd({ animated: true });
    navigateToHome(true);
  }, [socket, partnerId, navigateToHome]);

  const handleCancelLeave = useCallback(() => {
    setLeaveConfirmVisible(false);
  }, []);

  const handleNewPartner = () => {
    handleLeaveChat();
  };

  const toggleExtraButtons = () => {
    setShowExtraButtons((prev) => !prev);
  };

  const getPartnerInitial = () => {
    return (partnerName || "A").charAt(0).toUpperCase();
  };

  const isSendFriendRequestDisabled: boolean =
    !partnerId ||
    connectionStatus === "disconnected" ||
    chatEnded ||
    !!(friendRequestSent && (friendRequestSent.fromUserId === user?._id || friendRequestSent.fromUserId === partnerId)) ||
    !!(friendRequest && friendRequest.fromUserId === partnerId);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.sender === "user";
    const isSystem = item.sender === "system";
    const showTimestamp = index === messages.length - 1 ||
      messages[index + 1]?.sender !== item.sender ||
      (messages[index + 1]?.timestamp - item.timestamp > 60000);

    if (isSystem || item.type === "friendRequestSent") {
      return (
        <View style={{
          alignSelf: 'center',
          marginVertical: 8,
          backgroundColor: item.type === "friendRequestSent" ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.06)',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 6,
        }}>
          <Text style={{ color: item.type === "friendRequestSent" ? '#A78BFA' : '#8888AA', fontSize: 12, fontWeight: '500' }}>
            {item.text}
          </Text>
        </View>
      );
    }

    if (item.type === "friendRequestReceived") {
      return (
        <View style={{
          alignSelf: 'center',
          marginVertical: 8,
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: 'rgba(124, 58, 237, 0.2)',
          maxWidth: '85%',
        }}>
          <Text style={{ color: '#D4BFFF', fontSize: 13, textAlign: 'center', marginBottom: 10, fontWeight: '500' }}>
            {item.text}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => handleAcceptFriendRequest(item.timestamp)}
              disabled={chatEnded}
              activeOpacity={0.7}
              style={{
                backgroundColor: '#7C3AED',
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={14} color="white" />
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRejectFriendRequest(item.timestamp)}
              disabled={chatEnded}
              activeOpacity={0.7}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <X size={14} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

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
              {moment(item.timestamp).format("h:mm A")}
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, backgroundColor: '#0F0F2D' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(124, 58, 237, 0.1)',
        }}>
          <TouchableOpacity
            onPress={() => chatEnded ? navigateToHome(true) : setLeaveConfirmVisible(true)}
            style={{ padding: 4 }}
          >
            <ChevronLeft size={24} color={chatEnded ? "#64648F" : "#7C3AED"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsPartnerInfoVisible(!isPartnerInfoVisible)}
            disabled={chatEnded}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }}
          >
            <View style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: 'rgba(124, 58, 237, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}>
              <Text style={{ color: '#7C3AED', fontSize: 14, fontWeight: '700' }}>{getPartnerInitial()}</Text>
            </View>
            <View>
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{partnerName || "Anonymous"}</Text>
              <Text style={{ color: chatEnded ? '#EF4444' : '#22C55E', fontSize: 11 }}>
                {chatEnded ? 'Disconnected' : 'Online'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleExtraButtons} disabled={chatEnded} style={{ padding: 4 }}>
            <MoreVertical size={20} color={showExtraButtons && !chatEnded ? "#7C3AED" : "#64648F"} />
          </TouchableOpacity>
        </View>

        {/* Partner Bio */}
        {isPartnerInfoVisible && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 8,
            backgroundColor: 'rgba(124, 58, 237, 0.06)',
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: 'rgba(124, 58, 237, 0.1)',
          }}>
            <Text style={{ color: '#A78BFA', fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>About</Text>
            <Text style={{ color: '#C4C4E0', fontSize: 13, lineHeight: 18 }}>{partnerBio || "Loading..."}</Text>
          </View>
        )}

        {/* Action Buttons (Dropdown) */}
        {showExtraButtons && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 8,
            backgroundColor: '#161638',
            borderRadius: 12,
            padding: 4,
            borderWidth: 1,
            borderColor: 'rgba(124, 58, 237, 0.15)',
          }}>
            <TouchableOpacity
              onPress={handleSendFriendRequest}
              disabled={isSendFriendRequestDisabled}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderRadius: 8,
                opacity: isSendFriendRequestDisabled ? 0.4 : 1,
              }}
            >
              <UserPlus size={18} color="#7C3AED" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>Add Friend</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: 'rgba(124, 58, 237, 0.1)', marginHorizontal: 8 }} />
            <TouchableOpacity
              onPress={handleNewPartner}
              disabled={chatEnded}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderRadius: 8,
                opacity: chatEnded ? 0.4 : 1,
              }}
            >
              <Shuffle size={18} color="#7C3AED" />
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>New Partner</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: 'rgba(124, 58, 237, 0.1)', marginHorizontal: 8 }} />
            <TouchableOpacity
              onPress={() => { setShowExtraButtons(false); setLeaveConfirmVisible(true); }}
              disabled={chatEnded}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderRadius: 8,
                opacity: chatEnded ? 0.4 : 1,
              }}
            >
              <LogOut size={18} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '500', marginLeft: 12 }}>End Chat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          renderItem={renderMessage}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <Ionicons name="chatbubbles-outline" size={48} color="#2A2A5A" />
              <Text style={{ color: '#64648F', fontSize: 14, marginTop: 12 }}>Say hello to start the conversation!</Text>
            </View>
          }
        />

        {/* Typing Indicator */}
        {isPartnerTyping && !chatEnded && <TypingDots />}

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
              editable={connectionStatus !== "disconnected" && !chatEnded}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              onPress={sendMessageHandler}
              disabled={isSending || connectionStatus === "disconnected" || !input.trim() || chatEnded}
              activeOpacity={0.7}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: input.trim() && !chatEnded ? '#7C3AED' : 'rgba(124, 58, 237, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={17} color={input.trim() && !chatEnded ? 'white' : '#64648F'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Leave Confirmation Modal */}
        <Modal
          visible={leaveConfirmVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCancelLeave}
        >
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            paddingHorizontal: 32,
          }}>
            <View style={{
              backgroundColor: '#161638',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              borderWidth: 1,
              borderColor: 'rgba(124, 58, 237, 0.15)',
            }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                marginBottom: 16,
              }}>
                <LogOut size={22} color="#EF4444" />
              </View>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                Leave Chat?
              </Text>
              <Text style={{ color: '#8888AA', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
                You'll be disconnected from this conversation and won't be able to return.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={handleCancelLeave}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Stay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLeaveChat}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: '#EF4444',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Leave</Text>
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