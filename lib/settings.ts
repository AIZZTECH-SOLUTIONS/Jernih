import AsyncStorage from '@react-native-async-storage/async-storage';

export type VideoPreset = 'status' | 'hd';
export type Codec = 'h264';

export type AppSettings = {
  videoPreset: VideoPreset;
  codec: Codec;
  cloudBackup: boolean;
  autoWhatsAppDelivery: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  videoPreset: 'status',
  codec: 'h264',
  cloudBackup: true,
  autoWhatsAppDelivery: false,
};

const SETTINGS_KEY = 'wsk_settings';

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const stored = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      codec: 'h264',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
