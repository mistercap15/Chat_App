import { useTheme } from '@/context/ThemeContext';
import { Stack, usePathname, useRouter } from 'expo-router';
import ThemedLayout from '@/components/ThemedLayout';
import { useEffect } from 'react';
import useRandomChatStore from '@/store/useRandomChatStore';

export default function HomeLayout() {
  const { isDarkMode } = useTheme();
  const { partnerId } = useRandomChatStore();
  const router = useRouter();
  const pathname = usePathname();

  const headerBg = isDarkMode ? '#1f2937' : '#fff7ed';
  const headerText = isDarkMode ? '#facc15' : '#92400e';
  const bgColor = isDarkMode ? '#000' : '#fff7ed';

  useEffect(() => {
    if (partnerId && pathname !== '/home/chat') {
      router.replace('/home/chat');
    }
  }, [partnerId, pathname, router]);

  return (
    <ThemedLayout>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { color: headerText },
          headerTintColor: headerText,
          animation: 'ios_from_right',
          headerTitleAlign: 'center',
          contentStyle: { backgroundColor: bgColor },
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Home', headerShown: false }} />
        <Stack.Screen name="chat" options={{ title: 'Chat', headerShown: false, gestureEnabled: false }} />
      </Stack>
    </ThemedLayout>
  );
}
