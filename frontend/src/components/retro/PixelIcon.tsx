import { PIXEL_ICON_PATHS, type PixelIconName } from "./pixelIconPaths";

export interface PixelIconProps {
  name: PixelIconName;
  /** Square px size; keep integer multiples of the 24px grid (18 or 20). */
  size?: number;
  className?: string;
}

// Pixelarticons atom (retro-OS chrome). Renders inline SVG from the bundled
// path map — no sprite file, no runtime fetch, no CDN. Color inherits via
// `currentColor`, so icons follow --fg-ink / --fg-on-accent in both themes.
// aria-hidden: the adjacent text label carries the semantics.
export function PixelIcon({
  name,
  size = 18,
  className = "",
}: Readonly<PixelIconProps>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {PIXEL_ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
