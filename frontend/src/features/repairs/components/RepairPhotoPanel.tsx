import { useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { BevelButton, RetroSelect } from "@/components/retro";
import { PhotoUpload } from "@/features/items/components/PhotoUpload";
import {
  PhotoGallery,
  type GalleryPhoto,
} from "@/features/items/components/PhotoGallery";
import { repairPhotosApi } from "@/lib/api/repairPhotos";
import type { RepairPhoto, RepairPhotoType } from "@/lib/types";
import { useRepairPhotoMutations } from "../hooks/useRepairPhotoMutations";

// Phase 10b Plan 03 — the PHOTOS tab of the repair record sub-view (RPR-03). It
// REUSES the shipped PhotoUpload + PhotoGallery atoms via their data seam, pointed
// at the repair-scoped api/hook. Visual contract is identical; only the data
// dependency + the BEFORE/DURING/AFTER photo_type select differ.
//
// The repair-photo backend has NO check-duplicate / set-primary / reorder / bulk /
// zip routes (F2), so those affordances are gated OFF — the gallery degrades to a
// clean caption + delete grid. Upload is real multipart with a REQUIRED
// photo_type (Pitfall 1), threaded through the upload seam.

export interface RepairPhotoPanelProps {
  wsId: string;
  repairId: string;
}

const PHOTO_TYPES: RepairPhotoType[] = ["BEFORE", "DURING", "AFTER"];

/** Adapt a RepairPhoto onto the gallery's structural shape. */
function toGalleryPhoto(p: RepairPhoto): GalleryPhoto {
  return {
    id: p.id,
    thumbnail_url: p.thumbnail_url,
    caption: p.caption,
    // No filename on the wire — fall back to the photo_type so the alt/labels
    // read sensibly ("BEFORE", "DURING", "AFTER").
    filename: p.photo_type,
  };
}

export function RepairPhotoPanel({
  wsId,
  repairId,
}: Readonly<RepairPhotoPanelProps>) {
  const { t } = useLingui();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [photoType, setPhotoType] = useState<RepairPhotoType>("BEFORE");

  // LOCKED key: ["repairs", wsId, repairId, "photos"] — matches the mutation hook.
  const photosQuery = useQuery({
    queryKey: ["repairs", wsId, repairId, "photos"],
    queryFn: () => repairPhotosApi.list(wsId, repairId),
    enabled: Boolean(wsId) && Boolean(repairId),
    retry: false,
  });

  const mutations = useRepairPhotoMutations(wsId, repairId);

  const galleryPhotos = useMemo(
    () => (photosQuery.data ?? []).map(toGalleryPhoto),
    [photosQuery.data],
  );

  return (
    <div className="flex flex-col gap-sp-2">
      {/* ⊕ ADD PHOTOS — mint primary, right-aligned (mirrors ItemDetail). */}
      <div className="flex justify-end">
        <BevelButton variant="mint" onClick={() => setUploadOpen(true)}>
          <Trans>⊕ ADD PHOTOS</Trans>
        </BevelButton>
      </div>

      {photosQuery.isError ? (
        <p className="bg-bg-panel-2 p-sp-4 text-14 text-danger">
          <Trans>Couldn't load photos. Try again.</Trans>
        </p>
      ) : (
        <PhotoGallery
          wsId={wsId}
          itemId={repairId}
          photos={galleryPhotos}
          onOpenLightbox={() => {}}
          mutations={{
            updateCaption: mutations.updateCaption,
            del: mutations.del,
          }}
          canSetPrimary={false}
          canReorder={false}
          canBulk={false}
          canDownloadZip={false}
        />
      )}

      {/* The ADD PHOTOS dialog — identical to ItemDetail's, plus a REQUIRED
          BEFORE/DURING/AFTER select threaded through the upload seam. No
          dup-check (repair backend has no check-duplicate route). */}
      <PhotoUpload
        wsId={wsId}
        itemId={repairId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        mutations={{ upload: mutations.upload }}
        checkDuplicate={null}
        uploadVars={{ photoType }}
        extraFields={
          <RetroSelect
            label={<Trans>Stage</Trans>}
            value={photoType}
            onChange={(e) => setPhotoType(e.target.value as RepairPhotoType)}
            aria-label={t`Photo stage`}
          >
            {PHOTO_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </RetroSelect>
        }
      />
    </div>
  );
}
