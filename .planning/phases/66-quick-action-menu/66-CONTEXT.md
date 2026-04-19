# Phase 66: Quick-Action Menu — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Phase 65's `ScanResultBanner` with a `QuickActionMenu` overlay built on `RetroDialog` (native HTML `<dialog>`) that stays on `/scan` while the scanner is paused-but-mounted. The dialog is the single post-decode surface — its content morphs across four lookup states (LOADING / MATCH / NOT-FOUND / ERROR). On MATCH, the dialog shows state-adaptive actions (View Item, Loan, Back to Scan by default; hide Loan on active loan; Unarchive replaces Loan for archived items; Mark Reviewed appears when `needs_review`). `LoanForm` URL-param preselection is Phase 68 scope — Phase 66 only ships the navigation + URL shape.

**In scope:**
- NEW `frontend2/src/features/scan/QuickActionMenu.tsx` — dialog-based component; owns all four lookup-state branches + the state-adaptive action set + close semantics
- Delete `frontend2/src/components/scan/ScanResultBanner.tsx` + its two test files (wholesale replacement per Phase 65 D-17)
- `ScanPage.tsx` swap: the `{banner && <ScanResultBanner … />}` block becomes `{banner && <QuickActionMenu … />}`; `paused = banner !== null` invariant preserved; existing post-decode handlers (`handleScanAgain`, `handleViewItem`, `handleCreateWithBarcode`, `handleLookupRetry`) reused as-is and extended with `handleLoan`, `handleMarkReviewed`, `handleUnarchive`
- NEW `useMarkReviewedItem()` mutation hook in `frontend2/src/features/items/hooks/useItemMutations.ts` (calls `itemsApi.update(wsId, id, { needs_review: false })`; invalidates `itemKeys.all`; toast feedback mirroring `useArchiveItem` / `useRestoreItem`)
- Call `useLoansForItem(item.id)` gated on `lookup.status === "success" && lookup.match` to probe active-loan state; use `activeLoan === null` as the show-Loan gate
- Lingui EN + ET catalog entries for every new string (gap-fill in this phase, per Phase 63/64/65 pattern)

**Out of scope (belong to later phases or beyond v2.2):**
- `LoanForm` reading `?itemId=` from URL and preselecting item → Phase 68 (INT-LOAN-01). Phase 66 navigates to the stable URL; form-side wiring ships in Phase 68.
- FAB mounted in AppShell → Phase 67 (FAB-01..04)
- Quick Capture inline scan → Phase 69 (INT-QC-03)
- Move-to-location action → v2.3+ (inventory-move UI not yet in /frontend2 — REQUIREMENTS.md:89)
- Repair action → v2.3+ (repair log feature not yet in /frontend2 — REQUIREMENTS.md:90)
- Container / location lookup-by-barcode → v2.3+ (schema doesn't support — only items have barcode)
- Offline scan queue → v2.3+ (online-only stance enforced by CI grep guard)
- Long-press / swipe gestures on overlay actions → future
- Optimistic update for mark-reviewed / unarchive → standard onSuccess invalidation pattern sufficient; revisit if latency is a problem
- Scan-to-repair / scan-to-move wiring → beyond v2.2 (both blocked on upstream feature ports)

</domain>

<decisions>
## Implementation Decisions

### Overlay Container (QA-01 — stay on /scan, scanner paused-but-mounted)

- **D-01:** `QuickActionMenu` is built on `RetroDialog` (native HTML `<dialog>` via `showModal()` — see `frontend2/src/components/retro/RetroDialog.tsx`). The browser gives us scroll-lock, focus-trap, `::backdrop` dim, and keyboard ESC dismissal for free. No new retro primitive. Consumes `RetroDialog` via the `@/components/retro` barrel (Phase 54 rule).
- **D-02:** Dialog open/close is driven by the same `banner !== null` invariant locked in Phase 64 D-02. The dialog is rendered with `{banner && <QuickActionMenu … />}` inside `ScanPage.tsx` at the exact slot currently occupied by `<ScanResultBanner>` (lines 230–246). `QuickActionMenu` uses a `useEffect` that calls `dialogRef.current?.showModal()` on mount and `.close()` on unmount — mount-tied to the banner state. Scanner stays `paused = banner !== null` through the whole lifetime. Dialog open is synchronous with banner set — no intermediate "loading but banner null" window.
- **D-03:** Dismiss parity — ESC, backdrop-click, the `[X]` close button built into `RetroDialog`, and the in-dialog **BACK TO SCAN** button all behave identically: they call `onScanAgain()` which is `setBanner(null)`. That clears banner state AND unpauses the scanner AND tears the dialog down (unmount via the `{banner && …}` conditional). One dismissal semantics; no "half-dismissed, scanner still paused" trap.
- **D-04:** Scanner viewfinder stays mounted and paused underneath the dialog. Native `::backdrop` dims it ~50%. No extra "hide viewfinder" logic — keeps spatial context ("I just scanned that") and avoids a re-permission prompt on iOS PWA (Pitfall #1) that would fire if we unmounted or swapped the scanner subtree.

### Banner Replacement Scope (QA-01 — post-decode surface)

- **D-05:** `QuickActionMenu` is the single post-decode surface. Its dialog content morphs across four mutually-exclusive states driven by `useScanLookup`'s `status` + `match`: **LOADING / MATCH / NOT-FOUND / ERROR**. Phase 65 D-17 pre-locked "Phase 66 replaces the banner wholesale" — this phase executes that replacement. `frontend2/src/components/scan/ScanResultBanner.tsx` + its two test files (`ScanResultBanner.test.tsx`, `ScanResultBanner.states.test.tsx`) are **deleted** in this phase.
- **D-06:** **NOT-FOUND** inside the dialog shows `NOT FOUND` hazard stripe + the code echoed + **CREATE ITEM WITH THIS BARCODE** button (primary variant) navigating to `/items/new?barcode=<encodeURIComponent(code)>` + **BACK TO SCAN**. Mirrors Phase 65 D-19 verbatim. Reuses the existing `handleCreateWithBarcode` in `ScanPage.tsx` line 159.
- **D-07:** **ERROR** state shows `LOOKUP FAILED` hazard stripe + concise error body + **RETRY** (calls `handleLookupRetry` — `lookup.refetch()` from `ScanPage.tsx` line 172) + **CREATE ITEM WITH THIS BARCODE** fallback (so a flaky network doesn't strand the user) + **BACK TO SCAN**. Mirrors Phase 65 D-21.
- **D-08:** **LOADING** state shows `LOOKING UP…` heading + the decoded code dimmed (monospace, muted) + **BACK TO SCAN** still interactive. No action-button skeletons — they would flicker when `match` resolves (Loan may disappear if `activeLoan` is non-null, Unarchive may replace it, Mark Reviewed may appear). Mirrors Phase 65 D-20. The retro-cursor-blink keyframe from Phase 65 (globals.css) can be reused on the "LOOKING UP…" line.

### Loan Button Behavior (QA-02, QA-03, seam with Phase 68)

- **D-09:** On **MATCH**, `handleLoan` navigates to `/loans/new?itemId=<encodeURIComponent(item.id)>`. `LoanForm` currently ignores unknown URL search params — the user lands on /loans/new and re-picks the item manually today. Phase 68 (INT-LOAN-01) shrinks to a single addition in `LoanForm`: read `itemId` via `useSearchParams()` and initialize the item picker. **Phase 66 ships the URL shape + navigation; Phase 68 ships the form-side preselection.** The seam the roadmap already implies is honored.
- **D-10:** While `useLoansForItem(item.id)` is in flight (`activeLoan` not yet known), the **LOAN** button renders as a **disabled skeleton** (same RetroButton variant, `disabled` prop true, muted label). On resolve: show as **LOAN** if `activeLoan === null` and `is_archived !== true`; render as **UNARCHIVE** if `is_archived === true`; hide entirely if `activeLoan !== null`. The skeleton prevents a misleading "click me" affordance that would immediately disappear on resolve. Loading state applies ONLY to the Loan/Unarchive slot — VIEW ITEM and BACK TO SCAN render normally throughout.
- **D-11:** `handleViewItem`, `handleLoan`, and `handleCreateWithBarcode` all call `setBanner(null)` FIRST, then `navigate()`. Explicit close ensures the dialog unmounts cleanly before the route transition and keeps the scanner unpaused — on browser-back the user lands on a clean `/scan` with no stale dialog waiting to re-render. Mark Reviewed / Unarchive do NOT navigate and do NOT close the dialog (they stay open for further actions; the affected button just disappears on the next render after query invalidation).

### Action Layout + State-Adaptive Rules (QA-02, QA-03)

- **D-12:** Action buttons render as a **vertical stack of full-width `RetroButton`s**, primary variant for the lead action, neutral variant for the rest. No grid, no side-by-side layout. Scales cleanly from 2 actions (archived item: **UNARCHIVE**, **BACK TO SCAN**) to 4 actions (`match && !is_archived && !activeLoan && needs_review`: **VIEW ITEM**, **LOAN**, **MARK REVIEWED**, **BACK TO SCAN**). Thumb-friendly on mobile; consistent with `RetroConfirmDialog`.
- **D-13:** In MATCH state, **VIEW ITEM** is the primary (prominent) action button. LOAN / MARK REVIEWED / UNARCHIVE / BACK TO SCAN use the neutral RetroButton variant. Matches Phase 65 D-18 MATCH muscle memory. In NOT-FOUND state, the primary slot goes to **CREATE ITEM WITH THIS BARCODE**. In ERROR state, primary is **RETRY**. In LOADING state, there is no primary action (only BACK TO SCAN, neutral variant).
- **D-14:** **MARK REVIEWED** and **UNARCHIVE** are fire-and-forget mutations with toast feedback: `useMarkReviewedItem()` and `useRestoreItem()` (existing from Phase 60) run with `onSuccess` invalidating `itemKeys.all`; `useToast` shows `t\`Item marked reviewed.\`` / `t\`Item restored.\``. The item refetch clears `needs_review` / `is_archived` on the next render, so the corresponding button is simply **not rendered**. Dialog stays open for further actions. No confirm-first dialog — both mutations are reversible (user can re-archive on the item detail page; mark-reviewed is reversed via `needs_review=true` on the next edit).
- **D-15:** `needs_review` is **additive**, not gating. Order when all conditions apply (`match`, `!is_archived`, `!activeLoan`, `needs_review`): **VIEW ITEM** → **LOAN** → **MARK REVIEWED** → **BACK TO SCAN**. User can loan a needs-review item without marking it reviewed first. Treating needs_review as a pre-loan gate would force a workflow the user may not want ("I'll review later, just loan it now"). QA-03 wording — "Mark Reviewed is shown when the item is flagged needs_review" — says "shown", not "replaces".

### Derived State-Branching Rules (single source of truth — document once)

- **D-16:** Action set in MATCH state is derived from three booleans:
  - `activeLoan !== null` → hide LOAN (or UNARCHIVE); item is already loaned
  - `is_archived === true` → show **UNARCHIVE** in place of LOAN; hide MARK REVIEWED regardless of `needs_review` (archived items aren't in active rotation)
  - `needs_review === true && !is_archived` → show **MARK REVIEWED**
  - Matrix (in-scope combinations):
    | `is_archived` | `activeLoan` | `needs_review` | Rendered actions (in order) |
    |---|---|---|---|
    | false | null    | false | VIEW ITEM → LOAN → BACK TO SCAN |
    | false | null    | true  | VIEW ITEM → LOAN → MARK REVIEWED → BACK TO SCAN |
    | false | non-null| false | VIEW ITEM → BACK TO SCAN |
    | false | non-null| true  | VIEW ITEM → MARK REVIEWED → BACK TO SCAN |
    | true  | null    | — | VIEW ITEM → UNARCHIVE → BACK TO SCAN |
    | true  | non-null| — | VIEW ITEM → UNARCHIVE → BACK TO SCAN (archived items shouldn't be on active loans, but defense-in-depth: show UNARCHIVE anyway) |

### Supporting Hooks & Wiring

- **D-17:** Active-loan probe is gated: `useLoansForItem(item?.id ?? null)` is invoked only when `lookup.status === "success" && lookup.match`. Reuses the existing hook at `frontend2/src/features/loans/hooks/useLoansForItem.ts` (destructures `{ activeLoan, history }`). Don't burn a request on NOT-FOUND / ERROR / LOADING. Use `activeLoan === null` as the "show LOAN" gate.
- **D-18:** NEW hook **`useMarkReviewedItem()`** lives in `frontend2/src/features/items/hooks/useItemMutations.ts` alongside `useArchiveItem` / `useRestoreItem`. Signature: `useMutation<Item, unknown, string>({ mutationFn: (id) => itemsApi.update(workspaceId!, id, { needs_review: false }), onSuccess: → invalidate itemKeys.all + toast "Item marked reviewed.", onError: toast "Could not update item. Try again." })`. Matches the existing mutation boilerplate verbatim.
- **D-19:** `QuickActionMenu` prop surface: `code` + `format` + `timestamp` + `lookupStatus` + `match` + `onScanAgain` + `onViewItem` + `onCreateWithBarcode` + `onRetry` + **new** `onLoan` + **new** `onMarkReviewed` + **new** `onUnarchive`. `ScanPage.tsx` wires the three new callbacks: `handleLoan`, `handleMarkReviewed`, `handleUnarchive`. Match-shape adopted from Phase 65 `ScanResultBannerProps`. Active-loan probing lives INSIDE `QuickActionMenu` (not in `ScanPage`) so ScanPage doesn't need to know the item lookup succeeded before firing the loans query — encapsulation.

### Dialog Lifecycle + Scanner Invariant

- **D-20:** `QuickActionMenu` uses a `useRef<RetroDialogHandle>` + `useEffect` to call `dialogRef.current?.open()` on first mount and `.close()` on unmount cleanup. Because the component itself is conditional (`{banner && <QuickActionMenu … />}`), mount/unmount IS open/close. No separate `isOpen` state. Reset-on-remount matches how `ScanResultBanner` works today — `banner.code` changes trigger a full remount via the key prop; no stale state across different scanned codes.
- **D-21:** Scanner-pause invariant stays exactly as Phase 64 D-02 locked: `paused = banner !== null`. No new invariants. The dialog is the UI consequence of the state; the state is still driven by `setBanner(…)` / `setBanner(null)`.

### Logging, Toasts, i18n

- **D-22:** Structured `console.error` logging follows Phase 64 D-12 vocabulary. If `useLoansForItem` rejects, log `{ kind: "scan-loans-probe-fail", itemId, error }` and render the LOAN button as **hidden** (conservative — don't show a LOAN action we can't verify is safe). Mutation errors route through `useToast` (existing addToast pattern).
- **D-23:** All new UI strings are wrapped in Lingui `t\`…\`` via `useLingui()` and extracted to `frontend2/locales/en/messages.po` + hand-filled in `frontend2/locales/et/messages.po` **in this phase** (per Phase 63 / 64 / 65 pattern — do NOT defer ET to a stabilization phase). New msgids expected: `MARK REVIEWED`, `UNARCHIVE`, `LOAN`, `BACK TO SCAN`, `Item marked reviewed.`, plus any phrasing changes to LOADING / NOT-FOUND / ERROR / MATCH headings relative to current `ScanResultBanner` catalog entries. Verify `Item restored.` already exists (from `useRestoreItem`) — reuse, don't duplicate.

### Claude's Discretion

- Exact retro copy for every new string (EN first; ET hand-fill as part of this phase).
- Exact visual treatment of the item metadata header inside the MATCH dialog (name + short_code — follow Phase 65 D-18 ScanResultBanner MATCH look-and-feel).
- Whether `useMarkReviewedItem()` lives inline in `useItemMutations.ts` or gets its own file (prefer inline — matches `useArchiveItem` / `useRestoreItem` co-location).
- Dialog open/close animation (RetroDialog currently has no entrance animation — leave as-is, respect `prefers-reduced-motion`).
- Whether the LOADING skeleton on the LOAN button uses a dedicated `aria-busy` treatment or just the standard disabled RetroButton.
- Whether reduced-motion users see the retro-cursor-blink on the LOOKING UP… line (Phase 65 globals.css already has a `@media (prefers-reduced-motion: reduce) { animation: none; opacity: 1; }` guard — reuse).
- Test harness: extend `frontend2/src/features/scan/__tests__/fixtures.ts` with a QuickActionMenu-specific render helper if test setup gets repetitive; otherwise stay with `renderWithProviders`.
- Precise structured-log kind strings (match Phase 64 D-12 vocabulary; keep names descriptive).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 66 Upstream (primary)

- `.planning/ROADMAP.md` — Phase 66 goal, depends-on, success criteria (lines 370–379; search for "Phase 66: Quick-Action Menu")
- `.planning/REQUIREMENTS.md` — QA-01..03 text (lines 27–31); out-of-scope list that excludes MOVE (line 89) and REPAIR (line 90) actions explicitly
- `.planning/PROJECT.md` — v2.2 Key Decisions row "Single-page scan flow" (line 252); "Not-found → create navigates to `/items/new?barcode=<code>`" (line 99); retro aesthetic constraints
- `.planning/STATE.md` — v2.2 accumulated decisions (esp. "Single-route scan flow — `/scan` uses overlays, never navigates away mid-scan (iOS PWA camera persistence)" line 93; "Backend lookup via existing list endpoint" → revised in Phase 65 to dedicated /by-barcode endpoint)

### Phase 64 Upstream (LOCKED invariants — do not regress)

- `.planning/phases/64-scanner-foundation-scan-page/64-CONTEXT.md` — D-02 (pause-but-mounted banner pattern — QuickActionMenu reuses this), D-12 (structured log vocabulary), D-18 (`useScanLookup` shape lock in `lib/api/scan.ts`)
- `frontend2/src/features/scan/ScanPage.tsx` — existing callsites: `paused = banner !== null` (line 198); `{banner && <ScanResultBanner … />}` at lines 230–246 (SWAP SITE for `<QuickActionMenu … />`); existing callbacks `handleScanAgain`, `handleViewItem`, `handleCreateWithBarcode`, `handleLookupRetry` (lines 148–174) — reused verbatim; `handleLoan`, `handleMarkReviewed`, `handleUnarchive` are NEW

### Phase 65 Upstream (scope-locked replacement target + data shape)

- `.planning/phases/65-item-lookup-and-not-found-flow/65-CONTEXT.md` — D-17 (Phase 66 replaces `ScanResultBanner` wholesale), D-18 (MATCH display pattern), D-19 (NOT-FOUND: CREATE ITEM WITH THIS BARCODE), D-20 (LOADING copy), D-21 (ERROR: RETRY + CREATE ITEM fallback), D-22 (`useScanHistory.update` backfill), D-06 revised for dedicated `/items/by-barcode/{code}` endpoint
- `frontend2/src/components/scan/ScanResultBanner.tsx` — DELETE target; mine for prop-surface inspiration (`ScanResultBannerProps` interface lines 36–51 maps 1:1 onto `QuickActionMenuProps` with added `onLoan`, `onMarkReviewed`, `onUnarchive`)
- `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` + `ScanResultBanner.states.test.tsx` — DELETE; the replacement tests live alongside `QuickActionMenu.tsx`
- `frontend2/src/features/scan/hooks/useScanLookup.ts` — read shape; Phase 65 delivered the real implementation; Phase 66 consumes `{ status, match, error, refetch }` unchanged
- `frontend2/src/features/scan/hooks/useScanHistory.ts` — read `.update` method (Phase 65 D-22 added it) — already backfills `entityType/entityId/entityName`, but Phase 66 does NOT need to re-touch history on action taps (nav away handles the rest)

### Existing /frontend2 Surface (Phase 66 integrates with)

- `frontend2/src/components/retro/RetroDialog.tsx` — native HTML `<dialog>` wrapper; `RetroDialogHandle` ref gives `open()` / `close()`; hideHazardStripe prop; built-in `[X]` close button; `::backdrop` scroll-lock for free
- `frontend2/src/components/retro/index.ts` — barrel (no new retro atoms added in Phase 66; only adds `QuickActionMenu` in `features/scan/`, not in `components/retro/`)
- `frontend2/src/components/retro/RetroButton.tsx` — primary / neutral / danger variants; full-width via className; disabled state for LOAN skeleton
- `frontend2/src/components/retro/HazardStripe.tsx` — reused for NOT-FOUND (yellow) and ERROR (red) state headers
- `frontend2/src/features/scan/ScanPage.tsx` — the one-and-only swap site (see D-02 above)
- `frontend2/src/lib/api/items.ts` — `Item` interface (lines 3–33): `is_archived?: boolean | null` (line 17), `needs_review?: boolean | null` (line 19), no `active_loan_id` field → probe separately
- `frontend2/src/features/items/hooks/useItemMutations.ts` — existing `useArchiveItem` (lines 80–93), `useRestoreItem` (lines 95–108); **ADD** `useMarkReviewedItem()` next to them, same boilerplate
- `frontend2/src/lib/api/loans.ts` — `loansApi.listForItem(wsId, itemId)` → `GET /workspaces/{wsId}/items/{itemId}/loans` (lines 85–86); `Loan.is_active: boolean` flag (line 25)
- `frontend2/src/features/loans/hooks/useLoansForItem.ts` — destructures `{ activeLoan, history }`; `activeLoan = items.find((l) => l.is_active) ?? null` (line 37)
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth()` → `{ workspaceId }` required for `useMarkReviewedItem`
- `frontend2/locales/en/messages.po` + `frontend2/locales/et/messages.po` — new msgids extracted + hand-filled in-phase; verify `Item restored.` is not duplicated (added by `useRestoreItem`); verify `MATCHED`, `NOT FOUND`, `LOOKUP FAILED`, `LOOKING UP…`, `SCAN AGAIN`, `VIEW ITEM`, `CREATE ITEM WITH THIS BARCODE`, `RETRY` are reused as-is from Phase 65 `ScanResultBanner` extraction — no rename, reuse verbatim

### Research Baseline (MANDATORY — read before planning)

- `.planning/research/SUMMARY.md` — Full milestone research synthesis; §"Quick-action menu" discussions if present
- `.planning/research/FEATURES.md` — Feature inventory for v2.2; Feature Area on post-scan actions (verify the state-adaptive branches are captured)
- `.planning/research/ARCHITECTURE.md` — module layout; integration points for `/scan` + dialog pattern
- `.planning/research/PITFALLS.md` — #1 iOS PWA camera permission reset on navigation (applies to VIEW ITEM / LOAN / CREATE ITEM navigation paths — Phase 65 D-11 already handled this; Phase 66 preserves the pattern); #4 StrictMode double-mount (applies to dialog mount effect — guard with ref)

### Legacy Reference (v1.3 — partial parity baseline)

- `frontend/components/scanner/quick-action-menu.tsx` — legacy v1.3 reference. Layout is `grid-cols-2` (Phase 66 diverges: vertical stack per D-12). Action list is `["view", "loan", "move", "repair"]` for items — no state branches (Phase 66 adds them). MOVE + REPAIR are out of scope per REQUIREMENTS.md:89–90. Do NOT port verbatim (shadcn/ui + lucide-react don't exist in /frontend2).
- Navigation pattern legacy: `router.push('/dashboard/items/new?barcode=' + encodeURIComponent(match.code))` — `/dashboard` prefix is Next.js-specific; /frontend2 uses `/items/new?barcode=<code>` (Phase 65 already established via `handleCreateWithBarcode`)

### Guardrails (CI-enforced)

- `scripts/check-forbidden-imports.mjs` — no `idb` / `serwist` / `offline` / `sync` imports in `frontend2/`. Phase 66 is pure UI + TanStack Query mutations; no offline surface.
- `frontend2/vitest.config.ts` — excludes `**/e2e/**` (Playwright surface from Plan 65-11); `QuickActionMenu.test.tsx` stays in the standard Vitest path alongside component

### Bundle Budget

- Phase 66 adds `QuickActionMenu.tsx` + its test file; deletes `ScanResultBanner.tsx` + two test files. Net change likely **flat or slight shrink** on the `/scan` chunk. No new heavy deps (RetroDialog + RetroButton + existing mutation hooks already shipped). Target: ≤ 1 kB gzip delta on main chunk; `/scan` chunk must not regress Phase 65 baseline (main gzip 114418 B, scanner gzip 58057 B at CLRWiLFx). The pre-phase bundle baseline will be captured in Plan 66-01 per the Phase 64/65 pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `RetroDialog` (`frontend2/src/components/retro/RetroDialog.tsx`) — native HTML `<dialog>` + `showModal()`; ref-based `open` / `close`; `::backdrop` + focus-trap + ESC free of charge. Exactly the primitive Phase 66 needs.
- `RetroButton` + `HazardStripe` — every action button + the NOT-FOUND / ERROR state headers use these; no new atoms.
- `useScanLookup` (locked shape `{ status, match, error, refetch }`) — Phase 66 consumes unchanged (Phase 64 D-18 + Phase 65 D-09).
- `useLoansForItem` (`frontend2/src/features/loans/hooks/useLoansForItem.ts`) — returns `{ activeLoan, history }`; gate Loan button on `activeLoan === null`. Already written, already tested.
- `useArchiveItem` / `useRestoreItem` (`frontend2/src/features/items/hooks/useItemMutations.ts`) — Unarchive path uses `useRestoreItem()` verbatim; pattern for the new `useMarkReviewedItem()`.
- `itemsApi.update(wsId, id, patch)` — existing API helper; `useMarkReviewedItem()` wraps it with `{ needs_review: false }`.
- `useToast` (`frontend2/src/components/retro/RetroToast.tsx`) — toast feedback for Mark Reviewed / Unarchive mutations.
- `useNavigate` from `react-router` (already imported in `ScanPage.tsx`) — `handleLoan` navigates to `/loans/new?itemId=<id>`.
- `encodeURIComponent` — already used in `handleCreateWithBarcode`; reuse for `itemId` in `handleLoan` for defense (item IDs are UUIDs so nothing to escape, but keeps the pattern uniform).
- `useLingui` from `@lingui/react/macro` — all new strings wrapped in `t\`…\`` exactly like Phase 64 / 65 components.

### Established Patterns

- **TanStack Query for server state** (mandatory) — `useMarkReviewedItem` uses `useMutation` with `onSuccess` invalidation of `itemKeys.all`; matches `useArchiveItem` / `useRestoreItem`.
- **`paused = banner !== null`** — scanner-pause invariant; Phase 66 preserves unchanged.
- **Lingui `t\`…\`` everywhere** — EN first, ET gap-fill in-phase (Phase 63/64/65 cadence).
- **Barrel-only `@/components/retro` imports** (Phase 54 rule) — no direct-file imports.
- **CI grep guard** — no `idb`/`serwist`/`offline`/`sync` substrings in `frontend2/`.
- **Structured `console.error({ kind, … })`** — Phase 64 D-12 vocabulary; Phase 66 adds `kind: "scan-loans-probe-fail"`.
- **Dialog mount = open, unmount = close** — tie `RetroDialog.open()` / `.close()` to `useEffect` inside the conditionally-rendered `QuickActionMenu` — no `isOpen` duplication.
- **`setBanner(null)` before `navigate()`** — close dialog explicitly before route change; established in ScanPage already for other handlers (D-11 formalises).
- **Test fixtures** (`frontend2/src/features/scan/__tests__/fixtures.ts`) — `renderWithProviders()` wraps in Auth + QueryClient + Lingui + Router; Phase 66 tests reuse. `setupDialogMocks()` already mocks `HTMLDialogElement.showModal/close` for jsdom.

### Integration Points

- `frontend2/src/features/scan/ScanPage.tsx` — single swap site (lines 230–246); ADD three new callbacks (`handleLoan`, `handleMarkReviewed`, `handleUnarchive`); setBanner(null)-before-navigate applied to `handleViewItem` + `handleCreateWithBarcode` + `handleLoan` per D-11
- `frontend2/src/features/scan/QuickActionMenu.tsx` — NEW component file (owns dialog + all state branches)
- `frontend2/src/features/scan/__tests__/QuickActionMenu.test.tsx` — NEW test file (covers 6 action matrix rows from D-16 + LOADING/NOT-FOUND/ERROR surfaces)
- `frontend2/src/features/items/hooks/useItemMutations.ts` — ADD `useMarkReviewedItem()` (one new export)
- `frontend2/src/components/scan/ScanResultBanner.tsx` — DELETE
- `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` — DELETE
- `frontend2/src/components/scan/__tests__/ScanResultBanner.states.test.tsx` — DELETE
- `frontend2/src/components/scan/index.ts` — remove `ScanResultBanner` + `ScanResultBannerProps` exports (if barrel exists)
- `frontend2/locales/en/messages.po` + `et/messages.po` — extract + gap-fill for new msgids; verify dup-free against Phase 65 catalog
- `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` — existing tests that assert `ScanResultBanner` rendering (screen.findByText("MATCHED") etc.) get re-homed to assert `QuickActionMenu` rendering instead; Phase 66 migrates them (not rewrites)

### Bundle Budget (acceptance gate)

- `/scan` chunk delta ≤ 0 gzip (net-flat or shrink expected; ScanResultBanner deletion should offset QuickActionMenu addition)
- Main chunk delta ≤ 1 kB gzip (RetroDialog is already in the main chunk via RetroConfirmDialog; no new dep)
- The pre-phase bundle baseline measurement follows Phase 64/65 pattern: Plan 66-01 captures main/scanner baselines; final plan verifies no regression.

</code_context>

<specifics>
## Specific Ideas

- `QuickActionMenu.tsx` is written as a **single file** that owns the whole surface (dialog open/close, state branches, all action handlers received as props). No sub-components, no split. Easier to delete wholesale if a future phase overhauls again (same philosophy that justified banner widening in Phase 65).
- The LOADING / NOT-FOUND / ERROR states reuse the **exact retro copy** that Phase 65 extracted into `ScanResultBanner` msgids: `LOOKING UP…`, `NOT FOUND`, `LOOKUP FAILED`, `MATCHED`, `CREATE ITEM WITH THIS BARCODE`, `RETRY`, `VIEW ITEM`, `SCAN AGAIN` (Phase 66 renames to `BACK TO SCAN` — NEW msgid; do NOT reuse `SCAN AGAIN` string). Phase 65's ET catalog already carries these verbatim: `OTSIN…`, `EI LEITUD`, `OTSING EBAÕNNESTUS`, `VASTE LEITUD`, `LOO UUS ESE SELLE VÖÖTKOODIGA`, `PROOVI UUESTI`, `VAATA ESET`, `PROOVI UUESTI`. New additions: `LOAN` → `LAENA`, `MARK REVIEWED` → `MÄRGI ÜLE VAADATUD`, `UNARCHIVE` → `TAASTA ARHIIVIST`, `BACK TO SCAN` → `TAGASI SKANNEERIMA`, `Item marked reviewed.` → `Ese märgitud üle vaadatuks.`. Final EN/ET wording picked during planning.
- Dialog heading varies per state: MATCH = `MATCHED`; NOT-FOUND = `NOT FOUND`; ERROR = `LOOKUP FAILED`; LOADING = `LOOKING UP…`. Match Phase 65 D-17 prior art.
- The `setBanner(null)` explicit close pattern (D-11) is load-bearing — without it, a browser-back from `/items/{id}` can restore `/scan` with `banner` still set in the router's state snapshot, re-opening the dialog unexpectedly. Matches Phase 64 intent: the scanner is the primary citizen of /scan; overlays are transient.
- `useLoansForItem` probing is gated on `match.id` — the hook accepts `null` / `undefined` `itemId` and returns `enabled: false` internally. Verify the existing hook handles nullable input cleanly; if not, wrap with `enabled: !!item?.id` in the callsite. (Current hook signature per scout: `useLoansForItem(itemId)` — needs verification during planning.)
- **Don't probe loans on NOT-FOUND / ERROR / LOADING**. `useLoansForItem` runs only after `lookup.status === "success" && lookup.match !== null`. Two lookups chained, but the second is gated — keeps the loading flicker bounded to just the LOAN/UNARCHIVE slot (VIEW ITEM / MARK REVIEWED render immediately because they depend on `match` fields that are already resolved).
- Phase 66 is the LAST replacement-wholesale beat of the scanner flow in v2.2. Phase 67 adds the FAB (separate component tree); Phase 68 only teaches LoanForm to read a URL param; Phase 69 is its own feature. After Phase 66, `/scan` code is stable for the rest of the milestone.
- The archive / unarchive state branching plus Mark Reviewed is NEW behavior vs legacy v1.3 (which has none of these branches). This means there's no v1.3 test that needs porting — Phase 66 tests are written fresh against the D-16 matrix.

</specifics>

<deferred>
## Deferred Ideas

### Downstream phases (already in roadmap)

- `LoanForm` reads `?itemId=` from `useSearchParams` and preselects item → **Phase 68** (INT-LOAN-01). Phase 66 ships the URL shape; Phase 68 shrinks to one useEffect in LoanForm.
- FAB mounted in AppShell with radial menu → **Phase 67** (FAB-01..04)
- Quick Capture port + inline scan-button barcode autofill → **Phase 69** (INT-QC-01..04)
- Taxonomy cascade policy confirmation → **Phase 70** (CASC-01) — unrelated to /scan

### Beyond v2.2

- **Move action** on scan menu (`/scan` → change item's inventory location) — blocked on inventory-move UI not yet ported to /frontend2. REQUIREMENTS.md:89. v2.3+.
- **Repair action** on scan menu — blocked on repair-log feature not yet ported. REQUIREMENTS.md:90. v2.3+.
- Container / location barcode lookup (schema doesn't support barcodes on those entities).
- Offline scan-to-action queue (online-only stance; CI grep guard).
- Long-press / swipe gestures on overlay actions for power-users.
- Per-item shortcut configuration (user picks their own action set for each item category).
- Inline RetroDialog create-item flow without leaving `/scan` (keeps scanner mounted; revisit if nav-to-`/items/new` friction is measured).
- Optimistic update for mark-reviewed / unarchive — current pattern is onSuccess-invalidation; optimistic update adds complexity for a low-latency mutation. Revisit if UX is slow in practice.
- Action analytics / telemetry — /frontend2 has no analytics wired; adding is its own phase.

### Never

- Grid layout matching legacy v1.3 — uneven action counts look bad (3 or 5 items with a trailing empty cell). Vertical stack is idiomatic for retro + mobile.
- Confirm-first dialog on Mark Reviewed or Unarchive — both are reversible, benign, and this is a frictionless-scan context. Adding a confirm layer directly contradicts the "fast rescan" intent.
- Forcing `needs_review` → must-mark-reviewed gate before loan — denies legitimate workflows.
- Close-overlay-after-Mark-Reviewed / close-overlay-after-Unarchive — breaks the "stay on /scan, keep scanning" invariant.
- ScanResultBanner kept as a "fallback" component — every state must live inside QuickActionMenu; two post-decode surfaces is a maintenance bug waiting to happen.

</deferred>

---

*Phase: 66-quick-action-menu*
*Context gathered: 2026-04-19*
