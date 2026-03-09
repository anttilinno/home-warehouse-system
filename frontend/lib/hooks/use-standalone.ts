"use client";

import { useState, useEffect } from "react";

/**
 * Returns true when the app is running in PWA standalone mode.
 *
 * Useful for working around OS behaviour that suspends the webview when
 * native UI (e.g. camera via `capture="environment"`) takes over the screen.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }, []);

  return standalone;
}
