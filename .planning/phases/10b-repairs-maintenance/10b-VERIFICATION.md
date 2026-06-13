---
phase: 10b-repairs-maintenance
verified: 2026-06-13T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 10b: Repairs + Maintenance Verification Report

**Phase Goal:** Deliver RPR-01..04 (repair log drawer + cost rollup + photos + link-only attachments) and MNT-01..03 (maintenance schedule CRUD drawer + due page + Phase-13 feed hook) as per-inventory-row drawers on InventoryListPage.
**Verified:** 2026-06-13
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RPR-01: User can create/edit repairs, start them, and complete them via a drawer on each inventory row | VERIFIED | `RepairsDrawer.tsx` + `RepairForm.tsx` + `CompleteRepairDialog.tsx` + `useRepairMutations.ts`; all five mutations (create/update/start/complete/delete) wired to `repairsApi`; PENDING shows START+EDIT, IN_PROGRESS shows COMPLETE+EDIT, COMPLETED shows DELETE only |
| 2 | RPR-02: Cost rollup per currency (cents→display), never cross-currency summed | VERIFIED | `useRepairCostQuery` returns `{ items: RepairCostSummary[] }` one per currency; `RepairsDrawer` maps each with `formatCents(s.total_cost_cents, s.currency_code)`; no reduce/sum across currencies; `formatCents` coalesces `currency \|\| "EUR"` for null case |
| 3 | RPR-03: Repair photos via real multipart upload, reusing PhotoUpload/PhotoGallery atoms | VERIFIED | `RepairPhotoPanel.tsx` passes `mutations={{ upload, updateCaption, del }}` and `checkDuplicate={null}` to `PhotoUpload`; `useRepairPhotoMutations` sends real `FormData` with `photo` + required `photo_type` via `postMultipart`; item callsite in `ItemDetailPage` uses default props (no regression) |
| 4 | RPR-04: Non-photo attachments link-only; useRepairAttachments list/create/del | VERIFIED | `RepairAttachmentPanel.tsx` + `AddAttachmentDialog.tsx` + `useRepairAttachments.ts`; create mints a `file_id` via metadata-only POST then links it; no byte-storage path; list/create/del all wired |
| 5 | MNT-01: Maintenance schedule CRUD via drawer; per-inventory-row trigger | VERIFIED | `MaintenanceDrawer.tsx` + `MaintenanceForm.tsx` + `useMaintenanceMutations.ts`; both drawers imported and mounted in `InventoryListPage.tsx:30-31,552-574`; 🔧 and ⟳ per-row buttons at lines 500-515 |
| 6 | MNT-02: /maintenance/due page listing server-is_overdue schedules; COMPLETE advances next_due | VERIFIED | `MaintenanceDuePage.tsx` consumes `useMaintenanceDueQuery()`; overdue driven by `row.is_overdue` flag (no client date math); `CompleteMaintenanceDialog` calls `completeSchedule.mutate(id)` and shows server-returned `updated.next_due` in toast; route wired at `routes/index.tsx:76`; Sidebar NavItem at `Sidebar.tsx:141` |
| 7 | MNT-03: useMaintenanceDueQuery exported for Phase 13 dashboard side-rail | VERIFIED | `export function useMaintenanceDueQuery(days?: number)` at `useMaintenanceQuery.ts:56`; accepts optional `days` horizon param; returns `{ items: DueSchedule[], isLoading, isError }`; query key `["maintenance", wsId, "due", days]` compatible with Phase-13 invalidation |

**Score:** 7/7 truths verified

---

### Binding Override Verification

| # | Override | Status | Evidence |
|---|----------|--------|----------|
| 1 | Both drawer triggers on InventoryListPage (repairs + maintenance) | VERIFIED | `InventoryListPage.tsx:500-515` — 🔧 button `setRepairsId(entry.id)`, ⟳ button `setMaintenanceId(entry.id)` |
| 2 | `currency \|\| "EUR"` coalesces null/undefined currency | VERIFIED | `money.ts:19` — `const code = currency \|\| "EUR";` |
| 3 | is_overdue = server flag, zero client date math | VERIFIED | `MaintenanceDuePage.tsx:24` explicit comment; `useMaintenanceQuery.ts:11` comment; `DueSchedule` type has `is_overdue: boolean` at `types.ts:406` |
| 4 | EDIT/START/COMPLETE hidden on COMPLETED status | VERIFIED | `RepairsDrawer.tsx:254,262,270` — START only when `isPending`, COMPLETE only when `isInProgress`, EDIT only when `!isCompleted` |
| 5 | Date fields serialized to RFC3339 before POST/PATCH | VERIFIED | `RepairForm.tsx:48-51` `toRfc3339Date()` applied to `repair_date` (L93,104) and `reminder_date` (L109); `MaintenanceForm.tsx:45-47` `toRfc3339Date()` applied to `next_due` (L89,98) |
| 6 | RPR-04 link-only; useRepairAttachments list/create/del | VERIFIED | `repairAttachmentsApi` has no multipart path; `AddAttachmentDialog.tsx:19` documents "stores NO BYTES"; create sends JSON `{file_id, attachment_type, title?}` |
| 7 | complete-maintenance invalidates BOTH maintenance + repairs caches | VERIFIED | `useMaintenanceMutations.ts:125-130` — `onSettled` calls `invalidate()` (maintenance prefix) AND `queryClient.invalidateQueries({ queryKey: ["repairs", wsId] })` |
| 8 | PhotoUpload/PhotoGallery parametrization did NOT break item callsites | VERIFIED | `ItemDetailPage.tsx:313-318` uses `PhotoUpload` with no extra props (all defaults: `canSetPrimary=true, canReorder=true, canBulk=true, canDownloadZip=true`); `PhotoGallery` at `ItemDetailPage.tsx:196-201` also uses defaults |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `features/repairs/components/RepairsDrawer.tsx` | Repair log drawer, per-inv trigger | VERIFIED | 361 lines; substantive — list/create/edit/start/complete/delete; cost rollup header |
| `features/repairs/components/RepairForm.tsx` | Create/edit repair | VERIFIED | 237 lines; RHF+zod; RFC3339 date serialization; cost→cents transform |
| `features/repairs/components/CompleteRepairDialog.tsx` | Complete + optional condition update | VERIFIED | 89 lines; triggers `completeRepair.mutate`; invalidates inventory when condition set |
| `features/repairs/components/RepairPhotoPanel.tsx` | Photo panel reusing atoms | VERIFIED | 123 lines; `PhotoUpload` + `PhotoGallery` with seam props |
| `features/repairs/components/RepairAttachmentPanel.tsx` | Files panel (link-only) | VERIFIED | 152 lines; list/add/delete; no byte-storage path |
| `features/repairs/components/AddAttachmentDialog.tsx` | Add file dialog (link-only) | VERIFIED | 213 lines; two-step mint+link; byte-storage residue documented |
| `features/repairs/components/RepairRecordDialog.tsx` | RECORD/PHOTOS/FILES sub-view | VERIFIED | Tabbed dialog mounting RepairPhotoPanel + RepairAttachmentPanel |
| `features/repairs/hooks/useRepairMutations.ts` | CRUD + lifecycle mutations | VERIFIED | All 5 mutations; optimistic patch; restore on error |
| `features/repairs/hooks/useRepairPhotoMutations.ts` | Photo upload/caption/del | VERIFIED | Real multipart; photo_type required; invalidates per-repair key |
| `features/repairs/hooks/useRepairAttachments.ts` | Attachment list/create/del | VERIFIED | query + 2 mutations; link-only |
| `features/repairs/hooks/useRepairsQuery.ts` | List + cost rollup queries | VERIFIED | Two queries under `["repairs", wsId]` prefix |
| `lib/utils/money.ts` | formatCents with null currency coalesce | VERIFIED | `currency \|\| "EUR"` at line 19 |
| `lib/api/repairs.ts` | repairsApi (all endpoints) | VERIFIED | byInventory, cost, get, create, update, start, complete, del |
| `lib/api/repairPhotos.ts` | repairPhotosApi | VERIFIED | Real multipart; list, upload, updateCaption, del |
| `lib/api/repairAttachments.ts` | repairAttachmentsApi | VERIFIED | list, create (JSON link), del |
| `features/maintenance/components/MaintenanceDrawer.tsx` | Schedule drawer | VERIFIED | 212 lines; create/edit/complete/delete; no client overdue math |
| `features/maintenance/components/MaintenanceForm.tsx` | Create/edit schedule | VERIFIED | RFC3339 serialization on next_due; dirty-close guard |
| `features/maintenance/components/CompleteMaintenanceDialog.tsx` | Complete confirm | VERIFIED | Server-returned next_due shown in toast; dual cache invalidation |
| `features/maintenance/MaintenanceDuePage.tsx` | /maintenance/due page | VERIFIED | `is_overdue` server flag drives danger row tint + pill + chip; route registered |
| `features/maintenance/hooks/useMaintenanceMutations.ts` | CRUD + complete mutations | VERIFIED | All 4 mutations; dual invalidation (maintenance + repairs) on complete |
| `features/maintenance/hooks/useMaintenanceQuery.ts` | List + due queries incl. Phase-13 hook | VERIFIED | `useMaintenanceDueQuery` exported; `useSchedulesByInventoryQuery`; `useMaintenanceListQuery` |
| `lib/api/maintenance.ts` | maintenanceApi | VERIFIED | list, byInventory, due, get, create, update, complete, del |
| `e2e/repairs-maintenance.spec.ts` | Live Playwright gate | VERIFIED | Real-browser spec; FLOW A (RPR-01/02 create→start→complete) + FLOW B (MNT-01/02 create→due-list→complete→row-leaves); 2/2 pass reported (chromium+firefox) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `InventoryListPage` | `RepairsDrawer` | import + JSX mount + 🔧 row button | WIRED | Lines 30, 500-503, 552-562 |
| `InventoryListPage` | `MaintenanceDrawer` | import + JSX mount + ⟳ row button | WIRED | Lines 31, 508-514, 564-574 |
| `RepairsDrawer` | `useRepairMutations` | import + destructure | WIRED | Lines 20, 78 |
| `RepairsDrawer` | `useRepairsByInventoryQuery` + `useRepairCostQuery` | import + call | WIRED | Lines 18-19, 76-77 |
| `RepairsDrawer` | `RepairForm` + `CompleteRepairDialog` + `RepairRecordDialog` | nested dialogs | WIRED | Lines 309-330 |
| `RepairForm` | `useRepairMutations.createRepair` / `updateRepair` | mutateAsync | WIRED | Lines 99, 101 |
| `RepairPhotoPanel` | `PhotoUpload` + `PhotoGallery` (atoms) | import + mutations seam | WIRED | Lines 6-9, 77-121 |
| `useRepairPhotoMutations` | `repairPhotosApi.upload` (real multipart) | FormData POST | WIRED | Lines 52-64 |
| `useRepairAttachments` | `repairAttachmentsApi.list/.create/.del` | query + mutations | WIRED | Lines 27-44 |
| `MaintenanceForm` | `useMaintenanceMutations.createSchedule` / `updateSchedule` | mutateAsync | WIRED | Lines 91, 94 |
| `useMaintenanceMutations.completeSchedule` | repairs cache invalidation | `queryClient.invalidateQueries(["repairs", wsId])` | WIRED | Lines 127-130 |
| `MaintenanceDuePage` | `useMaintenanceDueQuery` | import + call | WIRED | Lines 12, 33 |
| `routes/index.tsx` | `MaintenanceDuePage` at `/maintenance/due` | `<Route>` | WIRED | Line 76 |
| `Sidebar.tsx` | `/maintenance/due` NavItem | `to="/maintenance/due"` | WIRED | Line 141 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RepairsDrawer` | `summaries` (cost rollup) | `repairsApi.cost()` → `GET /inventory/{invId}/repair-cost` | Yes — server groups by currency_code | FLOWING |
| `RepairsDrawer` | `items` (repair list) | `repairsApi.byInventory()` → `GET /inventory/{invId}/repairs` | Yes — paginated list | FLOWING |
| `MaintenanceDuePage` | `items` (due schedules) | `maintenanceApi.due()` → `GET /maintenance/due` | Yes — server computes is_overdue | FLOWING |
| `MaintenanceDrawer` | `items` (schedules) | `maintenanceApi.byInventory()` → `GET /inventory/{invId}/maintenance` | Yes | FLOWING |

---

### Behavioral Spot-Checks

The live Playwright spec `repairs-maintenance.spec.ts` covers the key behaviors. Per the user-confirmed gate result (2/2 pass chromium+firefox after D-10b-05-01 and D-10b-05-02 fixes), these are recorded as PASS without re-running the live stack.

| Behavior | Verified by | Status |
|----------|-------------|--------|
| Repair drawer opens from 🔧 row button | E2E spec line 178 | PASS (reported) |
| Cost rollup renders with formatCents (D-10b-05-01 fix) | E2E spec lines 185-196 | PASS (reported) |
| Create → START flips PENDING → IN_PROGRESS | E2E spec lines 209-227 | PASS (reported) |
| COMPLETE with null currency does not crash drawer (D-10b-05-01) | E2E spec lines 233-245 | PASS (reported) |
| Maintenance schedule create via drawer (D-10b-05-02 RFC3339 fix) | E2E spec lines 262-282 | PASS (reported) |
| /maintenance/due shows server is_overdue schedule | E2E spec lines 291-311 | PASS (reported) |
| COMPLETE advances next_due; row leaves due list | E2E spec lines 296-311 | PASS (reported) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RPR-01 | 10b-02 | Repair create/edit/start/complete drawer | SATISFIED | All five mutations; status-gated actions; RepairForm + CompleteRepairDialog |
| RPR-02 | 10b-02 | Cost rollup per currency, cents→display | SATISFIED | `formatCents` with null-coalesce; one `<li>` per RepairCostSummary; no cross-currency sum |
| RPR-03 | 10b-03 | Repair photos via reused atoms, real multipart | SATISFIED | RepairPhotoPanel; useRepairPhotoMutations; FormData with photo_type |
| RPR-04 | 10b-03 | Non-photo attachments link-only | SATISFIED | RepairAttachmentPanel; AddAttachmentDialog; no byte-storage path; residue logged |
| MNT-01 | 10b-04 | Maintenance CRUD drawer | SATISFIED | MaintenanceDrawer; MaintenanceForm; useMaintenanceMutations |
| MNT-02 | 10b-04 | /maintenance/due + COMPLETE advances next_due | SATISFIED | MaintenanceDuePage; completeSchedule endpoint; server is_overdue flag |
| MNT-03 | 10b-04 | Due-feed hook for Phase 13 | SATISFIED | `export function useMaintenanceDueQuery(days?)` in useMaintenanceQuery.ts:56 |

---

### Anti-Patterns Found

No blockers. No TBD/FIXME/XXX markers found in any phase-modified file.

One known, intentional stub:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `AddAttachmentDialog.tsx:17-20, 80` | Byte-storage backend is a metadata-only stub — the `POST /items/{itemId}/attachments/upload` endpoint records a File row but stores no bytes | INFO (intentional, documented residue) | RPR-04 "link-only" works as designed; a true serve-back flow requires new backend work — deferred to Phase 14b |

---

### Human Verification Required

None. All observable behaviors were verified via static code analysis (artifact existence, substantive content, wiring, data flow) and the user-confirmed live Playwright spec results (2/2 pass after D-10b-05-01 + D-10b-05-02 fixes).

---

### Residues (logged for Phase 14b + audit)

1. **RPR-04 byte-storage backend stub** — The `POST /items/{itemId}/attachments/upload` endpoint is metadata-only: it records a `File` DB row and returns its `file_id` but stores zero bytes. There is no server-side byte-ingest endpoint for non-photo attachments. A user who "attaches" a PDF via `AddAttachmentDialog` cannot later retrieve or view the file bytes — only the metadata link (title, type, mime_type) is preserved. This is a **pre-existing project-wide backend limitation**, explicitly scoped out of Phase 10b (OQ3/F1 in `10b-CONTEXT.md`). Frontend code is correct and link-only by design. **Deferred to Phase 14b** which is also responsible for the cross-tenant attachment IDOR audit finding (`docs/audit/`). The Phase 10b frontend correctly does not build a byte-storage path.

---

### Gaps Summary

No gaps. All 7 must-have truths are verified. All 8 binding overrides hold. No unresolved debt markers. The known RPR-04 byte-storage residue is intentional and deferred to Phase 14b.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
