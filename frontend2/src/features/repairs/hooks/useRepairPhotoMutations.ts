import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import { repairPhotosApi } from "@/lib/api/repairPhotos";
import { retroToast } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { RepairPhotoType } from "@/lib/types";

// Phase 10b Plan 03 — the repair-photo write surface (RPR-03). Mirrors the SHAPE
// of usePhotoMutations so the parametrized PhotoUpload/PhotoGallery can consume it
// through their injected-mutations seam WITHOUT JSX drift, but it is scoped to the
// repair-photo backend subset that actually exists (upload / updateCaption / del).
//
// Every mutation invalidates the LOCKED key ["repairs", wsId, repairId, "photos"]
// (NOT the items prefix). Upload is REAL multipart and REQUIRES a photo_type
// (BEFORE | DURING | AFTER, Pitfall 1) — the upload variables carry it through.
//
// The PHOTOS tab does NOT expose set-primary / reorder / bulk / zip (the repair
// backend lacks those routes, F2). The injected-mutations seam is therefore a
// REDUCED set; the gallery degrades gracefully (those affordances are gated off).

export interface RepairPhotoUploadVars {
  file: File;
  caption?: string;
  photoType?: RepairPhotoType;
}

/**
 * Mutations for the repair-photo pipeline, scoped to one repair record. Shaped
 * like usePhotoMutations (an `upload` + `updateCaption` + `del` triple) so the
 * shared atoms can call it through their `mutations` prop unchanged.
 */
export function useRepairPhotoMutations(wsId: string, repairId: string) {
  const { t } = useLingui();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["repairs", wsId, repairId, "photos"],
    });

  const upload = useMutation({
    mutationFn: ({ file, caption, photoType }: RepairPhotoUploadVars) =>
      // photo_type is REQUIRED by the backend (Pitfall 1); default to BEFORE so a
      // caller that forgot to thread it through still produces a valid request.
      repairPhotosApi.upload(
        wsId,
        repairId,
        file,
        photoType ?? "BEFORE",
        caption,
      ),
    onSuccess: invalidate,
  });

  const updateCaption = useMutation({
    mutationFn: ({ photoId, caption }: { photoId: string; caption: string }) =>
      repairPhotosApi.updateCaption(wsId, repairId, photoId, caption),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't save the caption.`),
  });

  const del = useMutation({
    mutationFn: (photoId: string) => repairPhotosApi.del(wsId, repairId, photoId),
    onSuccess: invalidate,
    onError: () => retroToast.error(t`Couldn't delete the photo.`),
  });

  return { upload, updateCaption, del };
}

/** Convenience: read the current workspace + a repairId and return the hook. */
export function useRepairPhotoMutationsForWorkspace(repairId: string) {
  const { currentWorkspaceId } = useWorkspace();
  return useRepairPhotoMutations(currentWorkspaceId as string, repairId);
}
