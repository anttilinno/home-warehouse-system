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

// ["me"] — the signed-in user's profile AND every preference derived from it
// (language, regional formats, notifications, show-archived). Sixteen call
// sites read it, so this has to be set once here rather than per-component.
//
// It must never be served stale from the persisted cache. App.tsx sets no
// shouldDehydrateQuery, so every query is written to IndexedDB, and that write
// is throttled — save a setting and reload straight away and the restore hands
// back the PRE-EDIT value, which the 30 s staleTime above then treats as fresh.
// refetchOnWindowFocus is off too, so nothing corrects it until something
// remounts: the UI shows the old name, or silently reverts to the old
// language. Two e2e specs caught exactly that.
//
// staleTime 0 only forces revalidation on mount; the persisted copy is still
// served instantly as placeholder data and still works offline (the refetch
// just fails and the cached value stands).
queryClient.setQueryDefaults(["me"], { staleTime: 0 });
