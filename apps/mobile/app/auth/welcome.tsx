import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SparkIcon } from '@/components/icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { dismissWelcome } = useAuthStore();
  const user = useAuthStore((state) => state.user);

  const name = useMemo(() => user?.displayName || user?.username || t('profile.guest'), [user, t]);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  // Entrance animation: fade in and scale slightly up.
  useEffect(() => {
    opacity.value = withDelay(100, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    scale.value = withDelay(100, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, []);

  // Auto-advance after 3.5 seconds.
  useEffect(() => {
    const timer = setTimeout(() => dismissWelcome(), 3500);
    return () => clearTimeout(timer);
  }, [dismissWelcome]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(scale.value, [0, 1], [0.95, 1]) }],
  }));

  const goMain = () => {
    dismissWelcome();
  };

  return (
    <AppScreen subtitle="" backdrop={false}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Premium Islamic ornamental background pattern. */}
        <View style={styles.bgPattern}>
          {/* Gold accent shapes with subtle opacity. */}
          <Svg width={300} height={300} style={styles.backgroundOrnament}>
            {/* Central geometric pattern */}
            <Polygon
              points="150,20 180,140 280,140 250,20 210,70 240,100 220,80 150,100 80,70 110,100 70,70"
              fill={colors.primary}
              opacity={0.15}
            />
            <Polygon
              points="150,220 120,300 30,300 60,270 150,220"
              fill={colors.secondary}
              opacity={0.1}
            />
            {/* Moon and star motif */}
            <Circle cx={150} cy={150} r={80} fill="none" stroke={colors.accent} strokeWidth={2} strokeOpacity={0.4} />
            <Circle cx={150} cy={150} r={35} fill={colors.accent} opacity={0.3} />
            {/* Decorative stars */}
            <Polygon
              points={[
                220, 150, 250, 170, 240, 190, 270, 170, 260, 140,
              ] as any}
              fill={colors.accent}
              opacity={0.4}
            />
            <Polygon
              points={[
                80, 150, 50, 170, 60, 200, 40, 170, 50, 140,
              ] as any}
              fill={colors.accent}
              opacity={0.4}
            />
          </Svg>

          {/* Subtle pattern dots */}
          <Svg
            width={300}
            height={300}
            style={styles.patternOverlay}
            opacity={0.07}
          >
            <Circle cx={150} cy={50} r={2} fill={colors.primary} opacity={0.5} />
            <Circle cx={50} cy={150} r={2} fill={colors.secondary} opacity={0.5} />
            <Circle cx={250} cy={250} r={2} fill={colors.accent} opacity={0.5} />
          </Svg>
        </View>

        <View style={styles.content}>
          {/* Crescent and star ornament. */}
          <View style={styles.crescentWrapper}>
            <Svg width={64} height={64} viewBox="0 0 24 24">
              <Path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-4 4h8l-4-4zm-1-7h8v-2h-8zm11-1h-2v-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2h-2a2 2 0 0 0-2 2h-2v8a2 2 0 0 0 2-2h-2v-2a2 2 0 0 0-2-2z"
                fill={colors.secondary}
              />
            </Svg>
          </View>

          <View style={styles.headerText}>
            <AppText
              variant="display"
              style={[
                styles.arabicText,
                { color: colors.primary },
                { textDirection: 'rtl' } as any,
              ]}
            >
              {t('welcomeScreen.arabic')}
            </AppText>
            <AppText variant="title" style={[styles.latinText, { color: colors.text }]}>
              {t('welcomeScreen.assalamuAleykum')}
            </AppText>
          </View>

          <View style={styles.subtitleWrapper}>
            <AppText variant="caption" style={[styles.subtitleText, { color: colors.textMuted }]}>
              {t('welcomeScreen.subtitle')}
            </AppText>
          </View>

          <View style={styles.greetingWrapper}>
            <AppText variant="subtitle" style={[styles.greetingText, { color: colors.primary }]}>
              {t('welcomeScreen.greeting', { name })}
            </AppText>
          </View>

          <View style={styles.buttonWrapper}>
            <Button
              label={t('welcomeScreen.continue')}
              variant="primary"
              onPress={goMain}
              style={styles.continueButton}
            />
          </View>
        </View>
      </Animated.View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  bgPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 40,
  },
  backgroundOrnament: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  patternOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  ornament: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    padding: 32,
  },
  crescentWrapper: {
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  headerText: {
    alignItems: 'center',
    marginBottom: 16,
  },
  arabicText: {
    fontSize: 42,
    textAlign: 'center',
    lineHeight: 56,
    marginBottom: 6,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  latinText: {
    fontSize: 26,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 24,
  },
  subtitleWrapper: {
    marginBottom: 32,
  },
  subtitleText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  greetingWrapper: {
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  buttonWrapper: {
    width: '100%',
  },
  continueButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 28,
    elevation: 4,
  },
});