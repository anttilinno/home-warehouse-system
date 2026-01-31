"use client";

import { useCallback } from "react";
import { haptic, supportsHaptics } from "ios-haptics";

export type HapticPattern = "tap" | "success" | "error";

/**
 * Cross-platform haptic feedback hook
 * Uses ios-haptics library which works on:
 * - iOS 17.4+ Safari via hidden checkbox switch workaround
 * - Android via navigator.vibrate fallback
 */
export function useHaptic() {
  const triggerHaptic = useCallback((pattern: HapticPattern = "tap") => {
    if (!supportsHaptics) return;

    try {
      switch (pattern) {
        case "success":
          haptic.confirm();
          break;
        case "error":
          haptic.error();
          break;
        case "tap":
        default:
          haptic();
      }
    } catch {
      // Silently fail if haptics not supported
    }
  }, []);

  return { triggerHaptic };
}

/**
 * Direct haptic trigger for use outside React components
 * @param pattern - Type of haptic feedback
 */
export function triggerHaptic(pattern: HapticPattern = "tap"): void {
  if (!supportsHaptics) return;

  try {
    switch (pattern) {
      case "success":
        haptic.confirm();
        break;
      case "error":
        haptic.error();
        break;
      case "tap":
      default:
        haptic();
    }
  } catch {
    // Silently fail if haptics not supported
  }
}
