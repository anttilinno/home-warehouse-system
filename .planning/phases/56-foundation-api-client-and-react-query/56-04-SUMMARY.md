---
phase: 56
plan: "04"
subsystem: tooling
tags: [ci-guard, import-policy, build-tooling, tdd]
dependency_graph:
  requires: []
  provides: [forbidden-import-guard, prebuild-lint-gate]
  affects: [frontend2/package.json, scripts/]
tech_stack:
  added: []
  patterns: [Node ESM script, node:test, spawnSync fixture testing]
key_files:
  created:
    - scripts/check-forbidden-imports.mjs
    - scripts/__tests__/check-forbidden-imports.test.mjs
    - scripts/__tests__/fixtures/offender-idb.ts
    - scripts/__tests__/fixtures/offender-offline.ts
    - scripts/__tests__/fixtures/offender-sync.ts
    - scripts/__tests__/fixtures/safe-tanstack.ts
    - scripts/__tests__/fixtures/safe-react.ts
  modified:
    - frontend2/package.json
decisions:
  - "Node built-in test runner (node:test) — no vitest dependency; runs standalone with plain `node --test`"
  - "CLI arg overrides SCAN_ROOT — lets tests point at fixture directories for isolation without touching frontend2/src"
  - "FORBIDDEN_EXACT for idb/serwist, FORBIDDEN_SUBSTR for offline|sync — minimises regex complexity while covering all D-05 patterns"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
---

# Phase 56 Plan 04: CI Import Guard (D-05) Summary

**One-liner:** Node ESM grep guard blocking idb/serwist/offline/sync imports in frontend2/src, wired to prebuild with node:test fixture suite proving exact/substring detection and false-positive safety.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests + fixtures | f15309f | scripts/__tests__/check-forbidden-imports.test.mjs, 5 fixture files |
| 1 (GREEN) | Implement guard script | 00ab15d | scripts/check-forbidden-imports.mjs |
| 2 | Wire into package.json | c570d9f | frontend2/package.json |

## What Was Built

### scripts/check-forbidden-imports.mjs

Node ESM script (49 lines, zero third-party dependencies) that:
- Walks a scan root recursively (defaults to `frontend2/src`, overridable via CLI arg)
- Extracts module specifiers from `from '...'`, `from "..."`, `import('...')`, `import("...")` patterns only — never matches identifiers or comments
- Rejects: exact matches against `idb`, `serwist`, `@serwist/*`; substring matches for `offline` or `sync` (case-insensitive) inside the specifier
- Exits 1 with offender list on violations; exits 0 on clean scan

### scripts/__tests__/check-forbidden-imports.test.mjs

5 tests using `node:test` + `node:assert/strict` + `spawnSync`:
1. Detects `idb` exact import
2. Detects `offline` substring in specifier
3. Detects `sync` substring in specifier
4. Does NOT flag `@tanstack/react-query` or `react` (safe fixtures)
5. Passes against live `frontend2/src` tree

### frontend2/package.json

Added two scripts:
- `lint:imports`: `node ../scripts/check-forbidden-imports.mjs src`
- `prebuild`: `bun run lint:imports` (runs automatically before every `bun run build`)

## Verification Results

```
node --test scripts/__tests__/check-forbidden-imports.test.mjs
  pass 5 / fail 0

cd frontend2 && bun run lint:imports  → exit 0
cd frontend2 && bun run build         → exit 0 (prebuild guard ran, then vite built 126 modules)
node scripts/check-forbidden-imports.mjs scripts/__tests__/fixtures/ → exit 1 (idb, offline-sync, sync-manager)
```

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

| Gate | Commit | Message |
|------|--------|---------|
| RED | f15309f | test(56-04): add failing tests for forbidden-import guard (RED) |
| GREEN | 00ab15d | feat(56-04): implement check-forbidden-imports.mjs guard (GREEN) |

Both gates satisfied. No REFACTOR commit needed — implementation was minimal and clean on first pass.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- scripts/check-forbidden-imports.mjs: EXISTS (49 lines)
- scripts/__tests__/check-forbidden-imports.test.mjs: EXISTS
- All 5 fixture files: EXISTS
- Commit f15309f: EXISTS (RED gate)
- Commit 00ab15d: EXISTS (GREEN gate)
- Commit c570d9f: EXISTS (Task 2)
- frontend2/package.json: contains lint:imports and prebuild
- node --test: 5/5 pass
- bun run build: exit 0
