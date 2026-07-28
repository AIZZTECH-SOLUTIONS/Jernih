import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '@/constants/Theme';
import { Button } from '@/components/ui/Button';
import { signInWithEmail, supabaseConfigured } from '@/lib/supabase';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!supabaseConfigured) {
      setError('Add Supabase credentials to .env first.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signInWithEmail(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send magic link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Sync history and cloud backups across devices.</Text>

        {sent ? (
          <View style={styles.sent}>
            <Text style={styles.sentTitle}>Check your email</Text>
            <Text style={styles.sentText}>
              Open the magic link on this device to complete sign in.
            </Text>
            <Button label="Continue" onPress={() => router.back()} />
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Theme.colors.textTertiary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Send magic link" onPress={handleSignIn} loading={loading} />
            <Pressable onPress={() => router.back()} style={styles.skip}>
              <Text style={styles.skipText}>Not now</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background,
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
  },
  inner: {
    gap: Theme.spacing.lg,
  },
  title: {
    ...Theme.typography.largeTitle,
    color: Theme.colors.white,
  },
  subtitle: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  form: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },
  input: {
    ...Theme.typography.body,
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: Theme.colors.white,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 14,
  },
  sent: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },
  sentTitle: {
    ...Theme.typography.title3,
    color: Theme.colors.white,
  },
  sentText: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  skip: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  skipText: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
  },
  error: {
    ...Theme.typography.footnote,
    color: Theme.colors.danger,
  },
});
