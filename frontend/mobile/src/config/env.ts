import { Platform } from 'react-native';

// Adjust port if your backend runs on a different port
const PORT = 3001;

// For physical devices, replace with your LAN IP
const LAN_IP = '192.168.1.5';

const ENV_API_BASE_URL =
  (typeof process !== 'undefined' && (process as any)?.env && ((process as any).env.EXPO_PUBLIC_API_BASE_URL as string | undefined))
    ? ((process as any).env.EXPO_PUBLIC_API_BASE_URL as string)
    : undefined;

export const API_BASE_URL =
  ENV_API_BASE_URL ||
  Platform.select({
    ios: `http://${LAN_IP}:${PORT}`,
    android: `http://10.0.2.2:${PORT}`,
    web: `http://localhost:${PORT}`,
    default: `http://${LAN_IP}:${PORT}`,
  })!;
