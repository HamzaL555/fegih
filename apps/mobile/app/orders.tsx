import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Card } from '@/components/Card';
import { PageMetaText } from '@/components/PageMetaText';
import { PriceText } from '@/components/PriceText';
import { RemoteState } from '@/components/RemoteState';
import { ordersApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';

export default function OrdersScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const status = useAuthStore((state) => state.status);
  const query = useRemoteQuery({ queryKey: ['orders'], queryFn: () => ordersApi.list({ page: 1, limit: 50 }), enabled: status === 'authenticated' });

  if (status !== 'authenticated') return <AppScreen title={t('orders.title')}><AuthRequired /></AppScreen>;

  return (
    <AppScreen title={t('orders.title')} subtitle={t('orders.subtitle')} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <RemoteState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        isEmpty={query.data?.data.length === 0}
        onRetry={() => void query.refetch()}
        emptyTitle={t('orders.noOrders')}
        emptyDescription={t('common.empty')}
      >
        <View style={styles.list}>
          {query.data?.data.map((order) => (
            <Card key={order.id}>
              <View style={styles.header}>
                <AppText variant="subtitle">{order.id}</AppText>
                {order.status ? <AppText variant="label" color={colors.primary}>{order.status}</AppText> : null}
              </View>
              <AppText variant="caption" color={colors.textMuted}>{t('orders.orderDate')}: {formatDate(order.createdAt, i18n.language) ?? t('common.notAvailable')}</AppText>
              <View style={styles.items}>
                {order.items?.map((item) => <AppText key={`${order.id}-${item.bookId}`}>{item.title} × {item.quantity}</AppText>)}
              </View>
              <View style={styles.total}>
                <AppText variant="label">{t('orders.orderTotal')}</AppText>
                <PriceText value={order.total} currency={order.currency} />
              </View>
            </Card>
          ))}
        </View>
        {query.data ? <PageMetaText meta={query.data.meta} /> : null}
      </RemoteState>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  items: { marginTop: 12, gap: 5 },
  total: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
});
