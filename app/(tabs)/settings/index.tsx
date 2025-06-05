// src/components/Settings.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';

interface OptionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

const Option: React.FC<OptionProps> = ({ icon, label, onPress }) => (
  <TouchableOpacity onPress={onPress} className="flex-row items-center bg-[#2E2E4D] rounded-xl p-4 mb-3">
    <Ionicons name={icon} size={24} color="#8B5CF6" />
    <Text className="text-white text-base ml-3">{label}</Text>
  </TouchableOpacity>
);

const Settings = () => {
  const router = useRouter();
  const { user, clearUser }:any = useUserStore();
  const { socket, disconnectSocket } = useSocketStore();
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Settings: ${message}`, data || '');
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('user_deleted', ({ userId }: { userId: string }) => {
      if (userId === user?._id) {
        clearUser();
        disconnectSocket();
        setIsDeleting(false);
        setDeleteModalVisible(false);
        Toast.show({ type: 'success', text1: 'Account Deleted', text2: 'Your account has been deleted successfully.' });
        router.replace('/(tabs)/home');
      }
    });
    return () => {
      socket.off('user_deleted');
    };
  }, [socket, user?._id, clearUser, disconnectSocket]);

  const handleDeleteAccount = async () => {
    if (!user?._id || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.post('/api/users/delete', { userId: user._id });
      clearUser();
      disconnectSocket();
      setIsDeleting(false);
      setDeleteModalVisible(false);
      Toast.show({ type: 'success', text1: 'Account Deleted', text2: 'Your account has been deleted successfully.' });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      setIsDeleting(false);
      setDeleteModalVisible(false);
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to delete account.' });
    }
  };

  const handleOptionPress = (label: string) => {
    Toast.show({ type: 'info', text1: 'Coming Soon', text2: `${label} is not yet implemented.` });
  };

  return (
    <View className="flex-1 bg-[#1C1C3A]">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-700 bg-[#1C1C3A]">
        <View className="flex-row items-center gap-2">
          <Ionicons name="settings-outline" size={26} color="white" />
          <Text className="text-white text-xl font-semibold">Settings</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings/register')} disabled={isDeleting}>
          <Text className="text-indigo-400 font-semibold text-base">Edit</Text>
        </TouchableOpacity>
      </View>
      <ScrollView className="px-4 pt-4">
        <View className="items-center mb-6">
          <Image
            source={{ uri: user?.profile_picture || 'https://via.placeholder.com/150' }}
            className="w-24 h-24 rounded-full mb-2 border-4 border-[#5B2EFF]"
          />
          <Text className="text-white text-lg font-semibold">{user?.user_name || 'Anonymous'}</Text>
          <Text className="text-gray-400 text-sm">{user?.gender || 'Gender not set'}</Text>
        </View>
        <View className="bg-[#2E2E4D] rounded-xl p-4 mb-6">
          <Text className="text-white font-semibold mb-1">About me</Text>
          <Text className="text-gray-300">{user?.bio || 'No bio set'}</Text>
        </View>
        <View className="flex-col gap-3 mb-6">
          <Option icon="notifications-outline" label="Notifications" onPress={() => handleOptionPress('Notifications')} />
          <Option icon="lock-closed-outline" label="Privacy" onPress={() => handleOptionPress('Privacy')} />
          <Option icon="language-outline" label="Language" onPress={() => handleOptionPress('Language')} />
          <Option icon="color-palette-outline" label="Theme" onPress={() => handleOptionPress('Theme')} />
        </View>
        <TouchableOpacity
          onPress={() => setDeleteModalVisible(true)}
          disabled={isDeleting}
          className={`bg-red-600 rounded-xl p-4 flex-row items-center justify-center ${isDeleting ? 'opacity-50' : ''}`}
        >
          <Ionicons name="trash-outline" size={24} color="white" />
          <Text className="text-white text-base font-semibold ml-3">Delete Account</Text>
        </TouchableOpacity>
        <View className="h-20" />
      </ScrollView>
      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-[#2E2E4D] rounded-xl p-6 w-full max-w-md">
            <Text className="text-white text-lg font-semibold mb-3">Delete Account</Text>
            <Text className="text-gray-300 mb-5">
              Are you sure you want to delete your account? This action is permanent and cannot be undone.
            </Text>
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                className="bg-gray-500 py-2 px-4 rounded-xl flex-1 mr-2 items-center"
              >
                <Text className="text-white font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                className={`bg-red-600 py-2 px-4 rounded-xl flex-1 ml-2 items-center ${isDeleting ? 'opacity-50' : ''}`}
              >
                <Text className="text-white font-medium">{isDeleting ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Settings;