# Domain Pitfalls: Social Login (v1.8)

**Domain:** Adding Google OAuth and GitHub OAuth to existing email/password auth system
**Researched:** 2026-02-22
**Confidence:** HIGH
**Scope:** Pitfalls specific to adding social login to the Home Warehouse System

---

## v1.8 Critical Pitfalls

Mistakes that cause security vulnerabilities, account lockout, or require rewrites.

### Pitfall 8-A: password_hash NOT NULL Blocks OAuth-Only User Creation (CRITICAL)

**What goes wrong:**
The `auth.users` table has `password_hash VARCHAR(255) NOT NULL` (migration 001, line 113). Users who sign up exclusively via Google or GitHub have no password. The INSERT fails with a NOT NULL constraint violation. The only current code path for creating users is `NewUser(email, fullName, password)` in `entity.go`, which requires and hashes a password.

**Why it happens:**
The schema was designed before social login existed. Every user creation path in the codebase assumes a password is provided. The `CheckPassword()` method on the entity would also behave unexpectedly with an empty or sentinel hash value -- `bcrypt.CompareHashAndPassword` returns an error for empty input, but a random hash could let a brute-force attack "guess" the sentinel.

**How to avoid:**
1. Add migration: `ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;`
2. Add `NewOAuthUser(email, fullName string) (*User, error)` constructor in `entity.go` that leaves `passwordHash` as empty string
3. Update `CheckPassword()` to return `false` immediately when `passwordHash` is empty -- never run bcrypt on empty/sentinel values
4. Update the password change handler to skip `current_password` requirement when user has no password (first-time password creation for OAuth-only users)
5. Update `scanUser` in `user_repository.go` to handle NULL password_hash from Postgres (use `*string` or handle `pgx.ErrNoRows` for the column)
6. Add a `HasPassword() bool` method to the User entity and expose it in the `/users/me` API response

**Warning signs:**
- OAuth signup returns 500 errors in testing
- Database INSERT failure on user creation during OAuth callback
- Password change UI shows "current password" field for users who never set one

**Phase to address:**
Phase 1 (Database migration + Backend OAuth) -- must be the very first change before any OAuth code runs

---

### Pitfall 8-B: Account Takeover via Unverified OAuth Email Auto-Linking (CRITICAL)

**What goes wrong:**
The project spec says "Auto-link social account to existing email/password account (same email = same user)." If the system blindly trusts the email from an OAuth provider without checking the `email_verified` claim, an attacker can: (1) find out victim's email, (2) add that email to their GitHub account without verifying it, (3) initiate GitHub OAuth login, (4) get auto-linked to the victim's existing account with full access.

**Why it happens:**
Developers assume all OAuth providers verify all emails. Google does verify emails for `@gmail.com` and Google Workspace. But GitHub explicitly allows adding unverified emails to accounts. GitHub's basic `/user` endpoint may return an unverified email or null. The `email_verified` field is not checked because "it's just an email match."

**How to avoid:**
1. **Google:** Trust the `email_verified` claim from the ID token (Google OIDC tokens include this field). Only auto-link when `email_verified: true`.
2. **GitHub:** Call `GET /user/emails` API with the access token. Filter for emails where BOTH `verified: true` AND `primary: true`. Never use the email from the basic `/user` profile endpoint alone.
3. **If email is not verified:** Create a standalone new account (do NOT auto-link). Prompt the user to verify their email or manually link accounts from settings.
4. **Log all auto-link events** in the activity log for audit purposes.
5. **Add test case:** Create a GitHub account with an unverified email matching an existing user, attempt OAuth login -- must NOT auto-link.

**Warning signs:**
- OAuth callback handler does a simple `SELECT * FROM auth.users WHERE email = ?` without checking verification
- No code path for "email not verified by provider"
- Integration tests only test the happy path (verified email)

**Phase to address:**
Phase 1 (Backend OAuth callback handler) -- this is the core security decision

---

### Pitfall 8-C: CSRF Attack via Missing/Weak OAuth State Parameter (CRITICAL)

**What goes wrong:**
Without a proper `state` parameter in the OAuth authorization URL, an attacker crafts a malicious link that completes an OAuth flow in the victim's browser, linking the ATTACKER's social account to the VICTIM's authenticated session. The victim clicks the link, the browser follows the redirect chain, the callback fires in the victim's session, and the attacker's Google/GitHub account gets linked.

**Why it happens:**
Go's `golang.org/x/oauth2` library generates the authorization URL with whatever state you pass in, but does NOT validate state on callback -- that is the application's responsibility. Developers skip state validation because "it works without it" or use a constant/predictable value. RFC 9700 (OAuth 2.0 Security BCP) mandates one-time-use CSRF tokens in the state parameter.

**How to avoid:**
1. Generate a cryptographically random state string (32 bytes, base64url-encoded) for every OAuth initiation request
2. Store the state in an HttpOnly, SameSite=Lax, short-lived cookie (NOT localStorage -- cookies are the only storage available during redirect-based flows)
3. On callback, compare `state` query param with cookie value. Reject on mismatch with 403.
4. Delete the state cookie after validation (one-time use)
5. Set TTL of 5-10 minutes on the state cookie to prevent replay attacks
6. ALSO implement PKCE (code_verifier/code_challenge) for additional protection of the authorization code exchange

**Warning signs:**
- OAuth flow works without any state validation code
- State is stored in localStorage (not available during redirect)
- State cookie has no expiry or uses a predictable value
- No test case that sends a callback with an incorrect state parameter

**Phase to address:**
Phase 1 (Backend OAuth initiation + callback handlers)

---

### Pitfall 8-D: OAuth Callback Cookies Lost in Cross-Origin Production Setup (CRITICAL)

**What goes wrong:**
The current system uses `SameSite=Lax` HttpOnly cookies for auth tokens (see `createAuthCookie` in `handler.go`). The OAuth flow redirects user to Google/GitHub (third-party domain), which then redirects to the Go backend callback URL. In production where frontend (`app.example.com`) and backend (`api.example.com`) are separate origins, the auth cookies set during the callback may not be sent on the redirect to the frontend. The user appears to complete OAuth but arrives at the frontend unauthenticated.

**Why it happens:**
`SameSite=Lax` cookies are sent on top-level GET navigations (which is why the callback itself works). The problem is the redirect chain: Provider -> Backend callback (sets cookies) -> Frontend redirect. The browser may not send the new cookies on the frontend redirect because it is a cross-site redirect sequence. This works perfectly in development (everything on localhost) but breaks in production.

**How to avoid:**
The recommended pattern for this project (matches existing auth architecture):
1. Backend OAuth callback validates the code, creates/links user, generates a one-time authorization code
2. Backend redirects to frontend: `${APP_URL}/auth/callback?code=ONETIME_CODE`
3. Frontend `/auth/callback` page exchanges the one-time code with the backend for JWT tokens via same-origin API call
4. This mirrors the existing flow where frontend calls `/auth/login` and receives tokens in the response body + cookies

This avoids all cross-origin cookie issues because the final token exchange happens same-origin.

**Warning signs:**
- OAuth works in localhost development but fails silently in staging/production
- User completes OAuth consent screen but lands on login page
- Cookies appear in DevTools but are not sent with subsequent requests
- Works in Chrome but fails in Safari (Safari is stricter about cross-site cookies)

**Phase to address:**
Phase 1 (Backend callback) and Phase 2 (Frontend callback page) -- the redirect strategy must be designed upfront

---

### Pitfall 8-E: Workspace Not Created for New OAuth Signups (CRITICAL)

**What goes wrong:**
When a brand new user signs up via OAuth (no existing account with that email), the system creates a user row but forgets to create their personal workspace. The user sees a successful login but the dashboard fails because they have zero workspaces. The `AuthProvider` in `auth-context.tsx` sets `isAuthenticated = false` because `workspaceId` is null (line 144: `const isAuthenticated = !!user && !!workspaceId`).

**Why it happens:**
The workspace creation logic is embedded in the `register` HTTP handler (lines 178-190 of `handler.go`):
```go
workspaceName := fmt.Sprintf("%s's Workspace", user.FullName())
workspaceSlug := fmt.Sprintf("user-%s", user.ID().String())
_, err = h.workspaceSvc.Create(ctx, workspace.CreateWorkspaceInput{...})
```
This is NOT in a shared service -- it is handler-level code. The new OAuth callback handler is a separate code path that must replicate this.

**How to avoid:**
1. Extract workspace creation into a shared `RegisterUser(email, fullName string) (*User, *Workspace, error)` method in a registration service or the user service
2. Both the email/password register handler and the OAuth callback handler must call this same method for new users
3. Add integration test: OAuth signup with new email -> `GET /users/me/workspaces` returns 1+ workspace
4. Add integration test: OAuth login with existing email -> existing workspaces preserved

**Warning signs:**
- OAuth signup appears to work but dashboard shows empty state
- `loadUserData()` in `auth-context.tsx` returns empty workspaces array
- Manual database inspection shows user row exists but no `workspace_members` entry

**Phase to address:**
Phase 1 (Backend OAuth) -- must be part of the OAuth signup flow from day one

---

### Pitfall 8-F: Unlinking Last Auth Method Locks User Out (CRITICAL)

**What goes wrong:**
The connected accounts UI allows users to unlink their Google or GitHub account. A user who signed up via Google (no password set) unlinks Google. They now have zero ways to log in. The account is permanently inaccessible without admin intervention. There is no password reset flow for a user with no password and no linked providers.

**Why it happens:**
The unlink endpoint checks "does this provider link exist?" but not "will the user have any remaining auth method after unlinking?" Password auth and OAuth are independent subsystems with no cross-check.

**How to avoid:**
1. Before allowing unlink, run a guard check: `(password_hash IS NOT NULL AND password_hash != '') OR (COUNT(other_oauth_providers) >= 1)`
2. If unlinking would leave zero auth methods, return 409: "Set a password before unlinking your last social account"
3. Add `has_password: bool` to the `/users/me` API response so the frontend can show/hide UI elements intelligently
4. Frontend: when user tries to unlink last provider and has no password, show inline "Set a password first" prompt
5. Add test: OAuth-only user attempts unlink of sole provider -> 409 error

**Warning signs:**
- No validation logic in unlink endpoint beyond "does this link exist?"
- No test case for "unlink last provider without password"
- Password reset endpoint cannot handle users with no password

**Phase to address:**
Phase 1 (Backend unlink endpoint guard) and Phase 2 (Frontend connected accounts UI)

---

## v1.8 Moderate Pitfalls

### Pitfall 8-G: GitHub Users With Private Email Get Null Email (MODERATE)

**What goes wrong:**
Many GitHub users have their email set to private. The `GET /user` endpoint returns `email: null` for these users. If the OAuth callback only reads email from the basic profile, it cannot create a user account (email is required and unique in `auth.users`), cannot auto-link to existing accounts, and the signup fails with an unhelpful error.

**Why it happens:**
Developers test with their own GitHub account (email public) and never encounter the null email case. The `user:email` scope grants access to `GET /user/emails` which returns all emails including private ones, but this separate API call is often skipped.

**How to avoid:**
1. Request the `user:email` scope in the GitHub OAuth authorization URL
2. After getting the access token, call `GET /user/emails` (not `/user`) to get the email list
3. Filter for the email where `primary: true AND verified: true`
4. If no verified primary email exists, reject the OAuth flow with a clear error message
5. Store the `provider_user_id` as GitHub's numeric user ID (from `/user` response `id` field), not the email

**Warning signs:**
- OAuth works for some GitHub users but not others
- Error logs show "email is required" during user creation
- Test accounts all have public emails

**Phase to address:**
Phase 1 (Backend GitHub OAuth callback)

---

### Pitfall 8-H: OAuth Tokens Stored in Plaintext Violating Schema Contract (MODERATE)

**What goes wrong:**
The `auth.user_oauth_accounts` table has a comment: "OAuth access token. Must be encrypted at application layer." If the implementation stores tokens in plaintext, a database compromise exposes all OAuth access tokens, allowing the attacker to access users' Google/GitHub accounts and potentially read their emails, repos, and other data.

**Why it happens:**
Encryption adds complexity (key management, key rotation). "We'll add encryption later" is a common shortcut. The schema comment is aspirational but not enforced.

**How to avoid:**
1. Use AES-256-GCM encryption with a server-side key from an environment variable
2. Encrypt before INSERT, decrypt after SELECT
3. Store the encryption key in `OAUTH_TOKEN_ENCRYPTION_KEY` env var
4. Alternatively, consider whether you even NEED to store the tokens -- if you only need them during the OAuth callback for profile data, process them immediately and don't store them
5. If tokens are not needed after initial auth, store only the `provider_user_id` and discard the tokens

**Warning signs:**
- `SELECT access_token FROM auth.user_oauth_accounts` returns readable bearer tokens
- No encryption key in environment configuration
- No encrypt/decrypt functions in the OAuth repository code

**Phase to address:**
Phase 1 (Backend OAuth account storage) -- decide upfront: store encrypted tokens or don't store tokens at all

---

### Pitfall 8-I: Session Not Created for OAuth Login (MODERATE)

**What goes wrong:**
The existing login handler creates a session entry in `auth.user_sessions` via `sessionSvc.Create()` (handler.go line 237). The new OAuth callback handler skips this step. Users who log in via OAuth don't appear in the active sessions list, cannot revoke their OAuth sessions, and the session management UI in Security settings shows no sessions.

**Why it happens:**
The session creation code is in the password login handler, not in a shared "post-authentication" function. The OAuth callback is a new code path that needs to replicate session tracking.

**How to avoid:**
1. Extract a `createAuthSession(ctx, userID, refreshToken, userAgent, ipAddress)` helper function
2. Call it from both the password login handler and the OAuth callback handler
3. Add test: OAuth login -> `GET /users/me/sessions` returns the new session
4. Ensure session includes device info and IP like the password login path does

**Warning signs:**
- Sessions page shows no sessions for OAuth-logged-in users
- "Revoke all sessions" doesn't log out OAuth users
- OAuth sessions cannot be individually revoked

**Phase to address:**
Phase 1 (Backend OAuth callback)

---

### Pitfall 8-J: OAuth Popup/Redirect Breaks PWA Standalone Mode (MODERATE)

**What goes wrong:**
On iOS, PWA standalone mode opens OAuth redirects in an in-app browser or Safari, not in the PWA context. After completing OAuth consent, the redirect back to the app fails or opens a new Safari tab instead of returning to the PWA. The user is stuck in Safari with a callback URL that was meant for the PWA.

**Why it happens:**
iOS PWA standalone mode does not handle `window.location.href` redirects to external domains the same way as a browser tab. External URLs may open in Safari, and the callback redirect back cannot target the PWA standalone window.

**How to avoid:**
1. Use `target="_self"` for the OAuth redirect link (not `window.open`)
2. Set the callback redirect URL to the PWA's URL scope so iOS routes back to the PWA
3. On iOS, detect standalone mode with `window.matchMedia('(display-mode: standalone)')` and add special handling
4. Test the complete OAuth flow specifically in PWA standalone mode on iOS (home screen app), not just Safari
5. Consider using the popup approach on desktop and redirect approach on mobile

**Warning signs:**
- OAuth completes but user ends up in Safari instead of the PWA
- Callback URL opens a new tab instead of returning to the app
- Users report "login opens Safari" on iOS

**Phase to address:**
Phase 2 (Frontend OAuth initiation) -- must be tested on actual iOS device in standalone mode

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store OAuth tokens in plaintext | No encryption key management | Security vulnerability if DB compromised; violates schema's own documentation | Never -- either encrypt or don't store tokens at all |
| Skip PKCE for code exchange | 3 fewer lines of code | Authorization code interception attacks possible; OAuth 2.1 mandates PKCE | Never -- both Google and GitHub support PKCE |
| Use provider avatar URL directly | No download/storage needed | URL may expire, third-party image load is a privacy leak | Acceptable for initial implementation -- can download later |
| Auto-link without confirmation | Smoother UX, fewer clicks | Account merging without user awareness | Acceptable ONLY when email is verified by provider |
| No token encryption | Faster development | Security audit failure, credential theft risk | Never |
| Hardcode callback URLs in handler code | Quick to implement | Harder to configure per environment | Acceptable if using env vars for the domain portion |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth | Using `email` from userinfo without checking `email_verified` | Check `email_verified: true` in the OIDC ID token JWT claims |
| GitHub OAuth | Trusting the `email` from `GET /user` | Call `GET /user/emails`, filter for `primary: true AND verified: true` |
| GitHub OAuth | Assuming user has a public email | Many users have private email. Must use `user:email` scope and `/user/emails` endpoint. Without the scope, email may be null. |
| Google OAuth | Using `email` as the immutable provider identifier | Use the `sub` claim (stable numeric ID). Email can change. |
| GitHub OAuth | Using `login` (username) as the provider identifier | Use the numeric `id` field from `/user`. Usernames can change. |
| Both providers | Not handling `?error=access_denied` on callback | User cancels at provider consent screen. Callback receives error params, not code. Must redirect to login with friendly message. |
| Both providers | Using redirect_uri as a query parameter from client | Hardcode callback URL on server. Never accept redirect_uri from user input -- open redirect vulnerability. |
| Both providers | Logging tokens in error messages or access logs | Never log access_token, refresh_token, or authorization code values. Log provider name and user ID only. |
| Existing auth | Not updating JWT claims after OAuth auto-link | When linking an OAuth account to an existing user, the user's name/email in the JWT may be stale. Regenerate the JWT after linking. |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing OAuth state in localStorage | XSS can steal state; not available during redirect flow | Use HttpOnly SameSite=Lax short-lived cookie |
| Accepting arbitrary redirect_uri | Open redirect; authorization code sent to attacker | Hardcode callback URL in provider console AND server validation |
| Not validating ID token `iss` and `aud` claims (Google) | Token substitution -- token from different OAuth client accepted | Verify `iss` is `https://accounts.google.com` and `aud` matches YOUR client ID |
| Logging tokens in access logs | Token theft from log aggregation | Strip tokens from all log output; log only provider + user_id |
| Not setting token expiry in database | Leaked tokens remain valid forever | Always populate `token_expires_at` column and check before use |
| No rate limiting on OAuth callback endpoint | Brute-force authorization code guessing | Rate limit callback to ~10 req/min per IP |
| Using HTTP for callback in production | Token interception via MITM | Enforce HTTPS callback URLs; reject HTTP in production |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Social buttons present but non-functional (CURRENT STATE) | Users click Google/GitHub and nothing happens -- frustration | Current `SocialLogin` component has buttons with no onClick. Either hide until implemented or show "coming soon" tooltip. |
| No loading state during OAuth redirect | Screen goes blank for 1-3 seconds during redirect to Google | Show "Redirecting to Google..." spinner before `window.location.href` change |
| Generic "login failed" on OAuth error | User has no idea why (cancelled? wrong account? email conflict?) | Map errors: "You cancelled the login", "No verified email found on your GitHub account", "This email is already registered -- try logging in with your password" |
| Password change UI shows "current password" for OAuth-only users | Users who signed up via Google see a required field they cannot fill | Detect `has_password: false` and show "Set a new password" with no current password requirement |
| Connected accounts not discoverable | Users cannot find where to link/unlink providers | Add "Connected Accounts" subsection to Security settings with clear provider icons |
| No visual indicator of how user is logged in | User forgets auth method, tries wrong login next time | Show connected provider badges in profile; show "No password set" in Security settings for OAuth-only users |
| Email change disconnects from OAuth | User changes email in profile, then OAuth provider email no longer matches | Warn user: "Changing your email will disconnect your linked Google account" or keep the link based on provider_user_id, not email |

## "Looks Done But Isn't" Checklist

- [ ] **OAuth login flow:** Often missing error handling for user cancellation -- verify callback handles `?error=access_denied` gracefully
- [ ] **Account linking:** Often missing `email_verified` check -- verify GitHub emails checked via `/user/emails` API with `verified: true` filter
- [ ] **New user via OAuth:** Often missing personal workspace creation -- verify `GET /users/me/workspaces` returns a workspace after new OAuth signup
- [ ] **Unlink provider:** Often missing "last auth method" guard -- verify unlinking sole provider with no password returns 409 error
- [ ] **Password change for OAuth users:** Often requires current password when none exists -- verify OAuth-only users can set password without current password
- [ ] **State parameter:** Often present but validation skipped -- verify callback rejects requests with missing or wrong state value
- [ ] **Session tracking:** Often creates user but no session row -- verify `auth.user_sessions` gets entry after OAuth login
- [ ] **Token storage:** Schema says "Must be encrypted" -- verify tokens in `user_oauth_accounts.access_token` are encrypted or not stored
- [ ] **PKCE:** Often skipped because "it works without it" -- verify `code_verifier` sent in token exchange
- [ ] **Provider user_id:** Often stores email instead of immutable ID -- verify `provider_user_id` uses Google `sub` claim / GitHub numeric `id`, not email
- [ ] **PWA standalone mode:** Often only tested in browser -- verify full OAuth flow works when app is launched from iOS home screen
- [ ] **GitHub private email:** Often only tested with own account -- verify OAuth handles GitHub users with private email setting

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| password_hash NOT NULL blocks signup | LOW | Single migration to drop NOT NULL. No data loss. Backward compatible (existing users keep their hashes). |
| Account takeover via unverified email | HIGH | Audit all OAuth-linked accounts. Cross-reference with provider email verification status. Force re-verification for suspicious links. Notify affected users. Revoke all sessions. |
| Missing workspace for OAuth users | MEDIUM | Script: find users with zero workspace_members entries, create personal workspace for each. One-time fix. |
| User locked out (unlinked last provider) | MEDIUM | Admin endpoint to set a password hash directly, or re-link OAuth. Manual per-user intervention required. |
| CSRF via missing state | HIGH | Cannot determine which links were attacker-initiated. Must audit all recently linked OAuth accounts and potentially force re-linking. |
| Tokens stored in plaintext | HIGH | Rotate all stored tokens. Add encryption. Migration requires all users to re-authenticate with providers to get new tokens. |
| Missing sessions for OAuth users | LOW | Users can log out and log back in to create session. Or run migration to create session entries for existing OAuth users. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 8-A: password_hash NOT NULL | Phase 1: DB migration | `\d auth.users` shows `password_hash` nullable; OAuth signup succeeds |
| 8-B: Unverified email linking | Phase 1: OAuth callback | Test: GitHub account with unverified email -> does NOT auto-link |
| 8-C: Missing CSRF state | Phase 1: OAuth init + callback | Test: callback with random state -> 403 Forbidden |
| 8-D: Cross-origin cookies | Phase 1 + 2: Callback strategy | Test: full OAuth flow in production-like environment (separate domains) |
| 8-E: Missing workspace | Phase 1: OAuth signup | Test: new OAuth user -> `GET /users/me/workspaces` returns 1+ workspace |
| 8-F: Unlink lockout | Phase 1 (backend) + Phase 2 (UI) | Test: OAuth-only user unlinks sole provider -> 409 |
| 8-G: GitHub private email | Phase 1: GitHub callback | Test: OAuth with private-email GitHub account -> uses email from `/user/emails` |
| 8-H: Plaintext tokens | Phase 1: OAuth storage | Verify: SELECT from user_oauth_accounts returns encrypted blob, not bearer token |
| 8-I: Missing session | Phase 1: OAuth callback | Test: OAuth login -> `GET /users/me/sessions` shows new session |
| 8-J: PWA standalone mode | Phase 2: Frontend OAuth | Test: full OAuth flow from iOS home screen PWA |

## Sources

- [PortSwigger: OAuth 2.0 authentication vulnerabilities](https://portswigger.net/web-security/oauth) -- comprehensive attack taxonomy
- [Doyensec: Common OAuth Vulnerabilities (2025)](https://blog.doyensec.com/2025/01/30/oauth-common-vulnerabilities.html) -- recent vulnerability patterns
- [Auth0: Prevent CSRF Attacks in OAuth 2.0](https://auth0.com/blog/prevent-csrf-attacks-in-oauth-2-implementations/) -- state parameter best practices
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/rfc9700/) -- authoritative security guidance
- [Curity: How to Integrate Social Logins the Right Way](https://curity.medium.com/how-to-integrate-social-logins-the-right-way-7e8c075b484a) -- integration patterns
- [WorkOS: Defending OAuth - Common Attacks](https://workos.com/blog/oauth-common-attacks-and-how-to-prevent-them) -- attack prevention
- [Curity: OAuth and Cookies in Browser Based Apps](https://curity.io/resources/learn/oauth-cookie-best-practices/) -- cookie handling
- [CodeQL: Use of constant state value in OAuth 2.0 (Go)](https://codeql.github.com/codeql-query-help/go/go-constant-oauth2-state/) -- Go-specific CSRF detection
- [Authentik: email_verified true by default is unsafe](https://github.com/goauthentik/authentik/issues/16205) -- email verification pitfall
- [NextAuth: OAuthAccountNotLinked errors](https://github.com/nextauthjs/next-auth/discussions/2808) -- account linking edge cases
- [better-auth: Can't unlink if only OAuth provider](https://github.com/better-auth/better-auth/issues/4742) -- unlink lockout pattern
- [Auth0 Community: PWA offline mode with OAuth tokens](https://community.auth0.com/t/spa-pwa-offline-mode-localstorage-rotating-tokens/46576) -- PWA + OAuth token management
- Codebase analysis: `backend/db/migrations/001_initial_schema.sql`, `backend/internal/domain/auth/user/entity.go`, `backend/internal/domain/auth/user/handler.go`, `backend/internal/api/middleware/auth.go`, `frontend/lib/contexts/auth-context.tsx`, `frontend/features/auth/components/social-login.tsx`

---
*Pitfalls research for: Adding Google/GitHub OAuth to Home Warehouse System (v1.8 Social Login)*
*Researched: 2026-02-22*
