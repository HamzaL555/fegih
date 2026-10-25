import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { RemoteState } from '@/components/RemoteState';
import { islamicApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useTheme } from '@/providers/ThemeProvider';
import { useNotificationPermission } from '@/providers/NotificationProvider';
import { usePreferencesStore } from '@/store/preferencesStore';
import { schedulePrayerNotifications } from '@/services/prayerNotifications';

/** `YYYY-MM-DD` in the device's own timezone, shifted by `offsetDays`. */
function isoDay(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayOffset(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const today = new Date();
  const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

export default function PrayerScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { permissionGranted } = useNotificationPermission();
  const prayerNotificationsEnabled = usePreferencesStore((state) => state.notifications.prayerTimes);
  const { location, isLoading: locationLoading, error: locationError, retry } = useUserLocation();

  // The day the user is looking at. Timings are per-day, so this is part of the
  // query key: without it every date returned today's cached row.
  const [selectedDate, setSelectedDate] = useState(() => isoDay(0));
  const isToday = dayOffset(selectedDate) === 0;

  const coordinates = useMemo(
    () => (location ? { latitude: location.coords.latitude, longitude: location.coords.longitude, date: selectedDate } : undefined),
    [location, selectedDate],
  );

  const query = useRemoteQuery({
    queryKey: ['prayer-times', coordinates?.latitude, coordinates?.longitude, selectedDate],
    queryFn: () => islamicApi.prayerTimes(coordinates!),
    enabled: !!coordinates,
    staleTime: 30 * 60 * 1000,
  });

  // Only today's times should trigger notifications; scheduling a past or
  // future day would fire them at the wrong moment.
  useEffect(() => {
    if (!query.data || !permissionGranted || !isToday) return;
    void schedulePrayerNotifications(query.data, prayerNotificationsEnabled, { fajr: t('prayer.fajr'), dhuhr: t('prayer.dhuhr'), asr: t('prayer.asr'), maghrib: t('prayer.maghrib'), isha: t('prayer.isha') });
  }, [permissionGranted, prayerNotificationsEnabled, query.data, isToday, t]);

  const times: Array<[string, string | undefined]> = query.data
    ? [
        ['fajr', query.data.fajr],
        ['sunrise', query.data.sunrise],
        ['dhuhr', query.data.dhuhr],
        ['asr', query.data.asr],
        ['maghrib', query.data.maghrib],
        ['isha', query.data.isha],
      ]
    : [];

  return (
    <AppScreen title={t('prayer.title')} subtitle={t('prayer.subtitle')} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      {locationLoading ? <Card><AppText>{t('prayer.locationLoading')}</AppText></Card> : null}
      {locationError ? (
        <Card>
          <ErrorBanner error={new Error(t('prayer.locationDenied'))} />
          <Button label={t('prayer.enableLocation')} onPress={() => void retry()} variant="secondary" style={styles.retry} />
        </Card>
      ) : null}
      {coordinates ? (
        <RemoteState
          isLoading={query.isPending}
          isError={query.isError}
          error={query.error}
          isEmpty={!query.data || !Object.values(query.data).some((value) => typeof value === 'string' && value.length > 0)}
          onRetry={() => void query.refetch()}
          emptyTitle={t('prayer.noTimes')}
          emptyDescription={t('common.empty')}
        >
          {query.data ? (
            <Card>
              {/* Day picker: prayer times differ for every date. */}
              <View style={styles.dayPicker}>
                <Pressable
                  onPress={() => setSelectedDate((current) => isoDay(dayOffset(current) - 1))}
                  style={({ pressed }) => [styles.dayButton, { backgroundColor: pressed ? colors.surfaceElevated : colors.surface, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('prayer.previousDay')}
                >
                  <AppText variant="title" color={colors.primary}>‹</AppText>
                </Pressable>
                <View style={styles.dayLabel}>
                  <AppText variant="label" color={colors.textMuted}>{t('prayer.timesFor')}</AppText>
                  <AppText variant="subtitle">
                    {isToday ? t('prayer.today') : selectedDate}
                  </AppText>
                  {query.data.weekday ? <AppText variant="caption" color={colors.textMuted}>{query.data.weekday}</AppText> : null}
                </View>
                <Pressable
                  onPress={() => setSelectedDate((current) => isoDay(dayOffset(current) + 1))}
                  style={({ pressed }) => [styles.dayButton, { backgroundColor: pressed ? colors.surfaceElevated : colors.surface, borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('prayer.nextDay')}
                >
                  <AppText variant="title" color={colors.primary}>›</AppText>
                </Pressable>
              </View>

              {!isToday ? (
                <Button label={t('prayer.backToToday')} onPress={() => setSelectedDate(isoDay(0))} variant="ghost" style={styles.todayButton} />
              ) : null}

              <View style={styles.grid}>
                {times.map(([key, value]) => (
                  <View key={key} style={styles.timeCell}>
                    <AppText variant="caption" color={colors.textMuted}>{t(`prayer.${key}`)}</AppText>
                    <AppText variant="title" color={colors.primary}>{value ?? t('common.notAvailable')}</AppText>
                  </View>
                ))}
              </View>
              {query.data.date ? <AppText variant="caption" color={colors.textMuted} style={styles.date}>{query.data.date}</AppText> : null}
            </Card>
          ) : null}
        </RemoteState>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  timeCell: { width: '50%', paddingVertical: 12, gap: 4 },
  date: { marginTop: 12 },
  retry: { marginTop: 12 },
  dayPicker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { flex: 1, alignItems: 'center', gap: 2 },
  todayButton: { marginTop: 8, paddingHorizontal: 0 },
});
