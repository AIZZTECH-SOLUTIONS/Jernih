export const Theme = {
  colors: {
    black: '#FFFFFF',
    white: '#000000',
    background: '#FFFFFF',
    surface: '#F9F9F9',
    surfaceElevated: '#FFFFFF',
    border: '#E5E5EA',
    borderLight: '#F2F2F7',
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    muted: '#E5E5E5',
    danger: '#FF3B30',
    success: '#000000',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
  },
  typography: {
    largeTitle: {
      fontSize: 34,
      fontWeight: '700' as const,
      letterSpacing: 0.37,
      lineHeight: 41,
    },
    title1: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: 0.36,
      lineHeight: 34,
    },
    title2: {
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: 0.35,
      lineHeight: 28,
    },
    title3: {
      fontSize: 20,
      fontWeight: '600' as const,
      letterSpacing: 0.38,
      lineHeight: 25,
    },
    body: {
      fontSize: 17,
      fontWeight: '400' as const,
      letterSpacing: -0.41,
      lineHeight: 22,
    },
    callout: {
      fontSize: 16,
      fontWeight: '400' as const,
      letterSpacing: -0.32,
      lineHeight: 21,
    },
    subhead: {
      fontSize: 15,
      fontWeight: '400' as const,
      letterSpacing: -0.24,
      lineHeight: 20,
    },
    footnote: {
      fontSize: 13,
      fontWeight: '400' as const,
      letterSpacing: -0.08,
      lineHeight: 18,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      letterSpacing: 0.5,
      lineHeight: 16,
    },
  },
} as const;

export type FlowStep = 'pick' | 'review' | 'optimize' | 'share' | 'forward' | 'done';

export const FLOW_STEPS: { key: FlowStep; label: string }[] = [
  { key: 'pick', label: 'Select' },
  { key: 'review', label: 'Review' },
  { key: 'optimize', label: 'Optimize' },
  { key: 'share', label: 'Chat' },
  { key: 'forward', label: 'Status' },
];
