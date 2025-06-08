import { create } from 'zustand';
import { Socket } from 'socket.io-client';
import useUserStore from './useUserStore';
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
  emitTyping: (socket: any) => void;
  emitMessageSeen: (socket: any, timestamp: number) => void;
  emitFriendRequestSent: (socket: any) => void;
  clearFriendRequestSent: () => void;
  reset: () => void;
  setFriendRequestAccepted: (accepted: boolean) => void;
  initializeListeners: (socket: any) => () => void;
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
    const handlePartnerTyping = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === get().partnerId) {
        set({ isPartnerTyping: true });
      }
    };
    const handleFriendRequest = ({ fromUserId, fromUsername }: { fromUserId: string; fromUsername: string }) => {
      console.log(`[${new Date().toISOString()}] handleFriendRequest: Received friend request`, {
        fromUserId,
        fromUsername,
        partnerId: get().partnerId,
      });
      if (fromUserId === get().partnerId) {
        set({ friendRequest: { fromUserId, fromUsername } });
      } else {
        console.log(`[${new Date().toISOString()}] handleFriendRequest: Ignored, fromUserId does not match partnerId`, {
          fromUserId,
          partnerId: get().partnerId,
        });
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
      console.log(`[${new Date().toISOString()}] handleFriendRequestStatus:`, { fromUserId, toUserId, status });
      if (status === 'sent') {
        set({ friendRequestSent: { fromUserId, toUserId, fromUsername } });
      } else if (status === 'rejected') {
        set({ friendRequestSent: null });
      }
    };
    const handleFriendRequestAccepted = () => {
      console.log(`[${new Date().toISOString()}] handleFriendRequestAccepted: Friend request accepted`);
      set({ friendRequestSent: null, friendRequest: null, friendRequestAccepted: true });
    };
    const handleFriendRequestRejected = ({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }) => {
      console.log(`[${new Date().toISOString()}] handleFriendRequestRejected: Friend request rejected`, {
        fromUserId,
        toUserId,
        partnerId: get().partnerId,
      });
      if (fromUserId === get().partnerId || toUserId === get().partnerId) {
        set({ friendRequest: null, friendRequestSent: null });
        Toast.show({ type: 'info', text1: 'Friend Request', text2: 'Friend request was rejected.' });
      }
    };

    socket.on('partner_typing', handlePartnerTyping);
    socket.on('friend_request_received', handleFriendRequest);
    socket.on('friend_request_status', handleFriendRequestStatus);
    socket.on('friend_request_accepted', handleFriendRequestAccepted);
    socket.on('friend_request_rejected', handleFriendRequestRejected);

    return () => {
      socket.off('partner_typing', handlePartnerTyping);
      socket.off('friend_request_received', handleFriendRequest);
      socket.off('friend_request_status', handleFriendRequestStatus);
      socket.off('friend_request_accepted', handleFriendRequestAccepted);
      socket.off('friend_request_rejected', handleFriendRequestRejected);
    };
  },
}));

export default useRandomChatStore;