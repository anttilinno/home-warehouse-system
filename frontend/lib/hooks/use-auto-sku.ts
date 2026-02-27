import { useCallback } from "react";

/**
 * Hook for generating automatic SKU codes during quick capture.
 * Format: QC-{base36-timestamp}-{4-random-chars} (~18 chars, within VARCHAR(50) limit).
 * Collision is astronomically unlikely (36^4 combinations per millisecond).
 */
export function useAutoSKU() {
  const generateSKU = useCallback((): string => {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `QC-${ts}-${rand}`;
  }, []);

  return { generateSKU };
}
