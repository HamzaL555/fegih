import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/providers/ThemeProvider';
import { formatCurrency } from '@/utils/format';

export function PriceText({ value, currency }: { value?: number; currency?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const formatted = formatCurrency(value, currency);
  return <AppText color={colors.primary}>{formatted ?? t('common.notAvailable')}</AppText>;
}
