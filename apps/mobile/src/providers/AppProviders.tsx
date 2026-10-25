import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useEffect } from 'react';
import { I18nManager } from 'react-native';

import '@/i18n';

import { changeLocale, detectLocale } from '@/i18n';
import { queryClient } from '@/api/queryClient';
import { subscribeToAuthEvents } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';

function AuthBootstrap({ children }: PropsWithChildren) {
  const hydrate = useAuthStore((state) => state.hydrate);
  const clear = useAuthStore((state) => state.clear);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(
    () =>
      subscribeToAuthEvents((event) => {
        if (event === 'expired') {
          clear();
        }
      }),
    [clear],
  );

  return children;
}

/**
 * Applies the persisted locale once the zustand store has rehydrated from
 * AsyncStorage. Without this the app always starts in the *device* language,
 * so a saved choice looked like it had been ignored.
 */
function LocaleSync() {
  const locale = usePreferencesStore((state) => state.locale);
  const hasHydrated = usePreferencesStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    const target = locale === 'system' ? detectLocale() : locale;
    void changeLocale(target);
    I18nManager.allowRTL(true);
    // `forceRTL` only takes effect after a reload; doing it on every mount
    // would restart the app in a loop.
    if (!I18nManager.isRTL) I18nManager.allowRTL(true);
  }, [hasHydrated, locale]);

  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationProvider>
          <LocaleSync />
          <AuthBootstrap>{children}</AuthBootstrap>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
