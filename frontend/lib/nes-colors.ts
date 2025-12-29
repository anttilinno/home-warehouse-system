// NES Color Palette - Centralized color constants for retro theme
// These are hardcoded hex values because Tailwind can't resolve CSS vars in arbitrary values

export const NES_GREEN = "#92cc41";
export const NES_BLUE = "#209cee";
export const NES_RED = "#ce372b";
export const NES_YELLOW = "#f7d51d";

// Alias for consistency (some files used NES_AMBER)
export const NES_AMBER = NES_YELLOW;

// Chart colors array for Recharts
export const NES_CHART_COLORS = [
  NES_BLUE,
  NES_GREEN,
  NES_RED,
  NES_YELLOW,
  "#8b5cf6", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
];
