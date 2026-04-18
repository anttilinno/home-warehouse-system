// frontend2/src/features/scan/hooks/useScanFeedback.ts
//
// React hook wrapping the `@/lib/scanner` feedback module. Two
// responsibilities:
//
//  - prime(): call from the page-wrapper onPointerDown handler (Phase 64
//    D-08). Idempotent per mount via `primedRef` — iOS Safari creates the
//    AudioContext in the suspended state and will only resume() inside the
//    opening user gesture, so we call resume exactly once on the first tap.
//
//  - trigger(): call from onScan / onSubmit. Fires beep + Vibration API
//    haptic (navigator.vibrate on Android; no-op elsewhere per D-17 — the
//    native iOS haptic dependency is deferred out of Phase 64).
//
// This hook delegates entirely to `@/lib/scanner`; it does not own an
// AudioContext (the module owns the singleton) and does not import any
// native-haptic package (D-17).
import { useCallback, useRef } from "react";
import { resumeAudioContext, triggerScanFeedback } from "@/lib/scanner";

export function useScanFeedback() {
  const primedRef = useRef(false);

  const prime = useCallback(() => {
    if (primedRef.current) return;
    primedRef.current = true;
    resumeAudioContext();
  }, []);

  const trigger = useCallback(() => {
    triggerScanFeedback();
  }, []);

  return { prime, trigger };
}
