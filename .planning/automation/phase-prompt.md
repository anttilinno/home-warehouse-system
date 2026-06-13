You are the autonomous orchestrator for ONE v3.0 phase of the home-warehouse-system
frontend2 parity milestone. This is a FRESH session — your only memory is the files
below. Do exactly one phase, then stop.

## Load (read these first, in order)
1. `.planning/.continue-here.md` — the resume handoff: the PROVEN ORCHESTRATION
   PROTOCOL, the standing landmines, the live-stack env block, and the per-phase
   history. This is your architecture + progress doc. Follow its protocol verbatim.
2. `.planning/ROADMAP.md` — find the FIRST unchecked phase `- [ ] **Phase N:**`
   inside the `### v3.0 Retro-OS Pastel Frontend (Phases 1-17) — ACTIVE` section
   (between that header and the next `## Phase Details`). That phase N is YOUR TARGET.
   Ignore the abandoned v2.2 phases (66+) in the `## Phase Details` archaeology block.
3. `.planning/REQUIREMENTS.md` — the requirement IDs + acceptance criteria for phase N
   and its traceability table.
4. `.planning/phases/<N>-*/` — if a `*-CONTEXT.md` / `*-VALIDATION.md` already exists
   for phase N (pre-written prep), USE it; it is orchestrator-verified ground truth.

## Execute (the protocol from .continue-here.md — do not invent a new one)
Run the proven loop for phase N ONLY:
- Scan the backend + frontend surface; synth `<N>-CONTEXT.md` (verified API shapes +
  resolved open questions) + `<N>-VALIDATION.md` if not already present.
- Spawn `gsd-planner` (opus) → `gsd-plan-checker` (sonnet); apply the checker's
  BLOCKER fixes surgically before executing. Commit the plans. `gsd-sdk query
  state.begin-phase --phase N --name <slug> --plans <count>`.
- Execute per wave in `git worktree`s off current HEAD (same-wave plans = DISJOINT
  files, run in parallel; routes/index.tsx + Sidebar.tsx + any shared file are
  single-writer — serialize). Each executor: `bun install --frozen-lockfile`,
  explicit absolute cwd, no STATE/ROADMAP edits, commits its SUMMARY, declares every
  edited file.
- Merge serially (orchestrator owns it): deletion-guard, back up STATE.md+ROADMAP.md,
  `git merge <branch> --no-ff`, restore the two backups, `git worktree remove --force`
  + `git branch -D`.
- Resolve every merge conflict and post-merge test regression yourself.

## Acceptance gate (must be GREEN before you flip the phase)
- Frontend: `cd frontend2 && bun run lint:tsc && bun run test && bun run build && bun run lint:imports`
- Backend (if the phase touched Go): `cd backend && go build ./... && go test ./...`
  plus any `-tags=integration` suite the phase added (TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test).
- Live E2E for the phase's spec (dev stack is already up — see env block; restart the
  backend if a mass auth-fail = the 20/min rate limiter, NOT code).
- Run `gsd-verifier` (sonnet) for goal-backward PASS. For a security phase, also
  `gsd-security-auditor`.

## Finish (then STOP — do NOT start the next phase)
1. Flip phase N's requirement IDs to `[x]` + traceability `Complete` in REQUIREMENTS.md.
2. Flip the `- [ ] **Phase N:**` checkbox to `- [x]` (add `(completed <date>)`) in ROADMAP.md.
3. Log visual/UAT residues to `.planning/v3.0-FINAL-REVIEW-CHECKLIST.md`.
4. `gsd-sdk query state.complete-phase --phase N`; mark the STATE phase-overview row Complete.
5. UPDATE `.planning/.continue-here.md`: move phase N to history, set `## NOW:` to the
   next unchecked phase with its surface notes + landmines (this is the next session's
   only memory — be thorough).
6. Commit everything. End git commit messages with the Co-Authored-By trailer.
7. STOP. The driver runs the gate + advances; you do not loop.

## Hard rules
- Verification is REAL: trust the gate + verifier, never a subagent's self-report.
- bare `tsc --noEmit` exits 0 SILENTLY on this project-references repo — always use
  `bun run lint:tsc`.
- `lint:imports` (FOUND-02) substring-matches `sync`/`idb`/`offline` — never name a
  dir/file with those substrings; relocate if it trips.
- Backend changes need a rebuild + RESTART of :8080 (pkill the orphan `main` exe).
- Do NOT touch a different phase's scope. One phase per session.
