---
phase: 65-item-lookup-and-not-found-flow
plan: 02
subsystem: api
tags: [api, lookup, workspace-guard, barcode-schema, brand-field, security, zod, vitest]

requires:
  - phase: 65-item-lookup-and-not-found-flow
    provides: "Plan 65-01 Wave 0 scaffolds at items.lookupByBarcode.test.ts (5 it.todo) and schemas.test.ts (5 it.todo) — this plan converts them to real green it() blocks in tandem with the production code landing"
  - phase: 64-scanner-foundation-scan-page
    provides: "Structured console.error({ kind, ... }) observability pattern (D-12) that this plan extends with kind: scan-workspace-mismatch"
provides:
  - "itemsApi.lookupByBarcode(wsId, code) helper with D-06 (wraps list) + D-07 (case-sensitive exact-barcode guard) + D-08 (workspace_id defense-in-depth + structured console.error) guards inlined"
  - "itemCreateSchema D-24: barcode regex loosened from /^[A-Za-z0-9]+$/ to /^[A-Za-z0-9\\-_]+$/ — real Code128 scans (e.g. TEST-CODE-123) now pass zod"
  - "itemCreateSchema D-23: first-class optional brand field (z.string().max(120).optional()) — UpcSuggestionBanner BRAND [USE] can setValue('brand', ...) without description-concatenation workaround"
  - "6 real it() blocks in items.lookupByBarcode.test.ts (5 behavioral + 1 import-smoke) replacing Plan 65-01 scaffold todos"
  - "7 real it() blocks in schemas.test.ts (1 tripwire + 5 converted + 1 max-120 regression) replacing Plan 65-01 scaffold todos"
affects: ["65-04", "65-05", "65-06", "65-07", "65-08"]

tech-stack:
  added: []
  patterns:
    - "Guards-inlined API helper: workspace-scoping + exact-match guards live inside the API domain method so every future caller inherits them automatically (useScanLookup in Plan 65-04 cannot forget them)"
    - "Phase 64 D-12 structured-log vocabulary extended: new `kind: scan-workspace-mismatch` tag joins existing `kind` vocabulary (permission-denied, no-camera, library-init-fail, unsupported-browser)"

key-files:
  created: []
  modified:
    - "frontend2/src/lib/api/items.ts — appended lookupByBarcode method (22 lines inside itemsApi object literal, after delete:)"
    - "frontend2/src/features/items/forms/schemas.ts — barcode regex loosened + new optional brand field + updated doc comment"
    - "frontend2/src/lib/api/__tests__/items.lookupByBarcode.test.ts — 5 it.todo → 5 real it() + afterEach vi.restoreAllMocks teardown"
    - "frontend2/src/features/items/forms/__tests__/schemas.test.ts — 5 it.todo → 5 real it() + 1 new max-120 brand cap regression (6 new real it blocks)"
    - "frontend2/src/features/items/__tests__/schemas.test.ts — Rule 1 auto-fix: pre-existing Phase 60 \"rejects barcode with punctuation\" test used `123-456` which is now valid under D-24; switched to `123/456` (still forbidden) to preserve the test's intent (reject non-pattern chars)"

key-decisions:
  - "Kept existing ItemForm submit-payload field list unchanged (name/sku/barcode/description/category_id). Plan 65-05 Task 1 extends the form to include brand in the RHF payload. This plan only widens the zod schema so brand is accepted by safeParse — no UI wiring yet (task boundary held per plan)"
  - "Used `.or(z.literal(''))` on the new brand field to match the existing optional-string convention on description / category_id / barcode. The ItemForm resolver wrapper (items/forms/ItemForm.tsx) coerces `''` → `undefined` before zod runs so empty controlled inputs don't produce a max-length error — mirroring the pre-existing pattern"
  - "Committed the GREEN feat(65-02) item-api phase together with the Rule 1 auto-fix to the Phase 60 schemas.test.ts (pre-existing `barcode: 123-456` rejection test). The fix and the schema change are logically the same scope change — separating them would have left master in a transient failing state between the RED and GREEN commits for Phase 60's test file"

patterns-established:
  - "Inlined-guards API helper: new API-domain methods whose correctness hinges on frontend-side invariants (workspace scoping, exact-match) bake those guards into the helper body with explicit comments (D-06/D-07/D-08), not into each caller — prevents drift"
  - "Nyquist Wave 0 scaffold-to-real pipeline: Plan 65-01 scaffolded 5 + 5 = 10 it.todo across two files; Plan 65-02 converted all 10 to real it() blocks in two RED→GREEN TDD cycles, extending with 1 new regression (max-120 brand cap)"

requirements-completed: [LOOK-01, LOOK-02]
# LOOK-01 (frontend guard layer): itemsApi.lookupByBarcode enforces D-07 + D-08
#   so every downstream caller inherits the guards (core LOOK-01 helper lands).
# LOOK-02 (schema pre-condition): scans with hyphens can be saved on /items/new
#   without a zod rejection (D-24); brand pre-fill will have a target field
#   (D-23). Route + page wiring remains Plans 65-05 + 65-07.
# LOOK-03 (UPC enrichment) is handled by Plan 65-03 + 65-05 — NOT this plan.

# Metrics
duration: 6min
completed: 2026-04-19
---

# Phase 65 Plan 02: Item Lookup & Not-Found Flow — itemsApi.lookupByBarcode + D-23/D-24 Schema Update Summary

**itemsApi.lookupByBarcode with three inlined guards (D-06 wraps list, D-07 case-sensitive exact match, D-08 workspace_id defense + structured console.error) lands alongside two user-locked schema scope additions (D-23 optional brand field max-120, D-24 barcode regex loosened to accept hyphens and underscores) — every future lookup caller inherits the workspace-scoping + exact-match contract, real Code128 scans now pass zod on `/items/new`, and UpcSuggestionBanner's BRAND [USE] will write to a first-class field instead of concatenating into description.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-19T12:30:00Z (approx)
- **Completed:** 2026-04-19T12:35:00Z (approx)
- **Tasks:** 2 / 2 (both TDD with RED + GREEN commits each)
- **Files modified:** 5 (2 production + 3 test)
- **Files created:** 0

## Accomplishments

- Added `itemsApi.lookupByBarcode(wsId, code): Promise<Item | null>` to `frontend2/src/lib/api/items.ts` with D-06/D-07/D-08 guards inlined; 6 real it() blocks in `items.lookupByBarcode.test.ts` green (5 behavioral + 1 import-smoke) replacing the Plan 65-01 scaffold todos.
- Applied D-24 barcode regex loosening (`/^[A-Za-z0-9]+$/` → `/^[A-Za-z0-9\-_]+$/`) in `frontend2/src/features/items/forms/schemas.ts`; real Code128 scans like `TEST-CODE-123` and `HIST-01` now pass zod on the future `/items/new` page.
- Applied D-23 first-class optional `brand: z.string().max(120).optional().or(z.literal(''))` field so Plan 65-05's `UpcSuggestionBanner` BRAND [USE] chip can `setValue("brand", ...)` directly per D-14 (no description-concatenation workaround).
- Extended `schemas.test.ts` by 1 regression beyond the scaffold: asserts `brand.repeat(121)` fails — locks the D-23 max-120 cap (threat T-65-02-04 mitigation).
- All 5 new D-07/D-08 test cases fail under `lookupByBarcode is not a function` in the RED commit; all 5 turn green after the GREEN commit — canonical TDD cycle per plan.
- Fixed pre-existing Phase 60 `schemas.test.ts` test (Rule 1 auto-fix — intentional D-24 scope change made `barcode: "123-456"` valid; switched the assertion to `barcode: "123/456"` which is still forbidden to preserve the test's intent of "rejects non-pattern chars").

## Task Commits

Each task ran TDD cycles with separate RED + GREEN commits:

1. **Task 1 RED: Convert schemas.test.ts scaffolded todos** — `0163440` (test)
2. **Task 1 GREEN: Apply D-23 + D-24 schema changes** — `534b546` (feat)
3. **Task 2 RED: Convert items.lookupByBarcode.test.ts scaffolded todos** — `d9d5d42` (test)
4. **Task 2 GREEN: Add itemsApi.lookupByBarcode + Rule 1 auto-fix for Phase 60 schemas.test.ts** — `9a49e68` (feat)

## Files Created/Modified

### Modified (5)

**Production (2):**

- `frontend2/src/lib/api/items.ts` — Appended `lookupByBarcode: async (wsId, code) => { ... }` method inside the `itemsApi` object literal after the `delete:` entry (line 95, between lines 96 and the pre-existing closing `};`). +22 lines total (method body + doc comment). Diff range approximately lines 96–117 in the post-edit file.
- `frontend2/src/features/items/forms/schemas.ts` — Schema doc comment updated to document D-23/D-24 under the "Field caps" header. Changed:
  - Barcode: `.regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only.")` → `.regex(/^[A-Za-z0-9\-_]+$/, "Use letters, numbers, hyphens, or underscores only.")`
  - New field inserted between `barcode` and `description`: `brand: z.string().max(120, "Must be 120 characters or fewer.").optional().or(z.literal(""))`
  - Net diff: +14 / -4 lines.

**Tests (3):**

- `frontend2/src/lib/api/__tests__/items.lookupByBarcode.test.ts` — 5 `it.todo(...)` entries converted to real `it(..., async () => { ... })` blocks using `vi.spyOn(itemsApi, "list").mockResolvedValue(...)` per `itemPhotos.test.ts`'s spy-on-method idiom. Added `afterEach(() => vi.restoreAllMocks())` teardown. Kept the 1 import-smoke green test. +114 / −15 lines.
- `frontend2/src/features/items/forms/__tests__/schemas.test.ts` — 5 `it.todo(...)` entries converted to real `it(..., () => { ... })` blocks. Added 1 net-new regression test for the D-23 max-120 cap (`brand: "A".repeat(121)` must reject). Kept the 1 regression tripwire (`barcode: "has space"` must still reject after D-24). +76 / −16 lines.
- `frontend2/src/features/items/__tests__/schemas.test.ts` — **Rule 1 auto-fix** (not part of the scaffold conversion). Pre-existing Phase 60 test `"rejects barcode with punctuation"` used `barcode: "123-456"` as the forbidden example; D-24 legalizes hyphens. Switched to `barcode: "123/456"` (still forbidden) and renamed the test to `"rejects barcode with forbidden punctuation (space/slash/dot)"` with a comment explaining D-24. Preserves the test's intent (reject non-pattern chars) while respecting the intentional scope change.

### Schema regex before/after + brand field insertion

Before (lines 31–36 of schemas.ts, Phase 60 baseline):

```ts
barcode: z
  .string()
  .max(64, "Must be 64 characters or fewer.")
  .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only.")
  .optional()
  .or(z.literal("")),
```

After (lines 33–43 of schemas.ts, Phase 65 Plan 02):

```ts
barcode: z
  .string()
  .max(64, "Must be 64 characters or fewer.")
  .regex(/^[A-Za-z0-9\-_]+$/, "Use letters, numbers, hyphens, or underscores only.")
  .optional()
  .or(z.literal("")),
brand: z
  .string()
  .max(120, "Must be 120 characters or fewer.")
  .optional()
  .or(z.literal("")),
```

## Decisions Made

- **Did NOT wire brand through ItemForm submit payload in this plan.** ItemForm currently hard-enumerates `{ name, sku, barcode, description, category_id }` in both its resolver wrapper (line 30) and submit coercion (line 96). Adding brand to those two call sites is Plan 65-05 Task 1's job per the plan's `<out-of-scope>` note. This plan only widens the zod schema so `safeParse({ ..., brand: "Coca-Cola" })` succeeds — exactly what Plan 65-05 will need when it adds the `RetroFormField name="brand"` and wires `setValue("brand", ...)` from `UpcSuggestionBanner`.
- **Committed the GREEN lookupByBarcode feat commit with the Phase 60 schemas.test.ts Rule 1 auto-fix bundled.** Separating them would have left master in a transient state where the full vitest suite was red between commits (D-24 broke `barcode: "123-456"` rejection assertion). Since the fix is a direct auto-consequence of the intentional D-24 scope change, they belong in the same logical commit.
- **Used positional `.or(z.literal(""))` on brand to match the existing optional-string convention.** The ItemForm resolver (line 28) coerces `v.barcode === "" ? undefined : v.barcode` before zod runs, so the `.or(z.literal(""))` branch only fires if some downstream caller bypasses the resolver. Plan 65-05 will add `brand: v.brand === "" ? undefined : v.brand` to the resolver wrapper; doing it now would be scope creep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing Phase 60 test used `123-456` which is now legal under D-24**

- **Found during:** Task 2 Step C (post-GREEN full suite run)
- **Issue:** `frontend2/src/features/items/__tests__/schemas.test.ts` (Phase 60 file, NOT the scaffold at `frontend2/src/features/items/forms/__tests__/schemas.test.ts`) contains a test `"rejects barcode with punctuation"` that asserts `itemCreateSchema.safeParse({ ..., barcode: "123-456" }).success === false`. Under D-24 this is now a valid barcode, so the test fails on the GREEN commit.
- **Fix:** Changed the test input to `barcode: "123/456"` (forward slash is still forbidden under `/^[A-Za-z0-9\-_]+$/`). Renamed the test to `"rejects barcode with forbidden punctuation (space/slash/dot)"` and added a comment explaining the D-24 change. Preserves the test's original intent (reject non-pattern chars) without weakening coverage — spaces and slashes are both still rejected by the new regex.
- **Files modified:** `frontend2/src/features/items/__tests__/schemas.test.ts`
- **Verification:** `bunx vitest run src/features/items/__tests__/schemas.test.ts` all 7 tests green post-fix; full suite `bunx vitest run` 640 passed / 50 todos / 0 failed.
- **Committed in:** `9a49e68` (Task 2 GREEN commit — bundled with the production feat so master stays green between commits)

---

**Total deviations:** 1 auto-fixed (Rule 1 — pre-existing test rendered invalid by intentional D-24 scope change).
**Impact on plan:** Zero scope creep. The fix is a direct consequence of D-24 which is user-locked in 65-CONTEXT.md. No unplanned functional changes; test coverage is preserved (space + slash + dot all still forbidden).

## Issues Encountered

- **TypeScript build excludes test files:** `frontend2/tsconfig.app.json` has `"exclude": ["src/**/__tests__/**", "src/**/*.test.*"]`, so `bunx tsc -b --noEmit` does NOT catch the "property `lookupByBarcode` does not exist on itemsApi" error that the RED commit would otherwise raise at compile time. The RED signal was instead a runtime `TypeError: itemsApi.lookupByBarcode is not a function` under vitest — equivalent RED signal, different mechanism. Vitest itself uses its own esbuild transform which is permissive on missing-property access (returns `undefined`). Documented because it changes the RED expectation vs what the plan implied ("TypeScript compile error or runtime error"). No action needed — the runtime error IS the RED gate.

- **Parallel executor interleaved Plan 65-03 commits into the history during this plan's execution:** Git log between my RED and GREEN commits shows 65-03 commits (`156b114`, `164d7e2`, `b82b821`, `6127103`) appeared in-between — a parallel executor ran Plan 65-03 against the same main branch while this plan was executing. Verified my 65-02 commits (`0163440`, `534b546`, `d9d5d42`, `9a49e68`) are all present in the linearized history and the resulting working tree state is consistent (all 65-02 acceptance criteria hold, full suite green). No action taken — this is expected under sequential-on-main orchestration and the orchestrator is responsible for serializing if strictly needed.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 65-03 ready (already executed in parallel per git log):** `barcodeApi` + `barcodeKeys` + `useBarcodeEnrichment` hook with `/^\d{8,14}$/` regex gate and D-16 silent failure — independent of this plan's schema changes.
- **Plan 65-04 ready:** `useScanLookup` body swap can now call `itemsApi.lookupByBarcode(workspaceId, code)` and inherit D-06/D-07/D-08 guards automatically. No additional guard code needed in the hook.
- **Plan 65-05 ready:** `itemCreateSchema` has the `brand` field; `ItemForm` resolver + submit-coercion can now be extended to include `brand: v.brand === "" ? undefined : v.brand` and the BRAND [USE] chip in `UpcSuggestionBanner` can `setValue("brand", ...)` via `FormProvider` or callback.
- **Plan 65-07 ready:** `/items/new?barcode=TEST-CODE-123` will no longer zod-reject the barcode field (D-24 unblocks the LOOK-02 happy path for hyphenated Code128 codes).
- **Cumulative it.todo → real it() progression:** 5 API + 5 schema = 10 of Plan 65-01's 78 scaffold todos converted to real green tests by this plan. Plan 65-03 (already landed) handled `barcode.test.ts` (5 todos) + `useBarcodeEnrichment.test.ts` (13 todos); remaining to convert across Plans 65-04..65-07: 50 todos (18 ItemFormPage + 12 UpcSuggestionBanner + 20 ScanResultBanner.states). Total progress after this plan: 28/78 converted.

## Self-Check: PASSED

Verified all claims:

- [x] `frontend2/src/lib/api/items.ts` contains `lookupByBarcode: async (wsId: string, code: string)` at exactly one site (`grep -c` = 1).
- [x] `frontend2/src/lib/api/items.ts` contains `kind: "scan-workspace-mismatch"` at exactly one site (`grep -c` = 1).
- [x] `frontend2/src/features/items/forms/schemas.ts` contains `^  brand: z` at exactly one site (`grep -c` = 1).
- [x] `frontend2/src/features/items/forms/schemas.ts` contains the new regex `A-Za-z0-9\-_` — present in both the regex pattern AND the SKU field (existing); the barcode regex specifically replaced the old `/^[A-Za-z0-9]+$/` (old pattern not found: `grep -c "\"Use letters and numbers only\\.\"" = 0`).
- [x] `it.todo` count in `schemas.test.ts` (scaffold) = 0.
- [x] `it.todo` count in `items.lookupByBarcode.test.ts` = 0.
- [x] Real `it(` count in `schemas.test.ts` (scaffold) = 7 (1 tripwire + 5 converted + 1 max-120 regression).
- [x] Real `it(` count in `items.lookupByBarcode.test.ts` = 6 (5 behavioral + 1 import-smoke).
- [x] Commits `0163440`, `534b546`, `d9d5d42`, `9a49e68` all exist in `git log --oneline`.
- [x] `bunx vitest run src/lib/api/__tests__/items.lookupByBarcode.test.ts src/features/items/forms/__tests__/schemas.test.ts` — 13/13 green.
- [x] `bunx vitest run` full suite — 640 passed / 50 todos / 0 failed (the 50 remaining todos belong to Plans 65-04..65-07 scaffolds).
- [x] `bunx tsc -b --noEmit` — exit 0.
- [x] `bun run lint:imports` — PASS (no forbidden `idb` / `serwist` / `offline` / `sync` substrings introduced).

---

*Phase: 65-item-lookup-and-not-found-flow*
*Plan: 02*
*Completed: 2026-04-19*
