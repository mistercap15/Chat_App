import { Redirect } from "expo-router";
import "../global.css";
import useUserStore from "@/store/useUserStore";

export default function Index() {
  const { user } = useUserStore();

  if (!user?._id) {
    return <Redirect href="/(tabs)/settings/register" />;
  }

  return <Redirect href="/home" />;
}
