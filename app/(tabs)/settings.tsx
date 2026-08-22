import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '@/constants/Theme';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { getWhatsAppPhone, signOut, updateWhatsAppPhone } from '@/lib/supabase';
import type { Codec, VideoPreset } from '@/lib/settings';

const PRESETS: { id: VideoPreset; label: string; detail: string }[] = [
  { id: 'status', label: 'Best for Status', detail: 'Recommended for sharing' },
  { id: 'hd', label: 'Higher quality', detail: 'Sharper, larger file' },
];

const CODECS: { id: Codec; label: string; detail: string }[] = [
  { id: 'h264', label: 'H.264', detail: 'Required for WhatsApp delivery' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    videoPreset,
    codec,
    cloudBackup,
    autoWhatsAppDelivery,
    setVideoPreset,
    setCodec,
    setCloudBackup,
    setAutoWhatsAppDelivery,
  } = useSettings();
  const [whatsappPhone, setWhatsAppPhone] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setWhatsAppPhone('');
      return;
    }
    getWhatsAppPhone(user.id)
      .then(setWhatsAppPhone)
      .catch(() => {});
  }, [user]);

  async function handleSaveWhatsApp() {
    if (!user) {
      router.push('/(auth)/sign-in');
      return;
    }
    setPhoneLoading(true);
    try {
      const normalized = await updateWhatsAppPhone(user.id, whatsappPhone);
      setWhatsAppPhone(normalized);
      Alert.alert('Saved', 'Jernih will send processed media to this WhatsApp number.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not sign out.');
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Theme.spacing.sm, paddingBottom: insets.bottom + 32 },
      ]}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.section}>Quality</Text>
      <View style={styles.card}>
        {PRESETS.map((preset, i) => (
          <Pressable
            key={preset.id}
            style={[styles.row, i < PRESETS.length - 1 && styles.rowBorder]}
            onPress={() => setVideoPreset(preset.id)}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{preset.label}</Text>
              <Text style={styles.rowDetail}>{preset.detail}</Text>
            </View>
            {videoPreset === preset.id && <View style={styles.check} />}
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Format</Text>
      <View style={styles.card}>
        {CODECS.map((item, i) => (
          <Pressable
            key={item.id}
            style={[styles.row, i < CODECS.length - 1 && styles.rowBorder]}
            onPress={() => setCodec(item.id)}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowDetail}>{item.detail}</Text>
            </View>
            {codec === item.id && <View style={styles.check} />}
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Cloud</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Backup</Text>
            <Text style={styles.rowDetail}>Store optimized files when signed in</Text>
          </View>
          <Switch
            value={cloudBackup}
            onValueChange={setCloudBackup}
            trackColor={{ false: Theme.colors.muted, true: Theme.colors.white }}
            thumbColor={Theme.colors.black}
          />
        </View>
      </View>

      <Text style={styles.section}>WhatsApp delivery</Text>
      <View style={styles.card}>
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Send automatically</Text>
            <Text style={styles.rowDetail}>Receive processed media from Jernih on WhatsApp</Text>
          </View>
          <Switch
            value={autoWhatsAppDelivery}
            onValueChange={(enabled) => {
              if (!user && enabled) {
                router.push('/(auth)/sign-in');
                return;
              }
              setAutoWhatsAppDelivery(enabled);
            }}
            trackColor={{ false: Theme.colors.muted, true: Theme.colors.white }}
            thumbColor={Theme.colors.black}
          />
        </View>
        <View style={styles.phoneForm}>
          <TextInput
            style={styles.input}
            placeholder="e.g. 60123456789"
            placeholderTextColor={Theme.colors.textTertiary}
            autoComplete="tel"
            keyboardType="phone-pad"
            value={whatsappPhone}
            onChangeText={setWhatsAppPhone}
            editable={Boolean(user)}
          />
          <Text style={styles.phoneHint}>
            Include the country code without “+”. Automatic delivery requires sign-in.
          </Text>
          <Button
            label={user ? 'Save WhatsApp number' : 'Sign in to configure'}
            variant="secondary"
            onPress={handleSaveWhatsApp}
            loading={phoneLoading}
          />
        </View>
      </View>

      <Text style={styles.section}>Account</Text>
      <View style={styles.card}>
        {user ? (
          <>
            <Text style={styles.email}>{user.email}</Text>
            <Pressable style={styles.signOut} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.row} onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background,
    flex: 1,
  },
  content: {
    gap: Theme.spacing.sm,
    padding: Theme.spacing.lg,
  },
  title: {
    ...Theme.typography.largeTitle,
    color: Theme.colors.white,
    marginBottom: Theme.spacing.md,
  },
  section: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    letterSpacing: 1.2,
    marginTop: Theme.spacing.md,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Theme.spacing.md,
  },
  rowBorder: {
    borderBottomColor: Theme.colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...Theme.typography.body,
    color: Theme.colors.white,
  },
  rowDetail: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
  },
  phoneForm: {
    gap: Theme.spacing.sm,
    padding: Theme.spacing.md,
  },
  input: {
    ...Theme.typography.body,
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: Theme.colors.white,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
  },
  phoneHint: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
  },
  check: {
    backgroundColor: Theme.colors.white,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  email: {
    ...Theme.typography.body,
    color: Theme.colors.white,
    padding: Theme.spacing.md,
  },
  signOut: {
    borderTopColor: Theme.colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Theme.spacing.md,
  },
  signOutText: {
    ...Theme.typography.body,
    color: Theme.colors.danger,
    textAlign: 'center',
  },
  signInText: {
    ...Theme.typography.body,
    color: Theme.colors.white,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
});
