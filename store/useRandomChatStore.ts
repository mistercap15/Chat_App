import { create } from 'zustand';
import useUserStore from './useUserStore';
import { AppSocket } from '@/types/socket';
import Toast from 'react-native-toast-message';

interface RandomChatStore {
  partnerId: string | null;
  partnerName: string | null;
  isPartnerTyping: boolean;
  chatType: 'random' | null;
  friendRequest: { fromUserId: string; fromUsername: string } | null;
  friendRequestSent: { fromUserId: string; toUserId: string; fromUsername: string } | null;
  friendRequestAccepted: boolean;
  setPartner: (partnerId: string | null, partnerName: string | null) => void;
  setPartnerTyping: (isTyping: boolean) => void;
  emitTyping: (socket: AppSocket | null) => void;
  emitStopTyping: (socket: AppSocket | null) => void;
  emitMessageSeen: (socket: AppSocket | null, timestamp: number) => void;
  emitFriendRequestSent: (socket: AppSocket | null) => void;
  clearFriendRequestSent: () => void;
  clearFriendRequest: () => void;
  reset: () => void;
  setFriendRequestAccepted: (accepted: boolean) => void;
  initializeListeners: (socket: AppSocket | null) => () => void;
}

const useRandomChatStore = create<RandomChatStore>((set, get) => ({
  partnerId: null,
  partnerName: null,
  isPartnerTyping: false,
  chatType: null,
  friendRequest: null,
  friendRequestSent: null,
  friendRequestAccepted: false,
  setPartner: (partnerId, partnerName) => {
    set({ partnerId, partnerName, chatType: partnerId ? 'random' : null });
  },
  setPartnerTyping: (isTyping) => set({ isPartnerTyping: isTyping }),
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
  emitFriendRequestSent: (socket) => {
    const userId = useUserStore.getState().user?._id;
    const partnerId = get().partnerId;
    const username = useUserStore.getState().user?.user_name || 'Anonymous';
    if (socket?.connected && userId && partnerId) {
      socket.emit('friend_request_sent', { toUserId: partnerId, fromUserId: userId, fromUsername: username });
    }
  },
  clearFriendRequestSent: () => set({ friendRequestSent: null }),
  clearFriendRequest: () => set({ friendRequest: null }),
  reset: () => {
    set({
      partnerId: null,
      partnerName: null,
      isPartnerTyping: false,
      chatType: null,
      friendRequest: null,
      friendRequestSent: null,
      friendRequestAccepted: false,
    });
  },
  setFriendRequestAccepted: (accepted) => set({ friendRequestAccepted: accepted }),
  initializeListeners: (socket) => {
    if (!socket) return () => {};
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
    const handleFriendRequest = ({ fromUserId, fromUsername }: { fromUserId: string; fromUsername: string }) => {
      if (fromUserId === get().partnerId) {
        set({ friendRequest: { fromUserId, fromUsername } });
      }
    };
    const handleFriendRequestStatus = ({
      fromUserId,
      toUserId,
      fromUsername,
      status,
    }: {
      fromUserId: string;
      toUserId: string;
      fromUsername: string;
      status: string;
    }) => {
      if (status === 'sent') {
        set({ friendRequestSent: { fromUserId, toUserId, fromUsername } });
      } else if (status === 'rejected') {
        set({ friendRequestSent: null });
      }
    };
    const handleFriendRequestAccepted = () => {
      set({ friendRequestSent: null, friendRequest: null, friendRequestAccepted: true });
    };
    const handleFriendRequestRejected = ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) => {
      if (fromUserId === get().partnerId || toUserId === get().partnerId) {
        set({ friendRequest: null, friendRequestSent: null });
        Toast.show({ type: 'info', text1: 'Friend Request', text2: 'Friend request was rejected.' });
      }
    };

    socket.on('partner_typing', handlePartnerTyping);
    socket.on('partner_stop_typing', handlePartnerStopTyping);
    socket.on('friend_request_received', handleFriendRequest);
    socket.on('friend_request_status', handleFriendRequestStatus);
    socket.on('friend_request_accepted', handleFriendRequestAccepted);
    socket.on('friend_request_rejected', handleFriendRequestRejected);

    return () => {
      socket.off('partner_typing', handlePartnerTyping);
      socket.off('partner_stop_typing', handlePartnerStopTyping);
      socket.off('friend_request_received', handleFriendRequest);
      socket.off('friend_request_status', handleFriendRequestStatus);
      socket.off('friend_request_accepted', handleFriendRequestAccepted);
      socket.off('friend_request_rejected', handleFriendRequestRejected);
    };
  },
}));

export default useRandomChatStore;