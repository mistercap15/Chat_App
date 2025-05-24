import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useSocketStore from '@/store/useSocketStore';
import { useRouter, useFocusEffect } from 'expo-router';
import useUserStore from '@/store/useUserStore';
import { Heart, User } from 'lucide-react-native';
import Toast from 'react-native-toast-message';

const Home: React.FC = () => {
  const router = useRouter();
  const { startSearching, stopSearching, isSearching, connectSocket, connectionStatus } = useSocketStore();
  const { user, isRegistered } = useUserStore();

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Home: ${message}`, data || '');
  };

  // Handle socket connection and cleanup on focus/unfocus
  useFocusEffect(
    useCallback(() => {
      log('Home screen focused', { userId: user?._id, isRegistered: isRegistered() });
      if (!isRegistered()) {
        log('User not registered');
        stopSearching();
        return;
      }

      const userId = user?._id?.toString();
      if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
        log('Invalid userId', { userId });
        stopSearching();
        return;
      }

      log('Connecting socket', { userId });
      connectSocket(userId);

      return () => {
        log('Home screen unfocused, stopping search');
        stopSearching();
      };
    }, [user, isRegistered, stopSearching, connectSocket])
  );

  // Navigate to chat when a match is found
  useEffect(() => {
    if (isSearching) {
      log('Starting search on connection', { connectionStatus });
      startSearching(() => {
        log('Match found, navigating to chat');
        router.push('/(tabs)/home/chat');
      });
    }
  }, [isSearching, connectionStatus, startSearching, router]);

  const handleSearch = () => {
    log('Search button pressed', { isSearching, connectionStatus });
    if (!isRegistered()) {
      log('User not registered, showing toast');
      Toast.show({
        type: 'error',
        text1: 'Profile Not Set Up',
        text2: 'Please set up your profile to start chatting.',
      });
      return;
    }

    const userId = user?._id?.toString();
    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      log('Invalid userId, showing toast', { userId });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Invalid user ID. Please set up your profile.',
      });
      return;
    }

    if (connectionStatus === 'disconnected') {
      log('Socket not connected, attempting to connect', { userId });
      connectSocket(userId);
      Toast.show({ type: 'info', text1: 'Connecting', text2: 'Please wait...' });
      return;
    }

    if (connectionStatus === 'connecting') {
      log('Socket is connecting, showing toast', { userId });
      Toast.show({ type: 'info', text1: 'Connecting', text2: 'Please wait for connection...' });
      return;
    }

    if (!isSearching) {
      log('Starting search', { userId });
      startSearching(() => {
        log('Match found, navigating to chat');
        router.push('/(tabs)/home/chat');
      });
    }
  };

  const handleStopSearch = () => {
    log('Stop search button pressed');
    stopSearching();
  };

  return (
    <View className="flex-1 bg-[#1C1C3A] px-6 pt-12">
      <View className="flex-row justify-center items-center mb-6">
        <View className="bg-indigo-500 p-3 rounded-full">
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="white" />
        </View>
        <Text className="text-white text-2xl font-bold ml-3 tracking-wide">Zu.Chat</Text>
      </View>

      <View className="items-center mt-6 mb-8">
        <View className="w-40 h-40 rounded-full bg-indigo-400/20 items-center justify-center">
          <Ionicons name="people-outline" size={72} color="#5B2EFF" />
        </View>
      </View>

      <View className="items-center">
        <Text className="text-white text-xl font-semibold mb-1">Find a person to chat with</Text>
        <Text className="text-gray-400 text-base text-center">Anonymous • Secure • Fun</Text>
      </View>

      <View className="items-center mt-12">
        {isSearching ? (
          <View className="items-center">
            <Text className="text-white text-lg font-semibold mb-4">Searching for a match...</Text>
            <TouchableOpacity
              onPress={handleStopSearch}
              className="bg-red-600 px-10 py-4 rounded-2xl shadow-lg active:scale-95"
            >
              <Text className="text-white text-lg font-bold tracking-wider">STOP SEARCHING</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleSearch}
            disabled={isSearching || connectionStatus === 'connecting'}
            className={`bg-indigo-600 px-10 py-4 rounded-2xl shadow-lg active:scale-95 ${isSearching || connectionStatus === 'connecting' ? 'opacity-50' : ''}`}
          >
            <Text className="text-white text-lg font-bold tracking-wider">START SEARCHING</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="items-center mt-10">
        <TouchableOpacity>
          <Text className="text-indigo-400 text-base font-semibold underline">Search Preferences</Text>
        </TouchableOpacity>
        <View className="mt-6 gap-4 items-center">
          <View className="flex-row items-center gap-2">
            <User size={22} color="#8B5CF6" />
            <Text className="text-gray-300 text-base">All Genders</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Heart size={22} color="#8B5CF6" />
            <Text className="text-gray-300 text-base">Any Interests</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default Home;