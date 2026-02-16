import { create } from 'zustand';
import Toast from 'react-native-toast-message';
import useUserStore from './useUserStore';

interface SearchStore {
  isSearching: boolean;
  startSearching: (socket: any, onMatched: (partnerId: string, partnerName: string) => void) => void;
  stopSearching: (socket?: any | null) => void;
}

let matchFoundListener: ((payload: { partnerId: string; partnerName: string }) => void) | null = null;

const useSearchStore = create<SearchStore>((set, get) => ({
  isSearching: false,
  startSearching: (socket, onMatched) => {
    const userId = useUserStore.getState().user?._id;
    const username = useUserStore.getState().user?.user_name || 'Anonymous';

    if (!userId || !socket?.connected) {
      Toast.show({ type: 'error', text1: 'Not connected', text2: 'Please connect before searching.' });
      return;
    }

    if (get().isSearching) {
      return;
    }

    if (matchFoundListener) {
      socket.off('match_found', matchFoundListener);
      matchFoundListener = null;
    }

    set({ isSearching: true });

    matchFoundListener = ({ partnerId, partnerName }) => {
      if (!/^[0-9a-fA-F]{24}$/.test(partnerId)) {
        set({ isSearching: false });
        Toast.show({ type: 'error', text1: 'Matching failed', text2: 'Invalid partner id received from server.' });
        return;
      }

      set({ isSearching: false });
      socket.off('match_found', matchFoundListener!);
      matchFoundListener = null;
      onMatched(partnerId, partnerName || 'Anonymous');
    };

    socket.once('match_found', matchFoundListener);
    socket.emit('start_search', { userId, username });
  },

  stopSearching: (socket) => {
    const userId = useUserStore.getState().user?._id;
    if (socket?.connected && userId && get().isSearching) {
      socket.emit('stop_search', { userId });
    }

    if (socket && matchFoundListener) {
      socket.off('match_found', matchFoundListener);
      matchFoundListener = null;
    }

    set({ isSearching: false });
  },
}));

export default useSearchStore;
