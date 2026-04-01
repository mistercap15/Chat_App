import { Stack } from "expo-router";
import ThemedLayout from "@/components/ThemedLayout";

export default function FriendsLayout() {
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
        <Stack.Screen name="[friendId]" />
      </Stack>
    </ThemedLayout>
  );
}
