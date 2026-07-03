import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

// Query-cache persistence (offline-first PWA, Phase 1). Delegates the
// persist-client-core AsyncStorage contract straight onto idb-keyval's
// default IndexedDB store — one key holds the whole dehydrated cache.
const CACHE_KEY = "hws-rq-cache";

export const persister = createAsyncStoragePersister({
  storage: {
    getItem: () => get(CACHE_KEY),
    setItem: (_key, value) => set(CACHE_KEY, value),
    removeItem: () => del(CACHE_KEY),
  },
  key: CACHE_KEY,
});

// Wipes the persisted cache from IndexedDB. Called on logout (security gate —
// otherwise the next user on the device sees the prior user's data) and
// available for any other "forget everything" path.
export function purgePersistedCache(): Promise<void> {
  return Promise.resolve(persister.removeClient());
}

// Bump this when the persisted cache shape changes incompatibly; a buster
// mismatch makes PersistQueryClientProvider discard the old cache on restore.
export const CACHE_BUSTER = "v1";
