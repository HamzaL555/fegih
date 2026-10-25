import { useMutation, useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ListRow } from '@/components/ListRow';
import { getAdminBaseUrl } from '@/api/client';
import { changeLocale, supportedLocales } from '@/i18n';
import { notificationsApi, preferencesApi } from '@/api';
import { useNotificationPermission } from '@/providers/NotificationProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { usePreferencesStore } from '@/store/preferencesStore';
import type { AppLocale, ThemeMode } from '@/types/domain';
import { useAuthStore } from '@/store/authStore';

const LOCALE_NAMES: Record<string, string> = {
  az: 'Azərbaycan',
  tr: 'Türkçe',
  en: 'English',
  ar: 'العربية',
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const themeMode = usePreferencesStore((state) => state.themeMode);
  const locale = usePreferencesStore((state) => state.locale);
  const notifications = usePreferencesStore((state) => state.notifications);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const setLocale = usePreferencesStore((state) => state.setLocale);
  const setNotificationPreference = usePreferencesStore((state) => state.setNotificationPreference);
  const setNotifications = usePreferencesStore((state) => state.setNotifications);
  const { permissionGranted, requestPermission } = useNotificationPermission();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const remoteNotifications = useQuery({ queryKey: ['notifications', 'preferences'], queryFn: () => notificationsApi.preferences(), enabled: authStatus === 'authenticated', staleTime: 5 * 60_000 });
  const remoteSettings = useQuery({ queryKey: ['settings', 'preferences'], queryFn: () => preferencesApi.get(), enabled: authStatus === 'authenticated', staleTime: 5 * 60_000 });
  const saveNotifications = useMutation({ mutationFn: notificationsApi.updatePreferences });
  const saveSettings = useMutation({ mutationFn: preferencesApi.update });
  const [saveError, setSaveError] = useState<unknown>();

  useEffect(() => {
    const remote = remoteNotifications.data;
    if (remote) setNotifications({ enabled: remote.DAILY_AYAH !== false, quiz: remote.NEW_QUIZ_QUESTIONS !== false, prayerTimes: remote.PRAYER !== false, rewards: remote.REWARD !== false, missions: remote.DAILY_MISSION !== false });
    const settings = remoteSettings.data as { theme?: string; language?: string } | undefined;
    if (settings?.theme && ['light', 'dark', 'system'].includes(settings.theme.toLowerCase())) setThemeMode(settings.theme.toLowerCase() as ThemeMode);
    // Applying the language to i18next was missing, so the server value changed
    // the stored preference while the UI kept rendering the old language.
    if (settings?.language && supportedLocales.includes(settings.language as (typeof supportedLocales)[number])) {
      setLocale(settings.language as AppLocale);
      void changeLocale(settings.language as AppLocale);
    }
  }, [remoteNotifications.data, remoteSettings.data, setNotifications, setLocale, setThemeMode]);

  const selectLocale = (next: AppLocale) => {
    setLocale(next);
    void changeLocale(next);
    if (authStatus === 'authenticated') saveSettings.mutate({ language: next }, { onError: setSaveError });
  };

  const selectTheme = (next: ThemeMode) => {
    setThemeMode(next);
    if (authStatus === 'authenticated') saveSettings.mutate({ theme: next.toUpperCase() }, { onError: setSaveError });
  };

  const toggleNotifications = async (key: 'enabled' | 'quiz' | 'prayerTimes' | 'rewards' | 'missions', value: boolean) => {
    if (value && !permissionGranted) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    setNotificationPreference(key, value);
    if (authStatus === 'authenticated') {
      const current = { ...notifications, [key]: value };
      saveNotifications.mutate({
        // DAILY_AYAH used to be gated on the *quiz* toggle, so the daily ayah
        // could never be disabled independently.
        DAILY_AYAH: current.enabled,
        DAILY_ISLAMIC_INFO: current.enabled,
        PRAYER: current.enabled && current.prayerTimes,
        DAILY_MISSION: current.enabled && current.missions,
        STREAK_REMINDER: current.enabled,
        STORE: current.enabled,
        ORDER_UPDATE: current.enabled,
        NEW_QUIZ_QUESTIONS: current.enabled && current.quiz,
        REWARD: current.enabled && current.rewards,
      }, { onError: setSaveError });
    }
  };

  const version = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';
  const adminUrl = getAdminBaseUrl();

  return (
    <AppScreen title={t('settings.title')}>
      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('settings.themeSection')}</AppText>
        <Card>
          <AppText color={colors.textMuted}>{t('settings.themeDescription')}</AppText>
          <View style={styles.options}>
            {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
              <Choice key={mode} label={t(`common.${mode}`)} selected={themeMode === mode} onPress={() => selectTheme(mode)} />
            ))}
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('settings.languageSection')}</AppText>
        <Card>
          <AppText color={colors.textMuted}>{t('settings.languageDescription')}</AppText>
          <View style={styles.options}>
            {supportedLocales.map((item) => (
              <Choice key={item} label={LOCALE_NAMES[item] ?? item.toUpperCase()} selected={locale === item} onPress={() => selectLocale(item)} />
            ))}
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('settings.notificationsTitle')}</AppText>
        <Card>
          <AppText color={colors.textMuted} style={styles.description}>{t('settings.notificationsDescription')}</AppText>
          <NotificationRow label={t('settings.allNotifications')} value={notifications.enabled} onChange={(value) => void toggleNotifications('enabled', value)} />
          <NotificationRow label={t('settings.quizNotifications')} value={notifications.quiz} onChange={(value) => void toggleNotifications('quiz', value)} />
          <NotificationRow label={t('settings.prayerNotifications')} value={notifications.prayerTimes} onChange={(value) => void toggleNotifications('prayerTimes', value)} />
          <NotificationRow label={t('settings.rewardNotifications')} value={notifications.rewards} onChange={(value) => void toggleNotifications('rewards', value)} />
          <NotificationRow label={t('settings.missionNotifications')} value={notifications.missions} onChange={(value) => void toggleNotifications('missions', value)} />
          <AppText variant="caption" color={permissionGranted ? colors.success : colors.textMuted} style={styles.permission}>
            {permissionGranted ? t('settings.permissionGranted') : t('settings.permissionRequired')}
          </AppText>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('settings.adminSection')}</AppText>
        <Card>
          <AppText color={colors.textMuted} style={styles.description}>{t('settings.adminDescription')}</AppText>
          <ListRow
            onPress={() => void Linking.openURL(adminUrl).catch(() => undefined)}
            right={<AppText variant="label" color={colors.primary}>↗</AppText>}
          >
            <AppText variant="subtitle">{t('settings.openAdmin')}</AppText>
            <AppText variant="caption" color={colors.textMuted}>{adminUrl}</AppText>
          </ListRow>
          {user?.email || user?.username ? (
            <AppText variant="caption" color={colors.textMuted} style={styles.description}>
              {t('settings.adminAccount')}: {user.email ?? user.username}
            </AppText>
          ) : null}
        </Card>
      </ScreenSection>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('settings.about')}</AppText>
        <Card>
          <ListRow><AppText>{t('common.appName')}</AppText><AppText color={colors.textMuted}>{version}</AppText></ListRow>
          <ListRow><AppText>{t('common.language')}</AppText><AppText color={colors.textMuted}>{locale === 'system' ? t('common.system') : (LOCALE_NAMES[locale] ?? locale.toUpperCase())}</AppText></ListRow>
          <ListRow><AppText>{t('common.theme')}</AppText><AppText color={colors.textMuted}>{t(`common.${themeMode}`)}</AppText></ListRow>
        </Card>
      </ScreenSection>

      {saveError ? <ErrorBanner error={saveError} onDismiss={() => setSaveError(undefined)} /> : null}
    </AppScreen>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.choice, { backgroundColor: selected ? colors.primary : pressed ? colors.surfaceElevated : colors.surface, borderColor: selected ? colors.primary : colors.border }]}>
      <AppText variant="caption" color={selected ? colors.primaryContrast : colors.text}>{label}</AppText>
    </Pressable>
  );
}

function NotificationRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.notificationRow}>
      <AppText>{label}</AppText>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.surface} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginBottom: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  choice: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  description: { marginBottom: 8 },
  notificationRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  permission: { marginTop: 12 },
});
