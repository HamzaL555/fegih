import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ListRow, RowDescription, RowTitle } from '@/components/ListRow';
import { PageMetaText } from '@/components/PageMetaText';
import { RemoteState } from '@/components/RemoteState';
import { leaderboardApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const searchParams = useLocalSearchParams();

  // Page lives in the URL so refreshing or sharing the link keeps the same
  // position. Defaults to page 1 when the param is missing or invalid.
  const urlPage = Number((searchParams as any)?.get('page'));
  const page = Number.isFinite(urlPage) && urlPage >= 1 ? urlPage : 1;

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, next);
      router.replace(`/(tabs)/leaderboard?page=${clamped}`);
    },
    [router],
  );

  const query = useRemoteQuery({
    queryKey: ['leaderboard', page],
    queryFn: () => leaderboardApi.list({ page, limit: 20 }),
  });

  return (
    <AppScreen
      title={t('leaderboard.title')}
      subtitle={t('leaderboard.subtitle')}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <RemoteState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        isEmpty={!query.data?.data?.length}
        onRetry={() => void query.refetch()}
        emptyTitle={t('leaderboard.noEntries')}
        emptyDescription={t('common.empty')}
      >
        <ErrorBoundary>
          {query.data ? (
            <View>
              <Card style={styles.list}>
                {(query.data.data ?? []).map((entry, index) => (
                  <ListRow key={entry.userId ?? entry.id ?? `${entry.username}-${index}`}>
                    <View style={styles.entry}>
                      <AppText variant="label" color={colors.primary} style={styles.rank}>
                        {entry.rank ?? (page - 1) * 20 + index + 1}
                      </AppText>
                      <View style={styles.name}>
                        <RowTitle>{entry.displayName || entry.username}</RowTitle>
                        <RowDescription>{entry.isCurrentUser ? t('leaderboard.you') : entry.username}</RowDescription>
                      </View>
                    </View>
                    <AppText variant="subtitle" color={colors.primary}>{entry.points ?? 0}</AppText>
                  </ListRow>
                ))}
              </Card>
              <PageMetaText meta={query.data.meta ?? undefined} />
              <View style={styles.pagination}>
                <Button
                  label={t('common.previous')}
                  onPress={() => setPage(page - 1)}
                  disabled={page <= 1}
                  variant="secondary"
                  style={styles.pageButton}
                />
                <Button
                  label={t('common.next')}
                  onPress={() => setPage(page + 1)}
                  disabled={!query.data.meta || page >= query.data.meta.totalPages}
                  variant="secondary"
                  style={styles.pageButton}
                />
              </View>
            </View>
          ) : null}
        </ErrorBoundary>
      </RemoteState>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingVertical: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rank: { width: 38 },
  name: { flex: 1 },
  pagination: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pageButton: { flex: 1 },
});
