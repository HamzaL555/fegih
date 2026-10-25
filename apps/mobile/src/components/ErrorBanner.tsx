import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/providers/ThemeProvider';
import { getErrorMessage, isNetworkError, networkErrorMessage } from '@/utils/errors';

export function ErrorBanner({ error, onDismiss }: { error: unknown; onDismiss?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const network = isNetworkError(error);
  const message = network
    ? networkErrorMessage(error, t)
    : getErrorMessage(error, t('errors.generic'));
  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceElevated, borderColor: colors.danger }]}>
      <AppText color={colors.danger} style={styles.text}>{message}</AppText>
      {onDismiss ? (
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <AppText variant="label" color={colors.primary}>{t('common.close')}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, marginRight: 10 },
});
