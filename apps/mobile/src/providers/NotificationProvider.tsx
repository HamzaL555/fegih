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
    });
    return () => {
      mounted = false;
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync();
    const permission =
      current.status === 'granted'
        ? current
        : await Notifications.requestPermissionsAsync();
    const granted = permission.granted;
    setPermissionGranted(granted);
    return granted;
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
