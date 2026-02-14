import { create } from 'zustand';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';
import useUserStore from './useUserStore';

interface FriendRequestStore {
  pendingRequests: { fromUserId: string; fromUsername: string }[];
  fetchPendingRequests: (userId: string) => Promise<void>;
  sendFriendRequest: (friendId: string) => Promise<boolean>;
  acceptFriendRequest: (friendId: string) => Promise<boolean>;
  rejectFriendRequest: (friendId: string) => Promise<boolean>;
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
    const user = useUserStore.getState().user;
    if (!userId || !friendId) return false;
    if (user?.friends?.includes(friendId)) {
      Toast.show({ type: 'info', text1: 'Already Friends', text2: 'You are already connected with this user.' });
      return false;
    }

    try {
      await api.post('/api/users/send-friend-request', { userId, friendId });
      Toast.show({ type: 'success', text1: 'Request Sent', text2: 'Friend request sent!' });
      return true;
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to send friend request.' });
      return false;
    }
  },
  acceptFriendRequest: async (friendId) => {
    const userId = useUserStore.getState().user?._id;
    const setUser = useUserStore.getState().setUser;
    const user = useUserStore.getState().user;
    if (!userId || !friendId || !user) return false;
    try {
      await api.post('/api/users/accept-friend-request', { userId, friendId });
      const nextFriends = user.friends ? Array.from(new Set([...user.friends, friendId])) : [friendId];
      setUser({ ...user, friends: nextFriends });
      set(({ pendingRequests }) => ({
        pendingRequests: pendingRequests.filter((req) => req.fromUserId !== friendId),
      }));
      Toast.show({ type: 'success', text1: 'Friend Added', text2: 'You are now friends!' });
      return true;
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to accept friend request.' });
      return false;
    }
  },
  rejectFriendRequest: async (friendId) => {
    const userId = useUserStore.getState().user?._id;
    if (!userId || !friendId) return false;
    try {
      await api.post('/api/users/reject-friend-request', { userId, friendId });
      set(({ pendingRequests }) => ({
        pendingRequests: pendingRequests.filter((req) => req.fromUserId !== friendId),
      }));
      Toast.show({ type: 'success', text1: 'Request Rejected', text2: 'Friend request rejected.' });
      return true;
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to reject friend request.' });
      return false;
    }
  },
}));

export default useFriendRequestStore;
