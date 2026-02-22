# Stack Research: Social Login (Google OAuth + GitHub OAuth)

**Domain:** OAuth2 social login for existing Go + Next.js app
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

The existing codebase is remarkably well-prepared for social login. The database already has an `auth.user_oauth_accounts` table with the correct schema. The config already reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` from environment variables. The frontend already has a `SocialLogin` component with Google and GitHub buttons rendered on the login page with an "or continue with" separator.

The only new backend dependency needed is `golang.org/x/oauth2`, which is the standard Go OAuth2 library maintained by the Go team. No new frontend dependencies are required. The entire OAuth flow is backend-driven (redirect-based), so no frontend OAuth SDK is needed.

**Total new Go dependencies:** 1 (`golang.org/x/oauth2`)
**Total new npm packages:** 0

---

## What Already Exists (DO NOT Add)

These are already installed and configured. Listed to prevent duplicate work.

| Capability | Technology | Version/Location | Status |
|------------|-----------|-----------------|--------|
| JWT generation/validation | golang-jwt/jwt/v5 | v5.3.0 in go.mod | Reuse for OAuth login token issuance |
| Password hashing | golang.org/x/crypto | v0.46.0 in go.mod | Unchanged for email/password flow |
| OAuth account storage | auth.user_oauth_accounts | 001_initial_schema.sql (lines 154-177) | Table exists with provider, provider_user_id, email, display_name, avatar_url, tokens |
| OAuth config env vars | Config struct | config/config.go (lines 36-39) | GoogleClientID, GoogleClientSecret, GitHubClientID, GitHubClientSecret |
| Social login buttons | SocialLogin component | frontend/features/auth/components/social-login.tsx | Google + GitHub buttons with brand SVGs, shown on login page |
| Login page layout | Login page | frontend/app/[locale]/(auth)/login/page.tsx | Already renders SocialLogin + separator + LoginForm |
| Auth cookies | createAuthCookie() | user/handler.go (lines 41-51) | HttpOnly, Secure, SameSite=Lax cookies for access_token + refresh_token |
| Session tracking | auth.user_sessions | 009_user_sessions.sql | SHA-256 hashed refresh tokens, device info, IP tracking |
| Security settings page | Settings subpage | frontend/app/.../settings/security/page.tsx | Exists, renders SecuritySettings component |

---

## Recommended Stack Addition

### Backend: golang.org/x/oauth2

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| golang.org/x/oauth2 | v0.35.0 | OAuth2 client with PKCE support, pre-configured Google/GitHub endpoints | Official Go team library. Built-in PKCE via `GenerateVerifier()`, `S256ChallengeOption()`, `VerifierOption()`. Pre-configured provider endpoints in `golang.org/x/oauth2/endpoints` sub-package. Battle-tested, millions of production users. |

**Key functions used:**

```go
import (
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/endpoints"
)

// Configuration (one per provider)
googleConfig := &oauth2.Config{
    ClientID:     cfg.GoogleClientID,
    ClientSecret: cfg.GoogleClientSecret,
    RedirectURL:  cfg.BackendURL + "/auth/oauth/google/callback",
    Scopes:       []string{"openid", "email", "profile"},
    Endpoint:     endpoints.Google,
}

// PKCE flow (built into the library)
verifier := oauth2.GenerateVerifier()
url := config.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
// ... user redirected to provider ...
token, err := config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
```

### Frontend: No New Dependencies

The OAuth flow is entirely backend-driven:

1. Frontend button navigates to `GET /auth/oauth/google` (or github)
2. Backend redirects (302) to provider authorization URL
3. Provider redirects back to `GET /auth/oauth/google/callback`
4. Backend exchanges code, resolves user, issues JWT, sets cookies
5. Backend redirects (302) to frontend `/dashboard`

This means zero new npm packages. The existing `SocialLogin` component just needs `onClick` handlers that do `window.location.href = "/api/auth/oauth/google"`.

---

## OAuth Provider Configuration Details

### Google OAuth

```go
googleConfig := &oauth2.Config{
    ClientID:     cfg.GoogleClientID,
    ClientSecret: cfg.GoogleClientSecret,
    RedirectURL:  cfg.BackendURL + "/auth/oauth/google/callback",
    Scopes:       []string{"openid", "email", "profile"},
    Endpoint:     endpoints.Google,
    // endpoints.Google provides:
    //   AuthURL:  "https://accounts.google.com/o/oauth2/auth"
    //   TokenURL: "https://oauth2.googleapis.com/token"
}
```

| Item | Value |
|------|-------|
| Scopes | `openid`, `email`, `profile` |
| Userinfo URL | `GET https://www.googleapis.com/oauth2/v3/userinfo` |
| Response fields | `sub` (unique ID), `email`, `email_verified`, `name`, `picture` |
| Unique identifier | `sub` claim (stable, never changes) |
| PKCE support | Yes, optional for confidential clients |

### GitHub OAuth

```go
githubConfig := &oauth2.Config{
    ClientID:     cfg.GitHubClientID,
    ClientSecret: cfg.GitHubClientSecret,
    RedirectURL:  cfg.BackendURL + "/auth/oauth/github/callback",
    Scopes:       []string{"user:email"},
    Endpoint:     endpoints.GitHub,
    // endpoints.GitHub provides:
    //   AuthURL:  "https://github.com/login/oauth/authorize"
    //   TokenURL: "https://github.com/login/oauth/access_token"
}
```

| Item | Value |
|------|-------|
| Scopes | `user:email` (grants access to profile + email list) |
| User profile URL | `GET https://api.github.com/user` (returns `id`, `login`, `name`, `avatar_url`) |
| Emails URL | `GET https://api.github.com/user/emails` (returns array with `email`, `primary`, `verified`) |
| Unique identifier | `id` field (integer, stable) |
| Email resolution | Filter for `primary: true` AND `verified: true` from emails array |
| PKCE support | Yes (added July 2025), client_secret still required |

---

## Security: PKCE + CSRF State

### PKCE (Proof Key for Code Exchange)

Use PKCE for defense-in-depth even though this is a confidential client (has client_secret). Both Google and GitHub support it. The `golang.org/x/oauth2` library handles the cryptographic details:

```go
verifier := oauth2.GenerateVerifier()  // 32 bytes random, base64url encoded
// Store verifier in short-lived cookie alongside state
url := config.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
// On callback:
token, err := config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
```

### CSRF State Parameter

Generate cryptographically random state, store in HTTP-only cookie, verify on callback:

```go
stateBytes := make([]byte, 32)
crypto_rand.Read(stateBytes)
state := base64.URLEncoding.EncodeToString(stateBytes)
// Cookie: oauth_state={state}|{verifier}, HttpOnly, Secure, SameSite=Lax, MaxAge=600
```

Store both state and PKCE verifier in a single cookie (pipe-delimited), encrypted/signed with the existing JWT_SECRET. This avoids needing Redis or server-side session storage for OAuth state.

---

## Integration with Existing Auth System

### Token Issuance (Reuse Existing Pattern)

The existing `login` handler (user/handler.go:218-253) shows the exact pattern:

```go
// After OAuth provider verification, reuse the same token issuance:
token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())

// Set cookies (same as email/password login):
http.SetCookie(w, createAuthCookie("access_token", token, accessTokenMaxAge))
http.SetCookie(w, createAuthCookie("refresh_token", refreshToken, refreshTokenMaxAge))

// Create session (same as email/password login):
h.sessionSvc.Create(ctx, user.ID(), refreshToken, userAgent, ipAddress)
```

### User Creation for OAuth-Only Users

The `User` entity requires non-empty `passwordHash` (DB column is `VARCHAR(255) NOT NULL`). For OAuth-only users:

**Option A (recommended):** Make `password_hash` nullable in a migration. Add a `has_password` boolean to `auth.users`. This is the cleanest approach and lets the UI show "Set Password" instead of "Change Password" for OAuth-only users.

**Option B:** Store a random unguessable bcrypt hash. The user cannot login via password because they do not know the random input. This avoids a migration but is semantically confusing.

**Recommendation:** Option A. One small migration:
```sql
ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE auth.users ADD COLUMN has_password BOOLEAN NOT NULL DEFAULT true;
```

### Auto-Linking by Email

When an OAuth login arrives with an email that matches an existing `auth.users` row:

1. Look up `auth.user_oauth_accounts` by (provider, provider_user_id) -- not found
2. Look up `auth.users` by email -- found existing user
3. Create `auth.user_oauth_accounts` row linking provider to existing user
4. Issue JWT and login as existing user

This implements the "same email = same account" requirement with zero user friction.

---

## New API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth/oauth/{provider}` | GET | Public | Redirect to provider authorization URL |
| `/auth/oauth/{provider}/callback` | GET | Public | Handle callback, exchange code, issue JWT, redirect to frontend |
| `/users/me/connected-accounts` | GET | Protected | List linked OAuth accounts for settings UI |
| `/users/me/connected-accounts/{provider}` | DELETE | Protected | Unlink an OAuth account (with safety check) |
| `/users/me/connected-accounts/{provider}` | POST | Protected | Initiate linking flow for already-authenticated user |

---

## New sqlc Queries

```sql
-- Find OAuth account by provider + provider_user_id (login lookup)
-- name: GetOAuthAccount :one
SELECT * FROM auth.user_oauth_accounts
WHERE provider = $1 AND provider_user_id = $2;

-- List all OAuth accounts for a user (settings page)
-- name: ListOAuthAccountsByUser :many
SELECT provider, provider_user_id, email, display_name, avatar_url, created_at
FROM auth.user_oauth_accounts
WHERE user_id = $1 ORDER BY created_at;

-- Create OAuth account link
-- name: CreateOAuthAccount :one
INSERT INTO auth.user_oauth_accounts (user_id, provider, provider_user_id, email, display_name, avatar_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- Delete OAuth account link (unlink)
-- name: DeleteOAuthAccount :exec
DELETE FROM auth.user_oauth_accounts
WHERE user_id = $1 AND provider = $2;

-- Count OAuth accounts for user (safety check before unlink)
-- name: CountOAuthAccountsByUser :one
SELECT COUNT(*) FROM auth.user_oauth_accounts WHERE user_id = $1;
```

---

## Database Migration Needed

```sql
-- migrate:up

-- Allow OAuth-only users (no password)
ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;

-- Track whether user has a password set (for UI logic)
ALTER TABLE auth.users ADD COLUMN has_password BOOLEAN NOT NULL DEFAULT true;

-- migrate:down
UPDATE auth.users SET password_hash = '' WHERE password_hash IS NULL;
ALTER TABLE auth.users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE auth.users DROP COLUMN IF EXISTS has_password;
```

---

## Installation

```bash
# Backend only -- single new dependency
cd /home/antti/Repos/Misc/home-warehouse-system/backend
go get golang.org/x/oauth2@v0.35.0

# No frontend packages needed
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| golang.org/x/oauth2 | markbates/goth v1.82.0 | Goth wraps golang.org/x/oauth2 internally. Adds abstraction for 50+ providers we do not need (only Google + GitHub). Obscures PKCE configuration. golang.org/x/oauth2 is lighter, has native PKCE support, and is maintained by the Go team. |
| golang.org/x/oauth2 | simp-lee/oauth | Too new (2024), low adoption (< 100 GitHub stars). golang.org/x/oauth2 is battle-tested with millions of users. |
| Backend-driven redirects | NextAuth.js / Auth.js | Would duplicate auth logic between frontend and backend. JWT issuance, session tracking, and cookie management all live in Go. Adding a Node.js auth layer creates two sources of truth and doubles the attack surface. |
| Backend-driven redirects | Google Identity Services JS SDK | Uses implicit grant (deprecated in OAuth 2.1). Authorization code flow with backend exchange is more secure. GitHub has no equivalent frontend SDK, so you would need two different patterns. |
| Cookie-based OAuth state | Redis-based state storage | Overkill for ephemeral state (10-minute TTL). Signed HTTP-only cookie is simpler, no infrastructure dependency. State is verified once on callback and discarded. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| markbates/goth | Over-abstraction for 2 providers. Wraps golang.org/x/oauth2. PKCE configuration requires digging into provider internals. | golang.org/x/oauth2 directly |
| NextAuth.js / Auth.js | Creates separate auth system in Node.js alongside existing Go auth. Two token issuance paths = bugs and security gaps. | Backend-driven OAuth reusing existing JWT service |
| Google Identity Services JS SDK | Implicit grant is deprecated. Frontend token handling is XSS-vulnerable. Not available for GitHub. | Server-side authorization code flow |
| Long-term provider token storage | Not needed for login. Provider tokens are ephemeral -- used once to fetch profile, then discarded. Storing them adds encryption/rotation burden. | Store only provider_user_id for future login correlation |
| Separate PKCE library (grokify/go-pkce) | golang.org/x/oauth2 v0.35.0 has native PKCE support built in. No external library needed. | oauth2.GenerateVerifier() + oauth2.S256ChallengeOption() |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| golang.org/x/oauth2 v0.35.0 | Go 1.25 | Go 1.18+ required for generics. Go 1.25 fully compatible. |
| golang.org/x/oauth2 v0.35.0 | golang-jwt/jwt/v5 v5.3.0 | No interaction. OAuth2 lib handles provider tokens; JWT lib handles app tokens. Independent concerns. |
| golang.org/x/oauth2 v0.35.0 | go-chi/chi/v5 v5.2.3 | No interaction. OAuth handlers register on Chi router like all other handlers. |
| golang.org/x/oauth2/endpoints | Same module | Part of golang.org/x/oauth2 module. No separate version. |

---

## Architecture: Complete OAuth Flow

```
1. User clicks "Sign in with Google" button
2. Frontend: window.location.href = "https://backend/auth/oauth/google"
3. Backend /auth/oauth/google handler:
   a. Generate PKCE verifier (oauth2.GenerateVerifier())
   b. Generate CSRF state (32 random bytes, base64url)
   c. Set cookie: oauth_data = encrypt(state + verifier), HttpOnly, Secure, MaxAge=600
   d. Build auth URL with state + PKCE challenge
   e. Redirect 302 to Google authorization URL
4. User authenticates and consents on Google
5. Google redirects to: /auth/oauth/google/callback?code=xxx&state=yyy
6. Backend /auth/oauth/google/callback handler:
   a. Read oauth_data cookie, decrypt, extract state + verifier
   b. Verify state matches query parameter (CSRF check)
   c. Exchange code for token: config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
   d. Call Google userinfo API with access token
   e. Extract: sub (provider_user_id), email, name, picture
   f. Resolve user (see below)
   g. Generate JWT pair (access + refresh)
   h. Set auth cookies (access_token, refresh_token)
   i. Create session in auth.user_sessions
   j. Clear oauth_data cookie
   k. Redirect 302 to frontend /dashboard
```

### User Resolution Logic

```
Given: provider, provider_user_id, email, name, avatar_url

1. SELECT FROM auth.user_oauth_accounts WHERE provider=$1 AND provider_user_id=$2
   - FOUND: Load user by user_id. Login. Done.

2. SELECT FROM auth.users WHERE email=$1
   - FOUND: Auto-link. INSERT INTO auth.user_oauth_accounts. Login as existing user. Done.

3. Neither found:
   a. INSERT INTO auth.users (email, full_name, password_hash=NULL, has_password=false)
   b. Create personal workspace (same as register handler)
   c. INSERT INTO auth.user_oauth_accounts
   d. Login as new user. Done.
```

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| golang.org/x/oauth2 choice | HIGH | Official Go library, verified PKCE API on pkg.go.dev, v0.35.0 published Jan 2026 |
| Google endpoints + scopes | HIGH | Verified on Google OAuth docs and pkg.go.dev/golang.org/x/oauth2/endpoints |
| GitHub endpoints + scopes | HIGH | Verified on GitHub docs, PKCE support confirmed (July 2025 announcement) |
| No frontend deps needed | HIGH | Backend-driven redirect flow confirmed by codebase analysis. Existing cookies + JWT pattern handles everything. |
| Database readiness | HIGH | auth.user_oauth_accounts table verified in 001_initial_schema.sql with correct columns and indexes |
| Config readiness | HIGH | All 4 OAuth env vars already read in config.go |
| Frontend readiness | HIGH | SocialLogin component exists with buttons, login page renders it with separator |

---

## Sources

### Verified (HIGH confidence)
- [golang.org/x/oauth2 package docs](https://pkg.go.dev/golang.org/x/oauth2) -- PKCE functions verified (GenerateVerifier, S256ChallengeOption, VerifierOption), version v0.35.0 confirmed
- [golang.org/x/oauth2/endpoints](https://pkg.go.dev/golang.org/x/oauth2/endpoints) -- Google and GitHub endpoint constants verified with exact AuthURL/TokenURL values
- [Google OAuth Web Server guide](https://developers.google.com/identity/protocols/oauth2/web-server) -- Authorization code flow with PKCE verified
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) -- openid+email+profile scopes, userinfo endpoint
- [GitHub OAuth PKCE support](https://github.com/orgs/community/discussions/15752) -- PKCE support confirmed July 2025, client_secret still required
- [GitHub REST API for emails](https://docs.github.com/en/rest/users/emails) -- user:email scope, primary+verified email filtering
- [GitHub OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) -- user:email scope grants email access
- [golang/oauth2 issue #59835](https://github.com/golang/go/issues/59835) -- PKCE support tracking, now implemented

### Codebase verification (HIGH confidence)
- `backend/db/migrations/001_initial_schema.sql` -- auth.user_oauth_accounts table (lines 154-177)
- `backend/internal/config/config.go` -- OAuth env var reading (lines 36-39, 81-84)
- `backend/internal/domain/auth/user/handler.go` -- Login flow, cookie creation, session tracking
- `backend/internal/shared/jwt/jwt.go` -- JWT generation/validation interface
- `backend/internal/api/middleware/auth.go` -- JWT middleware pattern
- `backend/internal/domain/auth/session/entity.go` -- Session entity with token hashing
- `frontend/features/auth/components/social-login.tsx` -- Existing Google + GitHub buttons
- `frontend/app/[locale]/(auth)/login/page.tsx` -- Login page with SocialLogin already rendered
- `frontend/lib/api/auth.ts` -- Auth API client
- `frontend/lib/contexts/auth-context.tsx` -- Auth context with login/register/logout
- `frontend/package.json` -- Confirmed no OAuth-related frontend packages needed

---
*Stack research for: Social Login (Google OAuth + GitHub OAuth)*
*Researched: 2026-02-22*
