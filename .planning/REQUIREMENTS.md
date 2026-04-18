# Requirements: v2.2 Scanning & Stabilization

**Milestone:** v2.2
**Status:** Active
**Last updated:** 2026-04-18

---

## v2.2 Requirements

### Scanning Core (SCAN)

- [ ] **SCAN-01**: User can open `/scan` and see a live rear-camera preview with scanner controls (single-page route, scanner stays mounted during overlays)
- [ ] **SCAN-02**: Scanner decodes QR, UPC-A, EAN-13, and Code128 formats using `@yudiel/react-qr-scanner@2.5.1`
- [ ] **SCAN-03**: On successful scan, user hears an audio beep (AudioContext oscillator), feels haptic feedback on Android via `navigator.vibrate`, and sees a visual flash/checkmark (iOS haptic via `ios-haptics` is deferred out of Phase 64 per Phase 64 CONTEXT.md D-17 — picked up in a later scanner-polish phase)
- [ ] **SCAN-04**: User can toggle the flashlight/torch on Android devices that expose `MediaStreamTrack.getCapabilities().torch` (button auto-hidden on iOS)
- [ ] **SCAN-05**: User can manually enter a barcode via a fallback input when camera scan fails or permission is denied
- [ ] **SCAN-06**: User sees the last 10 scanned codes in a history list (localStorage key `hws-scan-history`), each with timestamp and quick-rescan action
- [ ] **SCAN-07**: User can clear scan history with a confirm prompt

### Lookup & Not-Found Flow (LOOK)

- [ ] **LOOK-01**: On scan, user sees the matched item via `GET /api/workspaces/{wsId}/items?search={code}&limit=1` (FTS over name, SKU, barcode)
- [ ] **LOOK-02**: If no item matches, user sees a "not found → create item" action that navigates to the item-create form with the barcode pre-filled (`/items/new?barcode=<code>`)
- [ ] **LOOK-03**: For codes matching `/^\d{8,14}$/`, the item-create form shows suggested name/brand from `GET /api/barcode/{code}` as opt-in prefill (suggestion banner, user accepts to apply)

### Quick-Action Menu (QA)

- [ ] **QA-01**: After a successful scan, user sees a quick-action overlay menu while the scanner remains paused-but-mounted
- [ ] **QA-02**: Menu shows View Item, Loan, and Back to Scan actions by default
- [ ] **QA-03**: Menu adapts to item state — "Loan" hidden if item is on an active loan; "Unarchive" shown instead of Loan for archived items; "Mark Reviewed" shown for items flagged `needs_review`

### Mobile FAB (FAB)

- [ ] **FAB-01**: Floating action button visible bottom-right on Dashboard, Items, Loans, Borrowers, Taxonomy routes, respecting iOS `safe-area-inset-bottom`
- [ ] **FAB-02**: Tapping the FAB opens a radial menu of context-aware actions per route (e.g. Items route shows Scan / Add Item / Quick Capture)
- [ ] **FAB-03**: Radial menu closes on outside-tap, ESC key, or action selection; uses CSS transitions (no `motion` dep)
- [ ] **FAB-04**: FAB is hidden on `/scan`, `/auth/*`, and when any modal/drawer is open

### Loan Scan Integration (INT-LOAN)

- [ ] **INT-LOAN-01**: From a scan quick-action menu, user can tap "Loan" and land on `/loans/new?itemId=<id>` with the item preselected in the form

### Quick Capture Port + Scan Integration (INT-QC)

- [ ] **INT-QC-01**: User can access a Quick Capture route in /frontend2 (ported from v1.9) with camera-first rapid item entry
- [ ] **INT-QC-02**: Quick Capture auto-generates SKU (`QC-{timestamp}-{random}`) and persists sticky batch settings (category/location) in session
- [ ] **INT-QC-03**: Within Quick Capture, user can tap a scan button to scan a barcode and autofill the item's barcode field
- [ ] **INT-QC-04**: Quick Capture items are flagged `needs_review` and surface via a Needs Review filter chip in the items list (wiring existing backend `needs_review` column)

### Taxonomy Cascade Policy (CASC)

- [ ] **CASC-01**: When deleting a category or location with assigned items, user sees a warning with item count and must choose between "Cancel" and "Unassign items and delete" (no silent cascade; no orphaned foreign keys)

### Stabilization — Docs & Process (STAB-DOCS)

- [ ] **STAB-DOCS-01**: Phase 58 (Taxonomy) has a VERIFICATION.md produced from an actual verification pass (real browser visit, real test runs — not memory reconstruction)
- [ ] **STAB-DOCS-02**: Phase 59 (Borrowers) has a VERIFICATION.md from an actual verification pass
- [ ] **STAB-DOCS-03**: Phase 60 (Items) has a VERIFICATION.md from an actual verification pass
- [ ] **STAB-DOCS-04**: Phase 57's 8 `/demo` retro-primitive checkpoints each have a signed-off entry from a live `/demo` visit (screenshots or notes referencing actual rendered state)
- [ ] **STAB-DOCS-05**: v1.9 Phases 43–47 have Nyquist validation completed with evidence from actual test-run artifacts

### Stabilization — Code & Tests (STAB-CODE)

- [ ] **STAB-CODE-01**: Backend `internal/domain/syncpush/pendingchange/handler.go` test coverage is ≥80% with behavioral assertions (assertions on DB state changes and response shape, not just `status == 200`) — requires interface extraction for mockability
- [ ] **STAB-CODE-02**: Backend `internal/jobs/ProcessTask` has an actionable coverage baseline (interface extracted, asynq client mocked, at least one behavioral test per task type)
- [ ] **STAB-CODE-03**: Cypress test suite contains zero `cy.wait(number)` or `waitForTimeout` calls (replaced with `cy.intercept().as()` / `cy.get().should()` waits)
- [ ] **STAB-CODE-04**: Vitest suite passes with zero failing tests (4 currently failing are either fixed or explicitly skipped with a `TODO(v2.3)` reason)

---

## Future Requirements (v2.3+)

- Offline/PWA support for `/frontend2` (currently online-only by design)
- Repair log port to `/frontend2` (v1.2 feature, not yet in retro frontend)
- Declutter assistant port to `/frontend2` (v1.2 feature)
- Bulk photo operations (CSV import, batch-move between items)
- Backend coverage push on remaining handlers (items, loans, borrowers) to ≥80%
- Playwright fake-camera E2E for scanner (deferred — Vitest component tests are v2.2 primary coverage)
- FAB intent-mode toggle (press-and-hold for secondary action set)

---

## Out of Scope

**Explicitly excluded from v2.2 (with reasoning):**

- **Offline scan queue** — project is online-only by design (CI grep guard enforces no `idb`/`serwist`/`offline`/`sync` imports in /frontend2). v2.1 confirmed the online-only stance.
- **Move-to-location action from scan menu** — no inventory-move UI exists in /frontend2 yet. Out of scope until move flow is ported.
- **Repair action from scan menu** — repair-log feature not yet in /frontend2. Out of scope.
- **Container/location lookup by barcode** — only items have barcode fields in the schema. Containers/locations are looked up by other means.
- **`motion` / framer-motion dependency for FAB** — CSS transitions are sufficient for the retro aesthetic and save ~60 KB. Out of scope.
- **`lucide-react` icons in FAB/scan UI** — retro monospace ASCII glyphs match the design language. Out of scope.
- **New backend barcode-lookup HTTP endpoint** — existing `/api/workspaces/{wsId}/items?search={code}` FTS already serves lookup. No new endpoint needed.

---

## Traceability

Every v2.2 REQ-ID maps to exactly one phase. Coverage: 32/32 (100%).

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SCAN-01 | Phase 64 | Pending |
| SCAN-02 | Phase 64 | Pending |
| SCAN-03 | Phase 64 | Hooks landed (64-05); full wire-up in 64-07/09 |
| SCAN-04 | Phase 64 | Pending |
| SCAN-05 | Phase 64 | Pending |
| SCAN-06 | Phase 64 | Hook landed (64-05); UI wire-up in 64-08 |
| SCAN-07 | Phase 64 | Pending |
| LOOK-01 | Phase 65 | Pending |
| LOOK-02 | Phase 65 | Pending |
| LOOK-03 | Phase 65 | Pending |
| QA-01 | Phase 66 | Pending |
| QA-02 | Phase 66 | Pending |
| QA-03 | Phase 66 | Pending |
| FAB-01 | Phase 67 | Pending |
| FAB-02 | Phase 67 | Pending |
| FAB-03 | Phase 67 | Pending |
| FAB-04 | Phase 67 | Pending |
| INT-LOAN-01 | Phase 68 | Pending |
| INT-QC-01 | Phase 69 | Pending |
| INT-QC-02 | Phase 69 | Pending |
| INT-QC-03 | Phase 69 | Pending |
| INT-QC-04 | Phase 69 | Pending |
| CASC-01 | Phase 70 | Pending |
| STAB-DOCS-01 | Phase 71 | Pending |
| STAB-DOCS-02 | Phase 71 | Pending |
| STAB-DOCS-03 | Phase 71 | Pending |
| STAB-DOCS-04 | Phase 71 | Pending |
| STAB-DOCS-05 | Phase 71 | Pending |
| STAB-CODE-01 | Phase 72 | Pending |
| STAB-CODE-02 | Phase 72 | Pending |
| STAB-CODE-03 | Phase 72 | Pending |
| STAB-CODE-04 | Phase 72 | Pending |

**Phase summary:**

| Phase | Req Count | REQ-IDs |
|-------|-----------|---------|
| 64 — Scanner Foundation & Scan Page | 7 | SCAN-01..07 |
| 65 — Item Lookup & Not-Found Flow | 3 | LOOK-01..03 |
| 66 — Quick-Action Menu | 3 | QA-01..03 |
| 67 — Mobile FAB with Radial Menu | 4 | FAB-01..04 |
| 68 — Loan Scan Integration | 1 | INT-LOAN-01 |
| 69 — Quick Capture Port + Scan Integration | 4 | INT-QC-01..04 |
| 70 — Taxonomy Cascade Policy | 1 | CASC-01 |
| 71 — Stabilization: Docs & Process | 5 | STAB-DOCS-01..05 |
| 72 — Stabilization: Code & Tests | 4 | STAB-CODE-01..04 |
| **Total** | **32** | — |

---

*Requirements defined: 2026-04-18*
*Roadmap + traceability filled: 2026-04-18*
*Milestone: v2.2 Scanning & Stabilization*
*Source: `.planning/research/SUMMARY.md` + 4 parallel research outputs + user scoping decisions*
