import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, Shield, Zap, Wifi, WifiOff } from 'lucide-react-native';
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

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isSearching) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.timing(rotateAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
      glowAnim.setValue(0.3);
    }
  }, [isSearching]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useFocusEffect(
    useCallback(() => {
      if (!user?._id) return;
      if (!socket?.connected || connectionStatus === 'disconnected') {
        connectSocket(user._id);
      }
      return () => {
        stopSearching(socket);
      };
    }, [user?._id, socket, connectionStatus, connectSocket, stopSearching])
  );

  const handleStartSearch = () => {
    if (!user?._id) {
      Toast.show({ type: 'error', text1: 'Profile Not Set Up', text2: 'Please register to start chatting.' });
      router.push('/(tabs)/settings/register');
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
          }, () => {
            Toast.show({ type: 'info', text1: 'No Match Found', text2: 'No one is available right now. Try again!' });
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
    }, () => {
      Toast.show({ type: 'info', text1: 'No Match Found', text2: 'No one is available right now. Try again!' });
    });
  };

  const handleStopSearch = () => {
    stopSearching(socket);
  };

  return (
    <View className="flex-1 bg-[#0F0F2D]" style={{ paddingTop: 16 }}>
      {/* Header */}
      <View className="flex-row justify-between items-center px-6 mb-4">
        <View className="flex-row items-center">
          <View style={{
            backgroundColor: '#7C3AED',
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MessageCircle size={18} color="white" fill="white" />
          </View>
          <Text className="text-white text-xl font-bold ml-3" style={{ letterSpacing: 0.5 }}>Zu.Chat</Text>
        </View>
        <View className="flex-row items-center" style={{
          backgroundColor: connectionStatus === 'connected' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 20,
        }}>
          {connectionStatus === 'connected' ? (
            <Wifi size={12} color="#22C55E" />
          ) : (
            <WifiOff size={12} color="#EF4444" />
          )}
          <Text style={{
            color: connectionStatus === 'connected' ? '#22C55E' : '#EF4444',
            fontSize: 11,
            fontWeight: '600',
            marginLeft: 4,
          }}>
            {connectionStatus === 'connected' ? 'Online' : connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 items-center justify-center px-6" style={{ marginTop: -40 }}>
        {/* Animated Hero Circle */}
        <View className="items-center mb-10">
          <Animated.View style={{
            transform: [{ scale: pulseAnim }],
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: 'rgba(124, 58, 237, 0.08)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Animated.View style={{
              opacity: glowAnim,
              width: 130,
              height: 130,
              borderRadius: 65,
              backgroundColor: 'rgba(124, 58, 237, 0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <View style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: 'rgba(124, 58, 237, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isSearching ? (
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="search" size={40} color="#7C3AED" />
                  </Animated.View>
                ) : (
                  <Ionicons name="chatbubbles" size={40} color="#7C3AED" />
                )}
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {/* Text */}
        <Text className="text-white text-2xl font-bold text-center mb-2" style={{ letterSpacing: 0.3 }}>
          {isSearching ? 'Finding your match...' : 'Meet someone new'}
        </Text>
        <Text className="text-center mb-10" style={{ color: '#8888AA', fontSize: 15, lineHeight: 22 }}>
          {isSearching
            ? 'Hang tight! We\'re connecting you with someone interesting.'
            : 'Start a random anonymous conversation\nwith people around the world.'}
        </Text>

        {/* Main Button */}
        {isSearching ? (
          <TouchableOpacity
            onPress={handleStopSearch}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#DC2626',
              paddingHorizontal: 48,
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#DC2626',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Ionicons name="close-circle" size={20} color="white" style={{ marginRight: 8 }} />
            <Text className="text-white text-base font-bold" style={{ letterSpacing: 1 }}>STOP</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStartSearch}
            disabled={connectionStatus === 'connecting'}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#7C3AED',
              paddingHorizontal: 48,
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: connectionStatus === 'connecting' ? 0.5 : 1,
              shadowColor: '#7C3AED',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {connectionStatus === 'connecting' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="white" style={{ marginRight: 8 }} />
                <Text className="text-white text-base font-bold" style={{ letterSpacing: 1 }}>START CHAT</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Welcome Text */}
        {user?.user_name && !isSearching && (
          <Text style={{ color: '#64648F', fontSize: 13, marginTop: 16 }}>
            Welcome back, <Text style={{ color: '#7C3AED', fontWeight: '600' }}>{user.user_name}</Text>
          </Text>
        )}
      </View>

      {/* Bottom Features */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        paddingBottom: 12,
        paddingHorizontal: 24,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Shield size={12} color="#4A4A72" />
          <Text style={{ color: '#4A4A72', fontSize: 11, fontWeight: '500' }}>Anonymous</Text>
        </View>
        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#2A2A4A' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Zap size={12} color="#4A4A72" />
          <Text style={{ color: '#4A4A72', fontSize: 11, fontWeight: '500' }}>Instant Match</Text>
        </View>
        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#2A2A4A' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <MessageCircle size={12} color="#4A4A72" />
          <Text style={{ color: '#4A4A72', fontSize: 11, fontWeight: '500' }}>Real-time</Text>
        </View>
      </View>
    </View>
  );
};

export default Home;