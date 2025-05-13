import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import ThemedLayout from "@/components/ThemedLayout";

export default function ExploreLayout() {
  const { isDarkMode } = useTheme();

  const headerBg = isDarkMode ? "#1f2937" : "#fff7ed";
  const headerText = isDarkMode ? "#facc15" : "#92400e";

  return (
    <ThemedLayout>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: headerBg },
          headerTitleStyle: { color: headerText },
          headerTintColor: headerText,
          animation: "ios_from_right",
          headerTitleAlign: "center",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Settings",headerShown:false }} />
        <Stack.Screen name="register" options={{ title: "Register",headerShown:false }} />
      </Stack>
    </ThemedLayout>
  );
}
