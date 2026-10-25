import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { RemoteState } from '@/components/RemoteState';
import { islamicApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import type { HijriMonthDay } from '@/types/domain';

const WEEKDAYS = ['B', 'B.e', 'Ç.a', 'Ç.ə', 'C.a', 'C.ə', 'Ş'];

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const language = (i18n.language?.slice(0, 2) ?? 'az') as 'az' | 'tr' | 'en' | 'ar';
  const [cursor, setCursor] = useState<{ year: number; month: number } | undefined>();
  const [selected, setSelected] = useState<string>();

  const monthQuery = useRemoteQuery({
    queryKey: ['calendar', 'hijri-month', cursor?.year, cursor?.month, language],
    queryFn: () => islamicApi.hijriMonth({ year: cursor?.year, month: cursor?.month, lang: language }),
    staleTime: 24 * 60 * 60 * 1000,
  });
  const upcomingQuery = useRemoteQuery({
    queryKey: ['calendar', 'upcoming'],
    queryFn: () => islamicApi.upcomingOccasions(),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const month = monthQuery.data;
  const days = useMemo(() => month?.days ?? [], [month?.days]);

  /**
   * Pad the first row so the 1st lands under the right weekday. The API grid
   * starts on the Gregorian date of 1 Muharram, so its own `weekday` value is
   * what positions the first cell.
   */
  const leadingBlanks = days.length ? days[0]!.weekday : 0;

  const shift = (delta: number) => {
    const baseYear = cursor?.year ?? month?.hijriYear;
    const baseMonth = cursor?.month ?? month?.hijriMonth;
    if (baseYear === undefined || baseMonth === undefined) return;
    let nextMonth = baseMonth + delta;
    let nextYear = baseYear;
    if (nextMonth < 1) { nextMonth = 12; nextYear -= 1; }
    if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
    setCursor({ year: nextYear, month: nextMonth });
  };

  const goToday = () => setCursor(undefined);
  const isCurrentMonth = !cursor && month && month.hijriMonth === month.currentHijri.month && month.hijriYear === month.currentHijri.year;

  return (
    <AppScreen title={t('calendar.title')} subtitle={t('calendar.subtitle')} refreshing={monthQuery.isRefetching} onRefresh={() => { void monthQuery.refetch(); void upcomingQuery.refetch(); }}>
      <ScreenSection>
        <View style={styles.monthHeader}>
          <Button label="‹" onPress={() => shift(-1)} variant="ghost" style={styles.navButton} accessibilityLabel={t('calendar.previousMonth')} />
          <View style={styles.monthTitle}>
            <AppText variant="title" color={colors.primary}>{month ? month.monthName[language] : t('common.loading')}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {month ? `${month.hijriYear} · ${t('calendar.hijri')}` : ''}
            </AppText>
          </View>
          <Button label="›" onPress={() => shift(1)} variant="ghost" style={styles.navButton} accessibilityLabel={t('calendar.nextMonth')} />
        </View>
        {isCurrentMonth === false ? <Button label={t('calendar.today')} onPress={goToday} variant="secondary" style={styles.todayButton} /> : null}
      </ScreenSection>

      {monthQuery.isError ? <ErrorBanner error={monthQuery.error} onDismiss={() => void monthQuery.refetch()} /> : null}

      <Card style={styles.gridCard}>
        <View style={styles.grid}>
          {WEEKDAYS.map((day, index) => (
            <View key={day + index} style={styles.cell}><AppText variant="caption" color={colors.textMuted}>{day}</AppText></View>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, index) => <View key={`blank-${index}`} style={styles.cell} />)}
          {days.map((day: HijriMonthDay) => {
            const isSelected = selected === day.gregorian;
            const hasHoliday = day.holidays.length > 0;
            return (
              <Pressable
                key={day.gregorian}
                onPress={() => setSelected(isSelected ? undefined : day.gregorian)}
                style={({ pressed }) => [styles.cell, styles.dayCell, { backgroundColor: day.isToday ? colors.primary : isSelected ? colors.surfaceElevated : pressed ? colors.surfaceElevated : 'transparent' }]}
                accessibilityRole="button"
                accessibilityLabel={`${day.hijriDay} ${month?.monthName[language]} ${day.gregorian}`}
              >
                <AppText variant="label" color={day.isToday ? colors.primaryContrast : hasHoliday ? colors.accent : colors.text}>{day.hijriDay}</AppText>
                {hasHoliday ? <View style={[styles.dot, { backgroundColor: day.isToday ? colors.primaryContrast : colors.accent }]} /> : null}
                {day.events.length ? <View style={[styles.dot, { backgroundColor: day.isToday ? colors.primaryContrast : colors.primary }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {selected ? (
        <Card style={styles.selectedCard}>
          <AppText variant="subtitle" color={colors.primary}>{selected}</AppText>
          {(() => {
            const day = days.find((item) => item.gregorian === selected);
            if (!day) return null;
            return (
              <View style={styles.selectedBody}>
                <AppText color={colors.textMuted}>{day.hijriDay} {month?.monthName[language]} {month?.hijriYear}</AppText>
                {day.holidays.map((holiday) => <AppText key={holiday} color={colors.accent}>★ {holiday}</AppText>)}
                {day.events.map((event) => <AppText key={event} color={colors.text}>{event}</AppText>)}
                {!day.holidays.length && !day.events.length ? <AppText color={colors.textMuted}>{t('common.noData')}</AppText> : null}
              </View>
            );
          })()}
        </Card>
      ) : null}

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('calendar.upcoming')}</AppText>
        <RemoteState
          isLoading={upcomingQuery.isPending}
          isError={upcomingQuery.isError}
          error={upcomingQuery.error}
          isEmpty={(upcomingQuery.data?.length ?? 0) === 0}
          onRetry={() => void upcomingQuery.refetch()}
          emptyTitle={t('common.noData')}
        >
          <View style={styles.list}>
            {(upcomingQuery.data ?? []).map((occasion) => (
              <Card key={`${occasion.key}-${occasion.gregorian}`} style={styles.occasionCard}>
                <View style={styles.occasionRow}>
                  <View style={styles.occasionText}>
                    <AppText variant="subtitle">{occasion.title}</AppText>
                    <AppText variant="caption" color={colors.textMuted}>{occasion.gregorian} · {occasion.hijriDate}</AppText>
                  </View>
                  <AppText variant="label" color={colors.primary}>
                    {occasion.daysAway === 0 ? t('calendar.today') : `${occasion.daysAway} ${t('calendar.days')}`}
                  </AppText>
                </View>
              </Card>
            ))}
          </View>
        </RemoteState>
      </ScreenSection>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { alignItems: 'center', flex: 1 },
  navButton: { paddingHorizontal: 20, minHeight: 44 },
  todayButton: { alignSelf: 'center', marginTop: 10 },
  gridCard: { paddingVertical: 10, paddingHorizontal: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 44, gap: 2 },
  dayCell: { borderRadius: 12, paddingVertical: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  selectedCard: { marginTop: 14, gap: 4 },
  selectedBody: { gap: 4 },
  sectionTitle: { marginBottom: 10 },
  list: { gap: 8 },
  occasionCard: { paddingVertical: 12 },
  occasionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  occasionText: { flex: 1, gap: 3 },
});
