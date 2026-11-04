import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { AppProviders } from '@/providers/AppProviders';
import { useTheme } from '@/providers/ThemeProvider';

function Navigation() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // Pushed screens slide in from the trailing edge, which reads as
          // "going deeper". Modals still come from the bottom via their own
          // `presentation`.
          animation: 'slide_from_right',
          animationDuration: 260,
        }}
      >
        {/* Tabs sit at the root, so entering the app should feel like rising
            into the tab bar rather than sliding a page over it. */}
        <Stack.Screen name="(tabs)" options={{ title: t('common.appName'), animation: 'fade_from_bottom', animationDuration: 220 }} />
        <Stack.Screen name="auth/welcome" options={{ headerShown: false, animation: 'fade_from_bottom', animationDuration: 220 }} />
        <Stack.Screen name="auth/index" options={{ presentation: 'modal', title: t('auth.loginTitle'), animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/login" options={{ title: t('auth.loginTitle') }} />
        <Stack.Screen name="auth/register" options={{ title: t('auth.registerTitle') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <Navigation />
    </AppProviders>
  );
}
