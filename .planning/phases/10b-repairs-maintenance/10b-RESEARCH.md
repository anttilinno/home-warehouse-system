# Phase 10b: Repairs + Maintenance — Research

**Researched:** 2026-06-13
**Domain:** React 19 + TS frontend2 parity — per-inventory repair log (CRUD + lifecycle + cost + photos + attachments) and recurring maintenance schedules (CRUD + due list + complete-advances-next-due)
**Confidence:** HIGH (every claim verified against shipped frontend2 code or backend Go handler/service source in this session)

## Summary

Phase 10b mirrors the **per-row-drawer** pattern already shipped for inventory movements (`MovementsDrawer`) and the **loan lifecycle** write surface (`loansApi` + `useLoanMutations` + `loanStatus`). The backend surface is fully wired (`router.go:516-517` registers `repairlog` + `maintenance`; repair photos/attachments register inside the same workspace subtree). The work is almost entirely frontend: four api modules, their hooks (mirroring `useLoanMutations` optimistic-prefix-invalidate discipline), two per-row drawers added to `InventoryListPage`, a repair-photos sub-panel, an attachment sub-panel, a `/maintenance` list + `/maintenance/due` page, a sidebar entry, MSW handlers, and an E2E spec.

Two findings change the plan shape materially:
1. **Repair status is a 3-state server lifecycle** (`PENDING → IN_PROGRESS → COMPLETED`, verified `entity.go:17-21`) with strict transitions — `start` only from PENDING, `complete` only from IN_PROGRESS. The status pill must be server-flag-driven exactly like `loanStatus` (no client derivation beyond reading `status`).
2. **There is NO standalone file-upload endpoint that returns a bare `file_id`** (verified by exhaustive grep). The only file-creating path is `POST /items/{item_id}/attachments/upload`, which is **JSON-metadata-only** (it creates a placeholder storage key — `attachment/handler.go:81-87` — and does NOT ingest file bytes). This is a hard constraint on RPR-04: a true "upload a PDF receipt" flow has no byte-ingesting backend. See OQ3 for the resolution (descope to file_id-linking, or reuse the metadata-only path and surface the limitation).

**Primary recommendation:** Build four api modules in `lib/api/` (`repairs.ts`, `maintenance.ts`, `repairPhotos.ts`, `repairAttachments.ts`) mirroring `lib/api/loans.ts` exactly (BARE `{ items }` envelopes, never model huma's `$schema`). Build hooks mirroring `useLoanMutations` (prefix `["repairs", wsId]` / `["maintenance", wsId]`, optimistic patch + restore + onSettled invalidate). Add per-row `RepairsDrawer` + `MaintenanceDrawer` triggers to `InventoryListPage` as a single-writer edit. **Do NOT reuse the `PhotoUpload`/`PhotoGallery` atoms** — they are hardwired to `photosApi`/`usePhotoMutations` with an items-only contract that omits the repair-photo `photo_type` field; fork thin repair-scoped components instead (OQ2).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Repair CRUD + lifecycle (start/complete) | API / Backend | Frontend (drawer UI) | All state + transitions enforced server-side (`repairlog/service.go`); UI calls + invalidates |
| Repair cost rollup | API / Backend | Frontend (display) | Backend aggregates per currency (`GetTotalRepairCost`); UI only formats cents |
| Repair status pill | Frontend (display) | API (authoritative `status`) | Pure read of server `status` string — mirror `loanStatus` server-flag discipline |
| Repair photos | API / Backend (multipart ingest + storage) | Frontend (upload/gallery) | Backend owns thumbnail gen + storage (`repairphoto`); UI is a multipart form + thumbnail grid |
| Repair attachments | API / Backend (file_id linking) | Frontend (link/list/delete) | Backend links an existing `file_id`; **no byte-ingest endpoint exists** (OQ3) |
| Maintenance CRUD | API / Backend | Frontend (drawer UI) | Standard CRUD; validation server-side |
| Maintenance complete → next_due advance | API / Backend (transactional) | Frontend (call + invalidate) | `Schedule.Complete` advances next_due + writes a repair_logs row in one tx (`maintenance/service.go:187-211`) — UI never computes dates |
| Maintenance overdue flag | API / Backend (`is_overdue`) | Frontend (display) | Server computes `IsOverdue(now)` (`maintenance/handler.go:60`); NEVER client date math |
| Maintenance due feed (MNT-03) | API / Backend (`/maintenance/due`) | Frontend (hook only this phase) | Phase 13 mounts the dashboard card; 10b only ships the hook + page (OQ7) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI | Project baseline (frontend2) |
| @tanstack/react-query | v5 | Server state, optimistic mutations | Every shipped feature uses it; mutation discipline established in `useLoanMutations` |
| react-hook-form + zod | shipped | Form state + validation | All forms (InventoryFormPage, taxonomy dialogs) use RHF+zod |
| @lingui/react/macro | shipped | i18n (`<Trans>`, `useLingui`) | Every component wraps strings |
| msw | shipped | Test HTTP mocking | `test/msw/loanHandlers.ts` is the template |

No new dependencies. This is a parity phase — mirror shipped patterns, do not introduce libraries.

### Supporting (existing project atoms to reuse)
| Component | Path | Use |
|-----------|------|-----|
| `RetroDialog` | `@/components/retro` | Drawer shell (the `MovementsDrawer` titlebar pattern: `titlebarVariant="blue"`) |
| `RetroTable` / `RetroBadge` / `RetroEmptyState` / `RetroPagination` | `@/components/retro` | List/table chrome |
| `RetroConfirmDialog` | `@/components/retro` | Delete confirmations |
| `RetroFileInput` | `@/components/retro` | File picker (used by `PhotoUpload`) |
| `retroToast` | `@/components/retro` | Error toasts on mutation failure |
| `BevelButton` | `@/components/retro` | Row action buttons + drawer triggers |

**Installation:** none.

## Package Legitimacy Audit

> No external packages are installed in this phase. All dependencies are already in `frontend2/package.json` from prior phases. Section intentionally minimal — nothing to audit.

## Open Questions (RESOLVED)

### OQ1 — Drawer mount: per-row drawers on InventoryListPage. RESOLVED.

**Resolution:** Repair-log AND maintenance UIs are **per-row `RetroDialog` drawers** mirroring `MovementsDrawer`, NOT a new inventory detail page. There is no inventory detail page in frontend2 — the inventory row click navigates to `/items/:item_id` (`InventoryListPage.tsx:398`), and per-entry concerns (movements) already live in drawers triggered from the actions column.

**Evidence (frontend):**
- `InventoryListPage.tsx:109` — `const [movementsId, setMovementsId] = useState<string | null>(null);` (drawer-open state pattern)
- `InventoryListPage.tsx:487-492` — the `↧` BevelButton in the actions `<td>` sets `movementsId`
- `InventoryListPage.tsx:517-527` — `<MovementsDrawer invId={movementsId} … onClose={() => setMovementsId(null)} />` mounted once at page root, driven by id state
- `MovementsDrawer.tsx:33-46` — `RetroDialog open={invId !== null} titlebarVariant="blue"` wrapping a panel fed by `useMovementsQuery(invId)`

**The InventoryListPage edit (SINGLE WRITER — serialize):**
Add two state hooks alongside `movementsId` (~line 109):
```tsx
const [repairsId, setRepairsId] = useState<string | null>(null);
const [maintenanceId, setMaintenanceId] = useState<string | null>(null);
```
Add two BevelButtons in the actions cluster (~line 487, next to the `↧` movements button), only for non-archived rows:
```tsx
<BevelButton aria-label={t`Repairs`} onClick={() => setRepairsId(entry.id)}>
  <Trans>⚒</Trans>
</BevelButton>
<BevelButton aria-label={t`Maintenance`} onClick={() => setMaintenanceId(entry.id)}>
  <Trans>⟳</Trans>
</BevelButton>
```
Mount two drawers at page root (~line 527, after `MovementsDrawer`):
```tsx
<RepairsDrawer
  invId={repairsId}
  itemName={repairsId ? itemName(entries.find((e) => e.id === repairsId)?.item_id ?? "") : undefined}
  onClose={() => setRepairsId(null)}
/>
<MaintenanceDrawer
  invId={maintenanceId}
  itemName={maintenanceId ? itemName(entries.find((e) => e.id === maintenanceId)?.item_id ?? "") : undefined}
  onClose={() => setMaintenanceId(null)}
/>
```
This is the ONLY `InventoryListPage.tsx` edit; declare it as a single-writer file owned by ONE plan (see Plan Split — the plan that ships both drawers owns this edit, to avoid two plans racing the same file).

**Where do repair photos/attachments live?** NESTED inside the `RepairsDrawer`, per repair record. The repair drawer lists repair records for the inventory entry (`GET /inventory/{id}/repairs`). Each record expands to (or opens a sub-section for) its photos (`/repairs/{id}/photos/list`) and attachments (`/repairs/{id}/attachments`). Photos/attachments are repair-scoped on the backend (`repair_log_id` in every route), so they cannot live at the inventory level — they belong inside a selected repair record. Recommended shape: the drawer shows a repair list; selecting a repair reveals its detail (cost, status, photos grid, attachments list) inline below or in a second pane.

---

### OQ2 — Repair photos: multipart `photo` + REQUIRED `photo_type`. Atoms NOT reusable; fork thin. RESOLVED.

**Upload mechanism (backend):** raw multipart, NOT file_id.
- `repairphoto/handler.go:187` — `r.Post("/repairs/{repair_log_id}/photos", handler.HandleUpload)` (chi raw route, registered via `RegisterUploadHandler`)
- `repairphoto/handler.go:239` — form field is **`photo`** (`r.FormFile("photo")`)
- `repairphoto/handler.go:247-256` — form field **`photo_type` is REQUIRED**, must be `BEFORE` / `DURING` / `AFTER` (400 otherwise)
- `repairphoto/handler.go:258-262` — optional form field `caption`
- `repairphoto/handler.go:34` — list route is `GET /repairs/{repair_log_id}/photos/list` (note the `/list` suffix)
- `repairphoto/handler.go:81` — caption update is `PUT /repairs/{repair_log_id}/photos/{id}/caption`
- `repairphoto/handler.go:132` — delete is `DELETE /repairs/{repair_log_id}/photos/{id}`
- `repairphoto/handler.go:196-197` — serve URLs: `/repairs/{repair_log_id}/photos/{photo_id}/file` and `/thumbnail`; the response also carries absolute `url` + `thumbnail_url` (`handler.go:400-401`)

**Compare the items photo contract (`lib/api/photos.ts`):**
- field is also `photo` + optional `caption` — BUT **no `photo_type`** (items photos have no BEFORE/DURING/AFTER concept)
- items photos add: duplicate-check, set-primary, reorder, bulk-delete, bulk-caption, zip-download (`photos.ts:55-130`) — NONE exist for repair photos
- `PhotoUpload.tsx:10,50` and `PhotoGallery.tsx:11,38` import `photosApi` and `usePhotoMutations(wsId, itemId)` directly — **hardwired**, no endpoint injection seam

**Resolution: FORK thin, do not reuse.** The atoms are hardwired to the items contract and would need invasive surgery (inject endpoint + add `photo_type` + strip 5 unused operations) — a fork is cleaner and disjoint. Build:
- `lib/api/repairPhotos.ts` — minimal: `list`, `upload(photo, photoType, caption?)`, `updateCaption`, `del`. Rewrite absolute `url`/`thumbnail_url` to `/api`-relative via `toProxyUrl` at the mapper boundary (mirror `photos.ts:14-21` `mapPhoto`).
- `features/repairs/components/RepairPhotoPanel.tsx` — a thin upload zone (RetroFileInput + a BEFORE/DURING/AFTER select) + a thumbnail grid with per-photo caption-edit + delete-confirm. Borrow markup ideas from `PhotoUpload.tsx`/`PhotoGallery.tsx` but with the repair contract.

```ts
// lib/api/repairPhotos.ts — mirrors photos.ts mapper + loans.ts envelope discipline
import { get, del, put, postMultipart } from "@/lib/api";
import { toProxyUrl } from "./url";
import type { RepairPhoto } from "@/lib/types";

const map = (p: RepairPhoto): RepairPhoto => ({
  ...p, url: toProxyUrl(p.url), thumbnail_url: toProxyUrl(p.thumbnail_url),
});

export type RepairPhotoType = "BEFORE" | "DURING" | "AFTER";

export const repairPhotosApi = {
  list: (ws: string, repairId: string) =>
    get<{ items: RepairPhoto[] }>(`/workspaces/${ws}/repairs/${repairId}/photos/list`)
      .then((r) => r.items.map(map)),
  upload: (ws: string, repairId: string, file: File, photoType: RepairPhotoType, caption?: string) => {
    const form = new FormData();
    form.append("photo", file);
    form.append("photo_type", photoType); // REQUIRED (handler.go:247)
    if (caption) form.append("caption", caption);
    return postMultipart<RepairPhoto>(`/workspaces/${ws}/repairs/${repairId}/photos`, form).then(map);
  },
  updateCaption: (ws: string, repairId: string, id: string, caption: string | null) =>
    put<RepairPhoto>(`/workspaces/${ws}/repairs/${repairId}/photos/${id}/caption`, { caption }).then(map),
  del: (ws: string, repairId: string, id: string) =>
    del<void>(`/workspaces/${ws}/repairs/${repairId}/photos/${id}`),
};
```

`postMultipart` exists at `lib/api.ts:154`; `toProxyUrl` at `lib/api/url.ts`.

---

### OQ3 — Attachments: NO byte-ingesting file endpoint exists. RESOLVED (with a constraint that needs a decision).

**The repair-attachment link contract (backend):**
- `repairattachment/handler.go:20` — `GET /repairs/{repairLogId}/attachments` (BARE `{ items, total }`)
- `repairattachment/handler.go:45` — `POST /repairs/{repairLogId}/attachments` with body `{ file_id (uuid, REQUIRED), attachment_type (PHOTO|MANUAL|RECEIPT|WARRANTY|OTHER), title? }`
- `repairattachment/handler.go:54` — invalid `attachment_type` → 400; `handler.go:59` — unknown `file_id` → 404; `handler.go:62` — cross-workspace file → 400
- `repairattachment/handler.go:95` — `DELETE /repairs/{repairLogId}/attachments/{attachmentId}`
- `repairattachment/service.go` Create — verifies the `file_id` exists in the workspace (`GetFileByID`) before linking

**The file-upload gap (verified exhaustively):** A `file_id` must exist BEFORE the attachment POST. Searching the entire backend for a file-byte-ingest endpoint returns NOTHING. The only file-creating route is:
- `attachment/handler.go:64` — `POST /items/{item_id}/attachments/upload`, but its body (`handler.go:308-319`) is **JSON metadata only** (`file_name`, `mime_type`, `size_bytes`, `checksum`, …) — it does NOT accept multipart bytes. It synthesizes a placeholder storage key (`handler.go:81-87`: `"uploads/{ws}/{item}/{uuid}"`) and `UploadFile` (`attachment/service.go`) merely saves a File DB row — **no bytes are stored anywhere.** It returns an `AttachmentResponse` whose `file_id` field (`handler.go:348`) carries the created file id.

**Implication:** There is no working end-to-end "upload a real PDF and link it to a repair" flow in the current backend. Two honest options for RPR-04:

- **Option A (recommended for parity — minimal, honest):** RPR-04 is a **file_id-linking** component, not a byte-uploader. UI: a small form that POSTs `{ file_id, attachment_type, title }` to `/repairs/{id}/attachments`, lists existing attachments (showing `file_name`, `attachment_type`, `title` from the WithFile response — `repairattachment/handler.go:144-158`), and deletes them. Where does the `file_id` come from? In parity scope, attachments are linked from files that already exist (e.g., created via the item attachment metadata path, or seeded). The list response carries `file_name`/`file_mime_type`/`file_size_bytes` so the UI can display them. This ships the full link/list/delete CRUD against the real endpoints with zero backend change.
- **Option B (out of scope — flag to user):** A true byte-upload requires a NEW backend multipart files endpoint that stores bytes and returns a `file_id`. That is backend work outside a frontend parity phase — DEFER and note in the plan that RPR-04's "upload" is link-only until that endpoint lands.

**Decision needed from planner/user:** confirm Option A (link-only RPR-04). `[ASSUMED]` that parity expects link-only since no byte endpoint exists. Logged as A1.

```ts
// lib/api/repairAttachments.ts
import { get, post, del } from "@/lib/api";
import type { RepairAttachment } from "@/lib/types";

export type AttachmentType = "PHOTO" | "MANUAL" | "RECEIPT" | "WARRANTY" | "OTHER";

export const repairAttachmentsApi = {
  list: (ws: string, repairId: string) =>
    get<{ items: RepairAttachment[]; total: number }>(
      `/workspaces/${ws}/repairs/${repairId}/attachments`,
    ),
  create: (ws: string, repairId: string, body: { file_id: string; attachment_type: AttachmentType; title?: string }) =>
    post<RepairAttachment>(`/workspaces/${ws}/repairs/${repairId}/attachments`, body),
  del: (ws: string, repairId: string, attachmentId: string) =>
    del<void>(`/workspaces/${ws}/repairs/${repairId}/attachments/${attachmentId}`),
};
```

---

### OQ4 — Maintenance complete: advances next_due + writes a repair-log row, transactionally. RESOLVED.

**Resolution:** `POST /maintenance/{id}/complete` with body `{ notes? }` does THREE things in ONE transaction (`maintenance/service.go:187-211`):
1. Creates a **COMPLETED `repair_logs` row** titled `"Maintenance: {title}"` with the supplied `notes` (`service.go:199-202`, via `repo.CreateCompletionRepairLog`, declared `repository.go:39`). So maintenance history feeds the same repair-log/total-cost-of-ownership view.
2. Sets `last_completed_at = now` (`entity.go` `Schedule.Complete:172`).
3. Advances `next_due = max(today, next_due + interval_days)` — overdue catch-up semantics (`entity.go:171-180`: `next := s.nextDue.AddDate(0, 0, s.intervalDays); if next.Before(startOfDay(now)) { next = today }`).

`notes` is stored on the generated repair log (`handler.go:344` doc: "Optional completion note, stored on the repair log"). Completing an inactive schedule → 400 `ErrScheduleInactive` (`handler.go:159`).

**UI:** just call `maintenanceApi.complete(ws, id, notes?)`, then invalidate the `["maintenance", wsId]` prefix AND the `["repairs", wsId]` prefix (completion created a repair-log row). No client date math. A small confirm/notes dialog is sufficient (mirror `ReturnLoanDialog`).

---

### OQ5 — Cost rollup: a LIST because it groups by currency_code. RESOLVED.

**Resolution:** `GET /inventory/{inventory_id}/repair-cost` returns `{ items: [{ currency_code, total_cost_cents, repair_count }] }` (`repairlog/handler.go:329-352`, response type `RepairCostSummaryResponse:510-514`). It is a LIST because repairs can have different `currency_code` values — the backend groups COMPLETED repairs **by currency** and returns one summary per currency. `repair_count` is the number of completed repairs in that currency (doc string `handler.go:513`).

**RPR-02 display:** render one line per currency summary (e.g., `"€42.50 across 3 repairs"`). Do NOT sum across currencies (you cannot add EUR to USD). In the common single-currency case there is exactly one item. Render in the repair drawer header or footer. Format `total_cost_cents` with the cents→currency helper (see Code Examples) keyed off `currency_code` (default `"USD"`/`"EUR"` per project; confirm default with the user — `[ASSUMED]` A2).

---

### OQ6 — Repair status lifecycle: PENDING → IN_PROGRESS → COMPLETED. Server-flag pill. RESOLVED.

**Exact statuses (verified `entity.go:16-21`):**
- `"PENDING"` (`StatusPending`) — created state (`entity.go:72` — every new repair starts PENDING)
- `"IN_PROGRESS"` (`StatusInProgress`) — after `start`
- `"COMPLETED"` (`StatusCompleted`) — after `complete`

**Transitions (strict, server-enforced):**
- `start` (`POST /repairs/{id}/start`): only from PENDING (`entity.go:184-189`), else 400 `ErrInvalidStatusTransition` ("can only start repair from pending status" — `handler.go:193`)
- `complete` (`POST /repairs/{id}/complete`): only from IN_PROGRESS (`entity.go:195-199`), else 400 ("can only complete repair from in_progress status" — `handler.go:233`)
- Update is blocked once COMPLETED (`entity.go:217`, 400 `ErrRepairAlreadyCompleted` — `handler.go:149-150`)

The wire `status` is the entity status uppercased (`handler.go:374` `Status: string(r.Status())`).

**Status-pill mapping (mirror `loanStatus.ts` — pure function, no React, reads ONLY server `status`):**
```ts
// features/repairs/repairStatus.ts — mirrors features/loans/loanStatus.ts:13-20
import type { Repair } from "@/lib/types";
export function repairStatus(r: Repair): { variant: "info" | "ok" | "danger"; label: string } {
  if (r.status === "COMPLETED") return { variant: "ok", label: "COMPLETED" };
  if (r.status === "IN_PROGRESS") return { variant: "info", label: "IN PROGRESS" };
  return { variant: "danger", label: "PENDING" }; // or "neutral" — see UI-SPEC; PENDING = action-needed
}
```
The available row actions derive from status: PENDING → show START + EDIT + DELETE; IN_PROGRESS → show COMPLETE + EDIT; COMPLETED → read-only (mirror `LoanRowActions.tsx:28` returning null for terminal rows).

---

### OQ7 — MNT-03 dashboard feed: ship the hook + due page only. Phase 13 mounts the card. RESOLVED.

**Resolution: YES — no dashboard work in 10b.** The dashboard (`features/dashboard/DashboardPage`) is not edited this phase. 10b ships:
- `useMaintenanceDue` query hook (keyed `["maintenance", wsId, "due", days]`) consuming `GET /maintenance/due` (`maintenance/handler.go:42`)
- the `/maintenance/due` PAGE (MNT-02 due list)

Phase 13 (dashboard) imports `useMaintenanceDue` to mount the due-soon card. The due endpoint already returns everything the card needs per row: the schedule fields PLUS `item_id`, `item_name`, and the server `is_overdue` flag (`DueScheduleResponse`, `handler.go:297-302`). `[ASSUMED]` A3 that Phase 13 owns the card mount — consistent with the loans pattern where the dashboard consumes feature hooks.

---

### OQ8 — Routes/nav: add `/maintenance` (list) + `/maintenance/due` + a sidebar entry. Repairs are drawer-only. RESOLVED.

**Resolution:**
- **Repairs:** NO standalone route, NO sidebar entry. Repairs are per-inventory drawers only (OQ1). There is no workspace-wide repairs list page in scope (the backend has `GET /repairs` but parity surfaces repairs through inventory, mirroring how loans surface through inventory/borrowers).
- **Maintenance:** add TWO routes + ONE sidebar entry:
  - `/maintenance` → `MaintenanceListPage` (MNT-01 workspace list, `GET /maintenance`)
  - `/maintenance/due` → `MaintenanceDuePage` (MNT-02 due list, `GET /maintenance/due`)
  - Per-inventory maintenance is ALSO a drawer (OQ1, `MaintenanceDrawer`).

**routes/index.tsx edit (SINGLE WRITER — serialize):** add imports + two routes. **Literal `maintenance/due` MUST be registered BEFORE `maintenance`** is NOT strictly required here (no `:id` param collision since `due` is a sibling literal, not a param), but follow the established ordering convention (`routes/index.tsx:70-78`: literal-before-param). Both are literal so order is harmless; register `due` first for clarity:
```tsx
import { MaintenanceListPage } from "@/features/maintenance/MaintenanceListPage";
import { MaintenanceDuePage } from "@/features/maintenance/MaintenanceDuePage";
// …inside the AppShell layout route, alongside the other feature routes:
<Route path="maintenance/due" element={<MaintenanceDuePage />} />
<Route path="maintenance" element={<MaintenanceListPage />} />
```
This is the ONLY `routes/index.tsx` edit this phase; declare it single-writer.

**Sidebar.tsx edit (SINGLE WRITER):** add one `NavItem` in the primary nav group (after Borrowers, `Sidebar.tsx:145`), mirroring the shipped entries exactly:
```tsx
<NavItem glyph="⟳" label={<Trans>Maintenance</Trans>} to="/maintenance" />
```
(Pick a free glyph; `⟳` suggested. No `count` unless `stats` exposes a due count — it does not currently, so omit `count`.)

## Architecture Patterns

### System Architecture Diagram

```
InventoryListPage (shipped; single-writer edit adds 2 row buttons + 2 drawers)
  row action ⚒  ──set repairsId──►  RepairsDrawer(invId)
  row action ⟳  ──set maintId──►    MaintenanceDrawer(invId)

RepairsDrawer(invId)
  └─ useRepairsByInventory(invId)  GET /inventory/{id}/repairs        ► repair list
  └─ useRepairCost(invId)          GET /inventory/{id}/repair-cost    ► per-currency totals (RPR-02)
  └─ select a repair ▼
       ├─ RepairForm (RHF+zod)     POST/PATCH /repairs[/id]           ► create/edit
       ├─ lifecycle buttons        POST /repairs/{id}/start|complete  ► status transitions
       ├─ RepairPhotoPanel         /repairs/{id}/photos/* (multipart) ► RPR-03 (forked atoms)
       └─ RepairAttachmentPanel    /repairs/{id}/attachments/*        ► RPR-04 (link-only, OQ3)

MaintenanceDrawer(invId)
  └─ useMaintenanceByInventory(invId)  GET /inventory/{id}/maintenance
       ├─ MaintenanceForm (RHF+zod)    POST/PATCH /maintenance[/id]
       ├─ complete button              POST /maintenance/{id}/complete  ► advances next_due (server)
       └─ delete                       DELETE /maintenance/{id}

/maintenance (route + sidebar)  ─ useMaintenanceList   GET /maintenance       ► MNT-01
/maintenance/due (route)        ─ useMaintenanceDue    GET /maintenance/due   ► MNT-02 (is_overdue)
                                   └─ same hook consumed by Phase 13 dashboard card (MNT-03)

All writes ──► onSettled invalidate ["repairs", wsId] / ["maintenance", wsId] prefixes
complete-repair w/ new_condition ──► ALSO invalidate ["inventory", wsId] (server updates condition)
complete-maintenance ──► ALSO invalidate ["repairs", wsId] (server created a repair-log row)
```

### Recommended Project Structure
```
frontend2/src/
├── lib/api/
│   ├── repairs.ts              # mirror loans.ts
│   ├── maintenance.ts          # mirror loans.ts
│   ├── repairPhotos.ts         # forked from photos.ts mapper (OQ2)
│   └── repairAttachments.ts    # link-only (OQ3)
├── features/repairs/
│   ├── repairStatus.ts         # mirror loanStatus.ts (OQ6)
│   ├── schema.ts               # RHF+zod create/edit schema
│   ├── hooks/
│   │   ├── useRepairsQuery.ts          # by-inventory list + cost
│   │   └── useRepairMutations.ts       # mirror useLoanMutations
│   └── components/
│       ├── RepairsDrawer.tsx           # RetroDialog shell (mirror MovementsDrawer)
│       ├── RepairForm.tsx              # create/edit (RHF+zod)
│       ├── RepairPhotoPanel.tsx        # forked upload+grid (OQ2)
│       └── RepairAttachmentPanel.tsx   # link/list/delete (OQ3)
├── features/maintenance/
│   ├── schema.ts
│   ├── MaintenanceListPage.tsx         # /maintenance (MNT-01)
│   ├── MaintenanceDuePage.tsx          # /maintenance/due (MNT-02)
│   ├── hooks/
│   │   ├── useMaintenanceQuery.ts      # list + by-inventory + due
│   │   └── useMaintenanceMutations.ts  # mirror useLoanMutations
│   └── components/
│       ├── MaintenanceDrawer.tsx       # RetroDialog shell
│       └── MaintenanceForm.tsx
└── test/msw/
    ├── repairHandlers.ts               # mirror loanHandlers.ts (per-test server.use)
    └── maintenanceHandlers.ts
```

### Pattern 1: Optimistic prefix-invalidate mutations (THE template)
**What:** Snapshot every query under the entity prefix, optimistically patch the matching record, restore on error + toast, re-invalidate on settle so the server value (recomputed flags like `is_overdue`, `status`) wins.
**When to use:** all repair + maintenance write hooks.
**Example:**
```ts
// Source: shipped features/loans/hooks/useLoanMutations.ts:39-116
const prefix: QueryKey = ["repairs", wsId as string];
function invalidate() { queryClient.invalidateQueries({ queryKey: prefix }); }
async function optimisticPatch(id, patch) {
  await queryClient.cancelQueries({ queryKey: prefix });
  const snapshots = queryClient.getQueriesData({ queryKey: prefix });
  queryClient.setQueriesData({ queryKey: prefix }, (old) => {
    if (!old || !Array.isArray(old.items)) return old;       // BARE {items} guard
    return { ...old, items: old.items.map((r) => r.id === id ? { ...r, ...patch } : r) };
  });
  return { snapshots };
}
// startRepair / completeRepair / updateRepair: onMutate→optimisticPatch, onError→restore+toast, onSettled→invalidate
// completeRepair with new_condition: ALSO queryClient.invalidateQueries({ queryKey: ["inventory", wsId] })
```

### Pattern 2: Per-row drawer (mirror MovementsDrawer)
```tsx
// Source: shipped features/inventory/components/MovementsDrawer.tsx:22-47
export function RepairsDrawer({ invId, itemName, onClose }: RepairsDrawerProps) {
  const { t } = useLingui();
  return (
    <RetroDialog open={invId !== null} onClose={onClose}
      title={itemName ? t`REPAIRS — ${itemName}` : t`REPAIRS`} titlebarVariant="blue">
      {/* repair list + selected-repair detail + photos/attachments panels */}
    </RetroDialog>
  );
}
```

### Pattern 3: BARE `{ items }` envelope api module (mirror loans.ts)
```ts
// Source: shipped lib/api/loans.ts — lists return BARE {items}; huma $schema deliberately unmodelled
export const repairsApi = {
  byInventory: (ws, invId) => get<{ items: Repair[] }>(`/workspaces/${ws}/inventory/${invId}/repairs`),
  cost: (ws, invId) => get<{ items: RepairCostSummary[] }>(`/workspaces/${ws}/inventory/${invId}/repair-cost`),
  get: (ws, id) => get<Repair>(`/workspaces/${ws}/repairs/${id}`),
  create: (ws, body) => post<Repair>(`/workspaces/${ws}/repairs`, body),
  update: (ws, id, body) => patch<Repair>(`/workspaces/${ws}/repairs/${id}`, body),
  start: (ws, id) => post<Repair>(`/workspaces/${ws}/repairs/${id}/start`),
  complete: (ws, id, new_condition?) => post<Repair>(`/workspaces/${ws}/repairs/${id}/complete`, { new_condition }),
  del: (ws, id) => del<void>(`/workspaces/${ws}/repairs/${id}`),
};
```

### Query keys (carry-forward rule 4)
| Hook | Query key |
|------|-----------|
| repairs by inventory | `["repairs", wsId, "by-inventory", invId]` |
| repair cost | `["repairs", wsId, "cost", invId]` |
| single repair | `["repairs", wsId, id]` |
| repair photos | `["repairs", wsId, repairId, "photos"]` |
| repair attachments | `["repairs", wsId, repairId, "attachments"]` |
| maintenance list | `["maintenance", wsId, { page, limit }]` |
| maintenance by inventory | `["maintenance", wsId, "by-inventory", invId]` |
| maintenance due | `["maintenance", wsId, "due", days]` |
| single schedule | `["maintenance", wsId, id]` |

All sit UNDER the `["repairs", wsId]` / `["maintenance", wsId]` prefixes so prefix invalidation (and Phase 6 SSE invalidation) covers them. Mirrors `useBorrowerLoans.ts:16` sub-key style.

### MSW handler conventions
- File per feature: `test/msw/repairHandlers.ts`, `test/msw/maintenanceHandlers.ts` (mirror `loanHandlers.ts`).
- Match at the `/api/...` prefix (api.ts prepends `BASE_URL="/api"` — `loanHandlers.ts:4` comment).
- Register **per-test** via `server.use(...repairHandlers)` in the test's `beforeEach` (NOT spread into the global `handlers.ts` — confirmed: `loanHandlers` is imported and `server.use(...loanHandlers)` per-test at `LoansListPage.test.tsx:9,42`; it is NOT in `handlers.ts`).
- Specific sub-routes BEFORE catch-alls (e.g., `/repairs/:id/start` and `/repairs/:id/complete` BEFORE `/repairs/:id`) — `loanHandlers.ts:62-92` ordering.
- Lists return BARE `{ items }` (and `total` where the backend includes it); fixtures should include one PENDING, one IN_PROGRESS, one COMPLETED repair and one overdue + one upcoming schedule (`is_overdue` true/false) to exercise pills.

### Anti-Patterns to Avoid
- **Reusing `PhotoUpload`/`PhotoGallery` directly** — they're hardwired to `photosApi`/items contract and lack `photo_type`. Fork thin (OQ2).
- **Client date math for overdue or next_due** — server owns both (`is_overdue` flag, transactional `Schedule.Complete`). Mirror the loans lesson (`loanStatus.ts:6-9`).
- **Summing repair cost across currencies** — render per-currency rows (OQ5).
- **Modeling huma's `$schema` key** — lists are BARE `{ items }` (Pitfall 4 carried from loans).
- **Two plans editing `InventoryListPage.tsx` / `routes/index.tsx` / `Sidebar.tsx` in the same wave** — single-writer; one plan owns each.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic mutation + rollback | Custom cache patching | Copy `useLoanMutations` snapshot/restore | Proven, handles BARE-envelope guard |
| Status pill | Inline conditionals | `repairStatus()` pure fn (mirror `loanStatus`) | Server-flag discipline, testable |
| next_due advance | Client `addDays` | `POST /maintenance/{id}/complete` | Server is transactional + overdue catch-up |
| overdue flag | `new Date() > due` | server `is_overdue` | TZ/clock-skew bugs (the loans lesson) |
| Drawer shell | New modal | `RetroDialog` (mirror `MovementsDrawer`) | ESC/scrim/stack already handled by Phase 3 modal stack |
| Multipart upload plumbing | `fetch` | `postMultipart` (`lib/api.ts:154`) | Cookie auth + error mapping built in |
| Absolute→/api URL rewrite | String replace at consumer | `toProxyUrl` mapper boundary | Single rewrite point (Pitfall 1) |
| cents→currency | `(c/100).toFixed(2)` ad hoc | a shared `formatCents` util (NONE exists — create one) | Consistency; locale-aware (see Code Examples) |

**Key insight:** This phase is ~90% pattern-mirroring. The new judgment calls are exactly the 8 OQs; the mechanics are copy-from-loans.

## Code Examples

### cents → currency (NO util exists — create `lib/utils/money.ts`)
Verified: there is no `formatCurrency`/`formatCents`/`Intl.NumberFormat` money helper anywhere in `lib`/`features` (grep returned only `lib/types.ts` comments noting `purchase_price` is cents, and price values are stored but never formatted in shipped UI). Create one:
```ts
// lib/utils/money.ts — NEW. cents (int) → localized currency string.
export function formatCents(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}
// usage (RPR-02): summaries.map(s => formatCents(s.total_cost_cents, s.currency_code ?? "EUR"))
```
`[ASSUMED]` A2: default currency `"EUR"` (project is homelab/EU — `danger=#b73348` retro-os, antti@begin.ee). Confirm with user.

### Repair create body (verified `repairlog/handler.go:416-428`)
```ts
export interface CreateRepairBody {
  inventory_id: string;          // REQUIRED — repair is against an inventory entry, NOT item_id
  description: string;           // REQUIRED, minLength 1
  repair_date?: string;          // RFC3339
  cost?: number;                 // CENTS (int) — never a float
  currency_code?: string;        // e.g. "EUR"
  service_provider?: string;
  notes?: string;
  is_warranty_claim?: boolean;
  reminder_date?: string;        // RFC3339
}
```

### Maintenance create body (verified `maintenance/handler.go:312-320`)
```ts
export interface CreateScheduleBody {
  inventory_id: string;          // REQUIRED
  title: string;                 // REQUIRED, 1..200 chars
  notes?: string;
  interval_days: number;         // REQUIRED, >= 1
  next_due: string;              // REQUIRED, date — backend formats response as YYYY-MM-DD
}
```

## Runtime State Inventory

N/A — greenfield additive frontend feature (no rename/refactor/migration). No stored data, live config, OS state, secrets, or build artifacts are touched. Backend is unchanged (all routes already wired, `router.go:516-517`).

## Common Pitfalls

### Pitfall 1: Forgetting `photo_type` on repair photo upload
**What goes wrong:** 400 "photo_type is required". **Why:** repair photos REQUIRE `photo_type` (BEFORE/DURING/AFTER) — unlike item photos (`repairphoto/handler.go:247-256`). **Avoid:** the forked `RepairPhotoPanel` must include a type selector; the api always appends `photo_type`.

### Pitfall 2: Assuming a byte-upload endpoint for attachments
**What goes wrong:** building an upload zone that has no backend. **Why:** no file-byte-ingest endpoint exists (OQ3). **Avoid:** RPR-04 is link-only (Option A) until a backend files endpoint lands.

### Pitfall 3: Wrong status-transition order
**What goes wrong:** calling `complete` on a PENDING repair → 400. **Why:** strict PENDING→IN_PROGRESS→COMPLETED (`entity.go:184,195`). **Avoid:** gate action buttons on `status` (PENDING shows START, IN_PROGRESS shows COMPLETE).

### Pitfall 4: limit > 100 → 422
**What goes wrong:** maintenance/repair list request with `limit=200` 422s. **Why:** `maximum:"100"` on both (`maintenance/handler.go:272`, `repairlog/handler.go:395`). **Avoid:** cap at 100 (mirror the `INVENTORY_LIMIT` lesson, `InventoryListPage.tsx:78-81`).

### Pitfall 5: Summing across currencies in RPR-02
**Avoid:** render per-currency rows; never add EUR+USD (OQ5).

### Pitfall 6: Render-loop from unstable `t`
**What goes wrong:** infinite re-render. **Why:** `useLingui().t` is not referentially stable (`InventoryListPage.tsx:47-49`). **Avoid:** read `t` through a ref in memo/shortcut closures; depend on stable `.mutate` identities.

### Pitfall 7: Modeling huma `$schema`
**Avoid:** type lists as BARE `{ items }` / `{ items, total }` only.

### Pitfall 8: Cross-invalidation misses
**What goes wrong:** stale inventory condition or stale repair list after maintenance complete. **Why:** complete-repair-with-new-condition mutates inventory (`repairlog/service.go:197-225`); complete-maintenance writes a repair-log row (`maintenance/service.go:199-202`). **Avoid:** invalidate `["inventory", wsId]` after repair-complete-with-condition; invalidate `["repairs", wsId]` after maintenance-complete (carry-forward rules 4 & 7).

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Inventory detail page for per-entry concerns | Per-row RetroDialog drawers off the list | Phase 7b | Repairs/maintenance follow the same drawer model (OQ1) |
| Client-derived loan overdue | Server `is_overdue` flag | Phase 8 | Maintenance `is_overdue` follows suit (OQ8/Pitfall) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RPR-04 is link-only (no byte upload) because no file-ingest endpoint exists | OQ3 | If a byte endpoint is expected, RPR-04 needs new backend work (out of frontend parity scope) |
| A2 | Default currency for `formatCents` is `"EUR"` | OQ5, Code Examples | Wrong default shows wrong symbol; trivially corrected, and per-summary `currency_code` overrides it anyway |
| A3 | Phase 13 owns the dashboard maintenance-due card; 10b ships only the hook + page | OQ7 | If 10b must mount the card, add a small dashboard edit (single-writer DashboardPage) |
| A4 | No workspace-wide repairs list page is in parity scope (repairs are drawer-only) | OQ8 | If a `/repairs` page is wanted, add a route + `GET /repairs` consumer (backend already supports it) |

## Open Questions

All eight CONTEXT.md OQs are RESOLVED above. Remaining decisions are the four `[ASSUMED]` items (A1-A4) — surface to the user in discuss/plan; A1 is the only one that could expand scope.

## Environment Availability

N/A for the frontend build itself (all deps installed). For E2E: backend on :8080 + Postgres `warehouse_dev` + Vite :5173 with the load-bearing `/api`→root rewrite (per CLAUDE.md). Repair/maintenance routes are live (`router.go:516-517`).

## Validation Architecture

> `.planning/config.json` has no `workflow.nyquist_validation` key → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (component) + MSW; Playwright (E2E) |
| Config file | `frontend2/vitest.config.*`, `frontend2/playwright.config.ts` |
| Quick run command | `cd frontend2 && bun run test <path>` |
| Full suite command | `cd frontend2 && bun run test` |
| E2E | `cd frontend2 && E2E_USER=… E2E_PASS=… bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPR-01 | Repair CRUD + start/complete from drawer | unit (MSW) | `bun run test features/repairs` | ❌ Wave 0 |
| RPR-02 | Per-currency cost rollup display | unit | `bun run test features/repairs` | ❌ Wave 0 |
| RPR-03 | Repair photos upload/list/delete (photo_type) | unit | `bun run test features/repairs` | ❌ Wave 0 |
| RPR-04 | Attachment link/list/delete | unit | `bun run test features/repairs` | ❌ Wave 0 |
| MNT-01 | Maintenance CRUD + list | unit | `bun run test features/maintenance` | ❌ Wave 0 |
| MNT-02 | Due list w/ server is_overdue | unit | `bun run test features/maintenance` | ❌ Wave 0 |
| MNT-03 | `useMaintenanceDue` hook ships | unit | `bun run test features/maintenance` | ❌ Wave 0 |
| RPR/MNT | Drawer open from inventory row | unit | `bun run test features/inventory` | ⚠ extend existing |
| E2E | Repair create→start→complete OR maintenance complete advances next_due | e2e | `bun run test:e2e` | ❌ Wave 0 |

### Sampling Rate
- Per task commit: `bun run test <touched feature dir>`
- Per wave merge: `bun run test` (full vitest)
- Phase gate: full vitest green + E2E spec green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/msw/repairHandlers.ts` + `test/msw/maintenanceHandlers.ts` (mirror `loanHandlers.ts`)
- [ ] Component test scaffolds per feature dir
- [ ] `frontend2/e2e/repairs-maintenance.spec.ts` (re-add browser coverage per CLAUDE.md note that scan/by-barcode frontend coverage is gone; this phase adds repair/maintenance E2E)
- [ ] `lib/utils/money.ts` (+ unit test) — no money util exists

## Security Domain

> `security_enforcement` not present in config → treated as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Backend enforces workspace scoping on EVERY route (`GetWorkspaceID` guard at the top of each handler) + cross-workspace file check (`repairattachment/handler.go:62`). Frontend passes `wsId` in the path; no client-side authz logic. |
| V5 Input Validation | yes | zod on RHF forms; backend re-validates (minLength, interval ≥1, enum types). Trust the server. |
| V12 File Upload | yes (RPR-03) | Backend validates type (JPEG/PNG/WebP) + size (10MB) + serves with CSP `default-src 'none'` (`repairphoto/handler.go:268-271,379`). Frontend should pre-validate type/size for UX but server is authoritative. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant repair/attachment access | Info disclosure | Server workspace guard + file-workspace check (`repairattachment/handler.go:62`) — already enforced |
| Malicious upload (XSS via served image) | Tampering | Server CSP + `Content-Disposition` on serve (`repairphoto/handler.go:378-379`) |
| Oversized upload DoS | DoS | Server 10MB cap (`MaxFileSize`, `repairphoto/handler.go:233`) |

## Sources

### Primary (HIGH confidence — read in-session)
- `backend/.../repairlog/{handler,service,entity}.go` — routes, lifecycle, statuses, cost rollup
- `backend/.../maintenance/{handler,service,entity}.go` — routes, transactional complete, next_due advance, is_overdue
- `backend/.../repairphoto/handler.go` — multipart upload contract (`photo` + required `photo_type`)
- `backend/.../repairattachment/{handler,service}.go` — file_id link contract
- `backend/.../attachment/{handler,service}.go` — confirmed NO byte-ingest file endpoint (OQ3)
- `backend/internal/api/router.go:516-517` — route wiring confirmed live
- `frontend2/src/features/inventory/InventoryListPage.tsx`, `components/MovementsDrawer.tsx` — drawer pattern + single-writer edit
- `frontend2/src/lib/api/loans.ts`, `features/loans/{loanStatus.ts, hooks/useLoanMutations.ts, hooks/useBorrowerLoans.ts, components/LoanRowActions.tsx}` — api/hook/status/row-action templates
- `frontend2/src/lib/api/photos.ts`, `features/items/{components/PhotoUpload.tsx, components/PhotoGallery.tsx, hooks/usePhotoMutations.ts}` — confirmed atoms are hardwired (OQ2)
- `frontend2/src/routes/index.tsx`, `components/layout/Sidebar.tsx` — route/nav conventions
- `frontend2/src/test/msw/{loanHandlers.ts, handlers.ts, server.ts}`, `features/loans/LoansListPage.test.tsx` — MSW per-test registration convention
- `frontend2/src/lib/api.ts` — `postMultipart` (:154), `get/post/patch/del/put` helpers

### Secondary
- `.planning/phases/10b-repairs-maintenance/10b-CONTEXT.md` — verified backend surface + OQs
- `CLAUDE.md` (frontend2 E2E runbook, `/api` rewrite)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from shipped frontend2 + package baseline
- Architecture (drawers/hooks/keys): HIGH — direct mirror of shipped loans/movements
- Backend contracts: HIGH — read every handler/service/entity in-session
- OQ3 attachment gap: HIGH on the gap (exhaustive grep); the resolution (link-only) is `[ASSUMED]` pending user confirm
- Pitfalls: HIGH — each tied to a code line

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable internal codebase; re-verify only if backend repair/maintenance/file endpoints change)
