import { useEffect, useRef, useState, useId } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  useFloating,
} from "@floating-ui/react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroButton,
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { ChevronLeft, ChevronRight, Star, Trash2, X } from "../icons";
import type { ItemPhoto } from "@/lib/api/itemPhotos";

/**
 * Full-viewport photo lightbox mounted via FloatingPortal.
 *
 * The outer element is a `<div role="dialog" aria-modal="true">` rather than
 * a native `<dialog>` — the nested RetroConfirmDialog uses a real `<dialog>`
 * with top-layer semantics, which always stacks above the lightbox even
 * without z-index juggling. FloatingFocusManager traps Tab focus inside the
 * lightbox while it is open.
 *
 * Keyboard contract (D-03):
 *   - Escape: close
 *   - ArrowLeft/ArrowRight: navigate (clamped; no wrap)
 * Pitfall 4: when the photos prop shrinks (e.g. after a successful delete
 * invalidates the list), the current index is snapped to
 * `photos.length - 1`, or the lightbox closes if the gallery empties.
 *
 * Per D-11 the lightbox renders the full-size `url` field, not the
 * thumbnail, so users can see the real image even before the thumbnail
 * processing job completes.
 */
export interface ItemPhotoLightboxProps {
  open: boolean;
  photos: ItemPhoto[];
  initialIndex: number;
  itemName: string;
  /** Archived items render the lightbox in read-only mode: hides SET AS PRIMARY + DELETE. */
  readOnly: boolean;
  onClose: () => void;
  onSetPrimary: (photoId: string) => void;
  onDelete: (photoId: string) => Promise<void>;
  isSettingPrimary: boolean;
  isDeleting: boolean;
}

export function ItemPhotoLightbox({
  open,
  photos,
  initialIndex,
  itemName,
  readOnly,
  onClose,
  onSetPrimary,
  onDelete,
  isSettingPrimary,
  isDeleting,
}: ItemPhotoLightboxProps) {
  const { t } = useLingui();
  const titleId = useId();
  const confirmRef = useRef<RetroConfirmDialogHandle>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const { refs, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  // Reset currentIndex whenever the consumer opens us at a different tile.
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Pitfall 4: after photos prop shrinks (delete invalidation refetched),
  // snap the index back in-bounds — or close if the gallery is now empty.
  useEffect(() => {
    if (!open) return;
    if (photos.length === 0) {
      onClose();
      return;
    }
    if (currentIndex >= photos.length) {
      setCurrentIndex(photos.length - 1);
    }
  }, [open, photos.length, currentIndex, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((i) => Math.min(photos.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, photos.length]);

  if (!open || photos.length === 0) return null;

  // currentIndex may still be stale on the render that triggers the snap
  // effect above — clamp defensively so we never dereference `photos[3]` on
  // a length-2 array.
  const safeIndex = Math.min(currentIndex, photos.length - 1);
  const photo = photos[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === photos.length - 1;
  const isAlreadyPrimary = photo.is_primary;
  const fileSizeMb = (photo.file_size / (1024 * 1024)).toFixed(1);

  const handleDelete = async () => {
    await onDelete(photo.id);
    // Parent invalidated the query; the effect above snaps/closes on re-render.
  };

  return (
    <FloatingPortal>
      {/* Backdrop — 92% ink tint, click-to-close */}
      <div
        className="fixed inset-0 z-60 bg-retro-ink/92"
        onClick={onClose}
        aria-hidden="true"
      />
      <FloatingFocusManager context={context} initialFocus={0}>
        <div
          ref={refs.setFloating}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-60 flex flex-col items-center justify-center p-md"
          onClick={(e) => e.stopPropagation()}
        >
          <span id={titleId} className="sr-only">
            {t`Photo ${safeIndex + 1} of ${photos.length} for ${itemName}`}
          </span>

          {/* Close × — top right */}
          <div className="absolute top-md right-md">
            <RetroButton
              variant="neutral"
              onClick={onClose}
              aria-label={t`Close lightbox`}
            >
              <X size={20} />
            </RetroButton>
          </div>

          {/* Image — uses full-size url per D-11 */}
          <img
            src={photo.url}
            alt={t`Photo of ${itemName}, ${safeIndex + 1} of ${photos.length}`}
            className="max-w-[calc(100vw-64px)] max-h-[calc(100vh-192px)] object-contain border-retro-thick border-retro-cream"
            style={{ boxShadow: "4px 4px 0 var(--color-retro-amber)" }}
          />

          {/* Bottom control bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-retro-cream border-t-retro-thick border-retro-charcoal p-md flex flex-col gap-sm">
            <div className="flex items-center justify-between">
              <RetroButton
                variant="neutral"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={isFirst}
                aria-label={t`Previous photo`}
              >
                <ChevronLeft size={20} />
                <span className="hidden sm:inline ml-xs">{t`PREV`}</span>
              </RetroButton>

              <span
                className="font-mono text-[16px] text-retro-charcoal"
                aria-live="polite"
              >
                {safeIndex + 1} / {photos.length}
              </span>

              <RetroButton
                variant="neutral"
                onClick={() =>
                  setCurrentIndex((i) => Math.min(photos.length - 1, i + 1))
                }
                disabled={isLast}
                aria-label={t`Next photo`}
              >
                <span className="hidden sm:inline mr-xs">{t`NEXT`}</span>
                <ChevronRight size={20} />
              </RetroButton>
            </div>

            <div className="flex items-center justify-between gap-md">
              <span className="font-mono text-[14px] text-retro-charcoal/70 truncate">
                {photo.filename} · {fileSizeMb} MB
              </span>

              {!readOnly && (
                <div className="flex gap-sm">
                  <RetroButton
                    variant={isAlreadyPrimary ? "neutral" : "primary"}
                    disabled={isAlreadyPrimary || isSettingPrimary}
                    onClick={() => onSetPrimary(photo.id)}
                  >
                    <Star size={16} className="mr-xs" />
                    {isSettingPrimary
                      ? t`WORKING…`
                      : isAlreadyPrimary
                        ? t`★ PRIMARY`
                        : t`SET AS PRIMARY`}
                  </RetroButton>

                  <RetroButton
                    variant="neutral"
                    disabled={isDeleting}
                    onClick={() => confirmRef.current?.open()}
                  >
                    <Trash2 size={16} className="mr-xs text-retro-red" />
                    <span className="text-retro-red">
                      {isDeleting ? t`WORKING…` : t`DELETE PHOTO`}
                    </span>
                  </RetroButton>
                </div>
              )}
            </div>
          </div>

          <RetroConfirmDialog
            ref={confirmRef}
            variant="destructive"
            title={t`CONFIRM DELETE`}
            body={t`Permanently delete this photo? This cannot be undone.`}
            escapeLabel={t`KEEP PHOTO`}
            destructiveLabel={t`DELETE PHOTO`}
            onConfirm={handleDelete}
          />
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
