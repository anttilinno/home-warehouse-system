import { QueryClient } from "@tanstack/react-query";

// Singleton QueryClient ported verbatim from v2.1 Plan 56-01 (commit 4d4c233).
// The v2.1 defaults are the locked v3.0 baseline: 30 s freshness, 5 min cache,
// one retry, no refetch on window focus, mutations never retry.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
