/**
 * Capture Photo Uploader
 *
 * After an item creation mutation syncs successfully, uploads any
 * quick-capture photos from IndexedDB to the backend, then cleans up.
 *
 * Design:
 * - Per-photo delete: each photo is deleted individually only after a confirmed upload.
 * - Failed uploads: photo is put back with status="failed" and resolvedItemId stored,
 *   so retry always has the server ID without needing the in-scope resolvedIds map.
 * - Retry: retryFailedPhotoUploads() uses the "status" index to find failed photos
 *   and re-attempts upload using the stored resolvedItemId.
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
 * Handle a MUTATION_SYNCED event: if it's an item create with photos
 * in IndexedDB, upload them to the backend.
 *
 * Per-photo delete: on success, delete individually. On failure, mark
 * with status="failed" and resolvedItemId so retry can use the server ID.
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

  const db = await getDB();

  // Pre-write: store resolvedItemId on ALL photos before the upload loop
  // so retry always has the server ID even if the process is interrupted.
  for (const photo of photos) {
    await db.put("quickCapturePhotos", { ...photo, resolvedItemId: serverId });
  }

  let uploaded = 0;
  for (const photo of photos) {
    try {
      const file = new File([photo.blob], `capture-${Date.now()}.jpg`, {
        type: photo.blob.type || "image/jpeg",
      });
      await itemPhotosApi.uploadItemPhoto(workspaceId, serverId, file);
      uploaded++;
      // Delete only this photo after confirmed upload
      await db.delete("quickCapturePhotos", photo.id);
      console.log(`${TAG} uploaded photo ${uploaded}/${photos.length}`);
    } catch (err) {
      console.error(`${TAG} failed to upload photo ${photo.id}:`, err);
      // Mark as failed with resolvedItemId preserved for retry
      await db.put("quickCapturePhotos", {
        ...photo,
        status: "failed",
        resolvedItemId: serverId,
      });
    }
  }

  console.log(`${TAG} done: ${uploaded}/${photos.length} uploaded`);
}

/**
 * Retry all photos that previously failed to upload.
 * Called from OfflineContext on SYNC_COMPLETE and when coming back online.
 *
 * Uses the "status" index to find failed photos. Each photo must have
 * resolvedItemId set (written during the original handleItemSynced call).
 * Photos without resolvedItemId are skipped with a warning.
 */
export async function retryFailedPhotoUploads(workspaceId: string): Promise<void> {
  const db = await getDB();
  const failedPhotos = await db.getAllFromIndex("quickCapturePhotos", "status", "failed");

  if (failedPhotos.length === 0) return;

  console.log(`${TAG} retrying ${failedPhotos.length} failed photo upload(s)`);

  for (const photo of failedPhotos) {
    if (!photo.resolvedItemId) {
      console.warn(`${TAG} skipping photo ${photo.id} — no resolvedItemId stored`);
      continue;
    }

    try {
      const file = new File([photo.blob], `capture-${Date.now()}.jpg`, {
        type: photo.blob.type || "image/jpeg",
      });
      await itemPhotosApi.uploadItemPhoto(workspaceId, photo.resolvedItemId, file);
      await db.delete("quickCapturePhotos", photo.id);
      console.log(`${TAG} retry succeeded for photo ${photo.id}`);
    } catch (err) {
      console.error(`${TAG} retry failed for photo ${photo.id}:`, err);
      // Leave as status="failed" — will be retried on next event
    }
  }
}
