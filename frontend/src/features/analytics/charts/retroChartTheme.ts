// Sketch 009 — the SINGLE source of truth for the retro chart marks.
//
// Every chart mark (bar, area, donut slice, line marker) is a flat pastel FILL
// + 2px INK STROKE (#26262e), NO shadows on marks, square caps, NO recharts
// gradients. Lines get a thick pastel stroke + a thin ink overstroke; data
// points are square ink-stroked markers. Axis/value labels are IBM Plex Mono
// with tabular-nums. Silkscreen is panel TITLES ONLY (the Window owns those) —
// never axis labels or in-chart text.
//
// These constants are the ONLY place the sketch-009 marks are defined; every
// chart reads them so the look stays 1:1 with the mockup.

/** Ordered categorical series palette (locked, sketch 009). Each is a pastel
 * fill paired with its deep companion for any colored value text on white. */
export interface SeriesColor {
  /** Pastel fill — the recharts <Bar fill> / <Cell fill> / area fill. */
  fill: string;
  /** Deep companion for colored value text on white/cream (AA ≥4.5:1). */
  deep: string;
}

export const SERIES: readonly SeriesColor[] = [
  { fill: "#b8d8e8", deep: "#19526f" }, // series-1 blue   (titlebar-blue / accent-blue-deep)
  { fill: "#f4b8c4", deep: "#a8334f" }, // series-2 pink   (titlebar-pink / accent-pink-deep)
  { fill: "#b8e0c8", deep: "#1e6b43" }, // series-3 mint   (titlebar-mint / accent-mint-deep)
  { fill: "#f6e3a8", deep: "#7a5a12" }, // series-4 butter (titlebar-butter / warn-deep)
  { fill: "#e7ddca", deep: "#5b5b66" }, // series-5 sand   (overflow only / fg-muted)
] as const;

/** Walk the ordered palette; the 6th+ category reuses series-5 (sand). */
export function seriesAt(i: number): SeriesColor {
  if (i < SERIES.length) return SERIES[i];
  return SERIES[SERIES.length - 1];
}

/** Named single-series accents (single-series charts take the title-bar accent). */
export const SERIES_BLUE = SERIES[0];
export const SERIES_PINK = SERIES[1];
export const SERIES_MINT = SERIES[2];
export const SERIES_BUTTER = SERIES[3];

/** Every mark carries a 2px ink stroke. */
export const STROKE_WIDTH = 2;

// Dark Mode P3 — the mark colors (ink stroke, grid rule, muted ticks) flip
// between themes, so they're no longer module constants. Each chart reads them
// from useChartColors() and feeds them to these builders; the look stays 1:1
// with sketch-009 in light mode and inverts cleanly in dark. SERIES fills stay
// fixed pastels in both themes (same logic as the titlebars).

/** Shared mark props — spread onto every <Bar>/<Area>/<Cell>/marker. NO radius
 * (square caps), NO gradient defs. `ink` = the current `--chart-ink`. */
export function markProps(ink: string) {
  return { stroke: ink, strokeWidth: STROKE_WIDTH } as const;
}

/** recharts axisLine props — a 2px ink baseline. */
export function axisLineProps(ink: string) {
  return { stroke: ink, strokeWidth: STROKE_WIDTH } as const;
}

/** Axis tick label style: IBM Plex Mono, tabular-nums, muted fill. */
export function axisTickStyle(muted: string) {
  return {
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums" as const,
    fontSize: 10,
    fill: muted,
  };
}

/** Value label style: IBM Plex Mono, tabular-nums, ink fill (≥6px heavier). */
export function valueLabelStyle(ink: string) {
  return {
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums" as const,
    fontSize: 12,
    fontWeight: 600,
    fill: ink,
  };
}

/** Category (Plex Sans 12px) axis-label style for categorical axes. */
export function categoryLabelStyle(ink: string) {
  return {
    fontFamily: "var(--font-body)",
    fontSize: 12,
    fontWeight: 600,
    fill: ink,
  };
}

/** Props for the recharts <CartesianGrid> so the rule matches the table sand. */
export function gridProps(grid: string) {
  return { stroke: grid, strokeWidth: 1 } as const;
}

/**
 * Truncate a categorical axis label from the RIGHT (keep the head, append "…")
 * so long names don't overflow the fixed YAxis width and get clipped on the
 * LEFT — which hides the start of the name (bitten by long location codes).
 * `max` is tuned per chart to its YAxis `width`.
 */
export function truncateLabel(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
