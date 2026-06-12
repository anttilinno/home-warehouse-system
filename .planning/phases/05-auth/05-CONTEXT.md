# Phase 5: Auth - Context

**Gathered:** 2026-06-13 (synthesized by orchestrator — autonomous run)
**Status:** Ready for planning
**Source:** ROADMAP Phase 5 + parity plan §4 + docs/audit/BACKEND-SECURITY.md F2/F3 + STATE decisions

<domain>
## Phase Boundary

Full auth surface for frontend2 + the backend logout-revocation fix:

1. **Login page completion** — email/password exists (Phase 1); add register flow, Google OAuth, GitHub OAuth, env-gated Authelia SSO button (AUTH-01..04, AUTH-11).
2. **RequireAuth hardening** — redirect unauthenticated to /login; NEVER logout on transient network errors, only on HttpError 401/403 (AUTH-05, the v2.0 spurious-logout fix).
3. **Workspace switcher** — TopBar pill becomes a real switcher; replaces DashboardPage first-workspace hardcode; selected workspaceId = SSOT for all entity API calls (AUTH-06). **D-12 (decided 2026-06-13, record in STATE.md):** workspace state = React context (`WorkspaceProvider`) holding `currentWorkspaceId`, persisted to localStorage, initialized from `/users/me/workspaces` (first workspace fallback). NOT a route param — avoids a routing-tree rework; deep links remain workspace-implied. All entity query keys MUST include the workspaceId value; entity hooks take wsId explicitly from `useWorkspace()`.
4. **Sessions management** — list active sessions, revoke one / all-others, current-session badge (AUTH-07). Settings → Security page skeleton lives here (full Settings hub is Phase 12 — build the Security subpage now, hub shell can be minimal route).
5. **Password change** — current-password verification, zod 8+ chars, OAuth-only "set password" path (AUTH-08).
6. **Account deletion** — type-DELETE confirm (RetroConfirmDialog), can-delete check, sole-owner workspace validation surfaced (AUTH-09).
7. **Connected accounts** — link/unlink Google + GitHub with last-method-removal lockout guard (AUTH-10).
8. **BACKEND FIX (AUTH-12, audit F2+F3 — inseparable pair):**
   - F2: `POST /auth/logout` must revoke the session server-side (look up by HashToken(refreshToken), delete session row) + clear cookies.
   - F3: refresh handler must NOT re-create a session when `FindByTokenHash` → `ErrSessionNotFound` ("legacy token" fallback re-opens revoked sessions). Revoked = 401, full stop. Fixing F2 without F3 leaves revocation bypassable.
   - Backend Go work follows backend conventions; integration test per `tests/testdb` harness pattern (CLAUDE.md): logout → refresh with old token → 401.

NOT in phase: notifications bell, SSE indicator (Phase 6), full settings hub (Phase 12), avatar upload (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Locked
- **D-12 (workspace state):** context + localStorage as above. Record in STATE.md decisions on phase completion.
- Cookie-JWT + `credentials: "include"` + single-flight 401 refresh in `lib/api.ts` are LOCKED INVARIANTS (parity plan §1) — extend, never restructure. The Vite `/api` → root proxy rewrite is load-bearing.
- OAuth flow shape (backend already implements): initiate → provider → callback → one-time code exchange (Redis) → cookie set. Frontend: initiate buttons + `/auth/callback` route handling code exchange + error states. Auto-link by verified email; unverified rejected (backend enforces; frontend surfaces error).
- Authelia button: visible only when env-configured — frontend env flag `VITE_AUTHELIA_ENABLED` (build-time) OR a backend-driven config probe if one exists; researcher determines which. Routes to `/auth/authelia/login` at the BARE ingress path (NOT through /api proxy — commit 8e13faf precedent).
- Logout UI (TopBar confirm from Phase 3) wires to fixed `POST /auth/logout`; client clears query cache + workspace context on logout.
- RequireAuth: distinguish HttpError(401/403) → logout+redirect vs network/5xx → stay + error surface (retry affordance).
- Login/register/OAuth UI per sketch 007 (validated login chrome) — primary vs OAuth hierarchy already validated there.

### Claude's Discretion
- Settings route skeleton structure (Phase 12 will fill the hub; keep minimal but stable paths e.g. /settings/security, /settings/accounts).
- Session list presentation details; register form field set (match backend contract).
- Where `/auth/callback` route lives and its loading/error states.

</decisions>

<canonical_refs>
## Canonical References

### MUST READ
- `docs/audit/BACKEND-SECURITY.md` — F2 (handler.go:324) + F3 (handler.go:264-310) full details
- `frontend2/src/lib/api.ts` — locked auth client invariants (cookie-JWT, single-flight refresh, HttpError)
- `backend/internal/domain/auth/user/handler.go` — logout + refresh handlers to fix
- `backend/internal/domain/auth/` — OAuth + session endpoints (the real contract; trust code over docs)
- `frontend2/e2e/login-dashboard.spec.ts` — login E2E contract (extend, don't break)
- `CLAUDE.md` — E2E + Go integration test conventions (tests/testdb harness)
- sketch 007 (`.planning/sketches/007-retro-os-login/`) — login/forms chrome
- `.planning/phases/03-layout-primitives-bottombar/03-04-SUMMARY.md` — TopBar reserved slots + logout confirm contracts

### Legacy STRUCTURE refs
- `frontend/features/auth/social-login.tsx`, `(auth)/auth/callback`, `components/dashboard/workspace-switcher.tsx`, settings/security pages

</canonical_refs>

<specifics>
## Specific Ideas

- Workspace switcher in TopBar pill slot (reserved in Phase 3): popover listing workspaces, current checked, switch updates context + invalidates queries.
- On 401-refresh-failure: single place (api.ts) emits auth-expired → RequireAuth redirects; no scattered logout calls.
- Go integration test (build tag integration): login → logout → attempt refresh with captured refresh cookie → expect 401; revoked-session refresh must NOT mint a new session (F3 regression guard).
- E2E additions: register flow (unique email), logout actually revokes (re-use of old session fails), workspace switcher visible. OAuth E2E: skip-with-reason (no provider creds in CI) per parity plan §7.

</specifics>

<deferred>
## Deferred Ideas

- Avatar upload, full settings hub chrome, notification prefs (Phase 12).
- Members management (Phase 12, SETT-10).
- Other audit findings (F1 attachment IDOR → Phase 14b; F4-F17 → backlog/phase-appropriate).

</deferred>

---

*Phase: 05-auth*
*Context synthesized: 2026-06-13 (autonomous orchestrator). D-12 decided here.*
