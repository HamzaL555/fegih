import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ProgressBar } from '@/components/ProgressBar';
import { RemoteState } from '@/components/RemoteState';
import { achievementsApi, missionsApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';

export default function MissionsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const status = useAuthStore((state) => state.status);
  const missionsQuery = useRemoteQuery({ queryKey: ['missions'], queryFn: () => missionsApi.list(), enabled: status === 'authenticated' });
  const achievementsQuery = useRemoteQuery({ queryKey: ['achievements'], queryFn: () => achievementsApi.list(), enabled: status === 'authenticated' });

  if (status !== 'authenticated') {
    return <AppScreen title={t('missions.title')} subtitle={t('missions.subtitle')}><AuthRequired /></AppScreen>;
  }

  return (
    <AppScreen title={t('missions.title')} subtitle={t('missions.subtitle')} refreshing={missionsQuery.isRefetching || achievementsQuery.isRefetching} onRefresh={() => { void missionsQuery.refetch(); void achievementsQuery.refetch(); }}>
      <RemoteState
        isLoading={missionsQuery.isPending}
        isError={missionsQuery.isError}
        error={missionsQuery.error}
        isEmpty={missionsQuery.data?.data.length === 0}
        onRetry={() => void missionsQuery.refetch()}
        emptyTitle={t('missions.noMissions')}
        emptyDescription={t('common.empty')}
      >
        <View style={styles.list}>
          {missionsQuery.data?.data.map((mission) => (
            <Card key={mission.id}>
              <View style={styles.row}>
                <View style={styles.text}>
                  <AppText variant="subtitle">{mission.title}</AppText>
                  {mission.description ? <AppText color={colors.textMuted} style={styles.description}>{mission.description}</AppText> : null}
                </View>
                {mission.completed ? <AppText variant="label" color={colors.success}>{t('missions.completed')}</AppText> : null}
              </View>
              <ProgressBar value={mission.progress ?? 0} target={mission.target ?? mission.targetCount ?? 1} />
              {mission.points !== undefined ? <AppText variant="caption" color={colors.primary} style={styles.reward}>{t('missions.points')}: {mission.points}</AppText> : null}
            </Card>
          ))}
        </View>
      </RemoteState>

      <ScreenSection>
        <AppText variant="subtitle" style={styles.sectionTitle}>{t('profile.level')}</AppText>
        <RemoteState
          isLoading={achievementsQuery.isPending}
          isError={achievementsQuery.isError}
          error={achievementsQuery.error}
          isEmpty={achievementsQuery.data?.data.length === 0}
          onRetry={() => void achievementsQuery.refetch()}
          emptyTitle={t('common.empty')}
        >
          <View style={styles.list}>
            {achievementsQuery.data?.data.map((achievement) => (
              <Card key={achievement.id}>
                <View style={styles.row}>
                  <AppText variant="subtitle">{achievement.title}</AppText>
                  {achievement.unlocked ? <AppText variant="label" color={colors.success}>{t('missions.completed')}</AppText> : null}
                </View>
                {achievement.description ? <AppText color={colors.textMuted} style={styles.description}>{achievement.description}</AppText> : null}
                {achievement.progress !== undefined && achievement.target !== undefined ? <ProgressBar value={achievement.progress} target={achievement.target} /> : null}
              </Card>
            ))}
          </View>
        </RemoteState>
        {achievementsQuery.isError ? <ErrorBanner error={achievementsQuery.error} /> : null}
      </ScreenSection>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  text: { flex: 1, paddingRight: 8 },
  description: { marginTop: 6 },
  reward: { marginTop: 10 },
  sectionTitle: { marginBottom: 10 },
});
