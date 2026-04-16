import { ImageOff } from "../icons";

export interface ItemHeaderThumbnailProps {
  /** Primary photo thumbnail URL; if falsy a placeholder is rendered. */
  thumbnailUrl?: string | null;
  /** When true, renders at opacity-50 (used for archived item headers). */
  dimmed?: boolean;
}

/**
 * 64×64 retro-bordered thumbnail used in the item detail page header row.
 *
 * Matches ItemThumbnailCell's visual vocabulary (retro border, cream bg,
 * ImageOff fallback) but at a larger size so the header has a prominent
 * thumbnail. Pure presentational — mirrors ItemThumbnailCell.
 */
export function ItemHeaderThumbnail({
  thumbnailUrl,
  dimmed = false,
}: ItemHeaderThumbnailProps) {
  const boxClasses = `w-16 h-16 border-retro-thick border-retro-charcoal bg-retro-cream overflow-hidden flex-shrink-0 flex items-center justify-center ${
    dimmed ? "opacity-50" : ""
  }`;

  if (thumbnailUrl) {
    return (
      <div className={boxClasses}>
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={boxClasses} aria-hidden="true">
      <ImageOff size={24} className="text-retro-gray" />
    </div>
  );
}
