"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface OfflineContextValue {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  pendingUploadsCount: number;
  hasPendingUploads: boolean;
  refreshPendingUploads: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingUploadsCount, setPendingUploadsCount] = useState(0);

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

  const value: OfflineContextValue = {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    pendingUploadsCount,
    hasPendingUploads: pendingUploadsCount > 0,
    refreshPendingUploads,
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
