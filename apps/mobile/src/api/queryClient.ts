import { QueryClient } from '@tanstack/react-query';

/**
 * Single module-level instance so the auth store can drop every cached query on
 * logout / token expiry. A client created inside React could not be reached from
 * non-React code, which previously left the previous user's profile, cart and
 * orders visible to the next person using the device.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // One retry keeps a flaky request from doubling the wait, while still
      // recovering from a single dropped packet.
      retry: 1,
      /**
       * Short, because the admin panel edits the same rows the app reads. At
       * five minutes a price or a question changed in the panel stayed invisible
       * on the phone for that long, which felt like two separate products. A
       * minute plus a refetch whenever a screen is opened or the app returns
       * to the foreground means a change shows up almost immediately.
       *
       * Screens with immutable data (the Quran, the question bank) pass a
       * longer `staleTime` of their own.
       */
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Refetch a screen that is opened again while its data is already stale.
      refetchOnMount: true,
    },
    mutations: { retry: 0 },
  },
});
