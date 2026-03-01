// src/store/useSocketStore.ts
import { create } from 'zustand';
import io from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import { BASE_URL } from '@/utils/constants';
import Toast from 'react-native-toast-message';
import useUserStore from './useUserStore';
import useAuthStore from './useAuthStore';
import useFriendRequestStore from './useFriendRequestStore';
import useUnreadStore from './useUnreadStore';
import { AppSocket } from '@/types/socket';

interface SocketStore {
  socket: AppSocket | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  isConnecting: boolean;
  connectSocket: (userId: string) => void;
  disconnectSocket: () => void;
}

const useSocketStore = create<SocketStore>((set, get) => {
  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] SocketStore: ${message}`, data || '');
  };

  const connectSocket = (userId: string) => {
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      log('Invalid userId', { userId });
      return;
    }
    const { socket, isConnecting } = get();
    if (socket?.connected || isConnecting) {
      log('Socket already connected or connecting', { userId, socketId: socket?.id });
      return;
    }
    if (socket) {
      socket.disconnect();
      set({ socket: null, connectionStatus: 'disconnected' });
    }

    set({ connectionStatus: 'connecting', isConnecting: true });
    const user = useUserStore.getState().user;
    const token = useAuthStore.getState().token;
    const newSocket = io(BASE_URL, {
      query: { userId, username: user?.user_name || 'Anonymous' },
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 20000,
    }) as unknown as AppSocket;

    // Global listeners that must work on every screen
    newSocket.on('friend_request_received', ({ fromUserId, fromUsername }: { fromUserId: string; fromUsername: string }) => {
      log('Global: friend_request_received', { fromUserId, fromUsername });
      useFriendRequestStore.getState().fetchPendingRequests(userId);
      Toast.show({ type: 'info', text1: 'Friend Request', text2: `${fromUsername || 'Someone'} wants to be your friend!` });
    });

    newSocket.on('friend_added', ({ friendId, friendUsername }: { friendId: string; friendUsername: string }) => {
      log('Global: friend_added', { friendId, friendUsername });
    });

    // Track unread message counts globally — only for friend chat messages
    // received when the user is NOT actively viewing that friend's chat.
    newSocket.on('receive_message', ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId && fromUserId !== userId) {
        useUnreadStore.getState().incrementUnread(fromUserId);
      }
    });

    newSocket.on('connect', () => {
      log('Socket connected', { userId, socketId: newSocket.id });
      set({ socket: newSocket, connectionStatus: 'connected', isConnecting: false });
      newSocket.emit('set_username', { userId, username: user?.user_name || 'Anonymous' });
      useFriendRequestStore.getState().fetchPendingRequests(userId);
    });

    newSocket.on('connect_error', (err: { message: string }) => {
      log('Socket connect_error', { userId, error: err.message });
      set({ connectionStatus: 'disconnected', isConnecting: false });
    });

    newSocket.on('reconnect', (attempt: number) => {
      log('Socket reconnected', { userId, attempt });
      set({ connectionStatus: 'connected', isConnecting: false });
      newSocket.emit('set_username', { userId, username: user?.user_name || 'Anonymous' });
      useFriendRequestStore.getState().fetchPendingRequests(userId);
    });

    newSocket.on('reconnect_failed', () => {
      log('Reconnect failed', { userId });
      set({ connectionStatus: 'disconnected', isConnecting: false });
      Toast.show({ type: 'error', text1: 'Connection Lost', text2: 'Failed to reconnect.' });
    });

    newSocket.on('error', ({ message }: { message: string }) => {
      log('Socket error', { message });
      Toast.show({ type: 'error', text1: 'Error', text2: message });
    });

    newSocket.on('disconnect', () => {
      log('Socket disconnected', { userId });
      set({ connectionStatus: 'disconnected', isConnecting: false });
    });

    set({ socket: newSocket });
  };

  const disconnectSocket = () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connectionStatus: 'disconnected', isConnecting: false });
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      const userId = useUserStore.getState().user?._id;
      if (userId && (!get().socket?.connected || get().connectionStatus === 'disconnected')) {
        connectSocket(userId);
      }
    }
  };

  AppState.addEventListener('change', handleAppStateChange);

  return {
    socket: null,
    connectionStatus: 'disconnected',
    isConnecting: false,
    connectSocket,
    disconnectSocket,
  };
});

export default useSocketStore;