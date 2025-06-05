// src/store/useSearchStore.ts
import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import { Socket } from 'socket.io-client';
import useUserStore from './useUserStore';

interface SearchStore {
  isSearching: boolean;
  startSearching: (socket: any, onMatched: (partnerId: string, partnerName: string) => void) => void;
  stopSearching: (socket: any) => void;
}

const useSearchStore = create<SearchStore>((set, get) => ({
  isSearching: false,
  startSearching: (socket, onMatched) => {
    const userId = useUserStore.getState().user?._id;
    const username = useUserStore.getState().user?.user_name || 'Anonymous';
    if (!userId || !socket?.connected) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Not connected to server.' });
      return;
    }
    if (get().isSearching) return;
    set({ isSearching: true });
    socket.emit('start_search', { userId, username });
    socket.on('match_found', ({ partnerId, partnerName }:any) => {
      if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
        set({ isSearching: false });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid partner ID.' });
        return;
      }
      set({ isSearching: false });
      onMatched(partnerId, partnerName);
    });
  },
  stopSearching: (socket) => {
    const userId = useUserStore.getState().user?._id;
    if (get().isSearching && socket?.connected && userId) {
      socket.emit('stop_search', { userId });
      set({ isSearching: false });
    }
  },
}));

export default useSearchStore;