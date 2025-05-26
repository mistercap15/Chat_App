import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';

interface Friend {
  _id: string;
  user_name: string;
}

const Friends = () => {
  const { user } = useUserStore();
  const { socket, userId, connectSocket } = useSocketStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchTimeRef = useRef<number | null>(null); // Throttle fetchFriends

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Friends: ${message}`, data || '');
  };

  const fetchFriends = useCallback(async () => {
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      log('Invalid userId, skipping fetch', { userId });
      return;
    }

    const now = Date.now();
    if (loading || (lastFetchTimeRef.current && now - lastFetchTimeRef.current < 5000)) {
      log('Skipping fetch: already loading or recently fetched', { loading, lastFetch: lastFetchTimeRef.current });
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/api/users/friends/${userId}`);
      setFriends(response.data.friends || []);
      lastFetchTimeRef.current = now;
      log('Fetched friends', { friendCount: response.data.friends?.length || 0 });
    } catch (error: any) {
      log('Error fetching friends', { error: error.message });
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch friends.' });
    } finally {
      setLoading(false);
    }
  }, [userId, loading]);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
        log('Invalid userId, skipping focus effect', { userId });
        return;
      }

      log('Screen focused, connecting socket', { userId });
      connectSocket(userId);
      fetchFriends();

      const friendRemovedListener = ({ removedUserId }: { removedUserId: string }) => {
        setFriends((prev) => {
          const newFriends = prev.filter((friend) => friend._id !== removedUserId);
          log('Friend removed', { removedUserId, newFriendCount: newFriends.length });
          return newFriends;
        });
      };

      const friendAddedListener = ({ userId: acceptorId, friendId }: { userId: string; friendId: string }) => {
        if (acceptorId === userId || friendId === userId) {
          log('Friend added, scheduling fetch', { acceptorId, friendId });
          setTimeout(() => fetchFriends(), 1000); // Delay to avoid rapid calls
        }
      };

      socket?.on('friend_removed', friendRemovedListener);
      socket?.on('friend_request_accepted', friendAddedListener);

      return () => {
        log('Cleaning up socket listeners');
        socket?.off('friend_removed', friendRemovedListener);
        socket?.off('friend_request_accepted', friendAddedListener);
      };
    }, [userId, connectSocket, socket, fetchFriends])
  );

  const handleRemoveFriend = async (friendId: string) => {
    if (!userId || !friendId || !/^[0-9a-fA-F]{24}$/.test(userId) || !/^[0-9a-fA-F]{24}$/.test(friendId)) {
      log('Invalid userId or friendId', { userId, friendId });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or friend ID.',
      });
      return;
    }

    try {
      await api.delete(`/api/users/remove-friend/${userId}/${friendId}`);
      setFriends((prev) => prev.filter((friend) => friend._id !== friendId));
      socket?.emit('friend_removed', { userId, removedUserId: friendId });
      log('Removed friend', { friendId });
      Toast.show({
        type: 'success',
        text1: 'Friend Removed',
        text2: 'The friend has been removed from your list.',
      });
    } catch (error: any) {
      log('Error removing friend', { userId, friendId, error: error.message });
      if (error.response?.status === 404) {
        setFriends((prev) => prev.filter((friend) => friend._id !== friendId));
        Toast.show({
          type: 'info',
          text1: 'Not Found',
          text2: 'This friend is no longer in your list.',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to remove friend.',
        });
      }
    }
  };

  const navigateToHome = () => {
    log('Navigating to home');
    router.replace('/(tabs)/home');
  };

  const navigateToFriendChat = (friendId: string) => {
    log('Navigating to friend chat', { friendId });
    router.push(`/friends/${friendId}`);
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View className="flex-row items-center justify-between p-4 bg-[#2F2F2F] rounded-lg mb-2">
      <TouchableOpacity
        onPress={() => navigateToFriendChat(item._id)}
        className="flex-row items-center flex-1"
      >
        <Ionicons name="person-circle-outline" size={40} color="#4A90E2" />
        <Text className="text-white text-lg ml-4">{item.user_name || 'Anonymous'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleRemoveFriend(item._id)}
        className="bg-red-500 px-3 py-1 rounded-md"
      >
        <Text className="text-white text-xs font-medium">Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-[#1C1C3A] p-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-white text-2xl font-bold">Friends</Text>
        <TouchableOpacity onPress={navigateToHome}>
          <Ionicons name="home-outline" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : friends.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-white text-lg">No friends found. Start a random chat to make new friends!</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item._id}
          renderItem={renderFriend}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
};

export default Friends;