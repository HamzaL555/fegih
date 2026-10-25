import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePreferencesStore } from '@/store/preferencesStore';
import type { AppLocale } from '@/types/domain';

/**
 * The language the user picked in Settings, resolved to a concrete locale.
 *
 * `locale: 'system'` (or anything unknown) falls back to whatever i18next
 * actually resolved, so the Quran translation always matches the language the
 * interface is actually showing.
 */
export function useAppLocale(): AppLocale {
  const { i18n } = useTranslation();
  const preference = usePreferencesStore((state) => state.locale);

  return useMemo(() => {
    if (preference !== 'system') return preference;
    const active = i18n.resolvedLanguage ?? i18n.language ?? '';
    const base = active.split(/[-_]/)[0]?.toLowerCase() ?? '';
    return (['az', 'tr', 'en', 'ar'] as const).find((candidate) => candidate === base) ?? 'az';
  }, [preference, i18n.resolvedLanguage, i18n.language]);
}
