import { useCallback } from "react";
import { getDB } from "@/lib/db/offline-db";
import type { CapturePhoto } from "@/lib/db/types";

/**
 * Hook providing CRUD operations for the quickCapturePhotos IndexedDB store.
 * Photos are stored as blobs for offline-first quick capture support.
 */
export function useCapturePhotos() {
  /**
   * Store a photo blob linked to a temporary item ID.
   * Returns the auto-incremented photo ID.
   */
  const storePhoto = useCallback(
    async (tempItemId: string, blob: Blob): Promise<number> => {
      const db = await getDB();
      const id = await db.add("quickCapturePhotos", {
        tempItemId,
        blob,
        capturedAt: Date.now(),
        status: "pending",
      } as CapturePhoto);
      return id;
    },
    []
  );

  /**
   * Retrieve all photos for a given temporary item ID.
   */
  const getPhotosByTempItemId = useCallback(
    async (tempItemId: string): Promise<CapturePhoto[]> => {
      const db = await getDB();
      return db.getAllFromIndex(
        "quickCapturePhotos",
        "tempItemId",
        tempItemId
      );
    },
    []
  );

  /**
   * Delete all photos for a given temporary item ID.
   * Used for cleanup after successful upload or discard.
   */
  const deletePhotosByTempItemId = useCallback(
    async (tempItemId: string): Promise<void> => {
      const db = await getDB();
      const tx = db.transaction("quickCapturePhotos", "readwrite");
      const index = tx.store.index("tempItemId");
      let cursor = await index.openCursor(tempItemId);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    },
    []
  );

  /**
   * Delete a single photo by its auto-incremented ID.
   */
  const deletePhoto = useCallback(async (id: number): Promise<void> => {
    const db = await getDB();
    await db.delete("quickCapturePhotos", id);
  }, []);

  return {
    storePhoto,
    getPhotosByTempItemId,
    deletePhotosByTempItemId,
    deletePhoto,
  };
}
