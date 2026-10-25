import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PriceText } from '@/components/PriceText';
import { RemoteState } from '@/components/RemoteState';
import { booksApi, usersApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const userQuery = useRemoteQuery({ queryKey: ['users', 'me'], queryFn: () => usersApi.me(), enabled: status === 'authenticated' });
  const favoriteIds = useMemo(() => {
    const favorites = userQuery.data?.favorites;
    if (!favorites) return [] as string[];
    return favorites.map((favorite) => typeof favorite === 'string' ? favorite : favorite.bookId ?? favorite.id ?? '').filter(Boolean);
  }, [userQuery.data]);
  const booksQuery = useRemoteQuery({ queryKey: ['favorites', 'books'], queryFn: () => booksApi.list({ page: 1, limit: 100 }), enabled: status === 'authenticated' && favoriteIds.length > 0 });
  const books = booksQuery.data?.data.filter((book) => favoriteIds.includes(book.id)) ?? [];

  if (status !== 'authenticated') return <AppScreen title={t('favorites.title')}><AuthRequired /></AppScreen>;

  return (
    <AppScreen title={t('favorites.title')} subtitle={t('favorites.subtitle')} refreshing={userQuery.isRefetching} onRefresh={() => void userQuery.refetch()}>
      <RemoteState
        isLoading={userQuery.isPending}
        isError={userQuery.isError}
        error={userQuery.error}
        isEmpty={favoriteIds.length === 0}
        onRetry={() => void userQuery.refetch()}
        emptyTitle={t('favorites.noFavorites')}
        emptyDescription={t('common.empty')}
      >
        <RemoteState
          isLoading={booksQuery.isPending}
          isError={booksQuery.isError}
          error={booksQuery.error}
          isEmpty={books.length === 0}
          onRetry={() => void booksQuery.refetch()}
          emptyTitle={t('favorites.noFavorites')}
        >
          <View style={styles.list}>
            {books.map((book) => (
              <Card key={book.id} onPress={() => router.push({ pathname: '/books/[id]', params: { id: book.id } })}>
                <AppText variant="subtitle">{book.title}</AppText>
                {book.author ? <AppText color={colors.textMuted}>{book.author}</AppText> : null}
                <PriceText value={book.price} currency={book.currency} />
              </Card>
            ))}
          </View>
        </RemoteState>
      </RemoteState>
      {userQuery.isError ? <ErrorBanner error={userQuery.error} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
