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
  emitStopTyping: (socket: any) => void;
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
    set({ partnerId, partnerName, chatType: partnerId ? 'friend' : null });
  },
  setPartnerTyping: (isTyping) => set({ isPartnerTyping: isTyping }),
  startFriendChat: (socket, friendId, onStarted) => {
    const userId = useUserStore.getState().user?._id;
    const username = useUserStore.getState().user?.user_name || 'Anonymous';
    if (!userId || !friendId || !socket?.connected) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or friend ID.' });
      return;
    }

    // Wait for server to confirm the room is ready before marking chat as initialized
    let started = false;
    const handleStarted = () => {
      if (started) return;
      started = true;
      socket.off('friend_chat_started', handleStarted);
      onStarted();
    };
    socket.off('friend_chat_started'); // Remove stale listener
    socket.on('friend_chat_started', handleStarted);

    socket.emit('start_friend_chat', { userId, friendId, username });

    // Fallback: if server doesn't respond within 3s, proceed anyway
    setTimeout(handleStarted, 3000);
  },
  emitTyping: (socket) => {
    const userId = useUserStore.getState().user?._id;
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId && userId) {
      socket.emit('typing', { toUserId: partnerId, fromUserId: userId });
    }
  },
  emitStopTyping: (socket) => {
    const userId = useUserStore.getState().user?._id;
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId && userId) {
      socket.emit('stop_typing', { toUserId: partnerId, fromUserId: userId });
    }
  },
  emitMessageSeen: (socket, timestamp) => {
    const userId = useUserStore.getState().user?._id;
    const partnerId = get().partnerId;
    if (socket?.connected && partnerId && userId) {
      socket.emit('message_seen', { toUserId: partnerId, fromUserId: userId, timestamp });
    }
  },
  fetchChatHistory: async (friendId) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId) return [];
    try {
      const response = await api.get(`/api/chats/${friendId}`);
      return response.data.messages.map((msg: any) => ({
        messageId: msg._id,
        text: msg.text,
        sender: msg.senderId === userId ? 'user' : 'friend',
        timestamp: new Date(msg.timestamp).getTime(),
        seen: msg.seen,
      }));
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load chat history.' });
      return [];
    }
  },
  sendMessage: async (friendId, message) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId || !message.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid input or user.' });
      return;
    }
    try {
      await api.post('/api/chats/send', { userId, friendId, message });
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
      if (removedUserId === get().partnerId) {
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