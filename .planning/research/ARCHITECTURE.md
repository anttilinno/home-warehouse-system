# Architecture Research: Social Login (Google OAuth + GitHub OAuth)

**Domain:** OAuth2 social login integration into existing Go + Next.js auth system
**Researched:** 2026-02-22
**Confidence:** HIGH

## System Overview

The OAuth flow follows a backend-driven Authorization Code pattern. The frontend initiates by redirecting to the provider, but the backend handles all token exchange and account logic. This avoids exposing client secrets to the browser.

```
                          OAUTH LOGIN FLOW
                          ================

 Browser                    Go Backend                 OAuth Provider
 -------                    ----------                 --------------
    |                           |                           |
    |  1. Click "Login with     |                           |
    |     Google/GitHub"        |                           |
    |  ---------------------->  |                           |
    |                           |                           |
    |  2. 302 Redirect to       |                           |
    |     provider auth URL     |                           |
    |  <----------------------  |                           |
    |                           |                           |
    |  3. User authenticates    |                           |
    |  -------------------------------------------->        |
    |                           |                           |
    |  4. Provider redirects    |                           |
    |     to backend callback   |                           |
    |     with ?code=xxx        |                           |
    |  ---------------------->  |                           |
    |                           |  5. Exchange code for     |
    |                           |     tokens                |
    |                           |  ---------------------->  |
    |                           |                           |
    |                           |  6. Fetch user profile    |
    |                           |  ---------------------->  |
    |                           |                           |
    |                           |  7. Find-or-create user   |
    |                           |     Link OAuth account    |
    |                           |     Issue JWT + session   |
    |                           |                           |
    |  8. 302 Redirect to       |                           |
    |     frontend /auth/       |                           |
    |     callback?token=xxx    |                           |
    |  <----------------------  |                           |
    |                           |                           |
    |  9. Frontend stores       |                           |
    |     token, loads user     |                           |
    |     data, navigates to    |                           |
    |     /dashboard            |                           |
    |                           |                           |


                     CONNECT ACCOUNT FLOW (Settings)
                     ================================

 Browser (authenticated)    Go Backend                 OAuth Provider
 -----------------------    ----------                 --------------
    |                           |                           |
    |  1. Click "Connect        |                           |
    |     Google/GitHub"        |                           |
    |  ---------------------->  |                           |
    |                           |                           |
    |  2. 302 Redirect with     |                           |
    |     state=link:{user_id}  |                           |
    |  <----------------------  |                           |
    |                           |                           |
    |  3-6. Same OAuth flow     |                           |
    |                           |                           |
    |                           |  7. Decode state,         |
    |                           |     link to existing      |
    |                           |     user (no new user)    |
    |                           |                           |
    |  8. Redirect to           |                           |
    |     /settings/security    |                           |
    |     ?linked=google        |                           |
    |  <----------------------  |                           |
```

### Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| `backend/internal/domain/auth/oauth/` | NEW: OAuth service, provider configs, token exchange, user resolution | **NEW domain package** |
| `backend/internal/domain/auth/oauth/handler.go` | NEW: HTTP handlers for `/auth/oauth/{provider}` and `/auth/oauth/{provider}/callback` | **NEW** |
| `backend/internal/domain/auth/oauth/service.go` | NEW: Business logic for find-or-create user, auto-link by email, account linking | **NEW** |
| `backend/internal/domain/auth/oauth/repository.go` | NEW: Interface for `auth.user_oauth_accounts` CRUD | **NEW** |
| `backend/internal/domain/auth/oauth/providers.go` | NEW: Google and GitHub provider config structs | **NEW** |
| `backend/internal/infra/postgres/oauth_repository.go` | NEW: PostgreSQL implementation of OAuth repository | **NEW** |
| `backend/internal/domain/auth/user/entity.go` | MODIFIED: Allow nullable password_hash for OAuth-only users | **MODIFIED** |
| `backend/internal/domain/auth/user/service.go` | MODIFIED: Add `CreateOAuthUser` method (no password required) | **MODIFIED** |
| `backend/internal/domain/auth/user/repository.go` | Existing `FindByEmail` already sufficient | **UNCHANGED** |
| `backend/internal/api/router.go` | MODIFIED: Register OAuth routes in public group | **MODIFIED** |
| `backend/db/migrations/012_oauth_nullable_password.sql` | NEW: Make password_hash nullable for OAuth-only users | **NEW** |
| `frontend/features/auth/components/social-login.tsx` | MODIFIED: Add click handlers to initiate OAuth flow | **MODIFIED** |
| `frontend/app/[locale]/(auth)/callback/page.tsx` | NEW: OAuth callback landing page that stores token and redirects | **NEW** |
| `frontend/lib/api/auth.ts` | MODIFIED: Add OAuth-related API methods | **MODIFIED** |
| `frontend/components/settings/security-settings.tsx` | MODIFIED: Add Connected Accounts section | **MODIFIED** |
| `frontend/components/settings/connected-accounts.tsx` | NEW: Link/unlink Google and GitHub accounts UI | **NEW** |

## Recommended Project Structure

### Backend (new files only)

```
backend/
├── internal/
│   └── domain/
│       └── auth/
│           └── oauth/                    # NEW: OAuth domain package
│               ├── entity.go             # OAuthAccount domain entity
│               ├── handler.go            # HTTP handlers (initiate, callback)
│               ├── service.go            # Business logic (find-or-create, link/unlink)
│               ├── repository.go         # Repository interface
│               ├── providers.go          # Google/GitHub provider configs
│               ├── errors.go             # Domain errors
│               ├── handler_test.go       # Handler unit tests
│               └── service_test.go       # Service unit tests
├── internal/
│   └── infra/
│       └── postgres/
│           └── oauth_repository.go       # NEW: PostgreSQL OAuth repo
├── db/
│   └── migrations/
│       └── 012_oauth_nullable_password.sql  # NEW: Make password_hash nullable
└── db/
    └── queries/
        └── oauth_accounts.sql            # NEW: sqlc queries for oauth table
```

### Frontend (new files only)

```
frontend/
├── app/
│   └── [locale]/
│       └── (auth)/
│           └── callback/
│               └── page.tsx              # NEW: OAuth callback handler page
├── features/
│   └── auth/
│       └── components/
│           └── social-login.tsx          # MODIFIED: Add OAuth initiation
├── components/
│   └── settings/
│       ├── security-settings.tsx         # MODIFIED: Add connected accounts section
│       └── connected-accounts.tsx        # NEW: Link/unlink providers UI
└── lib/
    └── api/
        └── auth.ts                       # MODIFIED: Add OAuth API methods
```

### Structure Rationale

- **`oauth/` as a separate domain package:** Follows the existing pattern (user, session, workspace, member, notification are all separate packages under `domain/auth/`). OAuth has its own entity (`OAuthAccount`), its own repository (the `user_oauth_accounts` table), and its own handlers. Keeping it separate avoids bloating the user package.
- **No NextAuth.js:** The app already has a fully custom auth system (JWT + refresh tokens + sessions + cookies). Adding NextAuth would create a parallel auth system. Instead, the backend drives the OAuth flow and the frontend just handles the redirect result.
- **Callback page in frontend:** A simple client-side page at `/auth/callback` that reads the token from the URL, stores it, and redirects to `/dashboard`. This avoids needing the backend to set cookies cross-origin (which would require same-domain deployment).

## Architectural Patterns

### Pattern 1: Backend-Driven Authorization Code Flow

**What:** The backend generates the OAuth authorization URL (with state parameter for CSRF protection) and handles the callback. The frontend never touches client secrets or authorization codes.

**When to use:** Always for server-rendered or API-backed apps. The client secret stays on the server.

**Trade-offs:**
- PRO: Client secret never exposed to browser
- PRO: Server controls the full flow (rate limiting, logging, account linking logic)
- CON: Requires two redirects (browser -> provider -> backend -> frontend)

**Example:**

```go
// handler.go - Initiate OAuth
func (h *Handler) initiateOAuth(w http.ResponseWriter, r *http.Request) {
    provider := chi.URLParam(r, "provider")

    // Generate CSRF state token, store in cookie
    state := generateState()
    http.SetCookie(w, &http.Cookie{
        Name:     "oauth_state",
        Value:    state,
        Path:     "/",
        MaxAge:   600, // 10 minutes
        HttpOnly: true,
        Secure:   isSecureCookie(),
        SameSite: http.SameSiteLaxMode,
    })

    cfg := h.getProviderConfig(provider)
    url := cfg.AuthCodeURL(state, oauth2.AccessTypeOffline)
    http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}
```

### Pattern 2: Email-Based Auto-Linking

**What:** When a user logs in with OAuth and their email matches an existing account, the OAuth account is automatically linked to the existing user rather than creating a duplicate.

**When to use:** For apps where email is the canonical identity (like this one).

**Trade-offs:**
- PRO: Seamless UX -- user with email/password who later clicks "Login with Google" gets the same account
- PRO: No duplicate accounts for same person
- CON: Relies on email being verified by the provider (both Google and GitHub verify emails)
- CON: Potential security concern if provider allows unverified emails (mitigated by only trusting verified emails)

**Decision:** Auto-link is safe here because:
1. Google always verifies email addresses
2. GitHub's `user:email` scope returns verified status per email; we only trust `verified: true` emails
3. The existing system already uses email as the unique identifier (`UNIQUE` constraint on `auth.users.email`)

**Example:**

```go
// service.go - Find or create user from OAuth profile
func (s *Service) FindOrCreateUser(ctx context.Context, profile OAuthProfile) (*user.User, error) {
    // 1. Check if OAuth account already linked
    existing, err := s.oauthRepo.FindByProviderAndID(ctx, profile.Provider, profile.ProviderUserID)
    if err == nil && existing != nil {
        return s.userSvc.GetByID(ctx, existing.UserID)
    }

    // 2. Check if email matches existing user (auto-link)
    existingUser, err := s.userSvc.GetByEmail(ctx, profile.Email)
    if err == nil && existingUser != nil {
        // Link OAuth account to existing user
        err = s.oauthRepo.Create(ctx, existingUser.ID(), profile)
        return existingUser, err
    }

    // 3. Create new user (no password)
    newUser, err := s.userSvc.CreateOAuthUser(ctx, user.CreateOAuthUserInput{
        Email:    profile.Email,
        FullName: profile.DisplayName,
    })
    if err != nil {
        return nil, err
    }

    // 4. Link OAuth account and create personal workspace
    err = s.oauthRepo.Create(ctx, newUser.ID(), profile)
    return newUser, err
}
```

### Pattern 3: State Parameter for CSRF and Flow Type

**What:** The OAuth `state` parameter serves double duty: CSRF protection AND encoding the flow type (login vs. account linking).

**When to use:** When the same OAuth callback handler needs to differentiate between "logging in" and "connecting an account from settings."

**Trade-offs:**
- PRO: Single callback URL per provider (simpler config)
- PRO: CSRF protection built into the same mechanism
- CON: State must be parsed carefully

**Example:**

```go
// State format: {random}:{action}
// Login:   "abc123:login"
// Link:    "abc123:link"

func generateState(action string) string {
    random := make([]byte, 16)
    rand.Read(random)
    return base64.URLEncoding.EncodeToString(random) + ":" + action
}

func parseState(state string) (random, action string, err error) {
    parts := strings.SplitN(state, ":", 2)
    if len(parts) != 2 {
        return "", "", errors.New("invalid state format")
    }
    return parts[0], parts[1], nil
}
```

### Pattern 4: Token Handoff via URL Parameter

**What:** After OAuth callback processing, the backend redirects to the frontend with the JWT token as a URL query parameter. The frontend callback page reads it, stores it, and navigates to the dashboard.

**When to use:** When backend and frontend are on different origins (as in this project: Go on :8080, Next.js on :3000).

**Trade-offs:**
- PRO: Works regardless of CORS/cookie domain issues
- PRO: Simple to implement
- CON: Token briefly visible in URL (mitigated by immediate redirect and short-lived nature)
- CON: Token in server logs if not careful

**Mitigation for production:** Use a short-lived one-time code instead of the JWT directly. Backend stores code -> token mapping in Redis (TTL 60s), frontend exchanges code for token via POST. This is more secure but adds complexity. For a self-hosted home inventory app, direct token in URL is acceptable.

**Example:**

```typescript
// frontend/app/[locale]/(auth)/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api/client";

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      router.push(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      apiClient.setToken(token);
      router.push("/dashboard");
    } else {
      router.push("/login?error=missing_token");
    }
  }, [searchParams, router]);

  return <div>Completing sign in...</div>;
}
```

## Data Flow

### OAuth Login Flow (Detailed)

```
1. User clicks "Login with Google" button
   Frontend: window.location.href = "{BACKEND_URL}/auth/oauth/google"

2. Backend generates authorization URL
   - Creates random state token
   - Stores state in HTTP-only cookie (oauth_state, 10min TTL)
   - Builds Google OAuth URL with: client_id, redirect_uri, scope, state
   - Returns 302 redirect to Google

3. User authenticates with Google
   - Google shows consent screen
   - User approves

4. Google redirects to backend callback
   GET {BACKEND_URL}/auth/oauth/google/callback?code=xxx&state=yyy

5. Backend validates state (CSRF check)
   - Read oauth_state cookie
   - Compare with state query param
   - Clear cookie

6. Backend exchanges code for tokens
   - POST to Google token endpoint with code + client_secret
   - Receives access_token (+ optional refresh_token)

7. Backend fetches user profile
   - GET Google userinfo endpoint with access_token
   - Receives: sub (provider ID), email, name, picture

8. Backend resolves user (find-or-create)
   a. Look up user_oauth_accounts by (provider, provider_user_id)
      -> Found: return existing user
   b. Look up auth.users by email
      -> Found: auto-link OAuth account to existing user
   c. Neither found: create new user + OAuth account + personal workspace

9. Backend issues JWT + refresh token
   - Same logic as existing login handler
   - Creates session record

10. Backend redirects to frontend
    302 -> {FRONTEND_URL}/auth/callback?token={jwt}

11. Frontend callback page
    - Reads token from URL
    - Stores in localStorage via apiClient.setToken()
    - AuthProvider.loadUserData() fetches user + workspaces
    - Navigates to /dashboard
```

### Account Linking Flow (Settings)

```
1. Authenticated user clicks "Connect Google" in Security settings
   Frontend: window.location.href = "{BACKEND_URL}/auth/oauth/google?action=link"
   (Backend reads JWT from cookie to know who is linking)

2. Backend generates authorization URL with state="{random}:link"

3-6. Same OAuth flow as login

7. Backend callback detects action=link in state
   - Reads JWT from cookie to get current user ID
   - Links OAuth account to current user
   - Does NOT create new user or issue new token

8. Backend redirects to frontend settings
   302 -> {FRONTEND_URL}/dashboard/settings/security?linked=google

9. Frontend shows success toast
```

### Account Unlinking Flow

```
1. User clicks "Disconnect Google" in Security settings
   Frontend: DELETE /auth/oauth/accounts/google

2. Backend validates:
   - User has at least one other auth method (password OR another provider)
   - Deletes oauth account record

3. Frontend refreshes connected accounts list
```

## Database Changes

### Migration 012: Make password_hash nullable

```sql
-- migrate:up
ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;

-- migrate:down
-- Set a placeholder hash for any OAuth-only users before re-adding constraint
UPDATE auth.users SET password_hash = '$2a$10$placeholder' WHERE password_hash IS NULL;
ALTER TABLE auth.users ALTER COLUMN password_hash SET NOT NULL;
```

**Rationale:** OAuth-only users have no password. The existing `auth.user_oauth_accounts` table already exists in the initial migration (001) with the correct schema, so no new table is needed. The only schema change is making `password_hash` nullable.

### Existing Table: auth.user_oauth_accounts

Already defined in 001_initial_schema.sql with:
- `id` UUID PK
- `user_id` UUID FK -> auth.users (CASCADE)
- `provider` VARCHAR(20) -- "google" or "github"
- `provider_user_id` VARCHAR(255) -- Google sub or GitHub user ID
- `email` VARCHAR(255)
- `display_name` VARCHAR(100)
- `avatar_url` VARCHAR(500)
- `access_token` TEXT -- encrypted at app layer
- `refresh_token` TEXT
- `token_expires_at` TIMESTAMPTZ
- `created_at`, `updated_at`
- UNIQUE(provider, provider_user_id)
- INDEX on user_id
- INDEX on (provider, provider_user_id)

This table is well-designed for the use case. No modifications needed.

## API Routes

### New Public Routes (no auth required)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/oauth/{provider}` | Initiate OAuth flow (redirects to provider) |
| GET | `/auth/oauth/{provider}/callback` | Handle provider callback (exchanges code, issues JWT) |

### New Protected Routes (auth required)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/oauth/accounts` | List connected OAuth accounts for current user |
| DELETE | `/auth/oauth/accounts/{provider}` | Unlink an OAuth account |

### Frontend Routes

| Route | Purpose |
|-------|---------|
| `/auth/callback` | NEW: OAuth callback landing page (stores token, redirects) |
| `/dashboard/settings/security` | MODIFIED: Add Connected Accounts section |

## Provider Configuration

### Google OAuth

| Setting | Value |
|---------|-------|
| Auth URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token URL | `https://oauth2.googleapis.com/token` |
| UserInfo URL | `https://www.googleapis.com/oauth2/v3/userinfo` |
| Scopes | `openid email profile` |
| Callback URL | `{BACKEND_URL}/auth/oauth/google/callback` |
| Response fields | `sub` (ID), `email`, `name`, `picture` |
| Email verified | Always verified by Google |

### GitHub OAuth

| Setting | Value |
|---------|-------|
| Auth URL | `https://github.com/login/oauth/authorize` |
| Token URL | `https://github.com/login/oauth/access_token` |
| User URL | `https://api.github.com/user` |
| Email URL | `https://api.github.com/user/emails` |
| Scopes | `read:user user:email` |
| Callback URL | `{BACKEND_URL}/auth/oauth/github/callback` |
| Response fields | `id` (ID), `login`, `name`, `avatar_url` |
| Email handling | Must fetch from `/user/emails` and pick primary verified email |

### Environment Variables (already in config.go)

```bash
GOOGLE_CLIENT_ID=     # From Google Cloud Console
GOOGLE_CLIENT_SECRET= # From Google Cloud Console
GITHUB_CLIENT_ID=     # From GitHub Developer Settings
GITHUB_CLIENT_SECRET= # From GitHub Developer Settings
APP_URL=http://localhost:3000   # Frontend URL (already exists)
BACKEND_URL=http://localhost:8080 # Backend URL (already exists)
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google OAuth | Authorization Code flow via `golang.org/x/oauth2` + `golang.org/x/oauth2/google` | Register OAuth app in Google Cloud Console |
| GitHub OAuth | Authorization Code flow via `golang.org/x/oauth2` + `golang.org/x/oauth2/github` | Create OAuth App in GitHub Developer Settings |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| OAuth handler -> OAuth service | Direct method call | Handler validates HTTP, service handles business logic |
| OAuth service -> User service | Direct method call | Reuses existing `GetByEmail`, adds `CreateOAuthUser` |
| OAuth service -> OAuth repository | Direct method call | CRUD on `user_oauth_accounts` table |
| OAuth service -> Session service | Direct method call | Creates session same as email/password login |
| OAuth service -> Workspace service | Direct method call | Creates personal workspace for new OAuth users |
| OAuth handler -> JWT service | Direct method call | Issues access + refresh tokens |
| Frontend social-login -> Backend OAuth endpoint | Browser redirect | `window.location.href` (not fetch) |
| Backend callback -> Frontend callback page | HTTP 302 redirect | Token passed as query parameter |

### Code Changes to Existing Files

**`backend/internal/domain/auth/user/entity.go`:**
- `NewUser` stays as-is (password required for email/password registration)
- Add `NewOAuthUser(email, fullName string) *User` -- creates user with empty password_hash
- `CheckPassword` must handle nil/empty password_hash (return false)

**`backend/internal/domain/auth/user/service.go`:**
- Add `CreateOAuthUser(ctx, CreateOAuthUserInput) (*User, error)` method
- `ServiceInterface` gets new method

**`backend/internal/domain/auth/user/handler.go`:**
- `updatePassword` must check if user has a password (OAuth-only users cannot "change" password, they must "set" password)
- Add `has_password` field to `/users/me` response so frontend knows which UI to show

**`backend/internal/infra/postgres/user_repository.go`:**
- `Save` method: password_hash already handled, but the INSERT must tolerate NULL value now
- `scanUser` helper: handle nullable password_hash in scan

**`backend/internal/api/router.go`:**
- Import `oauth` package
- Initialize OAuth repository, service, handler with dependencies
- Register OAuth routes: initiate and callback in rate-limited public group, accounts list/unlink in protected group

**`frontend/features/auth/components/social-login.tsx`:**
- Add `onClick` handlers that redirect to backend OAuth URLs
- Show loading state during redirect

**`frontend/lib/api/auth.ts`:**
- Add `OAuthAccount` type
- Add `getConnectedAccounts(): Promise<OAuthAccount[]>`
- Add `unlinkAccount(provider: string): Promise<void>`
- Add `has_password` to `User` type

**`frontend/components/settings/security-settings.tsx`:**
- Add Connected Accounts section between Sessions and Danger Zone
- Import and render new `ConnectedAccounts` component

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-100 users | Current design is fine. State in cookies, tokens in DB. |
| 100-10K users | Consider moving OAuth state to Redis (already available) instead of cookies for better server-side validation |
| 10K+ users | Rate limit OAuth initiation per IP. Implement token encryption for `user_oauth_accounts.access_token` |

### Scaling Priorities

1. **First concern:** OAuth state cookie-based CSRF works fine at small scale. If deploying behind multiple backend instances, cookies are already scoped to the domain so this works without session affinity.
2. **Token storage:** The `access_token` and `refresh_token` in `user_oauth_accounts` are noted as "must be encrypted at application layer" in the schema comments. For a home inventory app, these tokens are not actively used after initial login (we don't call Google/GitHub APIs on behalf of users). Store them for completeness but they can be left null if not needed for future features.

## Anti-Patterns

### Anti-Pattern 1: Using NextAuth.js Alongside Custom Auth

**What people do:** Drop in NextAuth.js to handle OAuth while keeping the existing custom JWT auth system.
**Why it's wrong:** Creates two parallel auth systems. NextAuth manages its own sessions and tokens, conflicting with the existing JWT + refresh token + session tracking system. Double the session management, double the logout logic, double the security surface.
**Do this instead:** Implement OAuth directly in the Go backend using `golang.org/x/oauth2`. The backend already has all the infrastructure (JWT service, session service, cookie management). OAuth is just a different way to authenticate -- the token issuance after authentication is identical.

### Anti-Pattern 2: Exchanging OAuth Tokens in the Frontend

**What people do:** Use Google's JavaScript SDK to get tokens client-side, then send them to the backend.
**Why it's wrong:** The backend cannot verify the token came from a legitimate OAuth flow (not a forged request). Also requires the client_secret in the frontend (for code exchange) or uses the implicit flow (less secure, no refresh tokens).
**Do this instead:** Backend-driven Authorization Code flow. The backend generates the auth URL, handles the callback, and exchanges the code server-side. Client secret never leaves the server.

### Anti-Pattern 3: Creating Duplicate Accounts on OAuth Login

**What people do:** Always create a new user when someone logs in with OAuth, ignoring existing email/password accounts.
**Why it's wrong:** Users end up with two accounts for the same email. Their existing data (workspaces, inventory, preferences) is in the email/password account, but they are logged into a new empty OAuth account.
**Do this instead:** Auto-link by email. Check `auth.users.email` before creating a new user. If an existing user has the same email, link the OAuth account to that user.

### Anti-Pattern 4: Allowing Unlink of Last Auth Method

**What people do:** Let users disconnect their only OAuth provider without having a password set, locking themselves out.
**Why it's wrong:** User cannot log back in.
**Do this instead:** Before unlinking, check: does the user have a password set? Do they have another OAuth provider linked? If unlinking would leave them with zero auth methods, block the operation and show an error explaining they need to set a password first.

## Build Order

Based on dependency analysis, the recommended build order is:

### Phase 1: Database + Backend Core
1. **Migration 012** -- Make `password_hash` nullable
2. **OAuth entity + repository** -- `OAuthAccount` domain entity, repository interface, PostgreSQL implementation
3. **User entity changes** -- `NewOAuthUser`, handle nullable password in `CheckPassword`
4. **OAuth service** -- `FindOrCreateUser`, `LinkAccount`, `UnlinkAccount`, `GetConnectedAccounts`
5. **OAuth handler** -- `initiateOAuth`, `handleCallback` (Google first, then GitHub)
6. **Router registration** -- Wire everything up in `router.go`

### Phase 2: Frontend
7. **OAuth callback page** -- `/auth/callback` that stores token and redirects
8. **Social login buttons** -- Add `onClick` handlers to existing `SocialLogin` component
9. **Auth API additions** -- `getConnectedAccounts`, `unlinkAccount`
10. **Connected Accounts UI** -- New section in Security settings with link/unlink

### Phase 3: Polish
11. **Error handling** -- OAuth failures redirect to login with error messages
12. **Password UX for OAuth users** -- "Set password" instead of "Change password" for OAuth-only users
13. **i18n** -- Translation keys for all new strings
14. **Tests** -- Backend unit tests for OAuth service, handler tests, frontend component tests

## Key Dependencies

```
Migration 012 (nullable password)
    |
    v
User entity changes (NewOAuthUser)
    |
    v
OAuth repository -------> OAuth service <------- User service (GetByEmail)
                               |                      |
                               v                      v
                         OAuth handler ---------> JWT service
                               |                      |
                               v                      v
                         Router registration      Session service
                               |
                               v
                    Frontend callback page
                               |
                               v
                    Social login buttons (modified)
                               |
                               v
                    Connected accounts UI (settings)
```

## Sources

- [golang.org/x/oauth2 package documentation](https://pkg.go.dev/golang.org/x/oauth2)
- [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)
- [GitHub OAuth Apps - Authorizing](https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/authorizing-oauth-apps)
- [GitHub OAuth scopes documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [Google OAuth2 scopes reference](https://developers.google.com/identity/protocols/oauth2/scopes)
- [OAuth PKCE with Go](https://chrisguitarguy.com/2022/12/07/oauth-pkce-with-go/)
- [Securing OAuth 2.0 with PKCE in Go](https://medium.com/@sanhdoan/securing-your-oauth-2-0-flow-with-pkce-a-practical-guide-with-go-4cd5ec72044b)

---
*Architecture research for: Social Login (Google OAuth + GitHub OAuth)*
*Researched: 2026-02-22*
