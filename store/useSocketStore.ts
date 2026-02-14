import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';
import { AppState, AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';
import { BASE_URL } from '@/utils/constants';
import useUserStore from './useUserStore';
import useFriendRequestStore from './useFriendRequestStore';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface SocketStore {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  isConnecting: boolean;
  connectedUserId: string | null;
  connectSocket: (userId: string) => Promise<Socket | null>;
  disconnectSocket: () => void;
}

let activeConnectPromise: Promise<Socket | null> | null = null;
let appStateSubscribed = false;

const isValidObjectId = (value?: string | null) => !!value && /^[0-9a-fA-F]{24}$/.test(value);

const useSocketStore = create<SocketStore>((set, get) => {
  const log = (message: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] SocketStore: ${message}`, data ?? '');
  };

  const attachCoreListeners = (socket: Socket, userId: string) => {
    socket.removeAllListeners('connect');
    socket.removeAllListeners('connect_error');
    socket.removeAllListeners('reconnect');
    socket.removeAllListeners('reconnect_failed');
    socket.removeAllListeners('disconnect');
    socket.removeAllListeners('error');

    socket.on('connect', () => {
      const username = useUserStore.getState().user?.user_name || 'Anonymous';
      log('Socket connected', { socketId: socket.id, userId });
      set({ socket, connectionStatus: 'connected', isConnecting: false, connectedUserId: userId });
      socket.emit('set_username', { userId, username });
      useFriendRequestStore.getState().fetchPendingRequests(userId);
    });

    socket.on('reconnect', (attempt) => {
      const username = useUserStore.getState().user?.user_name || 'Anonymous';
      log('Socket reconnected', { attempt, userId, socketId: socket.id });
      set({ connectionStatus: 'connected', isConnecting: false, connectedUserId: userId });
      socket.emit('set_username', { userId, username });
      useFriendRequestStore.getState().fetchPendingRequests(userId);
    });

    socket.on('connect_error', (error) => {
      log('Socket connect_error', { message: error.message, userId });
      set({ connectionStatus: 'disconnected', isConnecting: false });
    });

    socket.on('reconnect_failed', () => {
      log('Socket reconnect_failed', { userId });
      set({ connectionStatus: 'disconnected', isConnecting: false });
      Toast.show({ type: 'error', text1: 'Connection Lost', text2: 'Failed to reconnect to chat server.' });
    });

    socket.on('error', ({ message }: { message?: string }) => {
      if (!message) return;
      log('Socket error event', { message });
      Toast.show({ type: 'error', text1: 'Socket error', text2: message });
    });

    socket.on('disconnect', (reason) => {
      log('Socket disconnected', { reason, userId, socketId: socket.id });
      set({ connectionStatus: 'disconnected', isConnecting: false });
    });
  };

  const connectSocket = async (userId: string): Promise<Socket | null> => {
    if (!isValidObjectId(userId)) {
      log('connectSocket blocked due to invalid userId', { userId });
      return null;
    }

    const { socket, isConnecting, connectedUserId } = get();

    if (socket?.connected && connectedUserId === userId) {
      return socket;
    }

    if (isConnecting && activeConnectPromise) {
      return activeConnectPromise;
    }

    if (socket && connectedUserId && connectedUserId !== userId) {
      log('Disconnecting socket for previous user', { connectedUserId, nextUserId: userId });
      socket.disconnect();
      set({ socket: null, connectedUserId: null, connectionStatus: 'disconnected' });
    }

    set({ connectionStatus: 'connecting', isConnecting: true });

    activeConnectPromise = new Promise((resolve) => {
      const username = useUserStore.getState().user?.user_name || 'Anonymous';
      const nextSocket = io(BASE_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2500,
        timeout: 10000,
        query: { userId, username },
      });

      attachCoreListeners(nextSocket, userId);

      const finalize = (result: Socket | null) => {
        nextSocket.off('connect', onConnect);
        nextSocket.off('connect_error', onConnectError);
        activeConnectPromise = null;
        resolve(result);
      };

      const onConnect = () => finalize(nextSocket);
      const onConnectError = () => finalize(null);

      nextSocket.once('connect', onConnect);
      nextSocket.once('connect_error', onConnectError);

      set({ socket: nextSocket });
    });

    return activeConnectPromise;
  };

  const disconnectSocket = () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connectionStatus: 'disconnected', isConnecting: false, connectedUserId: null });
    }
  };

  if (!appStateSubscribed) {
    AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState !== 'active') return;
      const userId = useUserStore.getState().user?._id;
      if (!isValidObjectId(userId)) return;
      const { socket, connectionStatus } = get();
      if (!socket?.connected && connectionStatus !== 'connecting') {
        connectSocket(userId);
      }
    });
    appStateSubscribed = true;
  }

  return {
    socket: null,
    connectionStatus: 'disconnected',
    isConnecting: false,
    connectedUserId: null,
    connectSocket,
    disconnectSocket,
  };
});

export default useSocketStore;
