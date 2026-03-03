import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Shuffle, X, Check, MessageCircle } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import useUserStore from '@/store/useUserStore';
import useAuthStore from '@/store/useAuthStore';
import useSocketStore from '@/store/useSocketStore';
import api from '@/utils/api';

const genders = [
  { value: 'Male', icon: 'male', color: '#3B82F6' },
  { value: 'Female', icon: 'female', color: '#EC4899' },
  { value: 'Unknown', icon: 'person', color: '#8B5CF6' },
];

const randomNames = [
  'StarGazer', 'MoonWalker', 'SkyDiver', 'DreamChaser', 'NightOwl', 'SunChaser',
  'CloudRunner', 'NeonShadow', 'CosmicDust', 'PixelDream', 'ThunderBolt', 'SilverFox',
  'CyberNinja', 'AquaPhoenix', 'NebulaKid', 'IronWolf', 'CrystalVibe', 'SonicBoom',
];

const INTERESTS = [
  'Gaming', 'Movies', 'Music', 'Travel', 'Fitness', 'Cooking',
  'Reading', 'Technology', 'Art', 'Photography', 'Sports', 'Anime',
];

const MAX_INTERESTS = 5;

const SetUpProfile = () => {
  const { user, setUser } = useUserStore();
  const { setToken } = useAuthStore();
  const { socket, connectSocket, connectionStatus } = useSocketStore();
  const navigation = useNavigation();

  const [user_name, setUserName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isNewUser = !user?._id;

  useEffect(() => {
    if (user) {
      setUserName(user.user_name || '');
      setBio(user.bio || '');
      setGender(user.gender || '');
      setInterests(user.interests || []);
    } else {
      setUserName('');
      setBio('');
      setGender('');
      setInterests([]);
    }
  }, [user]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((i) => i !== interest);
      if (prev.length >= MAX_INTERESTS) return prev;
      return [...prev, interest];
    });
  };

  const handleSave = async () => {
    if (!user_name.trim() || !gender) {
      Toast.show({ type: 'error', text1: 'Missing Fields', text2: 'Please fill in nickname and gender.' });
      return;
    }
    if (user_name.length > 20) {
      Toast.show({ type: 'error', text1: 'Too Long', text2: 'Nickname cannot exceed 20 characters.' });
      return;
    }
    if (bio.length > 200) {
      Toast.show({ type: 'error', text1: 'Too Long', text2: 'Bio cannot exceed 200 characters.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        user_name: user_name.trim(),
        gender,
        bio: bio.trim(),
        interests,
      };

      let response;
      const isExistingUser = user?._id && /^[0-9a-fA-F]{24}$/.test(user._id);

      if (isExistingUser) {
        response = await api.put('/api/users/profile', payload);
      } else {
        response = await api.post('/api/auth/register', payload);
        if (response.data.token) {
          setToken(response.data.token);
        }
      }

      const newUser = response.data.user;
      setUser(newUser);

      if (newUser._id && /^[0-9a-fA-F]{24}$/.test(newUser._id)) {
        if (!socket?.connected || connectionStatus === 'disconnected') {
          connectSocket(newUser._id);
        }
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user ID.' });
        setIsSaving(false);
        return;
      }

      Toast.show({
        type: 'success',
        text1: isExistingUser ? 'Profile Updated' : 'Welcome!',
        text2: isExistingUser ? 'Your changes have been saved.' : 'Your profile is ready. Start chatting!',
      });

      if (isExistingUser) {
        navigation.goBack();
      } else {
        // Navigate to settings/index first to reset the stack, then go to home.
        // This ensures the settings tab always shows the profile/settings page,
        // not the register form, when the user taps the settings tab later.
        navigation.navigate('index' as never);
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        Toast.show({ type: 'error', text1: 'Too Many Requests', text2: 'Please wait a moment and try again.' });
      } else {
        const errorMessage = error.response?.data?.message || 'Failed to save profile. Please try again.';
        Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandomUsername = () => {
    setUserName(randomNames[Math.floor(Math.random() * randomNames.length)]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: '#0F0F2D', paddingTop: 16 }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          marginBottom: 8,
        }}>
          {isNewUser ? (
            <View style={{ width: 60 }} />
          ) : (
            <TouchableOpacity onPress={() => navigation.goBack()} disabled={isSaving} style={{ padding: 4 }}>
              <X size={22} color={isSaving ? '#64648F' : '#8888AA'} />
            </TouchableOpacity>
          )}
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>
            {isNewUser ? 'Create Profile' : 'Edit Profile'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving || !user_name.trim() || !gender}
            activeOpacity={0.7}
            style={{
              backgroundColor: user_name.trim() && gender ? '#7C3AED' : 'rgba(124, 58, 237, 0.15)',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={{ color: user_name.trim() && gender ? 'white' : '#64648F', fontWeight: '600', fontSize: 13 }}>
                {isNewUser ? 'Start' : 'Save'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
          {/* Welcome Banner for new users */}
          {isNewUser && (
            <View style={{
              backgroundColor: 'rgba(124, 58, 237, 0.08)',
              borderRadius: 16,
              padding: 20,
              alignItems: 'center',
              marginBottom: 28,
              borderWidth: 1,
              borderColor: 'rgba(124, 58, 237, 0.12)',
            }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#7C3AED',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                <MessageCircle size={24} color="white" fill="white" />
              </View>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Welcome to Zu.Chat</Text>
              <Text style={{ color: '#8888AA', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                Set up your profile to start chatting{'\n'}with people around the world.
              </Text>
            </View>
          )}

          {/* Nickname */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Nickname</Text>
              <Text style={{ color: user_name.length > 16 ? '#F59E0B' : '#64648F', fontSize: 12 }}>
                {user_name.length}/20
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#161638',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: user_name.trim() ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.06)',
              paddingRight: 6,
            }}>
              <TextInput
                placeholder="Choose a nickname"
                placeholderTextColor="#64648F"
                value={user_name}
                onChangeText={setUserName}
                style={{
                  flex: 1,
                  color: 'white',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                }}
                maxLength={20}
                editable={!isSaving}
              />
              <TouchableOpacity
                onPress={handleRandomUsername}
                disabled={isSaving}
                activeOpacity={0.7}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: 'rgba(124, 58, 237, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Shuffle size={16} color="#7C3AED" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#64648F', fontSize: 12, marginTop: 6, paddingLeft: 2 }}>
              This is how others will see you in chat
            </Text>
          </View>

          {/* About Me */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>About Me</Text>
              <Text style={{ color: bio.length > 180 ? '#F59E0B' : '#64648F', fontSize: 12 }}>
                {bio.length}/200
              </Text>
            </View>
            <TextInput
              placeholder="Tell others something interesting about yourself..."
              placeholderTextColor="#64648F"
              value={bio}
              onChangeText={setBio}
              style={{
                backgroundColor: '#161638',
                color: 'white',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 14,
                height: 100,
                fontSize: 15,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: bio.trim() ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.06)',
              }}
              multiline
              maxLength={200}
              editable={!isSaving}
            />
            <Text style={{ color: '#64648F', fontSize: 12, marginTop: 6, paddingLeft: 2 }}>
              Optional - helps your chat partners get to know you
            </Text>
          </View>

          {/* Interests */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>Interests</Text>
              <Text style={{ color: interests.length >= MAX_INTERESTS ? '#F59E0B' : '#64648F', fontSize: 12 }}>
                {interests.length}/{MAX_INTERESTS}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {INTERESTS.map((interest) => {
                const selected = interests.includes(interest);
                const atMax = interests.length >= MAX_INTERESTS && !selected;
                return (
                  <TouchableOpacity
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    disabled={isSaving || atMax}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: selected ? 'rgba(124, 58, 237, 0.2)' : '#161638',
                      borderWidth: 1,
                      borderColor: selected ? '#7C3AED' : 'rgba(124, 58, 237, 0.08)',
                      opacity: atMax ? 0.4 : 1,
                    }}
                  >
                    <Text style={{ color: selected ? '#A78BFA' : '#8888AA', fontSize: 13, fontWeight: '500' }}>
                      {interest}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ color: '#64648F', fontSize: 12, marginTop: 6, paddingLeft: 2 }}>
              Select up to {MAX_INTERESTS} interests for better matching
            </Text>
          </View>

          {/* Gender */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: 'white', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Gender</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {genders.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  onPress={() => setGender(g.value)}
                  disabled={isSaving}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: gender === g.value ? 'rgba(124, 58, 237, 0.15)' : '#161638',
                    borderWidth: 1.5,
                    borderColor: gender === g.value ? '#7C3AED' : 'rgba(124, 58, 237, 0.06)',
                  }}
                >
                  <Ionicons
                    name={g.icon as any}
                    size={22}
                    color={gender === g.value ? '#7C3AED' : '#64648F'}
                  />
                  <Text style={{
                    color: gender === g.value ? 'white' : '#8888AA',
                    fontSize: 12,
                    fontWeight: '600',
                    marginTop: 6,
                  }}>
                    {g.value}
                  </Text>
                  {gender === g.value && (
                    <View style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: '#7C3AED',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Check size={10} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: '#64648F', fontSize: 12, marginTop: 6, paddingLeft: 2 }}>
              Helps with match preferences
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

export default SetUpProfile;
