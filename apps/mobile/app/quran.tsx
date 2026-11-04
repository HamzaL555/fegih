import { useMemo } from 'react';
import { useCallback } from 'react';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { RemoteState } from '@/components/RemoteState';
import { TextField } from '@/components/TextField';
import { quranApi } from '@/api';
import { useAppLocale } from '@/hooks/useAppLocale';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';

export default function QuranScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  const locale = useAppLocale();
  // The search term lives in the URL so refreshing keeps the same results.
  const search = (searchParams as any)?.get('search') || '';

  const setSearch = useCallback(
    (value: string) => {
      router.replace(`/quran?search=${encodeURIComponent(value)}`);
    },
    [router],
  );

  const submitSearch = useCallback(() => {
    setSearch(search.trim());
  }, [search, setSearch]);

  // Ayahs come back in the language chosen in Settings.
  // The locale is part of the key, otherwise switching language would keep
  // showing the previously cached translation.
  // The daily verse rotates once a day, but an admin can still replace it, so
  // it is refetched every ten minutes rather than once an hour.
  const dailyQuery = useRemoteQuery({ queryKey: ['quran', 'daily', locale], queryFn: () => quranApi.daily(locale), staleTime: 10 * 60 * 1000 });
  // The surah list is immutable.
  const surahsQuery = useRemoteQuery({ queryKey: ['quran', 'surahs', search], queryFn: () => quranApi.surahs(search || undefined), staleTime: 24 * 60 * 60 * 1000 });
  const daily = dailyQuery.data;
  const surahs = useMemo(() => surahsQuery.data ?? [], [surahsQuery.data]);

  return <AppScreen title={t('quran.title')} subtitle={t('quran.subtitle')} refreshing={dailyQuery.isRefetching || surahsQuery.isRefetching} onRefresh={() => { void dailyQuery.refetch(); void surahsQuery.refetch(); }}>
    <Card style={styles.hero}>
      <AppText variant="label" color={colors.primary}>{t('quran.todayAyah')}</AppText>
      {daily ? <>
        <AppText variant="subtitle" style={styles.reference}>{daily.surah ?? daily.englishName} · {daily.reference ?? `${daily.surahNumber}:${daily.ayahNumber}`}</AppText>
        <AppText variant="display" style={styles.arabic}>{daily.arabic ?? daily.arabicText}</AppText>
        {daily.translation ?? daily.translationText ? <AppText color={colors.textMuted} style={styles.translation}>{daily.translation ?? daily.translationText}</AppText> : null}
      </> : <AppText color={colors.textMuted}>{dailyQuery.isPending ? t('common.loading') : t('quran.noAyah')}</AppText>}
    </Card>

    <ScreenSection>
      <View style={styles.searchRow}>
        <TextField label={t('quran.search')} placeholder={t('quran.searchPlaceholder')} value={search} onChangeText={setSearch} onSubmitEditing={submitSearch} returnKeyType="search" />
        <AppText variant="label" color={colors.primary} onPress={submitSearch}>{t('quran.search')}</AppText>
      </View>
    </ScreenSection>

    <ScreenSection>
      <AppText variant="subtitle" style={styles.sectionTitle}>{t('quran.allSurahs')} <AppText variant="caption" color={colors.textMuted}>({surahs.length})</AppText></AppText>
      <RemoteState isLoading={surahsQuery.isPending} isError={surahsQuery.isError} error={surahsQuery.error} onRetry={() => void surahsQuery.refetch()} isEmpty={surahs.length === 0} emptyTitle={t('quran.noSurahs')} emptyDescription={t('common.empty')}>
        <View style={styles.surahList}>
          {surahs.map((surah) => <Pressable key={surah.number} onPress={() => router.push({ pathname: '/quran/[number]', params: { number: String(surah.number) } } as unknown as Href)} style={({ pressed }) => [styles.surahRow, { backgroundColor: pressed ? colors.surfaceElevated : colors.surface, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`${surah.englishName}, ${surah.ayahCount} ayahs`}>
            <View style={[styles.number, { backgroundColor: colors.primary }]}><AppText variant="label" color={colors.primaryContrast}>{surah.number}</AppText></View>
            <View style={styles.surahText}><AppText variant="subtitle">{surah.englishName}</AppText><AppText variant="caption" color={colors.textMuted}>{surah.englishNameTranslation} · {surah.ayahCount} {t('quran.ayahs')}</AppText></View>
            <AppText variant="title" color={colors.primary}>›</AppText>
          </Pressable>)}
        </View>
      </RemoteState>
    </ScreenSection>
  </AppScreen>;
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  reference: { marginTop: 4 },
  arabic: { textAlign: 'center', fontSize: 30, lineHeight: 52, marginVertical: 18 },
  translation: { textAlign: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  sectionTitle: { marginBottom: 12 },
  surahList: { gap: 8 },
  surahRow: { minHeight: 68, borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  surahText: { flex: 1, gap: 3 },
});
