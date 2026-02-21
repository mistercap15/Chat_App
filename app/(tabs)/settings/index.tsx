import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Edit3, Trash2, Bell, Lock, Globe, ChevronRight } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import useUserStore from '@/store/useUserStore';
import useAuthStore from '@/store/useAuthStore';
import useSocketStore from '@/store/useSocketStore';
import api from '@/utils/api';
import Toast from 'react-native-toast-message';

const Settings = () => {
  const router = useRouter();
  const { user, clearUser }: any = useUserStore();
  const { clearToken } = useAuthStore();
  const { socket, disconnectSocket } = useSocketStore();
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.on('user_deleted', ({ userId }: { userId: string }) => {
      if (userId === user?._id) {
        clearUser();
        clearToken();
        disconnectSocket();
        setIsDeleting(false);
        setDeleteModalVisible(false);
        Toast.show({ type: 'success', text1: 'Account Deleted', text2: 'Your account has been deleted.' });
        router.replace('/(tabs)/settings/register');
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
      await api.delete('/api/users/account');
      clearUser();
      clearToken();
      disconnectSocket();
      setIsDeleting(false);
      setDeleteModalVisible(false);
      Toast.show({ type: 'success', text1: 'Account Deleted', text2: 'Your account has been deleted.' });
      router.replace('/(tabs)/settings/register');
    } catch (error: any) {
      setIsDeleting(false);
      setDeleteModalVisible(false);
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to delete account.' });
    }
  };

  const handleOptionPress = (label: string) => {
    Toast.show({ type: 'info', text1: 'Coming Soon', text2: `${label} will be available soon.` });
  };

  const getInitial = () => (user?.user_name || 'A').charAt(0).toUpperCase();

  const getGenderIcon = () => {
    switch (user?.gender) {
      case 'Male': return 'male';
      case 'Female': return 'female';
      default: return 'person';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F2D', paddingTop: 16 }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 24,
      }}>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>Profile</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/settings/register')}
          disabled={isDeleting}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(124, 58, 237, 0.15)',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            gap: 6,
          }}
        >
          <Edit3 size={14} color="#7C3AED" />
          <Text style={{ color: '#7C3AED', fontWeight: '600', fontSize: 13 }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Profile Card */}
        <View style={{
          backgroundColor: '#161638',
          borderRadius: 20,
          padding: 24,
          alignItems: 'center',
          marginBottom: 20,
          borderWidth: 1,
          borderColor: 'rgba(124, 58, 237, 0.1)',
        }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#7C3AED',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Text style={{ color: 'white', fontSize: 32, fontWeight: '700' }}>{getInitial()}</Text>
          </View>
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
            {user?.user_name || 'Anonymous'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={getGenderIcon()} size={14} color="#8888AA" />
            <Text style={{ color: '#8888AA', fontSize: 13 }}>{user?.gender || 'Not set'}</Text>
          </View>
        </View>

        {/* Bio Section */}
        <View style={{
          backgroundColor: '#161638',
          borderRadius: 16,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: 'rgba(124, 58, 237, 0.08)',
        }}>
          <Text style={{ color: '#A78BFA', fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            About Me
          </Text>
          <Text style={{ color: user?.bio ? '#C4C4E0' : '#64648F', fontSize: 14, lineHeight: 20 }}>
            {user?.bio || 'No bio set. Tap Edit to add one!'}
          </Text>
        </View>

        {/* Settings Options */}
        <Text style={{ color: '#64648F', fontSize: 11, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 4 }}>
          Settings
        </Text>
        <View style={{
          backgroundColor: '#161638',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 20,
          borderWidth: 1,
          borderColor: 'rgba(124, 58, 237, 0.08)',
        }}>
          {[
            { icon: Bell, label: 'Notifications', color: '#F59E0B' },
            { icon: Lock, label: 'Privacy', color: '#10B981' },
            { icon: Globe, label: 'Language', color: '#3B82F6' },
          ].map((item, index, arr) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => handleOptionPress(item.label)}
              activeOpacity={0.6}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: index < arr.length - 1 ? 1 : 0,
                borderBottomColor: 'rgba(124, 58, 237, 0.06)',
              }}
            >
              <View style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: `${item.color}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}>
                <item.icon size={17} color={item.color} />
              </View>
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '500', flex: 1 }}>{item.label}</Text>
              <ChevronRight size={18} color="#64648F" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Danger Zone */}
        <Text style={{ color: '#64648F', fontSize: 11, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 4 }}>
          Danger Zone
        </Text>
        <TouchableOpacity
          onPress={() => setDeleteModalVisible(true)}
          disabled={isDeleting}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.15)',
            opacity: isDeleting ? 0.5 : 1,
          }}
        >
          <View style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}>
            <Trash2 size={17} color="#EF4444" />
          </View>
          <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '500', flex: 1 }}>Delete Account</Text>
          <ChevronRight size={18} color="#EF4444" />
        </TouchableOpacity>

        {/* App Version */}
        <Text style={{ color: '#3A3A5C', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
          Zu.Chat v1.0.0
        </Text>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          paddingHorizontal: 32,
        }}>
          <View style={{
            backgroundColor: '#161638',
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 340,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.15)',
          }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: 16,
            }}>
              <Trash2 size={22} color="#EF4444" />
            </View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
              Delete Account?
            </Text>
            <Text style={{ color: '#8888AA', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              This action is permanent and cannot be undone. All your data, friends, and chat history will be lost.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: '#EF4444',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Settings;