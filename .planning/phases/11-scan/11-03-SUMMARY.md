---
phase: 11-scan
plan: 03
subsystem: frontend2/scan-hooks
tags: [scan, hooks, resolve-funnel, feedback, torch, history, tanstack-query]
requires: ["11-01", "11-02"]   # test mocks (scanner-mock/setup) + lib (@/lib/scanner, @/lib/api/items)
provides:
  - "features/scan/{useScanResolve,useScanFeedback,useTorch,useScanHistory}.ts"
affects:
  - "11-06 ScanPage wiring (consumes all four hook return shapes)"
  - "11-04 scanner component (consumes paused + components.torch boolean)"
tech-stack:
  added: []                    # no new deps; lockfile owned by 11-01 (frozen install held)
  patterns:
    - "Single resolve funnel: handleResolveCode → useQuery(['item-by-barcode',wsId,code]) 4-state banner (RESEARCH Pattern 3)"
    - "Pause-not-unmount: paused is a prop the scanner consumes; hook never unmounts the camera (binding override 1)"
    - "Render-loop guard: history-refine effect deps are PRIMITIVE status/data/code, never the history array (Pitfall 6 / Phase 65 D-22)"
    - "Lib-managed torch apply: probe getUserMedia → getCapabilities().torch → release; component passes components.torch (Pattern 4 approach 1)"
    - "ios-haptics supportsHaptics gate (no UA branching); reduced-motion read once at mount and EXPOSED for the component's static-checkmark fallback"
key-files:
  created:
    - frontend2/src/features/scan/useScanResolve.ts
    - frontend2/src/features/scan/useScanResolve.test.ts
    - frontend2/src/features/scan/useScanFeedback.ts
    - frontend2/src/features/scan/useScanFeedback.test.ts
    - frontend2/src/features/scan/useTorch.ts
    - frontend2/src/features/scan/useTorch.test.ts
    - frontend2/src/features/scan/useScanHistory.ts
    - frontend2/src/features/scan/useScanHistory.test.ts
  modified: []
decisions:
  - "useScanResolve takes feedback as an injected param (UseScanResolveArgs.feedback) so the funnel stays unit-testable without mounting useScanFeedback — the ScanPage wires success() into it."
  - "lookup uses retry:false so a 500 surfaces as ERROR immediately (no backoff) — matches the 4-state banner contract; staleTime:0 so a history re-tap of the SAME code re-fires (fresh-scan parity)."
  - "useScanFeedback exposes a monotonic `flash` counter (not a boolean) so each success bumps it — the component watches the change to replay the animation; reducedMotion gates static-checkmark vs animated."
  - "useScanHistory is state-backed (lazy useState seed + refresh-after-mutation), NOT a re-read every render — keeps the entries array reference stable across no-op renders (render-loop hygiene)."
  - "useTorch never calls applyConstraints — apply is lib-managed via components.torch (Pattern 4 approach 1); the probe-and-release detect is the only mediaDevices touch."
metrics:
  duration: ~15m
  completed: 2026-06-13
---

# Phase 11 Plan 03: Scan Hooks Summary

The React hook layer turning the 11-02 lib + the existing `itemsApi` into the
post-scan state machine. Four pure hooks — the single resolve funnel (heart of
OQ7 / binding override 7), feedback, torch, and a history bridge — fully tested
with `renderHook` + the Wave-0 mocks, disjoint from all sibling W2 plans.

## What was built

- **useScanResolve** — THE single funnel. `handleResolveCode(code, format)`
  no-ops on empty code, else sets `paused=true` + `banner={code,format}` (which
  enables a `useQuery(["item-by-barcode", wsId, code])`), fires the injected
  feedback, and records the scan to history as `unknown`. The query's
  `status`/`data` derive the four banner states; a primitive-dep effect refines
  the history entry on settle (Item → item/name, null → unknown). `resume()` is
  Back-to-Scan (clear banner + unpause). `staleTime:0` makes a same-code re-tap
  behave like a fresh scan.
- **useScanFeedback** — `success()` (success beep + `haptic.confirm()` +
  flash-bump) and `error()` (error beep + `haptic.error()`), both gated by
  `supportsHaptics` (no UA branching). Exposes `reducedMotion` (read once via
  `matchMedia('(prefers-reduced-motion: reduce)')`) so the component picks the
  static-checkmark variant, plus `primeAudio()` for the pointerdown unlock.
- **useTorch** — iOS UA → `supported:false` with NO probe (auto-hide); else
  probes `getUserMedia({video:{facingMode:'environment'}})`, reads
  `getCapabilities().torch`, stops every probe track, and sets `supported`.
  `toggle()` flips `enabled`; apply is lib-managed downstream.
- **useScanHistory** — state-backed bridge over `lib/scanner/scan-history`:
  `entries` (seeded once, refreshed after mutations), `add`, `clear`, and
  `refire(entry) → {code, format}` for the ScanPage to re-funnel via
  `handleResolveCode`.

## Exported hook return shapes (for 11-06 ScanPage wiring)

| Hook | Args | Returns |
|------|------|---------|
| `useScanResolve` | `{ feedback: () => void }` | `{ handleResolveCode(code,format), paused, setPaused, banner: {code,format}\|null, lookup: UseQueryResult<Item\|null>, resume() }` |
| `useScanFeedback` | — | `{ success(), error(), flash: number, reducedMotion: boolean, primeAudio() }` |
| `useTorch` | — | `{ supported: boolean, enabled: boolean, toggle() }` |
| `useScanHistory` | — | `{ entries: ScanHistoryEntry[], add(entry), clear(), refire(entry) → {code,format} }` |

**Banner-state mapping** (consumed by 11-04's ResultBanner via `lookup`):
`pending`+banner → LOADING; `success`+Item → MATCH; `success`+null → NOT-FOUND;
`error` → ERROR.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verify command script name mismatch (same as 11-02)**
- **Found during:** final gate.
- **Issue:** The plan's `<verify>`/`<verification>` call `bun run typecheck` and a
  bare `bun run test -- <path>`; `package.json` has no `typecheck` script (it is
  `lint:tsc`), and the bun runner does not need the `--` passthrough.
- **Fix:** Ran `bun run lint:tsc` for the typecheck gate and `bun run test
  src/features/scan/` for the suite. No source change.

### Intentional design choices (not bugs)

- **feedback is injected into useScanResolve** rather than the funnel calling
  `useScanFeedback` internally. This keeps the funnel testable in isolation (the
  test passes a `vi.fn()`); the ScanPage composes `success()` into it. Documented
  in decisions.
- **`flash` is a counter, not a boolean** — every `success()` bumps it so the
  component can replay the animation even on back-to-back matches.

## Threat mitigations applied

- **T-11-04 (path injection):** the funnel passes the raw scanned code straight
  into `itemsApi.lookupByBarcode`, which already `encodeURIComponent`s it
  (items.ts:94). The hook never builds the path itself. Verified by reuse — no
  new path construction added.
- **T-11-05 (render-loop / runaway query):** the history-refine effect depends
  ONLY on primitive `lookup.status` / `lookup.data` / `banner.code` (never the
  history array); the query is keyed + `enabled`-gated. A dedicated test asserts
  the render count stays bounded (≤1 extra render after settle, < 15 total).

## Verification

- `bun install --frozen-lockfile` — clean (lockfile owned by 11-01; no drift).
- `bun run lint:tsc` — green (no errors).
- `bun run lint:imports` — OK (no forbidden imports introduced).
- `bun run test src/features/scan/` — **4 files / 22 tests passed.**
  - useScanResolve.test.ts: 7 (empty no-op, LOADING→MATCH+history refine,
    404→NOT-FOUND, 500→ERROR, resume clears, same-code re-fire, bounded renders).
  - useScanFeedback.test.ts: 6 (success beep+confirm+flash, error beep+error,
    supportsHaptics=false skips haptics, reduced-motion ±, primeAudio delegate).
  - useScanHistory.test.ts: 6 (read-on-mount, add persists+newest-first, clear
    empties both, refire returns {code,format}, stable ref across no-op render).
  - useTorch.test.ts: 4 (iOS no-probe supported:false, Android torch:true
    supported+released, torch:false unsupported, toggle flips enabled).

## Known Stubs

None — all four hooks are wired to real surfaces (`itemsApi`, `@/lib/scanner`,
`ios-haptics`, `navigator.mediaDevices`). No placeholder data or empty-return
stubs. The lib-managed torch apply and the feedback→funnel composition are
deferred to the 11-04 component / 11-06 ScanPage by design (disjoint-files
contract), not stubbed here.

## TDD Gate Compliance

Plan tasks are `tdd="true"`. Each hook was driven RED→GREEN: the test file was
written first and confirmed failing (module-missing) before the implementation
landed. Per the orchestrator's single-commit instruction for this plan, the
RED and GREEN states are squashed into one plan commit rather than split
`test(...)`/`feat(...)` commits — flagged here for transparency. All tests are
present and green.

## Self-Check: PASSED

All 8 source/test files + this SUMMARY exist on disk; `lint:tsc` +
`lint:imports` + the 22-test suite are green. Commit hash recorded in the
orchestrator return.
