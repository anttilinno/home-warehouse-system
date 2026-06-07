---
phase: quick-260607-vdf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/internal/infra/postgres/shortlink_repository_integration_test.go
  - frontend/app/[locale]/(dashboard)/dashboard/items/new/page.tsx
  - frontend/components/items/create-item-wizard/index.tsx
  - frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx
  - frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx
  - frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx
autonomous: true
requirements: [VDF-B-item-prefill, VDF-B-loc-cont-prefill, VDF-C-resolver-integration-test]
must_haves:
  truths:
    - "go test -tags=integration on the postgres package passes a shortlink Resolve subtest suite"
    - "go test ./... (no integration tag) does NOT see or run the new shortlink integration test"
    - "Visiting /dashboard/items/new?short_code=c7a4f9e1 prefills the item wizard's short_code field"
    - "Visiting /dashboard/locations?create=1&short_code=c7a4f9e1 auto-opens the create dialog with short_code prefilled"
    - "Visiting /dashboard/containers?create=1&short_code=c7a4f9e1 auto-opens the create dialog with short_code prefilled"
    - "The claim page create buttons navigate to URLs that the create surfaces actually consume"
  artifacts:
    - path: "backend/internal/infra/postgres/shortlink_repository_integration_test.go"
      provides: "Postgres integration test for ShortlinkRepository.Resolve"
      contains: "//go:build integration"
    - path: "frontend/app/[locale]/(dashboard)/dashboard/items/new/page.tsx"
      provides: "short_code (and barcode) URL prefill into CreateItemWizard"
  key_links:
    - from: "frontend claim page create buttons"
      to: "items/new + locations + containers create surfaces"
      via: "?short_code= / ?create=1&short_code= query contract"
      pattern: "create=1&short_code|items/new\\?short_code"
    - from: "shortlink_repository_integration_test.go"
      to: "backend/tests/testdb harness"
      via: "testdb.SetupTestDB / testdb.CreateTestWorkspace"
      pattern: "testdb\\.(SetupTestDB|CreateTestWorkspace)"
---

<objective>
Finish the s.go shortlink feature begun in quick task 260607-uzt. Two independent gaps remain:

- **Part B (frontend):** The claim wizard page already links to the create surfaces with a `?short_code=` / `?create=1&short_code=` contract, but none of those create surfaces actually READ those params yet, so the short_code is never prefilled. Wire item-create, location-create, and container-create to consume the contract, and confirm the claim page emits exactly what they consume.
- **Part C (backend):** `ShortlinkRepository.Resolve` (the UNION-ALL resolver over items/containers/locations) has no Postgres integration test. Add one behind `//go:build integration` using the existing `backend/tests/testdb` harness, mirroring the existing `handler_integration_test.go` conventions.

Purpose: Make the QR-scan "claim an unassigned code" flow actually prefill, and lock the cross-tenant + item-first priority guarantees of the resolver against regression at the real-Postgres layer.
Output: One Go integration test file; prefill wiring in three frontend create surfaces; verified claim-page targets.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<!-- LOCKED decisions — search-all-workspaces scoping, item-first priority, claim wizard. Do not revisit. -->
@/home/antti/.claude/projects/-home-antti-Repos-Misc-home-warehouse-system/memory/project_shortlink_resolver_design.md

<!-- The resolver under test (Part C). Item-first via literal sort_key; WHERE short_code=$1 AND workspace_id=ANY($2); empty slice + nil error on no-match. -->
@backend/internal/infra/postgres/shortlink_repository.go

<!-- How the handler maps Resolve results to redirects — informs what the test must guarantee (0 match, 1 match item-first, >1 match). -->
@backend/internal/domain/shortlink/handler.go

<!-- The integration-test pattern to MIRROR exactly: //go:build integration, testdb.SetupTestDB, testdb.CreateTestWorkspace, fixture IDs. -->
@backend/internal/domain/warehouse/item/handler_integration_test.go

<!-- testdb harness — REUSE, do not create parallel plumbing. Fixture workspace 00000000-...-0001, user ...-0002. CleanupTestDB truncates items/containers/locations. -->
@backend/tests/testdb/testdb.go

<!-- Claim page (Part B target). It ALREADY emits the contract below; verify/align comments, do not change the URL shapes unless the create surfaces require different param names. -->
@frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx

<interfaces>
<!-- Resolver under test (Part C) — extracted from shortlink_repository.go / handler.go. -->
Go, package postgres:
  func NewShortlinkRepository(pool *pgxpool.Pool) *ShortlinkRepository
  func (r *ShortlinkRepository) Resolve(ctx, code string, workspaceIDs []uuid.UUID) ([]shortlink.Match, error)
    // item-first ordering; empty slice + nil error when no match; len(workspaceIDs)==0 returns nil,nil
Go, package shortlink:
  type Match struct { Type string; ID uuid.UUID; WorkspaceID uuid.UUID }
  const TypeItem="item"; TypeContainer="container"; TypeLocation="location"

testdb harness:
  testdb.SetupTestDB(t) *pgxpool.Pool   // fixture ws 00000000-0000-0000-0000-000000000001, user ...0002; registers t.Cleanup
  testdb.CreateTestWorkspace(t, pool, uuid.UUID)  // for a second workspace

Schema (from db/migrations/001_initial_schema.sql) — columns needed for direct INSERT seeding:
  warehouse.items      (id default uuidv7, workspace_id, sku NOT NULL, name NOT NULL, min_stock_level NOT NULL default 0, short_code VARCHAR(8) NOT NULL)
  warehouse.locations  (id default uuidv7, workspace_id, name NOT NULL, short_code VARCHAR(8) NOT NULL)
  warehouse.containers (id default uuidv7, workspace_id, name NOT NULL, location_id NOT NULL -> locations.id, short_code VARCHAR(8) NOT NULL)
  UNIQUE (workspace_id, short_code) per table.
  NOTE: containers.location_id is NOT NULL — seed a location first and reuse its id.

<!-- Frontend create surfaces (Part B) — extracted; field/state names below are VERIFIED current, but executor MUST re-read before editing in case of drift. -->
Item wizard (frontend/components/items/create-item-wizard/index.tsx + schema.ts):
  - createItemSchema already has optional short_code and barcode string fields.
  - createItemDefaults is a STATIC const passed to <CreateItemWizard /> with NO props today.
  - MultiStepForm(defaultValues, ...) seeds react-hook-form; on mount it does reset({...defaultValues, ...draft}) — a saved draft OVERRIDES defaults, so prefill must go through defaultValues (the normal draft-empty claim flow).
  - items/new/page.tsx renders <CreateItemWizard /> and is a "use client" component.

Locations list page (frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx):
  - useState: dialogOpen/setDialogOpen, formShortCode/setFormShortCode, editingLocation/setEditingLocation (+ formName, formParentId).
  - openCreateDialog() = setEditingLocation(null); setFormName(""); setFormParentId(""); setFormShortCode(""); setDialogOpen(true).
  - imports extractScanCode from "@/lib/scanner".

Containers list page (frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx):
  - useState: dialogOpen/setDialogOpen, formShortCode/setFormShortCode, editingContainer/setEditingContainer.
  - openCreateDialog() = setEditingContainer(null); ...; setFormShortCode(""); setDialogOpen(true).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Postgres integration test for ShortlinkRepository.Resolve (Part C)</name>
  <files>backend/internal/infra/postgres/shortlink_repository_integration_test.go</files>
  <action>
Create a new Go test file. FIRST TWO LINES MUST be the build constraint exactly as in handler_integration_test.go:

    //go:build integration
    // +build integration

This is what keeps the file invisible to plain `go test ./...` — DO NOT omit it. Use an external test package `postgres_test` (handler_integration_test.go uses an external `_test` package) and import the package under test. Add the same run-instructions doc-comment block style as handler_integration_test.go (cite this quick task 260607-vdf; state it guards the shortlink UNION resolver and the cross-workspace ANY($2) scoping).

Wire the real repo against real Postgres via the existing harness ONLY: `pool := testdb.SetupTestDB(t)`. Do NOT create any parallel test-db plumbing — testdb is the established convention (STATE.md records that a prior planner's suggestion to fork integration plumbing was correctly rejected in favor of this harness). Use fixture workspace id `00000000-0000-0000-0000-000000000001` (call it wsA); create a second workspace via `wsB := uuid.New(); testdb.CreateTestWorkspace(t, pool, wsB)` for the cross-workspace subtest.

Seed rows by DIRECT SQL INSERT through the pool (NOT via Service.Create — the resolver itself is under test, and containers/locations have no Service.Create seeded here). Write small local helpers that insert and return the generated id:
  - seedItem(t, pool, ws, code) uuid.UUID — INSERT INTO warehouse.items (workspace_id, sku, name, min_stock_level, short_code) VALUES ($1,$2,$3,0,$4) RETURNING id
  - seedLocation(t, pool, ws, code) uuid.UUID — INSERT INTO warehouse.locations (workspace_id, name, short_code) VALUES ($1,$2,$3) RETURNING id
  - seedContainer(t, pool, ws, locID, code) uuid.UUID — INSERT INTO warehouse.containers (workspace_id, name, location_id, short_code) VALUES ($1,$2,$3,$4) RETURNING id
REMEMBER: containers.location_id is NOT NULL — seed a location in the same workspace first and pass its id. short_code is VARCHAR(8) NOT NULL and UNIQUE per (workspace_id, short_code) — use distinct <=8-char codes per row except where a subtest deliberately collides them.

Construct the resolver once: repo := postgres.NewShortlinkRepository(pool); ctx := context.Background().

Subtests (each t.Run), asserting on the []shortlink.Match returned by repo.Resolve(ctx, code, []uuid.UUID{...}):
  1. item match — seed item code X in wsA; Resolve(X,[wsA]) returns exactly 1 match, Type==shortlink.TypeItem, ID==seeded item id, WorkspaceID==wsA.
  2. container match — seed location+container code Y in wsA; Resolve(Y,[wsA]) returns 1 match Type==TypeContainer with the container id.
  3. location match — seed location code Z in wsA; Resolve(Z,[wsA]) returns 1 match Type==TypeLocation with the location id.
  4. item-first priority — seed an item AND a location (and optionally a container) ALL sharing code P in wsA; Resolve(P,[wsA]) returns >=2 matches and matches[0].Type==TypeItem (the literal sort_key guarantee the handler relies on to pick the highest-priority single target). Assert matches[0].Type==item and len>=2; do not over-constrain the exact count.
  5. cross-workspace scoping — seed item code Q in wsB ONLY; Resolve(Q,[wsA]) returns an EMPTY slice (len 0). Then Resolve(Q,[wsA,wsB]) returns 1 match in wsB. Proves WHERE workspace_id = ANY($2) excludes other workspaces (mirrors the cross-tenant guard in handler_integration_test.go and resolver Pitfall #5).
  6. not-found sentinel — Resolve of a guaranteed-unique code against [wsA] returns the documented sentinel: len(matches)==0 AND err==nil (repo doc: "no match returns an empty slice and a nil error"). Also assert Resolve(code, nil) (empty workspace set) returns nil,nil per the len==0 guard.

Use require/assert from stretchr/testify as handler_integration_test.go does. Generate unique codes per subtest as cheap insurance against intra-test collisions (CleanupTestDB truncates the tables only at t.Cleanup, after all subtests).
  </action>
  <verify>
    <automated>cd /home/antti/Repos/Misc/home-warehouse-system/backend && grep -q '//go:build integration' internal/infra/postgres/shortlink_repository_integration_test.go && go vet -tags=integration ./internal/infra/postgres/... && go build ./... && (go test ./internal/infra/postgres/... 2>&1 | grep -q FAIL && echo UNEXPECTED_FAIL || echo INVISIBLE_OK)</automated>
    <human-check>With a live Postgres + migrated warehouse_test DB, run per CLAUDE.md runbook: cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/infra/postgres/... -run Shortlink -v — all six subtests pass.</human-check>
  </verify>
  <done>File begins with the integration build tag; go vet -tags=integration on the postgres package compiles the test; plain go test ./internal/infra/postgres/... (no tag) does not compile/run the integration file (build stays green, prints INVISIBLE_OK). With a live Postgres the six subtests pass.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Prefill the item create wizard from ?short_code= (and ?barcode=) (Part B-item)</name>
  <files>frontend/app/[locale]/(dashboard)/dashboard/items/new/page.tsx, frontend/components/items/create-item-wizard/index.tsx</files>
  <action>
FIELD NAMES ARE VERIFIED in the &lt;interfaces&gt; block but RE-READ both files before editing — do not invent prop or field names. The wizard's createItemSchema and createItemDefaults already include optional short_code and barcode string fields; the goal is purely to seed them from the URL.

Read ?short_code and ?barcode from the URL via useSearchParams() (next/navigation) and feed them into the wizard's defaultValues:
  - components/items/create-item-wizard/index.tsx: add an optional prop initialValues?: Partial<CreateItemFormData> to CreateItemWizard, and pass defaultValues={{ ...createItemDefaults, ...initialValues }} into MultiStepForm. Keep the existing no-arg call site working (prop optional).
  - items/new/page.tsx ("use client"): read const sp = useSearchParams();, build an initialValues object from sp.get("short_code") and sp.get("barcode") (include each key only when present and non-empty, trimmed), and render <CreateItemWizard initialValues={initialValues} />. The claim page passes short_code; barcode support is included because the /scan flow links to items/new?barcode= (STATE Phase 65 notes) — keep both.

Do NOT transform the code beyond trimming; short codes are case-sensitive per the locked design. No client-side length cap (the field is VARCHAR(8) server-side; a claim link is already an exact 8-char code).

Honor the MultiStepForm caveat: on mount it does reset({...defaultValues, ...draft}), so a saved draft overrides the prefill. That is acceptable — the claim flow is a fresh create. Do not defeat the draft system; route prefill through defaultValues only.

There is NO existing wizard unit test and NO existing claim test (verified). Do NOT scaffold a new test harness for the wizard; rely on tsc/build here.
  </action>
  <verify>
    <automated>cd /home/antti/Repos/Misc/home-warehouse-system/frontend && grep -q "useSearchParams" "app/[locale]/(dashboard)/dashboard/items/new/page.tsx" && grep -q "initialValues" components/items/create-item-wizard/index.tsx && bunx tsc -b --noEmit</automated>
  </verify>
  <done>items/new/page.tsx reads ?short_code and ?barcode via useSearchParams and passes them as initialValues; CreateItemWizard merges initialValues over createItemDefaults into MultiStepForm; typecheck passes. Visiting /dashboard/items/new?short_code=c7a4f9e1 lands on a wizard whose short_code field holds c7a4f9e1.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Auto-open + prefill location/container create dialogs; align claim-page targets (Part B-loc/cont + claim)</name>
  <files>frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx, frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx, frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx</files>
  <action>
RE-READ all three files before editing. State/source names in &lt;interfaces&gt; are verified but confirm them against the live files.

LOCATIONS page (locations/page.tsx):
  - Add import { useSearchParams } from "next/navigation"; and const searchParams = useSearchParams(); in the component.
  - Add an effect that runs once when the create contract is present: when searchParams.get("create") === "1", set setFormShortCode(searchParams.get("short_code") ?? "") and also clear the other create-form fields the way openCreateDialog does (setEditingLocation(null), setFormName(""), setFormParentId("")), then setDialogOpen(true). Guard against re-firing: use a ref/one-shot guard so closing the dialog by hand does not re-trigger from stale params. Do NOT rewrite the existing openCreateDialog — either call a shared open helper that takes an optional shortCode, or inline the field-reset+open in the effect.
  - short_code is exact and case-sensitive — pass it through verbatim (do NOT run it through extractScanCode or slice it; extractScanCode is for raw scanner payloads, not a claim link's already-clean code).

CONTAINERS page (containers/page.tsx): apply the SAME pattern with its own state setters — setEditingContainer(null), setFormShortCode(searchParams.get("short_code") ?? ""), whatever else openCreateDialog resets, then setDialogOpen(true), behind the same create === "1" one-shot guard.

CLAIM page (claim/[code]/page.tsx): It ALREADY emits the exact contract the two list pages now consume:
  - item:      /dashboard/items/new?short_code=${encodedCode}
  - location:  /dashboard/locations?create=1&short_code=${encodedCode}
  - container: /dashboard/containers?create=1&short_code=${encodedCode}
Do NOT change these URLs (they now match the consumers). UPDATE the stale build-time comment block (lines ~75-84) that says CreateItemWizard "does not yet read the short_code search param" and that the list pages do "NOT read a ?create / ?short_code param" — both statements are now false. Rewrite the comment to state the wiring is live: items/new reads ?short_code (+?barcode) and the locations/containers list pages auto-open + prefill their create dialog from ?create=1&short_code=. Keep the comment accurate and short.

TESTS: there is no existing claim-page test. If a next-intl + next/navigation vitest harness is trivially available in this repo, add ONE small unit test asserting the claim page's create targets contain the expected create=1&short_code= / items/new?short_code= substrings for a given code. If wiring up next-intl/useRouter/useSearchParams mocks fights back, SKIP the test (per constraints) and rely on tsc/build + the verify greps below — do not invent a heavy harness.
  </action>
  <verify>
    <automated>cd /home/antti/Repos/Misc/home-warehouse-system/frontend && grep -q 'create=1&short_code' "app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx" && grep -q "useSearchParams" "app/[locale]/(dashboard)/dashboard/locations/page.tsx" && grep -q "useSearchParams" "app/[locale]/(dashboard)/dashboard/containers/page.tsx" && bunx tsc -b --noEmit</automated>
  </verify>
  <done>locations/page.tsx and containers/page.tsx each read useSearchParams, auto-open their create dialog when create=1, and prefill formShortCode from short_code (verbatim, no extractScanCode); the claim page still emits create=1&short_code= / items/new?short_code= and its build-time comment is updated to reflect live wiring; typecheck passes. Manual: visiting each ?create=1&short_code=c7a4f9e1 link opens the dialog with the code prefilled.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser URL query -> frontend create surfaces | scanning user (or a crafted link) supplies short_code / barcode / create flag |
| frontend -> Postgres (resolver) | short_code + workspace-id set cross into the SQL resolver |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vdf-01 | Tampering/Injection | ShortlinkRepository.Resolve SQL | mitigate | Already parameterized ($1 code, $2 uuid[]); the integration test's cross-workspace subtest asserts ANY($2) actually scopes, guarding T-uzt-02 from regression. No new query added. |
| T-vdf-02 | Information disclosure (cross-tenant) | resolver workspace scoping | mitigate | Subtest 5 proves a code in wsB is invisible to a wsA-scoped query; locks the cross-tenant guarantee at the real-DB layer. |
| T-vdf-03 | Injection/XSS | items/new + list-page prefill from query params | accept | short_code/barcode flow into controlled react-hook-form fields and React-escaped inputs (not dangerouslySetInnerHTML); server enforces VARCHAR(8) + per-workspace uniqueness on create. Values are not echoed into raw HTML. Low risk, no extra mitigation beyond existing escaping. |
| T-vdf-SC | Tampering | npm/pip/cargo installs | mitigate | No new packages added (frontend reuses next/navigation + existing forms; backend reuses testify + pgx already in go.sum). No legitimacy checkpoint required. |
</threat_model>

<verification>
- Backend default lane stays fast and green: `cd backend && go build ./... && go test ./...` (no integration tag) — new file invisible, zero new failures.
- Backend integration lane (manual, needs live Postgres): `cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration -count=1 ./internal/infra/postgres/... -run Shortlink -v` — six subtests pass.
- Frontend typechecks: `cd frontend && bunx tsc -b --noEmit`.
- Frontend build (if cheap): `cd frontend && bun run build`.
- Contract greps: claim page emits create=1&short_code= and items/new?short_code=; both list pages and items/new read useSearchParams.
</verification>

<success_criteria>
- New integration test exists with //go:build integration first line, uses testdb.SetupTestDB + testdb.CreateTestWorkspace, and covers item/container/location match, item-first priority, cross-workspace scoping, and the empty/sentinel not-found case.
- Plain go test ./... does not see the integration test (default CI lane unchanged).
- items/new prefills short_code (and barcode) from the URL via defaultValues.
- locations and containers list pages auto-open + prefill their create dialog from ?create=1&short_code=.
- Claim page targets match the consumers and its stale wiring comment is corrected.
- Typecheck (and build) pass; no new libraries; locked decisions untouched.
</success_criteria>

<output>
Create `.planning/quick/260607-vdf-finish-s-go-shortlink-wiring-claim-page-/260607-vdf-SUMMARY.md` when done.
</output>
