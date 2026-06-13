/**
 * useTorch — torch capability probe + toggle boolean (SCAN-04 / RESEARCH
 * Pattern 4).
 *
 * Detect:
 *  - iOS (UA matches /iPad|iPhone|iPod/) → `supported = false` WITHOUT probing.
 *    iOS Safari never exposes a torch capability; probing would needlessly open
 *    the camera. The torch toggle auto-hides (component renders nothing when
 *    `supported === false`).
 *  - Non-iOS → probe a throwaway `getUserMedia({ video: { facingMode:
 *    'environment' } })`, read `track.getCapabilities().torch`, then STOP ALL
 *    probe tracks (release the camera), and set `supported` accordingly
 *    (legacy `barcode-scanner.tsx:62-86`).
 *
 * Apply is LIB-MANAGED (RESEARCH Pattern 4, approach 1): this hook returns the
 * `enabled` boolean; the 11-04 component passes `components={{ torch: supported
 * && enabled }}` and the scanner lib applies the constraint on ITS OWN stream.
 * This hook never calls `applyConstraints` itself — the probe-race makes the
 * direct path unreliable on Android (RESEARCH OQ2).
 */

import { useCallback, useEffect, useState } from "react";

export interface UseTorchResult {
  /** Whether the rear camera reports torch capability (false on iOS / no probe). */
  supported: boolean;
  /** Desired torch state — fed into the scanner lib's `components.torch`. */
  enabled: boolean;
  /** Flip `enabled`. */
  toggle: () => void;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

async function probeTorchSupport(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    const track = stream.getVideoTracks()[0];
    const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
      torch?: boolean;
    };
    // Release the probe stream — stop EVERY track so the camera light goes off.
    for (const t of stream.getTracks()) {
      t.stop();
    }
    return caps.torch === true;
  } catch {
    // No permission / no camera → treat as unsupported (silent, auto-hide).
    return false;
  }
}

export function useTorch(): UseTorchResult {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // iOS auto-hide: never probe (SCAN-04).
    if (isIOS()) {
      setSupported(false);
      return;
    }

    let cancelled = false;
    void probeTorchSupport().then((ok) => {
      if (!cancelled) setSupported(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => setEnabled((on) => !on), []);

  return { supported, enabled, toggle };
}
