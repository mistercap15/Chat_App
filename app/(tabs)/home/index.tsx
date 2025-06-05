// src/components/Home.tsx
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Heart, User } from 'lucide-react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import useSearchStore from '@/store/useSearchStore';
import useRandomChatStore from '@/store/useRandomChatStore';

const Home = () => {
  const { user } = useUserStore();
  const { socket, connectionStatus, connectSocket } = useSocketStore();
  const { isSearching, startSearching, stopSearching } = useSearchStore();
  const { setPartner } = useRandomChatStore();

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Home: ${message}`, data || '');
  };

  useFocusEffect(
    useCallback(() => {
      if (!user?._id) {
        log('No user ID, skipping socket connection');
        return;
      }
      if (!socket?.connected || connectionStatus === 'disconnected') {
        log('Connecting socket', { userId: user._id });
        connectSocket(user._id);
      }
      return () => {
        log('Home screen unfocused, stopping search');
        stopSearching(socket);
      };
    }, [user?._id, socket, connectionStatus, connectSocket, stopSearching])
  );

  const handleStartSearch = () => {
    if (!user?._id) {
      Toast.show({ type: 'error', text1: 'Profile Not Set Up', text2: 'Please register to start chatting.' });
      return;
    }
    if (!socket || connectionStatus !== 'connected') {
      connectSocket(user._id);
      Toast.show({ type: 'info', text1: 'Connecting', text2: 'Please wait...' });
      setTimeout(() => {
        if (socket?.connected) {
          startSearching(socket, (partnerId, partnerName) => {
            setPartner(partnerId, partnerName);
            router.push('/(tabs)/home/chat');
          });
        } else {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to server.' });
        }
      }, 1000);
      return;
    }
    startSearching(socket, (partnerId, partnerName) => {
      setPartner(partnerId, partnerName);
      router.push('/(tabs)/home/chat');
    });
  };

  const handleStopSearch = () => {
    stopSearching(socket);
  };

  const navigateToFriends = () => {
    router.push('/(tabs)/friends');
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
            onPress={handleStartSearch}
            disabled={isSearching || connectionStatus === 'connecting'}
            className={`bg-indigo-600 px-10 py-4 rounded-2xl shadow-lg active:scale-95 ${isSearching || connectionStatus === 'connecting' ? 'opacity-50' : ''}`}
          >
            {connectionStatus === 'connecting' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-white text-lg font-bold tracking-wider">START SEARCHING</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      <View className="items-center mt-10">
        <TouchableOpacity onPress={navigateToFriends}>
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