import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AppLocale, ThemeMode } from '@/types/domain';

export interface NotificationPreferences {
  enabled: boolean;
  quiz: boolean;
  prayerTimes: boolean;
  rewards: boolean;
  missions: boolean;
}

interface PreferencesState {
  themeMode: ThemeMode;
  locale: AppLocale | 'system';
  notifications: NotificationPreferences;
  setThemeMode: (themeMode: ThemeMode) => void;
  setLocale: (locale: AppLocale | 'system') => void;
  setNotificationPreference: (key: keyof NotificationPreferences, value: boolean) => void;
  setNotifications: (value: Partial<NotificationPreferences>) => void;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
}

const defaultNotifications: NotificationPreferences = {
  enabled: true,
  quiz: true,
  prayerTimes: true,
  rewards: true,
  missions: true,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      locale: 'system',
      notifications: defaultNotifications,
      hasHydrated: false,
      setThemeMode: (themeMode) => set({ themeMode }),
      setLocale: (locale) => set({ locale }),
      setNotificationPreference: (key, value) =>
        set((state) => ({ notifications: { ...state.notifications, [key]: value } })),
      setNotifications: (value) =>
        set((state) => ({ notifications: { ...state.notifications, ...value } })),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'fegih-safe-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        themeMode: state.themeMode,
        locale: state.locale,
        notifications: state.notifications,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
