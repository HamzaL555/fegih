import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/providers/ThemeProvider';

export function ListRow({
  children,
  onPress,
  right,
  style,
}: PropsWithChildren<{ onPress?: () => void; right?: ReactNode; style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const press = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.985]) }],
    backgroundColor: press.value > 0 ? colors.surfaceElevated : 'transparent',
  }));

  const content = (
    <Animated.View style={[styles.row, { borderBottomColor: colors.border }, animatedStyle, style]}>
      <View style={styles.content}>{children}</View>
      {right}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      onPressIn={() => { if (!reduced) press.value = withSpring(1, { damping: 20, stiffness: 320, mass: 0.5 }); }}
      onPressOut={() => { if (!reduced) press.value = withSpring(0, { damping: 16, stiffness: 240, mass: 0.6 }); }}
    >
      {content}
    </Pressable>
  );
}

export function RowTitle({ children }: PropsWithChildren) {
  return <AppText variant="subtitle">{children}</AppText>;
}

export function RowDescription({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return <AppText variant="caption" color={colors.textMuted}>{children}</AppText>;
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  content: { flex: 1, gap: 3 },
});