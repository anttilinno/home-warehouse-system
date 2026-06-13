---
phase: 10b-repairs-maintenance
nyquist_compliant: false
wave_0_complete: false
---

# Phase 10b — Repairs + Maintenance — VALIDATION

Pre-execution contract. Flags flip true only after execution closes Wave-0 gaps. Orchestrator
verifies at the phase gate.

## Requirement → evidence map
| Req | Deliverable | Verifiable by |
|-----|-------------|---------------|
| RPR-01 | RepairsDrawer per inventory row: create/edit repairs + start/complete | RepairsDrawer test (CRUD + lifecycle PENDING→IN_PROGRESS→COMPLETED) |
| RPR-02 | cost rollup across repair history (per currency, cents→currency) | drawer header test (sums via /inventory/{id}/repair-cost, money.ts format) |
| RPR-03 | repair photos (real multipart upload, reuse photo atoms) | RepairPhotoPanel test (upload/list/delete via /repairs/{id}/photos) |
| RPR-04 | non-photo attachments (link + list + delete; byte-storage is backend stub) | RepairAttachmentPanel test (list + delete + add-link); byte upload/serve logged as residue |
| MNT-01 | MaintenanceDrawer per row: schedule CRUD | MaintenanceDrawer test (create/edit/delete) |
| MNT-02 | /maintenance/due list + complete (advances next_due) | MaintenanceDuePage test (due rows, complete calls endpoint, server is_overdue) |
| MNT-03 | due-maintenance feed hook for Phase-13 dashboard | useMaintenanceDue shipped + /maintenance/due page (Phase 13 mounts card) |

## Binding overrides (must hold in shipped code)
1. Repairs/maintenance = per-row RetroDialog drawers on InventoryListPage (single-writer); no detail page.
2. Costs in CENTS (int) → format via new `lib/utils/money.ts`; never floats; cost rollup grouped by currency_code (never cross-currency sum).
3. Overdue = server `is_overdue` flag on due-list rows (no client date math).
4. Repair status PENDING/IN_PROGRESS/COMPLETED from server; EDIT/START/COMPLETE hidden on COMPLETED.
5. Repair photos: real multipart `"photo"` upload; reuse/parametrize PhotoUpload/PhotoGallery + photo_type.
6. RPR-04 attachments LINK-ONLY against the real endpoint (list/delete/add-link); backend byte upload/serve is a pre-existing project-wide stub → LOG as residue, do NOT build file storage this phase.
7. complete-repair may set inventory condition; complete-maintenance writes a repair-log row → invalidate BOTH repairs + maintenance (+ inventory) caches.
8. limit≤100; per-endpoint envelope; query-key prefixes `["repairs"|"maintenance", wsId, ...]` (+ by-inventory sub-keys); render-loop guard.
9. routes/index.tsx + Sidebar.tsx single-writer (the `/maintenance/due` route + nav); one plan owns them.

## Phase gate (orchestrator)
- tsc clean, full `bun run test` green, build, lint:imports OK.
- Live Playwright repairs-maintenance spec (repair create→start→complete→cost; schedule create→due→complete) isolated (auth limiter).
- gsd-verifier PASS; flip RPR-01..04 + MNT-01..03 + traceability; log residues (incl. the attachment byte-storage backend stub).

## Nyquist sign-off (flip after execution)
- [ ] api modules (repairs/maintenance/repairPhotos/repairAttachments) + money.ts + MSW shipped.
- [ ] All drawer/page tests green.
- [ ] E2E spec discovered + green.
