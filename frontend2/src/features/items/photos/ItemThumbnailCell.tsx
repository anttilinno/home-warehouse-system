import { ImageOff } from "../icons";

export interface ItemThumbnailCellProps {
  /** Primary photo thumbnail URL; if falsy a placeholder is rendered. */
  thumbnailUrl?: string | null;
  /** When true, renders at opacity-50 (used for archived item rows). */
  dimmed?: boolean;
  /**
   * Edge length in px; defaults to 40. Loan-row layouts (Phase 62) use 24px.
   * The inner ImageOff glyph scales with the box.
   */
  size?: number;
}

/**
 * Retro-bordered thumbnail cell used in the items list + loan rows (D-08).
 *
 * Default 40×40 matches the items list first column; the `size` prop lets
 * Phase 62 loan rows render tighter 24×24 cells without introducing a second
 * component. Pure presentational — no data fetching, no hooks beyond
 * module-level imports.
 */
export function ItemThumbnailCell({
  thumbnailUrl,
  dimmed = false,
  size = 40,
}: ItemThumbnailCellProps) {
  const glyphSize = Math.max(8, Math.round(size * 0.4));
  const boxClasses = `border-2 border-retro-charcoal bg-retro-cream overflow-hidden flex-shrink-0 flex items-center justify-center ${
    dimmed ? "opacity-50" : ""
  }`;
  const boxStyle = { width: size, height: size };

  if (thumbnailUrl) {
    return (
      <div className={boxClasses} style={boxStyle}>
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
    <div className={boxClasses} style={boxStyle} aria-hidden="true">
      <ImageOff size={glyphSize} className="text-retro-gray" />
    </div>
  );
}
