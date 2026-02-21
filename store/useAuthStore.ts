import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, PersistStorage } from 'zustand/middleware';

interface AuthStore {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

const asyncStorage: PersistStorage<AuthStore> = {
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

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clearToken: () => set({ token: null }),
    }),
    { name: 'auth-storage', storage: asyncStorage }
  )
);

export default useAuthStore;
