import { Redirect } from 'expo-router';
import useUserStore from '@/store/useUserStore';
import '../global.css';

const isValidObjectId = (value?: string | null) => !!value && /^[0-9a-fA-F]{24}$/.test(value);

export default function Index() {
  const user = useUserStore((state) => state.user);
  const initialRoute = isValidObjectId(user?._id) ? '/(tabs)/home' : '/(tabs)/settings/register';

  return <Redirect href={initialRoute} />;
}
