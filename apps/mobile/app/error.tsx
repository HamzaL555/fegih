import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useTheme } from '@/providers/ThemeProvider';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <ErrorBoundary>
      <AppScreen title={t('errors.errorTitle')} subtitle={t('errors.server')}>
        <View style={styles.container}>
          <AppText variant="subtitle" color={colors.danger} style={styles.title}>
            {t('errors.errorTitle')}
          </AppText>
          <AppText color={colors.textMuted} style={styles.message}>
            {error.message ?? t('errors.generic')}
          </AppText>
          <Button label={t('common.retry')} onPress={reset} variant="secondary" style={styles.button} />
          <Button label={t('common.back')} onPress={() => void router.replace('/')} variant="ghost" style={styles.backButton} />
        </View>
      </AppScreen>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center' },
  title: { marginBottom: 8 },
  message: { textAlign: 'center', marginBottom: 20 },
  button: { marginBottom: 10, width: '100%' },
  backButton: { width: '100%' },
});
