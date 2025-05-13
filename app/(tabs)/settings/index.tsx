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
  <TouchableOpacity onPress={onPress} className="flex-row items-center bg-[#2E2E4D] rounded-xl p-4">
    <Ionicons name={icon} size={24} color="#8B5CF6" />
    <Text className="text-white text-base ml-3">{label}</Text>
  </TouchableOpacity>
);

const Settings: React.FC = () => {
  const router = useRouter();
  const { user, clearUser } = useUserStore();
  const { socket, resetState } = useSocketStore();
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] Settings: ${message}`, data || '');
  };

  useEffect(() => {
    log('Settings component mounted', { userId: user?._id, socketConnected: socket?.connected });
    if (!socket) {
      log('No socket instance available');
      return;
    }

    socket.on('connect', () => log('Socket connected'));
    socket.on('disconnect', () => log('Socket disconnected'));
    socket.on('user_deleted', ({ userId }: { userId: string }) => {
      log('User deleted event received', { userId, currentUserId: user?._id });
      if (userId === user?._id) {
        log('Processing user deletion');
        clearUser();
        resetState();
        log('User state cleared');
        setIsDeleting(false);
        setDeleteModalVisible(false);
        log('Modal closed and loader stopped');
        Toast.show({
          type: 'success',
          text1: 'Account Deleted',
          text2: 'Your account has been deleted successfully.',
        });
        log('Success toast triggered');
        router.replace('/(tabs)/home');
        log('Navigated to home');
      } else {
        log('User ID mismatch, ignoring event');
      }
    });

    return () => {
      log('Cleaning up socket listeners');
      socket.off('user_deleted');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket, user?._id, clearUser, resetState]);

  const handleDeleteAccount = async () => {
    if (!user?._id) {
      log('No user ID, cannot delete');
      Toast.show({ type: 'error', text1: 'Error', text2: 'User ID not found.' });
      setDeleteModalVisible(false);
      return;
    }

    if (isDeleting) {
      log('Delete already in progress');
      Toast.show({ type: 'info', text1: 'Processing', text2: 'Delete request is already in progress.' });
      return;
    }

    setIsDeleting(true);
    setDeleteModalVisible(true); // Ensure modal stays open during deletion
    log('Deleting account', { userId: user?._id });

    try {
      const response = await api.post('/api/users/delete', { userId: user._id }, { timeout: 10000 });
      log('Delete response received', { response: response.data });
      // Fallback: Handle success via HTTP if socket event is missed
      if (response.data.message === 'User deleted successfully.') {
        log('Handling delete success via HTTP response');
        clearUser();
        resetState();
        setIsDeleting(false);
        setDeleteModalVisible(false);
        Toast.show({
          type: 'success',
          text1: 'Account Deleted',
          text2: 'Your account has been deleted successfully.',
        });
        router.replace('/(tabs)/home');
        log('Processed delete via HTTP: state cleared, modal closed, navigated to home');
      }
    } catch (error: any) {
      log('Error deleting account', { error: error.message, response: error.response?.data });
      setIsDeleting(false);
      setDeleteModalVisible(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Failed to delete account.',
      });
    }
  };

  const handleOptionPress = (label: string) => {
    log('Option pressed', { label });
    Toast.show({ type: 'info', text1: 'Coming Soon', text2: `${label} is not yet implemented.` });
  };

  return (
    <View className="flex-1 bg-[#1C1C3A]">
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-b-gray-700 bg-[#1C1C3A]">
        <View className="flex-row items-center gap-2">
          <Ionicons name="settings-outline" size={26} color="white" />
          <Text className="text-white text-xl font-semibold">Settings</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            log('Navigating to edit profile');
            router.push('/(tabs)/settings/register');
          }}
          disabled={isDeleting}
        >
          <Text className="text-indigo-400 font-semibold text-base">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="px-4 pt-4">
        <View className="items-center mb-6">
          <Image
            source={{ uri: 'https://via.placeholder.com/150' }}
            className="w-24 h-24 rounded-full mb-2 border-4 border-[#5B2EFF]"
          />
          <Text className="text-white text-lg font-semibold">{user?.user_name || 'Anonymous'}</Text>
          <Text className="text-gray-400 text-sm">{user?.gender || 'Gender not set'}</Text>
        </View>

        <View className="bg-[#2E2E4D] rounded-xl p-4 mb-6">
          <Text className="text-white font-semibold mb-1">About me</Text>
          <Text className="text-gray-300">{user?.bio || 'No bio set'}</Text>
        </View>

        <View className="flex-col gap-4 mb-6">
          <Option icon="cloud-outline" label="Account Backup" onPress={() => handleOptionPress('Account Backup')} />
          <Option icon="help-circle-outline" label="Support" onPress={() => handleOptionPress('Support')} />
          <Option
            icon="notifications-outline"
            label="Notifications & Sounds"
            onPress={() => handleOptionPress('Notifications & Sounds')}
          />
          <Option icon="moon-outline" label="Appearance" onPress={() => handleOptionPress('Appearance')} />
          <Option
            icon="chatbox-ellipses-outline"
            label="Chat Options"
            onPress={() => handleOptionPress('Chat Options')}
          />
        </View>

        <TouchableOpacity
          onPress={() => {
            log('Opening delete modal');
            setDeleteModalVisible(true);
          }}
          disabled={isDeleting}
          className={`py-4 rounded-xl mb-10 items-center ${isDeleting ? 'bg-red-400' : 'bg-red-600'}`}
        >
          <Text className="text-white font-semibold text-base">
            {isDeleting ? 'Deleting...' : 'Clear Data & Delete Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) {
            log('Delete modal cancelled');
            setDeleteModalVisible(false);
          }
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50 px-6">
          <View className="bg-[#2E2E4D] rounded-xl p-6 w-full max-w-md">
            <Text className="text-white text-lg font-semibold mb-3">Confirm Deletion</Text>
            <Text className="text-gray-300 mb-5">
              Are you sure you want to delete your account? This action cannot be undone.
            </Text>
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={() => {
                  log('Delete modal cancelled');
                  setIsDeleting(false);
                  setDeleteModalVisible(false);
                }}
                disabled={isDeleting}
                className="bg-gray-600 px-6 py-2 rounded-xl"
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                className={`px-6 py-2 rounded-xl ${isDeleting ? 'bg-red-400' : 'bg-red-600'}`}
              >
                <Text className="text-white font-semibold">{isDeleting ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Settings;