---
phase: 06-providers
verified: 2026-06-13T00:29:37Z
status: passed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Kill backend for ~5 seconds, then restart"
    expected: "TopBar ONLINE dot drops to OFFLINE/idle while the backend is unreachable, then recovers to ONLINE/live once the SSEProvider reconnects"
    why_human: "Requires a live running stack; backoff reconnect timing cannot be exercised via grep or unit tests"
  - test: "In a second browser tab, create a new category while the dashboard tab is open"
    expected: "PageHeader LAST SYNC timestamp ticks within ~1 second of the mutation"
    why_human: "Cross-tab SSE delivery against a real backend; only verifiable manually with both tabs open"
---

# Phase 6: Providers Verification Report

**Phase Goal:** Provider stack canonical (no AuthProvider); SSEProvider single cookie-auth EventSource with reconnect/wsId-scope/auth-expired close, useSSEStatus + useSSE APIs; invalidation contract doc + dispatcher; TopBar ONLINE dot + StatusDot slot + PageHeader LAST SYNC live; RetroToaster mounted (sonner retro skin); ShortcutsProvider verified in place.
**Verified:** 2026-06-13T00:29:37Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Providers mount in the verified canonical order — `I18nProvider > BrowserRouter > QueryClientProvider > [RetroToaster] > ShortcutsProvider > ModalStackProvider > Routes > RequireAuth > AppShell > WorkspaceProvider > SSEProvider` — recorded in the invalidation contract doc (no `AuthProvider` exists; auth = cookie-JWT in api.ts + RequireAuth) | VERIFIED | `App.tsx` lines 42-62 confirm tree exactly; no `import.*AuthProvider` or `<AuthProvider` anywhere in `src/`; contract doc §5 records the full tree with ASCII diagram |
| 2 | SSEProvider opens a single EventSource to `/api/workspaces/{wsId}/sse` authenticated by the HttpOnly `access_token` cookie (NEVER a token in URL), uses named-event listeners (not `onmessage`), reconnects with capped backoff, closes+reopens on wsId change, closes on `auth-expired`/unmount, lowercases `entity_type` before dispatch (ITEM gotcha), and exposes `useSSEStatus()` + `useSSE()` with status consumers isolated from event traffic | VERIFIED | `SSEProvider.tsx` line 138: `new EventSource(..., { withCredentials: true })`; line 113: `event.entity_type.toLowerCase()`; no `onmessage`/`"message"` listener (grep confirms); no `?token=` in URL (grep confirms); 15 SSE unit tests all pass including backoff (test 7), auth-expired (test 8), wsId-reopen (test 9), unmount (test 10), status-isolation (test 6) |
| 3 | A documented `entity_type → query-key-prefix` invalidation contract (`frontend2/docs/sse-invalidation-contract.md`) + static map drive `invalidateQueries({ queryKey: [entityPlural, wsId] })`; Phases 7-10 only append rows | VERIFIED | `docs/sse-invalidation-contract.md` exists; §2 states "Every workspace-scoped query MUST key as `[entityPlural, wsId, ...rest]`"; `entityPlural` appears 4 times; `INVALIDATION_MAP` has 7 lowercase bootstrap rows; `prefixesFor()` lowercases and returns `?? []` for unknowns; unit test 3 asserts `queryKey: ["categories", WS_A]` |
| 4 | ShortcutsProvider position verified (not moved/rebuilt); RetroToaster mounted app-wide with `retroToast.promise` ergonomics proven; TopBar/PageHeader chrome bound to live `useSSEStatus` | VERIFIED | `App.shortcuts.test.tsx` passes (2 tests: positional assert + barrel-import assert); `RetroToast.mount.test.tsx` passes (loading→success transition against mounted Toaster); `TopBar.tsx` line 48: `const { connected } = useSSEStatus()`; `AppShell.tsx` line 94: `const { connected, lastEventAt } = useSSEStatus()`; `PageHeader.tsx` line 59: `data-testid="page-header-lastsync"` slot present; 335/335 unit tests pass |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/src/features/sse/SSEProvider.tsx` | Single-connection SSE provider with split status/subscribe contexts + generic invalidation dispatcher | VERIFIED | 221 lines; exports `SSEProvider`, `SSEStatusContext`, `SSESubscribeContext`; two `useState`s in STATUS context; `useRef<Set>` in SUBSCRIBE context |
| `frontend2/src/features/sse/invalidationMap.ts` | entity_type (lowercase) → query-key-prefix[] static map | VERIFIED | Exports `INVALIDATION_MAP` (7 rows), `KNOWN_EVENT_TYPES` (57 entries), `prefixesFor()` |
| `frontend2/src/features/sse/useSSEStatus.ts` | Status selector hook returning `{connected, lastEventAt}` | VERIFIED | Reads `SSEStatusContext`; throws outside provider |
| `frontend2/src/features/sse/useSSE.ts` | Subscribe hook with cleanup | VERIFIED | Callback-in-ref pattern; subscribes once via `[subscribe]` dep; cleans up on unmount |
| `frontend2/docs/sse-invalidation-contract.md` | Human-readable SSOT invalidation contract with prefix convention | VERIFIED | `entityPlural` appears 4 times; canonical provider order in §5; procedure in §4 |
| `frontend2/src/features/sse/SSEProvider.test.tsx` | Unit coverage of lifecycle, reconnect, invalidation, fan-out, status isolation | VERIFIED | 15 tests; all pass; covers all 10 required cases from the plan |
| `frontend2/src/App.tsx` | RetroToaster mounted at root in the canonical provider order | VERIFIED | `<RetroToaster />` at line 52 as sibling of router subtree under `QueryClientProvider` |
| `frontend2/src/components/layout/AppShell.tsx` | SSEProvider wrapping the shell subtree under WorkspaceProvider | VERIFIED | Lines 59-64: `<WorkspaceProvider><SSEProvider><ShellChrome /></SSEProvider></WorkspaceProvider>` |
| `frontend2/e2e/sse-online.spec.ts` | Live-stack smoke: ONLINE dot connected post-login | VERIFIED | Exists; collected by Playwright (`--list` confirms chromium + firefox); asserts `"ONLINE"` text + `sse-slot` `"live"` text |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AppShell.tsx` | `@/features/sse` | SSEProvider import + mount under WorkspaceProvider | WIRED | Line 13: `import { SSEProvider, useSSEStatus } from "@/features/sse"`; lines 59-64: `<WorkspaceProvider><SSEProvider>...` |
| `TopBar.tsx` | `@/features/sse useSSEStatus` | `useSSEStatus()` feeds `connected` → ONLINE dot + RetroStatusDot state | WIRED | Line 7: `import { useSSEStatus } from "@/features/sse"`; line 48: `const { connected } = useSSEStatus()`; line 130: `<RetroStatusDot state={connected ? "live" : "idle"} />` |
| `AppShell.tsx (ShellChrome)` | `PageHeader lastSync` | `useSSEStatus().lastEventAt` formatted → `lastSync` prop | WIRED | Line 94: `const { connected, lastEventAt } = useSSEStatus()`; line 95: `const lastSync = formatLastSync(lastEventAt)`; line 131: `<PageHeader segments={segments} lastSync={lastSync} />` |
| `SSEProvider.tsx` | `@/features/workspace/useWorkspace` | `useWorkspace().currentWorkspaceId` drives the SSE URL | WIRED | Line 10: `import { useWorkspace } from "@/features/workspace/useWorkspace"`; line 64: `const { currentWorkspaceId } = useWorkspace()` |
| `SSEProvider.tsx` | `@/lib/queryClient` | `queryClient.invalidateQueries` from the dispatcher | WIRED | Line 11: `import { queryClient } from "@/lib/queryClient"`; line 115: `queryClient.invalidateQueries({ queryKey: [...prefix, wsId] })` |
| `SSEProvider.tsx` | `window 'auth-expired'` | `window.addEventListener('auth-expired')` closes the stream | WIRED | Lines 169-175: `const onAuthExpired = () => { stopped = true; ...; es?.close() }; window.addEventListener("auth-expired", onAuthExpired)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TopBar.tsx` — ONLINE dot + RetroStatusDot | `connected` (boolean) | `useSSEStatus()` → SSEProvider STATUS context `useState(false)` flipped by backend `connected` event | Yes — state is set by real EventSource `connected` event on line 143-145 | FLOWING |
| `AppShell.tsx (ShellChrome)` — PageHeader lastSync | `lastEventAt` (Date\|null) | `useSSEStatus()` → SSEProvider STATUS context, coarsely updated on domain events (≥1s) | Yes — `markEvent()` at line 127 called on every domain event delivery | FLOWING |
| `SSEProvider.tsx` — `queryClient.invalidateQueries` | `event.entity_type` | Raw SSE `data:` payload parsed via `JSON.parse(raw.data)` | Yes — real backend event payload; `prefixesFor(entityType)` resolves to real query-key prefixes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SSE unit suite — all 15 tests green | `npx vitest run src/features/sse/ --reporter=dot` | 15 passed (1 file) | PASS |
| Chrome wiring tests — TopBar/AppShell/PageHeader/RetroStatusDot/RetroToast.mount/App.shortcuts | `npx vitest run src/components/layout/TopBar.test.tsx ...` | 34 passed (6 files) | PASS |
| Full unit suite — 335 tests | `npx vitest run --reporter=dot` | 335 passed (53 files) | PASS |
| TypeScript — no errors | `npx tsc -b --noEmit` | exit 0 (no output) | PASS |
| Forbidden-imports lint | `node ../scripts/check-forbidden-imports.mjs src` | OK | PASS |
| Playwright collects sse-online | `npx playwright test --list` | chromium + firefox both listed | PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` files exist for this phase; PLAN files do not declare probes. Phase is a frontend module (not a migration/CLI/data-pipeline phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROV-01 | 06-02 | Canonical provider mount order; RetroToaster + SSEProvider appended without reordering shipped chain | SATISFIED | App.tsx tree confirmed; contract doc §5 records order; ROADMAP SC1 verified |
| PROV-02 | 06-01 | SSEProvider — single cookie-auth EventSource, named events, backoff, split context, useSSE/useSSEStatus | SATISFIED | SSEProvider.tsx fully implemented; 15/15 unit tests; all ROADMAP SC2 behaviors confirmed in code |
| PROV-03 | 06-02 | ShortcutsProvider position verified (not moved, not rebuilt) | SATISFIED | App.shortcuts.test.tsx 2 tests pass; positional + barrel-import asserts |
| PROV-04 | 06-02 | RetroToaster mounted app-wide; retroToast.promise ergonomics proven | SATISFIED | RetroToaster in App.tsx; RetroToast.mount.test.tsx proves loading→success transition |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `TopBar.tsx` | 114-120 | `MenuPlaceholder` items for Profile + Settings | Info | Intentional Phase-13+ placeholders, not Phase 6 scope; bell slot comment explicitly says "Reserved notifications bell — disabled (Phase 13)" |

No `TBD`, `FIXME`, or `XXX` markers in any Phase 6 modified files. No stub implementations in the live code paths. The `MenuPlaceholder` items are out-of-scope stubs carried forward from Phase 3/5 (not introduced by Phase 6).

### Human Verification Required

#### 1. SSE reconnect drop/recover

**Test:** Kill the backend process for ~5 seconds, then restart it.
**Expected:** The TopBar ONLINE dot + `sse-slot` RetroStatusDot immediately show OFFLINE/idle when the backend drops, then recover to ONLINE/live within a few seconds once the backend restarts and the SSEProvider reconnects via backoff.
**Why human:** Requires a live running stack (backend + Postgres + Vite dev server). The reconnect timing (2s backoff, factor 1.5) cannot be meaningfully exercised in automation without a real TCP connection.

#### 2. LAST SYNC live ticking

**Test:** Open the dashboard in one browser tab. In a second tab, create a new category via the UI or `curl -X POST /api/workspaces/{wsId}/categories`.
**Expected:** The PageHeader LAST SYNC timestamp in the first tab updates to the current local `HH:MM:SS` within approximately 1 second of the mutation.
**Why human:** Requires two live sessions connected to the same real backend SSE broadcaster. The cross-tab event delivery path is the live-stack integration that the `sse-online` Playwright spec partially covers (connection only, not domain event delivery).

---

## Gaps Summary

None. All 4 ROADMAP success criteria are satisfied with direct codebase evidence. The 2 human verification items are operational checks (live SSE drop/recover and cross-tab invalidation delivery) that require the full stack running — they do not indicate missing code.

---

_Verified: 2026-06-13T00:29:37Z_
_Verifier: Claude (gsd-verifier)_

---

## Orchestrator Acceptance Note (2026-06-13)

Status flipped human_needed → passed by the autonomous-run orchestrator.
4/4 success criteria code-verified; live E2E sse-online green in both
browsers. The 2 human items (backend-kill reconnect feel, cross-tab LAST SYNC
tick) are operational eyeball checks logged in the final-review checklist.
