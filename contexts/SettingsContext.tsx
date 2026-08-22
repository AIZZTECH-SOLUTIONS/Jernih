import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AppSettings,
  type Codec,
  type VideoPreset,
} from '@/lib/settings';

type SettingsContextValue = AppSettings & {
  loading: boolean;
  setVideoPreset: (preset: VideoPreset) => Promise<void>;
  setCodec: (codec: Codec) => Promise<void>;
  setCloudBackup: (enabled: boolean) => Promise<void>;
  setAutoWhatsAppDelivery: (enabled: boolean) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  ...DEFAULT_SETTINGS,
  loading: true,
  setVideoPreset: async () => {},
  setCodec: async () => {},
  setCloudBackup: async () => {},
  setAutoWhatsAppDelivery: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (updater: (current: AppSettings) => AppSettings) => {
    setSettings((current) => {
      const next = updater(current);
      void saveSettings(next);
      return next;
    });
  }, []);

  const setVideoPreset = useCallback(
    async (videoPreset: VideoPreset) => persist((current) => ({ ...current, videoPreset })),
    [persist],
  );

  const setCodec = useCallback(
    async (codec: Codec) => persist((current) => ({ ...current, codec })),
    [persist],
  );

  const setCloudBackup = useCallback(
    async (cloudBackup: boolean) => persist((current) => ({ ...current, cloudBackup })),
    [persist],
  );

  const setAutoWhatsAppDelivery = useCallback(
    async (autoWhatsAppDelivery: boolean) =>
      persist((current) => ({ ...current, autoWhatsAppDelivery })),
    [persist],
  );

  const value = useMemo(
    () => ({
      ...settings,
      loading,
      setVideoPreset,
      setCodec,
      setCloudBackup,
      setAutoWhatsAppDelivery,
    }),
    [
      settings,
      loading,
      setVideoPreset,
      setCodec,
      setCloudBackup,
      setAutoWhatsAppDelivery,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
