"use client";

import { useEffect, useState, useCallback } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";

export function PendingUploadsIndicator() {
  const t = useTranslations("pwa.pendingUploads");
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  const checkPendingUploads = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;

    try {
      const db = await openUploadQueueDB();
      const tx = db.transaction("uploads", "readonly");
      const store = tx.objectStore("uploads");

      const request = store.count();
      request.onsuccess = () => {
        setPendingCount(request.result);
      };
    } catch {
      // IndexedDB not available or error - silently fail
      setPendingCount(0);
    }
  }, []);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check pending uploads on mount and when online status changes
  useEffect(() => {
    if (!mounted) return;

    checkPendingUploads();

    // Re-check periodically (every 10 seconds)
    const interval = setInterval(checkPendingUploads, 10000);

    return () => clearInterval(interval);
  }, [mounted, isOnline, checkPendingUploads]);

  if (!mounted || pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-amber-500/90 text-white px-4 py-2",
        "animate-in fade-in slide-in-from-top duration-300"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
          <Cloud className="h-4 w-4 animate-pulse" />
        ) : (
          <CloudOff className="h-4 w-4" />
        )}
        <span className="text-sm font-medium">
          {isOnline
            ? t("syncing", { count: pendingCount })
            : t("queued", { count: pendingCount })}
        </span>
      </div>
    </div>
  );
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
