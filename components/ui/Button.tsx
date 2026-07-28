import { Pressable, StyleSheet, Text, ActivityIndicator, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Theme } from '@/constants/Theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: Props) {
  async function handlePress() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Theme.colors.black : Theme.colors.white} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'ghost' && styles.ghostLabel,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: Theme.spacing.lg,
  },
  primary: {
    backgroundColor: Theme.colors.white,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: Theme.colors.borderLight,
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    ...Theme.typography.callout,
    fontWeight: '600',
  },
  primaryLabel: {
    color: Theme.colors.black,
  },
  secondaryLabel: {
    color: Theme.colors.white,
  },
  ghostLabel: {
    color: Theme.colors.textSecondary,
  },
});
