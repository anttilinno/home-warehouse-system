import { useLingui } from "@lingui/react/macro";
import { HazardStripe } from "@/components/retro";
import type { ItemPhoto } from "@/lib/api/itemPhotos";

export interface ItemPhotoTileProps {
  photo: ItemPhoto;
  isPrimary: boolean;
  onClick: () => void;
}

/**
 * Pure presentational square tile for the item-photo gallery.
 *
 * Three visual states (D-11 + UI-SPEC):
 *   1. thumbnail_status === "complete" with non-empty thumbnail_url → <img>
 *   2. thumbnail_status === "pending" | "processing" → HazardStripe + "PROCESSING…"
 *   3. thumbnail_url === "" (older photos without a thumbnail) → HazardStripe placeholder
 *
 * When `isPrimary` is true, an amber ★ PRIMARY badge is rendered in the
 * top-left corner (D-07). The tile root is a <button> so keyboard Tab focus
 * reaches it naturally and click handlers fire on Enter/Space.
 */
export function ItemPhotoTile({ photo, isPrimary, onClick }: ItemPhotoTileProps) {
  const { t } = useLingui();
  const showPlaceholder =
    !photo.thumbnail_url ||
    photo.thumbnail_status === "pending" ||
    photo.thumbnail_status === "processing";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t`Open photo ${photo.filename}`}
      className="relative block w-full aspect-square border-retro-thick border-retro-charcoal bg-retro-cream cursor-pointer overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-retro-amber hover:shadow-retro-raised"
    >
      {showPlaceholder ? (
        <div className="relative w-full h-full">
          <HazardStripe
            className="absolute inset-0 h-full opacity-60"
            height={undefined}
          />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[12px] uppercase text-retro-charcoal font-bold">
            {t`PROCESSING…`}
          </span>
        </div>
      ) : (
        <img
          src={photo.thumbnail_url}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
        />
      )}
      {isPrimary && (
        <span className="absolute top-xs left-xs px-xs py-[2px] bg-retro-amber text-retro-cream font-sans text-[12px] font-bold uppercase border border-retro-charcoal">
          ★ {t`PRIMARY`}
        </span>
      )}
    </button>
  );
}
