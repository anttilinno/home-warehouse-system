---
phase: 14-system-group
plan: 05
subsystem: imports
tags: [imports, exports, importjob, multipart, admin-gate, SYS-04]
requires:
  - "@/lib/api: get, postMultipart (multipart helper, omits Content-Type, throws on non-2xx)"
  - "settingsApi.exportWorkspace (REUSED — the admin-gated workspace backup blob)"
  - "useWorkspace() → { currentWorkspaceId, workspaces[].role }"
  - "retro atoms via @/components/retro: Window, BevelButton, RetroSelect, RetroFileInput, RetroTable, RetroEmptyState, StatusPill, retroToast"
provides:
  - "importJobsApi.listJobs(ws, {page?,limit?}) → { jobs, total, page, total_pages }"
  - "importJobsApi.jobErrors(ws, id) → { errors, total }"
  - "importJobsApi.uploadImport(ws, entityType, file) → ImportJob (multipart POST /imports/upload)"
  - "IMPORT_ENTITY_TYPES + ImportEntityType + ImportJob + ImportError + ImportJobStatus types"
  - "useImportJobs() → { jobs, total, isLoading, isError } keyed [\"import-jobs\", wsId]"
  - "useUploadImport() mutation invalidating [\"import-jobs\", wsId]"
  - "ImportsPage (named export) — the /imports surface"
affects:
  - "14-08 (Wave-2 route wiring): mount <ImportsPage/> at /imports, add Sidebar entry, optionally flip DataStoragePage's IMPORT 'Coming soon' badge to a real link"
tech-stack:
  added: []
  patterns:
    - "multipart upload via shared postMultipart (mirrors photos.ts / settings.ts uploadAvatar) — NO base64"
    - "ADMIN_ROLES gate mirrors DataStoragePage; server 403 handled defensively via retroToast.error"
    - "activity-table pattern (LoansListPage) for the jobs history"
key-files:
  created:
    - frontend2/src/lib/api/importJobs.ts
    - frontend2/src/lib/api/importJobs.test.ts
    - frontend2/src/features/imports/hooks/useImportJobs.ts
    - frontend2/src/features/imports/hooks/useImportJobs.test.tsx
    - frontend2/src/features/imports/ImportsPage.tsx
    - frontend2/src/features/imports/ImportsPage.test.tsx
  modified: []
decisions:
  - "Import action uses the ASYNC multipart endpoint POST /imports/upload (creates the ImportJob feeding /imports/jobs) — NOT the synchronous /import/{entity_type} (no job)."
  - "entity enum = PLURAL importjob set (items|inventory|locations|containers|categories|borrowers)."
  - "NO base64 — multipart FormData (entity_type + file) carries raw bytes."
  - "Workspace export REUSES settingsApi.exportWorkspace (no re-implementation)."
metrics:
  duration: "~20m"
  completed: 2026-06-13
  tasks: 3
  files: 6
---

# Phase 14 Plan 05: Imports/Exports (SYS-04) Summary

SYS-04 /imports surface — a CSV import that uploads a chosen file via multipart
`FormData(entity_type, file)` to the **async** `POST /imports/upload` (the path
that CREATES the ImportJob), an import-history jobs table bound to
`GET /imports/jobs` (bare `jobs` envelope, activity-table pattern), and a
workspace export that REUSES `settingsApi.exportWorkspace`. All admin-gated
(ADMIN_ROLES) with the server 403 handled defensively; greenfield api +
`features/imports/` tree; no sync-engine import.

## What shipped

### `lib/api/importJobs.ts`
`importJobsApi`:
- `listJobs(ws, opts?)` → `get<{ jobs, total, page, total_pages }>` over
  `/workspaces/{ws}/imports/jobs` (forwards `page`/`limit`). Envelope key is
  **`jobs`** (NOT items/changes).
- `jobErrors(ws, id)` → `{ errors, total }` over `/imports/jobs/{id}/errors`.
- `uploadImport(ws, entityType, file)` → builds `FormData` with `entity_type` +
  `file`, POSTs via the shared `postMultipart` (omits Content-Type so the
  browser sets the multipart boundary, `credentials:"include"`, throws on
  non-2xx). Returns the created `ImportJob` (201). **No base64.**

Exported types: `ImportJob`, `ImportError`, `ImportJobStatus`,
`ImportEntityType` (PLURAL: `items|inventory|locations|containers|categories|borrowers`),
`IMPORT_ENTITY_TYPES`, `ImportJobsPage`, `ImportErrorsPage`.

### `features/imports/hooks/useImportJobs.ts`
- `useImportJobs()` → `useQuery` keyed `["import-jobs", wsId]`, `enabled:
  Boolean(wsId)`, `retry:false` → `{ jobs, total, isLoading, isError }`.
- `useUploadImport()` → `useMutation` running `importJobsApi.uploadImport`,
  `onSuccess` invalidates `["import-jobs", wsId]`. Vars: `{ entityType, file }`.

### `features/imports/ImportsPage.tsx`
Named export `ImportsPage`. One `<Window title="IMPORTS — {workspaceName}">`
with three sections (border-b dividers):
1. **IMPORT** — `RetroSelect` (the PLURAL enum) + `RetroFileInput` (.csv, 10MB
   cap) + an Import `BevelButton` → `useUploadImport().mutate`. Gated on
   ADMIN_ROLES; non-admin → calm "Importing data requires admin rights."; 403 →
   `retroToast.error`. Success → success toast + clears the file.
2. **EXPORT** — `BevelButton` → `settingsApi.exportWorkspace(wsId, "xlsx")`
   (reused, defensive 403); non-admin → calm requires-admin line.
3. **HISTORY** — the jobs activity-table (`RetroTable`): File / Type / Status
   (`StatusPill` keyed off status) / Progress (`{progress}%`) / Rows
   (success / error) / Created. Failed jobs surface inline `error_message`.
   Empty → `RetroEmptyState` ("NO IMPORTS YET").

All strings via `<Trans>`/`t`.

## Selectors for 14-08 (route wiring)
- Page: `import { ImportsPage } from "@/features/imports/ImportsPage"`.
- Query key prefix: `["import-jobs", wsId]`.
- Upload contract: multipart FormData fields `entity_type` + `file` → POST
  `/api/workspaces/{ws}/imports/upload` (NO base64).
- DataStoragePage's IMPORT section still shows a "Coming soon" badge pointing
  here — flipping it to a real `/imports` link is OPTIONAL and belongs to 14-08
  (this plan did NOT touch settings, per single-writer rule).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test-env bug] MSW multipart parser cannot read a jsdom File part**
- **Found during:** Task 2 (hook test).
- **Issue:** `await request.formData()` inside an MSW handler throws in
  undici/jsdom when the body carries a jsdom-constructed `File` part
  (`webidl.is.File` assertion fails) — a test-environment limitation, not a code
  bug.
- **Fix:** The hook + page tests assert the upload was hit with a
  `multipart/form-data` content-type instead of re-parsing the body; the exact
  `entity_type` + `file` FormData-field assertion lives in `importJobs.test.ts`,
  which inspects the OUTGOING body object directly (stubbed `global.fetch`,
  mirroring `photos.test.ts`). Coverage of the multipart contract is preserved.
- **Files modified:** `useImportJobs.test.tsx`, `ImportsPage.test.tsx`.
- **Commit:** bf90630f (hook), fc1ec190 (page).

**2. [Rule 1 - Test-env bug] `vi.stubGlobal("URL", {...})` broke MSW request matching**
- **Found during:** Task 3 (page test) — every `/imports/jobs` request errored
  (`isError`), surfacing "Couldn't load import history".
- **Issue:** Replacing the global `URL` with a plain object to add
  `createObjectURL`/`revokeObjectURL` (jsdom lacks them, needed for the export
  blob anchor) destroyed the `URL` constructor that MSW + the api client use for
  request matching.
- **Fix:** Patch `URL.createObjectURL`/`URL.revokeObjectURL` onto the REAL `URL`
  constructor in `beforeAll` instead of replacing it.
- **Files modified:** `ImportsPage.test.tsx`.
- **Commit:** fc1ec190.

No architectural deviations. No authentication gates. No packages installed.

## Threat coverage
- **T-14-14** (non-admin import EoP): UI gates the import form on ADMIN_ROLES;
  the server requireAdminRole is authoritative — a 403 surfaces a calm
  `retroToast.error`, never a storm. Covered by the non-admin gate test.
- **T-14-15** (huge-file DoS): `RetroFileInput` accepts only `.csv` with a 10MB
  `maxSize`; one-shot upload, server caps the multipart payload.
- **T-14-16** (offline/sync import): page imports NO `sync*`/`offline*` module —
  `lint:imports` green.
- **T-14-SC** (npm installs): none — composes existing react-query + @/lib/api +
  settingsApi + retro atoms.

## Known Stubs
None — the import action, jobs history, and export are all wired to real
endpoints (no placeholder/empty-data stubs).

## Verification
- `bun run lint:tsc` — clean.
- `bun run lint:imports` — OK (no offline/sync import).
- `bun run test src/lib/api/importJobs.test.ts src/features/imports` — 3 files,
  13 tests passed.

## TDD Gate Compliance
Each task followed RED (failing test) → GREEN (implementation). Per-task commits
are `feat(14-05): …` (the api/hook/page were written test-first; the test +
impl landed in a single atomic commit per task as the test was authored
alongside its target file).

## Self-Check: PASSED
- FOUND: frontend2/src/lib/api/importJobs.ts
- FOUND: frontend2/src/lib/api/importJobs.test.ts
- FOUND: frontend2/src/features/imports/hooks/useImportJobs.ts
- FOUND: frontend2/src/features/imports/hooks/useImportJobs.test.tsx
- FOUND: frontend2/src/features/imports/ImportsPage.tsx
- FOUND: frontend2/src/features/imports/ImportsPage.test.tsx
- FOUND commit: ef28c814 (Task 1)
- FOUND commit: bf90630f (Task 2)
- FOUND commit: fc1ec190 (Task 3)
