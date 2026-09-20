import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * CallShadow Dynamic API & WebSocket Configuration
 * 
 * Auto-discovery hierarchy:
 * 1. Explicit Environment Variable: EXPO_PUBLIC_API_URL
 * 2. Expo Metro Dev Server Host (Physical device running Expo Go over Wi-Fi, e.g. 192.168.1.6:8081 -> 192.168.1.6:8000)
 * 3. Android Emulator loopback: 10.0.2.2:8000 (when not in Expo Go)
 * 4. Local LAN fallback: 192.168.1.6:8000
 * 5. Web / iOS Simulator fallback: localhost:8000
 */

const DEFAULT_PORT = '8000';
// Local Wi-Fi / Hotspot LAN fallback IP
const LAN_FALLBACK_IP = '192.168.1.5';

function extractHostFromExpo(): string | null {
  try {
    // 1. Expo SDK 50+ expoConfig
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }

    // 2. Legacy / Native Manifest debuggerHost
    const manifest = (Constants as any).manifest;
    if (manifest?.debuggerHost) {
      const host = manifest.debuggerHost.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }

    // 3. Manifest2 expoClient
    const manifest2 = (Constants as any).manifest2;
    if (manifest2?.extra?.expoClient?.hostUri) {
      const host = manifest2.extra.expoClient.hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch (e) {
    // Fallback if Constants is unavailable
  }
  return null;
}

let cachedBaseUrl: string | null = null;

export function clearApiBaseUrlCache(): void {
  cachedBaseUrl = null;
}

export function getApiBaseUrl(): string {
  if (typeof cachedBaseUrl === 'string' && cachedBaseUrl.length > 0) {
    return cachedBaseUrl;
  }

  // 1. Explicit environment variable
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    const sanitized = envUrl.trim().replace(/\/+$/, '');
    cachedBaseUrl = sanitized;
    console.log(`[API] Base URL (ENV): ${sanitized}`);
    return sanitized;
  }

  // 2. Extract host dynamically from Expo Dev Server
  const expoHost = extractHostFromExpo();
  if (typeof expoHost === 'string' && expoHost.length > 0) {
    const url = `http://${expoHost}:${DEFAULT_PORT}`;
    cachedBaseUrl = url;
    console.log(`[API] Base URL (Expo Host): ${url}`);
    return url;
  }

  // 3. Web or iOS Simulator
  if (Platform.OS === 'web' || Platform.OS === 'ios') {
    const url = `http://localhost:${DEFAULT_PORT}`;
    cachedBaseUrl = url;
    console.log(`[API] Base URL (Localhost): ${url}`);
    return url;
  }

  // 4. Android (Physical vs Emulator fallback)
  const url = `http://${LAN_FALLBACK_IP}:${DEFAULT_PORT}`;
  console.log(`[API] Base URL (Hotspot Fallback): ${url}`);
  return url;
}

export function getWebSocketBaseUrl(): string {
  const httpUrl = getApiBaseUrl();
  if (httpUrl.startsWith('https://')) {
    return httpUrl.replace('https://', 'wss://');
  }
  return httpUrl.replace('http://', 'ws://');
}

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
  },
  AUDIO: {
    UPLOAD: '/api/audio/upload',
    LIVE_WS: '/api/audio/live',
  },
  HISTORY: '/api/history',
  SPEAKER: {
    ENROLL: '/api/speaker/enroll',
    VERIFY: '/api/speaker/verify',
  },
};
