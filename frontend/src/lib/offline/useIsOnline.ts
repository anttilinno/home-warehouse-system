import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

// Offline-first PWA Phase 4: the TRUE browser network state (TanStack's
// onlineManager already wraps navigator.onLine + the online/offline window
// events — same source useResumeOnReconnect subscribes to). Distinct from SSE
// `connected`: a dropped EventSource on a healthy network is NOT "offline".
// SSR/initial fallback is `true` (Subscribable.subscribe is pre-bound in
// query-core, so passing it directly is safe — no `this` loss).
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
}
