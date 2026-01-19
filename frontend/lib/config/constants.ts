/**
 * Shared color configuration for charts and visualizations.
 * These are used by libraries like Recharts that need actual color values.
 *
 * Note: For Tailwind/CSS components, use CSS variables from globals.css instead.
 */

export const chartColors = {
  primary: "#3b82f6",   // blue-500
  success: "#22c55e",   // green-500
  warning: "#f59e0b",   // amber-500
  danger: "#ef4444",    // red-500
  purple: "#a855f7",    // purple-500
  teal: "#14b8a6",      // teal-500
  pink: "#ec4899",      // pink-500
} as const;

export const chartColorPalette = [
  chartColors.primary,
  chartColors.success,
  chartColors.warning,
  chartColors.danger,
  chartColors.purple,
  chartColors.teal,
  chartColors.pink,
] as const;

/**
 * Placeholder/fallback colors
 */
export const placeholderColors = {
  imageBg: "#e5e7eb",   // gray-200
} as const;

/**
 * Polling intervals (in milliseconds)
 */
export const pollingIntervals = {
  pendingCount: 30000,  // 30 seconds
} as const;
