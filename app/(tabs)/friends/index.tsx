import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Users, UserX, MessageCircle, Clock, Check, X, UserPlus } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import useUserStore from '@/store/useUserStore';
import useSocketStore from '@/store/useSocketStore';
import useFriendRequestStore from '@/store/useFriendRequestStore';
import useUnreadStore from '@/store/useUnreadStore';
import api from '@/utils/api';

interface Friend {
  _id: string;
  user_name: string;
}

const Friends = () => {
  const { user } = useUserStore();
  const { socket, connectSocket } = useSocketStore();
  const { pendingRequests, fetchPendingRequests, acceptFriendRequest, rejectFriendRequest } = useFriendRequestStore();
  const { unreadCounts, clearUnread } = useUnreadStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isRemoveModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const lastFetchTimeRef = useRef<number | null>(null);
  // Use a ref for in-flight state so fetchFriends doesn't re-create on every loading change,
  // which would cause useFocusEffect to re-run and re-register socket listeners every fetch.
  const isFetchingRef = useRef(false);

  const fetchFriends = useCallback(async (force = false) => {
    if (!user?._id || (isFetchingRef.current && !force)) return;
    if (!force && lastFetchTimeRef.current && Date.now() - lastFetchTimeRef.current < 5000) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const response = await api.get('/api/users/me/friends');
      setFriends(response.data.friends || []);
      lastFetchTimeRef.current = Date.now();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch friends.' });
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [user?._id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastFetchTimeRef.current = null;
    await fetchFriends(true);
    if (user?._id) await fetchPendingRequests(user._id);
    setRefreshing(false);
  }, [fetchFriends, fetchPendingRequests, user?._id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?._id) return;
      connectSocket(user._id);
      fetchFriends();
      fetchPendingRequests(user._id);

      const friendRemovedListener = ({ removedUserId }: { removedUserId: string }) => {
        setFriends((prev) => prev.filter((f) => f._id !== removedUserId));
      };
      // friend_added fires for BOTH users when a friend request is accepted.
      // Just update local state — no API refetch needed.
      const friendAddedListener = ({ friendId: newFriendId, friendUsername }: { friendId: string; friendUsername: string }) => {
        setFriends((prev) => {
          if (prev.some((f) => f._id === newFriendId)) return prev;
          return [...prev, { _id: newFriendId, user_name: friendUsername || 'Anonymous' }];
        });
      };

      socket?.on('friend_removed', friendRemovedListener);
      socket?.on('friend_added', friendAddedListener);

      return () => {
        socket?.off('friend_removed', friendRemovedListener);
        socket?.off('friend_added', friendAddedListener);
      };
    }, [user?._id, connectSocket, socket, fetchFriends, fetchPendingRequests])
  );

  const handleRemoveFriend = async (friendId: string) => {
    if (!user?._id || !friendId) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid user or friend ID.' });
      setRemoveModalVisible(false);
      return;
    }
    try {
      await api.delete(`/api/users/friends/${friendId}`);
      setFriends((prev) => prev.filter((friend) => friend._id !== friendId));
      Toast.show({ type: 'success', text1: 'Friend Removed', text2: 'The friend has been removed.' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to remove friend.' });
    } finally {
      setRemoveModalVisible(false);
      setSelectedFriend(null);
    }
  };

  const handleAcceptRequest = async (friendId: string) => {
    await acceptFriendRequest(friendId);
    // Local state is updated by acceptFriendRequest (pending list) and the friend_added
    // socket event (friends list). No redundant refetch needed here.
  };

  const handleRejectRequest = async (friendId: string) => {
    await rejectFriendRequest(friendId);
  };

  const navigateToFriendChat = (friendId: string, friendName: string) => {
    clearUnread(friendId);
    // Pass friend name as param to avoid an extra friends-list API call in the chat screen
    router.push(`/friends/${friendId}?friendName=${encodeURIComponent(friendName)}`);
  };

  const getInitial = (name: string) => (name || 'A').charAt(0).toUpperCase();

  const getAvatarColor = (id: string) => {
    const colors = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const renderPendingRequest = ({ item }: { item: { fromUserId: string; fromUsername: string } }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(124, 58, 237, 0.08)',
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: 'rgba(124, 58, 237, 0.12)',
    }}>
      <View style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: getAvatarColor(item.fromUserId),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      }}>
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{getInitial(item.fromUsername)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>{item.fromUsername}</Text>
        <Text style={{ color: '#8888AA', fontSize: 12, marginTop: 1 }}>Wants to be your friend</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={() => handleAcceptRequest(item.fromUserId)}
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#7C3AED',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={16} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleRejectRequest(item.fromUserId)}
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: Friend }) => {
    const unreadCount = unreadCounts[item._id] || 0;

    return (
      <TouchableOpacity
        onPress={() => navigateToFriendChat(item._id, item.user_name)}
        onLongPress={() => {
          setSelectedFriend(item);
          setRemoveModalVisible(true);
        }}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#161638',
          borderRadius: 14,
          padding: 14,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: unreadCount > 0 ? 'rgba(124, 58, 237, 0.25)' : 'rgba(124, 58, 237, 0.08)',
        }}
      >
        {/* Avatar with unread badge */}
        <View style={{ position: 'relative', marginRight: 14 }}>
          <View style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: getAvatarColor(item._id),
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>{getInitial(item.user_name)}</Text>
          </View>
          {unreadCount > 0 && (
            <View style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#7C3AED',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
              borderWidth: 2,
              borderColor: '#161638',
            }}>
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{item.user_name || 'Anonymous'}</Text>
          <Text style={{ color: unreadCount > 0 ? '#A78BFA' : '#64648F', fontSize: 12, marginTop: 2 }}>
            {unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : 'Tap to chat'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => navigateToFriendChat(item._id, item.user_name)}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(124, 58, 237, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageCircle size={16} color="#7C3AED" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSelectedFriend(item);
              setRemoveModalVisible(true);
            }}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserX size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Clock size={16} color="#F59E0B" />
            <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '600', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Pending Requests ({pendingRequests.length})
            </Text>
          </View>
          {pendingRequests.map((req) => (
            <View key={req.fromUserId}>
              {renderPendingRequest({ item: req })}
            </View>
          ))}
        </View>
      )}

      {/* Friends Section Header */}
      {friends.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Users size={16} color="#7C3AED" />
          <Text style={{ color: '#7C3AED', fontSize: 13, fontWeight: '600', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Friends ({friends.length})
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F2D', paddingTop: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            backgroundColor: 'rgba(124, 58, 237, 0.15)',
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Users size={18} color="#7C3AED" />
          </View>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: '700', marginLeft: 12 }}>Friends</Text>
        </View>
        {pendingRequests.length > 0 && (
          <View style={{
            backgroundColor: '#7C3AED',
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>{pendingRequests.length}</Text>
          </View>
        )}
      </View>

      {loading && friends.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : friends.length === 0 && pendingRequests.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}>
            <UserPlus size={36} color="#7C3AED" />
          </View>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
            No friends yet
          </Text>
          <Text style={{ color: '#8888AA', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Start random chats and send friend requests to build your friend list!
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/home')}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#7C3AED',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              marginTop: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MessageCircle size={16} color="white" />
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Start Chatting</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item._id}
          renderItem={renderFriend}
          extraData={unreadCounts}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
              colors={['#7C3AED']}
            />
          }
        />
      )}

      {/* Remove Friend Modal */}
      <Modal
        visible={isRemoveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRemoveModalVisible(false);
          setSelectedFriend(null);
        }}
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
            borderColor: 'rgba(124, 58, 237, 0.15)',
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
              <UserX size={22} color="#EF4444" />
            </View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
              Remove Friend?
            </Text>
            <Text style={{ color: '#8888AA', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Remove <Text style={{ color: 'white', fontWeight: '600' }}>{selectedFriend?.user_name || 'this friend'}</Text>? You can add them again later.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setRemoveModalVisible(false);
                  setSelectedFriend(null);
                }}
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
                onPress={() => handleRemoveFriend(selectedFriend?._id || '')}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: '#EF4444',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Friends;