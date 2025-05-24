import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import ThemedLayout from "@/components/ThemedLayout";

function InnerLayout() {
  const { isDarkMode } = useTheme();

  const headerBg = isDarkMode ? "#1f2937" : "#fff7ed";
  const headerText = isDarkMode ? "#facc15" : "#92400e";
  const bgColor = isDarkMode ? "#000" : "#fff7ed";

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
          headerShown: false
        }}
      >
        <Stack.Screen
          name="chat"
          options={{ title: "Chat", headerShown: false }}
        />
        <Stack.Screen
          name="[friendId]"
          options={{ title: "Friends Chat", headerShown: false }}
        />
      </Stack>
    </ThemedLayout>
  );
}

export default function HomeLayout() {
  return (
    <ThemeProvider>
      <InnerLayout />
    </ThemeProvider>
  );
}
