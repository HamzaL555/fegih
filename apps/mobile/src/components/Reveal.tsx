import { type ReactNode, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';

type RevealProps = {
  children: ReactNode;
  /** Stagger in milliseconds. Leave at 0 for a single item. */
  delay?: number;
  /** Travel distance the content rises from. */
  distance?: number;
  duration?: number;
  style?: object;
};

/**
 * Fades and lifts content into place the first time it mounts.
 *
 * The animation runs on the UI thread, so a list that is still fetching does
 * not stutter when data lands. The shared value is latched: re-renders caused
 * by a refetch must not replay the entrance, otherwise the screen would keep
 * flickering every few seconds.
 *
 * With the system "reduce motion" setting on, the content simply appears.
 */
export function Reveal({ children, delay = 0, distance = 14, duration = 340, style }: RevealProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = withTiming(1, { duration: 0 });
      return;
    }
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    // `progress` is stable; re-running on every render would restart the intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, duration, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [distance, 0]) }],
  }));

  return <Animated.View style={[styles.reveal, animatedStyle, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  reveal: { width: '100%' },
});