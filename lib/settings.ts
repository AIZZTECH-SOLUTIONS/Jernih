import AsyncStorage from '@react-native-async-storage/async-storage';

export type VideoPreset = 'status' | 'hd';
export type Codec = 'h264' | 'hevc';

export type AppSettings = {
  videoPreset: VideoPreset;
  codec: Codec;
  cloudBackup: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  videoPreset: 'status',
  codec: 'h264',
  cloudBackup: true,
};

const SETTINGS_KEY = 'wsk_settings';

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
