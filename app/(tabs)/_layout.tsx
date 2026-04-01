import { Tabs } from "expo-router";
import { MessageCircle, Users, User } from "lucide-react-native";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemedLayout from "@/components/ThemedLayout";
import { useEffect } from "react";
import { View } from "react-native";
import * as SystemUI from "expo-system-ui";
import Toast from "react-native-toast-message";
import { BlurView } from "expo-blur";
import usePushNotifications from "@/hooks/usePushNotifications";

export default function Layout() {
  return (
    <ThemeProvider>
      <LayoutContent />
    </ThemeProvider>
  );
}

function LayoutContent() {
  const { isDarkMode } = useTheme();
  usePushNotifications();

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
              backgroundColor: "transparent",
              borderTopWidth: 0,
              height: 62,
              marginHorizontal: 20,
              marginBottom: 18,
              marginTop: 4,
              borderRadius: 32,
              overflow: "hidden",
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarBackground: () => (
              <BlurView
                intensity={50}
                tint="dark"
                style={{
                  flex: 1,
                  backgroundColor: "rgba(16, 14, 44, 0.92)",
                  borderRadius: 32,
                  borderWidth: 1,
                  borderColor: "rgba(124, 58, 237, 0.22)",
                  overflow: "hidden",
                }}
              />
            ),
            tabBarActiveTintColor: "#7C3AED",
            tabBarInactiveTintColor: "#4A4A72",
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "600",
              marginTop: 1,
            },
            tabBarItemStyle: {
              paddingVertical: 6,
            },
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: "Chat",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? {
                  backgroundColor: "rgba(124, 58, 237, 0.18)",
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                } : { paddingHorizontal: 14, paddingVertical: 5 }}>
                  <MessageCircle
                    color={color}
                    size={20}
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
                  backgroundColor: "rgba(124, 58, 237, 0.18)",
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                } : { paddingHorizontal: 14, paddingVertical: 5 }}>
                  <Users
                    color={color}
                    size={20}
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
                  backgroundColor: "rgba(124, 58, 237, 0.18)",
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                } : { paddingHorizontal: 14, paddingVertical: 5 }}>
                  <User
                    color={color}
                    size={20}
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
