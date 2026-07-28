import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/Theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: Theme.spacing.lg,
  },
  title: {
    ...Theme.typography.title3,
    color: Theme.colors.white,
  },
  link: {
    marginTop: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  linkText: {
    ...Theme.typography.body,
    color: Theme.colors.textSecondary,
  },
});
