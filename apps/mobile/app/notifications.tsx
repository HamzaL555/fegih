import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ListRow } from '@/components/ListRow';
import { RemoteState } from '@/components/RemoteState';
import { notificationsApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const [error, setError] = useState<unknown>();
  const query = useRemoteQuery({ queryKey: ['notifications'], queryFn: () => notificationsApi.list({ page: 1, limit: 50 }), enabled: status === 'authenticated' });
  const readMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => { setError(undefined); void queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
    onError: setError,
  });
  const allMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => { setError(undefined); void queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
    onError: setError,
  });

  if (status !== 'authenticated') return <AppScreen title={t('notifications.title')}><AuthRequired /></AppScreen>;

  return (
    <AppScreen title={t('notifications.title')} subtitle={t('notifications.subtitle')} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Button label={t('notifications.markAllRead')} onPress={() => allMutation.mutate()} loading={allMutation.isPending} variant="secondary" style={styles.markAll} />
      <RemoteState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        isEmpty={query.data?.data.length === 0}
        onRetry={() => void query.refetch()}
        emptyTitle={t('notifications.noNotifications')}
        emptyDescription={t('common.empty')}
      >
        <Card style={styles.list}>
          {query.data?.data.map((notification) => (
            <ListRow key={notification.id}>
              <View style={styles.row}>
                <View style={styles.text}>
                  <AppText variant="subtitle" color={notification.read ? colors.textMuted : colors.text}>{notification.title}</AppText>
                  {notification.body || notification.message ? <AppText color={colors.textMuted}>{notification.body ?? notification.message}</AppText> : null}
                  {!notification.read ? <AppText variant="caption" color={colors.primary}>{t('notifications.unread')}</AppText> : null}
                </View>
                {!notification.read ? <Button label={t('notifications.markRead')} onPress={() => readMutation.mutate(notification.id)} variant="ghost" /> : null}
              </View>
            </ListRow>
          ))}
        </Card>
      </RemoteState>
      {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  markAll: { marginBottom: 14 },
  list: { paddingHorizontal: 16, paddingVertical: 4 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, gap: 4 },
});
