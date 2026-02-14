import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Heart, ShieldCheck, Sparkles, User } from 'lucide-react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import useSearchStore from '@/store/useSearchStore';
import useRandomChatStore from '@/store/useRandomChatStore';

const Home = () => {
  const { user } = useUserStore();
  const { socket, connectionStatus, connectSocket, isConnecting } = useSocketStore();
  const { isSearching, startSearching, stopSearching } = useSearchStore();
  const { setPartner } = useRandomChatStore();

  useFocusEffect(
    useCallback(() => {
      if (!user?._id) {
        router.replace('/(tabs)/settings/register');
        return;
      }

      if (!socket?.connected && !isConnecting) {
        connectSocket(user._id);
      }

      return () => {
        stopSearching(socket);
      };
    }, [user?._id, socket, isConnecting, connectSocket, stopSearching])
  );

  const handleStartSearch = async () => {
    if (!user?._id) {
      Toast.show({ type: 'error', text1: 'Profile required', text2: 'Please complete your profile first.' });
      router.push('/(tabs)/settings/register');
      return;
    }

    let activeSocket = socket;

    if (!activeSocket?.connected || connectionStatus !== 'connected') {
      Toast.show({ type: 'info', text1: 'Connecting', text2: 'Preparing your chat connection...' });
      activeSocket = await connectSocket(user._id);
    }

    if (!activeSocket?.connected) {
      Toast.show({ type: 'error', text1: 'Unable to connect', text2: 'Please try again in a moment.' });
      return;
    }

    startSearching(activeSocket, (partnerId, partnerName) => {
      setPartner(partnerId, partnerName);
      router.push('/(tabs)/home/chat');
    });
  };

  return (
    <View className="flex-1 bg-[#12122A] px-6 pt-12">
      <View className="mb-8 rounded-3xl bg-[#1B1B40] px-5 py-6">
        <View className="flex-row items-center">
          <View className="bg-indigo-500 p-3 rounded-2xl">
            <Ionicons name="chatbubble-ellipses-outline" size={26} color="white" />
          </View>
          <View className="ml-3">
            <Text className="text-white text-2xl font-bold">Zu.Chat</Text>
            <Text className="text-gray-400 text-sm">Anonymous conversations, real connections</Text>
          </View>
        </View>
      </View>

      <View className="rounded-3xl bg-[#1B1B40] p-5 mb-6">
        <Text className="text-white text-lg font-semibold mb-1">Ready to meet someone new?</Text>
        <Text className="text-gray-400">Tap start and we will find a compatible partner instantly.</Text>

        <TouchableOpacity
          onPress={handleStartSearch}
          disabled={isSearching || isConnecting || connectionStatus === 'connecting'}
          className={`mt-6 rounded-2xl py-4 items-center ${isSearching ? 'bg-red-600' : 'bg-indigo-600'} ${
            isConnecting || connectionStatus === 'connecting' ? 'opacity-60' : ''
          }`}
        >
          {isSearching || isConnecting || connectionStatus === 'connecting' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold tracking-wide">START SEARCHING</Text>
          )}
        </TouchableOpacity>

        {isSearching && (
          <TouchableOpacity
            onPress={() => stopSearching(socket)}
            className="mt-3 rounded-2xl py-3 items-center border border-red-500"
          >
            <Text className="text-red-300 font-medium">Stop Search</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="rounded-3xl bg-[#1B1B40] p-5 gap-4">
        <View className="flex-row items-center gap-2">
          <Sparkles size={18} color="#8B5CF6" />
          <Text className="text-gray-200">Smart random matching</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <ShieldCheck size={18} color="#8B5CF6" />
          <Text className="text-gray-200">Real-time secure socket session</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <User size={18} color="#8B5CF6" />
          <Text className="text-gray-200">Profile-backed identity sync</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Heart size={18} color="#8B5CF6" />
          <Text className="text-gray-200">Turn chats into friendships</Text>
        </View>
      </View>
    </View>
  );
};

export default Home;
