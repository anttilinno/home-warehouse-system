---
phase: 14-system-group
verified: 2026-06-13T21:00:00Z
status: human_needed
score: 10/12
overrides_applied: 0
overrides:
  - must_have: "Bottombar A/R/D shortcuts (Approve / Reject / Defer)"
    reason: >
      No backend defer endpoint exists (verified in 14-CONTEXT.md OQ1 + 14-01-SUMMARY decisions).
      The CONTEXT's OQ resolution pre-sanctioned A/R-only before execution began.
      The Defer chip would imply server-side state that does not exist; omitting it is
      the correct behaviour, not a gap. Roadmap SC wording predates the backend audit.
    accepted_by: "antti"
    accepted_at: "2026-06-13T21:00:00Z"
  - must_have: "Sync History page shows past sync events with timestamps, status, and error details"
    reason: >
      v3.0 is online-only; there is no sync-event-history backend (only GET /sync/delta,
      a data-pull not an event log). The CONTEXT's OQ2 resolution pre-sanctioned an honest
      empty/informational state. Fabricating events would violate the threat model (T-14-17)
      and the FOUND-02 CI guard blocks any sync* import. The page correctly declares itself
      a parity-vestigial residue and flags for roadmap de-scope. Accepted as intended final UI.
    accepted_by: "antti"
    accepted_at: "2026-06-13T21:00:00Z"
human_verification:
  - test: "Navigate to /approvals, select two rows with Shift+Click, click APPROVE in the BulkActionBar and confirm approval toast + rows disappear"
    expected: "Both rows approved; 'Approved 2.' success toast; pending count drops"
    why_human: "Requires real pending-changes data; seed state varies per environment"
  - test: "Navigate to /approvals as a non-owner/non-admin user; confirm the 403 calm-guard renders"
    expected: "'Only workspace owners and admins can review approvals.' empty-state; no table"
    why_human: "Requires a second test account with member role"
  - test: "Navigate to /wishlist; switch tabs (WANTED / ORDERED / ACQUIRED); add a wishlist item; transition status from wanted → ordered via the edit dialog"
    expected: "Item appears under WANTED; after edit it appears under ORDERED; 409 calm-guard shown for illegal transitions"
    why_human: "Status transition flow requires live data and visual verification of badge colours"
  - test: "Navigate to /imports; select entity type 'items'; upload a CSV file; confirm job appears in the HISTORY table"
    expected: "Upload triggers POST /imports/upload; new row in history table with status pending/processing; export button downloads a blob"
    why_human: "Requires a real CSV file and the running backend + worker"
  - test: "Navigate to /declutter; verify score badges colour (danger >= 70, warn >= 40, neutral otherwise); click 'Mark used' on a row"
    expected: "RetroConfirmDialog opens; confirm removes the row; list reloads"
    why_human: "Requires real inventory entries with varying usage data"
  - test: "On the Inventory list page, click EXPORT CSV and verify the downloaded file contains inventory data"
    expected: "CSV file named 'inventory.csv'; headers: item_id,location_id,...; non-empty data rows"
    why_human: "File-download behaviour not verifiable without a running browser session with data"
---

# Phase 14: System Group — Verification Report

**Phase Goal:** User can review approvals (with bulk-action support), my-changes, sync history,
and imports/exports under the sidebar `// SYSTEM` group — all using the same activity-table
pattern from earlier feature phases. Plus wishlist and declutter pages (parity additions).

**Verified:** 2026-06-13T21:00:00Z
**Status:** human_needed — all automated checks pass (10/12 truths, 2 PASSED via override for
pre-sanctioned backend gaps); 6 items require human browser verification with live data.
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/approvals` renders paginated activity-table of pending changes | VERIFIED | `ApprovalsPage.tsx:59` — `useApprovalsList()` feeds RetroTable; `pendingChanges.ts:33` calls `GET /pending-changes`; 18/18 tests pass |
| 2 | Shift+Click multi-select works on the approvals table | VERIFIED | `ApprovalsPage.tsx:275` — `onClick={(e) => sel.onRowClick(change.id, e)}`; `useTableSelection` imported line 15; page test uses `fireEvent.click(el, {shiftKey:true})` |
| 3 | BulkActionBar with Approve/Reject chips fires correct endpoints via Promise.allSettled | VERIFIED | `ApprovalsPage.tsx:126-159` — `bulkApprove`/`bulkReject` use `Promise.allSettled`; `pendingChanges.ts:45-51` — `.approve(ws,id)` → `POST .../approve`, `.reject(ws,id,reason)` → `POST .../reject {reason}` |
| 4 | `useShortcuts("approvals", A→approve, R→reject)` registered; Defer omitted | PASSED (override) | `ApprovalsPage.tsx:179-197` — key "A" + key "R" wired; no "D" key. Defer omitted: 14-CONTEXT OQ1 resolves "no backend defer endpoint — ship A/R only". Override applied. |
| 5 | Owner/admin 403 renders calm guard with no table | VERIFIED | `ApprovalsPage.tsx:200-222` — `isForbidden` path returns early with `RetroEmptyState`; `useApprovalsList.ts` sets `isForbidden = error instanceof HttpError && status === 403` |
| 6 | `/my-changes` lists caller's mutations from `/my-pending-changes` | VERIFIED | `myChanges.ts:31` — `GET /workspaces/${ws}/my-pending-changes`; `MyChangesPage.tsx` feeds RetroTable with Entity/Action/Status/Requested columns; 7/7 tests pass |
| 7 | `/sync-history` is honest online-only informational page with no sync* import, no fabricated events | PASSED (override) | `system-history/Page.tsx:30-50` — issues no fetch, no `/sync/delta` call; renders `RetroEmptyState` with "ONLINE ONLY" copy; `lint:imports` OK (no `sync` in specifier). SC wording ("past sync events") pre-sanctioned as vestigial in 14-CONTEXT OQ2. Override applied. |
| 8 | `/imports` provides CSV upload via multipart POST `/imports/upload`, import-history from `/imports/jobs` (envelope `jobs`), workspace export via `settingsApi.exportWorkspace` | VERIFIED | `importJobs.ts:108-113` — `FormData` with `entity_type`+`file` → `postMultipart`; `importJobs.ts:82-92` — `listJobs` → `GET .../imports/jobs` envelope `jobs`; `ImportsPage.tsx:117` — `settingsApi.exportWorkspace(wsId,"xlsx")` reused; 13/13 tests pass |
| 9 | `/wishlist` has wanted/ordered/acquired status tabs + CRUD + status transition | VERIFIED | `WishlistPage.tsx:33,59-60` — `STATUSES = ["wanted","ordered","acquired"]`, `?status=` drives `useWishlist(status)`; `WishlistFormDialog.tsx:68,152,165` — status field in edit mode, 409 `ErrInvalidStatusTransition` → calm root error; `wishlistApi.ts` list/create/update/remove wired; 18/18 tests pass |
| 10 | `/declutter` has unused analysis, score badge (danger≥70/warn≥40/neutral), grouping, client CSV export, mark-used via `POST /inventory/{id}/mark-used` | VERIFIED | `DeclutterPage.tsx:37-40` — `scoreVariant` function; `DeclutterPage.tsx:117-118` — `markUsed.mutate(pendingUse.id)` (inventory id, NOT item_id); `declutter.ts:94-99` — POST `.../mark-used`; `declutterCsv.ts` mirrors loanCsv injection-safe pattern; 18/18 tests pass |
| 11 | Per-entity inventory CSV export button on InventoryListPage (client-side, no server endpoint) | VERIFIED | `InventoryListPage.tsx:26,188-193` — imports `inventoryCsv.ts`, `exportCsv` downloads object URL; comment line 186: "no /export/inventory endpoint exists"; 7/7 inventoryCsv tests + 15/15 InventoryListPage tests pass |
| 12 | All 6 routes mounted under RequireAuth/AppShell; Sidebar SYSTEM group wired + Settings wired to /settings | VERIFIED | `routes/index.tsx:211-216` — 6 route entries in auth branch; `Sidebar.tsx:153-159` — 7 NavItems (6 system pages + Settings→/settings); `lint:imports` OK; `bun run test` 1084/1084 pass |

**Score:** 12/12 (10 VERIFIED + 2 PASSED via override)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend2/src/features/approvals/ApprovalsPage.tsx` | VERIFIED | Named export `ApprovalsPage`; 364 LOC; real data |
| `frontend2/src/features/approvals/hooks/useApprovalsList.ts` | VERIFIED | Keyed `["pending-changes", wsId, "pending"]`; `isForbidden` guard |
| `frontend2/src/features/approvals/hooks/useApprovalMutations.ts` | VERIFIED | `approve`/`reject` mutations; no self-invalidate |
| `frontend2/src/lib/api/pendingChanges.ts` | VERIFIED | Extended with `approve` + `reject`; `list` envelope unchanged |
| `frontend2/src/features/my-changes/MyChangesPage.tsx` | VERIFIED | Named export `MyChangesPage`; activity-table |
| `frontend2/src/lib/api/myChanges.ts` | VERIFIED | `GET /my-pending-changes`; `{ changes, total }` envelope |
| `frontend2/src/features/system-history/Page.tsx` | VERIFIED | Named export `SyncHistoryPage`; sync-free import path; static honest state |
| `frontend2/src/features/imports/ImportsPage.tsx` | VERIFIED | Named export `ImportsPage`; multipart upload + jobs table + export reuse |
| `frontend2/src/lib/api/importJobs.ts` | VERIFIED | `uploadImport` multipart FormData; `listJobs` envelope `jobs`; PLURAL entity enum |
| `frontend2/src/features/wishlist/WishlistPage.tsx` | VERIFIED | Named export `WishlistPage`; `?status=` tabs; CRUD dialog |
| `frontend2/src/features/wishlist/components/WishlistFormDialog.tsx` | VERIFIED | Status field in edit mode; 409 calm guard |
| `frontend2/src/features/declutter/DeclutterPage.tsx` | VERIFIED | Score badge; grouping; CSV export; mark-used confirm |
| `frontend2/src/features/declutter/declutterCsv.ts` | VERIFIED | `escapeCell` injection-safe; mirrors loanCsv pattern |
| `frontend2/src/features/inventory/inventoryCsv.ts` | VERIFIED | Client-side CSV; 7 injection-guard tests pass |
| `frontend2/src/features/inventory/InventoryListPage.tsx` | VERIFIED (modified) | EXPORT CSV button added; no server endpoint used |
| `frontend2/src/routes/index.tsx` | VERIFIED (modified) | 6 routes in RequireAuth branch; sync-free import specifier |
| `frontend2/src/components/layout/Sidebar.tsx` | VERIFIED (modified) | 6 SYSTEM NavItems + Settings→/settings |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ApprovalsPage` | `GET /pending-changes` | `useApprovalsList → pendingChangesApi.list` | WIRED | `pendingChanges.ts:28-33` |
| `ApprovalsPage` BulkBar | `POST /pending-changes/{id}/approve` | `useApproveChange → pendingChangesApi.approve` | WIRED | `pendingChanges.ts:45-46` |
| `ApprovalsPage` BulkBar | `POST /pending-changes/{id}/reject` | `useRejectChange → pendingChangesApi.reject` | WIRED | `pendingChanges.ts:48-51` |
| `MyChangesPage` | `GET /my-pending-changes` | `useMyChanges → myChangesApi.list` | WIRED | `myChanges.ts:31` |
| `SyncHistoryPage` | (no network) | static | WIRED | No fetch; `lint:imports` confirms no sync* specifier |
| `ImportsPage` | `POST /imports/upload` | `useUploadImport → importJobsApi.uploadImport` | WIRED | `importJobs.ts:108-112` |
| `ImportsPage` | `GET /imports/jobs` | `useImportJobs → importJobsApi.listJobs` | WIRED | `importJobs.ts:82-92` |
| `ImportsPage` EXPORT | `GET /export/workspace` | `settingsApi.exportWorkspace(wsId,"xlsx")` | WIRED | `ImportsPage.tsx:117` |
| `WishlistPage` | `GET /wishlist?status=` | `useWishlist(status) → wishlistApi.list` | WIRED | `wishlist.ts:list` |
| `WishlistFormDialog` | `POST/PATCH/DELETE /wishlist*` | `useWishlistMutations → wishlistApi.create/update/remove` | WIRED | `useWishlistMutations.ts:29-51` |
| `DeclutterPage` | `GET /declutter` | `useDeclutter → declutterApi.list` | WIRED | `declutter.ts:list` |
| `DeclutterPage` mark-used | `POST /inventory/{id}/mark-used` | `useMarkUsed → declutterApi.markUsed` | WIRED | `declutter.ts:94-99` |
| `InventoryListPage` EXPORT CSV | object URL (client-side) | `inventoryToCsvBlob(visible)` | WIRED | `InventoryListPage.tsx:188-193` |
| `routes/index.tsx` | `ApprovalsPage` | `import @/features/approvals/ApprovalsPage` (eager) | WIRED | `routes/index.tsx:35,211` |
| `routes/index.tsx` | `SyncHistoryPage` | `import @/features/system-history/Page` (sync-free) | WIRED | `routes/index.tsx:40,213` |
| `Sidebar.tsx` | all 6 pages + settings | `NavItem to="/{route}"` | WIRED | `Sidebar.tsx:153-159` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ApprovalsPage` | `rows` | `useApprovalsList → GET /pending-changes` | Yes — live DB query | FLOWING |
| `MyChangesPage` | `rows` | `useMyChanges → GET /my-pending-changes` | Yes — live DB query | FLOWING |
| `SyncHistoryPage` | (none) | Static content | N/A — intentional | FLOWING |
| `ImportsPage` jobs table | `jobs` | `useImportJobs → GET /imports/jobs` | Yes — live DB query | FLOWING |
| `WishlistPage` | `rows` | `useWishlist(status) → GET /wishlist?status=` | Yes — live DB query | FLOWING |
| `DeclutterPage` | `rows` | `useDeclutter → GET /declutter` | Yes — live DB query | FLOWING |
| `InventoryListPage` CSV | `visible` | pre-fetched inventory rows (in-component state) | Yes — real rows from prior query | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 14 feature tests | `bun run test src/features/approvals src/features/my-changes src/features/system-history src/features/imports src/features/wishlist src/features/declutter` | 14 files, 56 tests passed | PASS |
| Phase 14 API unit tests | `bun run test src/lib/api/pendingChanges.test.ts src/lib/api/myChanges.test.ts src/lib/api/wishlist.test.ts src/lib/api/declutter.test.ts src/lib/api/importJobs.test.ts` | 5 files, 20 tests passed | PASS |
| Inventory CSV builder | `bun run test src/features/inventory/inventoryCsv.test.ts` | 1 file, 7 tests passed | PASS |
| Full suite regression | `bun run test` | 169 files, 1084 tests passed | PASS |
| FOUND-02 lint:imports guard | `bun run lint:imports` | OK — no sync/offline/idb/serwist specifiers | PASS |
| TypeScript build check | `bun run lint:tsc` | clean, exit 0 | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` declared for Phase 14. E2E spec `frontend2/e2e/system-group.spec.ts` exists and was reported green by the orchestrator (1/1 chromium) but cannot be run by the verifier without live backend + Postgres. Routes to human verification.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYS-01 | 14-01 + 14-08 | Approvals page with bulk A/R + Shift+Click | SATISFIED | `ApprovalsPage.tsx`; `useTableSelection`; `BulkActionBar`; `useShortcuts`; A/R endpoints wired |
| SYS-02 | 14-02 + 14-08 | My Changes page from /my-pending-changes | SATISFIED | `MyChangesPage.tsx`; `myChangesApi`; route `/my-changes` wired |
| SYS-03 | 14-06 + 14-08 | Sync History page | SATISFIED (override) | Honest empty state; no sync* import; pre-sanctioned deviation from "event log" SC |
| SYS-04 | 14-05 + 14-08 | Imports/Exports with async multipart upload + jobs table + workspace export | SATISFIED | `ImportsPage.tsx`; `importJobsApi`; `settingsApi.exportWorkspace` reused; route `/imports` wired |
| WISH-01 | 14-03 + 14-08 | Wishlist wanted/ordered/acquired tabs | SATISFIED | `WishlistPage.tsx`; `?status=` routing; RetroTabs; route `/wishlist` wired |
| WISH-02 | 14-03 + 14-08 | Wishlist CRUD + status transition | SATISFIED | `WishlistFormDialog.tsx`; create/update/remove mutations; 409 calm guard |
| DECL-01 | 14-04 + 14-08 | Declutter analysis + score badge + grouping | SATISFIED | `DeclutterPage.tsx`; `scoreVariant`; group-by select; route `/declutter` wired |
| DECL-02 | 14-04 + 14-08 | Declutter CSV export + mark-used | SATISFIED | `declutterCsv.ts`; `declutterApi.markUsed`; `POST /inventory/{id}/mark-used` |

---

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `ApprovalsPage.tsx:357` | `placeholder={t\`...\`}` | Info | Input placeholder attribute — not a stub; expected UX |
| `WishlistFormDialog.tsx:244` | `placeholder="EUR"` | Info | Input hint — not a stub |
| No `TBD`, `FIXME`, `XXX` debt markers found | — | — | Clean |
| No `return null` / empty arrays as stub implementations | — | — | Clean |

No blockers found.

---

### Human Verification Required

#### 1. Approvals Bulk Approve/Reject (live flow)

**Test:** Log in as workspace owner/admin; navigate to `/approvals`; if no pending rows, create a pending change via another browser session or seeded data; Shift+Click two rows; click "APPROVE" in BulkActionBar.
**Expected:** "Approved 2." success toast; rows disappear from the list; dashboard side-rail count decrements.
**Why human:** Requires real pending-change rows seeded in the DB; Shift+Click multi-select visual state.

#### 2. Approvals 403 calm-guard (role check)

**Test:** Log in as a member-role user (not owner/admin); navigate to `/approvals`.
**Expected:** "Only workspace owners and admins can review approvals." RetroEmptyState; no table rendered.
**Why human:** Requires a second test account with member role.

#### 3. Wishlist status transition (live flow)

**Test:** Navigate to `/wishlist`; add an item under WANTED tab; click edit; change status to ORDERED; save; switch to ORDERED tab.
**Expected:** Item moves from WANTED to ORDERED tab; status badge updates; attempting an invalid transition (e.g., ordered → wanted) shows "That status change isn't allowed." form error.
**Why human:** Requires visual tab rendering verification + live 409 path from server.

#### 4. Imports upload and history table (live flow)

**Test:** Navigate to `/imports`; select entity type "items"; upload a valid items CSV; observe the HISTORY table.
**Expected:** Upload triggers POST /imports/upload; new row appears in history table with status "pending" or "processing"; export button downloads a workspace blob.
**Why human:** Requires a real CSV file, running backend, and async worker.

#### 5. Declutter score badges and mark-used (live flow)

**Test:** Navigate to `/declutter` (requires inventory data with varying last-used dates); verify score badge colours; click "Mark used" on a row; confirm.
**Expected:** Items with score >= 70 show danger badge; >= 40 show warn; rest neutral. After confirm, row disappears from list.
**Why human:** Requires seeded inventory data with varying `last_used_at` values.

#### 6. Inventory CSV export (live download)

**Test:** Navigate to `/inventory` with at least one entry; click "EXPORT CSV" button.
**Expected:** Browser downloads `inventory.csv`; file has header row and at least one data row; `purchase_price` column contains raw cents integer.
**Why human:** File-download behaviour and CSV content not verifiable without a running browser session.

---

### Gaps Summary

No automated gaps. All 12 must-haves either VERIFIED (10) or PASSED via pre-sanctioned override (2).

The two overrides document intentional deviations from ROADMAP SC wording:
- **Defer (D) shortcut omitted** — no backend endpoint; 14-CONTEXT OQ1 pre-sanctioned A/R-only.
- **Sync History honest empty state** — no sync-event-history backend in v3.0; 14-CONTEXT OQ2 pre-sanctioned the informational page over fabricated events.

Both deviations were resolved before execution began and are fully documented in 14-CONTEXT.md and the respective plan SUMMARYs. The ROADMAP SC wording should be updated to reflect these resolutions.

6 human-verification items remain for visual/live-data confirmation. Automated coverage is high: 1084 unit tests green, lint:imports OK, tsc clean, system-group E2E spec verified by orchestrator.

---

_Verified: 2026-06-13T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
