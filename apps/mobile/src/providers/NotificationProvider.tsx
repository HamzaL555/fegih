import * as Notifications from 'expo-notifications';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useState } from 'react';

interface NotificationContextValue {
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function NotificationProvider({ children }: PropsWithChildren) {
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Notifications.getPermissionsAsync().then((permission) => {
      if (mounted) {
        setPermissionGranted(permission.granted);
      }
    }).catch((error) => {
      // A missing permission bridge must not crash the app; leave the banner
      // in its "permission required" state and keep the cause in the logs.
      console.warn('[Fegih] Could not read notification permission:', error);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      const permission =
        current.status === 'granted'
          ? current
          : await Notifications.requestPermissionsAsync();
      const granted = permission.granted;
      setPermissionGranted(granted);
      return granted;
    } catch (error) {
      // Callers treat `false` as "the user did not grant it" and keep the
      // toggle off; log the real cause so a native failure is diagnosable.
      console.warn('[Fegih] Could not request notification permission:', error);
      return false;
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ permissionGranted, requestPermission }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationPermission(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationPermission must be used inside NotificationProvider');
  }
  return context;
}
