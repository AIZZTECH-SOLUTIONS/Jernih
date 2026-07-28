import { StyleSheet, View, type ViewProps } from 'react-native';

import { Theme } from '@/constants/Theme';

type Props = ViewProps & {
  elevated?: boolean;
};

export function Card({ style, elevated, children, ...props }: Props) {
  return (
    <View
      style={[styles.card, elevated && styles.elevated, style]}
      {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.surface,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: Theme.colors.surfaceElevated,
  },
});
