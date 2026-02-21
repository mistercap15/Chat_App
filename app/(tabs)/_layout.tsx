import { Tabs } from "expo-router";
import { MessageCircle, Users, User } from "lucide-react-native";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemedLayout from "@/components/ThemedLayout";
import { useEffect } from "react";
import { View } from "react-native";
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

  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#0F0F2D");
  }, [isDarkMode]);

  return (
    <>
      <ThemedLayout>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: {
              backgroundColor: "#161638",
              height: 65,
              paddingBottom: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: "rgba(91, 46, 255, 0.15)",
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarActiveTintColor: "#7C3AED",
            tabBarInactiveTintColor: "#64648F",
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "600",
              marginTop: 2,
            },
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: "Chat",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? {
                  backgroundColor: "rgba(124, 58, 237, 0.15)",
                  borderRadius: 12,
                  padding: 6,
                } : { padding: 6 }}>
                  <MessageCircle
                    color={color}
                    size={22}
                    fill={focused ? color : "transparent"}
                  />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="friends"
            options={{
              title: "Friends",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? {
                  backgroundColor: "rgba(124, 58, 237, 0.15)",
                  borderRadius: 12,
                  padding: 6,
                } : { padding: 6 }}>
                  <Users
                    color={color}
                    size={22}
                    fill={focused ? color : "transparent"}
                  />
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: "Profile",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? {
                  backgroundColor: "rgba(124, 58, 237, 0.15)",
                  borderRadius: 12,
                  padding: 6,
                } : { padding: 6 }}>
                  <User
                    color={color}
                    size={22}
                    fill={focused ? color : "transparent"}
                  />
                </View>
              ),
            }}
          />
        </Tabs>
      </ThemedLayout>
      <Toast />
    </>
  );
}
