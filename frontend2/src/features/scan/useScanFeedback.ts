/**
 * useScanFeedback — beep + haptic + visual-flash trigger (SCAN-03 / RESEARCH
 * Pattern 5).
 *
 * - Audio: delegates to the 11-02 singleton-AudioContext beep
 *   (playSuccessBeep / playErrorBeep). `primeAudio()` must be called from a
 *   pointerdown handler to unlock iOS (Pitfall 4) — re-exposed here so the
 *   component wires it onto the page wrapper.
 * - Haptics: `ios-haptics` with the `supportsHaptics` gate — NO UA branching.
 *   The lib already abstracts the iOS-17.4+ (no `navigator.vibrate`) vs Android
 *   (`navigator.vibrate`) split internally (Pattern 5).
 * - Visual flash: a monotonically-incrementing `flash` signal the component
 *   watches to play the success animation. Under `prefers-reduced-motion`, the
 *   hook EXPOSES `reducedMotion` so the component renders the static-checkmark
 *   variant instead of the animated flash (UI-SPEC Surface 2 motion contract).
 */

import { useCallback, useState } from "react";
import { haptic, supportsHaptics } from "ios-haptics";
import { playErrorBeep, playSuccessBeep, primeAudio } from "@/lib/scanner";

export interface UseScanFeedbackResult {
  /** Success feedback: success beep + haptic.confirm() + bump the flash signal. */
  success: () => void;
  /** Error feedback: error beep + haptic.error(). */
  error: () => void;
  /** Bumped on each success() — the component watches it to play the flash. */
  flash: number;
  /** True under prefers-reduced-motion → component shows the static checkmark. */
  reducedMotion: boolean;
  /** Unlock audio from a pointerdown gesture (delegates to lib primeAudio). */
  primeAudio: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useScanFeedback(): UseScanFeedbackResult {
  // Evaluated once at mount; the page is short-lived and the OS pref does not
  // change mid-scan in practice (matches the legacy one-shot read).
  const [reducedMotion] = useState<boolean>(prefersReducedMotion);
  const [flash, setFlash] = useState(0);

  const success = useCallback(() => {
    playSuccessBeep();
    if (supportsHaptics) {
      haptic.confirm();
    }
    // Bump the flash signal; the component reacts to the change (animated flash
    // when motion is allowed, static checkmark under reduced motion).
    setFlash((n) => n + 1);
  }, []);

  const error = useCallback(() => {
    playErrorBeep();
    if (supportsHaptics) {
      haptic.error();
    }
  }, []);

  const prime = useCallback(() => {
    primeAudio();
  }, []);

  return { success, error, flash, reducedMotion, primeAudio: prime };
}
