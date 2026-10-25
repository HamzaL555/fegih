import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { RemoteState } from '@/components/RemoteState';
import { rewardsApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';

export default function RewardsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const [error, setError] = useState<unknown>();
  const [success, setSuccess] = useState<string>();
  const query = useRemoteQuery({ queryKey: ['rewards'], queryFn: () => rewardsApi.list(), enabled: status === 'authenticated' });
  const claimMutation = useMutation({
    mutationFn: (id: string) => rewardsApi.claim(id),
    onSuccess: () => {
      setError(undefined);
      setSuccess(t('rewards.rewardClaimed'));
      void queryClient.invalidateQueries({ queryKey: ['rewards'] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: setError,
  });

  if (status !== 'authenticated') {
    return <AppScreen title={t('rewards.title')} subtitle={t('rewards.subtitle')}><AuthRequired /></AppScreen>;
  }

  return (
    <AppScreen title={t('rewards.title')} subtitle={t('rewards.subtitle')} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <RemoteState
        isLoading={query.isPending}
        isError={query.isError}
        error={query.error}
        isEmpty={query.data?.data.length === 0}
        onRetry={() => void query.refetch()}
        emptyTitle={t('rewards.noRewards')}
        emptyDescription={t('common.empty')}
      >
        <View style={styles.list}>
          {query.data?.data.map((reward) => (
            <Card key={reward.id}>
              <View style={styles.row}>
                <View style={styles.text}>
                  <AppText variant="subtitle">{reward.title}</AppText>
                  {reward.description ? <AppText color={colors.textMuted} style={styles.description}>{reward.description}</AppText> : null}
                </View>
                {reward.icon ? <AppText variant="title">{reward.icon}</AppText> : null}
              </View>
              <View style={styles.footer}>
                <AppText color={colors.primary}>{t('rewards.pointsRequired')}: {reward.pointsCost}</AppText>
                <Button
                  label={reward.claimed ? t('rewards.claimed') : t('rewards.claim')}
                  onPress={() => claimMutation.mutate(reward.id)}
                  disabled={reward.claimed}
                  loading={claimMutation.isPending && claimMutation.variables === reward.id}
                />
              </View>
            </Card>
          ))}
        </View>
      </RemoteState>
      {user?.points !== undefined ? <AppText color={colors.textMuted} style={styles.balance}>{t('home.pointsBalance')}: {user.points}</AppText> : null}
      {error ? <ErrorBanner error={error} onDismiss={() => setError(undefined)} /> : null}
      {success ? <AppText color={colors.success} style={styles.success}>{success}</AppText> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  text: { flex: 1, paddingRight: 10 },
  description: { marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 },
  balance: { marginTop: 18 },
  success: { marginTop: 12 },
});
