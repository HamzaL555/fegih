import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { getSharedLocation, peekSharedLocation } from '@/services/location';

export function useUserLocation() {
  const [location, setLocation] = useState<Location.LocationObject | undefined>(peekSharedLocation);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      setLocation(await getSharedLocation());
    } catch (caught) {
      setLocation(undefined);
      setError(caught);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { location, isLoading, error, retry: load };
}
