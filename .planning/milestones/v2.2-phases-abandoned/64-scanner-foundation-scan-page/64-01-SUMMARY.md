---
phase: 64
plan: 01
subsystem: scanner-foundation
tags: [wave-0, deps, retro-atom, tdd]
dependency_graph:
  requires: [phase-63-close]
  provides:
    - "@yudiel/react-qr-scanner@2.5.1 runtime dep"
    - "uuid@^13.0.0 runtime dep"
    - "@types/uuid@^11.0.0 devDep"
    - "HazardStripe.variant prop ('yellow' | 'red')"
    - "barcode-detector@3.0.8 transitive"
    - "zxing-wasm@2.2.4 transitive"
    - "webrtc-adapter@9.0.3 transitive"
  affects:
    - "All Wave 1..3 plans consuming scanner library or HazardStripe red variant"
tech_stack:
  added:
    - "@yudiel/react-qr-scanner@2.5.1 (exact pin, no caret — CONTEXT.md D-01)"
    - "uuid@^13.0.0"
    - "@types/uuid@^11.0.0 (devDep; upstream-deprecated, kept for parity)"
  patterns:
    - "TDD RED/GREEN for retro-atom prop additions"
    - "data-variant attribute as stable test hook"
    - "backward-compat default for new retro-atom props"
key_files:
  created: []
  modified:
    - "frontend2/package.json"
    - "frontend2/bun.lock"
    - "frontend2/src/components/retro/HazardStripe.tsx"
    - "frontend2/src/components/retro/__tests__/HazardStripe.test.tsx"
decisions:
  - "Exact pin for @yudiel/react-qr-scanner (no caret) — lockfile + CONTEXT.md D-01"
  - "Default variant='yellow' preserves backward-compat for every existing HazardStripe callsite"
  - "Red branch uses bg-retro-red token (already declared in globals.css); no new color token"
  - "data-variant attribute added for reliable test hook without class-name coupling"
  - "ios-haptics NOT installed (D-17 locked 2026-04-18)"
metrics:
  duration_seconds: 145
  duration_human: "~2.5 min"
  tasks_completed: 2
  files_modified: 4
  commits: 3
  tests_added: 3
  tests_total: 486
  completed_at: "2026-04-18T17:17:18Z"
---

# Phase 64 Plan 01: Wave 0 Deps + HazardStripe Variant Prop Summary

**One-liner:** Installed `@yudiel/react-qr-scanner@2.5.1`, `uuid@^13.0.0`, `@types/uuid@^11.0.0`, and extended the `HazardStripe` retro atom with a `variant: 'yellow' | 'red'` prop (default yellow) so the Phase 64 `ScanErrorPanel` library-init-fail panel can render a red hazard stripe — without adding any new retro atoms.

---

## What Was Built

### Task 1 — Scanner runtime deps (no ios-haptics per D-17)

`bun add` from `frontend2/`:

- `@yudiel/react-qr-scanner@2.5.1` (exact pin, no caret — CONTEXT.md D-01)
- `uuid@^13.0.0` (caret)
- `@types/uuid@^11.0.0` (caret, devDep)

`frontend2/package.json` delta is exactly three new entries (two runtime + one devDep). No `ios-haptics` installed (D-17 locks it out of Phase 64).

Transitive footprint (verified via `bun pm ls --all`, matches RESEARCH.md §Version verification):

| Package | Installed | Expected |
| --- | --- | --- |
| `barcode-detector` | `3.0.8` | `3.0.8` |
| `zxing-wasm` | `2.2.4` | `2.2.4` (NOT `3.0.2`) |
| `webrtc-adapter` | `9.0.3` | `9.0.3` |
| `sdp` | `3.2.2` | `^3.2.0` (satisfied) |

`frontend2/bun.lock` diff: `23 insertions(+), 0 deletions` — new integrity hashes for the three direct deps + transitive closure.

### Task 2 — `HazardStripe.variant` prop (TDD)

**API shape:**

```ts
interface HazardStripeProps {
  height?: number;
  className?: string;
  variant?: "yellow" | "red";  // new; default "yellow"
}
```

**Behavior:**
- `variant` unset or `"yellow"` → `bg-hazard-stripe` (pre-existing token) + `data-variant="yellow"`
- `variant="red"` → `bg-retro-red` (pre-declared in `globals.css:9` as `#CC3333`) + `data-variant="red"`
- `className` prop merges cleanly with either variant (no override)
- `data-variant` attribute exposed as a stable test hook

**TDD cycle:**
1. RED: added 3 failing tests (yellow explicit, red, className+red merge) — commit `dac4fee`
2. GREEN: implemented variant branch in `HazardStripe.tsx` — commit `ae9caf7`
3. REFACTOR: skipped (5 LOC implementation is already minimal and readable)

**Backward compatibility:** All 5 pre-existing `HazardStripe` tests remain green without modification. Existing callsites (via the `@/components/retro` barrel) continue to render a yellow stripe with no visual change.

---

## Commits

| # | Hash | Type | Description |
| --- | --- | --- | --- |
| 1 | `33a34b2` | chore | add scanner runtime deps (no ios-haptics per D-17) |
| 2 | `dac4fee` | test | add failing tests for HazardStripe variant prop (RED) |
| 3 | `ae9caf7` | feat | add variant prop to HazardStripe retro atom (GREEN) |

---

## Verification — Acceptance Criteria & Gates

### Plan acceptance criteria (all PASS)

Task 1:
- [x] `grep '"@yudiel/react-qr-scanner": "2.5.1"'` returns 1 (exact version, no caret)
- [x] `grep '"uuid": "^13.0.0"'` returns 1
- [x] `grep '"@types/uuid": "^11.0.0"'` returns 1
- [x] `grep "ios-haptics"` returns 0 (D-17 compliance)
- [x] `node_modules/@yudiel/react-qr-scanner/package.json` exists
- [x] `node_modules/barcode-detector/package.json` exists
- [x] `node_modules/zxing-wasm/package.json` exists
- [x] `frontend2/bun.lock` diff non-empty (23 lines added)
- [x] `bun run lint:imports` exits 0

Task 2:
- [x] `bun run test HazardStripe` exits 0 with 8 passing tests (5 existing + 3 new)
- [x] `grep 'variant\?: "yellow" | "red"'` returns 1
- [x] `grep 'variant = "yellow"'` returns 1
- [x] `grep 'bg-retro-red'` returns 1
- [x] `ls frontend2/src/components/retro/*.tsx | wc -l` = 19 (unchanged vs pre-plan; UI-SPEC Acceptance Gate #4)
- [x] `bun run test` full suite exits 0 (486/486 tests pass, 78 files)

### Plan-level verification gates (all PASS)

- [x] `bun run test --run` green (486/486)
- [x] `bun run lint:imports` green
- [x] `bun run build` succeeds (303 modules transformed; 500kB warning expected — Phase 64-02 adds `manualChunks` for scanner split)
- [x] retro tsx file count unchanged: 19 before = 19 after
- [x] `ios-haptics` absent from `package.json.dependencies` (D-17)

### TDD Gate Compliance

- [x] RED gate: commit `dac4fee` (`test(64-01): add failing tests for HazardStripe variant prop`)
- [x] GREEN gate: commit `ae9caf7` (`feat(64-01): add variant prop to HazardStripe retro atom`) after RED
- REFACTOR: skipped (no readability gains available in 5 LOC)

---

## Deviations from Plan

None — plan executed exactly as written.

No Rule 1/2/3 auto-fixes were triggered. No Rule 4 checkpoints required. No authentication gates encountered.

---

## Threat Flags

None — Plan 64-01 introduces no new network endpoints, auth paths, file-access patterns, or trust boundaries beyond what the plan's `<threat_model>` already covered (T-64-01..04).

The registered threats are all accounted for:
- T-64-01 (`@yudiel/react-qr-scanner` tampering): mitigated — exact pin recorded in `bun.lock` with integrity hash
- T-64-02 (`zxing-wasm` transitive tampering): mitigated — integrity hash recorded in `bun.lock`
- T-64-03 (`@types/uuid` upstream deprecation): accepted — documented in CONTEXT.md; install proceeded
- T-64-04 (`HazardStripe` className passthrough): accepted — variant addition does not expand attack surface

---

## Known Stubs

None. No hardcoded empty values, placeholder UI, or unconnected components were introduced.

---

## Self-Check: PASSED

**Files verified present:**
- FOUND: `frontend2/package.json` (modified with 3 new entries)
- FOUND: `frontend2/bun.lock` (modified; 23 new lines)
- FOUND: `frontend2/src/components/retro/HazardStripe.tsx` (modified; +10/-2)
- FOUND: `frontend2/src/components/retro/__tests__/HazardStripe.test.tsx` (modified; +27)

**Commits verified in `git log --oneline --all`:**
- FOUND: `33a34b2` (`chore(64-01): add scanner runtime deps (no ios-haptics per D-17)`)
- FOUND: `dac4fee` (`test(64-01): add failing tests for HazardStripe variant prop`)
- FOUND: `ae9caf7` (`feat(64-01): add variant prop to HazardStripe retro atom`)

**Claims verified:**
- `ios-haptics` absent from `package.json`: confirmed via `node -e 'Object.keys(pkg.dependencies).filter(k => k === "ios-haptics").length'` → `0`
- Retro tsx file count: `19` (unchanged)
- Test suite: `486 passed (486)` across 78 files
