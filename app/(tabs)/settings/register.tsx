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
  'home': undefined;
  'settings/register': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const genders = ['Male', 'Female', 'Unknown'];
const isValidObjectId = (value?: string | null) => !!value && /^[0-9a-fA-F]{24}$/.test(value);

const SetUpProfile = () => {
  const { user, setUser } = useUserStore();
  const { socket, connectSocket, connectionStatus } = useSocketStore();
  const navigation = useNavigation<NavigationProp>();

  const [user_name, setUserName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setUserName(user?.user_name || '');
    setBio(user?.bio || '');
    setGender(user?.gender || '');
  }, [user]);

  const handleSave = async () => {
    if (!user_name.trim() || !gender) {
      Toast.show({ type: 'error', text1: 'Missing Fields', text2: 'Please fill in username and gender.' });
      return;
    }

    if (user_name.trim().length > 20) {
      Toast.show({ type: 'error', text1: 'Invalid Username', text2: 'Username cannot exceed 20 characters.' });
      return;
    }

    if (bio.trim().length > 200) {
      Toast.show({ type: 'error', text1: 'Invalid Bio', text2: 'Bio cannot exceed 200 characters.' });
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

      const shouldUpdate = isValidObjectId(user?._id);
      const endpoint = shouldUpdate ? '/api/users/update' : '/api/users/create';
      const body = shouldUpdate ? { ...payload, userId: user!._id } : payload;

      const response = await api.post(endpoint, body);
      const persistedUser = response.data?.user;

      if (!isValidObjectId(persistedUser?._id)) {
        Toast.show({ type: 'error', text1: 'Profile Error', text2: 'Server returned an invalid user profile.' });
        return;
      }

      setUser(persistedUser);

      if (socket?.connected) {
        socket.emit('set_username', {
          userId: persistedUser._id,
          username: persistedUser.user_name || 'Anonymous',
        });
      }

      if (!socket?.connected || connectionStatus !== 'connected') {
        await connectSocket(persistedUser._id);
      }

      Toast.show({
        type: 'success',
        text1: shouldUpdate ? 'Profile Updated' : 'Profile Created',
        text2: 'You are ready to start chatting 🎉',
      });

      navigation.goBack();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save profile. Please try again.';
      Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
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
            maxLength={20}
            className="bg-[#2E2E4D] text-white px-4 py-3 rounded-xl border border-gray-600"
          />
          <TouchableOpacity onPress={handleRandomUsername} className="mt-3 self-start bg-indigo-500 rounded-lg px-3 py-2">
            <Text className="text-white text-sm">Random Name</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="person-circle-outline" size={18} color="white" />
            <Text className="text-white font-medium">Gender</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {genders.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                className={`rounded-lg px-4 py-2 border ${gender === g ? 'bg-indigo-600 border-indigo-400' : 'bg-[#2E2E4D] border-gray-600'}`}
              >
                <Text className="text-white">{g}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="create-outline" size={18} color="white" />
            <Text className="text-white font-medium">Bio</Text>
          </View>
          <TextInput
            placeholder="Tell people about yourself"
            placeholderTextColor="#A0A0A0"
            value={bio}
            onChangeText={setBio}
            maxLength={200}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-[#2E2E4D] text-white px-4 py-3 rounded-xl border border-gray-600 h-32"
          />
          <Text className="text-gray-400 mt-2 text-xs">{bio.length}/200</Text>
        </View>
      </View>
    </View>
  );
};

export default SetUpProfile;
