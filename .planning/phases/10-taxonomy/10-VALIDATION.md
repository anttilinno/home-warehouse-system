---
phase: 10-taxonomy
nyquist_compliant: false
wave_0_complete: false
---

# Phase 10 — Taxonomy — VALIDATION

Pre-execution contract. Flags flip true only after execution closes Wave-0 gaps (api modules +
RetroTree atom + MSW + tests). Orchestrator verifies at the phase gate.

## Requirement → evidence map
| Req | Deliverable | Verifiable by |
|-----|-------------|---------------|
| TAX-01 | Categories tab: hierarchical tree, expand/collapse → sessionStorage | RetroTree + Categories tab test (nodes nest, toggle persists to `taxonomy:tree:categories`) |
| TAX-02 | Create/edit/archive categories any level; CLIENT usage-warning on archive-with-items | Categories CRUD test (archive confirm shows item count from `GET /items?category_id=&limit=1`) |
| TAX-03 | Locations tab: hierarchical tree | Locations tab test (nests via `parent_location`) |
| TAX-04 | Create/edit/archive locations any level (ARCHIVE, never delete) | Locations CRUD test (archive path; no delete button) |
| TAX-05 | Containers tab grouped by location | Containers tab test (group-by location_id headers) |
| TAX-06 | Create/edit/DELETE containers; delete = plain DELETE (Postgres SET NULL unassign) + "unassign N" confirm | Containers CRUD test (delete confirm warns count; bare DELETE call) |
| TAX-07 | Label manager: CRUD list + 8-swatch color | Labels tab test (create/edit/delete, color swatch) |

## Binding overrides (must hold in shipped code)
1. Trees CLIENT-built from flat list; categories key `parent_category_id`, locations `parent_location` (DIFFERENT — pitfall).
2. Archive always succeeds server-side; usage-warning is CLIENT-computed (count via items/inventory list `total`), shown in confirm BEFORE the archive call. No `?force=`.
3. Container delete = bare `DELETE /containers/{id}` (no flag/2nd call); confirm warns "unassign from N".
4. Locations use ARCHIVE not DELETE (location delete is dangerous: cascade/restrict).
5. Envelope per-endpoint: categories/labels/search bare `{items}`; locations/containers/items-list paginated — read `total` only where present.
6. Reuse shipped `RetroCombobox` for parent/location pickers; new `useTaxonomySearch` /search hook; DO NOT retrofit shipped item/inventory/loan forms.
7. RetroTree net-new atom; per-tab sessionStorage `taxonomy:tree:<tab>`.
8. Labels 4th `?tab=labels`; 8-swatch on-palette color (store hex).
9. `/taxonomy` single route + `?tab=`; literal-before-param for create/edit form routes; limit≤100; query-key prefixes `["categories"|"locations"|"containers"|"labels", wsId]`; render-loop guard; routes/index.tsx single-writer/serialize across plans.

## Phase gate (orchestrator)
- tsc clean, full `bun run test` green, build, lint:imports OK.
- Live Playwright taxonomy spec (category create→tree→archive-warning; container create→group→delete; label CRUD) isolated (auth limiter).
- gsd-verifier PASS; flip TAX-01..07 + traceability; log visual residues.

## Nyquist sign-off (flip after execution)
- [ ] api modules (category/location/container) + buildTree util + RetroTree shipped.
- [ ] MSW taxonomy handlers + all tab tests green.
- [ ] E2E spec discovered + green.
