import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '@/constants/Theme';

type Props = ScrollViewProps & {
  padded?: boolean;
};

export function Screen({ children, style, contentContainerStyle, padded = true, ...props }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.screen, style]}
      contentContainerStyle={[
        padded && {
          paddingHorizontal: Theme.spacing.lg,
          paddingTop: insets.top + Theme.spacing.sm,
          paddingBottom: insets.bottom + Theme.spacing.xl,
        },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      {...props}>
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({ children }: { children: React.ReactNode }) {
  return <View style={styles.header}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Theme.colors.background,
    flex: 1,
  },
  header: {
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
});
