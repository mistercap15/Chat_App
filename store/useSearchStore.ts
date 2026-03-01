// src/store/useSearchStore.ts
import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import useUserStore from './useUserStore';

interface SearchStore {
  isSearching: boolean;
  startSearching: (socket: any, onMatched: (partnerId: string, partnerName: string) => void, onNoMatch?: () => void) => void;
  stopSearching: (socket: any) => void;
}

const useSearchStore = create<SearchStore>((set, get) => ({
  isSearching: false,
  startSearching: (socket, onMatched, onNoMatch) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !socket?.connected) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Not connected to server.' });
      return;
    }
    if (get().isSearching) return;
    set({ isSearching: true });

    // Remove any stale listeners before adding new ones
    socket.off('match_found');
    socket.off('no_match_found');

    const handleMatchFound = ({ partnerId, partnerName }: any) => {
      socket.off('match_found', handleMatchFound);
      socket.off('no_match_found', handleNoMatchFound);
      if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
        set({ isSearching: false });
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid partner ID.' });
        return;
      }
      set({ isSearching: false });
      onMatched(partnerId, partnerName);
    };

    const handleNoMatchFound = () => {
      socket.off('match_found', handleMatchFound);
      socket.off('no_match_found', handleNoMatchFound);
      set({ isSearching: false });
      onNoMatch?.();
    };

    socket.on('match_found', handleMatchFound);
    socket.on('no_match_found', handleNoMatchFound);
    // Backend uses socket.userId from JWT — no payload needed
    socket.emit('start_search');
  },
  stopSearching: (socket) => {
    if (get().isSearching && socket?.connected) {
      socket.emit('stop_search');
    }
    socket?.off('match_found');
    socket?.off('no_match_found');
    set({ isSearching: false });
  },
}));

export default useSearchStore;
