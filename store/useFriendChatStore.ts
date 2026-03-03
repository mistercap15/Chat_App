import { create } from 'zustand';
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
  emitStopTyping: (socket: any) => void;
  emitMessageSeen: (socket: any, timestamp: number) => void;
  fetchChatHistory: (friendId: string, page?: number, limit?: number) => Promise<{ messages: any[]; hasMore: boolean }>;
  sendMessage: (friendId: string, message: string, clientMessageId: string) => Promise<{ messageId: string; timestamp: number } | null>;
  reset: () => void;
  initializeListeners: (socket: any) => () => void;
}

const useFriendChatStore = create<FriendChatStore>((set, get) => ({
  partnerId: null,
  partnerName: null,
  isPartnerTyping: false,
  chatType: null,
  setPartner: (partnerId, partnerName) => {
    set({ partnerId, partnerName, chatType: partnerId ? 'friend' : null });
  },
  setPartnerTyping: (isTyping) => set({ isPartnerTyping: isTyping }),
  startFriendChat: (socket, friendId, onStarted) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId || !socket?.connected) {
      // Socket not ready yet — the effect in the chat screen will retry when it connects
      return;
    }

    let started = false;
    const handleStarted = () => {
      if (started) return;
      started = true;
      socket.off('friend_chat_started', handleStarted);
      onStarted();
    };
    socket.off('friend_chat_started');
    socket.on('friend_chat_started', handleStarted);

    // Backend uses JWT to identify user — only friendId needed
    socket.emit('start_friend_chat', { friendId });

    // Fallback: if server doesn't respond within 3s, proceed anyway
    setTimeout(handleStarted, 3000);
  },
  emitTyping: (socket) => {
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId) {
      socket.emit('typing', { toUserId: partnerId });
    }
  },
  emitStopTyping: (socket) => {
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId) {
      socket.emit('stop_typing', { toUserId: partnerId });
    }
  },
  emitMessageSeen: (socket, timestamp) => {
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId) {
      socket.emit('message_seen', { toUserId: partnerId, timestamp });
    }
  },
  fetchChatHistory: async (friendId, page = 1, limit = 50) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId) return { messages: [], hasMore: false };
    try {
      const response = await api.get(`/api/chats/${friendId}?page=${page}&limit=${limit}`);
      const { messages, total } = response.data;
      const mapped = (messages || []).map((msg: any) => ({
        messageId: msg._id,
        text: msg.text,
        sender: msg.senderId === userId ? 'user' : 'friend',
        timestamp: new Date(msg.timestamp).getTime(),
        seen: msg.seen,
      }));
      return { messages: mapped, hasMore: total > page * limit };
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat history.' });
      return { messages: [], hasMore: false };
    }
  },
  sendMessage: async (friendId, message, clientMessageId) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId || !message.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid input or user.' });
      return null;
    }
    try {
      const response = await api.post('/api/chats/send', { friendId, message, clientMessageId });
      const data = response.data;
      const msg = data.message || data;
      const msgId = msg?._id || msg?.messageId || msg?.id;
      const msgTimestamp = msg?.timestamp
        ? new Date(msg.timestamp).getTime()
        : msg?.createdAt
        ? new Date(msg.createdAt).getTime()
        : null;
      if (msgId) {
        return { messageId: msgId, timestamp: msgTimestamp || Date.now() };
      }
      return null;
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to send message.' });
      throw error;
    }
  },
  reset: () => {
    set({ partnerId: null, partnerName: null, isPartnerTyping: false, chatType: null });
  },
  initializeListeners: (socket) => {
    const handlePartnerTyping = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === get().partnerId) {
        set({ isPartnerTyping: true });
      }
    };
    const handlePartnerStopTyping = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === get().partnerId) {
        set({ isPartnerTyping: false });
      }
    };
    const handleFriendRemoved = ({ removedUserId }: { removedUserId: string }) => {
      const partnerId = get().partnerId;
      if (removedUserId === partnerId) {
        // Leave the socket room before resetting so the server can clean up gracefully
        if (socket?.connected && partnerId) {
          socket.emit('leave_friend_chat', { friendId: partnerId });
        }
        Toast.show({ type: 'info', text1: 'Friend Removed', text2: 'This friend has been removed.' });
        get().reset();
      }
    };

    socket.on('partner_typing', handlePartnerTyping);
    socket.on('partner_stop_typing', handlePartnerStopTyping);
    socket.on('friend_removed', handleFriendRemoved);

    return () => {
      socket.off('partner_typing', handlePartnerTyping);
      socket.off('partner_stop_typing', handlePartnerStopTyping);
      socket.off('friend_removed', handleFriendRemoved);
    };
  },
}));

export default useFriendChatStore;
