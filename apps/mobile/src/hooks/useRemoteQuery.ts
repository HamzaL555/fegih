import { useQuery, type QueryKey } from '@tanstack/react-query';

interface RemoteQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnMount?: boolean | 'always';
  /** Poll interval in ms. `false` disables it (the default). */
  refetchInterval?: number | false;
  /** Keep polling while the app is backgrounded. Off by default. */
  refetchIntervalInBackground?: boolean;
}

export function useRemoteQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime,
  gcTime,
  refetchOnMount,
  refetchInterval,
  refetchIntervalInBackground,
}: RemoteQueryOptions<T>) {
  return useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    gcTime,
    refetchOnMount,
    refetchInterval,
    refetchIntervalInBackground,
  });
}
