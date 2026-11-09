import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { AppScreen, ScreenSection } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { AuthRequired } from '@/components/AuthRequired';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ProgressBar } from '@/components/ProgressBar';
import { RemoteState } from '@/components/RemoteState';
import { certificatesApi } from '@/api';
import { useRemoteQuery } from '@/hooks/useRemoteQuery';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuthStore } from '@/store/authStore';

export default function CertificateScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const certificateQuery = useRemoteQuery({
    queryKey: ['certificates'],
    queryFn: () => certificatesApi.list(),
    enabled: status === 'authenticated',
  });

  const issueMutation = useMutation({
    mutationFn: () => certificatesApi.issue(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['certificates'] });
      void queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  if (status !== 'authenticated') {
    return (
      <AppScreen title={t('certificates.title')} subtitle={t('certificates.subtitle')}>
        <AuthRequired />
      </AppScreen>
    );
  }

  const result = certificateQuery.data;
  const certificate = result?.certificates[0];
  const progress = result?.progress;
  const level = progress?.bestLevel ?? 0;
  const requiredLevel = progress?.requiredLevel ?? 15;
  const score = progress?.bestScore ?? 0;
  const requiredScore = progress?.requiredScore ?? 1200;

  return (
    <AppScreen
      title={t('certificates.title')}
      subtitle={t('certificates.subtitle')}
      refreshing={certificateQuery.isRefetching}
      onRefresh={() => void certificateQuery.refetch()}
    >
      <RemoteState
        isLoading={certificateQuery.isPending}
        isError={certificateQuery.isError}
        error={certificateQuery.error}
        onRetry={() => void certificateQuery.refetch()}
      >
        {certificate ? (
          <Card style={[styles.sheet, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
            <AppText variant="label" color={colors.primary} style={styles.kicker}>
              FƏQİH
            </AppText>
            <AppText variant="title" color={colors.primary} style={styles.heading}>
              {t('certificates.earned')}
            </AppText>
            <View style={[styles.rule, { backgroundColor: colors.gold ?? colors.primary }]} />
            <AppText color={colors.textMuted} style={styles.centered}>
              {t('certificates.awardedTo')}
            </AppText>
            <AppText variant="title" style={[styles.name, { color: colors.text }]}>
              {certificate.recipientName}
            </AppText>
            <AppText color={colors.text} style={styles.centered}>
              {certificate.achievement}
            </AppText>
            <View style={[styles.meta, { borderTopColor: colors.border }]}>
              <View style={styles.metaItem}>
                <AppText variant="caption" color={colors.textMuted}>{t('certificates.issuedAtLabel')}</AppText>
                <AppText>{new Date(certificate.issuedAt).toLocaleDateString()}</AppText>
              </View>
              <View style={styles.metaItem}>
                <AppText variant="caption" color={colors.textMuted}>{t('certificates.scoreLabel')}</AppText>
                <AppText>{certificate.score} / {requiredScore}</AppText>
              </View>
            </View>
            <AppText variant="caption" color={colors.textMuted} style={styles.id}>
              {t('certificates.idLabel')}: {certificate.id}
            </AppText>
            <Button
              label={t('certificates.print')}
              onPress={() => void Linking.openURL(certificatesApi.fileUrl(certificate.id))}
              style={styles.button}
            />
          </Card>
        ) : (
          <Card>
            <AppText variant="subtitle">{t('certificates.locked')}</AppText>
            <AppText color={colors.textMuted} style={styles.description}>
              {t('certificates.lockedDescription')}
            </AppText>
            <AppText color={colors.textMuted} style={styles.progressLabel}>
              {t('certificates.levelValue', { level, required: requiredLevel })}
            </AppText>
            <ProgressBar value={level} target={requiredLevel} />
            <AppText color={colors.textMuted} style={styles.progressLabel}>
              {t('certificates.scoreValue', { score, required: requiredScore })}
            </AppText>
            <ProgressBar value={score} target={requiredScore} />
            {result?.eligible ? (
              <Button
                label={t('certificates.issue')}
                onPress={() => issueMutation.mutate()}
                loading={issueMutation.isPending}
                style={styles.button}
              />
            ) : null}
          </Card>
        )}
      </RemoteState>

      {issueMutation.isError ? <ErrorBanner error={issueMutation.error} onDismiss={() => issueMutation.reset()} /> : null}

      <ScreenSection>
        <AppText variant="caption" color={colors.textMuted}>
          {t('certificates.hint')}
        </AppText>
      </ScreenSection>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sheet: { borderWidth: 2, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center' },
  kicker: { letterSpacing: 6, marginBottom: 8 },
  heading: { textAlign: 'center' },
  rule: { width: 96, height: 3, borderRadius: 2, marginVertical: 16 },
  centered: { textAlign: 'center', marginTop: 6 },
  name: { textAlign: 'center', marginTop: 10, marginBottom: 8 },
  meta: { flexDirection: 'row', gap: 24, borderTopWidth: 1, marginTop: 22, paddingTop: 14, width: '100%', justifyContent: 'center', flexWrap: 'wrap' },
  metaItem: { alignItems: 'center', minWidth: 110 },
  id: { marginTop: 12 },
  button: { marginTop: 18, alignSelf: 'stretch' },
  description: { marginTop: 8, lineHeight: 21 },
  progressLabel: { marginTop: 14, marginBottom: 6 },
});
