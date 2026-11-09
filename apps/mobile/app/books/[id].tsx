import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { BookCover } from '@/components/BookCover';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PriceText } from '@/components/PriceText';
import { RemoteState } from '@/components/RemoteState';
import { booksApi, cartApi } from '@/api';
import { useAuthStore } from '@/store/authStore';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';

export default function BookDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useRemoteQuery({ queryKey: ['book', id], queryFn: () => booksApi.byId(id), enabled: !!id });
  const addMutation = useMutation({
    mutationFn: () => cartApi.addItem({ bookId: id, quantity: 1 }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });
  const wishlistMutation = useMutation({
    mutationFn: () => booksApi.addToWishlist(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users', 'me'] }),
  });
  const book = query.data;
  const cover = book?.coverImage ?? book?.coverUrl;

  return (
    <AppScreen title={t('bookDetail.title')} subtitle={book?.title}>
      <RemoteState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        isEmpty={!book}
        onRetry={() => void query.refetch()}
        emptyTitle={t('bookDetail.notFound')}
        emptyDescription={t('common.empty')}
      >
        <ErrorBoundary>
          {book ? (
            <Card>
              <View style={styles.coverWrap}>
                <BookCover uri={cover} size="hero" style={styles.cover} />
              </View>
              <AppText variant="title" style={styles.title}>{book.title}</AppText>
              {book.author ? <AppText color={colors.textMuted}>{t('bookDetail.author')}: {book.author}</AppText> : null}
              <View style={styles.price}><PriceText value={book.price} currency={book.currency} /></View>
              {book.description ? (
                <View style={styles.description}>
                  <AppText variant="label" color={colors.textMuted}>{t('bookDetail.description')}</AppText>
                  <AppText>{book.description}</AppText>
                </View>
              ) : null}
              {(addMutation.isError || wishlistMutation.isError) ? <ErrorBanner error={addMutation.error ?? wishlistMutation.error} /> : null}
              <Button label={t('bookDetail.addToCart')} onPress={() => addMutation.mutate()} loading={addMutation.isPending} style={styles.action} />
              {authStatus === 'authenticated' ? <Button label={t('bookDetail.wishlist')} onPress={() => wishlistMutation.mutate()} loading={wishlistMutation.isPending} variant="secondary" style={styles.action} /> : null}
              <Button label={t('bookDetail.backToStore')} onPress={() => router.push('/(tabs)/store')} variant="ghost" style={styles.action} />
            </Card>
          ) : null}
        </ErrorBoundary>
      </RemoteState>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  /** Centres the cover at its fixed width instead of stretching it edge to edge. */
  coverWrap: { alignItems: 'center', marginBottom: 18 },
  cover: { maxWidth: 320 },
  title: { marginBottom: 6 },
  price: { marginTop: 14 },
  description: { marginTop: 20, gap: 8 },
  action: { marginTop: 12 },
});
