import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { photosApi, type BulkCaptionUpdate } from "@/lib/api/photos";
import { retroToast } from "@/components/retro";

// Phase 7 Plan 04 — the photo write surface shared by PhotoUpload + PhotoGallery.
// Every mutation invalidates the `["items", wsId]` PREFIX (no `exact: true`) so
// the item-detail query (`["items", wsId, itemId]`) and any photo-list query
// nested under it re-fetch. Reorder is optimistic with revert-on-error.

export interface ReorderContext {
  /** The id order captured before the optimistic swap, restored on error. */
  previous: string[];
}

/**
 * Mutations for the photo pipeline, all scoped to one item. Each mutation
 * invalidates the items prefix on success; `reorder` additionally applies an
 * optimistic order via `onOptimistic` and reverts via `onRevert` when the
 * server rejects the new order (the full id list is required — a 400 otherwise).
 */
export function usePhotoMutations(wsId: string, itemId: string) {
  const { t } = useLingui();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["items", wsId] });

  const upload = useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) =>
      photosApi.upload(wsId, itemId, file, caption),
    onSuccess: invalidate,
  });

  const setPrimary = useMutation({
    mutationFn: (photoId: string) => photosApi.setPrimary(wsId, photoId),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't set the primary photo.`),
  });

  const updateCaption = useMutation({
    mutationFn: ({ photoId, caption }: { photoId: string; caption: string }) =>
      photosApi.updateCaption(wsId, photoId, caption),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't save the caption.`),
  });

  const del = useMutation({
    mutationFn: (photoId: string) => photosApi.del(wsId, photoId),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't delete the photo.`),
  });

  const bulkDelete = useMutation({
    mutationFn: (photoIds: string[]) =>
      photosApi.bulkDelete(wsId, itemId, photoIds),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't delete the photos.`),
  });

  const bulkCaption = useMutation({
    mutationFn: (updates: BulkCaptionUpdate[]) =>
      photosApi.bulkCaption(wsId, itemId, updates),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't apply the caption.`),
  });

  // Reorder is optimistic: the gallery applies the new order locally, then this
  // PUTs the FULL ordered id list. On error the gallery reverts and a danger
  // toast surfaces; on success the items prefix re-validates.
  const reorder = useMutation<void, Error, string[], ReorderContext>({
    mutationFn: (photoIds: string[]) =>
      photosApi.reorder(wsId, itemId, photoIds),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't reorder the photos.`),
  });

  return {
    upload,
    setPrimary,
    updateCaption,
    del,
    bulkDelete,
    bulkCaption,
    reorder,
  };
}
