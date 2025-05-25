import { useTheme } from "@/context/ThemeContext";
import { Stack, useRouter } from "expo-router";
import ThemedLayout from "@/components/ThemedLayout";
import useSocketStore from "@/store/useSocketStore";
import { useEffect } from "react";

export default function HomeLayout() {
  const { isDarkMode } = useTheme();
  const { randomPartnerId } = useSocketStore();
  const router = useRouter();

  const headerBg = isDarkMode ? "#1f2937" : "#fff7ed";
  const headerText = isDarkMode ? "#facc15" : "#92400e";
  const bgColor = isDarkMode ? "#000" : "#fff7ed";

  // Redirect to random chat only if a random match is found (randomPartnerId exists)
  useEffect(() => {
    if (randomPartnerId) {
      console.log(`[${new Date().toISOString()}] HomeLayout: Active random chat detected, redirecting to chat`, { randomPartnerId });
      router.replace('/(tabs)/home/chat');
    }
  }, [randomPartnerId, router]);

  return (
    <ThemedLayout>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { color: headerText },
          headerTintColor: headerText,
          animation: "ios_from_right",
          headerTitleAlign: "center",
          contentStyle: { backgroundColor: bgColor },
          gestureEnabled: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: "Home", headerShown: false }}
        />
        <Stack.Screen
          name="chat"
          options={{ 
            title: "Chat", 
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>
    </ThemedLayout>
  );
}