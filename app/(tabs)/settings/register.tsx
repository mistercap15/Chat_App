import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import api from '@/utils/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  '(tabs)/home': undefined;
  '(tabs)/settings/register': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const genders = ['Male', 'Female', 'Unknown'];

const SetUpProfile = () => {
  const { user, setUser, clearUser } = useUserStore();
  const { socket, connectSocket, connectionStatus } = useSocketStore();
  const navigation = useNavigation<NavigationProp>();

  const [user_name, setUserName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const log = (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] SetUpProfile: ${message}`, data || '');
  };

  useEffect(() => {
    if (user) {
      setUserName(user.user_name || '');
      setBio(user.bio || '');
      setGender(user.gender || '');
    } else {
      setUserName('');
      setBio('');
      setGender('');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user_name.trim() || !gender) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Please fill in username and gender.',
      });
      return;
    }

    if (user_name.length > 20) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Username',
        text2: 'Username cannot exceed 20 characters.',
      });
      return;
    }

    if (bio.length > 200) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Bio',
        text2: 'Bio cannot exceed 200 characters.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        user_name: user_name.trim(),
        gender,
        bio: bio.trim(),
        interests: user?.interests || [],
      };

      let response;
      const isExistingUser = user?._id && /^[0-9a-fA-F]{24}$/.test(user._id);

      if (isExistingUser) {
        log('Updating existing user', { userId: user._id });
        response = await api.post('/api/users/update', {
          ...payload,
          userId: user._id,
        });
      } else {
        log('Creating new user');
        response = await api.post('/api/users/create', payload);
      }

      const newUser = response.data.user;
      setUser(newUser);
      log('User saved', { userId: newUser._id, user_name: newUser.user_name });

      if (socket?.connected && newUser._id) {
        socket.emit('set_username', {
          userId: newUser._id,
          username: newUser.user_name || 'Anonymous',
        });
        log('Emitted set_username', { userId: newUser._id, username: newUser.user_name });
      }

      if (newUser._id && /^[0-9a-fA-F]{24}$/.test(newUser._id)) {
        if (!socket?.connected || connectionStatus === 'disconnected') {
          connectSocket(newUser._id);
          log('Connecting socket', { userId: newUser._id });
        }
      } else {
        log('Invalid user ID for socket connection', { userId: newUser._id });
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Invalid user ID.',
        });
        setIsSaving(false);
        return;
      }

      Toast.show({
        type: 'success',
        text1: isExistingUser ? 'Profile Updated' : 'Profile Created',
        text2: `Your profile has been ${isExistingUser ? 'updated' : 'created'}! 🎉`,
      });
      navigation.goBack();
    } catch (error: any) {
      log('Profile setup error', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      const errorMessage = error.response?.data?.message || 'Failed to save profile. Please try again.';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandomUsername = () => {
    const randomNames = ['StarGazer', 'MoonWalker', 'SkyDiver', 'DreamChaser', 'NightOwl', 'SunChaser'];
    setUserName(randomNames[Math.floor(Math.random() * randomNames.length)]);
  };

  return (
    <View className="flex-1 bg-[#1C1C3A]">
      <View className="flex-row items-center justify-between px-4 py-5 border-b border-gray-700 bg-[#1C1C3A]">
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={isSaving}>
          <Text className={`text-white font-medium text-base ${isSaving ? 'opacity-50' : ''}`}>Cancel</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-semibold">Set Up Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#5B2EFF" />
          ) : (
            <Text className="text-indigo-400 font-medium text-base">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 pt-8">
        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="person-outline" size={18} color="white" />
            <Text className="text-white font-medium">Nickname</Text>
          </View>
          <Text className="text-gray-400 text-sm mb-3">Nickname will be shown in chat</Text>
          <TextInput
            placeholder="Enter your nickname"
            placeholderTextColor="#A0A0A0"
            value={user_name}
            onChangeText={setUserName}
            className="bg-[#2E2E4D] text-white p-4 rounded-xl"
            maxLength={20}
            editable={!isSaving}
          />
          <TouchableOpacity
            onPress={handleRandomUsername}
            className="bg-indigo-600 py-3 rounded-xl mt-3 active:scale-95"
            disabled={isSaving}
          >
            <Text className="text-white font-medium text-center">Generate Random Nickname</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="information-circle-outline" size={18} color="white" />
            <Text className="text-white font-medium">About Me</Text>
          </View>
          <Text className="text-gray-400 text-sm mb-3">Add a few words about yourself to interest your partner</Text>
          <TextInput
            placeholder="Tell us about yourself"
            placeholderTextColor="#A0A0A0"
            value={bio}
            onChangeText={setBio}
            className="bg-[#2E2E4D] text-white p-4 rounded-xl h-32"
            multiline
            textAlignVertical="top"
            maxLength={200}
            editable={!isSaving}
          />
        </View>

        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="person-circle-outline" size={18} color="white" />
            <Text className="text-white font-medium">My Gender</Text>
          </View>
          <Text className="text-gray-400 text-sm mb-3">Choose your gender to get better matches</Text>
          <View className="flex-col gap-3">
            {genders.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                disabled={isSaving}
                className={`py-3 px-4 rounded-xl active:scale-95 ${
                  gender === g ? 'bg-indigo-600' : 'bg-[#2E2E4D]'
                }`}
              >
                <Text className="text-white font-medium">{g}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default SetUpProfile;