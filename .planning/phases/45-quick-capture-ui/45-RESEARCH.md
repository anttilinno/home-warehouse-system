# Phase 45: Quick Capture UI - Research

**Researched:** 2026-02-27
**Domain:** Mobile-first camera capture UI, single-route React flow, offline item creation, haptic/audio feedback
**Confidence:** HIGH

## Summary

Phase 45 builds the user-facing quick capture flow on top of Phase 44's infrastructure (IndexedDB photo store, auto-SKU hook, batch capture context, offline mutation wiring). The work is purely frontend -- a new route page at `/dashboard/items/quick-capture` with a camera-first layout, a minimal name-only form, save-and-reset loop, session counter, and haptic/audio feedback on save. The FAB gets a new "Quick Capture" action to enter this flow.

The critical architectural constraint is the single-route design for iOS camera permission persistence. Like the existing scan page (`/dashboard/scan`), the quick capture page must keep the camera active without navigating away. The existing `InlinePhotoCapture` component uses `<input type="file" capture="environment">` which triggers the native camera -- this is NOT a live viewfinder but an input-based capture. For a "viewfinder immediately" experience (QC-02), the phase needs to either auto-trigger the file input on mount or build a live camera preview using `getUserMedia`. The `<input capture>` approach is simpler and more reliable across iOS/Android but does not show a persistent viewfinder -- the user must tap to activate the camera each time.

**Primary recommendation:** Use the existing `<input capture="environment">` pattern from `InlinePhotoCapture` as the foundation. Adapt it for multi-photo capture (1-5 photos per item) with thumbnail strip. Build the page as a single full-screen component that never navigates. Wire `useOfflineMutation` for item creation, `useCapturePhotos` for photo blob storage, `useBatchCapture` for sticky settings, `useAutoSKU` for SKU generation. Add "Quick Capture" action to FAB via `useFABActions`. Use existing `triggerHaptic("success")` from `use-haptic.ts` and `playSuccessBeep()` from `scanner/feedback.ts` for save feedback.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QC-01 | User can open quick capture mode from the floating action button | Add "Quick Capture" action (Camera icon) to `useFABActions` default actions. Route to `/dashboard/items/quick-capture`. FAB supports variable action counts via radial arc calculation. |
| QC-02 | User sees camera viewfinder immediately on entering quick capture | Auto-trigger the hidden camera file input on mount via `useEffect` + `ref.current.click()`. This opens the native camera immediately. Alternative: `getUserMedia` live preview -- more complex but true viewfinder. Recommended: auto-trigger file input for reliability. |
| QC-03 | User can take 1-5 photos per item with tap-to-capture | Multi-photo state array in component. Each captured photo compressed via existing `compressImage()`, stored as blob URL preview in component state. Thumbnail strip below camera area shows captured photos with delete capability. Enforce max 5 with UI counter. |
| QC-04 | User types only item name to save (single required field) | Single `<input>` with auto-focus after photo capture. Form submission calls `useOfflineMutation` with `{ sku: generateSKU(), name, needs_review: true, category_id: batchSettings.categoryId }`. No other fields required. |
| QC-06 | After saving, form resets instantly and camera is ready for next item | On save: clear photo array, clear name input, auto-trigger camera file input again. No navigation -- state reset within the same component. Use `key` prop pattern or manual state reset. |
| QC-07 | User sees running count of items captured this session | `useBatchCapture().captureCount` and `incrementCaptureCount()` already exist in the batch capture context from Phase 44. Display as badge/counter in the capture UI. |
| QC-08 | User feels haptic/audio feedback on successful save | Call `triggerHaptic("success")` from `use-haptic.ts` (ios-haptics for iOS 17.4+, navigator.vibrate for Android) and `playSuccessBeep()` from `scanner/feedback.ts` (Web Audio API, no external files). Initialize AudioContext on first user interaction. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | Component framework | Project standard, all UI built with React |
| next-intl | (project version) | i18n for all user-facing strings | Project standard -- 3 language files in `frontend/messages/` |
| ios-haptics | 0.1.4 | Cross-platform haptic feedback | Already used via `useHaptic` hook and `triggerHaptic` function |
| motion | 12.27 | Animations for transitions and feedback | Already used by FAB component. Can be used for save success animation. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | (project version) | Toast notifications | For error messages and save confirmations |
| lucide-react | (project version) | Icons (Camera, X, Check, etc.) | All icons in the project use lucide |
| idb | 8.0.3 | IndexedDB access for photo store | Already wrapped in `offline-db.ts`, used via `useCapturePhotos` hook |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<input capture>` for camera | `getUserMedia` + `<video>` live viewfinder | getUserMedia gives true live viewfinder but requires managing stream lifecycle, permissions API, fallbacks. Input capture is simpler, works offline, and is the pattern InlinePhotoCapture already uses. |
| Adapting `InlinePhotoCapture` directly | Building new capture component | InlinePhotoCapture is single-photo with preview/remove. Quick capture needs multi-photo (1-5) with thumbnail strip. Better to build a new `QuickCapturePhotos` component that reuses the image utilities. |
| Sheet/drawer for category/location selector | Inline dropdown | Sheet (bottom sheet) matches mobile-first pattern. Project already has `Sheet` from shadcn/radix. Better touch target for mobile. |

**Installation:**
```bash
# No new packages to install.
# All capabilities come from existing libraries and Phase 44 infrastructure.
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── app/[locale]/(dashboard)/dashboard/items/
│   └── quick-capture/
│       └── page.tsx                          # NEW: Route page (thin wrapper)
├── components/
│   └── quick-capture/
│       ├── batch-settings-bar.tsx            # EXISTS (Phase 44)
│       ├── quick-capture-page.tsx            # NEW: Main capture flow component
│       ├── capture-photo-strip.tsx           # NEW: Multi-photo thumbnail strip (1-5)
│       └── capture-counter.tsx               # NEW: Session counter badge
├── lib/
│   ├── hooks/
│   │   ├── use-auto-sku.ts                  # EXISTS (Phase 44)
│   │   └── use-capture-photos.ts            # EXISTS (Phase 44)
│   └── contexts/
│       └── batch-capture-context.tsx         # EXISTS (Phase 44)
```

### Pattern 1: Single-Route Camera Flow (Scan Page Pattern)

**What:** Keep all UI state on a single route to avoid iOS camera permission re-prompts. The scan page (`/dashboard/scan`) demonstrates this pattern -- the scanner stays mounted while overlays appear/disappear.
**When to use:** Any flow requiring persistent camera access on iOS PWA.
**Example:**
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/scan/page.tsx (existing pattern)
// The scanner component stays MOUNTED throughout the flow.
// Quick actions overlay on top (don't navigate away).
// This prevents iOS from re-requesting camera permissions.

// For quick capture: the entire capture-save-reset loop happens on one page.
// No router.push() calls during the capture session.
export default function QuickCapturePage() {
  // All state managed locally -- no navigation
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [name, setName] = useState("");
  // ...save resets state, never navigates
}
```

### Pattern 2: Auto-Trigger File Input on Mount

**What:** Programmatically click the hidden file input to open the camera immediately when the component mounts.
**When to use:** When the user expects to see the camera immediately on entering a capture flow (QC-02).
**Example:**
```typescript
// Auto-open camera on mount
const cameraInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  // Small delay to ensure DOM is ready
  const timer = setTimeout(() => {
    cameraInputRef.current?.click();
  }, 300);
  return () => clearTimeout(timer);
}, []);

// Hidden file input with capture="environment" for rear camera
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleCapture}
  className="sr-only"
/>
```

**Caveat:** Some browsers may block programmatic `.click()` on file inputs without a prior user gesture. The FAB tap that opens the quick capture page counts as a user gesture, but the navigation may break the gesture chain. If auto-trigger fails silently, fall back to a prominent "Take Photo" button. Test on real iOS Safari PWA.

### Pattern 3: Multi-Photo Capture with Thumbnail Strip

**What:** Manage an array of captured photos with inline thumbnails, allowing add/remove operations before saving.
**When to use:** Quick capture flow where 1-5 photos are captured per item.
**Example:**
```typescript
interface CapturedPhoto {
  id: string;          // UUID for key
  blob: Blob;          // Compressed image blob
  preview: string;     // Object URL for display
}

const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
const MAX_PHOTOS = 5;

const handleCapture = async (file: File) => {
  if (photos.length >= MAX_PHOTOS) return;
  const compressed = await compressImage(file, 1920, 1920, 0.85);
  const blob = compressed; // File extends Blob
  const preview = URL.createObjectURL(blob);
  setPhotos(prev => [...prev, { id: crypto.randomUUID(), blob, preview }]);
};

const handleRemovePhoto = (id: string) => {
  setPhotos(prev => {
    const photo = prev.find(p => p.id === id);
    if (photo) URL.revokeObjectURL(photo.preview);
    return prev.filter(p => p.id !== id);
  });
};

// Cleanup previews on unmount
useEffect(() => {
  return () => {
    photos.forEach(p => URL.revokeObjectURL(p.preview));
  };
}, []); // eslint-disable-line -- intentional cleanup on unmount only
```

### Pattern 4: Save-and-Reset Loop

**What:** After saving, immediately reset the form state and re-open the camera for the next item.
**When to use:** Rapid capture sessions where the user captures many items in sequence.
**Example:**
```typescript
const handleSave = async () => {
  if (!name.trim() || photos.length === 0) return;

  const sku = generateSKU();
  const tempId = await mutate({
    sku,
    name: name.trim(),
    needs_review: true,
    category_id: settings.categoryId || undefined,
  });

  // Store photos in IndexedDB linked to tempId
  for (const photo of photos) {
    await storePhoto(tempId, photo.blob);
  }

  // Feedback
  triggerHaptic("success");
  playSuccessBeep();
  incrementCaptureCount();

  // Reset form
  photos.forEach(p => URL.revokeObjectURL(p.preview));
  setPhotos([]);
  setName("");

  // Re-trigger camera
  setTimeout(() => cameraInputRef.current?.click(), 100);
};
```

### Anti-Patterns to Avoid

- **Navigating between routes during capture:** Breaks iOS camera permission persistence. The entire capture-save-reset loop must happen on `/dashboard/items/quick-capture` without `router.push()`.
- **Using InlinePhotoCapture as-is for multi-photo:** InlinePhotoCapture is a single-photo component with one preview slot. Quick capture needs 1-5 photos with a thumbnail strip. Build a new component reusing the image utilities (`compressImage`, `validateImageFile`, `createImagePreview`).
- **Blocking the save on photo compression:** Compress photos inline as they are captured (before save), not at save time. This keeps the save instant.
- **Forgetting to revoke Object URLs:** Each `URL.createObjectURL()` leaks memory if not revoked. Revoke on photo removal and on component unmount.
- **Not initializing AudioContext on user gesture:** iOS Safari requires AudioContext creation during a user gesture. Initialize on the first tap in the quick capture page (the FAB tap may not propagate). Call `initAudioContext()` in a `useEffect` that listens for the first interaction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image compression | Canvas resize logic | `compressImage()` from `lib/utils/image.ts` | Already handles 1920px max, 0.85 quality, returns File |
| Image validation | MIME type and size checks | `validateImageFile()` from `lib/utils/image.ts` | 10MB max, JPEG/PNG/GIF/WebP whitelist |
| Haptic feedback | Direct `navigator.vibrate()` | `triggerHaptic("success")` from `use-haptic.ts` | Cross-platform (iOS 17.4+ via ios-haptics, Android vibrate) |
| Audio feedback | HTML5 Audio element | `playSuccessBeep()` from `scanner/feedback.ts` | Web Audio API, no external files, works offline |
| Offline item creation | Custom fetch + retry | `useOfflineMutation` with `entity: "items"` | Full queue, optimistic write, entity-ordered sync, idempotency |
| Photo blob storage | Raw IndexedDB calls | `useCapturePhotos` hook (Phase 44) | Typed storePhoto/getPhotosByTempItemId/deletePhoto |
| Auto-SKU generation | Manual string concat | `useAutoSKU` hook (Phase 44) | `QC-{base36-ts}-{4-rand}` pattern, memoized |
| Batch settings state | Local useState | `useBatchCapture()` context (Phase 44) | sessionStorage persistence, display name resolution, capture count |
| Object URL management | Manual tracking | `createImagePreview` / `revokeImagePreview` from `lib/utils/image.ts` | Consistent pattern, avoids leaks |

**Key insight:** Phase 45 is almost entirely UI composition. Every data operation (offline mutation, photo storage, SKU generation, batch settings) was built in Phase 44. The work is wiring these hooks into a camera-first single-page UI with proper UX flow.

## Common Pitfalls

### Pitfall 1: iOS Camera Permission Loss on Navigation
**What goes wrong:** Navigating away from the quick capture page (e.g., opening batch settings on a new route) causes iOS Safari to revoke camera permissions. The user must re-grant permission when returning.
**Why it happens:** iOS Safari in PWA standalone mode treats each route change as a potential context switch. Camera permissions are tied to the page lifecycle.
**How to avoid:** Keep everything on one route. Batch settings selectors should be overlays (Sheet/bottom sheet), not separate routes. The save button resets state without navigating. The "done" button navigates back to items list.
**Warning signs:** Camera permission prompt appearing repeatedly during a capture session.

### Pitfall 2: Auto-Trigger File Input Blocked by Browser
**What goes wrong:** Calling `cameraInputRef.current.click()` programmatically may be blocked by the browser if no recent user gesture exists in the call chain.
**Why it happens:** Browsers require a user gesture for file input activation as a security measure. The user gesture from the FAB tap may not survive the Next.js route transition.
**How to avoid:** Have a fallback: show a large, prominent "Take Photo" button if the auto-trigger does not fire. On subsequent captures (after the first save), the save button tap IS a user gesture, so re-triggering the camera input works.
**Warning signs:** Camera not opening automatically on page load; no error logged.

### Pitfall 3: Object URL Memory Leaks
**What goes wrong:** Each captured photo creates a blob URL via `URL.createObjectURL()`. If not revoked, these persist in memory for the entire page lifetime, which is long for a single-route capture session.
**Why it happens:** Quick capture may process 50+ photos in a single session (10 items x 5 photos each). Without revoking, this accumulates hundreds of MB of blob references.
**How to avoid:** Revoke URLs in three places: (1) when a photo is removed from the thumbnail strip, (2) when the form resets after save, (3) on component unmount via cleanup effect.
**Warning signs:** Increasing memory usage over a long capture session. Browser tab crashing on older devices.

### Pitfall 4: Save Button Double-Tap Creating Duplicate Items
**What goes wrong:** Fast double-tap on save creates two items with different tempIds and identical names.
**Why it happens:** The save handler is async. If not debounced, a second tap fires before the first completes.
**How to avoid:** Use `isPending` from `useOfflineMutation` to disable the save button during the mutation. Set a local `isSaving` state that flips true immediately on tap (before the async work begins).
**Warning signs:** Duplicate items appearing in the items list after capture sessions.

### Pitfall 5: AudioContext Not Initialized on iOS
**What goes wrong:** The success beep does not play on iOS Safari because AudioContext was never created during a user gesture.
**Why it happens:** iOS Safari requires AudioContext creation within a user gesture event handler. If `initAudioContext()` is called in a useEffect (non-gesture context), it silently fails.
**How to avoid:** Call `initAudioContext()` in the onClick handler of the first interactive element the user taps (the "Take Photo" button or save button). The scan page does this with document-level click/touchstart listeners.
**Warning signs:** Beep works on Android/desktop but not on iOS. No error logged (fails silently).

### Pitfall 6: Missing Translation Keys
**What goes wrong:** New UI strings hardcoded in English only, breaking the 3-language i18n setup.
**Why it happens:** Quick capture has many new UI strings (button labels, counter text, validation messages) that need keys in all 3 message files.
**How to avoid:** Create a `quickCapture` namespace in all 3 message files (en.json, et.json, ru.json) as the first task. Use `useTranslations("quickCapture")` consistently.
**Warning signs:** Missing translation warnings in console. Raw translation keys showing in UI.

## Code Examples

### Quick Capture Page Route
```typescript
// Source: New file following app/[locale]/(dashboard)/dashboard/scan/page.tsx pattern
// frontend/app/[locale]/(dashboard)/dashboard/items/quick-capture/page.tsx
"use client";

import { QuickCapturePage } from "@/components/quick-capture/quick-capture-page";
import { BatchCaptureProvider } from "@/lib/contexts/batch-capture-context";

export default function QuickCaptureRoute() {
  return (
    <BatchCaptureProvider>
      <QuickCapturePage />
    </BatchCaptureProvider>
  );
}
```

### FAB Action Addition
```typescript
// Source: Extends frontend/lib/hooks/use-fab-actions.tsx
import { Camera } from "lucide-react";

const quickCaptureAction: FABAction = {
  id: "quick-capture",
  icon: <Camera className="h-5 w-5" />,
  label: "Quick capture",
  onClick: () => router.push("/dashboard/items/quick-capture"),
};

// Add to default actions (4 items):
const defaultActions = [quickCaptureAction, scanAction, addItemAction, logLoanAction];

// On items page, make it primary:
if (pathname === "/dashboard/items" || pathname.startsWith("/dashboard/items/")) {
  return [quickCaptureAction, addItemAction, scanAction];
}

// Hide FAB on quick capture page (user is already in capture mode):
if (pathname === "/dashboard/items/quick-capture") {
  return [];
}
```

### Combined Haptic + Audio Feedback
```typescript
// Source: Combines patterns from use-haptic.ts and scanner/feedback.ts
import { triggerHaptic } from "@/lib/hooks/use-haptic";
import { playSuccessBeep, initAudioContext } from "@/lib/scanner/feedback";

// Initialize audio on first user interaction
useEffect(() => {
  const handler = () => {
    initAudioContext();
    document.removeEventListener("click", handler);
    document.removeEventListener("touchstart", handler);
  };
  document.addEventListener("click", handler);
  document.addEventListener("touchstart", handler);
  return () => {
    document.removeEventListener("click", handler);
    document.removeEventListener("touchstart", handler);
  };
}, []);

// On successful save:
function onSaveSuccess() {
  triggerHaptic("success");  // ios-haptics for iOS, vibrate for Android
  playSuccessBeep();         // Web Audio 880Hz beep, no files needed
}
```

### Batch Settings Selector via Sheet
```typescript
// Source: Follows existing Sheet usage in dashboard-shell.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBatchCapture } from "@/lib/contexts/batch-capture-context";

function CategorySelector({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { setCategoryId } = useBatchCapture();
  const [categories, setCategories] = useState<Category[]>([]);

  // Load categories from IndexedDB (offline-capable)
  useEffect(() => {
    getAll<Category>("categories").then(setCategories);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh]">
        <SheetHeader>
          <SheetTitle>Select Category</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto py-4">
          {categories.map(cat => (
            <button
              key={cat.id}
              className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-muted"
              onClick={() => {
                setCategoryId(cat.id);
                onOpenChange(false);
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `capture="environment"` input trigger | Same -- still the standard for mobile web camera | Stable since HTML5 | No live viewfinder, but reliable cross-platform |
| Direct API calls for item creation | `useOfflineMutation` for offline-capable creation | v1.0 (2026-01-24) | Quick capture uses mutation queue, not direct API |
| Single audio beep file | Web Audio API oscillator | v1.3 (2026-01-31) | No external audio files, works offline, configurable |
| `navigator.vibrate()` only | ios-haptics + vibrate fallback | v1.3 (2026-01-31) | iOS 17.4+ Safari haptic support via hidden checkbox workaround |

**Deprecated/outdated:**
- None. All infrastructure is current and stable.

## Open Questions

1. **Auto-trigger file input on page mount -- does it work in iOS PWA after route transition?**
   - What we know: Browsers require a user gesture for `input[type=file].click()`. The FAB tap IS a user gesture, but Next.js route transition may break the gesture chain.
   - What's unclear: Whether the gesture propagates through Next.js router.push() into the new page's useEffect.
   - Recommendation: Implement auto-trigger with a fallback. If the auto-trigger fires, great (QC-02 satisfied). If not, show a large prominent "Take Photo" button as the first thing the user sees. The button tap provides the gesture for subsequent captures. Test on real iOS device.

2. **Should the "viewfinder" be a getUserMedia live preview or input-based capture?**
   - What we know: The success criteria says "see camera viewfinder immediately" (QC-02). `<input capture>` does NOT show a viewfinder -- it opens the native camera app on tap. `getUserMedia` with `<video>` shows a live viewfinder but adds complexity (stream management, permissions API, fallbacks, canvas snapshot for capture).
   - What's unclear: Whether the product intent is literally a live viewfinder or just "camera ready to capture."
   - Recommendation: Use `<input capture>` with auto-trigger for v1. It satisfies the spirit of QC-02 (camera opens immediately). If a persistent viewfinder is required, that is a separate enhancement using `getUserMedia`. The input-based approach matches the existing `InlinePhotoCapture` pattern and is proven reliable in the project.

3. **Photo thumbnail generation for session summary (COMP-04 in Phase 47)**
   - What we know: Phase 47 will show a session summary with thumbnails. The `CapturePhoto` type has no `thumbnail` field. The `generateThumbnail()` utility exists in `lib/utils/image.ts`.
   - What's unclear: Should Phase 45 pre-generate thumbnails at capture time to avoid regenerating them later?
   - Recommendation: Defer thumbnail storage to Phase 47. In Phase 45, use blob URL previews for the in-session thumbnail strip (they are already created for display). Thumbnail generation for post-session summary is a Phase 47 concern.

## Sources

### Primary (HIGH confidence)
- Codebase: `frontend/components/forms/inline-photo-capture.tsx` -- Camera capture pattern with `capture="environment"`, compression, preview
- Codebase: `frontend/app/[locale]/(dashboard)/dashboard/scan/page.tsx` -- Single-route camera flow pattern, iOS permission persistence
- Codebase: `frontend/lib/hooks/use-haptic.ts` -- Cross-platform haptic feedback via ios-haptics
- Codebase: `frontend/lib/scanner/feedback.ts` -- Web Audio API beep, AudioContext initialization on gesture
- Codebase: `frontend/lib/hooks/use-fab-actions.tsx` -- FAB action routing, route-aware action sets
- Codebase: `frontend/components/fab/floating-action-button.tsx` -- FAB radial menu, variable action count
- Codebase: `frontend/components/dashboard/dashboard-shell.tsx` -- FAB integration, provider hierarchy
- Codebase: `frontend/lib/hooks/use-offline-mutation.ts` -- Offline mutation queue, optimistic writes
- Codebase: `frontend/lib/hooks/use-capture-photos.ts` -- Photo blob CRUD for quickCapturePhotos store (Phase 44)
- Codebase: `frontend/lib/contexts/batch-capture-context.tsx` -- Batch settings context with session storage (Phase 44)
- Codebase: `frontend/lib/hooks/use-auto-sku.ts` -- Auto-SKU generation hook (Phase 44)
- Codebase: `frontend/lib/utils/image.ts` -- compressImage, validateImageFile, createImagePreview, generateThumbnail
- Codebase: `frontend/lib/db/types.ts` -- CapturePhoto type, OfflineDBSchema with quickCapturePhotos store
- Codebase: `frontend/lib/types/items.ts` -- Item/ItemCreate/ItemUpdate with needs_review field

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- v1.9 architecture research with data flow and component boundaries
- `.planning/phases/44-capture-infrastructure/44-RESEARCH.md` -- Phase 44 research confirming infrastructure decisions

### Tertiary (LOW confidence)
- None. All findings are codebase-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies, all existing libraries verified in codebase
- Architecture: HIGH - All patterns derived from existing codebase (scan page single-route, InlinePhotoCapture, FAB actions)
- Pitfalls: HIGH - Based on known iOS camera behavior, existing project patterns, and Phase 44 infrastructure

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- no external dependency changes expected)
