import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import { useRouter } from 'expo-router';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';

interface Friend {
  _id: string;
  user_name: string;
}

const Friends = () => {
  const { user, setUser } = useUserStore();
  const { socket, startFriendChat } = useSocketStore();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRemoveModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user?._id) {
        console.warn(`[${new Date().toISOString()}] Friends: User not logged in`);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'User not logged in.',
        });
        return;
      }

      try {
        const response = await api.get(`/api/users/friends/${user._id}`);
        setFriends(response.data.friends);
        console.log(`[${new Date().toISOString()}] Friends: Fetched friends`, { friendCount: response.data.friends.length });
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Friends: Error fetching friends`, error.message);
        const errorMessage = error.response?.data?.message || 'Failed to fetch friends.';
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [user?._id]);

  useEffect(() => {
    if (socket) {
      const handleFriendRemoved = ({ removedUserId }: { removedUserId: string }) => {
        console.log(`[${new Date().toISOString()}] Friends: Friend removed event received`, { removedUserId });
        setFriends((prev) => prev.filter((friend) => friend._id !== removedUserId));
        if (user) {
          setUser({
            ...user,
            friends: (user.friends ?? []).filter((id) => id !== removedUserId),
          });
        }
        Toast.show({
          type: 'success',
          text1: 'Friend Removed',
          text2: 'Friend has been removed from your list.',
        });
      };

      socket.on('friend_removed', handleFriendRemoved);

      return () => {
        socket.off('friend_removed', handleFriendRemoved);
        console.log(`[${new Date().toISOString()}] Friends: Cleaned up friend_removed listener`);
      };
    }
  }, [socket, user, setUser]);

  const handleFriendPress = (friend: Friend) => {
    if (!user?._id || !friend._id || !/^[0-9a-fA-F]{24}$/.test(friend._id)) {
      console.warn(`[${new Date().toISOString()}] Friends: Invalid user or friend ID`, { userId: user?._id, friendId: friend._id });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or friend ID.',
      });
      return;
    }

    console.log(`[${new Date().toISOString()}] Friends: Starting friend chat`, { friendId: friend._id, friendName: friend.user_name });
    startFriendChat(friend._id, () => {
      router.push({
        pathname: '/(tabs)/home/[friendId]' as const, // Use dynamic route
        params: { friendId: friend._id, friendName: friend.user_name },
      });
      console.log(`[${new Date().toISOString()}] Friends: Navigated to friend chat`, { friendId: friend._id });
    });
  };

  const handleRemoveFriend = async () => {
    if (!user?._id || !selectedFriend?._id || !/^[0-9a-fA-F]{24}$/.test(selectedFriend._id)) {
      console.warn(`[${new Date().toISOString()}] Friends: Invalid user or friend ID for removal`, { userId: user?._id, friendId: selectedFriend?._id });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user or friend ID.',
      });
      setRemoveModalVisible(false);
      return;
    }

    try {
      console.log(`[${new Date().toISOString()}] Friends: Removing friend`, { userId: user._id, friendId: selectedFriend._id });
      await api.delete(`/api/users/remove-friend/${user._id}/${selectedFriend._id}`);
      // Friend list update handled by socket event
      console.log(`[${new Date().toISOString()}] Friends: Friend removal request sent`, { friendId: selectedFriend._id });
    } catch (error: any) {
      console.error(`[${new Date().toISOString()}] Friends: Error removing friend`, error.message);
      const errorMessage = error.response?.data?.message || 'Failed to remove friend.';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setRemoveModalVisible(false);
      setSelectedFriend(null);
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View className="flex-row items-center justify-between bg-[#2E2E4D] p-4 rounded-xl mb-3">
      <TouchableOpacity
        onPress={() => handleFriendPress(item)}
        className="flex-row items-center gap-3 flex-1"
      >
        <Ionicons name="person-circle-outline" size={40} color="#5B2EFF" />
        <Text className="text-white text-lg font-medium">{item.user_name}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setSelectedFriend(item);
          setRemoveModalVisible(true);
          console.log(`[${new Date().toISOString()}] Friends: Opened remove friend modal`, { friendId: item._id });
        }}
        className="bg-red-600 px-3 py-1 rounded-lg"
      >
        <Text className="text-white text-sm">Remove</Text>
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
        <ActivityIndicator size="large" color="#5B2EFF" />
      ) : friends.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Ionicons name="sad-outline" size={64} color="#5B2EFF" />
          <Text className="text-white text-lg mt-4">No friends yet.</Text>
          <Text className="text-gray-400 text-center mt-2">
            Start chatting and add friends to see them here!
          </Text>
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
          console.log(`[${new Date().toISOString()}] Friends: Closed remove friend modal`);
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
                  console.log(`[${new Date().toISOString()}] Friends: Cancelled friend removal`);
                }}
                className="bg-gray-500 py-2 px-4 rounded-xl flex-1 mr-2 items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRemoveFriend}
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