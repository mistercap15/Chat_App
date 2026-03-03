import { Redirect } from "expo-router";
import "../global.css";
import useUserStore from "@/store/useUserStore";

export default function Index() {
  const { user } = useUserStore();

  // Always go to home — home screen handles unregistered users,
  // and settings tab starts cleanly at index (not register) this way.
  if (!user?._id) {
    return <Redirect href="/(tabs)/settings" />;
  }

  return <Redirect href="/home" />;
}
