"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { itemPhotosApi } from "../api/item-photos";
import type { ItemPhoto } from "../types/item-photo";

interface UseItemPhotosOptions {
  workspaceId: string;
  itemId: string;
  autoFetch?: boolean;
}

interface UseItemPhotosReturn {
  photos: ItemPhoto[];
  loading: boolean;
  error: string | null;
  primaryPhoto: ItemPhoto | null;
  uploadPhoto: (file: File, caption?: string, onProgress?: (percentage: number) => void) => Promise<ItemPhoto | null>;
  setPrimary: (photoId: string) => Promise<void>;
  updateCaption: (photoId: string, caption: string) => Promise<void>;
  reorder: (photoIds: string[]) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing item photos with state management and optimistic updates
 */
export function useItemPhotos({
  workspaceId,
  itemId,
  autoFetch = true,
}: UseItemPhotosOptions): UseItemPhotosReturn {
  const [photos, setPhotos] = useState<ItemPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get primary photo
  const primaryPhoto = useMemo(() => {
    return photos.find((photo) => photo.is_primary) || photos[0] || null;
  }, [photos]);

  // Fetch photos
  const fetchPhotos = useCallback(async () => {
    if (!workspaceId || !itemId) return;

    setLoading(true);
    setError(null);

    try {
      const fetchedPhotos = await itemPhotosApi.getItemPhotos(workspaceId, itemId);
      setPhotos(fetchedPhotos);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch photos";
      setError(errorMsg);
      console.error("Failed to fetch photos:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, itemId]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchPhotos();
    }
  }, [autoFetch, fetchPhotos]);

  // Upload photo
  const uploadPhoto = useCallback(
    async (
      file: File,
      caption?: string,
      onProgress?: (percentage: number) => void
    ): Promise<ItemPhoto | null> => {
      setError(null);

      try {
        const photo = await itemPhotosApi.uploadItemPhoto(
          workspaceId,
          itemId,
          file,
          caption,
          onProgress
        );

        // Add new photo to state
        setPhotos((prev) => [...prev, photo]);

        return photo;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to upload photo";
        setError(errorMsg);
        console.error("Failed to upload photo:", err);
        return null;
      }
    },
    [workspaceId, itemId]
  );

  // Set primary photo
  const setPrimary = useCallback(
    async (photoId: string): Promise<void> => {
      setError(null);

      // Optimistic update
      setPhotos((prev) =>
        prev.map((photo) => ({
          ...photo,
          is_primary: photo.id === photoId,
        }))
      );

      try {
        const updatedPhoto = await itemPhotosApi.setPrimaryPhoto(workspaceId, photoId);

        // Update with server response
        setPhotos((prev) =>
          prev.map((photo) =>
            photo.id === updatedPhoto.id ? updatedPhoto : { ...photo, is_primary: false }
          )
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to set primary photo";
        setError(errorMsg);
        console.error("Failed to set primary photo:", err);

        // Revert optimistic update
        await fetchPhotos();
      }
    },
    [workspaceId, fetchPhotos]
  );

  // Update caption
  const updateCaption = useCallback(
    async (photoId: string, caption: string): Promise<void> => {
      setError(null);

      // Optimistic update
      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === photoId ? { ...photo, caption } : photo
        )
      );

      try {
        const updatedPhoto = await itemPhotosApi.updatePhotoCaption(
          workspaceId,
          photoId,
          caption
        );

        // Update with server response
        setPhotos((prev) =>
          prev.map((photo) => (photo.id === updatedPhoto.id ? updatedPhoto : photo))
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to update caption";
        setError(errorMsg);
        console.error("Failed to update caption:", err);

        // Revert optimistic update
        await fetchPhotos();
      }
    },
    [workspaceId, fetchPhotos]
  );

  // Reorder photos
  const reorder = useCallback(
    async (photoIds: string[]): Promise<void> => {
      setError(null);

      // Optimistic update
      const reorderedPhotos = photoIds
        .map((id) => photos.find((photo) => photo.id === id))
        .filter((photo): photo is ItemPhoto => photo !== undefined);

      setPhotos(reorderedPhotos);

      try {
        const updatedPhotos = await itemPhotosApi.reorderPhotos(
          workspaceId,
          itemId,
          photoIds
        );

        // Update with server response
        setPhotos(updatedPhotos);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to reorder photos";
        setError(errorMsg);
        console.error("Failed to reorder photos:", err);

        // Revert optimistic update
        await fetchPhotos();
      }
    },
    [workspaceId, itemId, photos, fetchPhotos]
  );

  // Delete photo
  const deletePhoto = useCallback(
    async (photoId: string): Promise<void> => {
      setError(null);

      // Optimistic update
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));

      try {
        await itemPhotosApi.deletePhoto(workspaceId, photoId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to delete photo";
        setError(errorMsg);
        console.error("Failed to delete photo:", err);

        // Revert optimistic update
        await fetchPhotos();
      }
    },
    [workspaceId, fetchPhotos]
  );

  // Refresh photos
  const refresh = useCallback(async (): Promise<void> => {
    await fetchPhotos();
  }, [fetchPhotos]);

  return {
    photos,
    loading,
    error,
    primaryPhoto,
    uploadPhoto,
    setPrimary,
    updateCaption,
    reorder,
    deletePhoto,
    refresh,
  };
}
