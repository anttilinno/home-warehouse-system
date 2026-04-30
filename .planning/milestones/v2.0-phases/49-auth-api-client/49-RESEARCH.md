# Phase 49: Auth & API Client - Research

**Researched:** 2026-04-09
**Domain:** Frontend auth (login/register/logout), route protection, JWT API client, OAuth callback
**Confidence:** HIGH

## Summary

Phase 49 builds the authentication layer for frontend2: a lightweight fetch-based API client, React context for auth state, login/register forms with retro BAM styling, route guards, OAuth social login buttons, and an OAuth callback page. The backend already has all auth endpoints fully implemented (login, register, logout, refresh, OAuth initiate/callback/exchange) -- this phase is purely frontend.

The auth flow uses dual JWT tokens: a short-lived access token (24h) in an HttpOnly cookie and a 7-day refresh token also in an HttpOnly cookie. The backend sets both cookies on login/register responses. The frontend API client needs to call `POST /auth/refresh` with the refresh token when it gets a 401, transparently retrying the failed request.

**Primary recommendation:** Build a simple fetch wrapper (not a class-based client) that handles `credentials: "include"` for cookies, automatic 401 -> refresh -> retry, and JSON serialization. Wrap auth state in a React context provider that checks `/users/me` on mount to restore sessions from cookies.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single page with tab toggle between Login and Register tabs -- matches BAM reference image 5 exactly (two tabs at top, form content switches below).
- **D-02:** Decorative red X close button in the corner of the auth panel -- present for retro aesthetic, non-functional (no navigation target).
- **D-03:** No guest mode -- the app requires authentication. The "Enter as Guest" button from BAM ref is visual inspiration only, not a feature.
- **D-04:** Include Google and GitHub OAuth buttons on the auth form below email/password fields, separated by an "OR" divider. Backend already supports the full OAuth flow.
- **D-05:** Dedicated `/auth/callback` route that reads the authorization code from URL params, calls the backend exchange endpoint (`/auth/oauth/exchange`), stores the token, and redirects to dashboard.
- **D-06:** Inline banner style for auth errors -- colored text message inside the form panel (red for errors, green for success), appearing between form fields and submit button. Matches BAM ref 5 message format. No per-field inline validation.
- **D-07:** Build a lightweight fetch wrapper for frontend2 (not a port of frontend1's class-based ApiClient). Online-only SPA doesn't need the complexity of workspace headers, offline detection, or SSR URL switching.

### Claude's Discretion
- Guest mode decision: Claude decided no guest mode (app requires auth)
- Token refresh mechanism (HttpOnly cookie silent refresh)
- Auth context/provider architecture
- Route guard implementation pattern
- Form state management approach
- Register form fields (name, email, password, confirm password -- standard set)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with email and password and see authenticated routes | API client calls `POST /auth/login` with `{email, password}`, backend returns `{token, refresh_token}` + sets HttpOnly cookies. Auth context loads user via `GET /users/me`. |
| AUTH-02 | User is redirected to login when accessing protected routes without a session | Route guard component checks auth context; if `!isAuthenticated && !isLoading`, redirect via React Router `<Navigate>` to `/login`. |
| AUTH-03 | API client handles JWT tokens from HttpOnly cookies with automatic refresh | On 401 response, API client calls `POST /auth/refresh` (browser sends refresh_token cookie automatically via `credentials: "include"`). Backend returns new tokens + cookies. Client retries original request. |
| AUTH-04 | User can register a new account | `POST /auth/register` with `{email, password, full_name}`. Backend creates user + personal workspace, returns tokens. Auth context loads user data automatically. |
| AUTH-05 | User can log out | `POST /auth/logout` clears cookies server-side. Client clears local state and redirects to login. |
</phase_requirements>

## Standard Stack

### Core (already installed in Phase 48)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.5 | UI framework | Already installed in frontend2 |
| react-router | ^7.14.0 | Client-side routing, `<Navigate>` for redirects | Already installed, library mode |
| @lingui/react | ^5.9.5 | i18n for auth form strings | Already installed |

### Supporting (no new dependencies needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native fetch | Built-in | HTTP client | D-07 says lightweight wrapper, not axios/ky |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fetch wrapper | axios, ky | D-07 explicitly says lightweight fetch wrapper -- no external HTTP lib |
| React context | zustand, jotai | Auth state is simple (user + loading + methods); context is sufficient for online-only SPA |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed in Phase 48
```

[VERIFIED: frontend2/package.json] -- all required packages already present.

## Architecture Patterns

### Recommended Project Structure
```
frontend2/src/
  features/auth/
    AuthPage.tsx           # Tab-toggled login/register with retro styling
    LoginForm.tsx          # Email + password form
    RegisterForm.tsx       # Name + email + password + confirm password form
    OAuthButtons.tsx       # Google + GitHub buttons with "OR" divider
    AuthCallbackPage.tsx   # /auth/callback route -- exchanges OAuth code
    AuthContext.tsx         # React context provider for auth state
    RequireAuth.tsx         # Route guard component
  lib/
    api.ts                 # Lightweight fetch wrapper with refresh logic
    i18n.ts                # (existing)
  routes/
    index.tsx              # Route definitions with guards
```

[VERIFIED: frontend2/src/features/auth/.gitkeep exists, lib/ exists with i18n.ts]

### Pattern 1: Lightweight Fetch Wrapper
**What:** A set of exported functions (`get`, `post`, `patch`, `del`) wrapping `fetch` with JSON handling, `credentials: "include"`, and automatic 401 refresh-retry.
**When to use:** All API calls from frontend2.
**Example:**
```typescript
// Source: Based on existing frontend1/lib/api/client.ts adapted per D-07
const BASE_URL = "/api"; // Vite proxy strips and forwards to Go backend

let refreshPromise: Promise<void> | null = null;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include", // Send HttpOnly cookies
  });

  if (response.status === 401) {
    // Attempt refresh -- deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = doRefresh();
    }
    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
    // Retry original request
    const retryResponse = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
    if (!retryResponse.ok) throw await parseError(retryResponse);
    return parseResponse<T>(retryResponse);
  }

  if (!response.ok) throw await parseError(response);
  return parseResponse<T>(response);
}

async function doRefresh(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}), // Refresh token sent via cookie
  });
  if (!res.ok) {
    // Refresh failed -- session is truly expired
    throw new Error("Session expired");
  }
}
```

### Pattern 2: Auth Context Provider
**What:** React context holding user state, with methods for login/register/logout and automatic session restoration on mount.
**When to use:** Wrap the app in `<AuthProvider>` inside `<BrowserRouter>`.
**Example:**
```typescript
// Source: Based on existing frontend1/lib/contexts/auth-context.tsx, simplified for online-only
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
```
[VERIFIED: frontend/lib/contexts/auth-context.tsx] -- pattern proven in frontend1.

### Pattern 3: Route Guard via Wrapper Component
**What:** A `<RequireAuth>` component that checks auth context and redirects to `/login` if not authenticated.
**When to use:** Wrap protected route elements.
**Example:**
```typescript
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
```

### Pattern 4: OAuth Callback Page
**What:** A dedicated route at `/auth/callback` that reads `?code=` or `?error=` from URL params, calls `POST /auth/oauth/exchange`, and redirects.
**When to use:** Backend OAuth callback redirects here after provider flow.
**Flow:**
1. User clicks "Sign in with Google/GitHub"
2. Browser navigates to `/auth/oauth/{provider}` (backend, NOT proxied -- direct)
3. Backend redirects to Google/GitHub
4. Provider redirects back to backend callback
5. Backend generates one-time code, stores tokens in Redis, redirects to `{APP_URL}/auth/callback?code=...`
6. Frontend reads code from URL, calls `POST /api/auth/oauth/exchange` with `{code}`
7. Backend returns tokens + sets cookies
8. Frontend loads user data and redirects to dashboard

[VERIFIED: backend/internal/domain/auth/oauth/handler.go lines 258-259] -- `redirectURL := fmt.Sprintf("%s/auth/callback?code=%s", h.cfg.AppURL, oneTimeCode)`
[VERIFIED: frontend/app/[locale]/(auth)/auth/callback/page.tsx] -- existing pattern in frontend1.

### Anti-Patterns to Avoid
- **Storing tokens in localStorage:** The backend uses HttpOnly cookies. The token is also returned in the JSON response body for backward compatibility with frontend1, but frontend2 should NOT store it -- rely on cookies exclusively. `credentials: "include"` sends cookies automatically.
- **Hard redirect via window.location:** Use React Router's `<Navigate>` or `useNavigate()` for redirects within the SPA. Only exception: OAuth initiate needs a full navigation to the backend endpoint.
- **Per-field inline validation on auth forms:** D-06 explicitly says no per-field validation -- use inline banner for errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token refresh race conditions | Custom locking | Shared promise deduplication (see Pattern 1) | Multiple concurrent 401s must not trigger multiple refresh calls |
| OAuth CSRF protection | Custom state management | Backend handles it via HttpOnly state cookie | The backend already manages CSRF state + PKCE -- frontend just initiates and exchanges |
| Form state | Complex form library | Simple `useState` per field | Auth forms are 2-4 fields; no need for react-hook-form/formik complexity |

## Common Pitfalls

### Pitfall 1: Vite Proxy Does Not Strip /api Prefix
**What goes wrong:** The Vite proxy at `/api` forwards requests to `http://localhost:8080/api/...`, but the Go backend routes are at `/auth/login`, `/users/me`, etc. (no `/api` prefix). Every API call 404s.
**Why it happens:** Phase 48 configured `"/api": { target: "http://localhost:8080" }` without a `rewrite` rule. Vite proxies `/api/auth/login` to `http://localhost:8080/api/auth/login` which doesn't exist.
**How to avoid:** Add `rewrite` to the Vite proxy config:
```typescript
proxy: {
  "/api": {
    target: "http://localhost:8080",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
},
```
This strips `/api` so `/api/auth/login` becomes `http://localhost:8080/auth/login`.
**Warning signs:** All API calls return 404 in development.

[VERIFIED: backend/internal/domain/auth/user/handler.go line 128-131] -- routes are `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` (no `/api` prefix).
[VERIFIED: frontend2/vite.config.ts lines 20-25] -- no `rewrite` configured currently.

### Pitfall 2: OAuth Initiate Must NOT Go Through Vite Proxy
**What goes wrong:** Clicking "Sign in with Google" tries to navigate via the Vite proxy, but the OAuth initiate endpoint (`/auth/oauth/{provider}`) performs a 307 redirect to Google. The browser must navigate directly to the backend.
**Why it happens:** If you use `fetch()` for OAuth initiate, the redirect response can't be followed as a browser navigation.
**How to avoid:** Use `window.location.href = "http://localhost:8080/auth/oauth/google"` or, better, navigate to `/api/auth/oauth/google` (which the Vite proxy forwards correctly). The browser handles the redirect chain.
**Warning signs:** OAuth button does nothing or shows CORS error.

[VERIFIED: backend/internal/domain/auth/oauth/handler.go lines 88-126] -- Initiate is a raw HTTP handler that does `http.Redirect`.

### Pitfall 3: Refresh Token Sent via Cookie, Not Body
**What goes wrong:** Developer sends `{ refresh_token: "..." }` in the request body to `POST /auth/refresh`, but the token is in an HttpOnly cookie (inaccessible to JavaScript).
**Why it happens:** The backend accepts refresh_token from either the body OR the cookie. Frontend1 stored the refresh token in localStorage and sent it in the body. Frontend2 should rely on HttpOnly cookies.
**How to avoid:** Call `POST /auth/refresh` with `credentials: "include"` and an empty body `{}`. The browser sends the `refresh_token` HttpOnly cookie automatically.
**Warning signs:** 401 "invalid refresh token" when trying to refresh.

Wait -- let me verify this. The backend refresh handler checks `input.Body.RefreshToken`:

[VERIFIED: backend/internal/domain/auth/user/handler.go line 256] -- `userID, err := h.jwtService.ValidateRefreshToken(input.Body.RefreshToken)`. The handler expects the refresh token in the request body, NOT from the cookie.

**Correction:** The backend expects `refresh_token` in the POST body. But the token is in an HttpOnly cookie, so JavaScript can't read it. Looking at the backend more carefully:

[VERIFIED: backend/internal/domain/auth/user/handler.go lines 994-1001] -- `RefreshTokenInput` has `Body.RefreshToken string`. The refresh token is sent in the JSON body.

This means the frontend DOES need to store the refresh_token from the login response to send it back during refresh. Frontend1 does this by returning `response.token` and `response.refresh_token` from login, and storing the token in localStorage. The refresh_token is available in the response body alongside being set as a cookie.

**Revised approach:** On login/register, the backend returns `{ token, refresh_token }` AND sets HttpOnly cookies. The API client should store the refresh_token (in memory, not localStorage) for use in the refresh call. If the in-memory token is lost (page reload), the access_token cookie handles auth, and if it expires, the refresh endpoint also accepts the cookie... actually no, looking at the handler code again:

The `RefreshTokenInput.Body.RefreshToken` field has `json:"refresh_token,omitempty"` -- the `omitempty` means it's optional. Let me check if the middleware checks cookies.

Actually, the JWTAuth middleware (line 52) checks the `access_token` cookie. For normal requests, the access_token cookie is sufficient. The refresh flow requires the refresh_token in the body. So the question is: where does the frontend get the refresh_token from after a page reload?

The answer is: it doesn't need to proactively refresh. After page reload, if the access_token cookie is still valid (24h), `/users/me` succeeds. If it's expired, `/users/me` returns 401. At that point, the client can try `POST /auth/refresh` with an empty body -- but that would fail because `input.Body.RefreshToken` would be empty.

Looking at frontend1: it stores the token AND refresh_token in localStorage, and sends the access token via `Authorization: Bearer` header. It doesn't use the cookie-based refresh at all.

**Resolution for frontend2:** Store refresh_token in memory (or localStorage) from the login/register response. When a 401 occurs, send `POST /auth/refresh` with `{ refresh_token: storedRefreshToken }`. The backend validates the refresh token from the body and issues new access + refresh tokens (both in cookies and response body).

### Pitfall 4: React Strict Mode Double-Mount Causes Double OAuth Exchange
**What goes wrong:** In development, React 18/19 Strict Mode mounts components twice. The OAuth callback page calls `exchangeOAuthCode` twice, but the code is one-time-use (Redis GETDEL). Second call fails.
**Why it happens:** Strict Mode intentionally double-invokes effects.
**How to avoid:** Use a `useRef(false)` guard in the OAuth callback effect, same as frontend1.
**Warning signs:** OAuth login works intermittently -- sometimes succeeds, sometimes fails with "invalid or expired code".

[VERIFIED: frontend/app/[locale]/(auth)/auth/callback/page.tsx lines 18-19] -- `const exchanged = useRef(false)` pattern already used in frontend1.

### Pitfall 5: Backend CORS Doesn't Allow Vite Dev Server Origin
**What goes wrong:** Direct API calls from `http://localhost:5173` fail with CORS errors.
**Why it happens:** The backend CORS middleware may not list the Vite dev server origin.
**How to avoid:** This is a non-issue because the Vite proxy handles all API requests. Proxied requests go from Vite server to Go backend server-to-server, bypassing CORS entirely. The OAuth flow is the exception -- it uses backend URLs directly, but those are full page navigations (not XHR), so CORS doesn't apply.

[VERIFIED: Phase 48 research] -- CORS bypass via proxy documented as established pattern.

## Code Examples

### Backend API Endpoint Reference
```
# Public (no auth required)
POST /auth/login        body: { email, password }          -> { token, refresh_token } + cookies
POST /auth/register     body: { email, password, full_name } -> { token, refresh_token } + cookies
POST /auth/refresh      body: { refresh_token }            -> { token, refresh_token } + cookies
POST /auth/logout       body: (none)                       -> clears cookies
POST /auth/oauth/exchange body: { code }                   -> { token, refresh_token } + cookies

# OAuth (browser navigation, not fetch)
GET  /auth/oauth/{provider}          -> 307 redirect to Google/GitHub
GET  /auth/oauth/{provider}/callback -> 307 redirect to {APP_URL}/auth/callback?code=...

# Protected (requires access_token cookie or Authorization header)
GET  /users/me                       -> User object
GET  /users/me/workspaces            -> Workspace[]
```

[VERIFIED: backend/internal/domain/auth/user/handler.go lines 127-131, backend/internal/domain/auth/oauth/handler.go]

### User Type (from backend response)
```typescript
// Source: frontend/lib/api/auth.ts -- types match backend /users/me response
interface User {
  id: string;
  email: string;
  full_name: string;
  has_password: boolean;
  is_active: boolean;
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  language: string;
  theme: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
```

[VERIFIED: frontend/lib/api/auth.ts lines 36-51]

### Register Form Fields
```typescript
interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  language?: string; // Optional, defaults on backend
}
```

[VERIFIED: frontend/lib/api/auth.ts lines 77-82]

### Retro Auth Panel Styling Reference
The BAM reference image 5 shows:
- Two file-folder tabs at top: "LOGIN" and "REGISTER" with thick borders
- Active tab has cream background (merged with panel), inactive has gray background
- Red square X close button in top-right corner (decorative per D-02)
- Form fields with thick dark borders and icons
- Error messages as colored inline text
- Submit button at bottom with retro beveled style

Available Tailwind tokens: `bg-retro-cream`, `bg-retro-charcoal`, `border-retro-thick`, `border-retro-ink`, `shadow-retro-raised`, `shadow-retro-pressed`, `text-retro-red` (for errors), `text-retro-green` (for success), `font-mono` (for inputs), `bg-retro-gray` (for inactive tab).

[VERIFIED: frontend2/src/styles/globals.css] -- all tokens defined in @theme block.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage JWT | HttpOnly cookie JWT | v1.8 (2026-02) | Backend already sets cookies; frontend2 should rely on them |
| Class-based ApiClient | Functional fetch wrapper | Phase 49 decision D-07 | Simpler, no `this` binding issues, tree-shakeable |
| Next.js SSR auth | SPA-only auth context | v2.0 architecture | No SSR considerations, simpler auth flow |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Refresh token must be sent in request body (not read from cookie by backend) | Pitfall 3 | If backend can read from cookie, the approach simplifies -- no need to store refresh_token at all |
| A2 | `POST /auth/refresh` with empty body would fail | Pitfall 3 | If backend reads cookie fallback, in-memory storage is unnecessary |
| A3 | Vite proxy `rewrite` syntax is `(path) => path.replace(...)` | Pitfall 1 | Wrong syntax would break proxy -- easily testable |

## Open Questions

1. **Refresh token storage strategy**
   - What we know: Backend `RefreshTokenInput.Body.RefreshToken` expects the token in POST body. Login response returns it in JSON. HttpOnly cookie also set.
   - What's unclear: Whether backend also reads refresh_token from the cookie as fallback (no evidence of cookie reading in the refresh handler code).
   - Recommendation: Store refresh_token in memory (module-level variable). On page reload, attempt `/users/me` -- if 401, redirect to login. In-memory loss on reload is acceptable since access_token cookie (24h) survives reloads. Only truly expired sessions require re-login.

2. **OAuth initiate URL in production**
   - What we know: In dev, OAuth initiate goes to `http://localhost:8080/auth/oauth/{provider}`. In production, it goes to the backend's public URL.
   - What's unclear: How frontend2 discovers the backend URL in production.
   - Recommendation: Use `/api/auth/oauth/{provider}` via the proxy in dev. For production, use an environment variable or a relative URL if frontend2 is served by the same origin as the backend.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.3 |
| Config file | frontend2/vite.config.ts (vitest uses vite config) |
| Quick run command | `cd frontend2 && bun run test` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login flow calls /auth/login, stores state | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/AuthContext.test.tsx` | No -- Wave 0 |
| AUTH-02 | RequireAuth redirects unauthenticated users | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/RequireAuth.test.tsx` | No -- Wave 0 |
| AUTH-03 | API client retries on 401 after refresh | unit | `cd frontend2 && bunx vitest run src/lib/__tests__/api.test.ts` | No -- Wave 0 |
| AUTH-04 | Register flow calls /auth/register | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/AuthContext.test.tsx` | No -- Wave 0 |
| AUTH-05 | Logout clears state and redirects | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/AuthContext.test.tsx` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test`
- **Per wave merge:** `cd frontend2 && bun run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Test setup with jsdom environment for React component testing
- [ ] Mock fetch utility for API client tests
- [ ] React Router test wrapper (MemoryRouter) for route guard tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Backend handles all auth logic; frontend sends credentials over HTTPS via proxy |
| V3 Session Management | yes | HttpOnly SameSite=Lax cookies set by backend; frontend never accesses token values directly |
| V4 Access Control | yes | Route guards redirect unauthenticated users; backend enforces authorization |
| V5 Input Validation | yes | Email format, password minimum length validated on frontend for UX; backend enforces |
| V6 Cryptography | no | No client-side crypto; PKCE handled by backend |

### Known Threat Patterns for React SPA Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS token theft | Information Disclosure | HttpOnly cookies -- tokens inaccessible to JS [VERIFIED: backend sets HttpOnly] |
| CSRF on auth endpoints | Tampering | SameSite=Lax cookies + backend rate limiting [VERIFIED: cookie config in handler.go] |
| OAuth CSRF (state forgery) | Spoofing | Backend validates state cookie [VERIFIED: oauth handler.go] |
| Open redirect after login | Spoofing | Validate redirect target is internal path only |
| Token in URL | Information Disclosure | OAuth uses one-time code in URL, not token directly [VERIFIED: Redis-based code exchange] |

## Sources

### Primary (HIGH confidence)
- `backend/internal/domain/auth/user/handler.go` -- Login, register, refresh, logout endpoint implementations
- `backend/internal/domain/auth/oauth/handler.go` -- OAuth initiate, callback, exchange implementations
- `backend/internal/api/middleware/auth.go` -- JWT auth middleware with cookie/header/query token extraction
- `frontend/lib/api/client.ts` -- Frontend1 API client reference implementation
- `frontend/lib/api/auth.ts` -- Frontend1 auth API types and functions
- `frontend/lib/contexts/auth-context.tsx` -- Frontend1 auth context pattern
- `frontend/app/[locale]/(auth)/auth/callback/page.tsx` -- Frontend1 OAuth callback pattern
- `frontend2/vite.config.ts` -- Current Vite proxy configuration
- `frontend2/package.json` -- Current dependencies
- `frontend2/src/styles/globals.css` -- Available retro design tokens
- `.planning/references/retro-ui/5.png` -- BAM auth form visual reference

### Secondary (MEDIUM confidence)
- `.planning/phases/48-project-scaffold/48-RESEARCH.md` -- Phase 48 research on Vite proxy, CORS

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, no new deps needed
- Architecture: HIGH -- patterns proven in frontend1, adapted per D-07 constraints
- Pitfalls: HIGH -- verified against actual backend source code
- Auth flow: HIGH -- complete backend endpoint analysis with line numbers

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable -- backend auth API is mature, unlikely to change)
