import { describe, expect, it } from "vitest";
import { get } from "idb-keyval";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { CACHE_BUSTER, persister, purgePersistedCache } from "./persister";

// fake-indexeddb/auto is installed globally in src/test/setup.ts, so the real
// idb-keyval calls inside persister.ts hit a real (in-memory) IndexedDB here.

function makeClient(): PersistedClient {
  return {
    timestamp: 1,
    buster: CACHE_BUSTER,
    clientState: { queries: [], mutations: [] },
  };
}

describe("persister — IndexedDB round-trip (fake-indexeddb)", () => {
  it("restoreClient returns undefined before anything has been persisted", async () => {
    await expect(persister.restoreClient()).resolves.toBeUndefined();
  });

  it("round-trips a persisted client through IndexedDB, then removeClient purges it", async () => {
    const client = makeClient();

    await persister.persistClient(client);
    await expect(persister.restoreClient()).resolves.toEqual(client);
    // guards the documented single-key contract (persister.ts: CACHE_KEY = "hws-rq-cache").
    // createAsyncStoragePersister JSON-serializes before handing it to storage.setItem.
    await expect(get("hws-rq-cache")).resolves.toEqual(JSON.stringify(client));

    await purgePersistedCache();

    await expect(persister.restoreClient()).resolves.toBeUndefined();
    await expect(get("hws-rq-cache")).resolves.toBeUndefined();
  });
});
