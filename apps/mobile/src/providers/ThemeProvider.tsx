import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type AppColors } from '@/theme/colors';
import { usePreferencesStore } from '@/store/preferencesStore';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const themeMode = usePreferencesStore((state) => state.themeMode);
  // `persist` rehydrates asynchronously. Rendering with the default theme first
  // produced a white flash for dark-mode users on every cold start, so the
  // stored value is only trusted once the store reports hydration.
  const hasHydrated = usePreferencesStore((state) => state.hasHydrated);
  const effectiveMode = hasHydrated ? themeMode : 'system';
  const isDark = effectiveMode === 'dark' || (effectiveMode === 'system' && systemScheme === 'dark');
  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark }),
    [isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
