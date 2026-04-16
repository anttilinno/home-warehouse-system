import { ImageOff } from "../icons";

export interface ItemThumbnailCellProps {
  /** Primary photo thumbnail URL; if falsy a placeholder is rendered. */
  thumbnailUrl?: string | null;
  /** When true, renders at opacity-50 (used for archived item rows). */
  dimmed?: boolean;
}

/**
 * 40×40 retro-bordered thumbnail cell used in the items list first column (D-08).
 *
 * Renders either the primary photo thumbnail or an ImageOff placeholder glyph
 * inside the same square box so the list column has a consistent footprint.
 * Pure presentational — no data fetching, no hooks beyond module-level imports.
 */
export function ItemThumbnailCell({
  thumbnailUrl,
  dimmed = false,
}: ItemThumbnailCellProps) {
  const boxClasses = `w-10 h-10 border-2 border-retro-charcoal bg-retro-cream overflow-hidden flex-shrink-0 flex items-center justify-center ${
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
      <ImageOff size={16} className="text-retro-gray" />
    </div>
  );
}
