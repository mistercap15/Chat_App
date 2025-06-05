import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import api from '@/utils/api';

interface Friend {
  _id: string;
  user_name: string;
}

const Friends = () => {
  const { user } = useUserStore();
  const { socket, connectSocket } = useSocketStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRemoveModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const lastFetchTimeRef = useRef<number | null>(null);

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Friends: ${message}`, data || '');
  };

  const fetchFriends = useCallback(async () => {
    if (!user?._id || loading || (lastFetchTimeRef.current && Date.now() - lastFetchTimeRef.current < 5000)) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/users/friends/${user._id}`);
      setFriends(response.data.friends || []);
      lastFetchTimeRef.current = Date.now();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch friends.' });
    } finally {
      setLoading(false);
    }
  }, [user?._id, loading]);

  useFocusEffect(
    useCallback(() => {
      if (!user?._id) return;
      connectSocket(user._id);
      fetchFriends();

      const friendRemovedListener = ({ removedUserId }: { removedUserId: string }) => {
        setFriends((prev) => prev.filter((friend) => friend._id !== removedUserId));
      };
      const friendAddedListener = ({ userId: acceptorId, friendId }: { userId: string; friendId: string }) => {
        if (acceptorId === user._id || friendId === user._id) {
          setTimeout(() => fetchFriends(), 500);
        }
      };

      socket?.on('friend_removed', friendRemovedListener);
      socket?.on('friend_request_accepted', friendAddedListener);

      return () => {
        socket?.off('friend_removed', friendRemovedListener);
        socket?.off('friend_request_accepted', friendAddedListener);
      };
    }, [user?._id, connectSocket, socket, fetchFriends])
  );

  const handleRemoveFriend = async (friendId: string) => {
    if (!user?._id || !friendId) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or friend ID.' });
      setRemoveModalVisible(false);
      return;
    }
    try {
      await api.delete(`/api/users/remove-friend/${user._id}/${friendId}`);
      setFriends((prev) => prev.filter((friend) => friend._id !== friendId));
      socket?.emit('friend_removed', { userId: user._id, removedUserId: friendId });
      Toast.show({ type: 'success', text1: 'Friend Removed', text2: 'The friend has been removed.' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to remove friend.' });
    } finally {
      setRemoveModalVisible(false);
      setSelectedFriend(null);
    }
  };

  const navigateToHome = () => {
    router.replace('/(tabs)/home');
  };

  const navigateToFriendChat = (friendId: string) => {
    router.push(`/friends/${friendId}`);
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View className="flex-row items-center justify-between bg-[#2E2E4D] p-4 rounded-xl mb-3 shadow-sm">
      <TouchableOpacity onPress={() => navigateToFriendChat(item._id)} className="flex-row items-center gap-3 flex-1">
        <Ionicons name="person-circle-outline" size={40} color="#5B2EFF" />
        <Text className="text-white text-lg font-medium">{item.user_name || 'Anonymous'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setSelectedFriend(item);
          setRemoveModalVisible(true);
        }}
        className="bg-red-600 px-3 py-1 rounded-lg"
      >
        <Text className="text-white text-sm font-medium">Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-[#1C1C3A] px-4 pt-6">
      <View className="flex-row items-center gap-2 mb-6">
        <Ionicons name="people-outline" size={28} color="white" />
        <Text className="text-white text-2xl font-semibold">Friends</Text>
      </View>
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#5B2EFF" />
        </View>
      ) : friends.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Ionicons name="sad-outline" size={64} color="#5B2EFF" />
          <Text className="text-white text-lg mt-4">No friends yet.</Text>
          <Text className="text-gray-400 text-center mt-2">Start chatting and add friends to see them here!</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item._id}
          renderItem={renderFriend}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
      <Modal
        visible={isRemoveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRemoveModalVisible(false);
          setSelectedFriend(null);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-[#2E2E4D] rounded-xl p-6 w-full max-w-md">
            <Text className="text-white text-lg font-semibold mb-3">Remove Friend</Text>
            <Text className="text-gray-300 mb-5">
              Are you sure you want to remove {selectedFriend?.user_name || 'this friend'}? You can add them again later.
            </Text>
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => {
                  setRemoveModalVisible(false);
                  setSelectedFriend(null);
                }}
                className="bg-gray-500 py-2 px-4 rounded-xl flex-1 mr-2 items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRemoveFriend(selectedFriend?._id || '')}
                className="bg-red-600 py-2 px-4 rounded-xl flex-1 ml-2 items-center"
              >
                <Text className="text-white font-medium">Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Friends;