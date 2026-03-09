/**
 * Capture Photo Uploader
 *
 * After an item creation mutation syncs successfully, uploads any
 * quick-capture photos from IndexedDB to the backend, then cleans up.
 */

import { getDB } from "@/lib/db/offline-db";
import { itemPhotosApi } from "@/lib/api/item-photos";
import type { CapturePhoto } from "@/lib/db/types";
import type { SyncEvent } from "./sync-manager";

const TAG = "[CapturePhotoUploader]";

/**
 * Retrieve all quick-capture photos for a given temp item ID.
 */
async function getPhotosByTempId(tempItemId: string): Promise<CapturePhoto[]> {
  const db = await getDB();
  return db.getAllFromIndex("quickCapturePhotos", "tempItemId", tempItemId);
}

/**
 * Delete all quick-capture photos for a given temp item ID.
 */
async function deletePhotosByTempId(tempItemId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("quickCapturePhotos", "readwrite");
  const index = tx.store.index("tempItemId");
  let cursor = await index.openCursor(tempItemId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Handle a MUTATION_SYNCED event: if it's an item create with photos
 * in IndexedDB, upload them to the backend.
 */
export async function handleItemSynced(
  event: SyncEvent,
  workspaceId: string
): Promise<void> {
  if (event.type !== "MUTATION_SYNCED") return;

  const mutation = event.payload?.mutation;
  const resolvedId = event.payload?.resolvedId as string | undefined;

  if (!mutation || mutation.entity !== "items" || mutation.operation !== "create") return;

  const tempId = mutation.idempotencyKey;
  const serverId = resolvedId ?? tempId;

  // Check for pending photos
  const photos = await getPhotosByTempId(tempId);
  if (photos.length === 0) return;

  console.log(`${TAG} uploading ${photos.length} photo(s) for item ${serverId} (temp=${tempId})`);

  let uploaded = 0;
  for (const photo of photos) {
    try {
      const file = new File([photo.blob], `capture-${Date.now()}.jpg`, {
        type: photo.blob.type || "image/jpeg",
      });
      await itemPhotosApi.uploadItemPhoto(workspaceId, serverId, file);
      uploaded++;
      console.log(`${TAG} uploaded photo ${uploaded}/${photos.length}`);
    } catch (err) {
      console.error(`${TAG} failed to upload photo:`, err);
      // Continue uploading remaining photos
    }
  }

  // Clean up IndexedDB entries
  await deletePhotosByTempId(tempId);
  console.log(`${TAG} cleanup done, ${uploaded}/${photos.length} uploaded`);
}
