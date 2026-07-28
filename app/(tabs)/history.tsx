import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { formatBytes, formatReduction } from '@/lib/format';
import { fetchJobs, getSignedUrl, type JobRecord } from '@/lib/supabase';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setJobs([]);
      setLoading(false);
      return;
    }

    try {
      const data = await fetchJobs(user.id);
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpen(job: JobRecord) {
    if (!job.output_path) return;
    try {
      const url = await getSignedUrl(job.output_path);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open file.');
    }
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in required</Text>
        <Text style={styles.emptyText}>History is available when signed in with cloud backup.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Theme.colors.white} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text style={styles.title}>History</Text>}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={Theme.colors.white}
          />
        }
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + Theme.spacing.sm, paddingBottom: insets.bottom + 24 },
          jobs.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No history</Text>
            <Text style={styles.emptyText}>Optimized files with backup enabled appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => handleOpen(item)}
            disabled={!item.output_path}>
            <View style={styles.cardTop}>
              <Text style={styles.type}>{item.media_type}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.meta}>
              {formatBytes(item.original_bytes)} → {formatBytes(item.output_bytes)}
            </Text>
            <Text style={styles.preset}>
              {formatReduction(item.original_bytes, item.output_bytes)}
            </Text>
          </Pressable>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background,
    flex: 1,
  },
  list: {
    gap: Theme.spacing.sm,
    padding: Theme.spacing.lg,
  },
  emptyList: {
    flexGrow: 1,
  },
  title: {
    ...Theme.typography.largeTitle,
    color: Theme.colors.white,
    marginBottom: Theme.spacing.lg,
  },
  center: {
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    flex: 1,
    gap: Theme.spacing.sm,
    justifyContent: 'center',
    padding: Theme.spacing.lg,
  },
  emptyTitle: {
    ...Theme.typography.title3,
    color: Theme.colors.white,
    textAlign: 'center',
  },
  emptyText: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    marginBottom: Theme.spacing.sm,
    padding: Theme.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  type: {
    ...Theme.typography.caption,
    color: Theme.colors.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  date: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
  },
  meta: {
    ...Theme.typography.body,
    color: Theme.colors.white,
    fontWeight: '500',
  },
  preset: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
  },
  error: {
    ...Theme.typography.footnote,
    color: Theme.colors.danger,
    padding: Theme.spacing.md,
    textAlign: 'center',
  },
});
