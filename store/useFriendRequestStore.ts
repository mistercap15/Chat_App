import { create } from 'zustand';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';
import useUserStore from './useUserStore';

interface FriendRequestStore {
  pendingRequests: { fromUserId: string; fromUsername: string }[];
  fetchPendingRequests: (userId: string) => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<void>;
  acceptFriendRequest: (friendId: string) => Promise<void>;
  rejectFriendRequest: (friendId: string) => Promise<void>;
}

const useFriendRequestStore = create<FriendRequestStore>((set) => ({
  pendingRequests: [],
  fetchPendingRequests: async (userId) => {
    try {
      const response = await api.get(`/api/users/pending-friend-requests/${userId}`);
      set({ pendingRequests: response.data.friendRequests || [] });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch pending friend requests.' });
    }
  },
  sendFriendRequest: async (friendId) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId) return;
    try {
      await api.post('/api/users/send-friend-request', { userId, friendId });
      Toast.show({ type: 'success', text1: 'Request Sent', text2: 'Friend request sent!' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to send friend request.' });
    }
  },
  acceptFriendRequest: async (friendId) => {
    const userId = useUserStore.getState().user?._id;
    const setUser = useUserStore.getState().setUser;
    const user = useUserStore.getState().user;
    if (!userId || !friendId || !user) return;
    try {
      await api.post('/api/users/accept-friend-request', { userId, friendId });
      setUser({ ...user, friends: user.friends ? [...user.friends, friendId] : [friendId] });
      set(({ pendingRequests }) => ({
        pendingRequests: pendingRequests.filter((req) => req.fromUserId !== friendId),
      }));
      Toast.show({ type: 'success', text1: 'Friend Added', text2: 'You are now friends!' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to accept friend request.' });
    }
  },
  rejectFriendRequest: async (friendId) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId) return;
    try {
      await api.post('/api/users/reject-friend-request', { userId, friendId });
      set(({ pendingRequests }) => ({
        pendingRequests: pendingRequests.filter((req) => req.fromUserId !== friendId),
      }));
      Toast.show({ type: 'success', text1: 'Request Rejected', text2: 'Friend request rejected.' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to reject friend request.' });
    }
  },
}));

export default useFriendRequestStore;