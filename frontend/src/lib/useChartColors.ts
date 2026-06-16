import { useEffect, useState } from "react";

// Dark Mode P3 — recharts takes JS color VALUES, not CSS vars, so the chart
// marks can't reference var(--chart-*) directly. This hook reads the three chart
// tokens off the computed root style and RE-reads them whenever <html
// data-theme> flips. It watches the attribute with a MutationObserver rather
// than consuming useTheme, so a chart restyles on a theme toggle WITHOUT
// requiring a ThemeProvider in its tree (charts render in isolation in tests and
// anywhere the boot script set data-theme directly).

export interface ChartColors {
  /** Mark stroke + value labels + axis baseline (`--chart-ink`). */
  ink: string;
  /** Gridlines (`--chart-grid`). */
  grid: string;
  /** Axis tick labels (`--chart-muted`). */
  muted: string;
}

// Light-theme fallbacks if a token is missing (e.g. JSDOM with no stylesheet).
const FALLBACK: ChartColors = {
  ink: "#26262e",
  grid: "#e7ddca",
  muted: "#5b5b66",
};

function readChartColors(): ChartColors {
  if (typeof globalThis.window === "undefined") return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    ink: read("--chart-ink", FALLBACK.ink),
    grid: read("--chart-grid", FALLBACK.grid),
    muted: read("--chart-muted", FALLBACK.muted),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(readChartColors);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readChartColors()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    // Re-read once: the attribute may have changed between the initial
    // useState and the observer attaching.
    setColors(readChartColors());
    return () => observer.disconnect();
  }, []);

  return colors;
}
