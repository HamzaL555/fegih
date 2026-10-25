import { PropsWithChildren } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/providers/ThemeProvider';

export function Card({ children, style, onPress }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; onPress?: () => void }>) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const press = useSharedValue(0);

  // A tappable card lifts a little and settles back, which reads as "this is
  // a link" before the user has to press it.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(press.value, [0, 1], [1, 0.98]) },
      { translateY: interpolate(press.value, [0, 1], [0, -1]) },
    ],
  }));

  const content = (
    <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, animatedStyle, style]}>
      {children}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      onPressIn={() => { if (!reduced) press.value = withSpring(1, { damping: 20, stiffness: 340, mass: 0.5 }); }}
      onPressOut={() => { if (!reduced) press.value = withSpring(0, { damping: 15, stiffness: 230, mass: 0.6 }); }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
});