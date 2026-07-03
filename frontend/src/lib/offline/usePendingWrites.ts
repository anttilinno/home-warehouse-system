import { useMutationState } from "@tanstack/react-query";

// Offline-first PWA Phase 4: count queued offline writes for the TopBar
// pending badge. A mutation with status:"pending" is either genuinely
// in-flight OR paused (networkMode:"online" pauses it while offline —
// PersistQueryClientProvider dehydrates paused mutations, see
// mutationDefaults.ts). `isPaused` is the only field that tells them apart, so
// select it and count the `true`s rather than trusting status alone.
export function usePendingWrites(): number {
  const paused = useMutationState({
    filters: { status: "pending" },
    select: (m) => m.state.isPaused,
  });
  return paused.filter(Boolean).length;
}
