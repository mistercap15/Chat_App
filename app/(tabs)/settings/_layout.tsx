import { Stack } from "expo-router";
import ThemedLayout from "@/components/ThemedLayout";

export default function SettingsLayout() {
  return (
    <ThemedLayout>
      <Stack
        screenOptions={{
          animation: "ios_from_right",
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F2D' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms" />
      </Stack>
    </ThemedLayout>
  );
}
