# Phase 40: Database Migration and Backend OAuth Core - Research

**Researched:** 2026-02-22
**Domain:** Database schema migration + Go backend OAuth2 Authorization Code flow (Google + GitHub)
**Confidence:** HIGH

## Summary

Phase 40 delivers the complete backend for Google and GitHub OAuth login/signup. The codebase is already well-prepared: the `auth.user_oauth_accounts` table exists in migration 001, all four OAuth environment variables are read in `config.go`, and the existing auth infrastructure (JWT service, session tracking, cookie management) can be reused identically for OAuth-authenticated users. The single new dependency is `golang.org/x/oauth2 v0.35.0` with built-in PKCE support.

The implementation requires three categories of work: (1) a database migration to make `password_hash` nullable and add `has_password` boolean, (2) a new `auth/oauth` domain package following existing project patterns (entity, handler, service, repository, errors), and (3) modifications to existing user entity/service/repository to support OAuth-only users. The most critical technical decisions are already locked in from the v1.8 research: backend-driven Authorization Code flow, one-time code exchange for token handoff, no provider token storage, and PKCE on all flows.

**Primary recommendation:** Build in dependency order -- migration first, then user entity changes, then OAuth repository/service/handler, then router wiring. All six critical pitfalls (8-A through 8-F) must be addressed in this phase. Do not defer any security protections.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHM-01 | Database migration makes password_hash nullable for OAuth-only accounts | Migration 012: `ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;` -- enables OAuth-only users. User entity `Reconstruct` and repository `scanUser` must handle nullable column. |
| SCHM-02 | Database migration adds has_password boolean column to auth.users | Migration 012: `ALTER TABLE auth.users ADD COLUMN has_password BOOLEAN NOT NULL DEFAULT true;` -- existing users default to true. Exposed via `/users/me` response. |
| OAUTH-01 | User can log in with Google OAuth (Authorization Code flow with PKCE) | `golang.org/x/oauth2` with `endpoints.Google`, scopes `openid email profile`, PKCE via `oauth2.GenerateVerifier()` + `oauth2.S256ChallengeOption()`. Callback exchanges code, fetches userinfo, resolves user, issues JWT. |
| OAUTH-02 | User can log in with GitHub OAuth (Authorization Code flow with PKCE) | `golang.org/x/oauth2` with `endpoints.GitHub`, scope `user:email`. Must fetch `/user/emails` for verified primary email (Pitfall 8-G). GitHub supports PKCE since July 2025. |
| OAUTH-03 | User can sign up via Google OAuth (creates account with no password, personal workspace) | `NewOAuthUser()` constructor creates user with NULL password_hash + `has_password=false`. Must call shared workspace creation logic (Pitfall 8-E). |
| OAUTH-04 | User can sign up via GitHub OAuth (creates account with no password, personal workspace) | Same as OAUTH-03 but profile data from GitHub `/user` + `/user/emails`. |
| OAUTH-05 | Social login auto-links to existing account when provider email matches and is verified | Service `FindOrCreateUser` checks `user_oauth_accounts` by provider+ID, then `users` by email. Auto-links only when provider confirms email verified (Pitfall 8-B). |
| OAUTH-06 | Social login rejects auto-link when provider email is not verified | Google: check `email_verified` claim. GitHub: check `verified: true` from `/user/emails`. Unverified emails get 403 redirect with error code. |
| SEC-01 | OAuth flow uses CSRF state parameter (random 32-byte, HttpOnly cookie, validated on callback) | Generate 32-byte random state, store with PKCE verifier in HttpOnly SameSite=Lax cookie (10-min TTL). Validate on callback, reject mismatch with 403, delete after use (Pitfall 8-C). |
| SEC-03 | OAuth callback endpoints are rate-limited (10 req/min per IP) | Use existing `RateLimiter` from `api/middleware/ratelimit.go` with `NewRateLimiter(10, time.Minute)`. Apply to callback route group. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| golang.org/x/oauth2 | v0.35.0 | OAuth2 client with PKCE, pre-configured Google/GitHub endpoints | Official Go team library. Built-in PKCE via `GenerateVerifier()`, `S256ChallengeOption()`, `VerifierOption()`. Pre-configured endpoints in `golang.org/x/oauth2/endpoints`. Battle-tested. |
| golang.org/x/oauth2/endpoints | (same module) | Provider endpoint constants (Google, GitHub auth/token URLs) | Avoids hardcoding provider URLs. Part of the oauth2 module. |

### Supporting (Already in Project)

| Library | Version | Purpose | How Reused |
|---------|---------|---------|------------|
| golang-jwt/jwt/v5 | v5.3.0 | JWT token issuance after OAuth authentication | Same `jwtService.GenerateToken()` and `GenerateRefreshToken()` as email/password login |
| go-chi/chi/v5 | v5.2.3 | HTTP routing for OAuth endpoints | Register `GET /auth/oauth/{provider}` and `GET /auth/oauth/{provider}/callback` |
| danielgtaylor/huma/v2 | v2.34.1 | OpenAPI-typed endpoints for protected OAuth account routes | `GET /auth/oauth/accounts`, `DELETE /auth/oauth/accounts/{provider}` |
| jackc/pgx/v5 | v5.8.0 | PostgreSQL access for OAuth repository | Same pool-based repository pattern as all other repos |
| golang.org/x/crypto | v0.46.0 | bcrypt for password hashing (unchanged) | `CheckPassword` must handle empty hash gracefully |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| golang.org/x/oauth2 | markbates/goth v1.82.0 | Over-abstraction for 2 providers. Wraps golang.org/x/oauth2. Obscures PKCE config. |
| golang.org/x/oauth2 | simp-lee/oauth | Too new (2024), low adoption. golang.org/x/oauth2 is battle-tested. |
| Cookie-based OAuth state | Redis-based state storage | Overkill for ephemeral 10-min state. Signed HttpOnly cookie is simpler with no infra dependency. |

**Installation:**
```bash
cd backend
go get golang.org/x/oauth2@v0.35.0
```

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── db/
│   ├── migrations/
│   │   └── 012_oauth_nullable_password.sql   # NEW: password_hash nullable + has_password
│   └── queries/
│       └── oauth_accounts.sql                # NEW: sqlc queries for user_oauth_accounts
├── internal/
│   ├── domain/
│   │   └── auth/
│   │       ├── oauth/                        # NEW: OAuth domain package
│   │       │   ├── entity.go                 # OAuthAccount entity + OAuthProfile VO
│   │       │   ├── handler.go                # HTTP handlers (initiate, callback, code exchange)
│   │       │   ├── service.go                # FindOrCreateUser, LinkAccount, UnlinkAccount, GetAccounts
│   │       │   ├── repository.go             # Repository interface
│   │       │   ├── providers.go              # Google/GitHub provider config + profile fetchers
│   │       │   ├── errors.go                 # Domain errors
│   │       │   ├── handler_test.go           # Handler unit tests
│   │       │   └── service_test.go           # Service unit tests
│   │       └── user/
│   │           ├── entity.go                 # MODIFIED: NewOAuthUser, HasPassword, nullable passwordHash
│   │           ├── service.go                # MODIFIED: CreateOAuthUser, SetPassword
│   │           ├── repository.go             # MODIFIED: add FindByProviderUserID if needed
│   │           └── handler.go                # MODIFIED: has_password in /users/me, password set for OAuth-only
│   └── infra/
│       └── postgres/
│           ├── oauth_repository.go           # NEW: PostgreSQL OAuth repo
│           └── user_repository.go            # MODIFIED: handle nullable password_hash
```

### Pattern 1: Backend-Driven Authorization Code Flow with PKCE

**What:** Browser redirects to backend initiate endpoint -> backend redirects to provider -> provider redirects to backend callback -> backend exchanges code with PKCE, resolves user, generates one-time code, redirects to frontend callback page.

**When to use:** Always. Client secret stays server-side. PKCE prevents authorization code interception.

**Example:**
```go
// handler.go - Initiate OAuth
func (h *Handler) initiateOAuth(w http.ResponseWriter, r *http.Request) {
    provider := chi.URLParam(r, "provider")
    cfg := h.getProviderConfig(provider)

    // Generate PKCE verifier + CSRF state
    verifier := oauth2.GenerateVerifier()
    state := generateRandomState() // 32 bytes, base64url

    // Store state+verifier in signed HttpOnly cookie (10 min TTL)
    cookieValue := state + "|" + verifier
    http.SetCookie(w, &http.Cookie{
        Name:     "oauth_state",
        Value:    cookieValue,
        Path:     "/",
        MaxAge:   600,
        HttpOnly: true,
        Secure:   isSecureCookie(),
        SameSite: http.SameSiteLaxMode,
    })

    // Build authorization URL with PKCE challenge
    url := cfg.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
    http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}
```

### Pattern 2: One-Time Code Exchange for Token Handoff

**What:** After OAuth callback, backend stores JWT pair in Redis with a short-lived one-time code (60s TTL). Redirects to frontend with code. Frontend exchanges code for tokens via same-origin POST.

**When to use:** When backend and frontend are on different origins. Avoids cross-origin cookie issues (Pitfall 8-D).

**Example:**
```go
// handler.go - After user resolution in callback
code := generateRandomCode() // 32 bytes, base64url
err := h.redisClient.Set(ctx, "oauth_code:"+code,
    fmt.Sprintf("%s|%s", accessToken, refreshToken), 60*time.Second).Err()

redirectURL := fmt.Sprintf("%s/auth/callback?code=%s", h.appURL, code)
http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
```

```go
// handler.go - Exchange endpoint (POST /auth/oauth/exchange)
func (h *Handler) exchangeCode(ctx context.Context, input *ExchangeInput) (*ExchangeOutput, error) {
    val, err := h.redisClient.GetDel(ctx, "oauth_code:"+input.Body.Code).Result()
    // Parse tokens from val, return in response body + set cookies
}
```

### Pattern 3: Email-Based Auto-Linking with Verification Gate

**What:** When OAuth email matches existing user, auto-link ONLY if provider confirms email is verified. Otherwise reject.

**When to use:** Always for auto-linking. Never trust unverified provider emails.

**Example:**
```go
// service.go - User resolution
func (s *Service) FindOrCreateUser(ctx context.Context, profile OAuthProfile) (*user.User, bool, error) {
    // 1. Check existing OAuth link
    existing, err := s.oauthRepo.FindByProviderAndID(ctx, profile.Provider, profile.ProviderUserID)
    if err == nil && existing != nil {
        u, err := s.userSvc.GetByID(ctx, existing.UserID())
        return u, false, err // false = not new user
    }

    // 2. CRITICAL: Only auto-link if email is verified by provider
    if !profile.EmailVerified {
        return nil, false, ErrEmailNotVerified
    }

    // 3. Check existing user by email (auto-link)
    existingUser, err := s.userSvc.GetByEmail(ctx, profile.Email)
    if err == nil && existingUser != nil {
        _ = s.oauthRepo.Create(ctx, existingUser.ID(), profile)
        return existingUser, false, nil
    }

    // 4. Create new OAuth user + workspace
    newUser, err := s.userSvc.CreateOAuthUser(ctx, user.CreateOAuthUserInput{
        Email:    profile.Email,
        FullName: profile.FullName,
    })
    // ... create workspace, link OAuth account
    return newUser, true, nil // true = new user
}
```

### Pattern 4: Domain Package Structure (Follows Existing Convention)

**What:** New `oauth` package under `domain/auth/` following the same entity-service-handler-repository pattern used by `user`, `session`, `workspace`, `member`, etc.

**When to use:** Always for new domain concepts with their own persistence and HTTP endpoints.

### Anti-Patterns to Avoid

- **NextAuth.js alongside custom Go auth:** Creates parallel auth system. The Go backend already handles JWT issuance, session tracking, and cookie management. OAuth is just another authentication path.
- **Frontend token exchange:** Never expose client_secret to browser. Never accept tokens from frontend. Backend drives the entire code exchange.
- **Auto-link without email verification:** Pre-authentication account takeover vector. Always check `email_verified` (Google OIDC) or `verified: true` (GitHub `/user/emails`).
- **Copy-paste workspace creation:** Extract shared logic from register handler. Both email/password register and OAuth signup must call the same workspace creation code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth authorization URL generation | Manual URL construction with query params | `oauth2.Config.AuthCodeURL(state, opts...)` | Handles encoding, scopes, PKCE challenge correctly. |
| PKCE code verifier/challenge | Manual SHA256 + base64url | `oauth2.GenerateVerifier()` + `oauth2.S256ChallengeOption()` | Cryptographically correct implementation. RFC 7636 compliant. |
| Authorization code exchange | Manual HTTP POST to token endpoint | `oauth2.Config.Exchange(ctx, code, opts...)` | Handles all token endpoint quirks, error parsing, PKCE verifier. |
| Provider endpoint URLs | Hardcoded Google/GitHub URLs | `endpoints.Google`, `endpoints.GitHub` | Maintained by Go team. Updated when providers change URLs. |
| Rate limiting | New rate limiter | Existing `middleware.NewRateLimiter(limit, window)` | Already built with IP extraction, cleanup goroutine, Retry-After headers. |
| State cookie management | Raw cookie creation | Adapt existing `createAuthCookie` pattern from `user/handler.go` | Consistent HttpOnly, Secure, SameSite policy across all auth cookies. |

**Key insight:** The `golang.org/x/oauth2` library handles the entire OAuth protocol complexity. The application code handles user resolution, session creation, and security validation -- which are business logic, not protocol logic.

## Common Pitfalls

### Pitfall 1: password_hash NOT NULL Blocks OAuth-Only User Creation (8-A, CRITICAL)

**What goes wrong:** `auth.users.password_hash` is `VARCHAR(255) NOT NULL` (migration 001, line 113). OAuth signup INSERT fails with constraint violation.
**Why it happens:** Schema designed before social login. All code paths assume password exists.
**How to avoid:**
1. Migration 012: `ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;`
2. Add `has_password BOOLEAN NOT NULL DEFAULT true` column
3. `NewOAuthUser()` constructor with empty passwordHash
4. `CheckPassword()` returns false immediately for empty hash
5. `scanUser()` in repository handles nullable column via `*string`
6. `Reconstruct()` accepts `*string` for passwordHash
**Warning signs:** 500 errors on OAuth signup, INSERT failures in logs.

### Pitfall 2: Account Takeover via Unverified Email (8-B, CRITICAL)

**What goes wrong:** Auto-linking by email without checking provider's email verification status. Attacker adds victim's email to GitHub (unverified), initiates OAuth, gains access to victim's account.
**Why it happens:** Developers assume all providers verify emails. GitHub allows unverified emails.
**How to avoid:**
- Google: Check `email_verified` claim in userinfo response
- GitHub: Call `GET /user/emails`, filter `primary: true AND verified: true`
- Never auto-link with unverified email -- return error instead
**Warning signs:** No `email_verified` check in callback handler. No GitHub `/user/emails` call.

### Pitfall 3: CSRF via Missing State Validation (8-C, CRITICAL)

**What goes wrong:** Attacker crafts callback URL linking attacker's social account to victim's session.
**Why it happens:** `golang.org/x/oauth2` generates auth URL with state but does NOT validate on callback -- that is the application's job.
**How to avoid:**
- 32-byte random state per flow
- HttpOnly SameSite=Lax cookie with 10-min TTL
- Validate on callback, reject mismatch with 403
- Delete cookie after use (one-time)
- Also implement PKCE
**Warning signs:** No state validation code in callback handler. OAuth works without cookies.

### Pitfall 4: Cross-Origin Cookie Loss in Production (8-D, CRITICAL)

**What goes wrong:** Auth cookies set by backend callback not sent to frontend due to cross-origin redirect chain. Works in localhost, breaks in production.
**Why it happens:** Frontend (app.example.com) and backend (api.example.com) are different origins. SameSite=Lax cookies may not survive cross-origin redirect sequence.
**How to avoid:** One-time code exchange pattern. Backend stores JWT pair in Redis (60s TTL), redirects to frontend with code, frontend POSTs code to backend same-origin exchange endpoint.
**Warning signs:** OAuth works locally but user lands unauthenticated in production.

### Pitfall 5: Missing Workspace for New OAuth Users (8-E, CRITICAL)

**What goes wrong:** New OAuth user created but no personal workspace. Dashboard fails because `isAuthenticated` requires non-null workspaceId.
**Why it happens:** Workspace creation logic is in the register HTTP handler, not shared.
**How to avoid:** Extract workspace creation into shared method. OAuth signup calls same method.
**Warning signs:** OAuth signup succeeds but dashboard shows empty state.

### Pitfall 6: Unlink Locks User Out (8-F, CRITICAL)

**What goes wrong:** User unlinks sole OAuth provider with no password. Zero auth methods remain.
**Why it happens:** Unlink endpoint only checks "does this link exist?" not "will user have remaining auth methods?"
**How to avoid:** Guard check: `has_password=true OR COUNT(other_oauth_providers) >= 1`. Return 409 with "Set a password first" message.
**Warning signs:** No validation logic in unlink beyond existence check.

### Pitfall 7: GitHub Private Email Returns Null (8-G, MODERATE)

**What goes wrong:** GitHub `/user` returns `email: null` for private-email users. User creation fails.
**Why it happens:** Developers test with their own account (email public).
**How to avoid:** Always use `GET /user/emails` with `user:email` scope. Filter for `primary: true AND verified: true`.
**Warning signs:** OAuth works for some GitHub users but not others.

## Code Examples

### Migration 012: OAuth-Compatible Schema

```sql
-- migrate:up

-- Allow OAuth-only users (no password)
ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;

-- Track whether user has a password set (for UI logic)
ALTER TABLE auth.users ADD COLUMN has_password BOOLEAN NOT NULL DEFAULT true;

-- migrate:down
UPDATE auth.users SET password_hash = '$2a$10$placeholder' WHERE password_hash IS NULL;
ALTER TABLE auth.users ALTER COLUMN password_hash SET NOT NULL;
ALTER TABLE auth.users DROP COLUMN IF EXISTS has_password;
```

### sqlc Queries for OAuth Accounts

```sql
-- name: GetOAuthAccountByProviderAndID :one
SELECT id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at
FROM auth.user_oauth_accounts
WHERE provider = $1 AND provider_user_id = $2;

-- name: ListOAuthAccountsByUser :many
SELECT id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at
FROM auth.user_oauth_accounts
WHERE user_id = $1
ORDER BY created_at;

-- name: CreateOAuthAccount :one
INSERT INTO auth.user_oauth_accounts (user_id, provider, provider_user_id, email, display_name, avatar_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, user_id, provider, provider_user_id, email, display_name, avatar_url, created_at, updated_at;

-- name: DeleteOAuthAccountByProvider :exec
DELETE FROM auth.user_oauth_accounts
WHERE user_id = $1 AND provider = $2;

-- name: CountOAuthAccountsByUser :one
SELECT COUNT(*) FROM auth.user_oauth_accounts WHERE user_id = $1;
```

### User Entity Changes

```go
// entity.go - New constructor for OAuth users
func NewOAuthUser(email, fullName string) (*User, error) {
    if email == "" {
        return nil, shared.NewFieldError(shared.ErrInvalidInput, "email", "email is required")
    }
    if fullName == "" {
        return nil, shared.NewFieldError(shared.ErrInvalidInput, "full_name", "full name is required")
    }
    now := time.Now()
    return &User{
        id:          uuid.New(),
        email:       email,
        fullName:    fullName,
        passwordHash: "", // No password for OAuth-only users
        hasPassword:  false,
        isActive:     true,
        // ... default preferences same as NewUser
    }, nil
}

// HasPassword returns whether the user has a password set.
func (u *User) HasPassword() bool { return u.hasPassword }

// CheckPassword must handle empty hash
func (u *User) CheckPassword(password string) bool {
    if u.passwordHash == "" {
        return false // OAuth-only users cannot authenticate via password
    }
    err := bcrypt.CompareHashAndPassword([]byte(u.passwordHash), []byte(password))
    return err == nil
}
```

### OAuth Provider Configuration

```go
// providers.go
func GoogleConfig(clientID, clientSecret, backendURL string) *oauth2.Config {
    return &oauth2.Config{
        ClientID:     clientID,
        ClientSecret: clientSecret,
        RedirectURL:  backendURL + "/auth/oauth/google/callback",
        Scopes:       []string{"openid", "email", "profile"},
        Endpoint:     endpoints.Google,
    }
}

func GitHubConfig(clientID, clientSecret, backendURL string) *oauth2.Config {
    return &oauth2.Config{
        ClientID:     clientID,
        ClientSecret: clientSecret,
        RedirectURL:  backendURL + "/auth/oauth/github/callback",
        Scopes:       []string{"user:email"},
        Endpoint:     endpoints.GitHub,
    }
}
```

### Google Profile Fetcher

```go
// providers.go - Fetch Google user profile
type GoogleUserInfo struct {
    Sub           string `json:"sub"`
    Email         string `json:"email"`
    EmailVerified bool   `json:"email_verified"`
    Name          string `json:"name"`
    Picture       string `json:"picture"`
}

func FetchGoogleProfile(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*OAuthProfile, error) {
    client := cfg.Client(ctx, token)
    resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
    // ... decode JSON into GoogleUserInfo
    return &OAuthProfile{
        Provider:       "google",
        ProviderUserID: info.Sub,
        Email:          info.Email,
        EmailVerified:  info.EmailVerified,
        FullName:       info.Name,
        AvatarURL:      info.Picture,
    }, nil
}
```

### GitHub Profile Fetcher (With Private Email Handling)

```go
// providers.go - Fetch GitHub user profile
func FetchGitHubProfile(ctx context.Context, token *oauth2.Token, cfg *oauth2.Config) (*OAuthProfile, error) {
    client := cfg.Client(ctx, token)

    // 1. Get basic profile
    resp, _ := client.Get("https://api.github.com/user")
    // ... decode: id (int), login, name, avatar_url

    // 2. Get verified primary email (handles private email)
    emailResp, _ := client.Get("https://api.github.com/user/emails")
    // ... decode array, find entry where primary=true AND verified=true

    return &OAuthProfile{
        Provider:       "github",
        ProviderUserID: strconv.FormatInt(githubUser.ID, 10),
        Email:          primaryEmail.Email,
        EmailVerified:  primaryEmail.Verified,
        FullName:       githubUser.Name,
        AvatarURL:      githubUser.AvatarURL,
    }, nil
}
```

### Rate-Limited OAuth Callback Route Registration

```go
// router.go additions
oauthCallbackRateLimiter := appMiddleware.NewRateLimiter(10, time.Minute) // SEC-03

r.Group(func(r chi.Router) {
    // OAuth initiate (no rate limit - just redirects)
    r.Get("/auth/oauth/{provider}", oauthHandler.Initiate)
})

r.Group(func(r chi.Router) {
    r.Use(appMiddleware.RateLimit(oauthCallbackRateLimiter))
    r.Get("/auth/oauth/{provider}/callback", oauthHandler.Callback)
})

// One-time code exchange (also rate-limited)
r.Group(func(r chi.Router) {
    r.Use(appMiddleware.RateLimit(authRateLimiter))
    oauthExchangeConfig := huma.DefaultConfig("Home Warehouse API", "1.0.0")
    oauthExchangeConfig.DocsPath = ""
    oauthExchangeConfig.OpenAPIPath = ""
    oauthExchangeAPI := humachi.New(r, oauthExchangeConfig)
    huma.Post(oauthExchangeAPI, "/auth/oauth/exchange", oauthHandler.ExchangeCode)
})

// Protected OAuth account management
r.Group(func(r chi.Router) {
    r.Use(appMiddleware.JWTAuth(jwtService))
    protectedOAuthConfig := huma.DefaultConfig("Home Warehouse API", "1.0.0")
    protectedOAuthConfig.DocsPath = ""
    protectedOAuthConfig.OpenAPIPath = ""
    protectedOAuthAPI := humachi.New(r, protectedOAuthConfig)
    huma.Get(protectedOAuthAPI, "/auth/oauth/accounts", oauthHandler.ListAccounts)
    huma.Delete(protectedOAuthAPI, "/auth/oauth/accounts/{provider}", oauthHandler.UnlinkAccount)
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAuth2 without PKCE (confidential clients) | PKCE mandatory even for confidential clients | RFC 9700 (2024), OAuth 2.1 draft | Both Google and GitHub support PKCE. Use `S256ChallengeOption`. |
| Implicit grant (tokens in URL fragment) | Authorization Code flow only | Deprecated in OAuth 2.1 | Never use implicit grant. |
| `golang.org/x/oauth2/google` sub-package for endpoints | `golang.org/x/oauth2/endpoints` package | 2024 | New `endpoints` package is the canonical location for provider constants. |
| Manual PKCE libraries (grokify/go-pkce) | Built-in PKCE in golang.org/x/oauth2 | v0.21.0+ (2024) | `GenerateVerifier()`, `S256ChallengeOption()`, `VerifierOption()` are native. |

**Deprecated/outdated:**
- Google Identity Services JS SDK implicit flow: Use server-side Authorization Code instead
- `golang.org/x/oauth2/google` endpoint constants: Still works but `endpoints.Google` is preferred
- Storing raw OAuth tokens without encryption: Use NULL or encrypted storage

## Open Questions

1. **One-time code storage key format in Redis**
   - What we know: Redis is available, 60s TTL is standard, `GetDel` provides atomic consume-and-delete
   - What's unclear: Exact key prefix and whether to namespace by provider
   - Recommendation: Use `oauth_code:{random_code}` as key, value is `{access_token}|{refresh_token}|{user_id}`. Provider not needed in key since code is globally unique.

2. **OAuth handler: Chi raw handler vs Huma typed handler**
   - What we know: Initiate and callback endpoints involve HTTP redirects (302), not JSON responses. Existing auth routes (login, register) use Huma typed handlers. The `oauth_state` cookie needs raw `http.SetCookie` access.
   - What's unclear: Whether Huma supports redirect responses cleanly
   - Recommendation: Use raw Chi handlers (`http.HandlerFunc`) for initiate and callback (redirect-based). Use Huma typed handlers for exchange and account management endpoints (JSON-based). This matches the pattern where `RegisterAvatarRoutes` uses Chi directly for multipart.

3. **PKCE verifier storage alongside state**
   - What we know: Both state and verifier must survive the redirect round-trip. Cookie is the only storage mechanism.
   - What's unclear: Whether to use one cookie (pipe-delimited) or two separate cookies
   - Recommendation: Single cookie `oauth_state` with value `{state}|{verifier}`. Simpler to manage, delete after use.

## Sources

### Primary (HIGH confidence)

- [golang.org/x/oauth2 package docs](https://pkg.go.dev/golang.org/x/oauth2) -- PKCE functions verified: `GenerateVerifier()`, `S256ChallengeOption()`, `VerifierOption()`. Version v0.35.0.
- [golang.org/x/oauth2/endpoints](https://pkg.go.dev/golang.org/x/oauth2/endpoints) -- Google and GitHub endpoint constants verified
- [Google OAuth Web Server guide](https://developers.google.com/identity/protocols/oauth2/web-server) -- Authorization Code flow with PKCE
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) -- `openid email profile` scopes, userinfo endpoint, `email_verified` claim
- [GitHub OAuth PKCE support](https://github.com/orgs/community/discussions/15752) -- PKCE confirmed July 2025, client_secret still required
- [GitHub REST API: User Emails](https://docs.github.com/en/rest/users/emails) -- `user:email` scope, primary+verified filtering
- [RFC 9700: OAuth 2.0 Security BCP](https://datatracker.ietf.org/doc/rfc9700/) -- Authoritative security guidance
- Codebase: `backend/db/migrations/001_initial_schema.sql` lines 109-177 (users + user_oauth_accounts tables)
- Codebase: `backend/internal/config/config.go` lines 36-39, 81-84 (OAuth env vars)
- Codebase: `backend/internal/domain/auth/user/handler.go` (login flow, cookie pattern, session creation)
- Codebase: `backend/internal/api/middleware/ratelimit.go` (existing rate limiter)
- Codebase: `backend/internal/api/router.go` (route registration pattern, rate limit groups)
- Project research: `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `STACK.md`, `FEATURES.md`, `PITFALLS.md`

### Secondary (MEDIUM confidence)

- [PortSwigger: OAuth 2.0 vulnerabilities](https://portswigger.net/web-security/oauth) -- Attack taxonomy
- [Doyensec: Common OAuth Vulnerabilities (2025)](https://blog.doyensec.com/2025/01/30/oauth-common-vulnerabilities.html) -- Recent patterns
- [Auth0: Prevent CSRF in OAuth 2.0](https://auth0.com/blog/prevent-csrf-attacks-in-oauth-2-implementations/) -- State parameter best practices

### Tertiary (LOW confidence)

- One-time code Redis TTL of 60 seconds -- standard but should be validated against real flow completion times
- PWA standalone mode OAuth behavior on iOS -- requires physical device testing (Pitfall 8-J, addressed in Phase 42)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Single new dependency verified on pkg.go.dev. All existing infrastructure confirmed via codebase analysis.
- Architecture: HIGH -- Backend-driven Authorization Code flow is established pattern. All integration boundaries verified against existing code. Cross-origin mitigation well-understood.
- Pitfalls: HIGH -- All critical pitfalls sourced from RFC 9700, PortSwigger, and Doyensec 2025. Each validated against this specific codebase.

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, 30-day validity)
