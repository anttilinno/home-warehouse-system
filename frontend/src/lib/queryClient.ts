import { QueryClient } from "@tanstack/react-query";

// Singleton QueryClient ported verbatim from v2.1 Plan 56-01 (commit 4d4c233).
// The v2.1 defaults are the locked v3.0 baseline: 30 s freshness, one retry,
// no refetch on window focus, mutations never retry. gcTime is Infinity
// (offline-first PWA Phase 1): PersistQueryClientProvider's `maxAge` is what
// now governs how long persisted data survives, and gcTime must be >= maxAge
// or restored queries get garbage-collected before they're ever read.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
