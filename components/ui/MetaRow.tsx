import { StyleSheet, Text, View } from 'react-native';

import { Theme } from '@/constants/Theme';

type Props = {
  label: string;
  value: string;
  highlight?: boolean;
};

export function MetaRow({ label, value, highlight }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && styles.highlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.sm,
  },
  label: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
  },
  value: {
    ...Theme.typography.subhead,
    color: Theme.colors.white,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  highlight: {
    color: Theme.colors.white,
    fontWeight: '600',
  },
});
