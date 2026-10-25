import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/providers/ThemeProvider';
import type { PageMeta } from '@/types/api';

export function PageMetaText({ meta }: { meta?: PageMeta }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!meta) return null;
  return (
    <View style={styles.row}>
      <AppText variant="caption" color={colors.textMuted}>
        {t('common.page')} {meta.page} {t('common.of')} {meta.totalPages}
      </AppText>
      <AppText variant="caption" color={colors.textMuted}>{meta.total}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});
