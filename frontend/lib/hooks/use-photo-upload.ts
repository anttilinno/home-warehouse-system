"use client";

import { useState, useCallback } from "react";
import { itemPhotosApi } from "../api/item-photos";
import { validateImageFile, compressImage } from "../utils/image";
import type { ItemPhoto } from "../types/item-photo";

interface UsePhotoUploadOptions {
  workspaceId: string;
  itemId: string;
  onSuccess?: (photo: ItemPhoto) => void;
  onError?: (error: string) => void;
  /** Enable automatic compression for files larger than this size (bytes). Default: 2MB */
  compressionThreshold?: number;
  /** Compression quality (0-1). Default: 0.85 */
  compressionQuality?: number;
}

interface UsePhotoUploadReturn {
  upload: (file: File, caption?: string) => Promise<ItemPhoto | null>;
  uploading: boolean;
  progress: number;
  error: string | null;
  compressing: boolean;
  originalSize: number | null;
  compressedSize: number | null;
  reset: () => void;
}

/**
 * Hook for managing photo upload state and progress
 */
export function usePhotoUpload({
  workspaceId,
  itemId,
  onSuccess,
  onError,
  compressionThreshold = 2 * 1024 * 1024, // 2MB default
  compressionQuality = 0.85,
}: UsePhotoUploadOptions): UsePhotoUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  const reset = useCallback(() => {
    setUploading(false);
    setCompressing(false);
    setProgress(0);
    setError(null);
    setOriginalSize(null);
    setCompressedSize(null);
  }, []);

  const upload = useCallback(
    async (file: File, caption?: string): Promise<ItemPhoto | null> => {
      // Reset state
      setError(null);
      setProgress(0);
      setOriginalSize(file.size);
      setCompressedSize(null);

      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        const errorMsg = validation.error || "Invalid file";
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }

      let fileToUpload = file;

      // Compress if file is larger than threshold
      if (file.size > compressionThreshold) {
        setCompressing(true);
        try {
          fileToUpload = await compressImage(
            file,
            1920,
            1920,
            compressionQuality
          );
          setCompressedSize(fileToUpload.size);
          console.log(
            `Compressed image from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`
          );
        } catch (compressionError) {
          console.warn("Compression failed, uploading original:", compressionError);
          // Continue with original file if compression fails
          fileToUpload = file;
        } finally {
          setCompressing(false);
        }
      }

      setUploading(true);

      try {
        // Upload with progress tracking
        const photo = await itemPhotosApi.uploadItemPhoto(
          workspaceId,
          itemId,
          fileToUpload,
          caption,
          (percentage) => {
            setProgress(percentage);
          }
        );

        // Success
        setUploading(false);
        setProgress(100);
        onSuccess?.(photo);
        return photo;
      } catch (err) {
        // Error
        const errorMsg = err instanceof Error ? err.message : "Failed to upload photo";
        setError(errorMsg);
        setUploading(false);
        setProgress(0);
        onError?.(errorMsg);
        return null;
      }
    },
    [workspaceId, itemId, onSuccess, onError, compressionThreshold, compressionQuality]
  );

  return {
    upload,
    uploading,
    compressing,
    progress,
    error,
    originalSize,
    compressedSize,
    reset,
  };
}
