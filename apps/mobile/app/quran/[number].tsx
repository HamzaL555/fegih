import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/RemoteState';
import { quranApi } from '@/api';
import { useAppLocale } from '@/hooks/useAppLocale';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';

export default function QuranSurahScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ number?: string }>();
  const number = Number(params.number);
  const [page, setPage] = useState(1);
  // Ayahs come back in the language chosen in Settings.
  const locale = useAppLocale();
  const query = useRemoteQuery({ queryKey: ['quran', 'surah', number, page, locale], queryFn: () => quranApi.surah(number, page, 50, locale), enabled: Number.isInteger(number) && number > 0, staleTime: 24 * 60 * 60 * 1000 });
  const surah = query.data;
  const ayahs = useMemo(() => surah?.ayahs ?? [], [surah?.ayahs]);
  const hasMore = ayahs.length > 0 && ayahs.length < (surah?.ayahCount ?? 0);

  if (!Number.isInteger(number) || number < 1) return <AppScreen title={t('quran.title')}><ErrorBanner error={new Error(t('errors.generic'))} /></AppScreen>;

  return <AppScreen title={surah?.englishName ?? t('quran.title')} subtitle={surah ? `${surah.name} · ${surah.revelationType}` : t('common.loading')} onRefresh={() => void query.refetch()}>
    <Button label={t('common.back')} onPress={() => router.back()} variant="ghost" style={styles.back} />
    {query.isPending ? <LoadingState /> : null}
    {query.isError ? <ErrorBanner error={query.error} /> : null}
    {surah ? <>
      <Card style={styles.header}><AppText variant="title" color={colors.primary}>{surah.englishName}</AppText><AppText color={colors.textMuted}>{surah.englishNameTranslation}</AppText><AppText variant="caption" color={colors.textMuted}>{surah.ayahCount} {t('quran.ayahs')}</AppText></Card>
      <View style={styles.ayahs}>{ayahs.map((ayah) => <Card key={ayah.ayahNumber} style={styles.ayah}><View style={styles.ayahHeader}><AppText variant="label" color={colors.primary}>{ayah.ayahNumber}</AppText><AppText variant="caption" color={colors.textMuted}>{t('quran.juz')} {ayah.juz} · {t('quran.page')} {ayah.page}</AppText></View><AppText variant="title" style={styles.arabic}>{ayah.arabic}</AppText>{ayah.translation ? <AppText color={colors.textMuted} style={styles.translation}>{ayah.translation}</AppText> : null}</Card>)}</View>
      {hasMore ? <Button label={t('quran.loadMore')} onPress={() => setPage((current) => current + 1)} variant="secondary" loading={query.isFetching} /> : null}
    </> : null}
  </AppScreen>;
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: 8 },
  header: { gap: 6, marginBottom: 14 },
  ayahs: { gap: 12 },
  ayah: { gap: 8 },
  ayahHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  arabic: { textAlign: 'right', fontSize: 25, lineHeight: 46 },
  translation: { textAlign: 'left' },
});
