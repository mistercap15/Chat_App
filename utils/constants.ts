import Constants from 'expo-constants';

const fromExpoConfig = Constants.expoConfig?.extra?.apiUrl;
const fromManifest2 = (Constants as any).manifest2?.extra?.expoClient?.extra?.apiUrl;

export const BASE_URL = fromExpoConfig || fromManifest2 || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
