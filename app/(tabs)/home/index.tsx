import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useSocketStore from '@/store/useSocketStore';
import useUserStore from '@/store/useUserStore';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const Home = () => {
  const {
    userId,
    connectSocket,
    startSearching,
    stopSearching,
    isSearching,
    randomPartnerId,
    socket,
    connectionStatus,
  } = useSocketStore();
  const { user } = useUserStore();

  useFocusEffect(
    React.useCallback(() => {
      if (!user?._id) {
        console.log(`[${new Date().toISOString()}] Home: No user ID, skipping socket connection`);
        return;
      }

      // Only reconnect if userId changed or socket is disconnected
      if (user._id !== userId || !socket || connectionStatus === 'disconnected') {
        console.log(`[${new Date().toISOString()}] Home: Connecting socket`, { userId: user._id });
        connectSocket(user._id);
      } else {
        console.log(`[${new Date().toISOString()}] Home: Socket already connected`, { userId: user._id });
      }
    }, [user?._id, userId, connectSocket, socket, connectionStatus])
  );

  const handleStartSearch = () => {
    if (!user?._id) {
      console.log(`[${new Date().toISOString()}] Home: No user ID, cannot start search`);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please register to start searching.' });
      return;
    }
    if (!socket || connectionStatus !== 'connected') {
      console.log(`[${new Date().toISOString()}] Home: Socket not connected, attempting to reconnect`, { userId });
      connectSocket(user._id);
      setTimeout(() => {
        if (socket?.connected) {
          startSearching(() => {
            console.log(`[${new Date().toISOString()}] Home: Match found, redirecting to chat`);
            router.push('/(tabs)/home/chat');
          });
        } else {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to server.' });
        }
      }, 1000);
      return;
    }
    startSearching(() => {
      console.log(`[${new Date().toISOString()}] Home: Match found, redirecting to chat`);
      router.push('/(tabs)/home/chat');
    });
  };

  const handleStopSearch = () => {
    stopSearching();
  };

  const navigateToFriends = () => {
    console.log(`[${new Date().toISOString()}] Home: Navigating to friends list`);
    router.push('/(tabs)/friends');
  };

  return (
    <View className="flex-1 bg-[#1C1C3A] p-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-white text-2xl font-bold">Home</Text>
        <TouchableOpacity onPress={navigateToFriends}>
          <Ionicons name="people-outline" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {isSearching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text className="text-white text-lg mt-4">Searching for a partner...</Text>
          <TouchableOpacity
            onPress={handleStopSearch}
            className="bg-red-500 px-6 py-3 rounded-lg mt-6"
          >
            <Text className="text-white font-semibold">Stop Searching</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-1 justify-center items-center">
          <Text className="text-white text-lg mb-6">Find a random chat partner!</Text>
          <TouchableOpacity
            onPress={handleStartSearch}
            className="bg-[#4A90E2] px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-semibold">Start Searching</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default Home;