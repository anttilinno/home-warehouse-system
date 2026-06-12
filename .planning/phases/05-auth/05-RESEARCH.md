# Phase 5: Auth - Research

**Researched:** 2026-06-13
**Domain:** Cookie-JWT auth UX (login/register/OAuth/sessions/workspace switcher) on React 19 + RR7 + TanStack Query; Go/huma backend auth-surface integration; logout-revocation regression guard
**Confidence:** HIGH (backend code read verbatim; frontend2 chrome read verbatim; test harnesses confirmed by example)

> **Working-directory note:** The global `~/.claude/CLAUDE.md` describes a different project (ROT-MUD). The authoritative project context is the repo-local `CLAUDE.md` (Go backend + `frontend2` Bun/Vite). All conventions below follow the repo-local file.

## Summary

Phase 5 is overwhelmingly **frontend wiring against an already-complete backend**. Reading the actual Go code (not the docs) reveals the entire auth surface — register, login, refresh, logout, OAuth initiate/callback/exchange, Authelia SSO, sessions list/revoke, password change, account deletion, connected-accounts link/unlink, `/users/me`, `/users/me/workspaces` — is **already implemented and route-wired** in `backend/internal/api/router.go`. The frontend2 side currently has only a bare email/password `LoginPage`, a (already-correct) `RequireAuth`, a `handleLogout` stub that merely navigates, and a hardcoded `workspaces.data?.[0]?.id` in `DashboardPage`. Phase 5 fills the gap: register form, OAuth buttons + `/auth/callback` route, env-gated Authelia button, a real `WorkspaceProvider` (D-12), a Settings → Security/Accounts skeleton, and the logout call that actually hits the fixed endpoint.

**The single most important finding: AUTH-12 (F2 + F3) is ALREADY FIXED in the backend code.** Commit `f49e4b48` ("fix(backend): tenant isolation threading + security hardening (F1-F20)") rewrote `logout` to read the `refresh_token` cookie and call `sessionSvc.Revoke`, and rewrote `refreshToken` to reject `ErrSessionNotFound` with 401 and NO legacy-token fallback (handler.go:327-344 and :268-289). The audit doc `docs/audit/BACKEND-SECURITY.md` describes the **pre-fix** state and was never updated. Phase 5's AUTH-12 backend work is therefore **not "write the fix" but "write the regression-guard integration test"** that proves logout→refresh-with-old-token→401, plus update the stale audit doc. **This must be verified by the planner with a fresh `git show f49e4b48` read before locking, but the working-tree code is unambiguous.**

**Second-most-important finding (a real, undocumented backend gap): `WithCurrentSessionID` is dead code.** `JWTAuth` middleware (auth.go:35-88) never calls it, so `GetCurrentSessionID` always returns `(uuid.Nil, false)`. Consequences for AUTH-07: the sessions-list `is_current` badge is always `false`, `revokeAllOtherSessions` returns 400 "current session not found" (unusable), and `revokeSession` cannot protect the current session. This is a backend task the audit did not catch and the planner must include if AUTH-07's "current-session badge" and "revoke all-others" are to function.

**Primary recommendation:** Treat Phase 5 as ~80% frontend integration + 2 backend tasks (logout-revocation integration test; wire `WithCurrentSessionID` into `JWTAuth` so AUTH-07 works). Do NOT restructure `lib/api.ts` (locked invariant) — extend it with a logout helper + an auth-expired event. Build `WorkspaceProvider` per D-12 (context + localStorage + `queryClient.invalidateQueries`, NOT the legacy `window.location.reload()`). Reuse the existing `NewTestServer` Go integration harness and the existing Playwright live-stack spec pattern verbatim.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Credential verification, token mint | API/Backend | — | `userHandler.login/register`; already done |
| Session creation + revocation (SSOT) | API/Backend | DB | `session.Service` + `sessions` table; revocation is server-authoritative (F2/F3) |
| OAuth provider handshake + PKCE | API/Backend | Redis (one-time code) | `oauth.Handler.Initiate/Callback/ExchangeCode`; already done |
| Authelia trusted-header exchange | API/Backend (ingress) | — | `authelia.Handler`; trust boundary is the ingress shared secret |
| Cookie-JWT transport + single-flight refresh | Browser/Client | — | `lib/api.ts` LOCKED invariant |
| Auth-state routing (redirect vs stay) | Frontend (RR7 guard) | — | `RequireAuth`; status-aware (HttpError 401/403 → redirect) |
| Workspace selection (SSOT for entity calls) | Frontend (Context + localStorage) | — | D-12: `WorkspaceProvider`; NOT a route param |
| OAuth callback code exchange | Frontend (`/auth/callback`) | API (exchange) | one-time code → `POST /auth/oauth/exchange` → cookies |
| Authelia button visibility gate | Frontend (build-time env) | — | `VITE_AUTHELIA_ENABLED` — backend has NO config-probe endpoint |
| Session/account management UI | Frontend (Settings pages) | API | thin forms over existing endpoints |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` / `react-dom` | 19.x | UI | project baseline (Phase 1) `[VERIFIED: package.json]` |
| `react-router` | 7.x (library mode) | routing; `/auth/callback` route | AP-1 locked; library mode (NOT framework) `[VERIFIED: routes/index.tsx]` |
| `@tanstack/react-query` | v5 | server state; auth probe, sessions, workspaces | already in use `[VERIFIED: RequireAuth.tsx]` |
| `react-hook-form` + `@hookform/resolvers` | current | forms | `LoginPage` already uses it `[VERIFIED: LoginPage.tsx]` |
| `zod` | 4.x (`z.email()` API) | validation (8+ char password etc.) | `LoginPage` uses `z.email()` (v4 syntax) `[VERIFIED: LoginPage.tsx:13]` |
| `@lingui/react` | current | i18n `<Trans>` / `useLingui` | all chrome uses it `[VERIFIED]` |

### Supporting (testing)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^4.1.5 | unit/component tests | all `*.test.tsx` `[VERIFIED: package.json]` |
| `msw` | ^2.14.2 | mock auth endpoints in unit tests | login/register/OAuth-error flows without live backend `[VERIFIED: package.json]` |
| `@testing-library/react` + `user-event` | 16.x / latest | component interaction | forms, menus `[VERIFIED]` |
| `@playwright/test` | ^1.59.1 | live-stack E2E (2 projects: chromium+firefox) | login/register/logout-revocation vs running stack `[VERIFIED: playwright.config.ts]` |
| Go `testing` + `testify` + `tests/integration` harness | — | backend logout-revocation integration test | `NewTestServer` + `//go:build integration` `[VERIFIED: setup.go]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Context + localStorage (D-12) | route param `/w/:wsId/...` | **REJECTED by D-12** — routing-tree rework; deep links stay workspace-implied |
| `window.location.reload()` on workspace switch (legacy) | `queryClient.invalidateQueries()` | reload is jarring + drops in-memory refresh token; invalidate is the modern path (see Pitfall 6) |
| Build-time `VITE_AUTHELIA_ENABLED` | backend config-probe endpoint | **no probe endpoint exists** (verified); env flag is the only option without new backend work |

**Installation:** No new runtime dependencies required. Every library above is already in `frontend2/package.json` and the Go module. **Phase 5 installs nothing new** — Package Legitimacy Audit is N/A (see below).

## Package Legitimacy Audit

**No external packages are installed in this phase.** All required libraries (React, RR7, TanStack Query, react-hook-form, zod, lingui, vitest, msw, Playwright, testify) are already present in `frontend2/package.json` and the Go `go.mod`. slopcheck/registry verification is not applicable. If a plan unexpectedly proposes a new package (e.g. an OAuth helper lib), gate it behind a `checkpoint:human-verify` task — none is needed for the researched scope.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────── frontend2 (Vite :5173) ───────────────────────────┐
 user ── /login ───────► │ LoginPage (email/pw + OAuth buttons + Authelia[env-gated])                   │
                         │     │ email/pw: post("/auth/login")  ──┐                                      │
                         │     │ register: post("/auth/register") ─┤  (via lib/api.ts, /api proxy)        │
                         │     │ OAuth:  window.location = BACKEND/auth/oauth/{provider}  (full-page) ──┐ │
                         │     │ Authelia: window.location = "/auth/authelia/login" (BARE ingress) ───┐ │ │
                         │     ▼                                                          │            │ │ │
   provider redirect ◄───┼── /auth/callback?code=... ◄── backend redirect (AppURL) ◄─────┘            │ │ │
                         │     │ post("/auth/oauth/exchange", {code})  ──► cookies set                 │ │ │
                         │     ▼                                                                        │ │ │
                         │  RequireAuth (probes ["workspaces"]) ── 401/403 ─► /login ; ok ─► AppShell   │ │ │
                         │     │                                                                        │ │ │
                         │  WorkspaceProvider (currentWorkspaceId: ctx + localStorage)  ◄── SSOT ──────┐│ │ │
                         │     │ entity query keys ALL include wsId  ───► get("/workspaces/{wsId}/...") ││ │ │
                         │  TopBar switcher → setWorkspace → queryClient.invalidateQueries()  ──────────┘│ │ │
                         │  TopBar logout → post("/auth/logout") + clear cache + clear ws ctx ──┐        │ │ │
                         └───────────────────────────────────────────────────────────────────│────────┘ │ │
                                                                                  /api rewrite │ bare ────┘ │ ingress→Authelia
                         ┌──────────────────── backend (Go/huma :8080, routes at ROOT) ────────▼───────────▼─┐
                         │ /auth/login /register /refresh /logout   (public, rate-limited 20/min)            │
                         │ /auth/oauth/{provider} /callback /exchange  (Redis one-time code)                 │
                         │ /auth/authelia/login (if AUTHELIA_ENABLED; trusted Remote-* + shared secret)      │
                         │ JWTAuth middleware ─► protected: /users/me, /users/me/workspaces,                 │
                         │   /users/me/sessions (list/revoke), /users/me/password, DELETE /users/me,         │
                         │   /auth/oauth/accounts (list/unlink)                                              │
                         │ session.Service.Revoke/FindByTokenHash  ◄── refresh validates session exists ────┤
                         └──────────────────────────────── Postgres (sessions, users, oauth_accounts) ──────┘
```

### Recommended Project Structure (frontend2 additions)
```
src/
├── features/auth/
│   ├── LoginPage.tsx          # EXISTS — extend: register link, OAuth buttons, Authelia (env)
│   ├── RegisterPage.tsx       # NEW — mirrors LoginPage; fields: email, full_name, password
│   ├── OAuthCallbackPage.tsx  # NEW — /auth/callback: read code|error, exchange, redirect
│   ├── RequireAuth.tsx        # EXISTS — already status-aware; add network/5xx affordance (Pitfall 1)
│   ├── SocialLoginButtons.tsx # NEW — Google/GitHub/Authelia(gated) full-page redirects
│   ├── useLogout.ts           # NEW — post("/auth/logout") + clearRefreshToken + queryClient.clear + ws reset
│   └── oauthErrors.ts         # NEW — error-code → i18n message map (taxonomy below)
├── features/workspace/
│   ├── WorkspaceProvider.tsx  # NEW (D-12) — context + localStorage; init from ["workspaces"]
│   └── useWorkspace.ts        # NEW — { currentWorkspaceId, setWorkspace, workspaces }
├── features/settings/
│   ├── SettingsLayout.tsx     # NEW — minimal hub shell (Phase 12 fills it); stable /settings/* paths
│   ├── SecurityPage.tsx       # NEW (/settings/security) — sessions list + password change
│   └── AccountsPage.tsx       # NEW (/settings/accounts) — connected accounts + delete account
└── lib/api.ts                 # EXISTS — LOCKED; add logout() + auth-expired event ONLY
```

### Pattern 1: WorkspaceProvider (D-12 — the SSOT)
**What:** A React context holding `currentWorkspaceId`, persisted to localStorage, initialized from `GET /users/me/workspaces` (first workspace fallback). Switching invalidates queries — does NOT reload the page.
**When to use:** Mounted above all authenticated routes (inside AppShell branch). Every entity hook takes `wsId` from `useWorkspace()` and includes it in its query key.
```typescript
// Pattern (no verbatim source — synthesized from legacy use-workspace.ts + D-12 + TanStack v5):
const WS_KEY = "workspace_id";
function WorkspaceProvider({ children }) {
  const qc = useQueryClient();
  const { data: workspaces } = useQuery({ queryKey: ["workspaces"],
    queryFn: () => get<Workspace[]>("/users/me/workspaces"), retry: false });
  const [currentWorkspaceId, setId] = useState<string | null>(
    () => localStorage.getItem(WS_KEY));
  // Initialise / heal the id once workspaces resolve (first-workspace fallback).
  useEffect(() => {
    if (!workspaces?.length) return;
    const valid = currentWorkspaceId && workspaces.some(w => w.id === currentWorkspaceId);
    if (!valid) { const id = workspaces[0].id; localStorage.setItem(WS_KEY, id); setId(id); }
  }, [workspaces, currentWorkspaceId]);
  const setWorkspace = (id: string) => {
    localStorage.setItem(WS_KEY, id); setId(id);
    qc.invalidateQueries();                  // NOT window.location.reload() (legacy anti-pattern)
  };
  return <Ctx.Provider value={{ currentWorkspaceId, setWorkspace, workspaces }}>{children}</Ctx.Provider>;
}
```
**Critical:** `["workspaces"]` is already the query key `RequireAuth` and `DashboardPage` use. Reuse it so the provider costs no extra request. `DashboardPage` must drop `workspaces.data?.[0]?.id` and read `useWorkspace().currentWorkspaceId` instead — its query keys (`["dashboard", wsId]`, `["activity", wsId]`) already parameterise on `wsId`, so only the source of `wsId` changes.

### Pattern 2: OAuth callback exchange (`/auth/callback`)
**What:** Public route. Reads `code` or `error` from the query string, exchanges `code` via `POST /auth/oauth/exchange` (sets cookies), then redirects into the app. Guard against React 19 StrictMode double-invoke with a `useRef` latch.
**When to use:** The single landing route for ALL three SSO flows (Google, GitHub, Authelia) — the backend redirects every one to `${AppURL}/auth/callback?code=` or `?error=`.
```typescript
// Source pattern: frontend/app/[locale]/(auth)/auth/callback/page.tsx (legacy, Next.js — port to RR7)
const exchanged = useRef(false);
useEffect(() => {
  if (exchanged.current) return; exchanged.current = true;   // StrictMode guard
  const error = params.get("error");
  if (error) { navigate(`/login?oauth_error=${encodeURIComponent(error)}`, { replace: true }); return; }
  const code = params.get("code");
  if (!code) { navigate("/login", { replace: true }); return; }
  post<AuthTokenResponse>("/auth/oauth/exchange", { code })
    .then(d => { setRefreshToken(d.refresh_token); navigate("/", { replace: true }); })
    .catch(() => navigate("/login?oauth_error=server_error", { replace: true }));
}, []);
```

### Pattern 3: Logout that actually revokes (AUTH-12 frontend half)
**What:** `useLogout` calls `POST /auth/logout` (backend reads the `refresh_token` cookie and revokes the session), then clears the in-memory refresh token, clears the TanStack cache, resets the workspace context, and navigates to `/login`.
```typescript
async function logout() {
  try { await post("/auth/logout"); } finally {
    setRefreshToken(null);          // lib/api.ts in-memory token
    localStorage.removeItem("workspace_id");
    queryClient.clear();            // drop all cached server state
    navigate("/login", { replace: true });
  }
}
```
Wire `AppShell.handleLogout` (currently `() => navigate("/login")`) to this.

### Pattern 4: Single-flight refresh + auth-expired event (extend, don't restructure)
**What:** `lib/api.ts` already single-flights 401 refresh and throws `HttpError(401)` when the refresh token is gone. The ONE addition: when `doRefresh()` fails, emit a global `auth-expired` event so a single listener (in `RequireAuth` or a tiny top-level effect) redirects — instead of scattering logout calls.
```typescript
// In doRefresh() failure path, after `storedRefreshToken = null`:
window.dispatchEvent(new CustomEvent("auth-expired"));
// A single listener calls navigate("/login"). Keeps the locked invariant intact.
```
**Do NOT** touch `BASE_URL = "/api"`, `credentials: "include"`, the module-level `refreshPromise`, or the `isFormData` Content-Type branch — all four are documented locked invariants (lib/api.ts:10-18).

### Anti-Patterns to Avoid
- **Restructuring `lib/api.ts`:** locked invariants. Add a `logout()` helper + event; never rewrite the refresh machinery.
- **`window.location.reload()` on workspace switch:** the legacy hook did this; it drops the in-memory refresh token and is jarring. Use `invalidateQueries`.
- **Putting OAuth initiate through a `fetch`:** it is a *full-page browser navigation* (`window.location.href`), not an XHR — the provider redirect chain requires it.
- **Routing OAuth/Authelia initiate through the `/api` proxy for Authelia:** Authelia MUST be the bare `/auth/authelia/login` path so the ingress runs forward-auth (commit 8e13faf precedent). OAuth `/auth/oauth/{provider}` can go either bare-to-backend or through `/api` (the proxy passes the 302 through) — prefer the bare backend origin in dev to match production behaviour; the planner should confirm the exact dev URL.
- **Trusting the audit doc over the code:** the audit describes pre-`f49e4b48` state. Read the code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token refresh on 401 | a new interceptor | existing `lib/api.ts` single-flight | locked invariant, already correct |
| Session revocation | client-side token blacklist | backend `session.Service.Revoke` (done) | server-authoritative; client can't revoke a JWT |
| OAuth PKCE/state/CSRF | frontend PKCE | backend `oauth.Handler` (done) | verifier+state live in an HttpOnly cookie server-side |
| One-time code store | localStorage token hand-off | backend Redis one-time code → `/exchange` | avoids exposing tokens in the URL/JS |
| Account-delete sole-owner check | frontend workspace math | `GET /users/me/can-delete` (done) | backend owns the blocking-workspace logic |
| Connected-accounts lockout guard | frontend "is last method" check alone | backend `ErrCannotUnlinkLastAuth` 409 (done) | backend enforces; frontend mirrors with `canUnlink = !(accounts.length===1 && !has_password)` |
| Go integration test server | a bespoke httptest setup | `tests/integration.NewTestServer` | full router + testdb, already proven |

**Key insight:** Nearly every "hard" auth problem in this phase is already solved server-side. The frontend's job is to *call the right endpoint and surface the right error*, not to re-implement the security logic.

## Common Pitfalls

### Pitfall 1: RequireAuth has no network/5xx affordance
**What goes wrong:** `RequireAuth` redirects on `HttpError(401|403)` (correct, AUTH-05). But on a transient network failure or 5xx, `workspaces.error` is a non-HttpError; the guard falls through past the `isPending` check and `return children` renders the shell with no data and no retry. AUTH-05 says "DOES NOT log out on transient errors" — that part is satisfied — but there is no error surface.
**Why it happens:** the current guard only branches on HttpError-401/403 and pending; the error-but-not-401 case is unhandled.
**How to avoid:** add an explicit branch: `if (workspaces.isError && !(401/403)) return <RetryScreen onRetry={workspaces.refetch}/>;`.
**Warning signs:** blank/half-rendered shell when the backend is down.

### Pitfall 2: `WithCurrentSessionID` is never called (backend gap — AUTH-07)
**What goes wrong:** `is_current` is always false; "revoke all other sessions" returns 400; current session is revocable by id.
**Why it happens:** `JWTAuth` (auth.go:35-88) validates the access JWT but never resolves the session row, so it never calls `WithCurrentSessionID`. The handlers read `GetCurrentSessionID` which returns `(Nil, false)`.
**How to avoid:** Backend task — in `JWTAuth` (or a follow-on middleware on the protected group), read the `refresh_token` cookie, `session.HashToken` it, `FindByTokenHash`, and `WithCurrentSessionID(ctx, sess.ID())`. Tolerate the no-cookie case (SSE query-param auth, programmatic callers) by leaving the id unset. Add an integration test asserting `is_current=true` for the active session.
**Warning signs:** session-management UI where you can't tell which session is "this device" and "log out everywhere else" 400s.

### Pitfall 3: Go integration harness sends Bearer, not cookies
**What goes wrong:** A naive logout-revocation test calls `ts.Post("/auth/logout", nil)` and the session is NOT revoked — because `LogoutInput` reads the `refresh_token` **cookie** (handler.go:1027-1029), and `NewTestServer.Request` only sets `Authorization: Bearer` (setup.go:78-81), never a cookie.
**Why it happens:** the harness has no cookie jar.
**How to avoid:** For the revocation test, capture `refresh_token` from the login JSON body, then send logout with an explicit `Cookie: refresh_token=<token>` header (add a small `RequestWithCookie` helper or use `PostRaw`-style custom request), OR drive logout via a raw `http.NewRequest` that sets the cookie. Then call `POST /auth/refresh` with that same token in the JSON body and assert **401 "session has been revoked"**. Also assert the F3 guard: a second refresh with the (now-revoked) token must NOT mint a new session (still 401).
**Warning signs:** a "passing" logout test that doesn't actually exercise revocation.

### Pitfall 4: AppURL default points at the legacy Next port
**What goes wrong:** OAuth/Authelia callback redirects land on `http://localhost:3000/auth/callback` (config default, config.go:140) instead of Vite's `:5173`, so the dev OAuth round-trip dead-ends.
**Why it happens:** `APP_URL` defaults to `:3000` (the legacy frontend).
**How to avoid:** For frontend2 OAuth dev/E2E, set backend env `APP_URL=http://localhost:5173`. Document this in the plan's environment setup. (OAuth E2E is skip-with-reason in CI per parity plan §7 — no provider creds — but the redirect target still matters for any manual/staged test.)
**Warning signs:** OAuth button redirects to a 404 on :3000.

### Pitfall 5: React 19 StrictMode double-exchanges the one-time code
**What goes wrong:** `/auth/callback` runs its effect twice in dev StrictMode; the second `POST /auth/oauth/exchange` fails (Redis `GetDel` already consumed the code) → spurious "invalid or expired code" error.
**Why it happens:** one-time codes are single-use (atomic get-del); StrictMode double-invokes effects.
**How to avoid:** `useRef` latch (Pattern 2) — exactly what the legacy callback did.
**Warning signs:** OAuth works in prod build but errors in dev.

### Pitfall 6: Workspace switch leaves stale entity data
**What goes wrong:** switching workspace without invalidating leaves item/loan/etc. queries showing the previous workspace's data until a manual refetch.
**Why it happens:** TanStack caches by query key; if a key doesn't change or isn't invalidated, the cache serves stale data.
**How to avoid:** (a) every entity query key MUST include the `wsId` value (D-12), and (b) `setWorkspace` calls `queryClient.invalidateQueries()`. Both together guarantee correctness; (a) alone makes the new workspace's keys distinct, (b) clears the old.
**Warning signs:** dashboard stats don't change after switching workspace.

### Pitfall 7: `z.email()` is zod v4 syntax
**What goes wrong:** copying a zod v3 `z.string().email()` pattern into new forms creates inconsistency / type friction.
**Why it happens:** the repo is on zod v4 (`LoginPage` uses top-level `z.email()`).
**How to avoid:** match `LoginPage`'s zod v4 idioms in `RegisterPage` and password forms.

## Runtime State Inventory

> This phase is feature-build, not a rename/refactor/migration. A full Runtime State Inventory is not the right lens. The closest equivalent — *stored auth state that this phase reads/writes* — is enumerated for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `sessions` table (Postgres) — session rows keyed by `HashToken(refresh_token)`; `oauth_accounts` table; `users` table | none new — read/write via existing services |
| Live service config | Backend env: `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `AUTHELIA_ENABLED`, `AUTHELIA_SHARED_SECRET`, `APP_URL`, `BACKEND_URL` (config.go:41-141) | set `APP_URL=:5173` for frontend2 OAuth dev (Pitfall 4); provider creds only for non-CI OAuth testing |
| OS-registered state | None | None — verified: no scheduler/launchd/systemd auth state |
| Secrets/env vars | Frontend build-time: `VITE_AUTHELIA_ENABLED` (NEW — gates the Authelia button). Browser: `access_token`/`refresh_token` HttpOnly cookies; `localStorage["workspace_id"]` (NEW per D-12); in-memory `storedRefreshToken` (lib/api.ts) | add `VITE_AUTHELIA_ENABLED` to frontend env + `vite-env.d.ts` typing |
| Build artifacts | None | None — verified: no compiled auth artifacts to refresh |

## Code Examples

### Sessions list + revoke (AUTH-07 frontend) — exact backend contract
```typescript
// GET /users/me/sessions → SessionResponse[] (session/handler.go:30-38)
interface SessionResponse {
  id: string; device_info: string; ip_address?: string;
  last_active_at: string; created_at: string; is_current: boolean;  // see Pitfall 2
}
const sessions = useQuery({ queryKey: ["sessions"],
  queryFn: () => get<SessionResponse[]>("/users/me/sessions") });
// DELETE /users/me/sessions/{id}     → revoke one (400 if id === current)
// DELETE /users/me/sessions          → revoke all-others (400 if no current session — Pitfall 2)
```

### Connected accounts (AUTH-10) — exact contract
```typescript
// GET /auth/oauth/accounts → { accounts: AccountResponse[] }  (oauth/handler.go:324-339)
// DELETE /auth/oauth/accounts/{provider} → 409 ErrCannotUnlinkLastAuth when it's the
//   sole auth method and no password set. Mirror with:
const canUnlink = !(accounts.length === 1 && !user.has_password);  // user.has_password from /users/me
// Link flow: window.location.href = `${BACKEND}/auth/oauth/${provider}?action=link`
//   + sessionStorage.setItem("oauth_linking","true"); callback routes back to /settings/accounts.
```

### Password change (AUTH-08) — exact contract
```typescript
// PATCH /users/me/password  body: { current_password, new_password }  (handler.go:459-474)
//   400 "current password is incorrect" on ErrInvalidPassword.
// OAuth-only "set password" path: GET /users/me → has_password === false ⇒ render
//   a set-password form; backend still requires current_password field — confirm whether
//   an empty current_password is accepted for has_password=false users (READ service.UpdatePassword
//   before locking; this is an OPEN QUESTION, see below).
```

### Account deletion (AUTH-09) — exact contract
```typescript
// GET /users/me/can-delete → { can_delete, blocking_workspaces:[{id,name,slug}] } (handler.go:897-925)
// DELETE /users/me  body: { confirmation: "DELETE" } (case-insensitive)  → clears cookies
//   409 "cannot delete account while sole owner of workspaces: ..." when blocked.
// UI: RetroConfirmDialog with type-DELETE; pre-check can-delete to surface blocking workspaces.
```

### Go logout-revocation integration test (the AUTH-12 deliverable)
```go
//go:build integration
// Pattern: tests/integration/auth_test.go + setup.go. Needs a cookie-bearing logout call
// (Pitfall 3). Sketch:
//   1. register+login → capture refresh_token from JSON body
//   2. logout: raw http.NewRequest("POST", url+"/auth/logout", nil) with
//        req.AddCookie(&http.Cookie{Name:"refresh_token", Value: refreshToken})
//   3. POST /auth/refresh {refresh_token: <same>} → assert 401 "session has been revoked"
//   4. (F3 guard) POST /auth/refresh again → still 401, NOT 200 (no new session minted)
// Run: cd backend && TEST_DATABASE_URL=... go test -tags=integration -count=1 ./tests/integration/ -run Logout -v
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| logout clears cookies only | logout revokes session via refresh-cookie hash | commit `f49e4b48` (F2 fix) | AUTH-12 backend ALREADY DONE — write the test, not the fix |
| refresh re-creates session on `ErrSessionNotFound` ("legacy token") | refresh rejects 401, no fallback | commit `f49e4b48` (F3 fix) | revocation is now enforced; regression-guard test required |
| workspace switch = `window.location.reload()` | context + `invalidateQueries` (D-12) | this phase | no reload; preserves in-memory refresh token |
| Next.js `(auth)/auth/callback` + `useSearchParams` | RR7 `/auth/callback` + `useSearchParams` (react-router) | this phase | port pattern; StrictMode latch still needed |

**Deprecated/outdated:**
- `docs/audit/BACKEND-SECURITY.md` F2/F3 sections: describe pre-fix code. **Update them** as part of AUTH-12 (mark F2/F3 RESOLVED in `f49e4b48`, cite the new integration test).
- Legacy `RegisterPublicRoutes(api, svc)` free functions (handler.go:1206-1364): deprecated, not wired — ignore; the `Handler` methods are canonical.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | F2/F3 are fully fixed in working-tree `handler.go` (verified by reading code) AND the fix is committed in `f49e4b48` (inferred from `git log`) | Summary, State of the Art | LOW — code is unambiguous; planner should `git show f49e4b48` to confirm the commit vs working-tree, but the fix is present either way |
| A2 | `OAuth initiate` may go through `/api` proxy (302 passed through) but bare-to-backend is preferred in dev | Anti-Patterns | MEDIUM — exact dev URL needs confirming against the running stack; Authelia bare-path is certain (8e13faf) |
| A3 | OAuth E2E is skip-with-reason (no provider creds in CI) | Validation Architecture | LOW — per parity plan §7 and CONTEXT |
| A4 | `set password` for OAuth-only users uses the same `PATCH /users/me/password` endpoint (current_password may be empty when `has_password=false`) | Code Examples | MEDIUM — must read `service.UpdatePassword` before locking the set-password UX; see Open Questions |
| A5 | `device_info` in `SessionResponse` is derived from User-Agent at session create | Code Examples | LOW — cosmetic; affects only label rendering |

## Open Questions (RESOLVED)

<!-- RESOLVED 2026-06-13 (orchestrator, verified against code + live stack): (1) UpdatePassword (service.go:172) ALREADY allows OAuth-only users to set first password without current_password — no backend task; frontend shows set-password form when has_password=false. (2) device_info is a PARSED label (ParseDeviceInfo in session/entity.go:33) — render directly, raw UA available as fallback. (3) Vite /api proxy routes OAuth initiate fine (curl returned backend 400 invalid_provider = providers unconfigured in dev env, not a routing failure); use same-origin /api initiate path; provider 302 chain is browser-followed after initial redirect; OAuth E2E = skip-with-reason; UI must handle unconfigured-provider 4xx gracefully. -->

1. **Set-password path for OAuth-only accounts (AUTH-08)**
   - What we know: `PATCH /users/me/password` requires `current_password` + `new_password`; `has_password` is exposed on `/users/me`.
   - What's unclear: does `service.UpdatePassword` accept an empty `current_password` when the user has no password yet, or is there a separate set-password route?
   - Recommendation: read `backend/internal/domain/auth/user/service.go` `UpdatePassword` during planning; if it rejects empty current-password for `has_password=false` users, this is a small backend task. Tag as `[ASSUMED]` until confirmed.

2. **`device_info` content for the sessions list**
   - What we know: `SessionResponse.device_info` exists; session is created with `input.UserAgent`.
   - What's unclear: whether `device_info` is the raw UA or a parsed label.
   - Recommendation: read `session/entity.go DeviceInfo()`; render raw UA acceptably if unparsed.

3. **Exact dev URL for OAuth initiate from frontend2**
   - What we know: legacy used `${getApiBase()}/auth/oauth/{provider}` (same-origin /api proxy) for OAuth and the bare path for Authelia.
   - What's unclear: whether the Vite `/api` rewrite cleanly passes the provider 302 chain in this setup.
   - Recommendation: smoke-test against the running stack during planning; default to the bare backend origin (`BACKEND_URL`) if the proxy mangles the redirect.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend Go server (:8080) | all auth calls, E2E, integration test | ✓ (stack is UP per objective) | — | — |
| Postgres (:5432, `warehouse_dev` / `warehouse_test`) | login, sessions, integration test | ✓ | — | — |
| Redis | OAuth one-time code exchange | ✓ (wired in router; required for OAuth) | — | OAuth flows fail without it — not needed for email/pw or sessions |
| Vite dev server (:5173) | E2E baseURL | ✓ | — | — |
| Google/GitHub OAuth creds | OAuth E2E (live) | ✗ (none in CI) | — | **OAuth E2E = skip-with-reason** (parity §7); unit-test OAuth-error rendering with MSW instead |
| `AUTHELIA_ENABLED` + shared secret + ingress | Authelia button live test | ✗ (not in dev) | — | env-gate the button OFF in dev; unit-test visibility logic only |

**Missing dependencies with no fallback:** none block the core phase. OAuth/Authelia *live* E2E are intentionally skipped; their UI is still unit-tested.
**Missing dependencies with fallback:** OAuth provider creds → MSW unit tests for button + callback + error taxonomy.

## Validation Architecture

> nyquist_validation is enabled (config.json has no `workflow.nyquist_validation` key → treat as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework (frontend unit) | Vitest 4.1.5 + @testing-library/react + MSW 2.14.2 (jsdom) |
| Framework (frontend E2E) | Playwright 1.59.1 (chromium + firefox), live stack |
| Framework (backend) | Go `testing` + testify; `tests/integration` harness, `//go:build integration` |
| Config files | `frontend2/vitest` (in package/vite), `frontend2/playwright.config.ts`, Go build tag |
| Quick run (frontend) | `cd frontend2 && bun run test` (vitest run) |
| Quick run (backend integ) | `cd backend && TEST_DATABASE_URL=... go test -tags=integration -count=1 ./tests/integration/ -run <Name>` |
| Full E2E | `cd frontend2 && E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | email/pw login → dashboard | E2E (exists) | `bun run test:e2e` | ✅ login-dashboard.spec.ts |
| AUTH-02 | register new account | unit (MSW) + E2E | `bun run test` / `test:e2e` | ❌ Wave 0 (RegisterPage.test, register E2E) |
| AUTH-03/04 | Google/GitHub OAuth button + callback exchange + error taxonomy | unit (MSW) | `bun run test` | ❌ Wave 0 (SocialLoginButtons.test, OAuthCallbackPage.test) — live E2E **skip-with-reason** |
| AUTH-05 | RequireAuth: 401/403 → /login; network/5xx → stay+retry (no logout) | unit | `bun run test` | ❌ Wave 0 (RequireAuth.test — both branches) |
| AUTH-06 | workspace switcher = SSOT; entity keys include wsId; switch invalidates | unit | `bun run test` | ❌ Wave 0 (WorkspaceProvider.test, switcher.test) |
| AUTH-07 | sessions list + revoke one/all-others + is_current badge | unit + integration | `bun run test` / Go integ | ❌ Wave 0 (SecurityPage.test; backend is_current integ test — Pitfall 2) |
| AUTH-08 | password change + set-password path | unit | `bun run test` | ❌ Wave 0 (password form test) |
| AUTH-09 | delete account type-DELETE + sole-owner block | unit | `bun run test` | ❌ Wave 0 (delete dialog test) |
| AUTH-10 | connected accounts link/unlink + last-method lockout | unit | `bun run test` | ❌ Wave 0 (AccountsPage.test) |
| AUTH-11 | Authelia button visible only when `VITE_AUTHELIA_ENABLED` | unit | `bun run test` | ❌ Wave 0 (visibility test) |
| AUTH-12 | logout revokes; revoked refresh → 401; no new session (F3) | **integration (Go)** + E2E | Go integ + `test:e2e` | ❌ Wave 0 (logout-revocation integ test — Pitfall 3; logout E2E: re-use old session fails) |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test` (vitest, < 30s) for the touched feature.
- **Per wave merge:** full `bun run test` + the relevant `go test -tags=integration` package.
- **Phase gate:** full vitest green + logout-revocation integration test green + live E2E (login/register/logout-revocation) green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `frontend2/src/features/auth/RequireAuth.test.tsx` — AUTH-05 both branches (401→redirect; 5xx→retry-not-logout)
- [ ] `frontend2/src/features/auth/RegisterPage.test.tsx` — AUTH-02
- [ ] `frontend2/src/features/auth/SocialLoginButtons.test.tsx` + `OAuthCallbackPage.test.tsx` — AUTH-03/04/11 (MSW)
- [ ] `frontend2/src/features/workspace/WorkspaceProvider.test.tsx` — AUTH-06 (init, fallback, switch-invalidates)
- [ ] `frontend2/src/features/settings/SecurityPage.test.tsx` + `AccountsPage.test.tsx` — AUTH-07/08/09/10
- [ ] `backend/tests/integration/auth_test.go` — ADD `TestLogout_RevokesSession` + `TestRefresh_RevokedSession_NoNewSession` (AUTH-12); add a cookie-bearing request helper (Pitfall 3)
- [ ] Backend `is_current` integration test after wiring `WithCurrentSessionID` (Pitfall 2)
- [ ] `frontend2/e2e/auth.spec.ts` — register (unique email), logout-revocation (old session fails), switcher visible; OAuth = `test.skip` with reason
- [ ] MSW server/handlers shared fixture for auth endpoints (frontend2 has no MSW setup yet — add `src/test/msw` server + handlers)

## Project Constraints (from CLAUDE.md)

- **E2E live-stack contract:** specs in `frontend2/e2e/*.spec.ts` run against real backend (:8080) + Postgres + Vite (:5173); no `webServer` auto-launch. Auth contract: `/login` → fill Email+Password → click `/^log in$/i`; cookie carries `access_token`; `page.request` inherits it. (Note: v3.0 page has a single submit button today; OAuth buttons land THIS phase — switch back to exact-match discipline once they exist.)
- **Go integration tests:** `//go:build integration` tag (invisible to `go test ./...`); run with `TEST_DATABASE_URL=...` against `warehouse_test`; `tests/testdb` harness. The Phase 65 by-barcode test is the precedent; **frontend-side barcode-lookup coverage is NOWHERE** (unrelated to this phase, but the same "rebuild the wiped spec" discipline applies — add the logout-revocation E2E here).
- **Vite `/api` → root rewrite is load-bearing** (vite.config.ts): backend routes live at root (e.g. `/auth/login`). Do not regress.
- **Retro-OS pastel direction** (sketches 006-008 canonical; danger=`#b73348`): login/register/forms per sketch 007. Premium Terminal is scrapped.

## Sources

### Primary (HIGH confidence)
- `backend/internal/domain/auth/user/handler.go` — register/login/refresh/logout/me/workspaces/password/can-delete/delete + all input/output shapes (read in full)
- `backend/internal/domain/auth/session/{service,handler}.go` — Revoke/RevokeAll/FindByTokenHash/HashToken; sessions list/revoke routes
- `backend/internal/domain/auth/oauth/handler.go` — Initiate/Callback/ExchangeCode/ListAccounts/UnlinkAccount; error taxonomy; one-time code
- `backend/internal/domain/auth/authelia/handler.go` — Login/LoginRedirect; trust header; bare-path requirement
- `backend/internal/api/router.go:290-420` — exact route wiring, gating (`cfg.AutheliaEnabled`, provider creds), root-mount (no `/api` prefix)
- `backend/internal/api/middleware/auth.go` — `JWTAuth` (never sets session id), `GetCurrentSessionID` (the AUTH-07 gap)
- `backend/internal/shared/jwt/jwt.go` — refresh token is a stateless 7-day `RegisteredClaims` JWT (no jti)
- `backend/tests/integration/{setup.go,auth_test.go}` — `NewTestServer` harness (Bearer-only, no cookie jar)
- `frontend2/src/lib/api.ts` — locked invariants; single-flight refresh; HttpError
- `frontend2/src/features/auth/{LoginPage,RequireAuth}.tsx`, `features/dashboard/DashboardPage.tsx`, `components/layout/{TopBar,AppShell}.tsx`, `routes/index.tsx` — current frontend2 state
- `frontend2/{vite.config.ts,playwright.config.ts,package.json}`, `e2e/login-dashboard.spec.ts`
- `frontend/app/[locale]/(auth)/auth/callback/page.tsx`, `frontend/features/auth/components/{social-login,oauth-error-handler}.tsx`, `frontend/lib/hooks/use-workspace.ts`, `frontend/components/settings/connected-accounts.tsx` — legacy STRUCTURE references

### Secondary (MEDIUM confidence)
- `git log --oneline backend/internal/domain/auth/user/handler.go` → `f49e4b48` as the F1-F20 hardening commit (corroborates working-tree fix)
- `docs/audit/BACKEND-SECURITY.md` F2/F3 — describes the **pre-fix** state (now stale)

### Tertiary (LOW confidence)
- None — all claims are grounded in code read this session.

## Metadata

**Confidence breakdown:**
- Backend auth surface: HIGH — every handler + route + DTO read verbatim.
- AUTH-12 already-fixed: HIGH — current code is unambiguous (commit-vs-working-tree is the only A1 caveat).
- AUTH-07 `WithCurrentSessionID` gap: HIGH — confirmed no production caller via grep.
- Frontend integration patterns: HIGH — current frontend2 + locked api.ts read; legacy patterns are direct ports.
- Set-password / device_info details: MEDIUM — flagged as Open Questions for planning-time code reads.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable — internal codebase, no fast-moving external deps)
