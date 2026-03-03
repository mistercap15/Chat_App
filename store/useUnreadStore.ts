import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, PersistStorage } from 'zustand/middleware';

interface UnreadStore {
  /** Map of friendId → unread message count */
  unreadCounts: Record<string, number>;
  /** The friendId of the chat the user is currently viewing (null if not in a chat) */
  activeChatFriendId: string | null;
  /** Increment unread count for a friend by 1 */
  incrementUnread: (friendId: string) => void;
  /** Clear unread count for a specific friend (e.g., when opening their chat) */
  clearUnread: (friendId: string) => void;
  /** Clear all unread counts (e.g., on logout) */
  clearAll: () => void;
  /** Set the currently active chat friend ID */
  setActiveChatFriendId: (friendId: string | null) => void;
  /** Get total unread count across all friends */
  getTotalUnread: () => number;
}

const asyncStorage: PersistStorage<Pick<UnreadStore, 'unreadCounts'>> = {
  getItem: async (key) => {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  removeItem: async (key) => {
    await AsyncStorage.removeItem(key);
  },
};

const useUnreadStore = create<UnreadStore>()(
  persist(
    (set, get) => ({
      unreadCounts: {},
      activeChatFriendId: null,
      incrementUnread: (friendId) => {
        // Don't increment if user is currently viewing this chat
        if (get().activeChatFriendId === friendId) return;
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [friendId]: (state.unreadCounts[friendId] || 0) + 1,
          },
        }));
      },
      clearUnread: (friendId) => {
        set((state) => {
          const { [friendId]: _, ...rest } = state.unreadCounts;
          return { unreadCounts: rest };
        });
      },
      clearAll: () => set({ unreadCounts: {}, activeChatFriendId: null }),
      setActiveChatFriendId: (friendId) => set({ activeChatFriendId: friendId }),
      getTotalUnread: () => {
        const counts = get().unreadCounts;
        return Object.values(counts).reduce((sum, count) => sum + count, 0);
      },
    }),
    {
      name: 'unread-storage',
      storage: asyncStorage,
      partialize: (state) => ({ unreadCounts: state.unreadCounts }),
    }
  )
);

export default useUnreadStore;
