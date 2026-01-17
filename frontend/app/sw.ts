import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

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
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Cache item photos with offline-first strategy
    {
      urlPattern: /^https?:\/\/.*\/api\/workspaces\/.*\/items\/.*\/photos\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "item-photos-cache",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Cache thumbnail images (small images, longer cache)
    {
      urlPattern: /^https?:\/\/.*\/api\/workspaces\/.*\/items\/.*\/photos\/.*\/(thumb|small)\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "photo-thumbnails-cache",
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    // Cache other images
    {
      urlPattern: /\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "images-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    // Cache fonts
    {
      urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "fonts-cache",
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
  ],
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

// Helper functions for queuing uploads
async function queuePhotoUpload(url: string, formData: FormData) {
  const db = await openUploadQueueDB();
  const tx = db.transaction("uploads", "readwrite");
  const store = tx.objectStore("uploads");

  // Convert FormData to storable format
  const uploadData = {
    url,
    timestamp: Date.now(),
    file: await formData.get("file"),
    caption: formData.get("caption"),
  };

  await store.add(uploadData);
}

async function syncQueuedUploads() {
  const db = await openUploadQueueDB();
  const tx = db.transaction("uploads", "readonly");
  const store = tx.objectStore("uploads");
  const uploads = await store.getAll();

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
        await deleteStore.delete(upload.id);
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
