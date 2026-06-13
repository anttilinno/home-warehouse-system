---
phase: 06-providers
plan: 01
subsystem: frontend2-sse
tags: [sse, eventsource, tanstack-query, react-19, invalidation, providers]
requires:
  - "@/features/workspace/useWorkspace (currentWorkspaceId — wsId source, D-12)"
  - "@/lib/queryClient (invalidateQueries dispatcher target)"
  - "window 'auth-expired' event (api.ts:73 — session-loss signal)"
provides:
  - "SSEProvider (single cookie-auth EventSource, split status/subscribe contexts)"
  - "useSSEStatus() → { connected, lastEventAt }"
  - "useSSE({ onEvent }) subscribe hook"
  - "INVALIDATION_MAP + prefixesFor + KNOWN_EVENT_TYPES (invalidationMap.ts)"
  - "SSEEvent wire type (types.ts)"
  - "frontend2/docs/sse-invalidation-contract.md (SSOT for Phases 7-10)"
  - "global.EventSource test stub (MockEventSource) in src/test/setup.ts"
affects:
  - "06-02 (chrome wiring: TopBar ONLINE dot, sse-slot, PageHeader LAST SYNC consume these hooks)"
  - "Phases 7-10 (append INVALIDATION_MAP rows + confirm [entityPlural, wsId] key shape)"
tech-stack:
  added: []
  patterns:
    - "Split React context (status vs subscribe) to isolate chrome from event re-renders"
    - "Named SSE event listeners per KNOWN_EVENT_TYPES (no onmessage)"
    - "Generic entity_type → query-key-prefix invalidation dispatcher (static map)"
    - "Capped exponential backoff with auth-aware close"
    - "Callback-in-ref subscribe (stable subscription across consumer re-renders)"
key-files:
  created:
    - frontend2/src/features/sse/types.ts
    - frontend2/src/features/sse/invalidationMap.ts
    - frontend2/src/features/sse/SSEProvider.tsx
    - frontend2/src/features/sse/useSSE.ts
    - frontend2/src/features/sse/useSSEStatus.ts
    - frontend2/src/features/sse/index.ts
    - frontend2/src/features/sse/SSEProvider.test.tsx
    - frontend2/docs/sse-invalidation-contract.md
  modified:
    - frontend2/src/test/setup.ts
decisions:
  - "Lowercase entity_type at the dispatch site in SSEProvider (not only in prefixesFor) — keeps the ITEM-outlier gotcha visible at the boundary and satisfies the hard gate"
  - "Backoff: base 2s, factor 1.5, cap 30s, max 10 attempts (legacy-aligned, Claude's discretion)"
  - "lastEventAt coarsened to ≥1s ticks to prevent header thrash under event bursts"
  - "Listened to window 'auth-expired' rather than adding a getMe probe (frontend2 centralizes session loss in api.ts)"
  - "Included online/visibilitychange wake reconnect (cheap UX nicety, legacy-aligned, RESEARCH A2)"
metrics:
  duration: ~25m
  completed: 2026-06-13
  tasks: 3
  files: 9
  commits: 3
  tests: 15 (SSE) / 328 (full unit suite)
---

# Phase 6 Plan 01: SSE Feature Module Summary

Single-connection cookie-auth `SSEProvider` (React 19, split status/subscribe contexts) with a generic `entity_type → [entityPlural, wsId]` TanStack invalidation dispatcher, `useSSE`/`useSSEStatus` hooks, a `global.EventSource` test stub, 15 unit cases, and the human-readable invalidation contract doc — PROV-02, the one genuinely new artifact of Phase 6.

## What Was Built

- **`SSEProvider.tsx`** — owns ONE `EventSource(\`/api/workspaces/${wsId}/sse\`, { withCredentials: true })`. TWO split contexts: a STATUS context (the only `useState`s: `connected`, `lastEventAt`) and a SUBSCRIBE context (`subscribe()` backed by a `useRef<Set>`), so event fan-out never re-renders status consumers. Registers one `addEventListener` per `KNOWN_EVENT_TYPES` name (no `onmessage`), `JSON.parse` in try/catch, coarse `lastEventAt` (≥1s), generic dispatcher lowercasing `entity_type` before `queryClient.invalidateQueries({ queryKey: [...prefix, wsId] })`. Capped exponential backoff (2s/1.5×/30s/10), reset on open + wsId change; close+reopen on wsId change; `auth-expired` closes + halts reconnect; `online`/visibility wake; `es.close()` cleanup (StrictMode-safe).
- **`invalidationMap.ts`** — `INVALIDATION_MAP` (7 lowercase bootstrap rows), `KNOWN_EVENT_TYPES` (full backend event-name list + `connected`), pure `prefixesFor()` (lowercases, `?? []` no-op for unknowns).
- **`useSSEStatus.ts` / `useSSE.ts`** — status selector and callback-in-ref subscribe; both throw outside the provider. `index.ts` barrel.
- **`types.ts`** — `SSEEvent` matching the verified wire shape.
- **`docs/sse-invalidation-contract.md`** — SSOT: backend wire contract, `[entityPlural, wsId]` prefix rule, ITEM normalization, add-entity procedure, canonical provider order (PROV-01).
- **`src/test/setup.ts`** — `MockEventSource` stub (named-event handlers, instance registry, `emit`/`emitError`, inert-when-closed) installed on `global.EventSource`, reset each `afterEach`.

## Verification

- `npx vitest run src/features/sse/` → **15 passed** (lifecycle, cookie-auth single connection, connected status, `[entityPlural, wsId]` invalidation incl. uppercase ITEM, useSSE fan-out + unmount cleanup, status-isolation zero-re-render burst, backoff reconnect, auth-expired close+halt, wsId reopen, unmount close, malformed/unknown no-ops, provider guards, stable subscription).
- Full unit suite → **328 passed (51 files)** — no regressions.
- `npx tsc -b --noEmit --force` → **clean**.
- Hard gates: no `?token=`/JWT in the EventSource URL (only the negative test guard references the literal); no `message`/`onmessage` listener; `toLowerCase` present in `SSEProvider.tsx` at the dispatch site.
- Contract doc exists and documents the `[entityPlural, wsId]` convention.

## Deviations from Plan

None of substance — plan executed as written. Two within-discretion judgment calls (already authorized by the plan's "Claude's discretion" notes):

1. **Lowercasing also at the dispatch site** in `SSEProvider.tsx` (in addition to inside `prefixesFor`). The Task 2 verify greps `SSEProvider.tsx` for `toLowerCase`; delegating solely to `prefixesFor` would have failed the gate. Lowercasing at the boundary is also defense-in-depth and keeps the ITEM-outlier gotcha visible. No behavior change (idempotent).
2. **Status-isolation test primes one `lastEventAt` tick before measuring the baseline.** The coarsening contract permits at most one status re-render per ≥1s window; a 20-event synchronous burst within one window must add ZERO further status re-renders. The test establishes the baseline after the coarse tick has fired, then asserts the burst adds none — this is the honest expression of the Pitfall-5 isolation guarantee (the alternative naive assertion would have contradicted the deliberate coarse-tick behavior).

## Notes for Downstream

- **06-02 chrome wiring:** mount `SSEProvider` inside `WorkspaceProvider` in `AppShell` (per the contract doc's canonical provider order); feed `useSSEStatus().connected` to the TopBar ONLINE dot + `RetroStatusDot` sse-slot, and `lastEventAt` to PageHeader LAST SYNC. Do NOT import SSE inside `RetroStatusDot` (Pitfall 6 — preserves the Phase 4 guard test).
- **Phases 7-10:** append an `INVALIDATION_MAP` row + a doc §3 row per new entity, add any new backend event NAME to `KNOWN_EVENT_TYPES`, and ensure hook query keys start with `[entityPlural, wsId]`.

## Known Stubs

None. The only stub (`MockEventSource` in `src/test/setup.ts`) is an intentional, required test double for jsdom's missing `EventSource` (RESEARCH Pitfall 1) — not a placeholder for production data.

## TDD Gate Compliance

Tasks 1 and 2 are `tdd="true"`. The RED scaffold (Task 0, `test(06-01)` commit `ec8beeb4`) precedes the GREEN implementation (`feat(06-01)` commits `ae4c7c03`, `a1ab11fd`). RED was genuine — the suite failed to collect (missing impl modules) before Task 2 landed. No `refactor` commit was needed.

## Self-Check: PASSED

- Created files: all 8 present (`types.ts`, `invalidationMap.ts`, `SSEProvider.tsx`, `useSSE.ts`, `useSSEStatus.ts`, `index.ts`, `SSEProvider.test.tsx`, `docs/sse-invalidation-contract.md`) + `src/test/setup.ts` modified.
- Commits: `ec8beeb4`, `ae4c7c03`, `a1ab11fd` all in `git log`.
- STATE.md / ROADMAP.md: untouched (orchestrator owns those writes).
