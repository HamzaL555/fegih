import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { RemoteState } from '@/components/RemoteState';
import { Reveal } from '@/components/Reveal';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/Button';
import {
  BookIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  CompassIcon,
  GiftIcon,
  MosqueIcon,
  NotificationIcon,
  SettingsIcon,
  TasbeehIcon,
  TrophyIcon,
} from '@/components/icons';
import { islamicApi, usersApi } from '@/api';
import { changeLocale, supportedLocales } from '@/i18n';
import { useAppLocale } from '@/hooks/useAppLocale';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useResponsive } from '@/hooks/useResponsive';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import type { AppLocale, ThemeMode } from '@/types/domain';

type QuickPath =
  | '/quran'
  | '/islamic-info'
  | '/calendar'
  | '/prayer'
  | '/qibla'
  | '/tasbeeh'
  | '/missions'
  | '/rewards'
  | '/messages'
  | '/contacts'
  | '/settings';

const QUICK_LINKS: Array<{
  path: QuickPath;
  labelKey: string;
  Icon: (props: { color: string; size?: number }) => React.JSX.Element;
}> = [
  { path: '/quran', labelKey: 'home.quran', Icon: BookIcon },
  { path: '/islamic-info', labelKey: 'home.islamicInfo', Icon: MosqueIcon },
  { path: '/calendar', labelKey: 'home.calendar', Icon: CalendarIcon },
  { path: '/prayer', labelKey: 'home.prayer', Icon: ClockIcon },
  { path: '/qibla', labelKey: 'home.qibla', Icon: CompassIcon },
  { path: '/tasbeeh', labelKey: 'home.tasbeeh', Icon: TasbeehIcon },
  { path: '/missions', labelKey: 'home.missions', Icon: TrophyIcon },
  { path: '/rewards', labelKey: 'home.rewards', Icon: GiftIcon },
  { path: '/messages', labelKey: 'messages.title', Icon: ChatIcon },
  { path: '/contacts', labelKey: 'contacts.title', Icon: NotificationIcon },
  { path: '/settings', labelKey: 'settings.title', Icon: SettingsIcon },
];

/**
 * A home-screen shortcut. It fades and springs up into place (staggered via
 * `delay`) and squashes slightly while held, all on the UI thread so the
 * gesture never waits on a re-render.
 */
function QuickTile({
  label,
  icon,
  delay,
  width,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  delay: number;
  /** Share of the row this tile occupies, as a percentage. */
  width: `${number}%`;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const enter = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(delay, withTiming(1, { duration: 320 }));
  }, [enter, delay]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [18, 0]) },
      { scale: interpolate(press.value, [0, 1], [1, 0.93]) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 1], [0, 0.12]),
  }));

  return (
    /**
     * The width lives on the outer view, not on the Pressable. This view is the
     * flex child, so a percentage width set deeper down left it content-sized
     * and `flexWrap` had nothing to wrap — every tile squeezed into one row.
     */
    <Animated.View style={[styles.tileCell, { width }, containerStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => { press.value = withSpring(1, { damping: 18, stiffness: 320 }); }}
        onPressOut={() => { press.value = withSpring(0, { damping: 14, stiffness: 220 }); }}
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Animated.View pointerEvents="none" style={[styles.tileGlow, glowStyle, { backgroundColor: colors.primary }]} />
        {icon}
        <AppText variant="caption" style={styles.tileLabel}>{label}</AppText>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const { gridColumns, isPhone } = useResponsive();
  const router = useRouter();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const themeMode = usePreferencesStore((state) => state.themeMode);
  const locale = usePreferencesStore((state) => state.locale);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const setLocale = usePreferencesStore((state) => state.setLocale);

  // The same endpoint used to be cached under two different keys (home and
  // quran), so switching screens always paid another round trip. `contentLocale`
  // is the resolved language (not the raw 'system' preference) and is part of
  // the key so switching language refetches in the new translation.
  const contentLocale = useAppLocale();
  const ayahQuery = useRemoteQuery({
    queryKey: ['quran', 'daily', contentLocale],
    queryFn: () => islamicApi.dailyAyah({ locale: contentLocale }),
    staleTime: 60 * 60 * 1000,
  });
  const profileQuery = useRemoteQuery({
    queryKey: ['users', 'me'],
    queryFn: () => usersApi.me(),
    enabled: authStatus === 'authenticated',
  });

  const open = (path: QuickPath) => {
    router.push(path as never);
  };

  const deviceLocale = i18n.language?.slice(0, 2);
  const activeLocale: AppLocale = locale === 'system'
    ? (supportedLocales.includes(deviceLocale as AppLocale) ? (deviceLocale as AppLocale) : 'az')
    : locale;
  const toggleTheme = () => setThemeMode(isDark ? 'light' : 'dark');
  const cycleLocale = () => {
    const index = supportedLocales.indexOf(activeLocale);
    const next = supportedLocales[(index + 1) % supportedLocales.length] ?? 'az';
    setLocale(next);
    void changeLocale(next);
  };

  return (
    <AppScreen
      title={t('home.greeting')}
      subtitle={t('home.subtitle')}
      refreshing={ayahQuery.isRefetching || profileQuery.isRefetching}
      onRefresh={() => { void ayahQuery.refetch(); void profileQuery.refetch(); }}
      right={
        <View style={styles.headerActions}>
          <Pressable onPress={cycleLocale} accessibilityRole="button" accessibilityLabel={t('common.language')} style={styles.headerButton}>
            <AppText variant="label" color={colors.primary}>{activeLocale.toUpperCase()}</AppText>
          </Pressable>
          <Pressable onPress={toggleTheme} accessibilityRole="button" accessibilityLabel={t('common.theme')} style={styles.headerButton}>
            <AppText variant="label" color={colors.primary}>{themeMode === 'system' ? (isDark ? '🌙' : '☀️') : isDark ? '🌙' : '☀️'}</AppText>
          </Pressable>
        </View>
      }
    >
      {authStatus === 'authenticated' ? (
        <Reveal distance={10}>
          <View style={styles.stats}>
            <StatCard label={t('profile.points')} unit={t('common.points')} value={profileQuery.data?.points ?? profileQuery.data?.totalPoints ?? user?.points ?? user?.totalPoints} />
            <StatCard label={t('profile.streak')} unit={t('profile.days')} value={profileQuery.data?.streak ?? user?.streak} />
          </View>
        </Reveal>
      ) : (
        <Reveal distance={10}>
          <Card style={styles.signInCard}>
            <AppText variant="subtitle">{t('home.signInTitle')}</AppText>
            <AppText color={colors.textMuted}>{t('home.signInSubtitle')}</AppText>
            <Button label={t('auth.signIn')} onPress={() => router.push('/auth/login')} />
            <Button label={t('auth.createAccount')} onPress={() => router.push('/auth/register')} variant="ghost" />
          </Card>
        </Reveal>
      )}

      <ScreenSection>
        <Reveal delay={90} distance={8}>
          <AppText variant="subtitle" style={styles.sectionTitle}>{t('home.dailyAyah')}</AppText>
        </Reveal>
        <RemoteState
          isLoading={ayahQuery.isPending}
          isError={ayahQuery.isError}
          error={ayahQuery.error}
          isEmpty={!ayahQuery.data || !(ayahQuery.data.text || ayahQuery.data.ayah || ayahQuery.data.arabic)}
          onRetry={() => void ayahQuery.refetch()}
          loadingLabel={t('remote.loading')}
        >
          {ayahQuery.data ? (
            <Card onPress={() => open('/quran')}>
              {ayahQuery.data.reference || ayahQuery.data.surah ? (
                <AppText variant="label" color={colors.primary}>
                  {[ayahQuery.data.surah, ayahQuery.data.reference ?? ayahQuery.data.ayahNumber].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
              <AppText variant="title" style={styles.ayah}>{ayahQuery.data.arabic ?? ayahQuery.data.text ?? ayahQuery.data.ayah}</AppText>
              {ayahQuery.data.translation || ayahQuery.data.translationText ? (
                <AppText color={colors.textMuted} style={styles.translation}>
                  {ayahQuery.data.translation ?? ayahQuery.data.translationText}
                </AppText>
              ) : null}
            </Card>
          ) : null}
        </RemoteState>
        {profileQuery.isError ? (
          <Card style={styles.profileError}>
            <AppText color={colors.danger}>{t('profile.userNotFound')}</AppText>
            <AppText variant="caption" color={colors.textMuted}>{t('common.retry')}</AppText>
          </Card>
        ) : null}
      </ScreenSection>

      <ScreenSection>
        <Reveal delay={90} distance={8}>
          <AppText variant="subtitle" style={styles.sectionTitle}>{t('home.quickAccess')}</AppText>
        </Reveal>
        {/* Icon grid. Each tile springs in on mount and on press. The column
            count follows the viewport, so the desktop site shows a proper
            multi-column grid instead of a stretched phone layout. */}
        <View style={styles.tileGrid}>
          {QUICK_LINKS.map((link, index) => (
            <QuickTile
              key={link.path}
              label={t(link.labelKey)}
              icon={<link.Icon color={colors.primary} size={isPhone ? 24 : 26} />}
              delay={Math.min(index, 10) * 45}
              width={`${100 / gridColumns}%`}
              onPress={() => open(link.path)}
            />
          ))}
        </View>
      </ScreenSection>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { minWidth: 44, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  stats: { flexDirection: 'row', gap: 12 },
  signInCard: { gap: 10 },
  sectionTitle: { marginBottom: 12 },
  ayah: { marginVertical: 14, textAlign: 'center' },
  translation: { marginBottom: 6 },
  quickList: { paddingHorizontal: 16, paddingVertical: 4 },
  profileError: { marginTop: 10 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  tileCell: { paddingHorizontal: 6, paddingBottom: 12 },
  /** Fills the cell, so every tile in a row is the same height. */
  tile: { width: '100%', minHeight: 104, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 6 },
  tileLabel: { textAlign: 'center' },
  tileGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18 },
});
