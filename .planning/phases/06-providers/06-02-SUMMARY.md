---
phase: 06-providers
plan: 02
subsystem: ui
tags: [sse, providers, chrome, topbar, pageheader, sonner, toast, eventsource, react-19]

requires:
  - phase: 06-providers (Plan 06-01)
    provides: "SSEProvider, useSSEStatus() → {connected, lastEventAt}, useSSE(), global EventSource test stub"
  - phase: 04 (Plan 04-05)
    provides: "RetroToaster (sonner skin) + retroToast (.promise forwarded), RetroStatusDot atom"
  - phase: 03 (Plans 03-01/03-06)
    provides: "ShortcutsProvider mounted in App.tsx"
provides:
  - "RetroToaster mounted once at the App.tsx root (sibling of the router subtree under QueryClientProvider) — toasts render on /login and survive navigation"
  - "SSEProvider mounted inside WorkspaceProvider in AppShell (valid wsId + authed session)"
  - "AppShell split into a ShellChrome child under SSEProvider so chrome can consume useSSEStatus()"
  - "TopBar ONLINE dot + sse-slot RetroStatusDot bound to live useSSEStatus().connected"
  - "PageHeader LAST SYNC bound to formatted lastEventAt (HH:MM:SS) with '—' fallback"
  - "e2e/sse-online.spec.ts — live-stack ONLINE-dot smoke (collected, deferred to phase gate)"
affects:
  - "Phases 7-10 (feature pages render inside AppShell under the now-live SSEProvider; query invalidation flows once entities emit events)"

tech-stack:
  added: []
  patterns:
    - "Provider-consumer split: AppShell renders WorkspaceProvider > SSEProvider > ShellChrome so the chrome reads useSSEStatus() from BELOW the provider it would otherwise also render"
    - "Dumb-atom feeding (Pitfall 6): TopBar maps connected→'live'/'idle' and feeds RetroStatusDot its `state` prop; the atom never imports SSE"
    - "Optional-prop-defaults-from-hook: TopBar keeps `online?: boolean` for test injectability, defaulting to useSSEStatus().connected when omitted"

key-files:
  created:
    - frontend2/src/components/retro/feedback/RetroToast.mount.test.tsx
    - frontend2/src/App.shortcuts.test.tsx
    - frontend2/e2e/sse-online.spec.ts
  modified:
    - frontend2/src/App.tsx
    - frontend2/src/components/layout/AppShell.tsx
    - frontend2/src/components/layout/AppShell.test.tsx
    - frontend2/src/components/layout/TopBar.tsx
    - frontend2/src/components/layout/TopBar.test.tsx

key-decisions:
  - "AppShell wiring of online/lastSync folded into Task 1's atomic restructure (the WorkspaceProvider > SSEProvider > ShellChrome split is a single indivisible change); Task 2 then wired the TopBar/PageHeader leaf consumers"
  - "TopBar reads useSSEStatus() directly (satisfies the Task 2 grep + feeds the sse-slot) while keeping the `online` prop, defaulted from the hook — both designs the plan offered, combined safely"
  - "PageHeader needed NO source change — it already accepted lastSync with a '—' fallback; the binding is the formatted lastEventAt threaded by AppShell"
  - "PROV-03 verified structurally (position + barrel-import asserts) rather than via a full-tree render-without-throw probe, which hung a vitest fork worker; the non-throw guarantee is already covered by AppShell.test rendering the real shell under ShortcutsProvider"

patterns-established:
  - "ShellChrome child component: the status-consuming chrome must live under SSEProvider, not beside it"
  - "Format last-sync as local HH:MM:SS; null → undefined so PageHeader falls back to '—'"

requirements-completed: [PROV-01, PROV-03, PROV-04]

duration: ~30min
completed: 2026-06-13
---

# Phase 6 Plan 02: Providers Mount + Chrome Wiring Summary

**RetroToaster mounted at the App root + SSEProvider mounted inside WorkspaceProvider in AppShell, with the TopBar ONLINE dot / sse-slot RetroStatusDot and PageHeader LAST SYNC bound to live `useSSEStatus()`, plus a `retroToast.promise` mount proof and a live-stack SSE smoke spec.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-13T03:06:00Z
- **Completed:** 2026-06-13T03:28:00Z
- **Tasks:** 3
- **Files modified:** 8 (5 modified, 3 created)

## Accomplishments
- `RetroToaster` mounted once at the `App.tsx` root as a sibling of the router subtree (under `QueryClientProvider`) — toasts render on `/login` and persist across navigation; the shipped `I18n > Router > Query > Shortcuts > ModalStack` chain is unchanged (append-only, PROV-01).
- `SSEProvider` mounted inside `WorkspaceProvider` in `AppShell`, guaranteeing a valid wsId (D-12) + an authed session. `AppShell` was split into a `ShellChrome` child rendered UNDER `SSEProvider`, so the chrome can read `useSSEStatus()` (a component cannot consume a context it also renders).
- TopBar ONLINE dot + `sse-slot` `RetroStatusDot` bound to live `useSSEStatus().connected` (mint/`live` when connected, faint/`idle` when not). The `RetroStatusDot` atom keeps ZERO SSE imports — Pitfall 6 guard (RetroStatusDot.test.tsx:68) stays green.
- PageHeader LAST SYNC bound to the formatted `lastEventAt` (local `HH:MM:SS`) threaded by `AppShell`, with the `—` placeholder fallback when `lastEventAt` is null.
- `RetroToast.mount.test.tsx` drives `retroToast.promise(loading→success)` against the mounted `RetroToaster` (PROV-04 / SC4). ShortcutsProvider position pinned (PROV-03, verify-only — not moved, not rebuilt). `e2e/sse-online.spec.ts` added and collected by `playwright --list`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount RetroToaster (App root) + SSEProvider (AppShell)** — `d83e9733` (feat)
2. **Task 2: Wire chrome — TopBar online + sse-slot RetroStatusDot, PageHeader LAST SYNC** — `26809e76` (feat; TDD RED→GREEN — the RED TopBar tests and GREEN wiring landed together in one commit)
3. **Task 3: Verify ShortcutsProvider + retroToast.promise; SSE e2e smoke; full gate** — `c3934c30` (test)

## Files Created/Modified
- `frontend2/src/App.tsx` — append `<RetroToaster />` at root; update the canonical provider-order comment (modified)
- `frontend2/src/components/layout/AppShell.tsx` — `WorkspaceProvider > SSEProvider > ShellChrome`; `ShellChrome` reads `useSSEStatus()` and threads `online`/`lastSync`; `formatLastSync` helper (modified)
- `frontend2/src/components/layout/AppShell.test.tsx` — assert exactly one EventSource opens at `/workspaces/{id}/sse` with `withCredentials` (modified)
- `frontend2/src/components/layout/TopBar.tsx` — read `useSSEStatus()`; default ONLINE dot from `connected`; replace static `● live` with `<RetroStatusDot state={connected ? "live" : "idle"} />` (modified)
- `frontend2/src/components/layout/TopBar.test.tsx` — mock `@/features/sse`; assert sse-slot live↔idle + ONLINE-dot default (modified)
- `frontend2/src/components/retro/feedback/RetroToast.mount.test.tsx` — `retroToast.promise` loading→success mount proof (created)
- `frontend2/src/App.shortcuts.test.tsx` — ShortcutsProvider position + barrel-import asserts (created)
- `frontend2/e2e/sse-online.spec.ts` — live-stack ONLINE-dot smoke (created)

## Decisions Made
- **AppShell online/lastSync wiring folded into Task 1.** The `WorkspaceProvider > SSEProvider > ShellChrome` restructure is a single indivisible change; the `online`/`lastSync` prop threading rides with it. Task 2 then wired the leaf consumers (TopBar reads the hook for the sse-slot; PageHeader was already correct). Net effect matches the plan's "structure AppShell so the chrome lives in a child under SSEProvider" NOTE.
- **TopBar reads `useSSEStatus()` directly AND keeps the `online` prop.** The plan offered two designs; combining them is safe: the prop (defaulted from the hook) preserves test injectability, while the direct read feeds the sse-slot `RetroStatusDot` and satisfies the Task 2 verify grep (`useSSEStatus` in TopBar.tsx).
- **PageHeader unchanged.** It already accepted `lastSync` with a `—` fallback (Phase 3 left the slot stable); the live binding is purely the AppShell-threaded formatted `lastEventAt`.

## Deviations from Plan

None of substance — plan executed as written. One within-discretion adjustment to the PROV-03 verification approach:

### Adjustment

**1. [Rule 3 - Blocking] PROV-03 verified structurally instead of via a full-tree render-without-throw probe**
- **Found during:** Task 3 (ShortcutsProvider position verification)
- **Issue:** The plan suggested "a child that calls `useShortcuts` mounts without throwing under the App tree." Rendering the full provider graph (router + QueryClient + Shortcuts + ModalStack + a `useShortcuts` consumer) in an isolated spec left an open handle that hung the vitest fork worker (~376s worker-termination timeout; tests reported 0ms then never exited — reproduced with both `forks` and `threads` pools).
- **Fix:** Replaced the render-probe with two structural asserts: (a) `ShortcutsProvider` sits inside `BrowserRouter`/`QueryClientProvider` and above `ModalStackProvider > AppRoutes` (position not moved), and (b) it is imported from the shipped `@/components/shortcuts` barrel (not rebuilt). The render-without-throw guarantee is ALREADY covered by `AppShell.test.tsx`, which renders the real shell — whose `Bottombar` consumes `useShortcutsContext()` (throws outside the provider) — under `ShortcutsProvider` without error.
- **Files modified:** frontend2/src/App.shortcuts.test.tsx
- **Verification:** `vitest run src/App.shortcuts.test.tsx` → 2 passed in 745ms (no hang); full suite green.
- **Committed in:** c3934c30 (Task 3 commit)

---

**Total deviations:** 1 adjustment (PROV-03 verification method). No scope change — PROV-03 remains honestly verified.
**Impact on plan:** None on deliverables; the verification is equally strong and does not leak a worker handle.

## Issues Encountered
- **Worktree had no `node_modules`.** Ran `bun install --frozen-lockfile` (318 packages) before any test — expected per the parallel-execution note.
- **vitest fork-worker hang on a full-tree isolated render** (see Deviation 1) — resolved by switching PROV-03 to structural asserts.

## Verification
- `npx vitest run` → **335 passed (53 files)** — +7 over Plan 06-01's 328, no regressions.
- `npx tsc -b --noEmit` → **clean (exit 0)**.
- `npx vite build` → **built in 722ms** (dist gzip 138.83 kB main bundle).
- `node ../scripts/check-forbidden-imports.mjs src` → **OK** (online-only guard clean).
- `npx playwright test --list` → **exit 0**; `sse-online` collected in both chromium + firefox (20 tests / 3 files).
- Hard gates: `useSSEStatus` + `RetroStatusDot` present in TopBar.tsx; `RetroStatusDot.tsx` has ZERO `useSSE|EventSource` imports (Phase 4 guard green); exactly one EventSource opens under AppShell at `/workspaces/{id}/sse` with `withCredentials`.

## Threat Surface
- T-06-05 (RetroStatusDot coupling) — mitigated: atom stays dumb; the Phase 4 no-SSE-import guard is re-asserted green.
- T-06-06/T-06-07 — chrome renders only `connected` (boolean) + formatted `lastEventAt` (timestamp), never raw event payload; status reads the coarse (≥1s) split STATUS context from Plan 06-01.
- No new security-relevant surface introduced (no new endpoints/auth paths/schema). No threat flags.

## Known Stubs
None. The bell slot remains an intentional Phase-13 reserved placeholder (out of scope, unchanged).

## Next Phase Readiness
- The provider stack is fully wired: feature pages (Phases 7-10) render inside `AppShell` under a live `SSEProvider`; once their entities emit backend events, `INVALIDATION_MAP` rows (appended per the 06-01 contract) will drive query invalidation with no further chrome work.
- Manual 06-VALIDATION checks (kill backend → dot drops/recovers; create entity in another tab → LAST SYNC ticks) and the full `sse-online` e2e run are deferred to the orchestrator phase gate (need the live stack up).

## Self-Check: PASSED

- Created files: all present (`RetroToast.mount.test.tsx`, `App.shortcuts.test.tsx`, `e2e/sse-online.spec.ts`, `06-02-SUMMARY.md`); modified files committed (`App.tsx`, `AppShell.tsx`, `AppShell.test.tsx`, `TopBar.tsx`, `TopBar.test.tsx`).
- Commits: `d83e9733`, `26809e76`, `c3934c30` all in `git log`.
- STATE.md / ROADMAP.md: untouched (orchestrator owns those writes).

---
*Phase: 06-providers*
*Completed: 2026-06-13*
