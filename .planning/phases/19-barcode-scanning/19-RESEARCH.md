# Phase 19: Barcode Scanning - Research

**Researched:** 2026-01-30
**Domain:** Mobile barcode/QR scanning with React, PWA camera access, multi-format code detection
**Confidence:** MEDIUM

## Summary

This research covers implementing barcode and QR code scanning for a PWA using React 19 and Next.js 16. The primary technology stack centers on **@yudiel/react-qr-scanner v2.5.x**, which wraps the native Barcode Detection API with ZXing-WASM fallback for broader browser support.

The most critical finding is that **iOS Safari PWAs have volatile camera permissions** - users must re-grant permission each session due to WebKit bug #215884. The recommended mitigation is a single-page scan flow that keeps the scanner component mounted, avoiding page navigation that triggers permission re-requests. Additionally, the **Barcode Detection API is only natively supported in Chromium browsers**; Firefox and Safari require the ZXing-WASM polyfill which has performance implications.

**Primary recommendation:** Use @yudiel/react-qr-scanner with the barcode-detector polyfill, implement a dedicated /scan page that doesn't unmount the scanner during quick actions, reduce FPS to 5-10 for mobile performance, and provide manual entry fallback for damaged/difficult codes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @yudiel/react-qr-scanner | ^2.5.1 | React scanner component | Built-in UI components (torch, finder), TypeScript support, active maintenance |
| barcode-detector | ^3.0.0 | Barcode Detection API polyfill | ZXing-WASM based, 31.5KB minzipped, W3C-compliant API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb | 8.0.3 | IndexedDB wrapper | Already in project - use for scan history persistence |
| fuse.js | 7.1.0 | Fuzzy search | Already in project - code lookup via Phase 18 indices |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @yudiel/react-qr-scanner | html5-qrcode | More mature but larger bundle, less React-native API |
| @yudiel/react-qr-scanner | STRICH SDK | Commercial, better iOS support but licensing cost |
| barcode-detector polyfill | @nicolo-ribaudo/barcode-detection | Alternative polyfill, less actively maintained |

**Installation:**
```bash
bun add @yudiel/react-qr-scanner barcode-detector
```

## Architecture Patterns

### Recommended Project Structure
```
components/
├── scanner/
│   ├── barcode-scanner.tsx      # Main scanner component wrapping @yudiel/react-qr-scanner
│   ├── quick-action-menu.tsx    # Post-scan action menu (loan/move/view/repair)
│   ├── manual-entry-input.tsx   # Fallback manual barcode entry
│   ├── scan-feedback.tsx        # Visual/audio/haptic feedback handler
│   └── scan-history-list.tsx    # Recent scans display
lib/
├── hooks/
│   └── use-barcode-scanner.ts   # Scanner state management hook
├── scanner/
│   ├── scan-lookup.ts           # IndexedDB short_code lookup logic
│   ├── scan-history.ts          # localStorage scan history CRUD
│   └── feedback.ts              # Audio beep + haptic utilities
app/
└── [locale]/dashboard/
    └── scan/
        └── page.tsx             # Single-page scan flow (no navigation during scan)
```

### Pattern 1: Single-Page Scan Flow for iOS PWA
**What:** Keep scanner component mounted throughout the scan-action workflow to avoid iOS camera permission re-requests.
**When to use:** Always on iOS PWAs, recommended for all mobile.
**Example:**
```typescript
// Source: Based on STRICH knowledge base recommendations
// app/[locale]/dashboard/scan/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues
const BarcodeScanner = dynamic(
  () => import("@/components/scanner/barcode-scanner"),
  { ssr: false }
);

export default function ScanPage() {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);

  // CRITICAL: Don't unmount scanner when showing actions
  // Just overlay the action menu while keeping scanner paused
  return (
    <div className="relative h-full">
      <BarcodeScanner
        paused={showActions}
        onScan={(result) => {
          setScannedCode(result[0]?.rawValue);
          setShowActions(true);
        }}
      />
      {showActions && (
        <QuickActionMenu
          code={scannedCode}
          onClose={() => {
            setScannedCode(null);
            setShowActions(false);
          }}
        />
      )}
    </div>
  );
}
```

### Pattern 2: Polyfill Registration for Barcode Detection API
**What:** Register barcode-detector polyfill at app initialization for Safari/Firefox.
**When to use:** Always, before any scanner component mounts.
**Example:**
```typescript
// Source: https://github.com/Sec-ant/barcode-detector
// lib/scanner/init-polyfill.ts
"use client";

// Register polyfill - only runs on client, only if native API missing
if (typeof window !== "undefined") {
  import("barcode-detector/polyfill").then(() => {
    console.log("[Scanner] Barcode Detection API polyfill registered");
  });
}

// For component usage:
// components/scanner/barcode-scanner.tsx
import { Scanner } from "@yudiel/react-qr-scanner";
import "@/lib/scanner/init-polyfill"; // Ensure polyfill loads

export function BarcodeScanner({ onScan, paused }: Props) {
  return (
    <Scanner
      onScan={onScan}
      paused={paused}
      formats={["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128"]}
      scanDelay={200}
      components={{
        torch: true,
        finder: true,
        audio: true,
      }}
    />
  );
}
```

### Pattern 3: IndexedDB Short Code Lookup
**What:** Look up scanned codes against items/containers/locations in IndexedDB.
**When to use:** After successful scan to identify the entity.
**Example:**
```typescript
// Source: Based on existing fuse-index.ts pattern
// lib/scanner/scan-lookup.ts
import { getAll } from "@/lib/db/offline-db";
import type { Item } from "@/lib/types/items";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";

export type EntityMatch =
  | { type: "item"; entity: Item }
  | { type: "container"; entity: Container }
  | { type: "location"; entity: Location }
  | { type: "not_found"; code: string };

export async function lookupByShortCode(code: string): Promise<EntityMatch> {
  // Parallel lookup across all entity types
  const [items, containers, locations] = await Promise.all([
    getAll<Item>("items"),
    getAll<Container>("containers"),
    getAll<Location>("locations"),
  ]);

  // Exact match on short_code field
  const item = items.find((i) => i.short_code === code);
  if (item) return { type: "item", entity: item };

  const container = containers.find((c) => c.short_code === code);
  if (container) return { type: "container", entity: container };

  const location = locations.find((l) => l.short_code === code);
  if (location) return { type: "location", entity: location };

  // Also check item barcode field
  const itemByBarcode = items.find((i) => i.barcode === code);
  if (itemByBarcode) return { type: "item", entity: itemByBarcode };

  return { type: "not_found", code };
}
```

### Pattern 4: Audio Feedback with Web Audio API
**What:** Generate beep sound on successful scan using AudioContext.
**When to use:** For immediate feedback without loading external audio files.
**Example:**
```typescript
// Source: https://ourcodeworld.com/articles/read/1627/how-to-easily-generate-a-beep-notification-sound-with-javascript
// lib/scanner/feedback.ts
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function playBeep(
  frequency: number = 800,
  duration: number = 150,
  volume: number = 0.3
): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.value = volume;

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (error) {
    console.warn("[Feedback] Audio beep failed:", error);
  }
}

export function triggerHaptic(pattern: number | number[] = 50): void {
  // navigator.vibrate not supported on iOS Safari
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
```

### Anti-Patterns to Avoid
- **Page navigation after scan:** On iOS PWA, navigating to a detail page unmounts the scanner and triggers permission re-request on return. Use overlays instead.
- **High FPS scanning:** Setting FPS above 15 causes battery drain and heat on mobile. Use 5-10 FPS.
- **Immediate scan processing:** Add scanDelay (200-500ms) to prevent duplicate reads of same code.
- **Blocking main thread during lookup:** Always use async IndexedDB operations.
- **Relying solely on native Barcode Detection API:** Firefox and Safari don't support it natively.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR/Barcode decoding | Custom image processing | @yudiel/react-qr-scanner + barcode-detector | ZXing handles 1D/2D format variations, damaged codes, angles |
| Camera stream management | Raw getUserMedia | @yudiel/react-qr-scanner | Handles device enumeration, torch, zoom, iOS quirks |
| Beep sound | Loading .mp3 files | Web Audio API oscillator | No network request, works offline, instant playback |
| Scan history storage | Custom file system | localStorage | 10 scans at ~200 bytes each = trivial size |
| Short code lookup | Custom search | Existing IndexedDB stores | Phase 18 already indexed short_code with Fuse.js |

**Key insight:** Barcode scanning libraries have years of edge case handling for camera permissions, format quirks, and mobile-specific issues. Custom implementations inevitably encounter the same problems.

## Common Pitfalls

### Pitfall 1: iOS PWA Camera Permission Volatility
**What goes wrong:** User must re-grant camera permission every time they open the PWA or navigate away from scan page.
**Why it happens:** WebKit bug #215884 - Safari doesn't persist camera permissions for PWAs.
**How to avoid:**
- Keep scanner component mounted (paused, not unmounted) during quick actions
- Use overlay UI rather than page navigation for post-scan actions
- Add clear user messaging about iOS limitation if permission denied
**Warning signs:** QA reports "works in Safari but not when added to home screen"

### Pitfall 2: Barcode Detection API Not Available
**What goes wrong:** Scanner silently fails or shows blank on Firefox/Safari.
**Why it happens:** Barcode Detection API only natively supported in Chromium (Chrome, Edge, Opera).
**How to avoid:**
- Always include barcode-detector polyfill
- Import polyfill before scanner component
- Test in Firefox, Safari, and Safari iOS
**Warning signs:** Works in Chrome but fails in other browsers

### Pitfall 3: Torch Not Working on Some Devices
**What goes wrong:** Flashlight toggle has no effect.
**Why it happens:**
- Torch only works in Chromium browsers (not iOS Safari at all)
- Some devices don't expose torch capability on all cameras (e.g., wide-angle lens)
- Library auto-disables torch when zoom is active
**How to avoid:**
- Check `MediaTrackCapabilities.torch` before showing toggle
- Hide torch button on iOS Safari entirely
- Don't enable zoom and torch simultaneously
**Warning signs:** Works on some Android phones but not others

### Pitfall 4: Battery Drain from Continuous Scanning
**What goes wrong:** Device heats up, battery drains quickly during warehouse use.
**Why it happens:** High FPS (15+) keeps camera and CPU busy.
**How to avoid:**
- Set low FPS (5-10 for scanning, 30 only for preview)
- Use scan region (viewfinder box) to limit processing area
- Add manual stop/pause controls
**Warning signs:** Users complain about phone getting hot during shift

### Pitfall 5: Audio Not Playing on First Scan (iOS)
**What goes wrong:** Beep sound doesn't play on first successful scan.
**Why it happens:** iOS Safari requires user gesture before playing audio.
**How to avoid:**
- Initialize AudioContext on first user interaction (tap to start scanning button)
- Use @yudiel/react-qr-scanner's built-in sound prop which handles this
- Fall back gracefully if audio fails
**Warning signs:** Sound works on second scan but not first

### Pitfall 6: Haptic Feedback Not Working on iOS
**What goes wrong:** `navigator.vibrate()` has no effect on iPhone.
**Why it happens:** iOS Safari does not support the Vibration API at all.
**How to avoid:**
- Use ios-haptics library (triggers haptic via hidden checkbox trick on iOS 18+)
- Or accept that haptic is Android-only and don't promise it for iOS
- Rely on audio + visual feedback on iOS
**Warning signs:** Android users get haptic, iOS users don't

## Code Examples

Verified patterns from official sources:

### Scanner Component with Next.js Dynamic Import
```typescript
// Source: @yudiel/react-qr-scanner npm documentation
// components/scanner/barcode-scanner.tsx
"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { IDetectedBarcode } from "@yudiel/react-qr-scanner";

// Dynamic import required for Next.js to avoid SSR issues
const Scanner = dynamic(
  () => import("@yudiel/react-qr-scanner").then((mod) => mod.Scanner),
  { ssr: false }
);

interface BarcodeScannerProps {
  onScan: (result: IDetectedBarcode[]) => void;
  onError?: (error: Error) => void;
  paused?: boolean;
  formats?: string[];
}

export function BarcodeScanner({
  onScan,
  onError,
  paused = false,
  formats = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
}: BarcodeScannerProps) {
  const [torchSupported, setTorchSupported] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);

  // Check torch support on mount (won't work on iOS)
  useEffect(() => {
    const checkTorch = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(capabilities?.torch === true);
        stream.getTracks().forEach(t => t.stop());
      } catch {
        setTorchSupported(false);
      }
    };
    checkTorch();
  }, []);

  return (
    <div ref={scannerRef} className="relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden">
      <Scanner
        onScan={onScan}
        onError={onError}
        paused={paused}
        formats={formats}
        scanDelay={200}
        allowMultiple={false}
        components={{
          torch: torchSupported,
          finder: true,
          audio: true,
        }}
        styles={{
          container: { width: "100%", height: "100%" },
          video: { objectFit: "cover" },
        }}
        constraints={{
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }}
      />
    </div>
  );
}
```

### Scan History with localStorage
```typescript
// Source: Standard PWA pattern with localStorage
// lib/scanner/scan-history.ts
const SCAN_HISTORY_KEY = "hws-scan-history";
const MAX_HISTORY_SIZE = 10;

export interface ScanHistoryEntry {
  code: string;
  format: string;
  entityType: "item" | "container" | "location" | "unknown";
  entityId?: string;
  entityName?: string;
  timestamp: number;
}

export function getScanHistory(): ScanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SCAN_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addToScanHistory(entry: Omit<ScanHistoryEntry, "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getScanHistory();
    const newEntry: ScanHistoryEntry = { ...entry, timestamp: Date.now() };

    // Remove duplicate of same code if exists
    const filtered = history.filter((h) => h.code !== entry.code);

    // Add to front, limit size
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("[ScanHistory] Failed to save:", error);
  }
}

export function clearScanHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SCAN_HISTORY_KEY);
}
```

### Quick Action Menu Component
```typescript
// Source: Based on existing shadcn/ui patterns in codebase
// components/scanner/quick-action-menu.tsx
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MapPin, Box, Wrench, ArrowRight, Eye, Plus } from "lucide-react";
import type { EntityMatch } from "@/lib/scanner/scan-lookup";

interface QuickActionMenuProps {
  match: EntityMatch;
  onAction: (action: string) => void;
  onClose: () => void;
}

export function QuickActionMenu({ match, onAction, onClose }: QuickActionMenuProps) {
  const t = useTranslations("scanner.actions");

  if (match.type === "not_found") {
    return (
      <Card className="absolute bottom-4 left-4 right-4 z-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            {t("notFound")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t("notFoundDescription", { code: match.code })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("scanAgain")}
            </Button>
            <Button onClick={() => onAction("create")} className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              {t("createItem")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const icon = match.type === "item" ? Package : match.type === "container" ? Box : MapPin;
  const Icon = icon;
  const name = "name" in match.entity ? match.entity.name : "";

  const actions = match.type === "item"
    ? ["view", "loan", "move", "repair"]
    : ["view", "move"];

  return (
    <Card className="absolute bottom-4 left-4 right-4 z-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {name}
        </CardTitle>
        <p className="text-sm text-muted-foreground capitalize">{match.type}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              variant="outline"
              onClick={() => onAction(action)}
              className="justify-start"
            >
              {action === "view" && <Eye className="h-4 w-4 mr-2" />}
              {action === "loan" && <ArrowRight className="h-4 w-4 mr-2" />}
              {action === "move" && <MapPin className="h-4 w-4 mr-2" />}
              {action === "repair" && <Wrench className="h-4 w-4 mr-2" />}
              {t(action)}
            </Button>
          ))}
        </div>
        <Button variant="ghost" onClick={onClose} className="w-full mt-2">
          {t("scanAgain")}
        </Button>
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ZXing-JS pure JavaScript | ZXing-WASM via barcode-detector | 2024 | 5-10x faster decoding, lower battery usage |
| html5-qrcode monolith | @yudiel/react-qr-scanner | 2023 | Better React integration, smaller bundle |
| Always request getUserMedia | Barcode Detection API | 2020 (Chrome) | Native hardware acceleration where available |
| Custom canvas processing | Built-in viewfinder/tracker | 2024 | Less code, better performance |

**Deprecated/outdated:**
- **quaggaJS**: Abandoned, last update 2018
- **instascan**: Unmaintained since 2019
- **react-qr-reader v2**: Replaced by v3+ with different API
- **ZXing-JS browser layer**: Maintainers recommend using barcode-detector polyfill instead

## Open Questions

Things that couldn't be fully resolved:

1. **iOS 18+ Barcode Detection API Status**
   - What we know: One source claims Barcode Detection API "does not work on iOS 18"
   - What's unclear: Whether this is specific versions, specific formats, or universal
   - Recommendation: Test on iOS 18 device with polyfill, fall back to polyfill regardless

2. **Exact FPS for Optimal Mobile Performance**
   - What we know: 5-10 FPS recommended for scanning, 30 FPS for smooth preview
   - What's unclear: @yudiel/react-qr-scanner default FPS, whether it exposes FPS control
   - Recommendation: Use scanDelay prop (200ms = ~5 FPS effective), benchmark on target devices

3. **Torch Availability Detection Reliability**
   - What we know: getCapabilities().torch should indicate support
   - What's unclear: Edge cases where torch reports available but doesn't work
   - Recommendation: Implement with graceful degradation, test on multiple Android devices

## Sources

### Primary (HIGH confidence)
- [@yudiel/react-qr-scanner GitHub](https://github.com/yudielcurbelo/react-qr-scanner) - API documentation, releases (v2.5.1 Jan 2023)
- [barcode-detector GitHub](https://github.com/Sec-ant/barcode-detector) - Polyfill usage, 31.5KB bundle size
- [MDN MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints) - Torch/camera API

### Secondary (MEDIUM confidence)
- [STRICH Knowledge Base - iOS PWA Camera Issues](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa) - iOS PWA workarounds
- [STRICH React Tutorial](https://strich.io/blog/posts/react-web-app-barcode-scanner/) - React integration patterns
- [WebKit Bug #215884](https://bugs.webkit.org/show_bug.cgi?id=215884) - Camera permission persistence issue

### Tertiary (LOW confidence)
- WebSearch results about iOS 18 Barcode Detection API status - needs device validation
- FPS performance claims - needs benchmarking on actual devices
- ios-haptics library approach - untested with this codebase

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Library versions confirmed, but v2.5 from 2023 may have updates
- Architecture: HIGH - Patterns based on existing codebase patterns + official docs
- Pitfalls: HIGH - Well-documented iOS issues with multiple corroborating sources

**Research date:** 2026-01-30
**Valid until:** 30 days (library may release updates, iOS behavior may change)
