import { Stack, useRouter } from 'expo-router';
import ThemedLayout from '@/components/ThemedLayout';
import { useEffect } from 'react';
import useRandomChatStore from '@/store/useRandomChatStore';

export default function HomeLayout() {
  const { partnerId } = useRandomChatStore();
  const router = useRouter();

  useEffect(() => {
    if (partnerId) {
      router.replace('/(tabs)/home/chat');
    }
  }, [partnerId, router]);

  return (
    <ThemedLayout>
      <Stack
        screenOptions={{
          animation: 'ios_from_right',
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F2D' },
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="chat" options={{ gestureEnabled: false }} />
      </Stack>
    </ThemedLayout>
  );
}