import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';
import useUserStore from './useUserStore';
import { BASE_URL } from '@/utils/constants';
import Toast from 'react-native-toast-message';
import { AppState, AppStateStatus } from 'react-native';

interface FriendRequest {
  fromUserId: string;
  fromUsername: string;
}

interface SocketStore {
  socket: any | null;
  userId: string | null;
  partnerId: string | null;
  isSearching: boolean;
  username: string | null;
  partnerName: string | null;
  isPartnerTyping: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  friendRequest: FriendRequest | null;
  connectSocket: (userId: string) => void;
  startSearching: (onMatched: () => void) => void;
  stopSearching: () => void;
  startFriendChat: (friendId: string, onStarted: () => void) => void;
  setPartnerId: (partnerId: string | null) => void;
  setUsername: (username: string | null) => void;
  setPartnerName: (partnerName: string | null) => void;
  setPartnerTyping: (isTyping: boolean) => void;
  emitTyping: () => void;
  emitMessageSeen: (timestamp: number) => void;
  sendFriendRequest: () => void;
  resetState: () => void;
}

const useSocketStore = create<SocketStore>((set, get) => {
  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] SocketStore: ${message}`, data || '');
  };

  const connectSocket = (userId: string) => {
    log('Attempting to connect socket', { userId });
    const { socket, connectionStatus } = get();

    if (connectionStatus === 'connecting') {
      log('Socket connection already in progress', { userId });
      return;
    }

    if (socket?.connected) {
      log('Socket already connected', { userId });
      return;
    }

    if (socket) {
      log('Disconnecting existing socket', { userId });
      socket.disconnect();
    }

    set({ connectionStatus: 'connecting' });
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
      set({ socket: newSocket, connectionStatus: 'connected' });
      // Rejoin room if partnerId exists
      const { partnerId, userId: currentUserId } = get();
      if (partnerId && currentUserId) {
        const roomId = [currentUserId, partnerId].sort().join('-');
        newSocket.emit('join_room', { roomId, userId: currentUserId });
        log('Rejoined room after reconnect', { roomId, userId: currentUserId });
      }
    });

    newSocket.on('reconnect', (attempt:any) => {
      log('Socket reconnected', { userId, attempt });
      set({ connectionStatus: 'connected' });
    });

    newSocket.on('reconnect_attempt', (attempt:any) => {
      log('Socket reconnect attempt', { userId, attempt });
    });

    newSocket.on('reconnect_failed', () => {
      log('Socket reconnect failed', { userId });
      set({ connectionStatus: 'disconnected', isSearching: false });
      Toast.show({
        type: 'error',
        text1: 'Connection Lost',
        text2: 'Failed to reconnect to the server.',
      });
    });

    newSocket.on('match_found', ({ partnerId, partnerName }: { partnerId: string; partnerName: string }) => {
      log('Match found', { partnerId, partnerName });
      if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
        log('Invalid partnerId received', { partnerId });
        set({ isSearching: false });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid partner ID.' });
        return;
      }
      set({
        partnerId,
        partnerName: partnerName || 'Anonymous',
        isSearching: false,
      });
      const onMatched = (get().startSearching as any).onMatched;
      if (onMatched) {
        log('Calling onMatched callback');
        onMatched();
      }
    });

    newSocket.on('partner_typing', ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === get().partnerId) {
        log('Partner typing', { fromUserId });
        set({ isPartnerTyping: true });
      }
    });

    newSocket.on('message_seen', ({ fromUserId, timestamp }: { fromUserId: string; timestamp: number }) => {
      if (fromUserId === get().partnerId) {
        log('Message seen', { fromUserId, timestamp });
      }
    });

    newSocket.on('friend_request_received', ({ fromUserId, fromUsername }: { fromUserId: string; fromUsername: string }) => {
      log('Friend request received', { fromUserId, fromUsername });
      set({ friendRequest: { fromUserId, fromUsername } });
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
      set({ connectionStatus: 'disconnected', isPartnerTyping: false });
    });

    set({ socket: newSocket, userId });
  };

  // Handle AppState changes
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    const { socket, userId, partnerId } = get();
    log('AppState changed', { nextAppState, userId, partnerId });
    if (nextAppState === 'active' && socket && userId) {
      if (!socket.connected) {
        log('App foregrounded, attempting to reconnect', { userId });
        socket.connect();
      }
      if (partnerId) {
        const roomId = [userId, partnerId].sort().join('-');
        socket.emit('join_room', { roomId, userId });
        log('Rejoined room after foreground', { roomId, userId });
      }
    }
  };

  AppState.addEventListener('change', handleAppStateChange);

  return {
    socket: null,
    userId: null,
    partnerId: null,
    isSearching: false,
    username: null,
    partnerName: null,
    isPartnerTyping: false,
    connectionStatus: 'disconnected',
    friendRequest: null,
    connectSocket: (userId: string) => {
      if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
        log('Invalid userId for connectSocket', { userId });
        return;
      }
      connectSocket(userId);
    },
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
        log('Cannot start friend chat: invalid data', { userId, friendId, socketConnected: !!socket?.connected });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or friend ID.' });
        return;
      }
      socket.emit('start_friend_chat', { userId, friendId, username: get().username });
      onStarted();
      log('Friend chat emitted', { userId, friendId });
    },
    setPartnerId: (partnerId) => {
      log('Setting partnerId', { partnerId });
      set({ partnerId });
    },
    setUsername: (username) => {
      log('Setting username', { username });
      set({ username });
    },
    setPartnerName: (partnerName) => {
      log('Setting partnerName', { partnerName });
      set({ partnerName });
    },
    setPartnerTyping: (isTyping) => {
      log('Setting partner typing', { isTyping });
      set({ isPartnerTyping: isTyping });
    },
    emitTyping: () => {
      const { socket, userId, partnerId } = get();
      log('Emitting typing', { userId, partnerId });
      if (socket?.connected && partnerId && userId) {
        socket.emit('typing', { toUserId: partnerId, fromUserId: userId });
      }
    },
    emitMessageSeen: (timestamp: number) => {
      const { socket, userId, partnerId } = get();
      log('Emitting message seen', { userId, partnerId, timestamp });
      if (socket?.connected && partnerId && userId) {
        socket.emit('message_seen', { toUserId: partnerId, fromUserId: userId, timestamp });
      }
    },
    sendFriendRequest: () => {
      const { socket, userId, partnerId, username } = get();
      log('Sending friend request', { userId, partnerId, username });
      if (socket?.connected && userId && partnerId && username) {
        socket.emit('send_friend_request', {
          toUserId: partnerId,
          fromUserId: userId,
          fromUsername: username,
        });
        log('Friend request emitted', { userId, partnerId });
      }
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
        partnerId: null,
        isSearching: false,
        partnerName: null,
        isPartnerTyping: false,
        connectionStatus: 'disconnected',
        friendRequest: null,
        userId: null,
        username: null,
      });
      log('Socket state reset complete');
    },
  };
});

useUserStore.subscribe((state) => {
  const newUserId = state.user?._id?.toString() || null;
  const { socket, userId, connectionStatus } = useSocketStore.getState();
  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] SocketStore: ${message}`, data || '');
  };

  log('User store subscription triggered', { newUserId, userId });

  if (!newUserId) {
    log('No user ID, resetting state');
    useSocketStore.getState().resetState();
    return;
  }

  if (socket?.connected && userId === newUserId) {
    log('Socket already connected for user', { userId });
    return;
  }

  if (connectionStatus === 'disconnected') {
    log('Connecting socket for new user', { newUserId });
    useSocketStore.getState().connectSocket(newUserId);
  }
});

export default useSocketStore;