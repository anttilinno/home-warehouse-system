import { useRef, useState, useCallback } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroButton,
  RetroEmptyState,
  useToast,
} from "@/components/retro";
import { Plus } from "../icons";
import { ItemPhotoGrid } from "./ItemPhotoGrid";
import { ItemPhotoLightbox } from "./ItemPhotoLightbox";
import { useItemPhotoGallery } from "./useItemPhotoGallery";

/**
 * Top-level orchestrator for the PHOTOS section on ItemDetailPage.
 *
 * Owns:
 *   - the photo list (via useItemPhotoGallery → React Query)
 *   - the lightbox open/close + index state
 *   - ADD PHOTOS file-picker trigger + client-side mime/size validation
 *
 * Client-side rejection matrix (D-10, Pitfall 1):
 *   - mime `image/heic` / `image/heif`  → specific HEIC error toast
 *   - other mimes not in ACCEPTED_MIME_TYPES → generic unsupported-format toast
 *   - size > 10 MB → oversized toast
 *   - accepted files are uploaded sequentially by the hook
 *
 * Per UI-SPEC "Archived item gallery": the ADD PHOTOS button is hidden when
 * `archived=true`, and the lightbox is rendered with `readOnly={true}` so
 * SET AS PRIMARY and DELETE PHOTO are also hidden downstream.
 */
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface ItemPhotoGalleryProps {
  itemId: string;
  itemName: string;
  archived: boolean;
}

export function ItemPhotoGallery({
  itemId,
  itemName,
  archived,
}: ItemPhotoGalleryProps) {
  const { t } = useLingui();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const {
    photos,
    isLoading,
    isError,
    uploadFiles,
    setPrimary,
    deletePhoto,
    isUploading,
    isSettingPrimary,
    isDeleting,
  } = useItemPhotoGallery(itemId);

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesPicked = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const accepted: File[] = [];
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        if (file.size > MAX_FILE_SIZE) {
          addToast(
            t`${file.name} is over 10 MB. Try a smaller file or compress it first.`,
            "error"
          );
          continue;
        }
        const mimeLower = file.type.toLowerCase();
        if (mimeLower === "image/heic" || mimeLower === "image/heif") {
          addToast(
            t`HEIC not supported — convert to JPEG or PNG first.`,
            "error"
          );
          continue;
        }
        if (!ACCEPTED_MIME_TYPES.has(file.type)) {
          addToast(
            t`${file.name} is not a supported image format.`,
            "error"
          );
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length > 0) {
        await uploadFiles(accepted);
      }
      // Reset so picking the same file again still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadFiles, addToast, t]
  );

  const handleTileClick = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // --- Error state -------------------------------------------------------
  if (isError) {
    return (
      <RetroEmptyState
        title={t`COULD NOT LOAD PHOTOS`}
        body={t`Check your connection and try again.`}
      />
    );
  }

  // --- Loading state (initial) ------------------------------------------
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-3 gap-sm sm:gap-md lg:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square border-retro-thick border-retro-charcoal bg-retro-cream"
          />
        ))}
      </div>
    );
  }

  // --- Empty state (no photos yet) --------------------------------------
  if (photos.length === 0) {
    return (
      <>
        <RetroEmptyState
          title={t`NO PHOTOS YET`}
          body={t`Add photos to identify this item in the warehouse and at a glance.`}
          action={
            !archived ? (
              <RetroButton
                variant="neutral"
                onClick={handleAddClick}
                disabled={isUploading}
              >
                <Plus size={16} className="mr-xs" />
                {isUploading ? t`WORKING…` : t`+ ADD PHOTOS`}
              </RetroButton>
            ) : undefined
          }
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFilesPicked(e.target.files)}
        />
      </>
    );
  }

  // --- Populated gallery ------------------------------------------------
  return (
    <div className="flex flex-col gap-md">
      {!archived && (
        <div className="flex items-center justify-between gap-md">
          <p className="font-sans text-[14px] text-retro-charcoal/70">
            {t`JPEG, PNG, or WebP up to 10 MB each.`}
          </p>
          <RetroButton
            variant="neutral"
            onClick={handleAddClick}
            disabled={isUploading}
          >
            <Plus size={16} className="mr-xs" />
            {isUploading ? t`WORKING…` : t`+ ADD PHOTOS`}
          </RetroButton>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFilesPicked(e.target.files)}
      />

      <ItemPhotoGrid photos={photos} onTileClick={handleTileClick} />

      <ItemPhotoLightbox
        open={lightboxOpen}
        photos={photos}
        initialIndex={lightboxIndex}
        itemName={itemName}
        readOnly={archived}
        onClose={() => setLightboxOpen(false)}
        onSetPrimary={setPrimary}
        onDelete={deletePhoto}
        isSettingPrimary={isSettingPrimary}
        isDeleting={isDeleting}
      />
    </div>
  );
}
