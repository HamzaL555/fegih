import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AppColors } from '@/theme/colors';
import { useTheme } from '@/providers/ThemeProvider';

type Wash = {
  /** Diameter as a fraction of the screen width. Deliberately oversized. */
  size: number;
  /** Anchor point as a fraction of the viewport. */
  left: number;
  top: number;
  color: 'primary' | 'secondary' | 'accent';
  /** Seconds for one full drift cycle. */
  period: number;
  dx: number;
  dy: number;
  delay: number;
  /** Peak opacity. Above ~0.10 it stops reading as atmosphere and starts
   * reading as a coloured shape behind the content. */
  strength: number;
};

/**
 * Three slow washes anchored to different corners.
 *
 * Earlier passes used fewer and these read as a flat background; the corner
 * placement plus a longer ramp gives the page depth without any visible edge.
 */
const WASHES: Wash[] = [
  { size: 1.7, left: -0.66, top: -0.58, color: 'primary', period: 26, dx: 36, dy: 32, delay: 0, strength: 0.1 },
  { size: 1.35, left: 0.56, top: 0.24, color: 'secondary', period: 32, dx: -30, dy: 40, delay: 2.4, strength: 0.07 },
  { size: 1.5, left: -0.18, top: 0.58, color: 'accent', period: 29, dx: 28, dy: -36, delay: 4.8, strength: 0.06 },
];

type Viewport = { width: number; height: number };

function DriftWash({ wash, viewport, colors, reduced }: { wash: Wash; viewport: Viewport; colors: AppColors; reduced: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 0;
      return;
    }
    // A ping-pong rather than a plain loop: the wash eases out and back instead
    // of snapping to its origin when the repeat wraps.
    progress.value = withDelay(
      wash.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: wash.period * 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: wash.period * 500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [wash.delay, wash.period, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * wash.dx }, { translateY: progress.value * wash.dy }],
  }));

  const diameter = wash.size * viewport.width;
  const gradientId = `wash-${wash.color}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wash,
        { width: diameter, height: diameter, left: wash.left * viewport.width, top: wash.top * viewport.height },
        style,
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors[wash.color]} stopOpacity={wash.strength} />
            <Stop offset="38%" stopColor={colors[wash.color]} stopOpacity={wash.strength * 0.46} />
            <Stop offset="72%" stopColor={colors[wash.color]} stopOpacity={wash.strength * 0.15} />
            <Stop offset="100%" stopColor={colors[wash.color]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The eight-pointed star lattice.
 *
 * Two squares, one rotated 45 degrees, repeated on a grid — the classic
 * "khatam" motif used across Islamic geometric art. It gives the background an
 * identity tied to the subject matter without importing an image asset.
 *
 * The grid is proportional: a fixed number of columns for the viewport, so the
 * tile grows with the screen. That keeps the number of drawn tiles bounded
 * (around a hundred) instead of scaling with the pixel count — a single path
 * with a thousand subpaths is slow to render and, on the native side, risks
 * being dropped altogether, which is how the decoration disappeared.
 *
 * Everything is one `<Path>` holding every tile as a subpath, so the browser
 * and the native renderer draw exactly the same picture.
 */
function Lattice({ colors, reduced }: { colors: AppColors; reduced: boolean }) {
  const { width, height } = useWindowDimensions();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 20_000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 20_000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [drift, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.value * 12 - 6 }, { translateY: drift.value * 9 - 4.5 }],
  }));

  // Column count by viewport: the motif keeps the same character everywhere,
  // just at the scale that suits the screen.
  const columns = width >= 1280 ? 14 : width >= 1024 ? 12 : width >= 680 ? 9 : 6;
  const tile = width / columns;
  const half = tile / 2;
  // The star is drawn with its points reaching the tile edge, leaving a small
  // gap so neighbouring stars do not merge into a solid field.
  const inset = half * 0.74;
  const diagonal = inset * 1.414;

  const rows = Math.ceil(height / tile) + 2;
  const parts: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cx = column * tile + half;
      const cy = row * tile + half;
      parts.push(
        `M${cx - inset} ${cy - inset}H${cx + inset}V${cy + inset}H${cx - inset}Z`,
        `M${cx} ${cy - diagonal}L${cx + diagonal} ${cy}L${cx} ${cy + diagonal}L${cx - diagonal} ${cy}Z`,
      );
    }
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.lattice, style]}>
      <Svg width={width} height={height} pointerEvents="none">
        <Path d={parts.join(' ')} fill="none" stroke={colors.primary} strokeWidth={1.1} strokeOpacity={0.12} />
      </Svg>
    </Animated.View>
  );
}

export type AnimatedBackdropProps = {
  /** Ambient motion is distracting on data-heavy screens; pass false there. */
  enabled?: boolean;
};

/**
 * Ambient motion behind a screen.
 *
 * Purely decorative and non-interactive, so it is mounted behind the scroll view
 * in the screen shell. Every animation runs on the UI thread — driving this from
 * React state would re-render the whole screen sixty times a second.
 */
export function AnimatedBackdrop({ enabled = true }: AnimatedBackdropProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  if (!enabled) return null;

  const viewport = { width, height };

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {WASHES.map((wash) => (
        <DriftWash key={wash.color} wash={wash} viewport={viewport} colors={colors} reduced={reduced} />
      ))}
      <Lattice colors={colors} reduced={reduced} />
      {/* Keeps the header row legible wherever a wash happens to have drifted. */}
      <Svg pointerEvents="none" style={styles.scrim} width="100%" height={120}>
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0.8} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={120} fill="url(#scrim)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute' },
  lattice: { position: 'absolute', top: 0, left: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});