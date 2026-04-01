import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState, AppStateStatus } from 'react-native';
import useUserStore from '@/store/useUserStore';
import useAuthStore from '@/store/useAuthStore';
import { registerForPushNotificationsAsync, savePushTokenToBackend } from '@/utils/notifications';

/**
 * Hook that manages push notification registration and response handling.
 * Should be called once at the app root level.
 */
export default function usePushNotifications() {
  const { user } = useUserStore();
  const { token } = useAuthStore();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const hasRegistered = useRef(false);

  // Register for push notifications when user is authenticated
  useEffect(() => {
    if (!user?._id || !token || hasRegistered.current) return;

    const register = async () => {
      const expoPushToken = await registerForPushNotificationsAsync();
      if (expoPushToken) {
        await savePushTokenToBackend(expoPushToken);
        hasRegistered.current = true;
      }
    };

    register();
  }, [user?._id, token]);

  // Re-register token when app comes back to foreground (token may have changed)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user?._id && token) {
        const expoPushToken = await registerForPushNotificationsAsync();
        if (expoPushToken) {
          await savePushTokenToBackend(expoPushToken);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user?._id, token]);

  // Listen for incoming notifications while app is in foreground
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      // Notification received in foreground - the handler in notifications.ts
      // controls whether it shows as an alert. We can add custom logic here
      // if needed (e.g., suppress notification if user is already in that chat).
      console.log('Notification received in foreground:', notification.request.content.title);
    });

    // Handle notification tap (user tapped on the notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      if (data?.type === 'friend_request') {
        router.push('/(tabs)/friends');
      } else if (data?.type === 'friend_message' && data?.friendId) {
        router.push(`/friends/${data.friendId}`);
      } else if (data?.type === 'friend_accepted') {
        router.push('/(tabs)/friends');
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Reset registration flag on logout
  useEffect(() => {
    if (!user?._id) {
      hasRegistered.current = false;
    }
  }, [user?._id]);
}
