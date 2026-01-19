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
