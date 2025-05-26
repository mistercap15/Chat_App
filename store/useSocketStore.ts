import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';
import useUserStore from './useUserStore';
import { BASE_URL } from '@/utils/constants';
import Toast from 'react-native-toast-message';
import { AppState, AppStateStatus } from 'react-native';
import api from '@/utils/api';

interface FriendRequest {
  fromUserId: string;
  fromUsername: string;
}

interface SocketStore {
  socket: any | null;
  userId: string | null;
  randomPartnerId: string | null;
  randomChatType: 'random' | null;
  friendPartnerId: string | null;
  friendChatType: 'friend' | null;
  isSearching: boolean;
  username: string | null;
  randomPartnerName: string | null;
  friendPartnerName: string | null;
  isPartnerTyping: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  friendRequest: FriendRequest | null;
  friendRequestSent: { fromUserId: string; toUserId: string; fromUsername: string } | null;
  isConnecting: boolean;
  connectSocket: (userId: string) => void;
  startSearching: (onMatched: () => void) => void;
  stopSearching: () => void;
  startFriendChat: (friendId: string, onStarted: () => void) => void;
  setRandomPartnerId: (partnerId: string | null, chatType?: 'random') => void;
  setFriendPartnerId: (partnerId: string | null, chatType?: 'friend') => void;
  setUsername: (username: string | null) => void;
  setRandomPartnerName: (partnerName: string | null) => void;
  setFriendPartnerName: (partnerName: string | null) => void;
  setPartnerTyping: (isTyping: boolean) => void;
  emitTyping: (isFriendChat: boolean) => void;
  emitMessageSeen: (timestamp: number, isFriendChat: boolean) => void;
  emitFriendRequestSent: () => void;
  resetRandomChatState: () => void;
  resetFriendChatState: () => void;
  resetState: () => void;
  clearFriendRequestSent: () => void;
}

const useSocketStore = create<SocketStore>((set, get) => {
  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] SocketStore: ${message}`, data || '');
  };

  const fetchPendingFriendRequests = async (userId: string) => {
    try {
      const response = await api.get(`/api/users/pending-friend-requests/${userId}`);
      const { friendRequests } = response.data;
      log('Fetched pending friend requests', { userId, requestCount: friendRequests.length });
      if (friendRequests.length > 0) {
        set({ friendRequest: friendRequests[friendRequests.length - 1] });
      }
    } catch (error: any) {
      log('Error fetching pending friend requests', { userId, error: error.message });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to fetch pending friend requests.',
      });
    }
  };

  const connectSocket = (userId: string) => {
    log('Attempting to connect socket', { userId });
    const { socket, isConnecting } = get();

    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      log('Invalid userId for connectSocket', { userId });
      return;
    }

    if (socket?.connected && get().userId === userId) {
      log('Socket already connected with same userId', { userId });
      return;
    }

    if (isConnecting) {
      log('Socket connection in progress, skipping', { userId });
      return;
    }

    if (socket) {
      log('Disconnecting existing socket', { userId });
      socket.disconnect();
      set({ socket: null, connectionStatus: 'disconnected', isConnecting: false });
    }

    set({ connectionStatus: 'connecting', isConnecting: true });
    const user = useUserStore.getState().user;
    const newSocket = io(BASE_URL, {
      query: { userId, username: user?.user_name || 'Anonymous' },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      log('Socket connected successfully', { userId, socketId: newSocket.id });
      set({ socket: newSocket, connectionStatus: 'connected', isConnecting: false });
      newSocket.emit('set_username', {
        userId,
        username: user?.user_name || 'Anonymous',
      });
      log('Emitted set_username', { userId, username: user?.user_name });
      fetchPendingFriendRequests(userId);
      const { randomPartnerId, friendPartnerId, userId: currentUserId } = get();
      if (randomPartnerId && currentUserId) {
        const roomId = [currentUserId, randomPartnerId].sort().join('-');
        newSocket.emit('join_room', { roomId, userId: currentUserId });
        log('Rejoined random chat room', { roomId, userId: currentUserId });
      }
      if (friendPartnerId && currentUserId) {
        const roomId = [currentUserId, friendPartnerId].sort().join('_');
        newSocket.emit('join_room', { roomId, userId: currentUserId });
        log('Rejoined friend chat room', { roomId, userId: currentUserId });
      }
    });

    newSocket.on('reconnect', (attempt: number) => {
      log('Socket reconnected', { userId, attempt });
      set({ connectionStatus: 'connected', isConnecting: false });
      newSocket.emit('set_username', {
        userId,
        username: user?.user_name || 'Anonymous',
      });
      fetchPendingFriendRequests(userId);
    });

    newSocket.on('reconnect_attempt', (attempt: number) => {
      log('Socket reconnect attempt', { userId, attempt });
    });

    newSocket.on('reconnect_failed', () => {
      log('Socket reconnect failed', { userId });
      set({ connectionStatus: 'disconnected', isSearching: false, isConnecting: false });
      Toast.show({
        type: 'error',
        text1: 'Connection Lost',
        text2: 'Failed to reconnect to the server.',
      });
    });

    newSocket.on('match_found', ({ partnerId, partnerName }: { partnerId: string; partnerName: string }) => {
      log('Match found', { partnerId, partnerName });
      if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
        log('Invalid partnerId', { partnerId });
        set({ isSearching: false });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid partner ID.' });
        return;
      }
      set({
        randomPartnerId: partnerId,
        randomPartnerName: partnerName || 'Anonymous',
        isSearching: false,
        randomChatType: 'random',
      });
      const onMatched = (get().startSearching as any).onMatched;
      if (onMatched) {
        log('Calling onMatched callback');
        onMatched();
      }
    });

    newSocket.on('partner_typing', ({ fromUserId }: { fromUserId: string }) => {
      const { randomPartnerId, friendPartnerId } = get();
      if (fromUserId === randomPartnerId || fromUserId === friendPartnerId) {
        log('Partner typing', { fromUserId });
        set({ isPartnerTyping: true });
      }
    });

    newSocket.on('message_seen', ({ fromUserId, timestamp }: { fromUserId: string; timestamp: number }) => {
      const { randomPartnerId, friendPartnerId } = get();
      if (fromUserId === randomPartnerId || fromUserId === friendPartnerId) {
        log('Message seen', { fromUserId, timestamp });
      }
    });

    newSocket.on('friend_request_received', ({ fromUserId, fromUsername }: { fromUserId: string; fromUsername: string }) => {
      log('Friend request received', { fromUserId, fromUsername });
      set({ friendRequest: { fromUserId, fromUsername } });
    });

    newSocket.on('friend_request_status', ({ fromUserId, toUserId, fromUsername, status }: { fromUserId: string; toUserId: string; fromUsername: string; status: string }) => {
      log('Friend request status', { fromUserId, toUserId, status });
      if (status === 'sent') {
        set({ friendRequestSent: { fromUserId, toUserId, fromUsername } });
      } else if (status === 'rejected') {
        set({ friendRequestSent: null });
      }
    });

    newSocket.on('friend_request_accepted', ({ userId, friendId }: { userId: string; friendId: string }) => {
      log('Friend request accepted', { userId, friendId });
      set({ friendRequestSent: null, friendRequest: null });
      const { randomPartnerId } = get();
      if (randomPartnerId && (friendId === randomPartnerId || userId === randomPartnerId)) {
        log('Resetting random chat session');
        get().resetRandomChatState();
      }
    });

    newSocket.on('error', ({ message }: { message: string }) => {
      log('Socket error', { message });
      Toast.show({ type: 'error', text1: 'Error', text2: message });
      if (get().isSearching) {
        set({ isSearching: false });
      }
    });

    newSocket.on('disconnect', () => {
      log('Socket disconnected', { userId });
      set({ connectionStatus: 'disconnected', isPartnerTyping: false, isConnecting: false });
    });

    set({ socket: newSocket, userId });
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    const { socket, userId, randomPartnerId, friendPartnerId } = get();
    log('AppState changed', { nextAppState, userId });
    if (nextAppState === 'active' && userId) {
      if (!socket || !socket.connected) {
        log('App foregrounded, reconnecting', { userId });
        connectSocket(userId);
      }
      if (randomPartnerId) {
        const roomId = [userId, randomPartnerId].sort().join('-');
        socket?.emit('join_room', { roomId, userId });
        log('Rejoined random chat room', { roomId, userId });
      }
      if (friendPartnerId) {
        const roomId = [userId, friendPartnerId].sort().join('_');
        socket?.emit('join_room', { roomId, userId });
        log('Rejoined friend chat room', { roomId, userId });
      }
      fetchPendingFriendRequests(userId);
    }
  };

  AppState.addEventListener('change', handleAppStateChange);

  return {
    socket: null,
    userId: null,
    randomPartnerId: null,
    randomChatType: null,
    friendPartnerId: null,
    friendChatType: null,
    isSearching: false,
    username: null,
    randomPartnerName: null,
    friendPartnerName: null,
    isPartnerTyping: false,
    connectionStatus: 'disconnected',
    friendRequest: null,
    friendRequestSent: null,
    isConnecting: false,
    connectSocket,
    startSearching: (onMatched: () => void) => {
      const { socket, userId, isSearching } = get();
      log('Starting search', { userId, isSearching });
      if (!userId || !socket?.connected) {
        log('Cannot start search: not connected', { userId, socketConnected: !!socket?.connected });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Not connected to server.' });
        return;
      }
      if (isSearching) {
        log('Already searching', { userId });
        return;
      }
      set({ isSearching: true });
      socket.emit('start_search', { userId, username: get().username });
      (get().startSearching as any).onMatched = onMatched;
      log('Search emitted', { userId });
    },
    stopSearching: () => {
      const { socket, userId, isSearching } = get();
      log('Stopping search', { userId, isSearching });
      if (isSearching && socket?.connected && userId) {
        socket.emit('stop_search', { userId });
        set({ isSearching: false, isPartnerTyping: false });
        log('Search stopped', { userId });
      }
    },
    startFriendChat: (friendId: string, onStarted: () => void) => {
      const { socket, userId } = get();
      log('Starting friend chat', { userId, friendId });
      if (!userId || !friendId || !socket?.connected) {
        log('Cannot start friend chat', { userId, friendId, socketConnected: !!socket?.connected });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or friend ID.' });
        return;
      }
      set({ friendChatType: 'friend' });
      socket.emit('start_friend_chat', { userId, friendId, username: get().username });
      onStarted();
      log('Friend chat emitted', { userId, friendId });
    },
    setRandomPartnerId: (partnerId, chatType = 'random') => {
      log('Setting randomPartnerId', { partnerId, chatType });
      set({ randomPartnerId: partnerId, randomChatType: chatType });
    },
    setFriendPartnerId: (partnerId, chatType = 'friend') => {
      log('Setting friendPartnerId', { partnerId, chatType });
      set({ friendPartnerId: partnerId, friendChatType: chatType });
    },
    setUsername: (username) => {
      log('Setting username', { username });
      set({ username });
    },
    setRandomPartnerName: (partnerName) => {
      log('Setting randomPartnerName', { partnerName });
      set({ randomPartnerName: partnerName });
    },
    setFriendPartnerName: (partnerName) => {
      log('Setting friendPartnerName', { partnerName });
      set({ friendPartnerName: partnerName });
    },
    setPartnerTyping: (isTyping) => {
      log('Setting partner typing', { isTyping });
      set({ isPartnerTyping: isTyping });
    },
    emitTyping: (isFriendChat: boolean) => {
      const { socket, userId, randomPartnerId, friendPartnerId } = get();
      const partnerId = isFriendChat ? friendPartnerId : randomPartnerId;
      log('Emitting typing', { userId, partnerId, isFriendChat });
      if (socket?.connected && partnerId && userId) {
        socket.emit('typing', { toUserId: partnerId, fromUserId: userId });
      }
    },
    emitMessageSeen: (timestamp: number, isFriendChat: boolean) => {
      const { socket, userId, randomPartnerId, friendPartnerId } = get();
      const partnerId = isFriendChat ? friendPartnerId : randomPartnerId;
      log('Emitting message seen', { userId, partnerId, timestamp, isFriendChat });
      if (socket?.connected && partnerId && userId) {
        socket.emit('message_seen', { toUserId: partnerId, fromUserId: userId, timestamp });
      }
    },
    emitFriendRequestSent: () => {
      const { socket, userId, randomPartnerId, username } = get();
      log('Emitting friend request sent', { userId, partnerId: randomPartnerId });
      if (socket?.connected && userId && randomPartnerId) {
        socket.emit('friend_request_sent', { toUserId: randomPartnerId, fromUserId: userId, fromUsername: username });
      }
    },
    resetRandomChatState: () => {
      log('Resetting random chat state');
      set({
        randomPartnerId: null,
        randomChatType: null,
        randomPartnerName: null,
        isPartnerTyping: false,
        isSearching: false,
      });
    },
    resetFriendChatState: () => {
      log('Resetting friend chat state');
      set({
        friendPartnerId: null,
        friendChatType: null,
        friendPartnerName: null,
        isPartnerTyping: false,
      });
    },
    resetState: () => {
      log('Resetting socket state');
      const { socket } = get();
      if (socket?.connected) {
        socket.disconnect();
        log('Socket disconnected during reset');
      }
      set({
        socket: null,
        userId: null,
        randomPartnerId: null,
        randomChatType: null,
        friendPartnerId: null,
        friendChatType: null,
        isSearching: false,
        randomPartnerName: null,
        friendPartnerName: null,
        isPartnerTyping: false,
        connectionStatus: 'disconnected',
        friendRequest: null,
        friendRequestSent: null,
        username: null,
        isConnecting: false,
      });
    },
    clearFriendRequestSent: () => {
      log('Clearing friend request sent');
      set({ friendRequestSent: null });
    },
  };
});

// Debounce subscription to user store
let lastUserId: string | null = null;
let debounceTimeout: NodeJS.Timeout | null = null;

useUserStore.subscribe((state) => {
  const newUserId = state.user?._id?.toString() || null;
  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] SocketStore: ${message}`, data || '');
  };

  log('User store subscription triggered', { newUserId, lastUserId });

  if (newUserId === lastUserId) {
    log('No userId change, skipping', { newUserId });
    return;
  }

  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  debounceTimeout = setTimeout(() => {
    lastUserId = newUserId;
    const { socket, userId } = useSocketStore.getState();

    if (!newUserId) {
      log('No user ID, resetting state');
      useSocketStore.getState().resetState();
      return;
    }

    if (newUserId !== userId || !socket?.connected) {
      log('User ID changed or socket disconnected, reconnecting', { newUserId, userId });
      useSocketStore.getState().resetState();
      useSocketStore.getState().connectSocket(newUserId);
    }
  }, 500);
});

export default useSocketStore;