# Phase 65: Item Lookup & Not-Found Flow — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Phase 64's `useScanLookup` stub with a real workspace-scoped barcode lookup against the existing items list endpoint (with an exact-barcode guard), widen `ScanResultBanner` to render match / not-found / loading / error states, and deliver the "Create item with this barcode" hand-off via a new `/items/new` route plus an opt-in UPC enrichment banner gated on `/^\d{8,14}$/`.

**In scope:**
- `itemsApi.lookupByBarcode(wsId, code)` helper in `frontend2/src/lib/api/items.ts` (wraps existing `list(...)` call with exact-barcode + workspace_id guards)
- `useScanLookup(code)` body swap in `frontend2/src/features/scan/hooks/useScanLookup.ts` (Phase 64 shape locked via D-18)
- `ScanResultBanner` widened to four states (MATCH / NOT-FOUND / LOADING / ERROR)
- New `frontend2/src/features/items/ItemFormPage.tsx` + `Route path="items/new"` registration in `frontend2/src/routes/index.tsx`
- New `lib/api/barcode.ts` (public unauth endpoint) + `useBarcodeEnrichment(code)` hook
- New feature-local `UpcSuggestionBanner` built from the existing `RetroPanel` atom
- `useScanHistory` gains an `update` mutator for post-lookup entityType/entityId backfill
- Lingui EN + ET catalog entries for every new string (gap-fill in this phase, per Phase 63 / 64 pattern)
- `itemCreateSchema` (`frontend2/src/features/items/forms/schemas.ts`) gains an optional `brand` field (D-23) and the `barcode` regex is loosened to allow hyphens/underscores (D-24); `ItemForm` gains a matching brand `RetroFormField`

**Out of scope (belong to later phases):**
- Post-scan QuickActionMenu overlay (View / Loan / Unarchive / Mark Reviewed) → Phase 66
- FAB mounted in AppShell → Phase 67
- Loan preselect from scan → Phase 68
- Quick Capture inline scan → Phase 69
- Container / location barcode lookup (schema doesn't support) → v2.3+
- Offline scan queue → v2.3+ (online-only stance; CI grep guard)
- "Did you mean" fuzzy suggestions — explicit anti-feature per research FEATURES.md
- Making `/items/new` the canonical "create item" path (current ItemPanel slide-over stays primary on `/items`)

</domain>

<decisions>
## Implementation Decisions

### Route & Create-Item Hand-off (LOOK-02)

- **D-01:** A new React Router route `Route path="items/new"` is registered alongside `/items` and `/items/:id` in `frontend2/src/routes/index.tsx`. Inherits `AppShell` chrome. Matches ROADMAP SC#2 URL verbatim.
- **D-02:** New component `frontend2/src/features/items/ItemFormPage.tsx` reads the `barcode` query param via `useSearchParams()`, calls `generateSku()` on mount (once, stored in state like `ItemPanel`), and renders the existing `ItemForm` with `defaultValues={{ barcode, sku }}`. No UPC enrichment fetch is auto-fired from these defaults — the enrichment hook runs independently (see D-12).
- **D-03:** Page chrome mirrors `ItemPanel` create mode: retro header reading "NEW ITEM", CREATE + CANCEL `RetroButton`s pinned to the bottom of the page, and an `isDirty`-guard that prompts before navigate-away (reuses `ItemForm`'s existing `onDirtyChange` plumbing). CANCEL calls `navigate(-1)` with the dirty-guard.
- **D-04:** On a successful create, the mutation's `onSuccess` invalidates `itemKeys.all` AND `scanKeys.lookup(code)`, then `navigate(/items/{created.id})`. The rescan of the same code after creation now hits the new item.
- **D-05:** The existing `ItemPanel` slide-over on `/items` stays the primary "add item" UX for the list page (and for the future FAB in Phase 67). `/items/new` is an alternate entry point used by the scan hand-off, bookmarks, and any future Quick-Add FAB action. Both paths call `useCreateItem` — no duplication of mutation logic.

### Barcode Lookup & Exact-Match Guard (LOOK-01)

- **D-06:** `itemsApi.lookupByBarcode(wsId, code)` helper is added to `frontend2/src/lib/api/items.ts`. All guards live inside this helper so callers can't forget them.
  - **Original (2026-04-18):** Called `list(wsId, { search: code, limit: 1 })` under the hood — no new HTTP endpoint.
  - **Revised (2026-04-19, Plan 65-10 / gap G-65-01):** Calls the dedicated `GET /api/workspaces/{wsId}/items/by-barcode/{code}` endpoint (landed in Plan 65-09). The list endpoint's FTS `search_vector` generated column only indexes (name, brand, model, description) per backend/db/migrations/001_initial_schema.sql:495-500 — barcode + sku are NOT in the FTS corpus, so the original decision made LOOK-01 MATCH state unreachable in production. Evidence: 65-HUMAN-UAT.md Test 4/5 + 65-VERIFICATION.md G-65-01. Fix uses the pre-existing `FindByBarcode` repo method (btree `ix_items_barcode` index). D-07 case-sensitivity + D-08 workspace defense guards remain defense-in-depth on the frontend; the backend is now authoritative via Postgres `WHERE barcode = $2 AND workspace_id = $1`.
- **D-07:** Exact-barcode guard: **case-sensitive** `response.items[0]?.barcode === code`. If the list is empty OR the guard fails, the helper returns `null` (not-found). Guard-fail is NOT exposed as a separate "fuzzy match" UX state — an explicit anti-feature per research FEATURES.md.
- **D-08:** Workspace defense-in-depth: the same helper asserts `response.items[0].workspace_id === session.workspaceId` before returning the match. On mismatch, it emits a structured `console.error({ kind: "scan-workspace-mismatch", code, returnedWs, sessionWs })` (matches Phase 64 D-12 structured-log pattern) and returns `null`. Guards Pitfall #5 (cross-tenant leak on globally-unique UPCs).
- **D-09:** `useScanLookup(code)` replaces the Phase 64 stub body with:
  ```
  useQuery({
    queryKey: scanKeys.lookup(code),
    queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code),
    enabled: !!code && !!workspaceId,
    staleTime: 30_000,
    gcTime: 300_000,
  })
  ```
  Return shape stays exactly as defined in `lib/api/scan.ts` (locked by Phase 64 D-18) — status / match / error / refetch. The Phase 64 ScanPage.tsx callsite (`useScanLookup(banner?.code ?? null)`) is unchanged — Test 15 gate holds.
- **D-10:** `useScanLookup` runs for MANUAL-format entries the same as live decodes (no format gating). Matches Phase 64 D-14 (no format gate on manual input) and D-15 (one post-decode code path). History-tap re-fire hits the same lookup cache via `scanKeys.lookup(code)`.

### External UPC Enrichment (LOOK-03)

- **D-11:** New domain helper `frontend2/src/lib/api/barcode.ts` adds `barcodeApi.lookup(code)` calling `GET /barcode/{code}` (public / unauthenticated endpoint — NOT workspace-scoped) plus a `barcodeKeys` query-key factory. Exported via the `lib/api/index.ts` barrel.
- **D-12:** New hook `frontend2/src/features/items/hooks/useBarcodeEnrichment.ts` wraps the helper with `useQuery({ queryKey: barcodeKeys.lookup(code), queryFn: ..., enabled: /^\d{8,14}$/.test(code ?? ""), staleTime: Infinity })`. The regex gate IS the LOOK-03 spec — no fetch for QR URLs or short alphanumeric codes.
- **D-13:** New feature-local component `frontend2/src/features/items/UpcSuggestionBanner.tsx` renders above the `ItemForm` on `/items/new` when the enrichment query has a `found: true` result. Uses the existing `RetroPanel` atom with a hazard-stripe header reading "SUGGESTIONS AVAILABLE". No new retro primitive — the retro barrel is not widened in this phase.
- **D-14:** Suggestion accept granularity is **per-field chips**: each suggested field (name, brand) renders as a labeled row with its own `[USE]` `RetroButton`; tapping writes to the form via react-hook-form `setValue(field, suggestionValue, { shouldDirty: true })`. Plus a "USE ALL" convenience button (applies every non-empty suggestion field) and a "DISMISS" button (collapses the banner locally).
- **D-15:** External category string is displayed as **helper text only** — e.g. "Category hint: tools/power-tools — pick manually below." `category_id` is never auto-written. User picks from the existing `RetroCombobox` themselves. Avoids fuzzy-match bugs and prevents the app from creating categories on the user's behalf.
- **D-16:** Enrichment failure (network error, timeout, or `{ found: false }`) is **silent**: the banner simply never renders; the form works normally; no toast; no inline spinner on the form. Structured `console.error({ kind: "upc-enrichment-fail", code, error })` for observability. Enrichment is a nice-to-have — the core create flow must not hinge on it.

### Post-Scan Banner States (visual contract for Phase 65)

- **D-17:** `ScanResultBanner` is widened to render four mutually-exclusive states driven by `useScanLookup`'s `status` + `match`: LOADING / SUCCESS+match / SUCCESS+null (not-found) / ERROR. All four live in the same component — Phase 66 replaces the component wholesale with `QuickActionMenu`, so prop-surface widening here is throwaway in a controlled way (no cross-component coupling created).
- **D-18:** **MATCH** state shows: "MATCHED" label + `match.name` in the big uppercase retro style + `match.short_code` in monospace + a "VIEW ITEM" `RetroButton` that navigates to `/items/{match.id}` + the Phase 64 "SCAN AGAIN" dismiss. No category lookup, no thumbnail — avoid duplicating Phase 66 preview surface.
- **D-19:** **NOT-FOUND** state shows: "NOT FOUND" label with hazard stripe + the code echoed + a "CREATE ITEM WITH THIS BARCODE" `RetroButton` navigating to `/items/new?barcode=<code>` + SCAN AGAIN. Rendered inside `ScanResultBanner` as a variant (not a separate `ScanNotFoundPanel`) — consistent with the Phase 66 wholesale-replacement boundary.
- **D-20:** **LOADING** state shows: "LOOKING UP…" line + the dimmed decoded code + SCAN AGAIN (still interactive so a slow lookup doesn't trap the user). Banner renders immediately on decode (scanner paused per D-02) — match / not-found UI swaps in when `useScanLookup` resolves.
- **D-21:** **ERROR** state (status: "error" from the query) shows: "LOOKUP FAILED" with hazard stripe + a concise error message + a "RETRY" `RetroButton` that calls `lookup.refetch()` + "CREATE ITEM WITH THIS BARCODE" fallback (so a flaky network doesn't block LOOK-02) + SCAN AGAIN.

### Scan History Enrichment

- **D-22:** When `useScanLookup` resolves to a match, `ScanPage` (or the hook itself) invokes a new `useScanHistory.update(code, { entityType: "item", entityId: match.id })` mutator that upserts the most-recent history entry for that code. Phase 64 writes `entityType: "unknown"`; this backfills the real reference. Sets up Phase 66 (history-tap → open QuickActionMenu with the already-resolved item) without requiring a re-lookup on every tap. Low cost: one new method on `useScanHistory` + one effect in `ScanPage`.

### Scope Additions Resolved During Planning (2026-04-19)

- **D-23:** `itemCreateSchema` is extended with an optional `brand` field (`brand: z.string().max(120).optional()`) and `ItemForm` gains a matching `RetroFormField` so `UpcSuggestionBanner` BRAND [USE] writes to a first-class field per D-14 — not concatenated into `description`. Backend `CreateItemInput` already accepts `brand`; the frontend schema is the only gap. Resolves an OQ surfaced by the plan checker against D-14.
- **D-24:** `itemCreateSchema.barcode` regex is loosened from `/^[A-Za-z0-9]+$/` to `/^[A-Za-z0-9\-_]+$/` in-phase. Code128 scans commonly contain hyphens; the strict regex would reject real scans mid-flow on `/items/new?barcode=<code>`, breaking LOOK-02 for a whole class of codes. One-line schema change + test update + i18n error-message touch-up. Schemas.ts becomes in-scope for Phase 65.

### Claude's Discretion

- Exact retro copy for every new string (EN first; ET gap-fill happens in this phase per Phase 63 / 64 pattern — do NOT push to a stabilization phase).
- Visual treatment of the "LOOKING UP…" text (plain text vs blinking cursor vs retro shimmer — whichever feels consistent with the rest of the scanner UI).
- Whether `useScanHistory.update` is a separate method or `add()` gains upsert semantics (pick whichever reads cleaner given the existing `add` implementation).
- Exact layout of the `UpcSuggestionBanner` rows (stacked rows vs single-line "NAME: X [USE]" each — design-time decision).
- Dirty-guard dialog copy on CANCEL / navigate-away from `/items/new`.
- Whether `/items/new` has its own `ErrorBoundaryPage` wrap or inherits from the route-level boundary.
- Precise structured-log `kind` strings (match Phase 64 D-12 vocabulary; keep names descriptive).
- Whether enrichment `staleTime: Infinity` is per-query or app-level (session-scoped is intended; pick the simpler TanStack idiom).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 65 Upstream (primary)

- `.planning/ROADMAP.md` — Phase 65 goal, depends-on, success criteria (lines 347–356, search for "Phase 65: Item Lookup")
- `.planning/REQUIREMENTS.md` — LOOK-01..03 text (lines 21–25); out-of-scope list (lines 84–95) that explicitly excludes a new backend barcode endpoint and container/location lookup
- `.planning/PROJECT.md` — v2.2 scope (line 172 "barcode scanning"); Key Decisions rows "Single-page scan flow", "ios-haptics library", "Fuse.js" (for future fuzzy-match context if ever revisited)
- `.planning/STATE.md` — v2.2 accumulated decisions (esp. "Not-found → create navigates to `/items/new?barcode=<code>`", "External UPC enrichment gated by `/^\d{8,14}$/`", "Backend lookup via existing list endpoint")

### Research Baseline (MANDATORY — read in full before planning)

- `.planning/research/SUMMARY.md` — Full milestone research synthesis; §"Item not found → create flow with barcode prefill via URL param" (line 65); §"Lookup result cached across scans" (line 123); §"Defence in depth" (line 181)
- `.planning/research/ARCHITECTURE.md` — §"There is NO /api/items?barcode=<code> endpoint" correction (lines 13–17); §"Pitfall-flagged path — not found → create" diagram (lines 485–515); §Q3 API layer (§scan.ts shape + lookupByBarcode wrapper); §Q4 route changes (lines 195–235); §Q5 FAB positioning not relevant here but flags /scan → no-nav
- `.planning/research/PITFALLS.md` — #1 iOS PWA camera permission reset on navigation (applies to every `/items/new` navigation from `/scan`); #5 Workspace-scoping missed on barcode lookup (Pitfall — globally-unique UPCs guarantee cross-tenant collisions); #S2.2-03 external `/api/barcode/{code}` is unauthenticated + shared tenant (frontend can't prevent, documented)
- `.planning/research/FEATURES.md` — Feature Area 3 "Not Found → Create Item Flow" (table-stakes + differentiators + anti-features); §"Dependencies on existing v2.1" warning that `/items/new` route needs to be added (line 129)

### Phase 64 Upstream (locked shapes — DO NOT regress)

- `.planning/phases/64-scanner-foundation-scan-page/64-CONTEXT.md` — D-01 (useScanLookup shape lock), D-02 (pause + banner invariant), D-15 (history-tap re-fire shared code path), D-18 (status discriminated union locked), D-20 (no-auto-switch on history tap)
- `frontend2/src/lib/api/scan.ts` — `ScanLookupResult` interface + `scanKeys` factory (DO NOT change the return type of useScanLookup — Test 15 callsite gate enforces)
- `frontend2/src/features/scan/hooks/useScanLookup.ts` — body-swap site for Phase 65
- `frontend2/src/features/scan/ScanPage.tsx` — callsite lock at `useScanLookup(banner?.code ?? null)` (line 82); `handleDecode` wires `useScanHistory.add` with `entityType: "unknown"` (line 93) — Phase 65 adds the post-lookup enrichment effect described in D-22

### Existing `/frontend2` Surface (Phase 65 extends)

- `frontend2/src/lib/api/items.ts` — `Item` interface + `itemsApi.list` (Phase 65 adds `lookupByBarcode` helper here; keep barrel export up-to-date)
- `frontend2/src/lib/api/index.ts` — barrel file (update for new `barcodeApi` export per D-11)
- `frontend2/src/features/items/forms/ItemForm.tsx` — existing reusable form; `defaultValues.barcode` is already supported (verified); Phase 65 consumer is the new `ItemFormPage`
- `frontend2/src/features/items/forms/schemas.ts` — `itemCreateSchema` (barcode regex `/^[A-Za-z0-9]+$/` + max 64 chars); `generateSku()` helper; `ItemCreateValues` type
- `frontend2/src/features/items/panel/ItemPanel.tsx` — reference for the SKU-generate-once-on-open pattern + the dirty-guard plumbing (Phase 65 `ItemFormPage` mirrors this pattern but at page level)
- `frontend2/src/features/items/hooks/useItemMutations.ts` — `useCreateItem` hook (invalidation pattern reused on `/items/new` submit)
- `frontend2/src/features/items/hooks/useItemsList.ts` — pattern reference for `workspaceId!` + `enabled: !!workspaceId`
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth()` → `{ workspaceId }`; required for lookup + workspace-id assertion
- `frontend2/src/routes/index.tsx` — add `<Route path="items/new" element={<ItemFormPage />} />` sibling of existing `items` + `items/:id` routes
- `frontend2/src/components/retro/RetroPanel.tsx` — used for UpcSuggestionBanner (D-13); no new retro atom added
- `frontend2/src/components/scan/ScanResultBanner.tsx` — widened in-place to four states (D-17..21)
- `frontend2/src/features/scan/hooks/useScanHistory.ts` — gains `update(code, patch)` mutator (D-22)
- `frontend2/locales/en/messages.po` + `frontend2/locales/et/messages.po` — Lingui EN + ET catalogs; gap-fill happens in this phase (per Phase 63 + 64 pattern)

### Legacy Reference (v1.3 — navigation shape precedent only)

- `frontend/components/scanner/quick-action-menu.tsx:105` — legacy uses `router.push('/dashboard/items/new?barcode=' + encodeURIComponent(match.code))`; the `/dashboard` prefix is Next.js-specific and not ported to /frontend2
- `frontend/lib/scanner/scan-history.ts` — `ScanHistoryEntry.entityType` + `entityId` original shape that D-22 now finally populates
- Do NOT port legacy component code verbatim; /frontend2 uses the retro library + react-hook-form + zod, not shadcn/ui

### Guardrails (CI-enforced)

- `scripts/check-forbidden-imports.mjs` — CI grep guard; no `idb` / `serwist` / `offline` / `sync` substrings in `frontend2/`. LOOK-01 lookup is online-only; no offline cache layer.

### Bundle Budget

- `/items/new` adds one new page component + a new banner atom. No new heavy deps (react-hook-form + zod + RetroPanel already ship). Main-chunk gzip delta target: ≤ 3 kB. `/scan` chunk must not regress the Phase 64 baseline (main-chunk gzip SHRANK 37.8 kB after Phase 64 — protect that).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `ItemForm` (`frontend2/src/features/items/forms/ItemForm.tsx`) — already accepts `defaultValues.barcode` + `.sku`; Phase 65 consumer is the new `ItemFormPage` at `/items/new`
- `generateSku()` (`frontend2/src/features/items/forms/schemas.ts`) — auto-gen pattern copied from `ItemPanel.open('create')`
- `useCreateItem` (`frontend2/src/features/items/hooks/useItemMutations.ts`) — mutation hook with existing invalidation; Phase 65 `ItemFormPage` calls it + adds `scanKeys.lookup(code)` to the invalidation list
- `RetroPanel`, `RetroButton`, `RetroCombobox` — all used; no new retro primitives added in Phase 65
- `ScanResultBanner` (`frontend2/src/components/scan/ScanResultBanner.tsx`) — widened in-place; Phase 66 replaces it wholesale
- `scanApi` / `scanKeys` (`frontend2/src/lib/api/scan.ts`) — `ScanLookupResult` shape locked by Phase 64; Phase 65 does NOT modify this file (implementation body change lives entirely in the hook)
- `useAuth()` — provides `workspaceId` for the lookup + for the workspace-id defense assertion
- `useScanHistory` (`frontend2/src/features/scan/hooks/useScanHistory.ts`) — gains one new method (`update(code, patch)`); surface contract stays compatible

### Established Patterns

- **TanStack Query for server state** — mandatory; use `scanKeys.lookup(code)` + `barcodeKeys.lookup(code)` factories
- **`workspaceId!` + `enabled: !!workspaceId`** — lookup query must follow the same gating as every other workspace-scoped query
- **`useSearchParams()` for URL-driven state** — already used in `features/items/filters/useItemsListQueryParams.ts`; precedent for reading `?barcode=` on `/items/new`
- **Lingui `t\`...\`` for all new UI strings** — EN first; ET gap-fill in this phase (per Phase 63 + Phase 64 pattern)
- **Barrel-only imports from `@/components/retro`** (Phase 54 decision) — no direct file imports into /frontend2 files
- **CI grep guard blocks `idb` / `serwist` / `offline` / `sync`** — lookup is online-only; no localStorage for lookup results
- **react-hook-form + zod + `RetroFormField`** — existing `ItemForm` uses this substrate; `ItemFormPage` does not bypass it
- **Structured `console.error({ kind, ... })`** — Phase 64 D-12 logging pattern; Phase 65 uses `kind: "scan-workspace-mismatch"` and `kind: "upc-enrichment-fail"`
- **Dirty-guard via `onDirtyChange` callback** — pattern already in `ItemPanel`; `ItemFormPage` mirrors it at page level

### Integration Points

- `frontend2/src/routes/index.tsx` — add `Route path="items/new"`; no changes to existing routes
- `frontend2/src/lib/api/items.ts` — add `lookupByBarcode` to `itemsApi`
- `frontend2/src/lib/api/barcode.ts` — NEW file (`barcodeApi` + `barcodeKeys`)
- `frontend2/src/lib/api/index.ts` — export `barcode.ts` from the barrel
- `frontend2/src/features/scan/hooks/useScanLookup.ts` — body swap (shape stays identical)
- `frontend2/src/features/scan/hooks/useScanHistory.ts` — add `update` method
- `frontend2/src/features/scan/ScanPage.tsx` — remove `void lookup;` (line 83); wire the match-effect that calls `useScanHistory.update`
- `frontend2/src/components/scan/ScanResultBanner.tsx` — widen props + add three new visual states
- `frontend2/src/features/items/ItemFormPage.tsx` — NEW page component
- `frontend2/src/features/items/hooks/useBarcodeEnrichment.ts` — NEW hook
- `frontend2/src/features/items/UpcSuggestionBanner.tsx` — NEW component
- `frontend2/locales/en/messages.po` + `et/messages.po` — extract + gap-fill every new string before shipping

### Bundle Budget (acceptance gate)

- `/items/new` route chunk is tiny: reuses existing form + mutation hooks. Gzip delta target on main chunk: **≤ 3 kB**. `/scan` chunk must not grow from Phase 64 baseline (Phase 64 shipped with main-chunk gzip down 37.8 kB; Phase 65 must preserve the chunking and not re-bundle enrichment fetch code into the scan chunk).
- Enrichment helper (`lib/api/barcode.ts`) is a thin wrapper — ≤ 500 bytes gzip. Hook + banner each ≤ 1 kB gzip. Total Phase 65 delta target: **≤ 5 kB gzip** on the main chunk.

</code_context>

<specifics>
## Specific Ideas

- The Phase 64 → Phase 65 seam is intentional: `useScanLookup` return shape is locked by Phase 64 D-18 so Phase 65 is a body-only swap. `ScanPage.tsx` Test 15 gate is the tripwire — if the callsite or return shape changes, tests fail loudly.
- Workspace defense-in-depth is a research PITFALL #5 guard, not paranoia — UPCs are globally unique across the world, so two different workspaces owning the same UPC is a *certainty*. Frontend assertion catches a backend regression before it leaks across tenants.
- The exact-barcode guard (D-07) is case-sensitive on purpose: downstream barcode scans are machine-read, so case preservation is deterministic. The Manual tab's user-typed entry preserves whatever the user typed. If we ever need case-insensitive match, it's a future decision with a `/scan` test suite to protect.
- The UPC enrichment banner (LOOK-03) is intentionally NOT on the scan result banner (before navigation). ROADMAP SC#3 explicitly wires it to the item-create form. This keeps the scan flow fast (one query, not two) and keeps the enrichment decision point in the context where the user is actually filling in the form.
- Category-hint-only (D-15) avoids two bug classes: (1) creating a category silently on the user's behalf; (2) fuzzy-matching an external free-text category to the wrong existing UUID. Both would be hard to detect.
- Banner widening (D-17..21) inside `ScanResultBanner` — rather than a new `ScanNotFoundPanel` or swapping components conditionally — is tactical: Phase 66 replaces the banner wholesale with `QuickActionMenu`, so prop-surface growth here is bounded. A sibling `ScanNotFoundPanel` would create a coupling that Phase 66 would have to unwind.
- `useScanHistory.update` (D-22) — intended as a separate method rather than upsert-on-add. The caller `add` fires on decode (before lookup); `update` fires after lookup resolves. Mixing them risks a race where the lookup resolves AFTER the user scans a second code and the wrong entry gets mutated.

</specifics>

<deferred>
## Deferred Ideas

### Downstream phases (already in roadmap)

- Post-scan QuickActionMenu overlay with View / Loan / Back to Scan + state-adaptive actions → **Phase 66** (QA-01..03)
- FAB with radial menu (Quick-Add entry point that could point to `/items/new`) → **Phase 67** (FAB-01..04)
- Loan preselect via `/loans/new?itemId=<id>` from scan menu → **Phase 68** (INT-LOAN-01)
- Quick Capture port (separate inline scan path for bulk entry) → **Phase 69** (INT-QC-01..04)

### Beyond v2.2

- Container / location lookup by barcode — schema doesn't support (only items have barcode). Blocked until schema extension.
- Offline scan queue — online-only stance enforced by CI grep guard.
- Duplicate-scan soft warning (consult recent scan history before declaring not-found) — differentiator.
- GTIN-14 canonicalization on write + lookup — revisit if duplicate-barcode regressions surface post-LOOK-01.
- "Did you mean" fuzzy suggestions on not-found — explicit anti-feature per research.
- Inline RetroDialog create-item flow on `/scan` (keeps scanner mounted; milestone-level revisit "if friction").
- Per-field enrichment rejection with "don't suggest again" memory.
- Enrichment category string → fuzzy-match to existing categories with similarity threshold (risky; deferred).
- Making `/items/new` the canonical "create item" path + deprecating `ItemPanel` slide-over on `/items` — scope decision for a later refactor.

### Never

- Auto-write UPC enrichment values — data-quality hazard; LOOK-03 explicitly says "user must accept".
- Silent cross-tenant match rendering — Pitfall #5 guard is mandatory.
- New backend `/api/items?barcode=` endpoint — REQUIREMENTS.md out-of-scope (existing FTS endpoint suffices).
- Ported shadcn/ui components from /frontend legacy — retro language only.

</deferred>

---

*Phase: 65-item-lookup-and-not-found-flow*
*Context gathered: 2026-04-18*
