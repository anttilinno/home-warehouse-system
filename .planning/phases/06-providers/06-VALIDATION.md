---
phase: 6
slug: providers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 6 — Validation Strategy

> ~80% mounting verified pieces, ~20% new (SSEProvider). Backend contract
> live-verified in research (cookie auth, named events, keepalive 30s).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + RTL (EventSource class stub — jsdom has none); Playwright vs live stack |
| **Config file** | `frontend2/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `cd frontend2 && bun run test src/features/sse/` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build && bun run lint:imports && bun run lint:tsc` |
| **Estimated runtime** | ~45s full |

---

## Sampling Rate

- **After every task commit:** affected specs
- **After every plan wave:** full suite + build + lint
- **Before phase verification:** full suite + live E2E (ONLINE dot connected)
- **Max feedback latency:** 45s

---

## Per-Requirement Verification Map

| Requirement | Behavior to prove | Test Type |
|-------------|-------------------|-----------|
| PROV-01 | Canonical provider tree mounts (RetroToaster at App root; SSEProvider inside WorkspaceProvider in AppShell) — render test asserts presence/nesting | unit |
| PROV-02 | SSEProvider: single EventSource (cookie auth — NO token in URL, grep gate), named-event listeners (not onmessage), reconnect backoff (fake timers), close+reopen on wsId change, clean close on auth-expired/unmount, StrictMode-safe; useSSEStatus {connected, lastEventAt} updates without re-rendering event consumers; useSSE({onEvent}) subscribe/cleanup | unit |
| Invalidation contract | Dispatcher: event entity_type (lowercased — ITEM gotcha) → invalidateQueries([entityPlural, wsId]) per the static map; contract DOC exists listing map + prefix convention | unit + grep |
| Chrome wiring | TopBar online prop + StatusDot in sse-slot bound to useSSEStatus; PageHeader lastSync bound to lastEventAt (replaces "—") | unit |
| PROV-03 | ShortcutsProvider position verified in tree (no rebuild — Phase 3 artifact) | unit (tree assert) |
| PROV-04 | RetroToaster mounted at root; retroToast.promise works (test) | unit |
| E2E | After login, ONLINE dot reaches connected state vs live stack | e2e (phase gate) |

---

## Wave 0 Requirements

- [ ] EventSource test stub (class with addEventListener/close + emit helpers) BEFORE SSEProvider tests
- [ ] Grep gate from first SSE commit: no `?token=` / JWT in EventSource URL

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Reconnect behavior on real network blip | timing/visual | kill backend 5s, watch dot drop + recover |
| LAST SYNC ticking on real events | visual | create an entity in another tab, watch meta line |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
