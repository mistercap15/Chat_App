import { Tabs } from "expo-router";
import { HomeIcon, SearchIcon, SettingsIcon } from "lucide-react-native";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemedLayout from "@/components/ThemedLayout";
import { useEffect } from "react";
import * as SystemUI from "expo-system-ui";
import Toast from "react-native-toast-message";

export default function Layout() {
  return (
    <ThemeProvider>
      <LayoutContent />
    </ThemeProvider>
  );
}

function LayoutContent() {
  const { isDarkMode } = useTheme();
  const tabBarBackground = isDarkMode ? "#2D2D2D" : "#f0f0f0";
  const tabBarStyle = {
    backgroundColor: "#1C1C3A",
    height: 60,
    paddingBottom: 10,
    paddingTop: 5,
    borderTopWidth: 0,
  };

  useEffect(() => {
    const color = isDarkMode ? "#000000" : "#fff7ed";
    SystemUI.setBackgroundColorAsync(color);
  }, [isDarkMode]);
  return (
    <>
      <ThemedLayout>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: tabBarStyle,
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              tabBarIcon: ({ color, size }) => (
                <HomeIcon color={color} size={28} />
              ),
            }}
          />
          <Tabs.Screen
            name="friends"
            options={{
              tabBarIcon: ({ color, size }) => (
                <SearchIcon color={color} size={28} />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              tabBarIcon: ({ color, size }) => (
                <SettingsIcon color={color} size={28} />
              ),
            }}
          />
        </Tabs>
      </ThemedLayout>
      <Toast />
    </>
  );
}
