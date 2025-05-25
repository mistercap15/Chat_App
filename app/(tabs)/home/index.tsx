import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useSocketStore from '@/store/useSocketStore';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const Home = () => {
  const {
    userId,
    connectSocket,
    startSearching,
    stopSearching,
    isSearching,
    randomPartnerId,
  } = useSocketStore();

  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        console.log(`[${new Date().toISOString()}] Home: Connecting socket`, { userId });
        connectSocket(userId);
      }
    }, [userId, connectSocket])
  );

  const handleStartSearch = () => {
    startSearching(() => {
      console.log(`[${new Date().toISOString()}] Home: Match found, redirecting to chat`);
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