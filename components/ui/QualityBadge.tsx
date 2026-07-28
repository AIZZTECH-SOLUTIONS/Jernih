import { StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/Theme';

type Props = {
  score: number;
  label: string;
};

export function QualityBadge({ score, label }: Props) {
  const ringColor =
    score >= 85
      ? Theme.colors.white
      : score >= 65
        ? Theme.colors.textSecondary
        : Theme.colors.textTertiary;

  return (
    <View style={styles.container}>
      <View style={[styles.ring, { borderColor: ringColor }]}>
        <Text style={styles.score}>{score}</Text>
      </View>
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>WhatsApp safety</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  ring: {
    alignItems: 'center',
    borderRadius: Theme.radius.full,
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  score: {
    ...Theme.typography.title3,
    color: Theme.colors.white,
  },
  label: {
    ...Theme.typography.callout,
    color: Theme.colors.white,
    fontWeight: '600',
  },
  sub: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
  },
});
