import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RemoteState } from '@/components/RemoteState';
import { islamicApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import type { Hadith, IslamicArticle, IslamicInfoItem } from '@/types/domain';

type Tab = 'today' | 'articles' | 'hadiths';

const CATEGORY_LABELS: Record<string, string> = {
  iman: 'İman',
  ibadet: 'İbadət',
  ahlak: 'Əxlaq',
  elmi: 'Elm',
  tarix: 'Tarix',
  hadis: 'Hədis',
};

const TOPIC_LABELS: Record<string, string> = {
  iman: 'İman',
  namaz: 'Namaz',
  zakat: 'Zəkat',
  ahlak: 'Əxlaq',
  elm: 'Elm',
  quran: 'Quran',
  dua: 'Dua',
  peygamber: 'Peyğəmbər',
};

export default function IslamicInfoScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('today');
  const [openSlug, setOpenSlug] = useState<string>();
  const [topic, setTopic] = useState<string>();

  const todayQuery = useRemoteQuery({ queryKey: ['islamic-info', 'today'], queryFn: () => islamicApi.info(), enabled: tab === 'today', staleTime: 6 * 60 * 60 * 1000 });
  const libraryQuery = useRemoteQuery({ queryKey: ['islamic-info', 'library'], queryFn: () => islamicApi.articleLibrary(), enabled: tab === 'articles', staleTime: 24 * 60 * 60 * 1000 });
  const hadithsQuery = useRemoteQuery({ queryKey: ['islamic-info', 'hadiths', topic], queryFn: () => islamicApi.hadiths(topic), enabled: tab === 'hadiths', staleTime: 24 * 60 * 60 * 1000 });

  const todayItems: IslamicInfoItem[] = todayQuery.data ? (Array.isArray(todayQuery.data) ? todayQuery.data : [todayQuery.data]) : [];
  const articles = libraryQuery.data ?? [];
  const hadiths = hadithsQuery.data ?? [];
  const topics = islamicApi.hadithTopics;

  return (
    <AppScreen
      title={t('islamicInfo.title')}
      subtitle={t('islamicInfo.subtitle')}
      refreshing={todayQuery.isRefetching || libraryQuery.isRefetching || hadithsQuery.isRefetching}
      onRefresh={() => { void todayQuery.refetch(); void libraryQuery.refetch(); void hadithsQuery.refetch(); }}
    >
      <View style={styles.tabs}>
        {([['today', t('islamicInfo.today')], ['articles', t('islamicInfo.browseAll')], ['hadiths', t('islamicInfo.hadith')]] as Array<[Tab, string]>).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            accessibilityRole="button"
            style={[styles.tab, { backgroundColor: tab === key ? colors.primary : colors.surface, borderColor: tab === key ? colors.primary : colors.border }]}
          >
            <AppText variant="caption" color={tab === key ? colors.primaryContrast : colors.textMuted}>{label}</AppText>
          </Pressable>
        ))}
      </View>

      {tab === 'today' ? (
        <RemoteState
          isLoading={todayQuery.isPending}
          isError={todayQuery.isError}
          error={todayQuery.error}
          isEmpty={todayItems.length === 0}
          onRetry={() => void todayQuery.refetch()}
          emptyTitle={t('islamicInfo.noInfo')}
          emptyDescription={t('common.empty')}
        >
          <View style={styles.list}>
            {todayItems.map((item, index) => (
              <Card key={item.id ?? `${item.title}-${index}`}>
                <AppText variant="subtitle">{item.title}</AppText>
                {item.description || item.content ? <AppText color={colors.textMuted} style={styles.body}>{item.description ?? item.content}</AppText> : null}
              </Card>
            ))}
          </View>
        </RemoteState>
      ) : null}

      {tab === 'articles' ? (
        <RemoteState
          isLoading={libraryQuery.isPending}
          isError={libraryQuery.isError}
          error={libraryQuery.error}
          isEmpty={articles.length === 0}
          onRetry={() => void libraryQuery.refetch()}
          emptyTitle={t('islamicInfo.noInfo')}
        >
          <View style={styles.list}>
            {articles.map((article: IslamicArticle) => {
              const open = openSlug === article.slug;
              return (
                <Card key={article.slug} onPress={() => setOpenSlug(open ? undefined : article.slug)}>
                  <View style={styles.cardHead}>
                    <AppText variant="subtitle" style={styles.cardTitle}>{article.title}</AppText>
                    <AppText variant="caption" color={colors.primary}>{CATEGORY_LABELS[article.category] ?? article.category}</AppText>
                  </View>
                  <AppText color={colors.textMuted} style={styles.body}>{open ? article.content : article.summary}</AppText>
                  {open && article.reference ? <AppText variant="caption" color={colors.textMuted} style={styles.source}>{t('islamicInfo.source')}: {article.reference}</AppText> : null}
                </Card>
              );
            })}
          </View>
        </RemoteState>
      ) : null}

      {tab === 'hadiths' ? (
        <>
          <View style={styles.chips}>
            <Pressable onPress={() => setTopic(undefined)} style={[styles.chip, { backgroundColor: !topic ? colors.primary : colors.surface, borderColor: !topic ? colors.primary : colors.border }]}>
              <AppText variant="caption" color={!topic ? colors.primaryContrast : colors.textMuted}>{t('common.all')}</AppText>
            </Pressable>
            {topics.map((item) => (
              <Pressable key={item} onPress={() => setTopic(item)} style={[styles.chip, { backgroundColor: topic === item ? colors.primary : colors.surface, borderColor: topic === item ? colors.primary : colors.border }]}>
                <AppText variant="caption" color={topic === item ? colors.primaryContrast : colors.textMuted}>{TOPIC_LABELS[item] ?? item}</AppText>
              </Pressable>
            ))}
          </View>
          <RemoteState
            isLoading={hadithsQuery.isPending}
            isError={hadithsQuery.isError}
            error={hadithsQuery.error}
            isEmpty={hadiths.length === 0}
            onRetry={() => void hadithsQuery.refetch()}
            emptyTitle={t('common.noData')}
          >
            <View style={styles.list}>
              {hadiths.map((hadith: Hadith) => (
                <Card key={hadith.id}>
                  <AppText variant="title" style={styles.arabic}>{hadith.arabic}</AppText>
                  <AppText color={colors.text} style={styles.hadithText}>{hadith.text}</AppText>
                  <View style={styles.hadithMeta}>
                    {hadith.narrator ? <AppText variant="caption" color={colors.textMuted}>{hadith.narrator}</AppText> : null}
                    <AppText variant="caption" color={colors.primary}>{t('islamicInfo.source')}: {hadith.takhrij}</AppText>
                  </View>
                </Card>
              ))}
            </View>
          </RemoteState>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  list: { gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1 },
  body: { marginTop: 10 },
  source: { marginTop: 8 },
  arabic: { textAlign: 'right', fontSize: 22, lineHeight: 40, marginBottom: 10 },
  hadithText: { marginBottom: 10 },
  hadithMeta: { gap: 3 },
});
