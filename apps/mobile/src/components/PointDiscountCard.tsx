import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { useTheme } from '@/providers/ThemeProvider';

export interface PointDiscountInfo {
  /** The caller's balance. */
  points: number;
  /** Percentage applied to the order subtotal right now. */
  discountPercent: number;
  /** Balance the active tier starts at. */
  tierPoints: number;
  nextTierPoints: number | null;
  nextTierPercent: number | null;
  pointsToNextTier: number;
  tiers: Array<{
    tier: { points: number; discountPercent: number; label?: string };
    reached: boolean;
    current: boolean;
  }>;
}

/**
 * The loyalty ladder: what discount the balance earns today and how many points
 * are left until the next one. Shown in the store and in the cart so the saving
 * is visible before checkout.
 */
export function PointDiscountCard({ info, style }: { info?: PointDiscountInfo; style?: object }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!info) return null;

  const hasDiscount = info.discountPercent > 0;
  const next = info.nextTierPoints;

  return (
    <Card style={style}>
      <View style={styles.header}>
        <AppText variant="subtitle" color={colors.primary}>{t('store.pointsDiscount')}</AppText>
        <AppText variant="title" color={hasDiscount ? colors.success : colors.textMuted}>
          {hasDiscount ? `-${info.discountPercent}%` : t('store.noDiscountYet')}
        </AppText>
      </View>

      <AppText color={colors.textMuted} style={styles.body}>
        {t('store.yourPoints', { points: new Intl.NumberFormat('az-AZ').format(info.points) })}
      </AppText>

      {hasDiscount ? (
        <View style={[styles.active, { backgroundColor: colors.surfaceElevated }]}>
          <AppText variant="label" color={colors.success}>
            {t('store.activeDiscount', { percent: info.discountPercent, points: new Intl.NumberFormat('az-AZ').format(info.tierPoints) })}
          </AppText>
        </View>
      ) : null}

      {next ? (
        <AppText variant="caption" color={colors.textMuted} style={styles.next}>
          {t('store.nextTier', {
            points: new Intl.NumberFormat('az-AZ').format(next),
            percent: info.nextTierPercent ?? 0,
            missing: new Intl.NumberFormat('az-AZ').format(info.pointsToNextTier),
          })}
        </AppText>
      ) : hasDiscount ? (
        <AppText variant="caption" color={colors.success} style={styles.next}>{t('store.bestTierReached')}</AppText>
      ) : null}

      {/* Rungs, cheapest requirement first; the active one is highlighted. */}
      {info.tiers.length ? (
        <View style={styles.ladder}>
          {info.tiers.map(({ tier, reached, current }) => (
            <Pressable
              key={tier.points}
              disabled
              style={[
                styles.rung,
                {
                  backgroundColor: current ? colors.primary : reached ? colors.surfaceElevated : 'transparent',
                  borderColor: current ? colors.primary : colors.border,
                },
              ]}
            >
              <AppText variant="caption" color={current ? colors.primaryContrast : colors.textMuted}>
                {new Intl.NumberFormat('az-AZ').format(tier.points)}
              </AppText>
              <AppText variant="label" color={current ? colors.primaryContrast : reached ? colors.success : colors.text}>
                {tier.discountPercent}%
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  body: { marginTop: 4 },
  active: { marginTop: 12, borderRadius: 12, padding: 10 },
  next: { marginTop: 10 },
  ladder: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  rung: { minWidth: 62, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
});