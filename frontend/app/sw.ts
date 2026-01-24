/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    // Cache API responses
    {
      matcher: /^https?:\/\/.*\/api\/.*/i,
      handler: new NetworkFirst({
        cacheName: "api-cache",
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              return response?.status === 200 ? response : null;
            },
          },
        ],
      }),
    },
    // Cache item photos with offline-first strategy
    {
      matcher: /^https?:\/\/.*\/api\/workspaces\/.*\/items\/.*\/photos\/.*/i,
      handler: new CacheFirst({
        cacheName: "item-photos-cache",
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              return response?.status === 200 || response?.status === 0 ? response : null;
            },
          },
        ],
      }),
    },
    // Cache thumbnail images (small images, longer cache)
    {
      matcher: /^https?:\/\/.*\/api\/workspaces\/.*\/items\/.*\/photos\/.*\/(thumb|small)\/.*/i,
      handler: new CacheFirst({
        cacheName: "photo-thumbnails-cache",
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              return response?.status === 200 || response?.status === 0 ? response : null;
            },
          },
        ],
      }),
    },
    // Cache other images
    {
      matcher: /\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/i,
      handler: new CacheFirst({
        cacheName: "images-cache",
      }),
    },
    // Cache fonts
    {
      matcher: /\.(?:woff|woff2|ttf|eot)$/i,
      handler: new CacheFirst({
        cacheName: "fonts-cache",
      }),
    },
  ] satisfies RuntimeCaching[],
});

serwist.addEventListeners();

// ============================================================================
// Background Sync & Mutation Queue Communication
// ============================================================================

/**
 * BroadcastChannel for communicating sync status with main thread.
 * Used for mutation queue sync coordination.
 */
const syncChannel = new BroadcastChannel("sync-status");

/**
 * Handle Background Sync events (Chrome/Edge only).
 * When triggered, notify main thread to process mutation queue.
 */
self.addEventListener("sync", (event) => {
  if (event.tag === "mutation-queue-sync") {
    console.log("[SW] Background sync triggered for mutation-queue-sync");
    event.waitUntil(
      Promise.resolve().then(() => {
        syncChannel.postMessage({
          type: "SYNC_REQUESTED",
          payload: { source: "background-sync" },
        });
      })
    );
  }
});

/**
 * Handle messages from main thread requesting sync registration.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type === "REGISTER_SYNC") {
    console.log("[SW] Received REGISTER_SYNC request");

    // TypeScript doesn't have full types for Background Sync API
    const registration = self.registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };

    if (registration.sync) {
      registration.sync.register("mutation-queue-sync").catch((error) => {
        console.warn("[SW] Background sync registration failed:", error);
        // Fallback handled by main thread online event
      });
    }
  }
});

// ============================================================================
// Push Notification Handlers
// ============================================================================

interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
  require_open?: boolean;
}

// Handle push notification events
self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push event but no data");
    return;
  }

  try {
    const data = event.data.json() as PushNotificationData;

    // Note: vibrate is part of the Notification API but not in TypeScript's NotificationOptions
    const options = {
      body: data.body,
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/favicon-32x32.png",
      tag: data.tag || "default",
      data: {
        url: data.url || "/",
        ...data.data,
      },
      requireInteraction: data.require_open || false,
      vibrate: [100, 50, 100],
    } satisfies NotificationOptions & { vibrate?: number[] };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (error) {
    console.error("Error handling push event:", error);
  }
});

// Handle notification click events
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data?.url as string) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open on our origin
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          // Navigate to the URL if needed
          if (url !== "/" && "navigate" in client) {
            (client as WindowClient).navigate(url);
          }
          return;
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Handle notification close events (for analytics if needed)
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});

// ============================================================================
// Offline Photo Upload Handlers
// ============================================================================

// Handle offline photo uploads by queueing them
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Detect photo upload requests
  if (
    request.method === "POST" &&
    request.url.includes("/api/workspaces/") &&
    request.url.includes("/items/") &&
    request.url.includes("/photos")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(async (error) => {
          // If offline, save to IndexedDB for later sync
          if (!navigator.onLine) {
            try {
              // Queue the upload for later
              const formData = await request.clone().formData();
              await queuePhotoUpload(request.url, formData);

              // Return a 202 Accepted response
              return new Response(
                JSON.stringify({
                  message: "Photo queued for upload when online",
                  queued: true,
                }),
                {
                  status: 202,
                  headers: { "Content-Type": "application/json" },
                }
              );
            } catch (queueError) {
              console.error("Failed to queue upload:", queueError);
            }
          }
          throw error;
        })
    );
  }
});

// Listen for online event to sync queued uploads
self.addEventListener("online", async () => {
  console.log("Back online, syncing queued uploads...");
  await syncQueuedUploads();
});

// Helper to promisify IDBRequest
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper functions for queuing uploads
async function queuePhotoUpload(url: string, formData: FormData) {
  const db = await openUploadQueueDB();
  const tx = db.transaction("uploads", "readwrite");
  const store = tx.objectStore("uploads");

  // Convert FormData to storable format
  const uploadData = {
    url,
    timestamp: Date.now(),
    file: formData.get("file"),
    caption: formData.get("caption"),
  };

  await promisifyRequest(store.add(uploadData));
}

async function syncQueuedUploads() {
  const db = await openUploadQueueDB();
  const tx = db.transaction("uploads", "readonly");
  const store = tx.objectStore("uploads");
  const uploads = await promisifyRequest(store.getAll());

  for (const upload of uploads) {
    try {
      const formData = new FormData();
      formData.append("file", upload.file);
      if (upload.caption) {
        formData.append("caption", upload.caption);
      }

      const response = await fetch(upload.url, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Remove from queue on success
        const deleteTx = db.transaction("uploads", "readwrite");
        const deleteStore = deleteTx.objectStore("uploads");
        await promisifyRequest(deleteStore.delete(upload.id));
        console.log("Successfully synced upload:", upload.id);
      }
    } catch (error) {
      console.error("Failed to sync upload:", error);
    }
  }
}

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
