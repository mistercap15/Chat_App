import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Configure how notifications are presented when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers for push notifications and returns the Expo push token.
 * Returns null if permissions are denied or running on simulator.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  // Set up Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'Chat message notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('friend-requests', {
      name: 'Friend Requests',
      description: 'Friend request notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      sound: 'default',
    });
  }

  return tokenData.data;
}

/**
 * Sends the Expo push token to the backend to be saved for the current user.
 */
export async function savePushTokenToBackend(expoPushToken: string): Promise<void> {
  try {
    await api.post('/api/users/push-token', { expoPushToken });
    console.log('Push token saved to backend');
  } catch (error) {
    console.error('Failed to save push token to backend:', error);
  }
}

/**
 * Removes the push token from the backend (e.g., on logout/account deletion).
 */
export async function removePushTokenFromBackend(): Promise<void> {
  try {
    await api.delete('/api/users/push-token');
    console.log('Push token removed from backend');
  } catch (error) {
    console.error('Failed to remove push token from backend:', error);
  }
}
