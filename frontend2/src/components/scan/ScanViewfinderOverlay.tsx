// frontend2/src/components/scan/ScanViewfinderOverlay.tsx
//
// Purely presentational overlay rendered INSIDE BarcodeScanner's relative
// container. Provides:
//   - 4 corner reticle brackets (3px ink-colored L-shapes, inset 16px)
//   - A 2px amber scanline sweeping top→bottom every 2s linear
//   - prefers-reduced-motion: reduce branch — scanline pinned at 50% vertical,
//     no animation, and overlay root carries data-reduced-motion="true".
//
// Keyframes are scoped via an inline <style> block (UI-SPEC §Viewfinder allows
// either inline <style> or globals.css; inline keeps Phase 64 localized and
// avoids touching globals.css).
//
// Takes no props — all layout/positioning is absolute inside the parent.
import { useEffect, useState } from "react";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Legacy API (older Safari)
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}

export function ScanViewfinderOverlay() {
  const reducedMotion = usePrefersReducedMotion();

  // Shared bracket leg styles — 3px ink thickness, ink fill.
  const legH = "absolute bg-retro-ink h-[3px] w-[24px]";
  const legV = "absolute bg-retro-ink w-[3px] h-[24px]";

  // Each corner positions a 24x24 wrapper 16px (spacing-md) inset from its edge.
  // The two legs within share the corner origin.
  const cornerBase = "absolute w-[24px] h-[24px]";

  return (
    <div
      data-testid="scan-viewfinder-overlay"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className="absolute inset-0 pointer-events-none"
    >
      {/* Scoped keyframes — React dedupes identical style nodes at runtime.
          Keeping this scoped avoids a globals.css edit for a single overlay. */}
      <style>{`
        @keyframes scan-sweep {
          from { transform: translateY(0%); }
          to { transform: translateY(calc(100% - 2px)); }
        }
        .animate-scan-sweep {
          animation: scan-sweep 2s linear infinite;
        }
      `}</style>

      {/* Top-left corner */}
      <div
        data-testid="viewfinder-corner"
        data-corner="tl"
        className={`${cornerBase} top-md left-md`}
      >
        <div className={`${legH} top-0 left-0`} />
        <div className={`${legV} top-0 left-0`} />
      </div>

      {/* Top-right corner */}
      <div
        data-testid="viewfinder-corner"
        data-corner="tr"
        className={`${cornerBase} top-md right-md`}
      >
        <div className={`${legH} top-0 right-0`} />
        <div className={`${legV} top-0 right-0`} />
      </div>

      {/* Bottom-left corner */}
      <div
        data-testid="viewfinder-corner"
        data-corner="bl"
        className={`${cornerBase} bottom-md left-md`}
      >
        <div className={`${legH} bottom-0 left-0`} />
        <div className={`${legV} bottom-0 left-0`} />
      </div>

      {/* Bottom-right corner */}
      <div
        data-testid="viewfinder-corner"
        data-corner="br"
        className={`${cornerBase} bottom-md right-md`}
      >
        <div className={`${legH} bottom-0 right-0`} />
        <div className={`${legV} bottom-0 right-0`} />
      </div>

      {/* Scanline — animated (top→bottom) unless prefers-reduced-motion:reduce,
          in which case pinned at vertical center with no animation. */}
      <div
        data-testid="viewfinder-scanline"
        className={
          reducedMotion
            ? "absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-retro-amber opacity-40 shadow-[0_0_8px_0_#D4A017]"
            : "absolute left-0 right-0 top-0 h-[2px] bg-retro-amber opacity-60 shadow-[0_0_8px_0_#D4A017] animate-scan-sweep"
        }
      />
    </div>
  );
}
