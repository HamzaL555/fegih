import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ar from './locales/ar.json';
import az from './locales/az.json';
import en from './locales/en.json';
import tr from './locales/tr.json';

export const supportedLocales = ['az', 'tr', 'en', 'ar'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const resources = {
  az: { translation: az },
  tr: { translation: tr },
  en: { translation: en },
  ar: { translation: ar },
} as const;

export function detectLocale(): SupportedLocale {
  const locale = Localization.getLocales()[0]?.languageCode?.toLowerCase();
  if (locale === 'az' || locale === 'tr' || locale === 'ar' || locale === 'en') {
    return locale;
  }
  return 'en';
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectLocale(),
    fallbackLng: 'en',
    supportedLngs: supportedLocales,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export function changeLocale(locale: SupportedLocale): Promise<unknown> {
  return i18n.changeLanguage(locale);
}

export default i18n;
