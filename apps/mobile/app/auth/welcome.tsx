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
  const { colors } = useTheme();
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
    transform: [{ scale: interpolate(scale.value, [0, 1], [0.9, 1]) }],
  }));

  const goMain = () => {
    dismissWelcome();
  };

  return (
    <AppScreen subtitle="" backdrop={false}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Background Islamic ornamental pattern. */}
        <View style={styles.bgPattern}>
          <Svg width={220} height={220} style={styles.ornament}>
            <Circle cx={110} cy={110} r={100} fill="none" stroke={colors.secondary} strokeWidth={1} strokeOpacity={0.15} />
            <Circle cx={110} cy={110} r={60} fill="none" stroke={colors.accent} strokeWidth={1} strokeOpacity={0.12} />
            <Polygon points="110,40 125,70 155,70 135,90 145,120 110,100 75,120 85,90 65,70 95,70" fill={colors.primary} opacity={0.1} />
          </Svg>
        </View>

        <View style={styles.content}>
          {/* Crescent + star ornament. */}
          <View style={styles.crescentWrapper}>
            <Svg width={64} height={64} viewBox="0 0 24 24">
              <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-4 4h8l-4-4zm-1-7h8v-2h-8zm11-1h-2v-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2h-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2-2h-2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2v-2a2 2 0 0 0-2-2z" fill={colors.secondary} />
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
  },
  ornament: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  crescentWrapper: {
    marginBottom: 8,
  },
  headerText: {
    alignItems: 'center',
  },
  arabicText: {
    fontSize: 42,
    textAlign: 'center',
    lineHeight: 56,
    marginBottom: 6,
    fontWeight: '700',
  },
  latinText: {
    fontSize: 26,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitleWrapper: {
    marginBottom: 16,
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
  },
});
