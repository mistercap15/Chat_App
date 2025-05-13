import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, PersistStorage } from 'zustand/middleware';

interface User {
  _id: string;
  user_name: string;
  gender: string;
  bio?: string;
  interests?: string[];
  friends?: string[];
}

interface UserStore {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
  isRegistered: () => boolean;
}

// Custom AsyncStorage wrapper for Zustand
const asyncStorage: PersistStorage<UserStore> = {
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

const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
      isRegistered: () => !!get().user,
    }),
    {
      name: 'user-storage',
      storage: asyncStorage,
    }
  )
);

export default useUserStore;