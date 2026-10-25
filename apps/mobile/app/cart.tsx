import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { PriceText } from '@/components/PriceText';
import { RemoteState } from '@/components/RemoteState';
import { cartApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';

export default function CartScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const [error, setError] = useState<unknown>();
  const query = useRemoteQuery({ queryKey: ['cart'], queryFn: () => cartApi.get(), enabled: status === 'authenticated' });
  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => cartApi.updateItem(id, { quantity }),
    onSuccess: () => { setError(undefined); void queryClient.invalidateQueries({ queryKey: ['cart'] }); },
    onError: setError,
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => cartApi.removeItem(id),
    onSuccess: () => { setError(undefined); void queryClient.invalidateQueries({ queryKey: ['cart'] }); },
    onError: setError,
  });
  const clearMutation = useMutation({
    mutationFn: cartApi.clear,
    onSuccess: () => { setError(undefined); void queryClient.invalidateQueries({ queryKey: ['cart'] }); },
    onError: setError,
  });
  if (status !== 'authenticated') return <AppScreen title={t('cart.title')}><AuthRequired /></AppScreen>;
  const cart = query.data;
  const items = cart?.items ?? [];

  return (
    <AppScreen title={t('cart.title')} subtitle={t('store.cart')} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <RemoteState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        isEmpty={items.length === 0}
        onRetry={() => void query.refetch()}
        emptyTitle={t('cart.empty')}
        emptyDescription={t('store.cartEmpty')}
      >
        <View style={styles.list}>
          {items.map((item) => {
            const title = item.book?.title ?? item.title ?? item.bookId;
            const itemId = item.id;
            return (
              <Card key={itemId}>
                <View style={styles.row}>
                  <View style={styles.info}>
                    <AppText variant="subtitle">{title}</AppText>
                    <PriceText value={item.unitPrice ?? item.price} currency={item.currency ?? item.book?.currency} />
                    <AppText variant="caption" color={colors.textMuted}>{t('cart.itemCount')}: {item.quantity}</AppText>
                  </View>
                  <View style={styles.actions}>
                    <Button label="−" onPress={() => updateMutation.mutate({ id: itemId, quantity: Math.max(1, item.quantity - 1) })} variant="ghost" style={styles.smallButton} />
                    <Button label="+" onPress={() => updateMutation.mutate({ id: itemId, quantity: item.quantity + 1 })} variant="ghost" style={styles.smallButton} />
                    <Button label={t('common.remove')} onPress={() => removeMutation.mutate(itemId)} variant="danger" style={styles.removeButton} />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </RemoteState>
      {cart && items.length > 0 ? (
        <Card style={styles.summary}>
          <View style={styles.summaryRow}>
            <AppText color={colors.textMuted}>{t('cart.subtotal')}</AppText>
            <PriceText value={cart.subtotal} currency={cart.currency} />
          </View>
          {/* Loyalty tier: the saving is shown before checkout, not after. */}
          {cart.pointDiscount ? (
            <View style={styles.summaryRow}>
              <AppText color={colors.success}>
                {t('cart.pointsDiscount', { percent: cart.discountPercent ?? 0 })}
              </AppText>
              <PriceText value={-cart.pointDiscount} currency={cart.currency} />
            </View>
          ) : cart.nextTierPoints ? (
            <AppText variant="caption" color={colors.textMuted}>
              {t('cart.nextTier', {
                points: new Intl.NumberFormat('az-AZ').format(cart.nextTierPoints),
                percent: cart.nextTierPercent ?? 0,
                missing: new Intl.NumberFormat('az-AZ').format(cart.pointsToNextTier ?? 0),
              })}
            </AppText>
          ) : null}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <AppText variant="subtitle">{t('cart.total')}</AppText>
            <PriceText value={cart.total ?? cart.subtotal} currency={cart.currency} />
          </View>
          <Button label={t('cart.checkout')} onPress={() => router.push('/checkout' as never)} style={styles.checkout} />
          <Button label={t('cart.clear')} onPress={() => clearMutation.mutate()} variant="ghost" />
        </Card>
      ) : null}
      {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  info: { flex: 1, gap: 5 },
  actions: { justifyContent: 'center', gap: 4, alignItems: 'stretch' },
  smallButton: { minHeight: 36, paddingHorizontal: 12 },
  removeButton: { minHeight: 36 },
  summary: { marginTop: 18, gap: 10 },
  checkout: { marginTop: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.25)', paddingTop: 10, marginTop: 10 },
});
