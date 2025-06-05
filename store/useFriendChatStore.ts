import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';
import useUserStore from './useUserStore';

interface FriendChatStore {
  partnerId: string | null;
  partnerName: string | null;
  isPartnerTyping: boolean;
  chatType: 'friend' | null;
  setPartner: (partnerId: string | null, partnerName: string | null) => void;
  setPartnerTyping: (isTyping: boolean) => void;
  startFriendChat: (socket: any, friendId: string, onStarted: () => void) => void;
  emitTyping: (socket: any) => void;
  emitMessageSeen: (socket: any, timestamp: number) => void;
  fetchChatHistory: (friendId: string) => Promise<any[]>;
  sendMessage: (friendId: string, message: string) => Promise<void>;
  reset: () => void;
  initializeListeners: (socket: any) => () => void;
}

const useFriendChatStore = create<FriendChatStore>((set, get) => ({
  partnerId: null,
  partnerName: null,
  isPartnerTyping: false,
  chatType: null,
  setPartner: (partnerId, partnerName) => {
    console.log(`[${new Date().toISOString()}] useFriendChatStore: Setting partner`, { partnerId, partnerName });
    set({ partnerId, partnerName, chatType: partnerId ? 'friend' : null });
  },
  setPartnerTyping: (isTyping) => set({ isPartnerTyping: isTyping }),
  startFriendChat: (socket, friendId, onStarted) => {
    const userId = useUserStore.getState().user?._id;
    const username = useUserStore.getState().user?.user_name || 'Anonymous';
    if (!userId || !friendId || !socket?.connected) {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Invalid startFriendChat params`, {
        userId,
        friendId,
        socketConnected: socket?.connected,
      });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or friend ID.' });
      return;
    }
    console.log(`[${new Date().toISOString()}] useFriendChatStore: Emitting start_friend_chat`, {
      userId,
      friendId,
      socketId: socket?.id,
    });
    socket.emit('start_friend_chat', { userId, friendId, username });
    onStarted();
  },
  emitTyping: (socket) => {
    const userId = useUserStore.getState().user?._id;
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId && userId) {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Emitting typing`, {
        toUserId: partnerId,
        fromUserId: userId,
        socketId: socket?.id,
      });
      socket.emit('typing', { toUserId: partnerId, fromUserId: userId });
    }
  },
  emitMessageSeen: (socket, timestamp) => {
    const userId = useUserStore.getState().user?._id;
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId && userId) {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Emitting message_seen`, {
        toUserId: partnerId,
        fromUserId: userId,
        timestamp,
        socketId: socket?.id,
      });
      socket.emit('message_seen', { toUserId: partnerId, fromUserId: userId, timestamp });
    }
  },
  fetchChatHistory: async (friendId) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId) {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Invalid fetchChatHistory params`, {
        userId,
        friendId,
      });
      return [];
    }
    try {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Fetching chat history`, { userId, friendId });
      const response = await api.get(`/api/chats/${userId}/${friendId}`);
      const messages = response.data.messages.map((msg: any) => ({
        messageId: msg._id, // Use server-provided ID
        text: msg.text,
        sender: msg.senderId === userId ? 'user' : 'friend',
        timestamp: new Date(msg.timestamp).getTime(),
        seen: msg.seen,
      }));
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Chat history fetched`, {
        messageCount: messages.length,
        messages: messages.map((m: any) => ({ messageId: m.messageId, text: m.text, timestamp: m.timestamp })),
      });
      return messages;
    } catch (error: any) {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Error fetching chat history`, {
        error: error.response?.data?.message || error.message,
      });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat history.' });
      return [];
    }
  },
  sendMessage: async (friendId, message) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId || !message.trim()) {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Invalid sendMessage params`, {
        userId,
        friendId,
        message,
      });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid input or user.' });
      return;
    }
    try {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Sending message`, { userId, friendId, message });
      await api.post('/api/chats/send', { userId, friendId, message });
    } catch (error: any) {
      console.log(`[${new Date().toISOString()}] useFriendChatStore: Error sending message`, {
        error: error.response?.data?.message || error.message,
      });
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to send message.' });
      throw error;
    }
  },
  reset: () => {
    console.log(`[${new Date().toISOString()}] useFriendChatStore: Resetting store`);
    set({ partnerId: null, partnerName: null, isPartnerTyping: false, chatType: null });
  },
  initializeListeners: (socket) => {
    const handlePartnerTyping = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === get().partnerId) {
        console.log(`[${new Date().toISOString()}] useFriendChatStore: Partner typing`, { fromUserId });
        set({ isPartnerTyping: true });
      }
    };
    const handleFriendRemoved = ({ removedUserId }: { removedUserId: string }) => {
      if (removedUserId === get().partnerId) {
        console.log(`[${new Date().toISOString()}] useFriendChatStore: Friend removed`, { removedUserId });
        Toast.show({ type: 'info', text1: 'Friend Removed', text2: 'This friend has been removed.' });
        get().reset();
      }
    };

    socket.on('partner_typing', handlePartnerTyping);
    socket.on('friend_removed', handleFriendRemoved);

    return () => {
      socket.off('partner_typing', handlePartnerTyping);
      socket.off('friend_removed', handleFriendRemoved);
    };
  },
}));

export default useFriendChatStore;