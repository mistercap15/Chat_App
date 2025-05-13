import { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/context/ThemeContext";

interface ThemedLayoutProps {
  children: ReactNode;
}

export default function ThemedLayout({ children }: ThemedLayoutProps) {
  const { isDarkMode } = useTheme();
  const bgColor = isDarkMode ? "#000" : "#fff7ed";
  const statusStyle = isDarkMode ? "light" : "dark";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1C1C3A" }}>
      <StatusBar style={statusStyle} backgroundColor={"#1C1C3A"} translucent={false} />
      {children}
    </SafeAreaView>
  );
}
