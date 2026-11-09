import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { BookCover } from '@/components/BookCover';
import { CartIcon } from '@/components/icons/CartIcon';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageMetaText } from '@/components/PageMetaText';
import { PriceText } from '@/components/PriceText';
import { RemoteState } from '@/components/RemoteState';
import { Reveal } from '@/components/Reveal';
import { TextField } from '@/components/TextField';
import { booksApi, cartApi, categoriesApi, storeApi } from '@/api';
import { PointDiscountCard } from '@/components/PointDiscountCard';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { readPageParam, readParam } from '@/lib/searchParams';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import type { Book, Category } from '@/types/domain';

/** Requested cart accent: a warm yellow so it stands out on both themes. */
const CART_YELLOW = '#F5AE0B';

export default function StoreScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const [cartError, setCartError] = useState<unknown>();

  // URL params persist pagination, category and search so refreshing or sharing
  // the link keeps the same view. `useLocalSearchParams` returns an object.
  const typedParams = searchParams as Record<string, string | string[] | undefined>;
  const page = readPageParam(typedParams);
  const categoryId = readParam(typedParams, 'categoryId') || undefined;
  const search = readParam(typedParams, 'search') || '';

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, next);
      router.replace(`/(tabs)/store?page=${clamped}&categoryId=${categoryId ?? ''}&search=${encodeURIComponent(search)}`);
    },
    [router, categoryId, search],
  );

  const setCategoryId = useCallback(
    (id?: string) => {
      router.replace(`/(tabs)/store?page=1&categoryId=${id ?? ''}&search=${encodeURIComponent(search)}`);
    },
    [router, search],
  );

  const setSearch = useCallback(
    (value: string) => {
      router.replace(`/(tabs)/store?page=1&categoryId=${categoryId ?? ''}&search=${encodeURIComponent(value)}`);
    },
    [router, categoryId],
  );

  /** Loyalty tier: only meaningful for a signed-in shopper. */
  const discountQuery = useRemoteQuery({
    queryKey: ['store', 'point-discount'],
    queryFn: () => storeApi.pointDiscount(),
    enabled: authStatus === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });

  /** Cart count for the header badge. */
  const cartQuery = useRemoteQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get(),
    enabled: authStatus === 'authenticated',
    staleTime: 30 * 1000,
  });
  const cartCount = cartQuery.data?.itemCount ?? 0;

  const categoriesQuery = useRemoteQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });
  const booksQuery = useRemoteQuery({
    queryKey: ['books', page, categoryId, search],
    queryFn: () => booksApi.list({ page, limit: 20, categoryId, search: search || undefined }),
  });
  const addMutation = useMutation({
    mutationFn: (bookId: string) => cartApi.addItem({ bookId, quantity: 1 }),
    onSuccess: () => {
      setCartError(undefined);
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: setCartError,
  });

  const categories = useMemo<Category[]>(() => {
    const value = categoriesQuery.data;
    return Array.isArray(value) ? value : value?.data ?? [];
  }, [categoriesQuery.data]);
  const books = booksQuery.data?.data ?? [];

  const changeCategory = (id?: string) => {
    setCategoryId(id);
  };

  return (
    <AppScreen
      title={t('store.title')}
      subtitle={t('store.subtitle')}
      refreshing={booksQuery.isRefetching}
      onRefresh={() => void booksQuery.refetch()}
    >
      {/* Cart shortcut in the header corner, with the item count as a badge. */}
      <View style={styles.cartButton}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('store.cart')}
          onPress={() => router.push('/cart')}
          style={({ pressed }) => [
            styles.cartIcon,
            { backgroundColor: pressed ? 'rgba(245, 158, 11, 0.25)' : CART_YELLOW },
          ]}
        >
          <CartIcon color="#1F2937" size={22} />
          {cartCount > 0 ? (
            <View style={[styles.cartBadge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
              <AppText variant="caption" color={colors.primaryContrast}>{cartCount > 99 ? '99+' : cartCount}</AppText>
            </View>
          ) : null}
        </Pressable>
      </View>
      <PointDiscountCard info={discountQuery.data} style={styles.discountCard} />
      <TextField
        label={t('store.search')}
        placeholder={t('store.search')}
        value={search}
        onChangeText={(value) => { setSearch(value); }}
        autoCapitalize="none"
      />
      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('store.categories')}</AppText>
        <View style={styles.categoryRow}>
          <CategoryChip label={t('store.all')} selected={!categoryId} onPress={() => changeCategory()} />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              selected={categoryId === category.id}
              onPress={() => changeCategory(category.id)}
            />
          ))}
        </View>
        {categoriesQuery.isError ? <ErrorBanner error={categoriesQuery.error} onDismiss={() => void categoriesQuery.refetch()} /> : null}
      </ScreenSection>

      <RemoteState
        isLoading={booksQuery.isPending}
        isError={booksQuery.isError}
        error={booksQuery.error}
        isEmpty={books.length === 0}
        onRetry={() => void booksQuery.refetch()}
        emptyTitle={t('store.noBooks')}
        emptyDescription={t('common.noResults')}
      >
        <ErrorBoundary>
          <View style={styles.bookList}>
            {(books ?? []).map((book, index) => (
              // Staggered entrance: the shelf fills in rather than appearing all
              // at once, which makes a long catalogue feel shorter.
              <Reveal key={book.id ?? `${index}`} delay={Math.min(index, 8) * 60} distance={16}>
                <BookCard
                  book={book}
                  onDetails={() => router.push({ pathname: '/books/[id]', params: { id: book.id ?? '' } })}
                  onAdd={() => addMutation.mutate(book.id ?? '')}
                  adding={addMutation.isPending && addMutation.variables === book.id}
                />
              </Reveal>
            ))}
          </View>
          {booksQuery.data ? <PageMetaText meta={booksQuery.data.meta ?? undefined} /> : null}
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
              disabled={!booksQuery.data || page >= (booksQuery.data.meta?.totalPages ?? 0)}
              variant="secondary"
              style={styles.pageButton}
            />
          </View>
        </ErrorBoundary>
      </RemoteState>
      {cartError ? <ErrorBanner error={cartError} onDismiss={() => setCartError(undefined)} /> : null}
    </AppScreen>
  );
}

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceElevated, borderColor: selected ? colors.primary : colors.border }]}
    >
      <AppText variant="caption" color={selected ? colors.primaryContrast : colors.text}>{label}</AppText>
    </Pressable>
  );
}

function BookCard({
  book,
  onDetails,
  onAdd,
  adding,
}: {
  book: Book;
  onDetails: () => void;
  onAdd: () => void;
  adding: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cover = book.coverImage ?? book.coverUrl;
  return (
    <Card style={styles.bookCard}>
      <BookCover uri={cover} size="thumb" />
      <View style={styles.bookBody}>
        <AppText variant="subtitle">{book.title}</AppText>
        {book.author ? <AppText variant="caption" color={colors.textMuted}>{book.author}</AppText> : null}
        <View style={styles.bookFooter}>
          <PriceText value={book.price} currency={book.currency} />
          <View style={styles.bookActions}>
            <Button label={t('store.details')} onPress={onDetails} variant="ghost" />
            <Button label={t('store.addToCart')} onPress={onAdd} loading={adding} />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cartButton: { alignSelf: 'flex-end', marginBottom: 14 },
  cartIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  discountCard: { marginBottom: 14 },
  sectionTitle: { marginBottom: 10 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  bookList: { gap: 14 },
  bookCard: { flexDirection: 'row', gap: 12 },
  bookBody: { flex: 1, justifyContent: 'space-between' },
  bookFooter: { gap: 8, marginTop: 10 },
  bookActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  pagination: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pageButton: { flex: 1 },
});
