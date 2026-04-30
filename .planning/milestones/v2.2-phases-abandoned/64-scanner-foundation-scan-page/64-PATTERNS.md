# Phase 64: Scanner Foundation & Scan Page — Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 28 (port-verbatim: 5 · rewrite: 3 · new: 16 · edit: 4)
**Analogs found:** 25 / 28
**No analog:** 3 (flagged — planner sets convention)

---

## File Classification

### Role legend

| Role | Meaning |
|------|---------|
| **port-verbatim** | 1:1 copy from legacy `/frontend/lib/scanner/*`, strip `"use client"` + adjust imports only |
| **rewrite** | Legacy `/frontend/components/scanner/*` re-implemented with retro atoms + Lingui; behavior preserved |
| **new** | Greenfield file (hook, retro-only component, test, type def, feature page shell) |
| **edit** | Small surgical change to an existing file |

### Data-flow legend

| Flow | Meaning |
|------|---------|
| **module-singleton** | Module-scope state (AudioContext, localStorage key) |
| **react-state** | React `useState` / `useEffect` lifecycle |
| **hook-wrap** | Hook that wraps a module-level API and exposes a React-friendly surface |
| **tanstack-query** | `useQuery`-shaped read (Phase 65 wires the real query) |
| **request-response** | User-event → callback |
| **feature-page** | Route-level orchestrator |
| **presentational** | Pure-render component (props in, JSX out) |
| **config** | Build-time / manifest edit |
| **i18n** | Lingui catalog |
| **test** | Vitest + RTL |

### Master file table

| # | File (target in `frontend2/`) | Role | Data Flow | Closest Analog | Match Quality |
|---|-------------------------------|------|-----------|----------------|---------------|
| 1 | `src/lib/scanner/init-polyfill.ts` | port-verbatim | module-singleton | `frontend/lib/scanner/init-polyfill.ts` | exact (legacy port) |
| 2 | `src/lib/scanner/feedback.ts` | port-verbatim | module-singleton | `frontend/lib/scanner/feedback.ts` | exact (legacy port) |
| 3 | `src/lib/scanner/scan-history.ts` | port-verbatim | module-singleton | `frontend/lib/scanner/scan-history.ts` | exact (legacy port) |
| 4 | `src/lib/scanner/types.ts` | port-verbatim (stripped) | — | `frontend/lib/scanner/types.ts` | exact (legacy port) |
| 5 | `src/lib/scanner/index.ts` | port-verbatim (minus scan-lookup) | — | `frontend/lib/scanner/index.ts` | exact (legacy port) |
| 6 | `src/lib/api/scan.ts` | new (stub) | tanstack-query | `frontend2/src/lib/api/inventory.ts` | role-match (smallest API scaffold) |
| 7 | `src/features/scan/hooks/useScanHistory.ts` | new | hook-wrap | `frontend2/src/features/items/hooks/useCategoryNameMap.ts` | role-match (hook returns derived state object) — **no localStorage analog in frontend2** |
| 8 | `src/features/scan/hooks/useScanFeedback.ts` | new | hook-wrap (module singleton) | `frontend2/src/features/taxonomy/hooks/useHashTab.ts` | role-match (useEffect+ref lifecycle pattern) — **no AudioContext analog** |
| 9 | `src/features/scan/hooks/useScanLookup.ts` | new (stub) | tanstack-query | `frontend2/src/features/items/hooks/useItem.ts` | exact (shape to match on Phase 65 swap) |
| 10 | `src/features/scan/ScanPage.tsx` | new (replaces stub) | feature-page | `frontend2/src/features/taxonomy/TaxonomyPage.tsx` | exact (3-tab RetroTabs page) |
| 11 | `src/features/scan/ScanHistoryList.tsx` | new (rewrite of legacy) | presentational | `frontend2/src/features/loans/panels/ItemLoanHistoryPanel.tsx` | exact (list-with-empty-state in RetroPanel) |
| 12 | `src/components/scan/BarcodeScanner.tsx` | rewrite | react-state (owns stream probe) | `frontend/components/scanner/barcode-scanner.tsx` (behavior) + `frontend2/src/features/items/ItemsListPage.tsx` (retro loading/error pattern) | role-match — **wraps 3rd-party lib in retro; no existing frontend2 3rd-party wrapper** |
| 13 | `src/components/scan/ManualBarcodeEntry.tsx` | rewrite | request-response | `frontend2/src/features/items/forms/ItemForm.tsx` | role-match (RetroInput + validation + submit) |
| 14 | `src/components/scan/ScanHistoryList.tsx` ⚠ (see §Placement) | rewrite | presentational | (same as row 11) | — |
| 15 | `src/components/scan/ScanErrorPanel.tsx` | new | presentational | `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` (error branch lines 40-55) + `frontend2/src/routes/index.tsx` NotFoundPage (lines 28-47) | exact (HazardStripe + RetroPanel + heading + body + action button) |
| 16 | `src/components/scan/ScanResultBanner.tsx` | new | presentational | `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` (success branch lines 71-127) | role-match (RetroPanel with code+format+CTA row) |
| 17 | `src/components/scan/ScanViewfinderOverlay.tsx` | new | presentational (CSS-animated) | no close analog | **no analog; planner sets convention** (CSS-only, `prefers-reduced-motion` gate) |
| 18 | `src/components/scan/ScanTorchToggle.tsx` | new | request-response | `frontend2/src/components/retro/RetroButton.tsx` consumer (any RetroButton call site with `aria-pressed`) | role-match — **no existing `aria-pressed` toggle button in frontend2** |
| 19 | `src/components/scan/index.ts` | new | — | `frontend2/src/lib/api/index.ts` | exact (barrel) |
| 20 | `src/lib/scanner/__tests__/init-polyfill.test.ts` | test | test | `frontend2/src/lib/api/__tests__/queryKeys.test.ts` | role-match (module function unit test) |
| 21 | `src/lib/scanner/__tests__/feedback.test.ts` | test | test | `frontend2/src/lib/__tests__/api.test.ts` (module-level mocks pattern) | role-match (mocks globals — AudioContext / navigator) |
| 22 | `src/lib/scanner/__tests__/scan-history.test.ts` | test | test | `frontend2/src/lib/api/__tests__/queryKeys.test.ts` | role-match (pure module, localStorage mocked) |
| 23 | `src/features/scan/hooks/__tests__/useScanHistory.test.ts` | test | test | `frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts` | exact (renderHook + QueryClient wrapper — adapt for non-query hook) |
| 24 | `src/features/scan/hooks/__tests__/useScanFeedback.test.ts` | test | test | `frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts` | role-match (renderHook pattern) |
| 25 | `src/features/scan/hooks/__tests__/useScanLookup.test.ts` | test | test | `frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts` | exact |
| 26 | `src/components/scan/__tests__/BarcodeScanner.test.tsx` | test | test | `frontend2/src/features/items/__tests__/ItemForm.test.tsx` (mocks external dep via `vi.mock`) | role-match |
| 27 | `src/components/scan/__tests__/ManualBarcodeEntry.test.tsx` | test | test | `frontend2/src/features/items/__tests__/ItemForm.test.tsx` | exact |
| 28 | `src/components/scan/__tests__/ScanErrorPanel.test.tsx` | test | test | `frontend2/src/components/retro/__tests__/RetroPanel.test.tsx` + `RetroEmptyState.test.tsx` | exact (variant switch + Lingui wrapper) |
| 29 | `src/components/scan/__tests__/ScanTorchToggle.test.tsx` | test | test | `frontend2/src/components/retro/__tests__/RetroButton.test.tsx` | role-match |
| 30 | `src/components/scan/__tests__/ScanResultBanner.test.tsx` | test | test | `frontend2/src/components/retro/__tests__/RetroPanel.test.tsx` | role-match |
| 31 | `src/components/scan/__tests__/ScanViewfinderOverlay.test.tsx` | test | test | `frontend2/src/components/retro/__tests__/HazardStripe.test.tsx` | role-match (purely presentational retro atom test) |
| 32 | `src/features/scan/__tests__/ScanPage.test.tsx` | test | test | `frontend2/src/features/taxonomy/__tests__/TaxonomyPage.test.tsx` + `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx` | exact (tab-switch feature-page test) |
| 33 | `src/features/scan/__tests__/fixtures.ts` | new (test helper) | test | `frontend2/src/features/items/__tests__/fixtures.ts` + `frontend2/src/features/taxonomy/__tests__/fixtures.tsx` | exact (re-export `renderWithProviders` + add `makeScanHistoryEntry` factory) |
| 34 | `src/test/mocks/yudiel-scanner.ts` | new (Wave 0 infra) | test | no analog | **no analog; planner sets convention** |
| 35 | `src/test/mocks/media-devices.ts` | new (Wave 0 infra) | test | no analog | **no analog; planner sets convention** |
| 36 | `vite.config.ts` | edit | config | current `vite.config.ts` — only needs `build.rollupOptions.output.manualChunks` added (no existing `manualChunks`, no existing `build` section) | partial (no existing manualChunks pattern; planner appends) |
| 37 | `package.json` | edit | config | existing deps block (lines 39-51) | exact (add 3 runtime deps + 1 devDep using same formatting) |
| 38 | `src/routes/index.tsx` | edit | config | current file lines 12 + 85 — swap static `ScanPage` import for `React.lazy` + wrap `<Route element>` in `<Suspense>` | role-match (no existing `React.lazy` route in file — planner introduces pattern) |
| 39 | `locales/en/messages.po` + `locales/et/messages.po` | edit | i18n | Phase 63 ET gap-fill pattern (run `bun run i18n:extract` after code lands, then hand-fill ET `msgstr`) | exact (Lingui CLI workflow) |

> **§Placement note on ScanHistoryList:** RESEARCH.md §Recommended Project Structure puts `ScanHistoryList.tsx` under `features/scan/`, not `components/scan/`. Row 11 is canonical; row 14 exists only to flag the potential confusion. Planner: put it in `features/scan/`.

---

## Pattern Assignments

Below: for each non-trivial file, the **analog path**, the **concrete excerpt to copy**, and the **adaptation notes** that apply. All excerpts are quoted with file paths + line numbers.

---

### 1. `src/lib/scanner/init-polyfill.ts` (port-verbatim, module-singleton)

**Analog:** `frontend/lib/scanner/init-polyfill.ts` (49 LOC)

**Copy verbatim except:**

Delete line 12:

```ts
"use client";
```

Everything else — lines 1-11 comment block, lines 13-49 (`polyfillLoaded` flag, `initBarcodePolyfill()`, `isBarcodeDetectionAvailable()`) — is a byte-for-byte port. See RESEARCH.md §Code Examples "Port: `init-polyfill.ts`" (lines 783-809) for the resulting file.

**Import convention (frontend2 style):** no path changes required — the one `import("barcode-detector/polyfill")` on line 35 is a bare specifier and resolves identically in Vite.

---

### 2. `src/lib/scanner/feedback.ts` (port-verbatim, module-singleton)

**Analog:** `frontend/lib/scanner/feedback.ts` (149 LOC)

**Module-scope singleton pattern to preserve** (lines 14-41):

```ts
let audioContext: AudioContext | null = null;
let audioInitialized = false;

export function initAudioContext(): void {
  if (audioInitialized || typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      audioInitialized = true;
      console.log("[Feedback] AudioContext initialized");
    }
  } catch (error) {
    console.warn("[Feedback] Failed to initialize AudioContext:", error);
  }
}
```

**Oscillator beep** (lines 69-105):

```ts
export function playBeep(frequency: number = 800, duration: number = 150, volume: number = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.value = volume;
    const startTime = ctx.currentTime;
    const endTime = startTime + duration / 1000;
    oscillator.start(startTime);
    oscillator.stop(endTime);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch (error) {
    console.warn("[Feedback] Audio beep failed:", error);
  }
}

export function playSuccessBeep(): void { playBeep(880, 100, 0.25); }
```

**Haptic + combined trigger** (lines 122-149):

```ts
export function triggerHaptic(pattern: number | number[] = 50): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch (error) {
    console.warn("[Feedback] Haptic feedback failed:", error);
  }
}

export function triggerScanFeedback(): void {
  playSuccessBeep();
  triggerHaptic(50);
}
```

**Adaptation:**

- Remove `"use client";` (line 12).
- **D-17 (locked):** Do NOT replace `navigator.vibrate` with `ios-haptics`. Phase 64 keeps the verbatim port. `ios-haptics` is deferred.
- Add a new exported helper `resumeAudioContext()` (referenced from RESEARCH.md Pattern 3) — signature:

  ```ts
  export function resumeAudioContext(): void {
    if (!audioContext) initAudioContext();
    if (audioContext?.state === "suspended") {
      audioContext.resume().catch(() => { /* ignore */ });
    }
  }
  ```

---

### 3. `src/lib/scanner/scan-history.ts` (port-verbatim, module-singleton)

**Analog:** `frontend/lib/scanner/scan-history.ts` (196 LOC)

**Dedupe-to-top + 10-cap pattern** (lines 61-87):

```ts
export function addToScanHistory(entry: Omit<ScanHistoryEntry, "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getScanHistory();
    const newEntry: ScanHistoryEntry = { ...entry, timestamp: Date.now() };
    const filtered = history.filter((h) => h.code !== entry.code);
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("[ScanHistory] Failed to save history:", error);
  }
}
```

**Read + type-guard filter** (lines 23-50):

```ts
export function getScanHistory(): ScanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SCAN_HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ScanHistoryEntry =>
        typeof entry === "object" &&
        typeof entry.code === "string" &&
        typeof entry.timestamp === "number"
    );
  } catch (error) {
    console.warn("[ScanHistory] Failed to read history:", error);
    return [];
  }
}
```

**Constants** (lines 15-16):

```ts
const SCAN_HISTORY_KEY = "hws-scan-history";
const MAX_HISTORY_SIZE = 10;
```

**Adaptation:** no `"use client"` directive present in this file — port is a true verbatim copy. Keep `createHistoryEntry(code, format, match)` helper (lines 97-117) even though Phase 64 always passes `match.type === "not_found"` — shape needed by Phase 65.

---

### 4. `src/lib/scanner/types.ts` (port-verbatim, stripped)

**Analog:** `frontend/lib/scanner/types.ts` (51 LOC)

**Remove legacy entity imports** (lines 7-9):

```ts
// DELETE these three lines:
import type { Item } from "@/lib/types/items";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";
```

**Replace `EntityMatch` with inline stub** (lines 14-18). Adapted version:

```ts
export type EntityMatch =
  | { type: "item"; entity: { id: string; name: string } }
  | { type: "container"; entity: { id: string; name: string } }
  | { type: "location"; entity: { id: string; name: string } }
  | { type: "not_found"; code: string };
```

**Keep verbatim** (lines 22-49): `ScanHistoryEntry` interface + `SUPPORTED_FORMATS` const + `BarcodeFormat` type. See RESEARCH.md §Code Examples lines 836-862 for the complete target file.

---

### 5. `src/lib/scanner/index.ts` (port, minus scan-lookup exports)

**Analog:** `frontend/lib/scanner/index.ts` (58 LOC)

**Remove scan-lookup export block** (lines 42-47):

```ts
// DELETE:
export {
  lookupByShortCode,
  getEntityDisplayName,
  getEntityUrl,
} from "./scan-lookup";
```

**Keep types, polyfill, feedback, history exports** (lines 26-41, 49-57). Also export the new `resumeAudioContext` added to feedback.ts (see row 2).

---

### 6. `src/lib/api/scan.ts` (new stub)

**Analog:** `frontend2/src/lib/api/inventory.ts` (27 LOC) — smallest API module in the codebase, correct shape for a stub.

**Import + base pattern** (lines 1, 21-26):

```ts
import { get } from "@/lib/api";

// ...

const base = (wsId: string) => `/workspaces/${wsId}/inventory`;

export const inventoryApi = {
  available: (wsId: string, itemId: string) =>
    get<InventoryListResponse>(`${base(wsId)}/available/${itemId}`),
};
```

**Adaptation for Phase 64 stub:**

```ts
// src/lib/api/scan.ts  —  Phase 64 empty scaffold; Phase 65 (LOOK-01) fills in.
import type { Item } from "@/lib/api/items";

export type ScanLookupStatus = "idle" | "loading" | "success" | "error";

export interface ScanLookupResult {
  status: ScanLookupStatus;
  match: Item | null;
  error: Error | null;
}

// Phase 65 replaces with a real `get()` call against
//   GET /workspaces/{wsId}/items?search={code}&limit=1
export const scanApi = {
  // Phase 64: no endpoints. Phase 65 adds lookupByBarcode(wsId, code).
};

export const scanKeys = {
  all: ["scan"] as const,
  lookups: () => [...scanKeys.all, "lookup"] as const,
  lookup: (code: string) => [...scanKeys.lookups(), code] as const,
};
```

**Add to `src/lib/api/index.ts` barrel** (follow existing pattern in `frontend2/src/lib/api/index.ts:1-7`):

```ts
export * from "./scan";
```

---

### 7. `src/features/scan/hooks/useScanHistory.ts` (new hook)

**Analog:** `frontend2/src/features/items/hooks/useCategoryNameMap.ts` (36 LOC) — shape of hook returning `{ derivedValue, status-flags }` object.

**Import + useEffect + derived return** (lines 1-6, 21-36):

```ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoriesApi, categoryKeys } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";

export function useCategoryNameMap() {
  const { workspaceId } = useAuth();
  const params = { page: 1, limit: 100, archived: true } as const;
  const query = useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, string>();
    (query.data?.items ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [query.data]);
  return { map, isPending: query.isPending, isError: query.isError };
}
```

**Adaptation (no TanStack Query; this hook wraps localStorage module):**

```ts
// src/features/scan/hooks/useScanHistory.ts
import { useCallback, useEffect, useState } from "react";
import {
  getScanHistory,
  addToScanHistory,
  removeFromScanHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from "@/lib/scanner";

export function useScanHistory() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getScanHistory());
    const onStorage = () => setEntries(getScanHistory()); // cross-tab sync
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((e: Omit<ScanHistoryEntry, "timestamp">) => {
    addToScanHistory(e);
    setEntries(getScanHistory());
  }, []);

  const remove = useCallback((code: string) => {
    removeFromScanHistory(code);
    setEntries(getScanHistory());
  }, []);

  const clear = useCallback(() => {
    clearScanHistory();
    setEntries([]);
  }, []);

  return { entries, add, clear, remove };
}
```

**No-analog flag:** No existing `/frontend2` hook uses `localStorage`. Pattern above is lifted from RESEARCH.md §Code Examples "New: `useScanHistory` hook" (lines 866-905). Planner: the cross-tab `storage` listener is **required** for the STATE.md rule that multi-tab edits stay consistent.

---

### 8. `src/features/scan/hooks/useScanFeedback.ts` (new hook)

**Analog:** `frontend2/src/features/taxonomy/hooks/useHashTab.ts` (42 LOC) — closest pattern for a hook that owns `useCallback` + `useEffect` lifecycle tied to a module-scope state (hash vs AudioContext).

**Ref + callback + effect subscription** (lines 17-38):

```ts
const read = useCallback((): T => {
  if (typeof window === "undefined") return defaultTab;
  const h = window.location.hash.slice(1) as T;
  return (valid as readonly string[]).includes(h) ? h : defaultTab;
}, [defaultTab, valid]);

const [tab, setTab] = useState<T>(read);

useEffect(() => {
  const onHash = () => setTab(read());
  window.addEventListener("hashchange", onHash);
  return () => window.removeEventListener("hashchange", onHash);
}, [read]);

const change = useCallback(
  (k: T) => {
    if (!(valid as readonly string[]).includes(k)) return;
    window.history.replaceState(null, "", `#${k}`);
    setTab(k);
  },
  [valid],
);

return [tab, change];
```

**Adaptation (AudioContext + haptic + flash trigger, D-08):**

```ts
// src/features/scan/hooks/useScanFeedback.ts
import { useCallback, useRef } from "react";
import { resumeAudioContext, triggerScanFeedback } from "@/lib/scanner";

export function useScanFeedback() {
  const primedRef = useRef(false);

  // D-08: call this from a pointerdown handler on the page wrapper.
  // iOS Safari requires AudioContext.resume() inside a user gesture.
  const prime = useCallback(() => {
    if (primedRef.current) return;
    primedRef.current = true;
    resumeAudioContext();
  }, []);

  // Called from onScan — fires beep + haptic. Visual flash is owned
  // by BarcodeScanner (CSS) because it scopes to the viewfinder box.
  const trigger = useCallback(() => {
    triggerScanFeedback();
  }, []);

  return { prime, trigger };
}
```

**No-analog flag:** No existing frontend2 hook owns an `AudioContext`-like singleton. Planner: ref-guarded first-gesture prime pattern is load-bearing — once-per-session, idempotent.

---

### 9. `src/features/scan/hooks/useScanLookup.ts` (new stub)

**Analog:** `frontend2/src/features/items/hooks/useItem.ts` (16 LOC) — exact target shape Phase 65 will match.

**useQuery wrapper** (lines 1-16):

```ts
import { useQuery } from "@tanstack/react-query";
import { itemsApi, itemKeys, type Item } from "@/lib/api/items";
import { useAuth } from "@/features/auth/AuthContext";

export function useItem(id: string | undefined) {
  const { workspaceId } = useAuth();
  return useQuery<Item>({
    queryKey: itemKeys.detail(id ?? ""),
    queryFn: () => itemsApi.get(workspaceId!, id!),
    enabled: !!workspaceId && !!id,
  });
}
```

**Adaptation (Phase 64 stub; D-01 + D-18):**

```ts
// src/features/scan/hooks/useScanLookup.ts
// Phase 64 STUB — always returns { status: 'idle', match: null }.
// Phase 65 replaces the body with a real useQuery call; callsites
// stay intact because the 4-state status enum is defined upfront.
import type { ScanLookupResult } from "@/lib/api/scan";

export function useScanLookup(_code: string | null): ScanLookupResult {
  return {
    status: "idle",
    match: null,
    error: null,
  };
}
```

---

### 10. `src/features/scan/ScanPage.tsx` (new feature page — replaces stub)

**Analog:** `frontend2/src/features/taxonomy/TaxonomyPage.tsx` (37 LOC) — exact match for 3-tab-with-RetroTabs layout.

**Imports + TAB_KEYS tuple + useHashTab** (lines 1-13) — **adapt to NO hash persistence** per D-06:

```tsx
import { useLingui } from "@lingui/react/macro";
import { RetroTabs } from "@/components/retro";
import { useHashTab } from "./hooks/useHashTab";
import { CategoriesTab } from "./tabs/CategoriesTab";
import { LocationsTab } from "./tabs/LocationsTab";
import { ContainersTab } from "./tabs/ContainersTab";

const TAB_KEYS = ["categories", "locations", "containers"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function TaxonomyPage() {
  const { t } = useLingui();
  const [tab, setTab] = useHashTab<TabKey>("categories", TAB_KEYS);
```

**Layout + RetroTabs + conditional-render tabpanel** (lines 15-35):

```tsx
  return (
    <div className="flex flex-col gap-lg p-lg">
      <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-ink">
        {t`TAXONOMY`}
      </h1>
      <RetroTabs
        tabs={[
          { key: "categories", label: t`CATEGORIES` },
          { key: "locations", label: t`LOCATIONS` },
          { key: "containers", label: t`CONTAINERS` },
        ]}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
      />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "categories" && <CategoriesTab />}
        {tab === "locations" && <LocationsTab />}
        {tab === "containers" && <ContainersTab />}
      </div>
    </div>
  );
}
```

**Adaptations for Phase 64:**

1. **D-06: no tab persistence.** Replace `useHashTab` with plain `useState("scan")`. Every `/scan` visit starts on `"scan"`.
2. **Named export, not default.** The current `routes/index.tsx:12` uses `import { ScanPage }` — keep that import style.
3. **Wrap root in `<div>` with `onPointerDown` handler** for D-08 AudioContext prime (see §Shared Patterns below).
4. **Tab labels:** `SCAN` / `MANUAL` / `HISTORY` (per UI-SPEC).
5. **Tab bodies:**
   - `scan` → `<BarcodeScanner paused={!!banner} onDecode={handleDecode} />` + `ScanViewfinderOverlay` + optional `ScanTorchToggle`.
   - `manual` → `<ManualBarcodeEntry onSubmit={handleManualSubmit} />`.
   - `history` → `<ScanHistoryList entries={history.entries} onSelect={handleHistoryTap} onClear={history.clear} />`.
6. **Above the tabpanel conditionally render `<ScanResultBanner>`** when banner state is set (D-02/D-20 — stays on current tab, no auto-nav).
7. **Error-gate pattern:** when `errorKind !== null`, render the chosen `ScanErrorPanel` variant **in place of** the Scan-tab body, NOT in place of the whole tab strip (per UI-SPEC §Error-panel flow).
8. **`max-w-[480px] mx-auto`** wrapper — matches current stub (ScanPage.tsx:7) and UI-SPEC viewfinder width.

---

### 11. `src/features/scan/ScanHistoryList.tsx` (new, rewrite of legacy)

**Analog:** `frontend2/src/features/loans/panels/ItemLoanHistoryPanel.tsx` (93 LOC) — exact match: RetroPanel wrapping a `<ul>`, `RetroEmptyState` branch, retro-styled list rows.

**Imports + pending/error/empty/success branches** (lines 1-58):

```tsx
import { Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import {
  RetroPanel,
  RetroEmptyState,
  RetroButton,
  HazardStripe,
} from "@/components/retro";
import { useLoansForItem } from "../hooks/useLoansForItem";

interface ItemLoanHistoryPanelProps { itemId: string; }

export function ItemLoanHistoryPanel({ itemId }: ItemLoanHistoryPanelProps) {
  const { t } = useLingui();
  const query = useLoansForItem(itemId);

  if (query.isPending) {
    return (
      <RetroPanel>
        <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
      </RetroPanel>
    );
  }
  if (query.isError) { /* RetroPanel + HazardStripe + RETRY button */ }
  const history = query.history;
  if (history.length === 0) {
    return (
      <RetroEmptyState
        title={t`NO LOAN HISTORY`}
        body={t`Past loans will appear here once anything is returned.`}
      />
    );
  }
  return (
    <RetroPanel>
      <ul className="flex flex-col divide-y-2 divide-retro-charcoal">
        {history.map((loan) => (
          <li
            key={loan.id}
            className="flex items-center gap-md py-sm text-retro-gray flex-wrap"
          >
            {/* row contents */}
          </li>
        ))}
      </ul>
    </RetroPanel>
  );
}
```

**Adaptations for ScanHistoryList:**

1. Data source is `useScanHistory()` not a TanStack query — remove `isPending` / `isError` branches (localStorage reads are sync).
2. Empty-state copy from UI-SPEC: `title={t\`NO SCANS YET\`} body={t\`Scanned codes appear here. Your last 10 scans are kept on this device.\`}`.
3. Row content = timestamp (right-aligned, from `formatScanTime(timestamp)` in `@/lib/scanner`) + `font-mono` code + format pill. Full-row `<button type="button">` target, `min-h-[44px]` (UI-SPEC 44px touch target).
4. Above the `<ul>`, render a `CLEAR HISTORY` `RetroButton variant="danger"` that opens a `RetroConfirmDialog` (see Shared Pattern §Confirm-dialog).
5. Timestamp formatter — use `formatScanTime()` exported from `@/lib/scanner/scan-history.ts` (already ported verbatim); no `useDateFormat` hook dependency.

---

### 12. `src/components/scan/BarcodeScanner.tsx` (rewrite)

**Behavior analog:** `frontend/components/scanner/barcode-scanner.tsx` (281 LOC) — port `checkTorchSupport` + mount lifecycle + onScan/onError wiring.

**Retro-container + loading/error layout analog:** `frontend2/src/features/items/ItemsListPage.tsx` (lines 230-252) — the pattern for "RetroPanel with HazardStripe + h2 + body + RETRY button" applied to an error state.

**Keep from legacy** (lines 62-86 — torch probe, iOS early-exit):

```tsx
async function checkTorchSupport(): Promise<boolean> {
  try {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) return false;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
      torch?: boolean;
    };
    stream.getTracks().forEach((t) => t.stop());
    return capabilities?.torch === true;
  } catch {
    return false;
  }
}
```

**Keep from legacy** (lines 102-135 — mount effect with `mounted` flag):

```tsx
useEffect(() => {
  let mounted = true;
  async function initialize() {
    try {
      await initBarcodePolyfill();
      const hasTorch = await checkTorchSupport();
      if (mounted) {
        setTorchSupported(hasTorch);
        setIsInitializing(false);
      }
    } catch (error) {
      if (mounted) { /* setInitError, onError(error) */ }
    }
  }
  initialize();
  return () => { mounted = false; };
}, [onError]);
```

**Keep from legacy** (lines 212-237 — `<Scanner>` prop set):

```tsx
<Scanner
  onScan={onScan}
  onError={handleError}
  paused={paused}
  formats={formats}
  scanDelay={200}
  allowMultiple={false}
  components={{ torch: torchSupported && torchEnabled, finder: true }}
  sound={false}
  constraints={{ facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }}
/>
```

**Drop from legacy (forbidden in frontend2):**

- `import dynamic from "next/dynamic"` — replace with direct `import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner"` (route is already `React.lazy`-split).
- `lucide-react` icons (`Loader2`, `Flashlight`, `FlashlightOff`, `Camera`, `AlertCircle`) — banned.
- `@/components/ui/*` (shadcn) — banned; replace with `@/components/retro` barrel.
- `@/lib/utils:cn` — no `cn` helper in `/frontend2`; concatenate with template literals like the rest of the codebase.
- Inline `<Alert variant="destructive">` blocks — do not render any error UI here; surface `errorKind` upward via an `onError(kind)` callback and let `ScanPage.tsx` switch to the right `ScanErrorPanel` variant per UI-SPEC.
- `components={{ finder: true }}` → **set to `false`**; we render `ScanViewfinderOverlay` ourselves.

**Retro container pattern for this phase** (UI-SPEC §Viewfinder):

```tsx
<div className="relative border-retro-thick border-retro-ink bg-retro-ink aspect-square md:aspect-video overflow-hidden">
  <Scanner {...props} />
  <ScanViewfinderOverlay />
  {torchSupported && !paused && <ScanTorchToggle streamRef={...} />}
</div>
```

**No-analog note:** No existing frontend2 component wraps a 3rd-party React library (retro atoms are all self-contained). Planner owns the retro-wrap boundary decision; legacy `BarcodeScanner` provides the behavior, retro atoms provide the visual grammar.

---

### 13. `src/components/scan/ManualBarcodeEntry.tsx` (rewrite)

**Analog:** `frontend2/src/features/items/forms/ItemForm.tsx` (165 LOC) — closest retro form with `react-hook-form` + zod + RetroInput + submit.

**Import + useLingui + field** (lines 1-16, 110-115):

```tsx
import { useLingui } from "@lingui/react/macro";
import { RetroFormField, RetroInput } from "@/components/retro";
// ...
<RetroFormField name="name" control={control} label={t`NAME`}>
  <RetroInput autoFocus={!isEditMode} placeholder={t`e.g. Cordless Drill`} />
</RetroFormField>
```

**Input attributes to copy from legacy** (frontend/components/scanner/manual-entry-input.tsx:83-87):

```tsx
<Input
  autoComplete="off"
  autoCapitalize="off"
  autoCorrect="off"
  spellCheck={false}
/>
```

**Adaptation for Phase 64:**

- **Simpler than ItemForm.** Single field — no `react-hook-form` + zod needed (per D-14: no format gate). A plain `useState<string>("")` + inline trim/length check is sufficient and cheaper.
- **Accept plain string prop contract from legacy** (frontend/components/scanner/manual-entry-input.tsx:16-28): `onSubmit(code: string) => void`.
- **Validation per UI-SPEC §Manual tab copy:**
  - empty → `t\`Enter a code before submitting.\``
  - >256 → `t\`Code must be 256 characters or fewer.\`` (also `maxLength={256}` attribute, D-14)
- **Layout:** `RetroInput` with `error={errorMsg}` prop (RetroInput already renders `error` text + `border-retro-red`, see retro/RetroInput.tsx:25-27). `RetroButton variant="primary"` labelled `LOOK UP CODE`, disabled when trimmed value empty.
- **Submit fires callback and clears input**, matching legacy behavior (frontend/components/scanner/manual-entry-input.tsx:49-59).

---

### 15. `src/components/scan/ScanErrorPanel.tsx` (new, 4 variants)

**Analog:** `frontend2/src/routes/index.tsx` NotFoundPage (lines 28-47) — closest existing "RetroPanel + HazardStripe + heading + body + action button" layout.

```tsx
function NotFoundPage() {
  const { t } = useLingui();
  return (
    <div className="min-h-dvh bg-retro-charcoal flex items-center justify-center p-lg">
      <RetroPanel showHazardStripe className="max-w-[640px] w-full">
        <h1 className="text-[20px] font-bold uppercase text-retro-ink">
          {t`SECTOR NOT FOUND`}
        </h1>
        <p className="text-retro-ink mt-sm">
          {t`The requested area does not exist. Return to base.`}
        </p>
        <Link
          to="/"
          className="inline-block mt-md text-retro-ink font-bold uppercase text-[14px] border-retro-thick border-retro-ink bg-retro-cream px-md py-sm shadow-retro-raised hover:shadow-retro-pressed"
        >
          {t`RETURN TO BASE`}
        </Link>
      </RetroPanel>
    </div>
  );
}
```

**Secondary analog (error branch inside a panel):** `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` (lines 40-55):

```tsx
if (query.isError) {
  return (
    <RetroPanel>
      <HazardStripe className="mb-md" />
      <h3 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
        {t`COULD NOT LOAD LOANS`}
      </h3>
      <p className="text-retro-ink mb-md">
        {t`Check your connection and try again.`}
      </p>
      <RetroButton variant="primary" onClick={() => query.refetch()}>
        {t`RETRY`}
      </RetroButton>
    </RetroPanel>
  );
}
```

**Adaptation (4-variant switch, UI-SPEC §Error-panel copy):**

```tsx
type ErrorKind = "permission-denied" | "no-camera" | "library-init-fail" | "unsupported-browser";

interface ScanErrorPanelProps {
  kind: ErrorKind;
  onUseManualEntry: () => void;
  onRetry?: () => void; // only for library-init-fail
  onReload?: () => void; // only for no-camera
}

// Each variant selects heading, body, platform-hint list, primary+secondary actions.
// All 4 variants share: RetroPanel + HazardStripe + h2 + body (+ optional platform
// hints for permission-denied) + flex row of buttons.
// HazardStripe variant = "red" for library-init-fail, default (yellow) for others.
```

**⚠ HazardStripe gap (RESEARCH.md §Retro Component Fit Audit):** `HazardStripe` currently renders a single `bg-hazard-stripe` class and has no variant prop. UI-SPEC requires a red stripe for library-init-fail. Planner MUST add `variant?: "yellow" | "red"` to `HazardStripe.tsx` (trivial ~5-LOC change — stays within Acceptance Gate #4 "file count unchanged").

**On-mount structured log (D-12)** — attach via `useEffect(() => { console.error({ kind, errorName: ..., userAgent: navigator.userAgent, timestamp: Date.now() }); }, [kind])`.

---

### 16. `src/components/scan/ScanResultBanner.tsx` (new)

**Analog:** `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` (lines 71-127) — RetroPanel with a row of labelled fields + right-aligned action button.

```tsx
<RetroPanel>
  <div className="flex items-start justify-between gap-md flex-wrap">
    <div className="flex flex-col gap-xs min-w-0 flex-1">
      <div className="flex items-center gap-md flex-wrap">
        <span className="font-mono text-retro-ink">×{loan.quantity}</span>
      </div>
      <div className="flex items-center gap-md flex-wrap text-[14px]">
        <span className="font-sans font-semibold uppercase text-retro-charcoal/70">
          {t`LOANED`}
        </span>
        <span className="font-mono text-retro-ink">{loan.loaned_at.slice(0, 10)}</span>
      </div>
    </div>
    <button
      type="button"
      onClick={() => returnFlowRef.current?.open(loan)}
      className="min-h-[44px] inline-flex items-center gap-xs px-md border-retro-thick border-retro-ink bg-retro-cream text-[14px] font-bold uppercase cursor-pointer"
    >
      {t`MARK RETURNED`}
    </button>
  </div>
</RetroPanel>
```

**Adaptation:**

- Heading `SCANNED` as an h2 (20px bold uppercase, matches `RetroPanel` title spot or inline).
- Code as 24px mono display (UI-SPEC Typography Display role): `<span className="font-mono text-[24px] font-bold text-retro-ink">{code}</span>`.
- Format pill: `<span className="font-mono text-[12px] uppercase border-retro-thick border-retro-ink bg-retro-amber text-retro-ink px-sm py-xs">{format}</span>`.
- Timestamp right-aligned in footer using `formatScanTime(ts)` from `@/lib/scanner`.
- Primary button `RetroButton variant="primary"` labelled `SCAN AGAIN` → `onScanAgain` callback (parent clears banner + unpauses scanner).

---

### 17. `src/components/scan/ScanViewfinderOverlay.tsx` (new, no analog)

**No-analog flag:** no CSS-animated retro component exists. Planner sets the convention.

**Required behaviors from UI-SPEC §Viewfinder Visual Spec:**

- 4 absolute-positioned corner `<div>`s (or `<svg>`), each with two 24×3px ink-colored legs, inset 16px.
- One `<div>` with `absolute left-0 right-0 top-0 h-[2px] bg-retro-amber opacity-60 shadow-[0_0_8px_0_#D4A017]` animated via `@keyframes scan-sweep` (2s linear infinite; `from { transform: translateY(0%); } to { transform: translateY(calc(100% - 2px)); }`).
- `prefers-reduced-motion: reduce` media query pins the scanline to 50% and sets `animation: none`.

**Add the keyframes to `globals.css`** or scope them with a `<style>` in the component (UI-SPEC calls either acceptable). Planner decides.

**No consumer props.** Purely presentational — positioned absolutely inside `BarcodeScanner`'s relative container.

---

### 18. `src/components/scan/ScanTorchToggle.tsx` (new)

**Analog:** `frontend2/src/components/retro/RetroButton.tsx` (44 LOC) — base RetroButton API; add an `aria-pressed` consumer. No existing `aria-pressed` button in the codebase — set convention.

**Base button API** (RetroButton.tsx:1-12, 22-38):

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "neutral" | "secondary";
}

const variantClasses = {
  primary: "bg-retro-amber text-retro-ink hover:brightness-110",
  // ...
} as const;

const RetroButton = forwardRef<HTMLButtonElement, RetroButtonProps>(
  ({ variant = "neutral", className, children, disabled, ...props }, ref) => {
    // ...
    return (
      <button ref={ref} disabled={disabled} className={...} {...props}>
        {children}
      </button>
    );
  }
);
```

**Adaptation:**

```tsx
interface ScanTorchToggleProps {
  torchOn: boolean;
  onToggle: () => void;
}

export function ScanTorchToggle({ torchOn, onToggle }: ScanTorchToggleProps) {
  const { t } = useLingui();
  return (
    <RetroButton
      variant={torchOn ? "primary" : "neutral"}
      onClick={onToggle}
      aria-pressed={torchOn}
      className="absolute bottom-md right-md"
    >
      {torchOn ? t`[◉] TORCH ON` : t`[◉] TORCH OFF`}
    </RetroButton>
  );
}
```

**Parent gates mount.** `BarcodeScanner` renders this only when `torchSupported === true` (D-16 "not rendered at all when unsupported").

---

### 19. `src/components/scan/index.ts` (new, barrel)

**Analog:** `frontend2/src/lib/api/index.ts` (7 LOC):

```ts
export * from "./items";
export * from "./itemPhotos";
export * from "./loans";
export * from "./borrowers";
export * from "./categories";
export * from "./locations";
export * from "./containers";
```

**Adaptation:**

```ts
export * from "./BarcodeScanner";
export * from "./ManualBarcodeEntry";
export * from "./ScanErrorPanel";
export * from "./ScanResultBanner";
export * from "./ScanViewfinderOverlay";
export * from "./ScanTorchToggle";
```

---

## Test Pattern Assignments

### Module unit tests (rows 20-22: init-polyfill / feedback / scan-history)

**Analog:** `frontend2/src/lib/api/__tests__/queryKeys.test.ts` (lines 1-30):

```ts
import { describe, it, expect } from "vitest";
import { itemKeys } from "../items";

describe("itemKeys factory", () => {
  it("all equals ['items']", () => {
    expect(itemKeys.all).toEqual(["items"]);
  });
  it("list(params) equals ['items', 'list', params]", () => {
    expect(itemKeys.list({ page: 1 })).toEqual(["items", "list", { page: 1 }]);
  });
});
```

**Adaptation for scanner unit tests:**

- `scan-history.test.ts`: mock `localStorage` via `vi.stubGlobal("localStorage", ...)` or `Storage.prototype.setItem = vi.fn()`; test dedupe-to-top, 10-cap, cross-session read, corrupt-JSON graceful-fallback.
- `feedback.test.ts`: `vi.stubGlobal("AudioContext", vi.fn(() => ({ state: "suspended", resume: vi.fn(), createOscillator: vi.fn(() => ({ ... })), ... })))`. Test `initAudioContext()` singleton, `resumeAudioContext()` idempotent, `playSuccessBeep()` creates oscillator at 880Hz.
- `init-polyfill.test.ts`: test early-return when `"BarcodeDetector" in window`; test dynamic import path; test idempotent call.

---

### Hook tests (rows 23-25: useScanHistory / useScanFeedback / useScanLookup)

**Analog:** `frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts` (85 LOC):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "00000000-0000-0000-0000-000000000001",
    isLoading: false, isAuthenticated: true, user: { id: "u1" },
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
  }),
}));

const listMock = vi.fn();
vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/categories")>();
  return { ...actual, categoriesApi: { ...actual.categoriesApi, list: (...args: unknown[]) => listMock(...args) } };
});

import { useCategoryNameMap } from "../hooks/useCategoryNameMap";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useCategoryNameMap", () => {
  beforeEach(() => { listMock.mockReset(); });
  it("builds a Map<id, name> from returned items", async () => {
    listMock.mockResolvedValue({ items: [{ id: "cat-1", name: "Power Tools" }] });
    const { result } = renderHook(() => useCategoryNameMap(), { wrapper });
    await waitFor(() => expect(result.current.map.size).toBeGreaterThan(0));
    expect(result.current.map.get("cat-1")).toBe("Power Tools");
  });
});
```

**Adaptation per hook:**

- `useScanHistory.test.ts`: no QueryClient wrapper needed; mock `@/lib/scanner` module or stub `localStorage`. Test `add` → state updates; dedupe-to-top; `clear` empties entries; cross-tab `storage` event propagates.
- `useScanFeedback.test.ts`: mock `@/lib/scanner` `resumeAudioContext` + `triggerScanFeedback` as `vi.fn()`. Test `prime()` is idempotent (ref-guard); `trigger()` proxies to `triggerScanFeedback`.
- `useScanLookup.test.ts`: assert stub returns `{ status: "idle", match: null, error: null }` regardless of input code.

---

### Component tests (rows 26-31)

**Analog A (component-with-mocked-external-dep):** `frontend2/src/features/items/__tests__/ItemForm.test.tsx` lines 1-41 (vi.mock pattern):

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ workspaceId: "00000000-0000-0000-0000-000000000001", ... }),
}));
vi.mock("@/lib/api/categories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/categories")>();
  return { ...actual, categoriesApi: { ...actual.categoriesApi, list: vi.fn().mockResolvedValue({ items: [...] }) } };
});

beforeEach(() => { setupDialogMocks(); vi.clearAllMocks(); });
```

**Analog B (presentational component + Lingui):** `frontend2/src/components/retro/__tests__/RetroEmptyState.test.tsx` (lines 1-13):

```tsx
import { render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RetroEmptyState } from "../RetroEmptyState";

i18n.load("en", {});
i18n.activate("en");

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}
```

**Adaptation by file:**

- `BarcodeScanner.test.tsx` → Analog A. Mock `@yudiel/react-qr-scanner` (`vi.mock("@yudiel/react-qr-scanner", () => ({ Scanner: ({ onScan }) => <button data-testid="fake-scanner" onClick={() => onScan([{rawValue:"X",format:"qr_code"}])}>DECODE</button> }))`). Assert StrictMode-safe mount/unmount, `paused` prop passthrough, format subset passthrough.
- `ManualBarcodeEntry.test.tsx` → Analog A (sans API mocks — just Lingui wrapper). Test empty rejects, >256 rejects, submit clears input, `autoComplete="off"` attrs present.
- `ScanErrorPanel.test.tsx` → Analog B. One `it` per variant — each asserts heading + body + correct CTA count/labels + console.error called with `{ kind, errorName, userAgent, timestamp }` shape.
- `ScanTorchToggle.test.tsx` → Analog B. Assert `aria-pressed={torchOn}`, label switches, `onClick` fires toggle.
- `ScanResultBanner.test.tsx` → Analog B. Assert code renders in `font-mono text-[24px]`, format badge visible, SCAN AGAIN button fires callback.
- `ScanViewfinderOverlay.test.tsx` → Analog = `frontend2/src/components/retro/__tests__/HazardStripe.test.tsx` (presentational-only). Assert 4 corner elements, scanline element, query animation class presence vs `prefers-reduced-motion`.

---

### Feature-page test (row 32: ScanPage)

**Analog:** `frontend2/src/features/taxonomy/__tests__/TaxonomyPage.test.tsx` (137 LOC) — tab-switching page test.

**Scaffolding** (lines 1-97):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders, setupDialogMocks } from "./fixtures";

vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ ... }) }));
// Mock each API surface consumed by the page's tabs
// ...

describe("TaxonomyPage", () => {
  beforeEach(() => {
    window.location.hash = "";
    setupDialogMocks();
    vi.clearAllMocks();
  });

  it("renders the CATEGORIES tab by default", async () => {
    renderWithProviders(<TaxonomyPage />);
    expect(screen.getByText("TAXONOMY")).toBeInTheDocument();
    expect(screen.getByText("CATEGORIES")).toBeInTheDocument();
  });
});
```

**Adaptation for ScanPage:**

- No hash reset needed (D-06 — no hash persistence).
- Mock `@yudiel/react-qr-scanner` with a fake Scanner component that exposes a test-only `data-testid="fake-scanner-decode-trigger"` button.
- Mock `@/lib/scanner` module (at least `initBarcodePolyfill`, `triggerScanFeedback`, `resumeAudioContext` — or use the real module and mock `localStorage`).
- Tests:
  1. Default tab is `SCAN` (D-05).
  2. Clicking `MANUAL` tab switches to manual entry form.
  3. Clicking `HISTORY` tab shows `NO SCANS YET` when history empty.
  4. Simulated decode → banner appears + history entry written + `useScanFeedback.trigger` called (D-02, D-03).
  5. Dedupe: decoding same code twice keeps history length at 1 (D-03).
  6. `SCAN AGAIN` unpauses scanner + clears banner.
  7. Tapping a history entry re-fires the banner on the current tab (D-15, D-20 — no auto-switch).
  8. `onPointerDown` on wrapper primes AudioContext exactly once (D-08) — use a spy on `resumeAudioContext`.

---

### Test fixtures (row 33: `features/scan/__tests__/fixtures.ts`)

**Analog:** `frontend2/src/features/items/__tests__/fixtures.ts` (83 LOC) — re-export shared providers + add entity factory:

```ts
import type { Item } from "@/lib/api/items";

export {
  TestAuthContext,
  renderWithProviders,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";

export const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
export const NOW = "2026-04-16T12:00:00.000Z";

export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: overrides.id ?? "55555555-5555-5555-5555-555555555555",
    // ...
    ...overrides,
  };
}
```

**Adaptation:**

- Re-export `renderWithProviders` + `setupDialogMocks` from `@/features/taxonomy/__tests__/fixtures`.
- Add `makeScanHistoryEntry({ code = "TEST123", format = "qr_code", entityType = "unknown", timestamp = Date.now() } = {})` factory returning a `ScanHistoryEntry`.
- Optional: `renderScanPage` helper that wraps `<ScanPage>` in `<MemoryRouter>` (matches `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx:70-79`).

---

## Config Edits

### 36. `vite.config.ts` (edit — add manualChunks)

**Current file** (30 LOC, no `build` section). Append a `build` block — see RESEARCH.md §Pattern 5 (lines 484-528):

```ts
export default defineConfig({
  plugins: [ /* unchanged */ ],
  resolve: { /* unchanged */ },
  server: { /* unchanged */ },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          scanner: [
            "@yudiel/react-qr-scanner",
            "barcode-detector",
            "barcode-detector/polyfill",
            "zxing-wasm",
            "webrtc-adapter",
          ],
        },
      },
    },
  },
});
```

**No-analog note:** no prior `manualChunks` in the file. Planner introduces the pattern.

---

### 37. `package.json` (edit — add 3 runtime deps + 1 devDep)

**Current deps block** (lines 39-51). Add to `dependencies`:

```json
"@yudiel/react-qr-scanner": "2.5.1",
"uuid": "^13.0.0"
```

Add to `devDependencies`:

```json
"@types/uuid": "^11.0.0"
```

**D-17 (locked):** Do NOT add `ios-haptics`. Deferred from Phase 64.

**Install command:**

```bash
cd frontend2
bun add @yudiel/react-qr-scanner@2.5.1 uuid@^13.0.0
bun add -d @types/uuid@^11.0.0
```

---

### 38. `src/routes/index.tsx` (edit — React.lazy for /scan)

**Current file** (100 LOC). Current line 12:

```ts
import { ScanPage } from "@/features/scan/ScanPage";
```

**Replace with** (see RESEARCH.md §Pattern 5 lazy split, lines 532-552):

```ts
import { lazy, Suspense } from "react";
const ScanPage = lazy(() =>
  import("@/features/scan/ScanPage").then((m) => ({ default: m.ScanPage }))
);
```

**Current line 85:**

```tsx
<Route path="scan" element={<ScanPage />} />
```

**Replace with:**

```tsx
<Route
  path="scan"
  element={
    <Suspense fallback={
      <RetroPanel showHazardStripe title={t`LOADING SCANNER…`}>
        <p className="font-mono text-retro-charcoal">{t`Please wait.`}</p>
      </RetroPanel>
    }>
      <ScanPage />
    </Suspense>
  }
/>
```

**No-analog note:** No other route in the file uses `React.lazy` today. Planner introduces the pattern — keep it scoped to `/scan` (do not retrofit other routes).

---

### 39. `locales/en/messages.po` + `locales/et/messages.po` (edit — i18n gap-fill)

**Pattern:** Phase 63 precedent (per CONTEXT.md §canonical_refs). Workflow:

1. Land all source code using `t\`...\`` macro strings (Lingui extractor reads these).
2. Run `bun run i18n:extract` inside `frontend2/` — appends new `msgid`s to both `.po` files with empty `msgstr ""`.
3. Hand-fill EN `msgstr` (usually mirrors `msgid`) AND ET `msgstr` using the draft translations in 64-UI-SPEC.md §ET catalog (lines 243-267).
4. Run `bun run i18n:compile` — verify no orphan warnings.

**Current EN file** uses the format (from locales/en/messages.po lines 16-20):

```po
#: src/features/items/photos/ItemPhotoGallery.tsx:94
msgid "{0} is not a supported image format."
msgstr "{0} is not a supported image format."
```

**Every** string in UI-SPEC §Copywriting Contract must land in BOTH files. Acceptance Gate #3: "No string ships EN-only — `locales/et/messages.po` diff includes every new ID from this phase."

---

## Shared Patterns

Cross-cutting patterns that apply across multiple Phase 64 files.

### S1. `@/components/retro` barrel imports (Phase 54 mandate)

**Source:** Every feature file in `/frontend2`, e.g. `frontend2/src/features/items/ItemsListPage.tsx:6-14`:

```tsx
import {
  RetroPanel,
  RetroButton,
  RetroEmptyState,
  RetroBadge,
  RetroTable,
  RetroPagination,
  HazardStripe,
} from "@/components/retro";
```

**Apply to:** Every file in `src/components/scan/` and `src/features/scan/` that consumes a retro atom. NEVER direct-import from `@/components/retro/RetroPanel` — use the barrel.

---

### S2. Lingui `t` macro for all UI strings

**Source:** `frontend2/src/features/items/ItemDetailPage.tsx:3, 59, 80-81`:

```tsx
import { useLingui } from "@lingui/react/macro";

export function ItemDetailPage() {
  const { t } = useLingui();
  // ...
  return (
    <RetroPanel>
      <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
    </RetroPanel>
  );
}
```

**Apply to:** Every file that renders a user-visible string. Use the `t` tagged template form, NOT `<Trans>` component. Every string must have a matching EN + ET entry after `bun run i18n:extract`.

---

### S3. AppDev error-state panel (RetroPanel + HazardStripe + RetroButton)

**Source:** `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx:40-55`:

```tsx
if (query.isError) {
  return (
    <RetroPanel>
      <HazardStripe className="mb-md" />
      <h3 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
        {t`COULD NOT LOAD LOANS`}
      </h3>
      <p className="text-retro-ink mb-md">
        {t`Check your connection and try again.`}
      </p>
      <RetroButton variant="primary" onClick={() => query.refetch()}>
        {t`RETRY`}
      </RetroButton>
    </RetroPanel>
  );
}
```

**Apply to:** All 4 variants of `ScanErrorPanel`. Each variant differs only in heading, body, optional platform-hint list, and action button set.

---

### S4. Retro confirm dialog via imperative handle

**Source:** `frontend2/src/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx:1-46`:

```tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";

export interface BorrowerArchiveDeleteFlowHandle {
  open: () => void;
  close: () => void;
}

export const BorrowerArchiveDeleteFlow = forwardRef<
  BorrowerArchiveDeleteFlowHandle,
  BorrowerArchiveDeleteFlowProps
>(function BorrowerArchiveDeleteFlow({ nodeName, onArchive, onDelete }, ref) {
  const { t } = useLingui();
  const archiveRef = useRef<RetroConfirmDialogHandle>(null);
  // ...
  useImperativeHandle(ref, () => ({
    open: () => archiveRef.current?.open(),
    close: () => { archiveRef.current?.close(); ... },
  }));
  // ...
});
```

**Apply to:** `ScanHistoryList`'s "CLEAR HISTORY" confirm flow (SCAN-07). Dialog props from UI-SPEC §Destructive confirmations:

```tsx
<RetroConfirmDialog
  ref={confirmRef}
  variant="destructive"
  title={t`CLEAR SCAN HISTORY`}
  body={t`All 10 most-recent scanned codes on this device will be removed. This cannot be undone.`}
  destructiveLabel={t`YES, CLEAR`}
  escapeLabel={t`KEEP HISTORY`}
  onConfirm={() => history.clear()}
/>
```

---

### S5. AudioContext prime on first pointerdown (D-08)

**Source:** RESEARCH.md §Pattern 3 (lines 400-415) — no pre-existing frontend2 analog:

```tsx
function ScanPage() {
  const feedback = useScanFeedback();
  return (
    <div
      className="max-w-[480px] mx-auto"
      onPointerDown={feedback.prime}  // idempotent; ref-guarded inside the hook
    >
      {/* RetroTabs + tab bodies + banner */}
    </div>
  );
}
```

**Apply to:** `ScanPage.tsx` root wrapper. MUST be `onPointerDown`, NOT `onClick` (iOS Safari gesture rule — RESEARCH.md lines 416-418).

---

### S6. Test provider wrapper

**Source:** `frontend2/src/features/taxonomy/__tests__/fixtures.tsx:35-65`:

```tsx
export function renderWithProviders(ui, options = {}) {
  const { workspaceId = DEFAULT_WORKSPACE_ID, queryClient = ..., ...rest } = options;
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <TestAuthContext.Provider value={auth}>
          <ToastProvider>{children}</ToastProvider>
        </TestAuthContext.Provider>
      </I18nProvider>
    </QueryClientProvider>
  );
  return { ...render(ui, { wrapper: Wrapper, ...rest }), queryClient };
}
```

**Apply to:** Every Phase 64 component/hook/page test. Import from `@/features/taxonomy/__tests__/fixtures` (or re-export via `src/features/scan/__tests__/fixtures.ts`).

---

### S7. jsdom `<dialog>` mock for confirm-dialog tests

**Source:** `frontend2/src/features/taxonomy/__tests__/fixtures.tsx:71-79`:

```ts
export function setupDialogMocks(): void {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
}
```

**Apply to:** Any test that mounts `RetroConfirmDialog` — so `ScanHistoryList.test.tsx` and `ScanPage.test.tsx` (if it exercises clear-history confirm).

---

### S8. `no-stale-closure` cleanup on camera-related effects

**Source:** RESEARCH.md §Pattern 4 (lines 428-467) — no pre-existing frontend2 analog. Rule:

```tsx
useEffect(() => {
  let mounted = true; // or: let cancelled = false;
  const streamsRef = []; // accumulator for throwaway streams

  async function probe() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      if (!mounted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamsRef.push(stream);
      // ... read capabilities ...
      stream.getTracks().forEach((t) => t.stop());
    } catch { /* treat as no-torch */ }
  }
  probe();
  return () => {
    mounted = false;
    streamsRef.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  };
}, []);
```

**Apply to:** `BarcodeScanner.tsx` torch-capability probe (and any future `getUserMedia` call in Phase 64). Mirrors the `mounted` flag already used in legacy `barcode-scanner.tsx:102-135`.

---

## No Analog Found

Files with no close analog in `/frontend2` — planner sets the convention. Research findings already provide implementation guidance; these are flagged so the planner does not search in vain.

| File | Role | Reason |
|------|------|--------|
| `src/features/scan/hooks/useScanHistory.ts` | hook-wrap | No existing `/frontend2` hook uses `localStorage`. Pattern lifted from RESEARCH.md §Code Examples. Storage-event listener is required for cross-tab sync. |
| `src/features/scan/hooks/useScanFeedback.ts` | hook-wrap | No existing hook owns an `AudioContext`-like singleton. Ref-guarded first-gesture prime + delegate-to-module pattern per RESEARCH.md §Pattern 3. |
| `src/components/scan/BarcodeScanner.tsx` | rewrite | No existing frontend2 component wraps a 3rd-party React library (every retro atom is self-contained). Behavior inherits from legacy `barcode-scanner.tsx`; retro visual grammar is applied per UI-SPEC §Viewfinder. |
| `src/components/scan/ScanViewfinderOverlay.tsx` | presentational | No CSS-animated retro component exists. UI-SPEC §Viewfinder Visual Spec is the contract. `@keyframes scan-sweep` is the only new CSS in Phase 64. |
| `src/components/scan/ScanTorchToggle.tsx` | request-response | No existing `aria-pressed` toggle button in frontend2. Wraps `RetroButton` with `aria-pressed={torchOn}` + state-driven variant. |
| `src/test/mocks/yudiel-scanner.ts` | test infra | No existing 3rd-party React-component mock helper. Stand-up per RESEARCH.md §Mock helpers to stand up in Wave 0 (line 1166). |
| `src/test/mocks/media-devices.ts` | test infra | No existing `navigator.mediaDevices` mock helper. Stand-up per RESEARCH.md Wave 0 infra list. |
| `vite.config.ts` manualChunks | config | No prior `manualChunks` rule — planner introduces pattern verbatim from RESEARCH.md §Pattern 5. |
| `routes/index.tsx` React.lazy | config | No prior `React.lazy` route in the file — planner introduces for `/scan` only (scoped). |
| `HazardStripe` color variant | retro atom micro-edit | No prior variant prop. Add `variant?: "yellow" \| "red"` (~5 LOC). Legal per UI-SPEC Gate #4 (file count unchanged). |

---

## Metadata

**Analog search scope:**

- `frontend2/src/features/*` (items, loans, borrowers, taxonomy, scan, auth, settings)
- `frontend2/src/components/retro/*` + tests
- `frontend2/src/lib/api/*` + tests
- `frontend2/src/routes/`
- `frontend2/src/hooks/` (empty, verified)
- `frontend2/vite.config.ts`
- `frontend2/package.json`
- `frontend2/locales/en/messages.po` (for catalog format reference)
- `frontend/lib/scanner/*` (5 files — legacy port source)
- `frontend/components/scanner/*` (3 files — legacy behavior reference)

**Files scanned:** ~40 source files in `/frontend2` + 8 legacy scanner files.

**Pattern extraction date:** 2026-04-18
