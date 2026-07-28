import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Card } from '@/components/ui/Card';
import { Theme } from '@/constants/Theme';
import { FORWARD_STEPS } from '@/lib/whatsapp';

type Props = {
  compact?: boolean;
};

export function ForwardGuide({ compact }: Props) {
  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <SymbolView
          name={{ ios: 'arrowshape.turn.up.forward', android: 'forward', web: 'forward' }}
          size={20}
          tintColor={Theme.colors.white}
        />
        <Text style={styles.title}>Forward method</Text>
      </View>
      <Text style={styles.subtitle}>
        {compact
          ? 'Send to a chat first, then Forward → My Status. This keeps your status sharp.'
          : 'Posting straight to Status lowers quality. The reliable way: send to a chat, then Forward to Status.'}
      </Text>
      <View style={styles.steps}>
        {FORWARD_STEPS.map((item) => (
          <View key={item.step} style={styles.step}>
            <View style={styles.number}>
              <Text style={styles.numberText}>{item.step}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Theme.spacing.md,
    padding: Theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  title: {
    ...Theme.typography.title3,
    color: Theme.colors.white,
  },
  subtitle: {
    ...Theme.typography.subhead,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  steps: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
  },
  step: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  number: {
    alignItems: 'center',
    borderColor: Theme.colors.borderLight,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  numberText: {
    ...Theme.typography.footnote,
    color: Theme.colors.white,
    fontWeight: '600',
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    ...Theme.typography.callout,
    color: Theme.colors.white,
    fontWeight: '600',
  },
  stepDetail: {
    ...Theme.typography.footnote,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
  },
});
