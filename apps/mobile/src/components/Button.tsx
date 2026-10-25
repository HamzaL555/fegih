import { useEffect } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/providers/ThemeProvider';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's primary action.
 *
 * Pressing gives physical feedback: the button dips slightly and springs back
 * on release, driven on the UI thread so the response is immediate even while
 * a request is in flight. The previous version only dimmed, which on a large
 * filled button was easy to miss.
 */
export function Button({ label, variant = 'primary', loading = false, disabled, style, onPressIn, onPressOut, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const isDisabled = disabled || loading;

  const press = useSharedValue(0);

  // Reset when the button becomes disabled mid-press, otherwise it would stay
  // dimmed for good.
  useEffect(() => {
    if (isDisabled) press.value = withTiming(0, { duration: 120 });
  }, [isDisabled, press]);

  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.surfaceElevated
          : 'transparent';
  const textColor = variant === 'primary' || variant === 'danger' ? colors.primaryContrast : colors.primary;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.96]) }],
    opacity: interpolate(press.value, [0, 1], [1, 0.9]),
  }));

  const handlePressIn = (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
    if (!isDisabled && !reduced) {
      press.value = withSpring(1, { damping: 18, stiffness: 400, mass: 0.4 });
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
    if (!reduced) {
      press.value = withSpring(0, { damping: 14, stiffness: 260, mass: 0.5 });
    }
    onPressOut?.(event);
  };

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!isDisabled, busy: loading }}
        disabled={isDisabled}
        {...props}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          { backgroundColor, borderColor: variant === 'ghost' ? colors.border : backgroundColor },
          pressed && !isDisabled ? styles.pressed : undefined,
          isDisabled ? styles.disabled : undefined,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <AppText variant="label" color={textColor}>
            {label}
          </AppText>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /**
   * No explicit width: in a column the wrapper stretches (so form buttons stay
   * full width) while in a row it shrinks to the label. Pinning it to 100%
   * made every button in a row claim the full width and overlap its siblings.
   */
  wrapper: {},
  base: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});