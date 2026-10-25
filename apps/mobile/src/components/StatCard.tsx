import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useTheme } from '@/providers/ThemeProvider';
import { formatNumber } from '@/utils/format';

export function StatCard({ label, value, unit }: { label: string; value?: number; unit?: string }) {
  const { colors } = useTheme();
  const display = formatNumber(value) ?? '—';
  return (
    <Card style={styles.card}>
      <AppText variant="caption" color={colors.textMuted}>{label}</AppText>
      <AppText variant="title" color={colors.primary} style={styles.value}>{display}</AppText>
      {unit ? <AppText variant="caption" color={colors.textMuted}>{unit}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 100, padding: 13 },
  value: { marginVertical: 4 },
});
