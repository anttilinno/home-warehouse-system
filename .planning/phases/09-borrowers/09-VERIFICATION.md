---
phase: 09-borrowers
verified: 2026-06-13T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 9: Borrowers Verification Report

**Phase Goal:** Deliver the full Borrowers CRUD surface (BORR-01..05) — list with search, create, detail (mounting Phase-8 panels), edit, and delete blocked while active loans exist.
**Verified:** 2026-06-13
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                      | Status     | Evidence (file:line)                                                                                                             |
|-----|--------------------------------------------------------------------------------------------|------------|----------------------------------------------------------------------------------------------------------------------------------|
| 1   | User can browse borrowers in a flat paginated list with client search + RetroPagination    | ✓ VERIFIED | `BorrowersListPage.tsx:1-206` + `useBorrowersQuery.ts:1-77`; single fetch limit=100, client filter, RetroPagination at line 189 |
| 2   | User can create a new borrower (name required, email optional+validated, omit-empty body)   | ✓ VERIFIED | `BorrowerFormPage.tsx:129-148`; schema name min(1) at `schema.ts:15`; omit-empty at lines 133-135                                |
| 3   | User can view a borrower detail page mounting Phase-8 BorrowerLoanPanels (not rebuilt)     | ✓ VERIFIED | `BorrowerDetailPage.tsx:16,219`; import from `@/features/loans/components/BorrowerLoanPanels`; panels not modified in Phase 9   |
| 4   | User can edit a borrower's profile (BorrowerFormPage edit mode via :id param)              | ✓ VERIFIED | `BorrowerFormPage.tsx:69-70`; `isEdit = Boolean(id)`; edit path fetches + reset() at lines 74-103                               |
| 5   | Delete blocked while active loans: red badge + disabled button + "View active loans" link  | ✓ VERIFIED | `BorrowerDetailPage.tsx:139,149-165,197-214`; reactive 400 backstop at `useBorrowerMutations.ts:68-75`                          |

**Score:** 5/5 truths verified

---

### Binding Overrides — All Verified by Code Read

**Override 1 — List pagination CLIENT-side (never reads `total`):**
- `useBorrowersQuery.ts:44-45`: `queryFn: () => borrowersApi.list(wsId, 1, FETCH_LIMIT)` — single fetch, page 1, limit=100.
- `borrowers.ts:4-5`: API type is `{ items: Borrower[] }` — no `total` field in the type; a `.total` read would be a TypeScript error.
- `useBorrowersQuery.ts:64-67`: pageCount and row-slicing computed entirely from `filtered.length` — zero server `total` involvement.

**Override 2 — Search CLIENT-filter (no `/borrowers/search` call from list page):**
- `BorrowersListPage.tsx:50-53`: `const [search, setSearch] = useState(""); useBorrowersQuery(search)` — passes search string into hook.
- `useBorrowersQuery.ts:54-62`: substring filter on `b.name` / `b.email` — no fetch inside the filter branch.
- `borrowers.ts:43-51`: `borrowersApi.search()` exists for picker use but is NOT called anywhere in the list path.

**Override 3 — Delete guard proactive AND reactive:**
- Proactive: `BorrowerDetailPage.tsx:57-58` calls `useBorrowerLoans` for `activeCount`; at line 139 `const blocked = activeCount > 0`; line 149 `<RetroBadge variant="danger">⚠ Active loans</RetroBadge>`; line 162 `disabled={blocked}`; line 209 `to="/loans?tab=active"`.
- Reactive: `useBorrowerMutations.ts:68-75` catches `HttpError` with `status === 400` and emits "Couldn't delete — this borrower has active loans." toast.

**Override 4 — Create/edit omit-empty body, name required, email format only when supplied:**
- `schema.ts:15`: `z.string().trim().min(1, { message: "Name is required." })`.
- `schema.ts:17-23`: email `.optional().default("").refine(v => !v || email().safeParse(v).success)`.
- `BorrowerFormPage.tsx:132-135`: body built as `{ name }` then `if (values.email) body.email = values.email` etc.

**Override 5 — BORR-03 MOUNTS Phase-8 BorrowerLoanPanels (not rebuilt):**
- `BorrowerDetailPage.tsx:16`: `import { BorrowerLoanPanels } from "@/features/loans/components/BorrowerLoanPanels"`.
- `BorrowerLoanPanels.tsx` last commit: `4b20d4c7 feat(08-05): BorrowerLoanPanels component (LOAN-06)` — no Phase-9 commit on that file.

**Override 6 — Route order: literal `new` before `:id`:**
- `routes/index.tsx:81-84` (in declaration order):
  1. `<Route path="borrowers/new" element={<BorrowerFormPage />} />`
  2. `<Route path="borrowers" element={<BorrowersListPage />} />`
  3. `<Route path="borrowers/:id/edit" element={<BorrowerFormPage />} />`
  4. `<Route path="borrowers/:id" element={<BorrowerDetailPage />} />`
- `borrowers/new` registered before `borrowers/:id` — correct.

---

### Required Artifacts

| Artifact                                              | Expected                        | Status     | Details                                                                 |
|-------------------------------------------------------|---------------------------------|------------|-------------------------------------------------------------------------|
| `src/features/borrowers/BorrowersListPage.tsx`        | BORR-01 list surface            | ✓ VERIFIED | 206 lines; FilterBar + RetroTable + RetroPagination; fully wired        |
| `src/features/borrowers/hooks/useBorrowersQuery.ts`   | BORR-01 query hook              | ✓ VERIFIED | 77 lines; client search + pagination; no total read; no /search call    |
| `src/features/borrowers/BorrowerFormPage.tsx`         | BORR-02 create + BORR-04 edit   | ✓ VERIFIED | 257 lines; isEdit mode; omit-empty body; zodResolver; dirty guard       |
| `src/features/borrowers/schema.ts`                    | BORR-02 validation              | ✓ VERIFIED | 31 lines; name required; email optional+format; omit-empty defaults     |
| `src/features/borrowers/BorrowerDetailPage.tsx`       | BORR-03 + BORR-05               | ✓ VERIFIED | 279 lines; BorrowerLoanPanels mounted; blocked badge+button+link        |
| `src/features/borrowers/hooks/useBorrowerMutations.ts`| BORR-02/04/05 mutations         | ✓ VERIFIED | 79 lines; create/update/del; 400 mapped; PREFIX invalidation            |
| `src/lib/api/borrowers.ts`                            | API layer                       | ✓ VERIFIED | Typed Borrower; bare `{ items }` envelope; no total; list/get/create/update/del |
| `src/routes/index.tsx`                                | All 4 routes registered         | ✓ VERIFIED | Lines 81-84; literal-before-param order correct                         |

---

### Key Link Verification

| From                     | To                          | Via                                                 | Status     | Detail                                               |
|--------------------------|-----------------------------|-----------------------------------------------------|------------|------------------------------------------------------|
| BorrowersListPage        | useBorrowersQuery           | import line 15-17                                   | ✓ WIRED    | hook called at line 52; rows/page/pageCount consumed |
| BorrowersListPage        | borrowersApi (indirect)     | via useBorrowersQuery → borrowersApi.list            | ✓ WIRED    | single fetch at query.ts:45                          |
| BorrowerFormPage         | useBorrowerMutations        | import line 26-28; create/update at lines 80-84     | ✓ WIRED    | mutateAsync called inside onSubmit                   |
| BorrowerFormPage         | borrowerFormSchema          | import line 21-24; zodResolver at line 93           | ✓ WIRED    | schema drives validation + parse on submit           |
| BorrowerDetailPage       | BorrowerLoanPanels (Phase 8)| import line 16; JSX at line 219                     | ✓ WIRED    | wsId + borrowerId props passed                       |
| BorrowerDetailPage       | useBorrowerLoans            | import line 17; called at line 57                   | ✓ WIRED    | activeCount derived at line 58                       |
| BorrowerDetailPage       | useBorrowerMutations        | import line 18; del.mutate at lines 60-62           | ✓ WIRED    | deleteBorrower called on confirm                     |
| useBorrowerMutations del | HttpError 400 reactive path | HttpError import line 8; err.status===400 at line 72| ✓ WIRED    | produces specific toast message                      |
| routes/index.tsx         | All 3 borrower page components | imports lines 20-22; routes lines 81-84           | ✓ WIRED    | literal-before-param order confirmed                 |

---

### Data-Flow Trace (Level 4)

| Artifact              | Data Variable     | Source                                     | Produces Real Data | Status      |
|-----------------------|-------------------|--------------------------------------------|-------------------|-------------|
| BorrowersListPage     | `rows`            | `useBorrowersQuery` → `borrowersApi.list`  | Yes — GET /workspaces/:ws/borrowers | ✓ FLOWING |
| BorrowerDetailPage    | `borrower`        | `borrowersApi.get` → GET /workspaces/:ws/borrowers/:id | Yes | ✓ FLOWING |
| BorrowerDetailPage    | `activeCount`     | `useBorrowerLoans` → shared RQ cache       | Yes — from BorrowerLoanPanels' same hook | ✓ FLOWING |
| BorrowerFormPage (edit)| form defaults    | `borrowersApi.get` → `reset(borrowerToDefaults(...))` | Yes | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — live backend required for API calls; cannot run without a running server. Gate-confirmed by orchestrator (642/642 unit tests pass, tsc clean, build clean, Playwright 2/2 pass).

---

### Requirements Coverage

| Requirement | Source Plan | Description                                          | Status      | Evidence                                               |
|-------------|------------|------------------------------------------------------|-------------|--------------------------------------------------------|
| BORR-01     | 09-01/02   | Flat paginated list + search + RetroPagination       | ✓ SATISFIED | BorrowersListPage.tsx + useBorrowersQuery.ts           |
| BORR-02     | 09-01/03   | Create borrower (name required, optional contact)    | ✓ SATISFIED | BorrowerFormPage.tsx create path + schema.ts           |
| BORR-03     | 09-03      | Detail page with Phase-8 BorrowerLoanPanels mounted  | ✓ SATISFIED | BorrowerDetailPage.tsx:16,219 + unmodified panels      |
| BORR-04     | 09-03      | Edit borrower profile                                | ✓ SATISFIED | BorrowerFormPage.tsx edit mode (isEdit=true)           |
| BORR-05     | 09-01/03   | Delete blocked while active loan: badge + link       | ✓ SATISFIED | BorrowerDetailPage.tsx:139-214 + useBorrowerMutations.ts:68-75 |

---

### Anti-Patterns Found

No `TBD`, `FIXME`, or `XXX` markers found in any Phase-9 file. No stub returns (`return null`, `return []`, `return {}`) in production paths. The `—` placeholder in the Loans column of BorrowersListPage is intentional and documented (OQ7 / binding override — live count lives on detail page, not in the list).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| BorrowersListPage.tsx | 168-170 | `<td className="text-fg-muted">—</td>` (Loans column) | INFO | Intentional per OQ7; live loan count on detail page, not in list |

---

### Human Verification Required

The following items are visual/interaction behaviors that cannot be verified by grep or static analysis:

#### 1. Delete Guard Visual State

**Test:** Log in, navigate to a borrower who has an active loan. Inspect the titlebar.
**Expected:** Red `⚠ Active loans` RetroBadge visible; DELETE… button visually disabled (greyed); danger banner with "View active loans" hyperlink renders below the profile dl.
**Why human:** CSS rendering of `disabled` + `variant="danger"` + link target cannot be verified without a browser.

#### 2. "View active loans" Link Routing

**Test:** Click the "View active loans" link in the delete-blocked banner.
**Expected:** Browser navigates to `/loans?tab=active` and the Loans page opens on the active tab.
**Why human:** Whether the LoansListPage actually reads `?tab=active` and activates the correct tab is a runtime behavior (LoansListPage tab state not verified in this phase scope).

#### 3. Dirty-Form Guard UX

**Test:** Open `/borrowers/new`, type a name, then click Cancel (or navigate away via browser back).
**Expected:** RetroConfirmDialog opens with "DISCARD CHANGES?" title; choosing "Discard" navigates away; choosing "Keep editing" stays.
**Why human:** `beforeunload` and dialog coordination require live browser interaction.

#### 4. Post-Create Navigation

**Test:** Create a new borrower. Observe the redirect after successful submit.
**Expected:** Browser navigates to `/borrowers/:newId` (the new borrower's detail page with the loan panels visible).
**Why human:** Requires live API returning a real id.

---

### Gaps Summary

No gaps. All five BORR requirements are implemented with substantive, wired, data-flowing code. All six binding overrides hold by direct code inspection. BorrowerLoanPanels.tsx was not modified during Phase 9 (last commit `4b20d4c7` is the Phase-8 feat commit). Four visual/interaction residues are non-blocking and flagged for human UAT above.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
