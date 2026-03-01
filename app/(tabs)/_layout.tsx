import { Tabs } from "expo-router";
import { MessageCircle, Users, User } from "lucide-react-native";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import ThemedLayout from "@/components/ThemedLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useEffect } from "react";
import { View, Text } from "react-native";
import * as SystemUI from "expo-system-ui";
import Toast from "react-native-toast-message";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import usePushNotifications from "@/hooks/usePushNotifications";
import useUnreadStore from "@/store/useUnreadStore";
import useFriendRequestStore from "@/store/useFriendRequestStore";
import useAuthStore from "@/store/useAuthStore";
import useUserStore from "@/store/useUserStore";
import api from "@/utils/api";

export default function Layout() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <LayoutContent />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

function LayoutContent() {
  const { isDarkMode } = useTheme();
  usePushNotifications();

  const unreadCounts = useUnreadStore((s) => s.unreadCounts);
  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
  const pendingRequestCount = useFriendRequestStore((s) => s.pendingRequests.length);
  const friendsBadgeCount = totalUnread + pendingRequestCount;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#0F0F2D");
  }, [isDarkMode]);

  // On startup, refresh the auth token. On failure, redirect to register.
  useEffect(() => {
    const refreshOnStartup = async () => {
      const token = useAuthStore.getState().token;
      if (!token) return;
      try {
        const response = await api.post('/api/auth/token/refresh');
        if (response.data.token) {
          useAuthStore.getState().setToken(response.data.token);
        }
      } catch {
        useAuthStore.getState().clearToken();
        useUserStore.getState().clearUser();
        router.replace('/(tabs)/settings/register');
      }
    };
    refreshOnStartup();
  }, []);

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
                <View style={{ position: "relative" }}>
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
                  {friendsBadgeCount > 0 && (
                    <View style={{
                      position: "absolute",
                      top: -4,
                      right: 2,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: "#EF4444",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                      borderWidth: 2,
                      borderColor: "rgba(16, 14, 44, 0.92)",
                    }}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
                        {friendsBadgeCount > 99 ? "99+" : friendsBadgeCount}
                      </Text>
                    </View>
                  )}
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
