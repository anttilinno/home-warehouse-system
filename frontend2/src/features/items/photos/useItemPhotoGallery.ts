import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import {
  itemPhotoKeys,
  itemPhotosApi,
  type ItemPhoto,
} from "@/lib/api/itemPhotos";
import { itemKeys } from "@/lib/api/items";

/**
 * Centralises the three item-photo mutations plus ObjectURL bookkeeping for
 * the Phase 61 gallery. Consumers get a single handle for uploads (sequential,
 * one at a time, with a red-border toast per failure — batch does NOT abort),
 * an optimistic setPrimary mutation (Pitfall 3: invalidates items list +
 * detail on success so thumbnails update), and a delete mutation. The
 * `objectUrlsRef` plus cleanup effect satisfy D-12 (success criterion #5):
 * every URL.createObjectURL result tracked via the ref is revoked on
 * unmount, and the `unmountedRef` sentinel lets the async upload loop
 * short-circuit if the user navigates away mid-batch (Pitfall 7).
 */
export interface UseItemPhotoGalleryResult {
  photos: ItemPhoto[];
  isLoading: boolean;
  isError: boolean;
  uploadFiles: (files: File[]) => Promise<void>;
  setPrimary: (photoId: string) => void;
  deletePhoto: (photoId: string) => Promise<void>;
  isUploading: boolean;
  isSettingPrimary: boolean;
  isDeleting: boolean;
  objectUrlsRef: React.MutableRefObject<Set<string>>;
}

export function useItemPhotoGallery(itemId: string): UseItemPhotoGalleryResult {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();

  const objectUrlsRef = useRef<Set<string>>(new Set());
  const unmountedRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      // D-12: revoke every tracked ObjectURL on unmount (success criterion #5).
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const photosQuery = useQuery({
    queryKey: itemPhotoKeys.list(itemId),
    queryFn: () => itemPhotosApi.listForItem(workspaceId!, itemId),
    enabled: !!workspaceId && !!itemId,
  });

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!workspaceId || files.length === 0) return;
      setIsUploading(true);
      let successCount = 0;
      for (const file of files) {
        if (unmountedRef.current) break;
        try {
          await itemPhotosApi.upload(workspaceId, itemId, file);
          successCount++;
          qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
        } catch {
          addToast(
            t`Couldn't upload ${file.name}. Continuing with the rest.`,
            "error"
          );
        }
      }
      if (!unmountedRef.current) {
        setIsUploading(false);
        if (successCount === files.length && successCount > 0) {
          addToast(
            successCount === 1
              ? t`Photo uploaded.`
              : t`${successCount} photos uploaded.`,
            "success"
          );
        } else if (successCount > 0) {
          addToast(
            t`${successCount} of ${files.length} photos uploaded.`,
            "success"
          );
        }
        // First-ever upload may promote a primary on the backend; refresh
        // items list + detail so the new thumbnail flows into those surfaces.
        qc.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
        qc.invalidateQueries({ queryKey: itemKeys.lists() });
      }
    },
    [workspaceId, itemId, qc, addToast, t]
  );

  const setPrimaryMutation = useMutation({
    mutationFn: (photoId: string) =>
      itemPhotosApi.setPrimary(workspaceId!, photoId),
    onMutate: async (photoId: string) => {
      await qc.cancelQueries({ queryKey: itemPhotoKeys.list(itemId) });
      const previous = qc.getQueryData<ItemPhoto[]>(itemPhotoKeys.list(itemId));
      qc.setQueryData<ItemPhoto[]>(itemPhotoKeys.list(itemId), (old) =>
        (old ?? []).map((p) => ({ ...p, is_primary: p.id === photoId }))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(itemPhotoKeys.list(itemId), context.previous);
      }
      addToast(t`Could not update primary photo. Try again.`, "error");
    },
    onSuccess: () => {
      // Pitfall 3: invalidate all three keys so items list thumbnail and
      // detail header thumbnail both refresh.
      qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
      qc.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
      qc.invalidateQueries({ queryKey: itemKeys.lists() });
      addToast(t`Primary photo updated.`, "success");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) =>
      itemPhotosApi.remove(workspaceId!, photoId),
    onSuccess: (_data, photoId) => {
      // If the deleted photo was the primary, the backend may auto-promote
      // another — invalidate items list/detail so the new primary's
      // thumbnail is rendered there too.
      const prev = qc.getQueryData<ItemPhoto[]>(itemPhotoKeys.list(itemId));
      const wasPrimary = prev?.find((p) => p.id === photoId)?.is_primary ?? false;
      qc.invalidateQueries({ queryKey: itemPhotoKeys.list(itemId) });
      if (wasPrimary) {
        qc.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
        qc.invalidateQueries({ queryKey: itemKeys.lists() });
      }
      addToast(t`Photo deleted.`, "success");
    },
    onError: () => addToast(t`Could not delete photo. Try again.`, "error"),
  });

  return {
    photos: photosQuery.data ?? [],
    isLoading: photosQuery.isLoading,
    isError: photosQuery.isError,
    uploadFiles,
    setPrimary: setPrimaryMutation.mutate,
    deletePhoto: async (photoId) => {
      await deleteMutation.mutateAsync(photoId);
    },
    isUploading,
    isSettingPrimary: setPrimaryMutation.isPending,
    isDeleting: deleteMutation.isPending,
    objectUrlsRef,
  };
}
