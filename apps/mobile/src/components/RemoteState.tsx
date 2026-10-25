import { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTheme } from '@/providers/ThemeProvider';
import { getErrorMessage } from '@/utils/errors';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLabel={label ?? t('remote.loading')}>
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText color={colors.textMuted} style={styles.message}>{label ?? t('remote.loading')}</AppText>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card style={styles.stateCard}>
      <AppText variant="subtitle" color={colors.danger}>{t('remote.errorTitle')}</AppText>
      <AppText color={colors.textMuted} style={styles.message}>{getErrorMessage(error, t('errors.generic'))}</AppText>
      <Button label={t('common.retry')} onPress={onRetry} variant="secondary" />
    </Card>
  );
}

export function EmptyState({ title, description }: { title?: string; description?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card style={styles.stateCard}>
      <AppText variant="subtitle" color={colors.text}>{title ?? t('remote.emptyTitle')}</AppText>
      <AppText color={colors.textMuted} style={styles.message}>{description ?? t('common.empty')}</AppText>
    </Card>
  );
}

export interface RemoteStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry: () => void;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function RemoteState({
  isLoading,
  isError,
  error,
  isEmpty = false,
  onRetry,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  children,
}: PropsWithChildren<RemoteStateProps>) {
  if (isLoading) {
    return <LoadingState label={loadingLabel} />;
  }
  if (isError) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }
  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateCard: { marginTop: 12 },
  message: { marginVertical: 12 },
});
