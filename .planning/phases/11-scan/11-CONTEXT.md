# Phase 11 — Scan — CONTEXT

**Goal:** A single `/scan` route with a live rear-camera barcode scanner (mounted ONCE),
QR/UPC-A/EAN-13/Code128 decode + audio/haptic/visual feedback, Android torch, manual-entry
fallback, last-10 scan history (localStorage), a 4-state result banner, a state-adaptive
post-match quick-action overlay, UPC opt-in prefill, AND a `/claim/:code` claim-as-loan flow.
Plus re-add the by-barcode Playwright spec (standing G-65-01 gap since the v2.2 wipe).

**Requirements:** SCAN-01..12. **Depends on:** Phase 7. **UI phase:** yes (camera UX).
**Plans (roadmap):** TBD — large; expect 4-6 plans.

> The ROADMAP Phase 11 entry is unusually prescriptive (exact lib pin, localStorage keys,
> endpoints, banner states, quick-action logic). Treat it as near-spec; research fills the
> scanner-lib integration + camera/torch/haptics specifics + the claim flow.

## What already exists (REUSE / forward-compat already built)
- `frontend2/src/lib/api/items.ts` `lookupByBarcode(wsId, code)` → `Item | null` (404→null, else
  rethrow). SCAN-08 4-state banner maps: pending=LOADING, item=MATCH, null=NOT-FOUND, throw=ERROR.
- `frontend2/src/features/items/ItemFormPage.tsx` ALREADY supports `?barcode=` prefill with a
  FROM SCAN affordance (Phase 7). SCAN-09 target (`/items/new?barcode=<code>`) is ready.
- `/loans/new?itemId=` deep link (Phase 8) — quick-action "Loan" target.
- `frontend2/src/components/layout/Sidebar.tsx:149` — a DISABLED `Scan` NavItem to enable (`to="/scan"`).
- Retro atoms: Window, RetroTabs (Scan/Manual/History tabs), RetroInput, BevelButton,
  RetroConfirmDialog (clear-history confirm), RetroBadge, retroToast, RetroEmptyState.

## Backend surface (verified 2026-06-13)
- `GET /workspaces/{wsId}/items/by-barcode/{code}` → Item (404 if none). Case-sensitive,
  workspace-scoped (D-07/D-08). itemsApi.lookupByBarcode wraps it.
- `GET /barcode/{barcode}` (GLOBAL, not ws-scoped; param named `{barcode}`, minLen 8 maxLen 14)
  → product info via OpenFoodFacts + OpenProductsDB. SCAN-10 UPC prefill source. Returns
  `{ product: { name/brand/image_url, found } }` (confirm exact shape in research).
- `shortlink` domain shipped (memory: global short_codes registry, commit 86667fd). SCAN-12
  `/claim/:code` resolves a shortlink/barcode → claim-as-loan. Research must map the resolve
  endpoint + the claim flow (login required; reuses loansApi.create against the resolved item's
  inventory entry?).

## NEW DEPENDENCY (execution-critical)
- `@yudiel/react-qr-scanner@2.5.1` (EXACT pin per roadmap/SCAN-02) is NOT yet in deps.
- The foundation plan that adds it MUST run `bun add @yudiel/react-qr-scanner@2.5.1` (updates
  package.json + bun.lockb) and commit the lockfile — it CANNOT use `bun install --frozen-lockfile`.
  All LATER plans branch from the merged base (lib in lockfile) and use frozen install normally.

## Hard parity facts baked into the roadmap (carry into plans)
- BarcodeScanner mounts ONCE, stays mounted; overlays render ON TOP; pause-on-match is
  PROP-DRIVEN (NOT unmount) — iOS PWA camera-permission persistence (SCAN-01/02).
- Feedback (SCAN-03): AudioContext oscillator beep + haptic (`ios-haptics` on iOS 17.4+ Safari,
  `navigator.vibrate` elsewhere) + visual flash/checkmark. (ios-haptics may be a 2nd new dep —
  confirm; navigator.vibrate needs no dep.)
- Torch (SCAN-04): `MediaStreamTrack.getCapabilities().torch` gate; auto-hidden on iOS.
- Manual tab (SCAN-05): RetroInput + LOOK UP CODE.
- History (SCAN-06/07): localStorage key `hws-scan-history`, last 10 (roadmap says ×10; parity
  note allows ×20 — pick 10), row tap re-fires post-scan flow, clear with confirm dialog.
- Banner (SCAN-08): LOADING/MATCH/NOT-FOUND/ERROR; `prefers-reduced-motion`-aware blinking cursor.
- NOT-FOUND (SCAN-09): "Create item with this barcode" → `/items/new?barcode=<code>`.
- UPC prefill (SCAN-10): codes matching `/^\d{8,14}$/` → suggestion banner USE / USE ALL /
  DISMISS from `GET /barcode/{code}` — wired into the item-create form.
- Quick actions (SCAN-11): View Item / Loan / Back to Scan; Loan hidden if active loan,
  Unarchive if archived, Mark Reviewed if `needs_review`.
- Claim (SCAN-12): `/claim/:code` resolve → claim-as-loan form (login required).

## Binding constraints / carry-forward
1. routes/index.tsx single-writer (the `/scan`, `/claim/:code` routes) — one plan owns it.
2. Sidebar.tsx single-writer (enable Scan nav).
3. Declare EVERY edited file; same-wave plans disjoint files.
4. Query keys `["barcode", wsId, code]` / `["item-by-barcode", wsId, code]`; render-loop guard.
5. encodeURIComponent on codes (path-injection guard T-07-02, already in lookupByBarcode).

## Open Questions (RESOLVED — researchers + orchestrator + USER decision, 2026-06-13)
- **Scanner stack (exact pins, all ship in legacy prod, npm-verified):**
  `@yudiel/react-qr-scanner@2.5.1` + `barcode-detector@3.0.8` + `ios-haptics@0.1.4`. The
  FOUNDATION plan adds ALL THREE via `bun add ...@<pin>` + commits the lockfile — NO
  `--frozen-lockfile`. Later plans branch from merged base + use frozen. A v2.2 archived
  `64-RESEARCH.md` + the legacy `/frontend` source are the parity references.
- **OQ4 single-mount (CRITICAL):** `RetroTabs.tsx:94` renders ONLY the active panel (unmounts
  the rest). So `<BarcodeScanner>` MUST be hoisted to a persistent always-mounted sibling layer
  with CSS visibility toggling — NOT inside a RetroTabs panel. Pause is prop-driven (`paused`).
- **OQ1/OQ2 lib+torch:** `<Scanner>` formats restricted to QR/UPC-A/EAN-13/Code128; torch via the
  MediaStreamTrack `applyConstraints({advanced:[{torch}]})` gated on `getCapabilities().torch`
  (iOS auto-hide). barcode-detector polyfills Safari. (See 11-RESEARCH for exact props.)
- **OQ3 haptics/feedback:** `ios-haptics@0.1.4` (iOS 17.4+ Safari) vs `navigator.vibrate`
  elsewhere; AudioContext oscillator beep; visual flash/checkmark with prefers-reduced-motion variant.
- **OQ5 UPC prefill:** GLOBAL `GET /barcode/{barcode}` (param `{barcode}`, 8–14) → product
  {name/brand/image_url, found}; `/^\d{8,14}$/` gate; USE/USE ALL/DISMISS banner plumbs into the
  EXISTING ItemFormPage `?barcode=` prefill (extend it to also accept product suggestion).
- **OQ7 state machine:** ONE post-scan handler funnels live-scan + History-tap + manual-entry →
  lookupByBarcode → 4-state banner → quick-action overlay.
- **SCAN-11 gating (A3/A4 RESOLVED):** add `needs_review` to the frontend2 `Item` type
  (`types.ts` — backend serializes it, frontend lacks it). `is_archived` already exists (Unarchive).
  Active-loan gating has NO field → derive via a `loansApi.byItem(item.id).active.length>0` query.
  MARK REVIEWED action: wire ONLY if the items PATCH/update path can clear `needs_review`; else
  scope that single action out (planner confirms from items update handler). Loan quick-action →
  `/loans/new?itemId=` (inventory_id contract).
- **SCAN-12 claim → USER DECISION: PORT LEGACY (create-entity), NO new backend.**
  `/claim/:code` (login required) → `lookupByBarcode(code)`: MATCH → item detail / quick actions;
  404 → create-item form with the barcode prefilled (reuse `/items/new?barcode=`). This matches
  the shipped legacy create-new-entity UX; do NOT build a claim-as-loan flow or a new resolve
  endpoint. (Roadmap "claim-as-loan" text superseded by this parity-true decision.)
- **by-barcode Playwright spec (G-65-01 re-add):** cannot drive a real camera → test the
  MANUAL-entry + lookup path (manual code → banner MATCH/NOT-FOUND) against the real backend.

## Original Open Questions (now resolved above)
- OQ1 `@yudiel/react-qr-scanner@2.5.1` API: the `<Scanner>` props for single-mount + prop-driven
  pause + format restriction (QR/UPC-A/EAN-13/Code128) + onScan/onError + accessing the
  MediaStreamTrack for torch. Exact integration pattern.
- OQ2 torch: how to reach `getCapabilities().torch` through the lib (does it expose the track?
  or grab via the video element / a custom constraints path)? iOS auto-hide detection.
- OQ3 haptics: is `ios-haptics` a real npm dep (pin?) or inline? The iOS 17.4+ vs navigator.vibrate split.
- OQ4 single-mount architecture: where does `<BarcodeScanner>` live so it stays mounted while
  the Scan/Manual/History tabs + result banner + quick-action overlay render over it, and pause
  is prop-driven? (RetroTabs content swaps must not unmount the scanner.)
- OQ5 `GET /barcode/{barcode}` exact response shape + how SCAN-10 prefill plumbs into ItemFormPage
  (does the form already consume a barcode-prefill product? or new wiring). Note global (not ws) route.
- OQ6 SCAN-12 claim flow: the shortlink resolve endpoint + the claim-as-loan form (what it POSTs;
  login-required routing; reuse loansApi). Map it concretely.
- OQ7 history re-fire + scan-result state machine: where the post-scan flow (lookup→banner→
  quick-actions) lives so a History row tap and a live scan and a manual entry all funnel through it.
- OQ8 plan split + which plan adds the new dep(s) (foundation, non-frozen install).
