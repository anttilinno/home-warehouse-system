# SonarQube Remediation Plan

Addresses every issue from the 2026-06-16 scan: **frontend 320 + backend 301
= 621 issues**, plus **5 security hotspots**. See [FRONTEND.md](FRONTEND.md) /
[BACKEND.md](BACKEND.md) for the full per-file lists this plan references.

Both projects already pass the default quality gate. Goal here is to drive
issues toward 0, lift Reliability (FE B, BE C) and Security-Review (both E) to
A, and wire CI guards so nothing regresses.

## Strategy

Issues cluster hard by rule — 6 rules cover all 301 backend issues, ~15 cover
the frontend. So "fix all" is really ~10 workstreams, not 621 edits. Ordered by
**ROI and ascending risk**: hotspots + ratings first (tiny effort, big rating
gain), mechanical bulk next (safe), complexity refactors last (risky,
test-gated).

Rule → effort/risk legend: 🟢 mechanical/auto-fixable · 🟡 manual but bounded ·
🔴 refactor, must be test-gated.

| Phase | Scope | Issues | Risk | Why this order |
|-------|-------|--------|------|----------------|
| 0 | Security hotspot triage | 5 hotspots | 🟢🟡 | Clears Security-Review E→A on both, ~1h |
| 1 | FE a11y cluster | 15 bugs + 28 smells | 🟡 | Clears all FE bugs → Reliability B→A |
| 2 | FE mechanical auto-fixes | ~197 smells | 🟢 | Huge count, near-zero risk |
| 3 | FE remaining smells | ~60 smells | 🟡 | Nested ternaries, deprecated APIs, 3 CRITICAL |
| 4 | BE string-literal constants | 111 | 🟢 | Mechanical, biggest BE bucket |
| 5 | BE too-many-params | 39 | 🟡 | Constructor param-structs |
| 6 | BE identical-impl dedup | 50 | 🟢 | Mostly test helpers |
| 7 | BE cognitive-complexity refactor | 92 | 🔴 | The real work; test-gated |
| 8 | BE cleanup (TODOs + 1 bug) | 9 | 🟢 | TODO triage + branch-logic bug |
| 9 | Re-scan + CI guards + coverage | — | 🟢 | Lock it in |

---

## Phase 0 — Security hotspot triage (5) 🟢🟡

Both projects show **Security-Review E** purely from un-triaged (`TO_REVIEW`)
hotspots — Security rating itself is A (zero real vulns). Triaging these five is
the single highest-ROI action.

**Frontend (3):**
- `src/features/settings/RegionalFormatsPage.tsx:96` — `S5852` ReDoS regex.
  Audit for catastrophic backtracking; bound input length or rewrite to a
  linear pattern (avoid nested quantifiers `(a+)+`). Then mark reviewed.
- `src/lib/format/tokens.ts:76` — `S5852` ReDoS regex. Same treatment.
- `src/components/retro/filters/useSavedFilters.ts:88` — `S2245` insecure PRNG.
  If `Math.random()` generates a filter ID/key → switch to
  `crypto.randomUUID()`. If purely cosmetic → mark SAFE with justification.

**Backend (2) — `backend/Dockerfile`:**
- `Dockerfile:10` — `S6470` recursive `COPY`. Scope the COPY to required paths
  and/or add a `.dockerignore` excluding secrets/`.env`/`.git`. Mark reviewed.
- `Dockerfile:43` — `S6471` runs as root. Add a non-root `USER` (create an
  unprivileged user, `chown` the app dir, drop to it). Verify container still
  boots + serves :8080.

**Verify:** re-scan → hotspots `TO_REVIEW` = 0; Security-Review rating A on both.

---

## Phase 1 — Frontend a11y cluster 🟡 (clears all 15 bugs)

**All 15 FE "bugs" are `typescript:S1082`** — visible non-interactive elements
with a click handler but no keyboard listener. Fixing this group flips
Reliability **B→A** and aligns with the Phase-17 axe-playwright CI sweep.

Rules in scope (43 issues): `S1082` (15, bugs) + `S6848` (10) + `S6847` (6) +
`S6819` (12).

Files (from raw): `Bottombar.tsx`, `LogoutConfirm.tsx`, `MobileDrawer.tsx`,
`RetroTree.tsx`, `Popover.tsx`, `RetroDialog.tsx`, `CommandPalette.tsx`,
`PhotoLightbox.tsx`, `LoanRowActions.tsx`.

**Approach:**
- Clickable `<div>`/`<span>` → either a real `<button>` (preferred) or add
  `role` + `tabIndex={0}` + `onKeyDown` (Enter/Space) alongside `onClick`.
- `S6819`: replace `role="dialog"` hand-rolls with the native `<dialog>`
  element where the overlay primitives allow (RetroDialog, Popover).
- `S6847`: remove listeners from elements that should not be interactive, or
  promote them to interactive.

**Verify:** `bun run test`, axe-playwright sweep, manual Tab/Enter/Esc on each
overlay. Risk medium — touches interaction; keep existing keyboard behavior.

---

## Phase 2 — Frontend mechanical auto-fixes 🟢 (~197)

Safe, largely Sonar/biome quick-fixable. Batch by rule, one commit per rule,
`tsc` + `biome` + `vitest` green after each.

| Rule | Count | Fix |
|------|-------|-----|
| `S6759` | 127 | Mark React component `props` (and destructured prop types) `readonly`. |
| `S7764` | 33 | `window.*` → `globalThis.*` (guard SSR-N/A cases). |
| `S4325` | 12 | Remove no-op type assertions. |
| `S7735` | 8 | Invert unexpectedly-negated conditions. |
| `S6582` | 6 | Manual null checks → optional chaining `?.`. |
| `S7776` | 5 | Array membership → `Set.has()`. |
| `S7762` | 3 | `parent.removeChild(x)` → `x.remove()`. |
| `S1444` | 3 | `public static` field → `readonly`. |

`S6759` alone is ~40% of all FE issues — do it first, likely one scripted pass.

**Verify:** `bun run typecheck && bun run lint && bun run test`.

---

## Phase 3 — Frontend remaining smells 🟡 (~60)

| Rule | Count | Fix |
|------|-------|-----|
| `S3358` | 36 | Extract nested ternaries into `if`/helper/lookup. |
| `S1874` | 19 | Replace deprecated APIs (e.g. deprecated `FormEvent`). |
| `S6551` | 5 | Objects stringifying to `[object Object]` — provide explicit string. |
| `S3776`/`S2004` | 3 | The 3 CRITICALs: `RetroTree.tsx:120` (cc 18), `CommandPalette.tsx:123` (nesting >4), `InlineEditCell.tsx:46` (cc 16). Extract helpers to get under 15 / ≤4 nesting. |

**Verify:** typecheck + lint + test; the 3 CRITICALs need a component test pass.

---

## Phase 4 — Backend string-literal constants 🟢 (111 · `go:S1192`)

Each literal repeated ≥3× → named constant. Dominated by cross-handler repeats:
`"workspace context required"` (~100× across ~20 handlers), `"authentication
required"`, `"... not found"` messages, and route patterns (`"/items/{id}"` etc).

**Approach:**
- Shared error strings → consts in the `shared` package (e.g.
  `shared.MsgWorkspaceContextRequired`, `MsgAuthRequired`) reused everywhere.
- Per-package: route patterns and entity-specific messages → package-level
  `const` block at top of each handler.
- MIME types (`image/jpeg|png|webp`, `Content-Type`) → shared consts.

Full file:line list in [BACKEND.md §5](BACKEND.md). Mechanical; can be
agent-batched per package (independent files).

**Verify:** `cd backend && go build ./... && go test ./...`.

---

## Phase 5 — Backend too-many-params 🟡 (39 · `go:S107`)

Almost all are `NewXxx` constructors in `*/entity.go` (>7 params). 38 entity
constructors + `pendingchange/service.go:91` + `repairphoto/service.go:104`.

**Approach:** introduce a params/options struct per constructor
(`NewItem(p ItemParams)`), or functional options for the widest ones. Update
callers. If a constructor is deliberately wide and internal-only, a documented
`//nolint`-equivalent suppression is acceptable — but prefer the struct.

**Verify:** build + full test (caller churn is the risk).

---

## Phase 6 — Backend identical-implementations 🟢 (50 · `go:S4144`)

Mostly `*_test.go` (identical test-setup/assert blocks in `jobs/`, `loan/`,
`repairlog/`, `label/`, `location/`, `item/` test files). A handful in non-test
code.

**Approach:** extract shared test helpers (table-driven or a common
`setupXxx(t)` helper); consolidate duplicate production methods where they are
genuinely identical (verify they should not diverge before merging).

**Verify:** `go test ./...` — behavior must be unchanged.

---

## Phase 7 — Backend cognitive-complexity refactor 🔴 (92 · `go:S3776`)

The real work and the only HIGH-risk phase. Worst offenders:

| File:Line | Cognitive Complexity |
|-----------|----------------------|
| `item/handler.go:78` | **148** |
| `loan/handler.go:170` | **114** |
| `repairlog/handler.go:17` | **108** |
| `pendingchange/handler.go:24` | **104** |
| `worker/import_worker.go:619` | **83** |
| `category/handler.go:16` | 70 |
| `maintenance/handler.go:17` | 71 |
| `location/handler.go:17` · `company/handler.go:17` | 67 |
| `itemphoto/handler.go:34` | 66 |
| … (full list in [BACKEND.md §5](BACKEND.md)) | |

**Pattern:** the worst offenders are route-**registration** funcs — one giant
`func RegisterRoutes` per handler that inlines every `huma.Register` +
closure. Split into one `registerXxx(api, h)` helper per route (or per CRUD
group). Service-layer offenders (`sync/service.go:52` cc 60,
`importexport/service.go:413` cc 51, `imageprocessor/processor.go:76` cc 47)
get step-extraction into named sub-functions.

**Discipline:** several offenders (esp. `*_test.go` entries) lack tight tests.
For each non-trivial refactor, add/confirm a characterization test FIRST, then
refactor under green. Do the monsters (148/114/108/104/83) as individual,
reviewed commits; batch the small (16→15) ones.

**Verify:** `go test ./... && go test -tags=integration ./...`; re-scan to
confirm each function ≤15.

---

## Phase 8 — Backend cleanup 🟢 (9)

- `go:S3923` (1 BUG) — `tests/integration/workspace_test.go:25`: a conditional
  whose branches are identical. Fix the logic (the real branch was likely
  dropped) or collapse the condition.
- `go:S1135` (8 TODOs) — `workspace_restore.go`, `paperless/service.go`,
  `inventory/service.go`, `item_repository.go`, + 4 integration-test files.
  Resolve each, or convert to a tracked roadmap/backlog item and remove the
  inline TODO.

**Verify:** build + test.

---

## Phase 9 — Re-scan, coverage, CI guards 🟢

1. **Re-scan** both projects (see [README.md](README.md) reproduce steps);
   confirm issues → 0 (or explicitly triaged) and ratings all A.
2. **Import coverage** so the 0% becomes real: scan with
   `sonar.javascript.lcov.reportPaths` (Vitest `coverage/lcov.info`) and
   `sonar.go.coverage.reportPaths` (`go test -coverprofile=coverage.out`).
3. **Prevent regression without a Sonar server** — wire the equivalent linters
   into existing CI so issues can't silently return:
   - Go (`golangci-lint`): `goconst` (=S1192), `gocognit`/`gocyclo` (=S3776),
     `dupl` (=S4144), `funlen`/`maintidx`, `gosec`.
   - FE (biome/eslint): sonar-equivalent a11y + complexity rules; keep the
     axe-playwright sweep from Phase 17.

---

## Effort

Sonar's own debt estimate: FE ~27h + BE ~80h ≈ **107h**, but that assumes
manual edits. Realistic split:
- Phases 0,2,4,6,8 (mechanical/scripted/agent-batched): a few hours each.
- Phases 1,3,5 (bounded manual): ~1–2 days each.
- **Phase 7 is the long pole** — the five 80+ complexity funcs alone are
  multi-day, test-gated work.

Suggest executing Phases 0–6 + 8 as fast mechanical sweeps (parallel agents per
package), then Phase 7 deliberately. Want me to start — and if so, run it
through GSD as a tracked phase, or execute the mechanical phases directly?
