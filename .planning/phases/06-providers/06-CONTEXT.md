# Phase 6: Providers - Context

**Gathered:** 2026-06-13 (synthesized by orchestrator — autonomous run)
**Status:** Ready for planning
**Source:** ROADMAP Phase 6 + parity plan §4 + Phases 3-5 shipped state

<domain>
## Phase Boundary

1. **SSEProvider (PROV-02 — the real new work):** single EventSource per app to `GET /workspaces/{wsId}/sse` (wsId from useWorkspace/D-12), auto-reconnect with backoff, `useSSEStatus()` → `{connected, lastEventAt}`, `useSSE({onEvent})` subscribe API. Re-opens on workspace switch.
2. **Event→query-invalidation contract DOC (parity §8 risk 8):** deliverable markdown (`frontend2/docs/sse-invalidation-contract.md` or similar) mapping event entity types → TanStack Query key prefixes, PLUS the generic dispatcher in SSEProvider that performs invalidation from that map — Phases 7-10 only register keys.
3. **Chrome wiring:** TopBar ONLINE dot binds to useSSEStatus().connected; PageHeader LAST SYNC binds to lastEventAt (replaces the "—" placeholder); RetroStatusDot (Phase 4 atom) gets mounted in the TopBar SSE slot showing live state.
4. **Provider stack order (PROV-01):** canonical mount order in App.tsx/main.tsx.
5. **PROV-03/PROV-04 reconciliation:** ShortcutsProvider ALREADY SHIPPED (Phase 3, 03-01 — register-by-id + cleanup, behaviorally equivalent to the legacy port the requirement describes). RetroToaster (sonner retro skin) ALREADY SHIPPED as an atom (Phase 4, 04-05). Phase 6 work = ensure RetroToaster is MOUNTED app-wide in the canonical stack + `retroToast.promise` ergonomics verified; ShortcutsProvider position verified in the stack. Do NOT rebuild either; requirement prose predates Phases 3-4 delivery.

NOT in phase: notifications bell/dropdown (Phase 13), per-feature invalidation registrations (Phases 7-10 register keys against the contract), HUD (13).

</domain>

<decisions>
## Implementation Decisions

### Stale-spec corrections (verify in research, then treat as authoritative)
- **"AuthProvider" in PROV-01 order:** frontend2 has NO AuthProvider — auth = cookie-JWT in api.ts + RequireAuth guard (locked invariants). The canonical stack omits it (or treats RequireAuth as the auth layer). Do not invent an AuthProvider to satisfy stale prose; preserve the SPIRIT: providers mount once, in a deterministic order, chrome wires to real state.
- **"JWT in URL query param" in PROV-02:** legacy needed it cross-origin. frontend2 is same-origin via the Vite/api proxy — EventSource sends cookies automatically same-origin. RESEARCH MUST verify how backend `/workspaces/{id}/sse` authenticates (cookie vs query token). If cookie works: use cookie (NEVER put JWT in URL — it leaks via logs/referrer). If backend only accepts query-token: flag it and use the existing backend contract, noting the security tradeoff. Spirit of the requirement: authenticated SSE connection; transport detail follows the actual backend.
- **Provider order:** final order = `I18nProvider(lingui) > QueryClientProvider > BrowserRouter > [RequireAuth → WorkspaceProvider > SSEProvider > ShortcutsProvider + ModalStackProvider...]` — exact composition decided by research against what Phases 3-5 already mounted (WorkspaceProvider/ShortcutsProvider/ModalStackProvider live inside the authed AppShell branch today). SSEProvider needs wsId → must sit under WorkspaceProvider, NOT above the router. Preserve shipped structure; the ROADMAP's literal order is premium-terminal-era prose. Record the FINAL canonical order in the contract doc.

### Locked
- ONE EventSource app-wide; reconnect with capped exponential backoff (legacy sse-context is the structure reference); close + reopen on wsId change; clean close on logout (auth-expired / unmount).
- Invalidation dispatcher: generic — `event.entity_type` → invalidate registered key prefixes (workspace-scoped). Contract doc is the SSOT; feature phases append rows.
- StatusDot: props-driven Phase 4 atom consumes useSSEStatus — no SSE import inside the atom (keeps Phase 4 test guarantee).
- No new deps.

### Claude's Discretion
- Backoff parameters, lastEventAt tick granularity, contract doc location/format, how useSSE consumers unsubscribe (cleanup contract).

</decisions>

<canonical_refs>
## Canonical References

- `backend/internal/server or domain SSE handler` — find the real SSE endpoint + auth (research)
- `frontend/lib/contexts/sse-context.tsx` + `frontend/lib/hooks/use-sse.ts` + `frontend/components/ui/sse-status-indicator.tsx` — legacy STRUCTURE
- `.planning/phases/03-layout-primitives-bottombar/03-04-SUMMARY.md` (TopBar slots) + 03-06-SUMMARY (AppShell provider nesting)
- `.planning/phases/04-retro-atoms/04-03-SUMMARY.md` (RetroStatusDot contract) + 04-05-SUMMARY (RetroToaster)
- `.planning/phases/05-auth/05-03-SUMMARY.md` (WorkspaceProvider) + 05-02-SUMMARY (auth-expired event)
- `frontend2/src/App.tsx` + routes (current mount order)

</canonical_refs>

<specifics>
## Specific Ideas

- `useSSEStatus` selector must not re-render consumers on every event — separate status context value (connected/lastEventAt) updated coarsely (e.g. lastEventAt min 1s granularity) from the event fan-out path.
- Vitest: EventSource mock (class stub) — connection lifecycle, reconnect on error (fake timers), event dispatch → invalidation map, wsId switch reopens, status selector updates.
- E2E (live stack): after login, ONLINE dot shows connected within timeout (backend SSE genuinely works through the Vite proxy — NOTE: verify proxy handles SSE streaming; vite http-proxy does support it, but confirm).

</specifics>

<deferred>
- Notifications bell + unread badge (Phase 13, NOTIF-01..03).
- Per-entity invalidation registrations (Phases 7-10).
</deferred>

---

*Phase: 06-providers — UI note: no new UI-SPEC needed; visuals covered by 03-UI-SPEC (TopBar slot) + 04-UI-SPEC (StatusDot, toasts). Orchestrator waives the UI gate with this justification.*
