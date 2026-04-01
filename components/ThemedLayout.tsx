import { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

interface ThemedLayoutProps {
  children: ReactNode;
}

export default function ThemedLayout({ children }: ThemedLayoutProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F0F2D" }}>
      <StatusBar style="light" backgroundColor="#0F0F2D" translucent={false} />
      {children}
    </SafeAreaView>
  );
}
