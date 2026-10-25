import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/providers/ThemeProvider';

export function ProgressBar({ value, target }: { value: number; target: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const safeTarget = target > 0 ? target : 1;
  const percentage = Math.min(100, Math.max(0, (value / safeTarget) * 100));
  return (
    <View style={styles.wrapper}>
      <View style={styles.labels}>
        <AppText variant="caption" color={colors.textMuted}>{t('missions.progress')}</AppText>
        <AppText variant="caption" color={colors.textMuted}>{value} / {target}</AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
        <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}

export function PointsPill({ points }: { points?: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.pill, { backgroundColor: colors.surfaceElevated }]}>
      <AppText variant="caption" color={colors.primary}>{points ?? '—'} {t('common.points')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6, marginTop: 10 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
});
