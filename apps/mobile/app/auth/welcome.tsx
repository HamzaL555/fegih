import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { AnimatedBackdrop } from '@/components/AnimatedBackdrop';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

/**
 * Premium welcome screen for Fəqih.
 *
 * Design:
 *   - Emerald green / white / subtle gold palette from the theme.
 *   - Animated Islamic geometric backdrop (lattice + drifting washes).
 *   - Staggered entrance animations on the UI thread.
 *   - Gold progress bar that auto-completes in ~3.5 s.
 *
 * Behaviour:
 *   - Waits for the auth state to resolve before starting the timer.
 *   - Auto-navigates to /(tabs) when authenticated, /auth/login otherwise.
 *   - Timer is cleaned up on unmount; navigation is guarded against duplicates.
 */
export default function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, status, dismissWelcome } = useAuthStore();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isRTL = i18n.language === 'ar';
  const languageDir = isRTL ? 'rtl' : 'ltr';

  const name = useMemo(
    () => user?.displayName || user?.username || null,
    [user],
  );
  const hasName = !!name;

  const greeting = useMemo(
    () =>
      hasName
        ? t('auth.welcomeScreen.assalamuAleykum', { name })
        : t('auth.welcomeScreen.greetingGuest'),
    [t, name, hasName],
  );

  const navigated = useRef(false);

  // --- Animations -------------------------------------------------------
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);
  const scale = useSharedValue(0.9);
  const progress = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(100, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(100, withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) }));
    scale.value = withDelay(100, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, []);

  // Gold progress bar: 0 -> 100 % over ~3.5 s on the UI thread.
  useEffect(() => {
    progress.value = withTiming(1, { duration: 3500, easing: Easing.linear });
  }, []);

  // --- Auto navigation --------------------------------------------------
  const goToDestination = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    dismissWelcome();
    const destination =
      status === 'authenticated' ? '/(tabs)' : '/auth/login';
    void router.replace(destination as never);
  }, [status, dismissWelcome, router]);

  // Wait for auth to resolve before starting the timer.
  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;
    const timer = setTimeout(goToDestination, 3500);
    return () => clearTimeout(timer);
  }, [status, goToDestination]);

  // Clean up if the user leaves before the timer fires.
  useEffect(() => {
    return () => {
      navigated.current = true;
    };
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: interpolate(translateY.value, [40, 0], [40, 0]) },
      { scale: interpolate(scale.value, [0.9, 1], [0.9, 1]) },
    ],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
    backgroundColor: colors.secondary,
  }));

  return (
    <SafeAreaView style={[styles.safe, { direction: languageDir }]}>
      {/* Premium animated Islamic backdrop (lattice + drifting emerald/gold washes). */}
      <AnimatedBackdrop enabled />

      <Animated.View style={[styles.root, containerStyle]}>
        {/* Brand medallion: crescent & star with the Fəqih wordmark. */}
        <View style={styles.medallionWrap}>
          <Svg width={110} height={110} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={9} fill="none" stroke={colors.secondary} strokeWidth={2.5} strokeOpacity={0.55} />
            <Path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-4 4h8l-4-4zm-1-7h8v-2h-8zm11-1h-2v-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2h-2a2 2 0 0 0-2 2h-2v8a2 2 0 0 0 2-2h-2v-2a2 2 0 0 0-2-2z"
              fill={colors.secondary}
            />
          </Svg>
          <Text style={[styles.wordmark, { color: colors.primary }]}>
            Fəqih
          </Text>
        </View>

        <View style={styles.content}>
          {/* Arabic invocation (RTL handled by the SafeAreaView direction). */}
          <Text style={[styles.arabic, { color: colors.primary }]}>
            {t('auth.welcomeScreen.arabic')}
          </Text>

          {/* Main greeting: "Salam Aleykum, Hamza!" (or guest fallback). */}
          <Text style={[styles.greeting, { color: colors.text }]}>
            {greeting}
          </Text>

          {/* Welcome subtitle. */}
          <Text style={styles.subtitle}>
            {t('auth.welcomeScreen.subtitle')}
          </Text>

          {/* Auto-continue progress bar (gold). */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  medallionWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  wordmark: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
  },
  arabic: {
    fontSize: 34,
    lineHeight: 46,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    color: 'inherit',
    opacity: 0.7,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    marginTop: 30,
    borderRadius: 2,
    backgroundColor: 'rgba(15,118,110,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
});
