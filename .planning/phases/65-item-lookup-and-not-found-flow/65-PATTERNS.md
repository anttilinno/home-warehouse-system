# Phase 65: Item Lookup & Not-Found Flow — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 12 (4 NEW + 8 MODIFIED + locale catalogs)
**Analogs found:** 12 / 12 — every target file has a concrete precedent in `frontend2/`.

All analogs live in `/home/antti/Repos/Misc/home-warehouse-system/`. Line numbers are absolute within each analog file as of commit `b04ae7c`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend2/src/lib/api/barcode.ts` **NEW** | api-domain | request-response (GET) | `frontend2/src/lib/api/categories.ts` (structure) + `frontend2/src/lib/api/scan.ts` (keys factory) | exact (role + flow) |
| `frontend2/src/features/items/hooks/useBarcodeEnrichment.ts` **NEW** | query-hook | request-response (cached) | `frontend2/src/features/items/hooks/useItemsList.ts` | exact role; enabled-gate flavour differs (regex vs workspace) |
| `frontend2/src/features/items/ItemFormPage.tsx` **NEW** | page-component (create) | CRUD (create) + URL-state read | `frontend2/src/features/items/panel/ItemPanel.tsx` (SKU-once + dirty-guard + ItemForm consumer) + `frontend2/src/features/items/ItemDetailPage.tsx` (page chrome) | composite — two analogs merged at page level |
| `frontend2/src/features/items/UpcSuggestionBanner.tsx` **NEW** | feature-component (banner) | pure render + form-setValue callback | `frontend2/src/components/scan/ScanResultBanner.tsx` (retro banner) + `frontend2/src/components/scan/ScanErrorPanel.tsx` (variant + structured log) | exact role (retro banner composition) |
| `frontend2/src/lib/api/items.ts` **MOD** | api-domain | request-response (GET) | SELF — append method to existing `itemsApi` object | in-place extension |
| `frontend2/src/lib/api/index.ts` **MOD** | barrel | n/a | SELF — pattern is `export * from "./<domain>"` | in-place extension |
| `frontend2/src/features/scan/hooks/useScanLookup.ts` **MOD** | query-hook | request-response | `frontend2/src/features/items/hooks/useItemsList.ts` (useQuery shape) | body-swap (shape locked by Phase 64 D-18) |
| `frontend2/src/features/scan/hooks/useScanHistory.ts` **MOD** | react-hook wrapper | state-sync (localStorage) | SELF — existing `add`/`remove`/`clear` methods | additive method |
| `frontend2/src/lib/scanner/scan-history.ts` **MOD** | module (localStorage) | batch write | SELF — `addToScanHistory`, `removeFromScanHistory` | additive `updateScanHistory` |
| `frontend2/src/features/scan/ScanPage.tsx` **MOD** | page-component (orchestrator) | event-driven | SELF — remove `void lookup` line; add `useEffect` tied to `lookup.status === "success"` | in-place wire-up |
| `frontend2/src/components/scan/ScanResultBanner.tsx` **MOD** | feature-component (banner) | pure render | `frontend2/src/components/scan/ScanErrorPanel.tsx` (4-variant switch on `kind`) | widen in-place to 4 states |
| `frontend2/src/routes/index.tsx` **MOD** | route config | n/a | SELF — `items` + `items/:id` sibling routes | single sibling `<Route>` add |
| `frontend2/locales/{en,et}/messages.po` **MOD** | i18n catalog | n/a | SELF + existing `SCAN AGAIN` / `NEW ITEM` / `DISCARD CHANGES?` entries | extract via `bun run i18n:extract` |

---

## Pattern Assignments

### 1. `frontend2/src/lib/api/barcode.ts` (NEW — api-domain, request-response)

**Analogs:**
- Structural: `frontend2/src/lib/api/categories.ts` (entire file; 68 lines)
- Query-keys factory: `frontend2/src/lib/api/scan.ts` lines 20–24

**Imports pattern** (mirror `categories.ts:1` — top-level verbs from `@/lib/api`):
```ts
import { get } from "@/lib/api";
```
Note: per `categories.ts:1` the project uses named low-level verbs (`get`, `post`, `patch`, `del`). Do NOT import through the `items.ts` re-export — use `@/lib/api` directly.

**Core pattern — typed response + domain object + keys factory**
Pattern source: `frontend2/src/lib/api/categories.ts` lines 3–12, 46–67:
```ts
export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  // …
}

const base = (wsId: string) => `/workspaces/${wsId}/categories`;

export const categoriesApi = {
  list: (wsId: string, params: CategoryListParams = {}) =>
    get<CategoryListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  // …
};

export const categoryKeys = {
  all: ["categories"] as const,
  lists: () => [...categoryKeys.all, "list"] as const,
  list: (params: CategoryListParams) => [...categoryKeys.lists(), params] as const,
  details: () => [...categoryKeys.all, "detail"] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
};
```

**Key deviation for `barcode.ts`:** NO `workspace_id` in the URL (public unauthenticated endpoint — CONTEXT D-11). Use `scan.ts` keys factory shape (lines 20–24) instead of `categories.ts` dual list/detail shape:
```ts
// Source: frontend2/src/lib/api/scan.ts:20-24
export const scanKeys = {
  all: ["scan"] as const,
  lookups: () => [...scanKeys.all, "lookup"] as const,
  lookup: (code: string) => [...scanKeys.lookups(), code] as const,
};
```

**Expected shape** (from `backend/internal/domain/barcode/handler.go` per RESEARCH.md line 1224): `barcode / name / brand / category / image_url / found`.

---

### 2. `frontend2/src/features/items/hooks/useBarcodeEnrichment.ts` (NEW — query-hook)

**Analog:** `frontend2/src/features/items/hooks/useItemsList.ts` (all 26 lines)

**Full analog file** (the entire file IS the template — use it verbatim minus the auth gate):
```ts
// Source: frontend2/src/features/items/hooks/useItemsList.ts:1-26
import { useQuery } from "@tanstack/react-query";
import { itemsApi, itemKeys, type ItemListParams } from "@/lib/api/items";
import { useAuth } from "@/features/auth/AuthContext";

export function useItemsList(params: ItemListParams) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => itemsApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    placeholderData: (prev) => prev,
  });
}
```

**Deviation for `useBarcodeEnrichment`:**
1. **No `useAuth`** — enrichment is unauthenticated (D-11).
2. **`enabled` uses regex gate, not workspace:** `enabled: !!code && /^\d{8,14}$/.test(code ?? "")` (CONTEXT D-12).
3. **Structured console.error on failure** — precedent at `ScanErrorPanel.tsx:52-58`:
   ```ts
   console.error({
     kind,
     errorName: kind,
     userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
     timestamp: Date.now(),
   });
   ```
   For Phase 65, `kind: "upc-enrichment-fail"` (CONTEXT D-16; matches Phase 64 D-12 vocabulary).
4. **`staleTime: Infinity` + `retry: false`** — silent-failure requirement (D-16).
5. Return full `UseQueryResult` so the consumer can read `data?.found`.

---

### 3. `frontend2/src/features/items/ItemFormPage.tsx` (NEW — page-component)

**Composite analogs:**
- SKU-once + dirty-guard plumbing: `frontend2/src/features/items/panel/ItemPanel.tsx` lines 29–55, 84–130
- Page-level chrome (heading + back link + `max-w-[...] mx-auto p-lg`): `frontend2/src/features/items/ItemDetailPage.tsx` lines 1–26 (imports) and the wrapper `<div>` pattern
- URL-state reading: `frontend2/src/features/items/filters/useItemsListQueryParams.ts` line 36 (`const [sp, setSp] = useSearchParams();`)

**Imports pattern** (derived from `ItemPanel.tsx:1-18` + `ItemDetailPage.tsx:1-3` + `useItemsListQueryParams.ts:1-2`):
```ts
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLingui } from "@lingui/react/macro";
import {
  RetroButton,
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { ItemForm } from "./forms/ItemForm";
import { generateSku, type ItemCreateValues } from "./forms/schemas";
import { useCreateItem } from "./hooks/useItemMutations";
import { scanKeys } from "@/lib/api/scan";
```

**SKU-generate-once on mount** — source: `ItemPanel.tsx:36` + `:47-48`:
```ts
// ItemPanel uses imperative open(mode) + setGeneratedSku(generateSku());
// For a page-level mount, translate to useState lazy initializer:
const [generatedSku] = useState(() => generateSku());
```

**Dirty-guard plumbing** — source: `ItemPanel.tsx:32` + `ItemForm.tsx:71-73`:
```ts
// ItemPanel.tsx:32
const [isDirty, setIsDirty] = useState(false);

// ItemForm.tsx:71-73 — onDirtyChange callback already propagates isDirty
useEffect(() => {
  onDirtyChange?.(formState.isDirty);
}, [formState.isDirty, onDirtyChange]);

// ItemPanel passes it at line 128:
<ItemForm
  formId={formId}
  onSubmit={onSubmit}
  onDirtyChange={setIsDirty}
  defaultValues={defaultValues}
/>
```

**Dirty-guard dialog** — source: `SlideOverPanel.tsx:125-135` (verbatim copy per UI-SPEC):
```ts
<RetroConfirmDialog
  ref={discardRef}
  variant="destructive"
  title={t`DISCARD CHANGES?`}
  body={t`Your edits will be lost.`}
  escapeLabel={t`← BACK`}
  destructiveLabel={t`DISCARD`}
  onConfirm={() => {
    closeImmediate();
  }}
/>
```

**Submit + invalidation pattern** — source: `useItemMutations.ts:37-53` + CONTEXT D-04:
```ts
// useCreateItem.onSuccess already invalidates itemKeys.all and toasts success.
// Phase 65 ItemFormPage adds the scanKeys.lookup invalidation at the callsite:
const onSubmit = useCallback(
  async (values: ItemCreateValues) => {
    const created = await createMutation.mutateAsync(values);
    if (barcode) qc.invalidateQueries({ queryKey: scanKeys.lookup(barcode) });
    navigate(`/items/${created.id}`);
  },
  [barcode, createMutation, navigate, qc],
);
```

**Page chrome wrapper** — source: `ScanPage.tsx:158-165` (the 480px version; Phase 65 uses `max-w-[720px]` per UI-SPEC):
```tsx
<div className="max-w-[720px] mx-auto p-lg flex flex-col gap-lg">
  <h1 className="text-[20px] font-bold uppercase tracking-wider text-retro-ink">
    {t`NEW ITEM`}
  </h1>
  {/* banner (conditional), form, button row */}
</div>
```

**CREATE / CANCEL button row** — source: `ItemPanel.tsx:103-123`:
```tsx
<RetroButton variant="neutral" type="button" onClick={() => panelRef.current?.close()}>
  {t`← BACK`}
</RetroButton>
<RetroButton variant="primary" type="submit" disabled={isPending} form={formId}>
  <span className={isPending ? "font-mono" : ""}>{submitLabel}</span>
</RetroButton>
```
Phase 65 deviation: CANCEL (not `← BACK`) and the button calls `handleCancel` which pops the confirm dialog when dirty, otherwise `navigate(-1)`. `submitLabel` ternary: `isPending ? t\`WORKING…\` : t\`CREATE ITEM\`` verbatim from `ItemPanel.tsx:63-67`.

**`ItemForm` already supports `defaultValues.barcode`** — confirmed at `ItemForm.tsx:64`:
```ts
barcode: defaultValues?.barcode ?? "",
```

---

### 4. `frontend2/src/features/items/UpcSuggestionBanner.tsx` (NEW — feature-component)

**Composite analogs:**
- Retro banner composition: `frontend2/src/components/scan/ScanResultBanner.tsx` (all 70 lines)
- Variant/conditional rendering + structured log: `frontend2/src/components/scan/ScanErrorPanel.tsx` lines 20–23, 39–122

**Retro banner shell** — source: `ScanResultBanner.tsx:33-69`:
```tsx
<RetroPanel>
  <HazardStripe variant="yellow" className="mb-md" />
  <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
    {t`SCANNED`}
  </h2>
  <div className="flex flex-col gap-sm">
    <div className="flex items-center gap-md flex-wrap">
      <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
        {t`CODE`}
      </span>
      <span className="font-mono font-bold text-[24px] text-retro-ink break-all">
        {code}
      </span>
    </div>
    {/* … */}
  </div>
  <div className="flex justify-end mt-md">
    <RetroButton variant="primary" onClick={onScanAgain}>
      {t`SCAN AGAIN`}
    </RetroButton>
  </div>
</RetroPanel>
```
For Phase 65: `h2` label `SUGGESTIONS AVAILABLE` (UI-SPEC). Rows are stacked labeled rows per UI-SPEC; each row has a `[USE]` `RetroButton variant="primary"`. Footer row contains `USE ALL` + `DISMISS`.

**Retro barrel imports** — source: `ScanResultBanner.tsx:15`:
```ts
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";
```
CONTEXT `<code_context>` "Established Patterns": barrel-only imports (Phase 54). `RetroPanel` is exported from `frontend2/src/components/retro/index.ts:2`.

**Retro hazard stripe variants** — source: `ScanErrorPanel.tsx:60-61` (shows the `stripeVariant: "red" | "yellow"` typing precedent):
```ts
const stripeVariant: "red" | "yellow" =
  kind === "library-init-fail" ? "red" : "yellow";
```
UpcSuggestionBanner always uses `variant="yellow"` per UI-SPEC line 196.

**Writing to the form via setValue** — CONTEXT D-14 specifies `setValue(field, value, { shouldDirty: true })`. `ItemForm` does not currently expose `setValue` — planner must decide between:
- (a) Lift RHF form out of `ItemForm` into `ItemFormPage` (provide `control` via `FormProvider`).
- (b) Add an optional `onAcceptSuggestion(field, value)` callback on `UpcSuggestionBanner` and do the `setValue` inside `ItemForm`.
Research Example 5 note (line 949) explicitly flags this as planner discretion.

---

### 5. `frontend2/src/lib/api/items.ts` (MOD — append `lookupByBarcode`)

**Insertion point:** inside the `itemsApi` object literal at lines 86–96. Append as a new method after `delete:` (line 95) before the closing `};`.

**Current end-of-object** (source: `items.ts:86-96`):
```ts
export const itemsApi = {
  list: (wsId: string, params: ItemListParams = {}) =>
    get<ItemListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  get: (wsId: string, id: string) => get<Item>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateItemInput) => post<Item>(base(wsId), body),
  update: (wsId: string, id: string, body: UpdateItemInput) =>
    patch<Item>(`${base(wsId)}/${id}`, body),
  archive: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
  restore: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
  delete: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),
};
```

**Code to add** (per RESEARCH Example 1 + D-06/D-07/D-08):
```ts
// D-06: wraps existing list() with D-07 exact-barcode guard + D-08 workspace_id defense
lookupByBarcode: async (wsId: string, code: string): Promise<Item | null> => {
  const res = await itemsApi.list(wsId, { search: code, limit: 1 });
  const candidate = res.items[0];
  if (!candidate) return null;
  if (candidate.barcode !== code) return null;          // D-07 case-sensitive
  if (candidate.workspace_id !== wsId) {                // D-08 Pitfall #5 guard
    console.error({
      kind: "scan-workspace-mismatch",
      code,
      returnedWs: candidate.workspace_id,
      sessionWs: wsId,
    });
    return null;
  }
  return candidate;
},
```

**Structured-log kind vocabulary** — source: `ScanErrorPanel.tsx:52-58`. The Phase 64 `console.error({ kind, errorName, userAgent, timestamp })` precedent uses `kind` as the tag; Phase 65 extends the kind vocabulary with `scan-workspace-mismatch` (D-08) and `upc-enrichment-fail` (D-16).

---

### 6. `frontend2/src/lib/api/index.ts` (MOD — barrel add)

**Current file (8 lines, full content):**
```ts
export * from "./items";
export * from "./itemPhotos";
export * from "./loans";
export * from "./borrowers";
export * from "./categories";
export * from "./locations";
export * from "./containers";
export * from "./scan";
```

**Pattern:** append `export * from "./barcode";` as the 9th line. Each barrel line maps 1:1 to a domain file in the same directory.

---

### 7. `frontend2/src/features/scan/hooks/useScanLookup.ts` (MOD — body swap)

**Entire current file (13 lines — being rewritten):**
```ts
// Phase 64 STUB - always returns { status: 'idle', match: null, error: null, refetch: no-op }.
import type { ScanLookupResult } from "@/lib/api/scan";

export function useScanLookup(_code: string | null): ScanLookupResult {
  return {
    status: "idle",
    match: null,
    error: null,
    refetch: () => {},
  };
}
```

**Shape lock — MUST NOT change** (source: `frontend2/src/lib/api/scan.ts:6-13`):
```ts
export type ScanLookupStatus = "idle" | "loading" | "success" | "error";

export interface ScanLookupResult {
  status: ScanLookupStatus;
  match: Item | null;
  error: Error | null;
  refetch: () => void;
}
```

**New body pattern** — source: RESEARCH Example 2 (already grounded) and `useItemsList.ts:17-25`:
```ts
import { useQuery } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import { scanKeys, type ScanLookupResult } from "@/lib/api/scan";
import { useAuth } from "@/features/auth/AuthContext";

export function useScanLookup(code: string | null): ScanLookupResult {
  const { workspaceId } = useAuth();
  const query = useQuery({
    queryKey: scanKeys.lookup(code ?? ""),
    queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code!),
    enabled: !!code && !!workspaceId,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  let status: ScanLookupResult["status"];
  if (!code || !workspaceId) status = "idle";
  else if (query.isPending) status = "loading";
  else if (query.isError) status = "error";
  else status = "success";

  return {
    status,
    match: query.data ?? null,
    error: query.error ?? null,
    refetch: () => { void query.refetch(); },
  };
}
```

**Status-mapping rationale** — TanStack Query v5 uses `isPending` not `isLoading` (confirmed in `useItemMutations.ts:61` via `createMutation.isPending`). `isPending` = "no data, enabled, fetching". Before `enabled` flips true, we emit `status: "idle"` explicitly (Phase 64 D-18 exhaustive union).

**Callsite lock** — source: `ScanPage.tsx:82` must stay verbatim:
```ts
const lookup = useScanLookup(banner?.code ?? null);
```
`ScanPage.test.tsx` Test 15 is the gate.

---

### 8. `frontend2/src/features/scan/hooks/useScanHistory.ts` (MOD — add `update` method)

**Current file (48 lines) — insertion site is the `add`/`remove`/`clear` block (lines 31–44).**

**Current `add` method** (source: `useScanHistory.ts:31-34`):
```ts
const add = useCallback((e: Omit<ScanHistoryEntry, "timestamp">) => {
  addToScanHistory(e);
  setEntries(getScanHistory());
}, []);
```

**New `update` method — mirror `add`** (RESEARCH Example 3):
```ts
const update = useCallback(
  (code: string, patch: Partial<Pick<ScanHistoryEntry, "entityType" | "entityId" | "entityName">>) => {
    updateScanHistory(code, patch);
    setEntries(getScanHistory());
  },
  [],
);
```

**Return statement widening** — source: `useScanHistory.ts:46`:
```ts
// Before:
return { entries, add, clear, remove };
// After:
return { entries, add, update, remove, clear };
```

**Import line** — source: `useScanHistory.ts:11-18`. Add `updateScanHistory` to the imported names:
```ts
import {
  getScanHistory,
  addToScanHistory,
  updateScanHistory,    // NEW
  removeFromScanHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from "@/lib/scanner";
```

**`ScanHistoryEntry` shape reference** — source: `frontend2/src/lib/scanner/types.ts:24-37`:
```ts
export interface ScanHistoryEntry {
  code: string;
  format: string;
  entityType: "item" | "container" | "location" | "unknown";
  entityId?: string;
  entityName?: string;
  timestamp: number;
}
```

---

### 9. `frontend2/src/lib/scanner/scan-history.ts` (MOD — add `updateScanHistory`)

**Analogs in same file:**
- `removeFromScanHistory` (lines 125–137) — closest shape (find-by-code + write back).
- `addToScanHistory` (lines 61–87) — error handling + SSR guard precedent.

**`removeFromScanHistory` template** (source: `scan-history.ts:125-137`):
```ts
export function removeFromScanHistory(code: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const history = getScanHistory();
    const filtered = history.filter((h) => h.code !== code);
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.warn("[ScanHistory] Failed to remove from history:", error);
  }
}
```

**New `updateScanHistory`** (RESEARCH Example 3; mirror `removeFromScanHistory` shape):
```ts
export function updateScanHistory(
  code: string,
  patch: Partial<Pick<ScanHistoryEntry, "entityType" | "entityId" | "entityName">>,
): void {
  if (typeof window === "undefined") return;
  try {
    const history = getScanHistory();
    const idx = history.findIndex((h) => h.code === code);
    if (idx === -1) return; // no matching entry — silently noop (D-22 race guard)
    const updated = [...history];
    updated[idx] = { ...updated[idx], ...patch };
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("[ScanHistory] Failed to update history:", error);
  }
}
```

**Barrel export** — source: `frontend2/src/lib/scanner/index.ts:43-52`:
```ts
// History
export {
  getScanHistory,
  addToScanHistory,
  // updateScanHistory,   ← ADD HERE (alphabetical neighbor is createHistoryEntry; keep near addToScanHistory)
  createHistoryEntry,
  removeFromScanHistory,
  clearScanHistory,
  getLastScan,
  formatScanTime,
} from "./scan-history";
```

---

### 10. `frontend2/src/features/scan/ScanPage.tsx` (MOD — match-effect wiring)

**Deletion site:** `ScanPage.tsx:83` — remove `void lookup; // intentionally unused in Phase 64 — consumed in Phase 65`.

**Insertion site:** after the `lookup` line (line 82) and before `handleDecode` (line 87). Add a `useEffect` that fires the history enrichment.

**Precedent for effect-after-query** — `ScanErrorPanel.tsx:51-58` shows the `useEffect` + structured-log pattern; the Phase 65 effect pattern comes directly from RESEARCH Example 3:
```ts
useEffect(() => {
  if (lookup.status === "success" && lookup.match) {
    history.update(lookup.match.barcode ?? banner?.code ?? "", {
      entityType: "item",
      entityId: lookup.match.id,
      entityName: lookup.match.name,
    });
  }
}, [lookup.status, lookup.match, banner?.code, history]);
```

**Add `useEffect` to imports** — source: `ScanPage.tsx:42` currently imports `{ useCallback, useRef, useState }`; append `useEffect`.

**Banner prop widening** — source: `ScanPage.tsx:177-184` (current MATCH-only banner render):
```tsx
{banner && (
  <ScanResultBanner
    code={banner.code}
    format={banner.format}
    timestamp={banner.timestamp}
    onScanAgain={handleScanAgain}
  />
)}
```
After widening (Plan 11/12 will thread through `lookup` state — see banner analog below). Do NOT add the `lookup` props to this callsite until the banner widening is in — keep the commit seam tight.

---

### 11. `frontend2/src/components/scan/ScanResultBanner.tsx` (MOD — widen to 4 states)

**Analog for 4-variant switch with variant-specific copy + stripe color:** `frontend2/src/components/scan/ScanErrorPanel.tsx` (all 124 lines, especially lines 60–89 variant switch).

**Variant-switch pattern** (source: `ScanErrorPanel.tsx:60-89`):
```ts
const stripeVariant: "red" | "yellow" =
  kind === "library-init-fail" ? "red" : "yellow";

let heading: string;
let body: string;
let platformHints: string[] | null = null;

switch (kind) {
  case "permission-denied":
    heading = t`CAMERA ACCESS DENIED`;
    body = t`Barcode scanning needs camera permission. …`;
    platformHints = [ /* … */ ];
    break;
  case "no-camera":
    heading = t`NO CAMERA FOUND`;
    body = t`…`;
    break;
  // …
}
```

**Translate to Phase 65** — 4 states driven by `lookup.status` + `lookup.match` (per UI-SPEC):
- `LOADING` — `status === "loading"` — heading `LOOKING UP…`, no stripe, dimmed code echo, SCAN AGAIN only
- `MATCH` — `status === "success" && match !== null` — heading `MATCHED`, NAME + CODE rows, `VIEW ITEM` (primary) + `SCAN AGAIN`
- `NOT-FOUND` — `status === "success" && match === null` — yellow stripe, heading `NOT FOUND`, `CREATE ITEM WITH THIS BARCODE` (primary) + `SCAN AGAIN`
- `ERROR` — `status === "error"` — red stripe, heading `LOOKUP FAILED`, `RETRY` (primary) + `CREATE ITEM WITH THIS BARCODE` (primary) + `SCAN AGAIN`

**Prop widening** — current file `ScanResultBannerProps` (source: `ScanResultBanner.tsx:18-23`):
```ts
export interface ScanResultBannerProps {
  code: string;
  format: string;
  timestamp: number;
  onScanAgain: () => void;
}
```
After widening — derive from UI-SPEC + `ScanErrorPanel`'s `onRetry` / `onReload` optional-callbacks precedent:
```ts
export interface ScanResultBannerProps {
  code: string;
  format: string;
  timestamp: number;
  // NEW — lookup state (from useScanLookup ScanLookupResult)
  lookupStatus: ScanLookupStatus;   // "idle" | "loading" | "success" | "error"
  match: Item | null;
  onScanAgain: () => void;
  onViewItem?: (id: string) => void;   // MATCH primary
  onCreateWithBarcode?: (code: string) => void;  // NOT-FOUND + ERROR primary
  onRetry?: () => void;   // ERROR primary
}
```

**Existing MATCH-state elements stay** — the code row (lines 40–47), FORMAT pill (lines 48–58), timestamp (line 59–61) are reused inside the MATCH branch (plus a new NAME row). Breaking test: `__tests__/ScanResultBanner.test.tsx` Tests 1–7 assert the `SCANNED` heading and `SCAN AGAIN` button. These need to be re-scoped to the MATCH state — planner covers in test-updates plan.

**VIEW ITEM / CREATE ITEM / RETRY buttons** — all `RetroButton variant="primary"` (UI-SPEC §Color lines 104–112). Structural template is `ScanErrorPanel.tsx:107-121` (flex-wrap gap-md footer with conditional buttons):
```tsx
<div className="flex flex-wrap gap-md">
  {kind === "library-init-fail" && onRetry && (
    <RetroButton variant="primary" onClick={onRetry}>
      {t`RETRY`}
    </RetroButton>
  )}
  <RetroButton variant="neutral" onClick={onUseManualEntry}>
    {t`USE MANUAL ENTRY`}
  </RetroButton>
  {kind === "no-camera" && onReload && (
    <RetroButton variant="neutral" onClick={onReload}>
      {t`RELOAD PAGE`}
    </RetroButton>
  )}
</div>
```

**Blinking cursor (LOADING state)** — UI-SPEC §LOADING specifies `@keyframes retro-cursor-blink` in `globals.css`. The `globals.css` precedent is the existing `toast-slide-in` keyframe — planner must grep `frontend2/src/styles/globals.css` for the exact `@keyframes` block shape. Must respect `prefers-reduced-motion` (UI-SPEC Accessibility).

---

### 12. `frontend2/src/routes/index.tsx` (MOD — add `items/new` route)

**Insertion site:** sibling of existing `items` + `items/:id` routes at lines 107–108.

**Current sibling-route pattern** (source: `routes/index.tsx:107-108`):
```tsx
<Route path="items" element={<ItemsListPage />} />
<Route path="items/:id" element={<ItemDetailPage />} />
```

**Phase 65 addition** (insert between — keep alphabetical / route-specificity order):
```tsx
<Route path="items" element={<ItemsListPage />} />
<Route path="items/new" element={<ItemFormPage />} />
<Route path="items/:id" element={<ItemDetailPage />} />
```
`items/new` before `items/:id` — React Router v7 matches in order of specificity but explicit literal-before-param ordering is project convention (see how `borrowers` / `borrowers/:id` are stacked at lines 105–106).

**Lazy-split or eager?** — Phase 65 does NOT lazy-split `/items/new`. The only lazy route in the file is `/scan` (lines 17–19) because of the heavy scanner chunk. `ItemsListPage` + `ItemDetailPage` are eager; `ItemFormPage` joins them (reuses the existing `ItemForm` already in the main chunk). Bundle budget (`<code_context>` ≤ 3 kB on main-chunk) supports this.

**Import line** — add to the top of the file with the other eager page imports (lines 9–12):
```ts
import { ItemFormPage } from "@/features/items/ItemFormPage";
```

---

### 13. `frontend2/locales/{en,et}/messages.po` (MOD — Lingui extract + ET fill)

**Extraction mechanism:** `bun run i18n:extract` in `frontend2/` — already the established pattern (Phase 63 + 64). CONTEXT `<code_context>` "Established Patterns" confirms EN authoring + ET gap-fill happens in the SAME phase.

**Entry shape precedent** (source: `frontend2/locales/en/messages.po` — existing entries found via grep):
```
#: src/components/scan/ScanResultBanner.tsx:37
msgid "SCANNED"
msgstr "SCANNED"

#: src/features/items/panel/ItemPanel.tsx:62
msgid "NEW ITEM"
msgstr "NEW ITEM"

#: src/features/taxonomy/panel/SlideOverPanel.tsx:128
msgid "DISCARD CHANGES?"
msgstr "DISCARD CHANGES?"
```

**Reusable msgids (already present in catalog — DO NOT duplicate):**
- `SCAN AGAIN`
- `NEW ITEM`
- `CREATE ITEM`
- `WORKING…`
- `DISCARD CHANGES?`
- `Your edits will be lost.`
- `← BACK`
- `DISCARD`
- `CODE`
- `FORMAT`

**New msgids (from UI-SPEC, approximate count ~12):**
- `MATCHED`
- `NAME`
- `VIEW ITEM`
- `NOT FOUND`
- `No item in this workspace matches this barcode.`
- `CREATE ITEM WITH THIS BARCODE`
- `LOOKING UP…`
- `LOOKUP FAILED`
- `Could not reach the server. Check your connection and retry, or create a new item with this barcode.`
- `RETRY`
- `SUGGESTIONS AVAILABLE`
- `BRAND`
- `[USE]`
- `USE ALL`
- `DISMISS`
- `Category hint: {0} — pick manually below.` (ICU placeholder — UI-SPEC line 202)

**ET gap-fill:** run extractor, then manually translate msgstr values in `frontend2/locales/et/messages.po`. The Phase 64 catalog-gate precedent (per Phase 64 doc `64-10 i18n extract`) is the policy — no phase ships with empty `msgstr` in ET.

---

## Shared Patterns

### Shared Pattern 1: TanStack Query with `enabled`-gate

**Source:** `frontend2/src/features/items/hooks/useItemsList.ts:17-25`

**Apply to:** `useBarcodeEnrichment.ts`, `useScanLookup.ts` (body-swap). Both Phase 65 query hooks follow this exact shape; only the `enabled` predicate and key factory differ.

```ts
export function useItemsList(params: ItemListParams) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => itemsApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    placeholderData: (prev) => prev,
  });
}
```

**`workspaceId!` non-null assertion inside `queryFn`** is the project idiom because `enabled: !!workspaceId` ensures the function only runs after the gate is true. The same idiom applies to `useScanLookup` with `code!` + `workspaceId!`.

---

### Shared Pattern 2: Structured `console.error({ kind, ... })` for client-side observability

**Source:** `frontend2/src/components/scan/ScanErrorPanel.tsx:51-58`

```ts
useEffect(() => {
  console.error({
    kind,
    errorName: kind,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    timestamp: Date.now(),
  });
}, [kind]);
```

**Apply to:** `itemsApi.lookupByBarcode` (`kind: "scan-workspace-mismatch"`, CONTEXT D-08) and `useBarcodeEnrichment` `queryFn` (`kind: "upc-enrichment-fail"`, CONTEXT D-16). No backend telemetry — this is browser console only.

**Kind vocabulary so far in repo:**
- `permission-denied`, `no-camera`, `library-init-fail`, `unsupported-browser` (Phase 64)
- `scan-workspace-mismatch` (Phase 65 NEW)
- `upc-enrichment-fail` (Phase 65 NEW)

---

### Shared Pattern 3: Retro banner composition (RetroPanel + HazardStripe + RetroButton)

**Source:** `frontend2/src/components/scan/ScanResultBanner.tsx:33-69` + `ScanErrorPanel.tsx:91-123`

**Apply to:** `UpcSuggestionBanner.tsx` (NEW); widened `ScanResultBanner.tsx` (MOD).

**Barrel import:**
```ts
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";
```

**Heading style (every banner heading in the project):**
```tsx
<h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
  {t`HEADING TEXT`}
</h2>
```

**Hazard stripe with mb-md below heading:**
```tsx
<HazardStripe variant="yellow" className="mb-md" />
```

**Primary button (amber fill):**
```tsx
<RetroButton variant="primary" onClick={handler}>{t`LABEL`}</RetroButton>
```

**Button row:**
```tsx
<div className="flex flex-wrap gap-md">
  {/* or: flex justify-end mt-md for a single right-aligned CTA */}
</div>
```

---

### Shared Pattern 4: Dirty-guard + RetroConfirmDialog

**Source:** `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx:44, 55-61, 125-135`

**Apply to:** `ItemFormPage.tsx` (NEW). Dialog copy is VERBATIM per UI-SPEC lines 212–217.

```ts
// Ref + state
const discardRef = useRef<RetroConfirmDialogHandle>(null);
const [isDirty, setIsDirty] = useState(false);

// Handler — open dialog when dirty, else close immediately
const attemptClose = useCallback(() => {
  if (isDirty) {
    discardRef.current?.open();
    return;
  }
  closeImmediate();
}, [isDirty, closeImmediate]);

// Dialog component
<RetroConfirmDialog
  ref={discardRef}
  variant="destructive"
  title={t`DISCARD CHANGES?`}
  body={t`Your edits will be lost.`}
  escapeLabel={t`← BACK`}
  destructiveLabel={t`DISCARD`}
  onConfirm={() => { /* navigate(-1) in ItemFormPage */ }}
/>
```

**`ItemForm` dirty propagation** — already wired (source: `ItemForm.tsx:71-73`):
```ts
useEffect(() => {
  onDirtyChange?.(formState.isDirty);
}, [formState.isDirty, onDirtyChange]);
```

---

### Shared Pattern 5: URL-state via `useSearchParams`

**Source:** `frontend2/src/features/items/filters/useItemsListQueryParams.ts:36-45`

**Apply to:** `ItemFormPage.tsx` (reads `?barcode=`). Simpler usage — read-only in this phase.

```ts
import { useSearchParams } from "react-router";

const [searchParams] = useSearchParams();
const barcode = searchParams.get("barcode") ?? "";
```

**Encoding the URL on navigation out (NOT-FOUND banner CTA):**
```ts
navigate(`/items/new?barcode=${encodeURIComponent(code)}`);
```
Legacy precedent (`frontend/components/scanner/quick-action-menu.tsx:105`) uses `router.push('/dashboard/items/new?barcode=' + encodeURIComponent(match.code))` — Phase 65 strips the Next.js-specific `/dashboard` prefix. React Router v7 `navigate` signature is identical.

---

### Shared Pattern 6: Page chrome wrapper

**Source:** `frontend2/src/features/scan/ScanPage.tsx:157-165` (the scan page) + `ItemDetailPage.tsx` (width / padding precedent)

```tsx
<div className="max-w-[720px] mx-auto flex flex-col gap-lg p-lg">
  <h1 className="text-[20px] font-bold uppercase tracking-wider text-retro-ink">
    {t`PAGE HEADING`}
  </h1>
  {/* page body */}
</div>
```
Note: `ScanPage` uses `max-w-[480px]` (narrow, mobile-first); `ItemFormPage` should use `max-w-[720px]` per UI-SPEC (form breathing room on desktop) — this is the single measurable deviation from the scan-page template.

---

### Shared Pattern 7: Lingui `t\`…\`` + `useLingui` macro

**Source:** every feature page (e.g. `ItemPanel.tsx:9, 28, 62`):
```ts
import { useLingui } from "@lingui/react/macro";

export function Component() {
  const { t } = useLingui();
  // …
  return <h1>{t`NEW ITEM`}</h1>;
}
```

**Apply to:** every new component / hook that renders or throws user-facing copy. Macro imports go through `@lingui/react/macro` (NOT `@lingui/core` — that would lose tree-shaking).

---

## Test Pattern Assignments

### Test: `frontend2/src/lib/api/__tests__/items.lookupByBarcode.test.ts` (NEW)

**Analog:** `frontend2/src/lib/api/itemPhotos.test.ts` (all 73 lines)

**Pattern — `vi.spyOn(itemsApi, "list").mockResolvedValue(...)`** — the `itemPhotos.test.ts:17-23` pattern is `vi.spyOn(globalThis, "fetch")` because photos tests assert URL shape; for `lookupByBarcode` we assert business-logic guards by spying on the helper's own `list` method (RESEARCH Example 1 line 670).

```ts
// Source: research Example 1 (grounded)
describe("itemsApi.lookupByBarcode", () => {
  it("returns null on empty list", async () => {
    vi.spyOn(itemsApi, "list").mockResolvedValue({ items: [], total: 0, page: 1, total_pages: 0 });
    expect(await itemsApi.lookupByBarcode("ws-1", "5449000000996")).toBeNull();
  });

  it("returns null on guard-fail (barcode differs case-sensitively)", async () => { /* … */ });
  it("logs + returns null on workspace mismatch (Pitfall #5 guard)", async () => { /* … */ });
  it("returns the item on exact match + workspace match", async () => { /* … */ });
});
```

**`beforeEach` / `afterEach` restoration** — source: `itemPhotos.test.ts:14-29`:
```ts
beforeEach(() => { fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(/* … */); });
afterEach(() => { fetchSpy.mockRestore(); });
```
Translate: `spySpy = vi.spyOn(itemsApi, "list");` + `mockRestore` teardown. Also add `vi.spyOn(console, "error").mockImplementation(() => {})` per-test for the workspace-mismatch assertion.

---

### Test: `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts` (MOD — rewrite)

**Analog:** existing file at same path (50 lines) — rewrites Phase 64 stub-era assertions to Phase 65 real-query behavior.

**Current gate that MUST stay** — source: `useScanLookup.test.ts:39-48` (the discriminated-union test):
```ts
it("ScanLookupStatus accepts all four states (D-18 full enum landed)", () => {
  const idle: ScanLookupStatus = "idle";
  const loading: ScanLookupStatus = "loading";
  const success: ScanLookupStatus = "success";
  const error: ScanLookupStatus = "error";
  // …
});
```
This is a compile-time contract test — keep unchanged.

**New test harness needed** — `renderHook` + `QueryClientProvider` fixture (RESEARCH line 1161). No in-repo precedent for `QueryClientProvider` in a hook test — planner must introduce a test helper or rely on `useItemsList` follow-on tests. This is an explicit gap in current test infra; research flags it as "would-be query test".

---

### Test: `frontend2/src/features/items/hooks/__tests__/useBarcodeEnrichment.test.ts` (NEW)

**Analog:** `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts` (stub-era shape test, 50 lines)

**Pattern — regex-gate assertions:** test that `enabled` is false for short/non-numeric codes (UPC gate `/^\d{8,14}$/`), and true for valid codes. No network call should fire when gated off.

---

### Test: `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` (MOD — extend)

**Analog:** the file itself (113 lines).

**Current test fixture** — source: `ScanResultBanner.test.tsx:30-35`:
```ts
const defaultProps = {
  code: "ABC-123-XYZ",
  format: "qr_code",
  timestamp: 1700000000000,
  onScanAgain: vi.fn(),
};
```

**Phase 65 extension** — add variants `matchProps`, `notFoundProps`, `loadingProps`, `errorProps` spread over `defaultProps`. Tests 1–7 currently assert `SCANNED`; after widening they assert the MATCH state shows `MATCHED` and render conditional affordances (`VIEW ITEM`, `RETRY`, `CREATE ITEM WITH THIS BARCODE`).

**Test helpers already set up** — `renderWithI18n` (lines 19–21) and `vi.mock("@/lib/scanner", …)` (lines 8–11) translate 1:1; just extend the `describe` with new `it` blocks per state.

---

### Test: `frontend2/src/features/items/__tests__/ItemFormPage.test.tsx` (NEW)

**Analog:** `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` (not read but listed in research line 1162 — MemoryRouter + QueryClient + userEvent precedent)

Planner will need to:
1. Wrap in `MemoryRouter` with initial entry `/items/new?barcode=5449000000996`.
2. Wrap in `QueryClientProvider`.
3. Render with `<AuthProvider>` (or mock `useAuth` — confirm with taxonomy/category test files for the project idiom).
4. Assert barcode field prefilled, SKU auto-generated once, dirty-guard triggers on CANCEL after edit.

---

### Test: `frontend2/src/features/items/__tests__/UpcSuggestionBanner.test.tsx` (NEW)

**Analog:** `ScanResultBanner.test.tsx` (render + variant assertions pattern, 113 lines)

Test matrix:
- banner renders nothing when `found: false`
- renders yellow hazard stripe + `SUGGESTIONS AVAILABLE` heading
- each suggested field row has `[USE]` button that fires `onAcceptSuggestion(field, value)`
- `USE ALL` button applies all non-empty fields
- `DISMISS` hides the banner (local state)

---

## No Analog Found

All 12 target files have at least one strong analog. The single weak spot:

| File | Gap | Mitigation |
|------|-----|------------|
| `useScanLookup.test.ts` (rewrite) and `useBarcodeEnrichment.test.ts` | No in-repo `QueryClientProvider` hook-test precedent | Planner creates a small test helper (`renderHookWithQueryClient`) or adopts one in a test-infra plan; RESEARCH line 1161 flags this as a "would-be query test" gap. |
| `ItemFormPage.test.tsx` | Needs `AuthProvider` wrap + `MemoryRouter` — no `ItemDetailPage.test.tsx` was read to confirm exact idiom | Planner reads `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` before writing this test (out-of-scope for pattern-mapper). |

---

## Metadata

**Analog search scope:**
- `frontend2/src/lib/api/` (domain API layer)
- `frontend2/src/features/items/` (items feature)
- `frontend2/src/features/scan/` (Phase 64 scan feature)
- `frontend2/src/components/scan/` (Phase 64 banner + error panel)
- `frontend2/src/components/retro/` (retro atom layer — barrel index verified)
- `frontend2/src/lib/scanner/` (scan-history module)
- `frontend2/src/routes/index.tsx` (route table)
- `frontend2/locales/` (i18n po catalog shape)

**Files read during analog extraction (14):**
- `frontend2/src/lib/api/scan.ts`
- `frontend2/src/lib/api/items.ts`
- `frontend2/src/lib/api/categories.ts`
- `frontend2/src/lib/api/index.ts`
- `frontend2/src/lib/api/itemPhotos.test.ts`
- `frontend2/src/features/scan/hooks/useScanLookup.ts`
- `frontend2/src/features/scan/hooks/useScanHistory.ts`
- `frontend2/src/features/scan/ScanPage.tsx`
- `frontend2/src/features/items/panel/ItemPanel.tsx`
- `frontend2/src/features/items/forms/ItemForm.tsx`
- `frontend2/src/features/items/forms/schemas.ts`
- `frontend2/src/features/items/hooks/useItemsList.ts`
- `frontend2/src/features/items/hooks/useItemMutations.ts`
- `frontend2/src/features/items/ItemDetailPage.tsx` (partial — first 80 lines)
- `frontend2/src/features/items/filters/useItemsListQueryParams.ts`
- `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx`
- `frontend2/src/components/scan/ScanResultBanner.tsx`
- `frontend2/src/components/scan/ScanErrorPanel.tsx`
- `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx`
- `frontend2/src/components/retro/RetroPanel.tsx`
- `frontend2/src/components/retro/index.ts`
- `frontend2/src/routes/index.tsx`
- `frontend2/src/lib/scanner/scan-history.ts`
- `frontend2/src/lib/scanner/types.ts`
- `frontend2/src/lib/scanner/index.ts`
- `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts`
- `frontend2/locales/en/messages.po` (header + selected msgid blocks)

**Pattern extraction date:** 2026-04-19
