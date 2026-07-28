import { StyleSheet, Text, View } from 'react-native';

import { Theme, type FlowStep } from '@/constants/Theme';

type Props = {
  current: FlowStep;
};

const ORDER: FlowStep[] = ['pick', 'review', 'optimize', 'share', 'forward'];

export function StepIndicator({ current }: Props) {
  const currentIndex = ORDER.indexOf(current);

  return (
    <View style={styles.container}>
      {ORDER.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <View key={step} style={styles.step}>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
              ]}
            />
            {index < ORDER.length - 1 && (
              <View style={[styles.line, done && styles.lineDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export function StepLabel({ current }: Props) {
  const labels: Record<FlowStep, string> = {
    pick: 'Select media',
    review: 'Review',
    optimize: 'Optimizing',
    share: 'Send to chat',
    forward: 'Forward to Status',
    done: 'Complete',
  };

  return <Text style={styles.label}>{labels[current]}</Text>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
  },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dot: {
    backgroundColor: Theme.colors.muted,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotDone: {
    backgroundColor: Theme.colors.white,
  },
  dotActive: {
    backgroundColor: Theme.colors.white,
    height: 10,
    width: 10,
  },
  line: {
    backgroundColor: Theme.colors.muted,
    height: 1,
    marginHorizontal: 6,
    width: 24,
  },
  lineDone: {
    backgroundColor: Theme.colors.borderLight,
  },
  label: {
    ...Theme.typography.caption,
    color: Theme.colors.textSecondary,
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
