"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { initDB, getSyncMeta } from "@/lib/db/offline-db";
import { syncWorkspaceData, type SyncResult, type EntityType } from "@/lib/db/sync-operations";
import { syncManager } from "@/lib/sync/sync-manager";
import { getPendingMutationCount } from "@/lib/sync/mutation-queue";

interface OfflineContextValue {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  pendingUploadsCount: number;
  hasPendingUploads: boolean;
  refreshPendingUploads: () => Promise<void>;
  /** Whether the offline IndexedDB database is ready */
  dbReady: boolean;
  /** Whether persistent storage has been granted (prevents Safari eviction) */
  persistentStorage: boolean;
  /** Whether a workspace data sync is currently in progress */
  isSyncing: boolean;
  /** Timestamp of the last successful sync, or null if never synced */
  lastSyncTimestamp: number | null;
  /** Error message from the last sync attempt, if it failed */
  syncError: string | null;
  /** Count of records synced for each entity type */
  syncCounts: Record<EntityType, number> | null;
  /** Manually trigger a workspace data sync */
  triggerSync: () => Promise<void>;
  /** Count of pending offline mutations */
  pendingMutationCount: number;
  /** Whether mutations are currently syncing */
  isMutationSyncing: boolean;
  /** Manually trigger mutation queue processing */
  processMutationQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingUploadsCount, setPendingUploadsCount] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const [persistentStorage, setPersistentStorage] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncCounts, setSyncCounts] = useState<Record<EntityType, number> | null>(null);

  // Mutation queue state
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [isMutationSyncing, setIsMutationSyncing] = useState(false);

  // Track if initial sync has been triggered to prevent double-sync
  const hasInitialSyncTriggered = useRef(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    // Track that we were previously offline (for "back online" message)
    setWasOffline(true);
    // Clear the wasOffline flag after a brief delay
    setTimeout(() => setWasOffline(false), 3000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  // Process mutation queue
  const processMutationQueue = useCallback(async () => {
    if (syncManager) {
      await syncManager.processQueue();
    }
  }, []);

  // Trigger workspace data sync
  const triggerSync = useCallback(async () => {
    // Get workspace ID from localStorage (same pattern as use-workspace.ts)
    const workspaceId = typeof localStorage !== "undefined"
      ? localStorage.getItem("workspace_id")
      : null;

    if (!workspaceId) {
      console.log("[Offline] No workspace selected, skipping sync");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.log("[Offline] Device is offline, skipping sync");
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result: SyncResult = await syncWorkspaceData(workspaceId);

      if (result.success) {
        setLastSyncTimestamp(result.timestamp);
        setSyncCounts(result.counts);
        setSyncError(null);
      } else {
        setSyncError(result.error || "Sync failed");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      setSyncError(errorMessage);
      console.error("[Offline] Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Check pending uploads in IndexedDB
  const refreshPendingUploads = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;

    try {
      const db = await openUploadQueueDB();
      const tx = db.transaction("uploads", "readonly");
      const store = tx.objectStore("uploads");

      const request = store.count();
      request.onsuccess = () => {
        setPendingUploadsCount(request.result);
      };
    } catch {
      // IndexedDB not available or error - silently fail
      setPendingUploadsCount(0);
    }
  }, []);

  // Initialize online status and add event listeners
  useEffect(() => {
    // Set initial state from browser
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Initialize offline database on mount
  useEffect(() => {
    initDB().then(({ dbReady, persistentStorage }) => {
      setDbReady(dbReady);
      setPersistentStorage(persistentStorage);
    });
  }, []);

  // Load last sync timestamp from IndexedDB on mount
  useEffect(() => {
    if (dbReady) {
      getSyncMeta("lastSync").then((meta) => {
        if (meta?.value && typeof meta.value === "number") {
          setLastSyncTimestamp(meta.value);
        }
      });
    }
  }, [dbReady]);

  // Initial sync when DB is ready and online
  useEffect(() => {
    if (dbReady && isOnline && !hasInitialSyncTriggered.current) {
      hasInitialSyncTriggered.current = true;
      triggerSync();
    }
  }, [dbReady, isOnline, triggerSync]);

  // Re-sync when coming back online (after being offline)
  useEffect(() => {
    if (wasOffline && isOnline && dbReady) {
      triggerSync();
    }
  }, [wasOffline, isOnline, dbReady, triggerSync]);

  // Check pending uploads on mount and periodically
  useEffect(() => {
    refreshPendingUploads();

    // Re-check periodically (every 10 seconds)
    const interval = setInterval(refreshPendingUploads, 10000);

    return () => clearInterval(interval);
  }, [refreshPendingUploads]);

  // Re-check pending uploads when online status changes
  useEffect(() => {
    if (isOnline) {
      // When coming back online, check more frequently initially
      const timeout = setTimeout(refreshPendingUploads, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, refreshPendingUploads]);

  // Setup SyncManager event subscription and fallback listeners
  useEffect(() => {
    if (!syncManager) return;

    // Get initial pending mutation count
    getPendingMutationCount().then(setPendingMutationCount);

    // Subscribe to sync events
    const unsubscribe = syncManager.subscribe((event) => {
      switch (event.type) {
        case "SYNC_STARTED":
          setIsMutationSyncing(true);
          break;
        case "SYNC_COMPLETE":
        case "SYNC_ERROR":
          setIsMutationSyncing(false);
          if (event.payload?.queueLength !== undefined) {
            setPendingMutationCount(event.payload.queueLength);
          }
          break;
        case "QUEUE_UPDATED":
        case "MUTATION_SYNCED":
        case "MUTATION_FAILED":
          getPendingMutationCount().then(setPendingMutationCount);
          break;
      }
    });

    // Setup iOS fallback listeners (online + visibilitychange)
    const cleanupFallback = syncManager.setupFallbackListeners();

    return () => {
      unsubscribe();
      cleanupFallback();
    };
  }, []);

  // Process mutation queue when coming back online
  useEffect(() => {
    if (wasOffline && isOnline && dbReady) {
      processMutationQueue();
    }
  }, [wasOffline, isOnline, dbReady, processMutationQueue]);

  const value: OfflineContextValue = {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    pendingUploadsCount,
    hasPendingUploads: pendingUploadsCount > 0,
    refreshPendingUploads,
    dbReady,
    persistentStorage,
    isSyncing,
    lastSyncTimestamp,
    syncError,
    syncCounts,
    triggerSync,
    pendingMutationCount,
    isMutationSyncing,
    processMutationQueue,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}

// Helper to open the IndexedDB database (same as in sw.ts)
async function openUploadQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("PhotoUploadQueue", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("uploads")) {
        const store = db.createObjectStore("uploads", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}
