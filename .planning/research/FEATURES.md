# Feature Research: Social Login (v1.8)

**Domain:** OAuth social login for existing Go + Next.js home inventory app
**Researched:** 2026-02-22
**Confidence:** HIGH

## Existing Infrastructure

Key assets already in place that reduce scope significantly:

- **`auth.user_oauth_accounts` table** already exists in migration 001 with provider, provider_user_id, email, display_name, avatar_url, access_token, refresh_token, token_expires_at -- no new table needed
- **`SocialLogin` component** already rendered on login and register pages with Google/GitHub button placeholders (non-functional, just icons + labels)
- **Login/Register pages** already have the "or continue with" separator pattern between social buttons and email/password form
- **Session tracking** (`auth.user_sessions`) already tracks device info, IP, refresh tokens
- **JWT auth flow** with access + refresh token cookies already working
- **Security settings subpage** exists at `/dashboard/settings/security` with password change, sessions, and account deletion sections

**Critical constraint:** `auth.users.password_hash` is `VARCHAR(255) NOT NULL` -- must be altered to allow NULL for OAuth-only accounts (users who sign up exclusively via social login).

---

## Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Google OAuth login button | Google is the most common social login provider; users expect one-click sign-in | MEDIUM | Requires Google Cloud Console setup, OAuth consent screen config. Backend: `GET /auth/google` (initiate) + `GET /auth/google/callback` (exchange code, fetch profile, issue JWT). Authorization Code flow. No PKCE needed for server-side flow |
| GitHub OAuth login button | Developer-oriented app; GitHub login is the natural second provider for tech-savvy users | MEDIUM | Simpler than Google (no consent screen verification for private apps). Register GitHub OAuth App. Backend: `GET /auth/github` + `GET /auth/github/callback` |
| Auto-link by verified email on first social login | User with existing email/password account clicks Google using same email; they expect it to "just work" and not create a duplicate | MEDIUM | Match by email from provider. ONLY auto-link when provider confirms `email_verified: true`. Create `user_oauth_accounts` row linked to existing user. Security-critical |
| New account creation via social login | Users without existing accounts expect social login to seamlessly create one | MEDIUM | Create `auth.users` row with NULL `password_hash`, create personal workspace (reuse existing workspace creation logic), create `user_oauth_accounts` row. Pull `full_name` and avatar from provider profile |
| Session creation on social login | Social login must produce the same session artifacts as email/password login | LOW | Reuse existing session creation logic: generate JWT access token + refresh token, set httpOnly cookies, create `user_sessions` row |
| Clear error messages for OAuth failures | Users need to understand what went wrong, not see generic errors | LOW | Specific messages: "Authorization was cancelled", "Account exists with a different login method", "Email not verified by provider", "Login session expired, please try again" |
| Redirect back to intended page after OAuth | After the OAuth redirect dance, return user to where they were originally heading | LOW | Store `redirect_to` in OAuth `state` parameter or a short-lived cookie. Restore after successful callback |
| DB migration: password_hash nullable | Prerequisite for OAuth-only accounts to exist | LOW | `ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL;` -- single migration, no data changes needed |

---

## Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Connected accounts management in Security settings | Users can see which providers are linked and link/unlink additional providers | MEDIUM | Add "Connected Accounts" section to existing SecuritySettings component. Show linked providers with disconnect buttons. API: `GET /users/me/oauth-accounts`, `DELETE /users/me/oauth-accounts/:provider` |
| Link additional provider from settings | Authenticated user can connect Google or GitHub to their existing account | MEDIUM | "Connect Google" / "Connect GitHub" buttons in Connected Accounts UI. Initiates OAuth flow while already logged in, callback links provider to current user instead of logging in |
| Unlink provider with safety check | Prevent account lockout when disconnecting last OAuth provider | LOW | Before allowing disconnect: check if user has a password set. If no password and only one provider linked, disable disconnect button with "Set a password first" message |
| Set password for OAuth-only users | OAuth-only users can add a password for flexibility | LOW | New "Set Password" form variant in Security settings. Only requires new_password + confirm (no current_password field). Detectable via new `has_password` field in `/users/me` response |
| Pre-fill profile from provider data | On first social signup, auto-populate full_name from provider profile | LOW | Google provides `given_name`/`family_name` or `name`. GitHub provides `name` field. Use as default for `auth.users.full_name` |
| CSRF protection via state parameter | Prevents CSRF and replay attacks on OAuth callback | LOW | Generate random 32-byte state, store in short-lived httpOnly cookie (5 min TTL), validate on callback. Standard practice but many implementations skip it |

---

## Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-link by unverified email | "Make it seamless for all providers" | **Pre-authentication account takeover:** attacker creates social account with victim's email, gains access to victim's existing account. Well-documented OAuth attack vector. GitHub does NOT verify emails by default | Only auto-link when provider returns `email_verified: true`. Google always verifies. For GitHub, check the `/user/emails` endpoint `verified` field. Unverified = create separate account or show error |
| Storing raw OAuth access/refresh tokens | "We might need API access later" | Tokens are provider credentials. DB compromise = attacker accesses user's Google/GitHub. App never calls provider APIs after initial profile fetch | Store only identification data (provider + provider_user_id + email). Discard tokens after profile fetch. The `user_oauth_accounts` table has columns for tokens but they should remain NULL or be encrypted if stored |
| Many social providers (Apple, Facebook, Microsoft, LinkedIn, etc.) | "More options = more users" | Each provider adds: maintenance burden, credential rotation, consent screen management, edge cases. Diminishing returns after 2 providers. Apple Sign-In requires $99/yr developer account | Start with Google + GitHub. These cover the target audience (home inventory power users who are likely tech-savvy). Add more only in response to actual user demand |
| Automatic full account merge | "If emails match across two existing accounts, merge everything" | Users may intentionally have separate accounts. Forced merge violates principle of least surprise. Merging workspace memberships, activity logs, etc. is extremely complex | Auto-link (add OAuth provider to existing user) is fine and different from account merge (combining two separate user records). Never merge automatically |
| Popup/window-based OAuth flow | "Better UX than full-page redirect" | Popup blockers break it, mobile browsers handle it poorly, cross-window communication is fragile, PWA compatibility issues | Standard redirect flow. The brief page navigation is well-understood by users and works everywhere including PWAs and mobile browsers |
| Token refresh for social providers | "Keep provider tokens fresh" | App has zero need to call Google/GitHub APIs after login. Provider token refresh adds complexity, failure modes, and security surface area | One-time token exchange during login to fetch profile info, then discard. App's own JWT system handles all subsequent auth |
| Optional email/password at signup | "Let OAuth users optionally set a password during signup" | Adds friction to what should be a one-click flow. Users can always add a password later from settings | Social signup creates account with no password. Password can be set later from Security settings if desired |

---

## Feature Dependencies

```
[DB Migration: password_hash nullable]
    (independent, do first -- everything depends on this)

[OAuth callback handler + JWT issuance logic]
    └── requires: [DB Migration]

[Google OAuth backend flow]
    └── requires: [OAuth callback handler]
    └── requires: Google Cloud Console app setup (external)

[GitHub OAuth backend flow]
    └── requires: [OAuth callback handler]
    └── requires: GitHub OAuth App registration (external)

[Auto-link by verified email]
    └── requires: [OAuth callback handler]
    └── requires: Email verification check from provider response

[Social login frontend buttons (wire up)]
    └── requires: [Google OAuth backend flow]
    └── requires: [GitHub OAuth backend flow]

[Connected accounts API endpoints]
    └── requires: [user_oauth_accounts sqlc queries]

[Connected accounts UI in Security settings]
    └── requires: [Connected accounts API endpoints]
    └── requires: [Link flow for authenticated users]

[Unlink provider safety check]
    └── requires: [Connected accounts UI]
    └── requires: [has_password field on /users/me]

[Set password for OAuth-only users]
    └── requires: [has_password field on /users/me]
    └── enhances: [Password change form in Security settings]
```

### Dependency Notes

- **OAuth flows require password_hash nullable:** OAuth-only users have no password. The `NOT NULL` constraint on `password_hash` must be relaxed before any social login can create accounts. This is the first thing to do.
- **Auto-link requires email verification check:** The callback handler must inspect `email_verified` from the provider before linking to existing accounts. Google's OpenID Connect token always includes this. GitHub requires a separate call to `/user/emails` to get verified status.
- **Unlink requires has-password check:** Before allowing unlink of the last OAuth provider, verify the user has a password set. Otherwise they would be permanently locked out. Requires: (1) API to check password existence, (2) UI that disables disconnect with explanation.
- **Set password enhances existing password change:** The current `PasswordChange` component requires `current_password`. For OAuth-only users who have never set a password, it needs a "Set Password" variant with no current password requirement.
- **Google/GitHub flows share callback logic:** Both providers follow the same pattern: validate state, exchange code for token, fetch profile, find-or-create user. The provider-specific parts are only the URLs and profile parsing. Share common logic with provider-specific adapters.

---

## MVP Definition

### Launch With (v1.8)

Everything needed for functional social login with proper security.

- [ ] **DB migration: password_hash nullable** -- prerequisite for OAuth-only accounts
- [ ] **Google OAuth backend** -- `/auth/google` initiate + `/auth/google/callback` handler
- [ ] **GitHub OAuth backend** -- `/auth/github` initiate + `/auth/github/callback` handler
- [ ] **Auto-link by verified email** -- match existing users safely, link OAuth account
- [ ] **New user creation via social login** -- create user (NULL password), workspace, oauth account
- [ ] **CSRF state parameter** -- random state in cookie, validated on callback
- [ ] **Wire up SocialLogin component** -- buttons trigger OAuth redirects, handle callback
- [ ] **Connected accounts section in Security settings** -- list linked providers, disconnect button
- [ ] **OAuth accounts API** -- GET list + DELETE unlink with safety check
- [ ] **Link additional provider from settings** -- authenticated flow to add Google/GitHub
- [ ] **Unlink safety check** -- block disconnect when no password and single provider
- [ ] **has_password field on /users/me** -- enables frontend to show correct UI
- [ ] **Set password form for OAuth-only users** -- alternative to password change form
- [ ] **Error handling** -- clear messages for all failure modes
- [ ] **Redirect after OAuth** -- return to intended page via state parameter

### Future Consideration (v2+)

- [ ] Additional providers (Apple, Microsoft) -- only if users request
- [ ] Provider-sourced avatar fallback in profile display -- nice polish
- [ ] Re-authentication before security actions (require password OR provider re-auth)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DB migration (password_hash nullable) | HIGH (blocker) | LOW | P1 |
| Google OAuth login | HIGH | MEDIUM | P1 |
| GitHub OAuth login | HIGH | MEDIUM | P1 |
| Auto-link by verified email | HIGH | MEDIUM | P1 |
| New user creation via social login | HIGH | MEDIUM | P1 |
| CSRF state parameter | HIGH (security) | LOW | P1 |
| Wire up SocialLogin buttons | HIGH | LOW | P1 |
| Connected accounts UI in settings | MEDIUM | MEDIUM | P1 |
| OAuth accounts list/unlink API | MEDIUM | LOW | P1 |
| Link additional provider (auth'd) | MEDIUM | MEDIUM | P1 |
| Unlink safety check (has-password) | HIGH (safety) | LOW | P1 |
| has_password on /users/me | MEDIUM (enables UI) | LOW | P1 |
| Set password for OAuth-only users | HIGH (safety) | LOW | P1 |
| Error handling (clear messages) | MEDIUM | LOW | P1 |
| Redirect after OAuth | MEDIUM | LOW | P1 |
| Pre-fill name from provider | LOW | LOW | P2 |
| Provider avatar fallback | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch -- all core OAuth flow + account safety features
- P2: Should have, low effort, include if time permits
- P3: Nice to have, defer

---

## Detailed Feature Specifications

### OAuth Flow (Backend)

**Initiation (`GET /auth/{provider}`):**
1. Generate random `state` string (32 bytes, base64url encoded)
2. Store `state` in short-lived httpOnly cookie (5 minute TTL)
3. Optionally accept `redirect_to` query param, encode in state or separate cookie
4. Build provider authorization URL with appropriate scopes:
   - Google: `openid email profile`
   - GitHub: `user:email read:user`
5. Redirect user (HTTP 302) to provider authorization URL

**Callback (`GET /auth/{provider}/callback`):**
1. Validate `state` parameter matches cookie value; reject if mismatch
2. Exchange authorization `code` for access token via provider token endpoint
3. Fetch user profile from provider API:
   - Google: `https://www.googleapis.com/oauth2/v2/userinfo` (returns sub, email, email_verified, name, picture)
   - GitHub: `https://api.github.com/user` (returns id, name, avatar_url) + `https://api.github.com/user/emails` (returns array with email, verified, primary)
4. Extract canonical fields: provider_user_id (sub/id), email, email_verified, name, avatar_url
5. Decision tree:
   - **Lookup `user_oauth_accounts` by (provider, provider_user_id):**
     - **Found:** Existing linked user. Load user, issue JWT + refresh token, create session, redirect
     - **Not found:** Continue to email matching
   - **Lookup `auth.users` by email:**
     - **Found AND email_verified from provider:** Auto-link. Create `user_oauth_accounts` row for existing user, issue JWT, redirect
     - **Found AND NOT email_verified:** Reject. Redirect to login with error "Please verify your email on {provider} first, or sign in with your password"
     - **Not found AND email_verified:** New user. Create `auth.users` (NULL password_hash), create personal workspace, create `user_oauth_accounts`, issue JWT, redirect
     - **Not found AND NOT email_verified:** Reject. Redirect to login with error "Your {provider} account has no verified email"
6. Set auth cookies (access_token + refresh_token), redirect to app or `redirect_to`

**Link flow (`GET /auth/{provider}/link`, authenticated):**
1. Same as initiation but store current user ID in state/cookie
2. On callback, instead of find-or-create, link `user_oauth_accounts` to authenticated user
3. Validate: provider_user_id not already linked to different user (UNIQUE constraint)
4. Redirect back to Security settings with success message

### Connected Accounts UI

**Location:** New section in SecuritySettings component, between "Sessions" and "Danger Zone"

**Layout:**
- Section header with Link icon: "Connected Accounts"
- For each provider (Google, GitHub):
  - Provider icon (existing SVGs from SocialLogin component)
  - Provider name + connected email (if linked)
  - Status: "Connected" badge with connection date, OR "Not connected"
  - Action: "Disconnect" button (if connected) or "Connect" button (if not)
- Safety logic:
  - If user has no password AND only one provider linked: "Disconnect" button disabled
  - Tooltip/message: "Set a password first to keep access to your account"
  - "Set a password" link scrolls to or navigates to password section

### Password Handling for OAuth-Only Users

**Current state:** `PasswordChange` component requires `current_password` field.

**Required changes:**
1. Add `has_password: boolean` to `/users/me` response (check if `password_hash IS NOT NULL`)
2. In SecuritySettings, detect `has_password`:
   - `true`: Show current "Change Password" form (requires current + new password)
   - `false`: Show "Set Password" form (requires only new password + confirm)
3. Backend: new endpoint or modify existing `PATCH /users/me/password`:
   - If user has no password, allow setting without `current_password`
   - If user has password, require `current_password` as before
4. After setting password, update Connected Accounts UI to enable disconnect buttons

---

## Edge Cases to Handle

| Scenario | Expected Behavior |
|----------|-------------------|
| User clicks Google login, denies consent on Google screen | Redirect back to login page with "Authorization was cancelled" message |
| User clicks Google login, has existing email/password account with same email | Auto-link Google provider to existing account, log user in |
| User clicks GitHub login, GitHub email is set to private | Fetch primary verified email from GitHub `/user/emails` API (requires `user:email` scope) |
| User clicks GitHub login, has no verified email on GitHub | Show error: "Your GitHub account has no verified email. Please verify your email on GitHub first." |
| OAuth callback with invalid/expired/missing state | Show "Login session expired, please try again" and redirect to login |
| OAuth callback with already-used authorization code | Provider rejects code exchange. Show "Login failed, please try again" |
| User tries to disconnect last provider with no password | Button disabled with message "Set a password first to keep access to your account" |
| User deletes account that has OAuth links | CASCADE delete on `user_oauth_accounts` handles cleanup (FK ON DELETE CASCADE already defined) |
| Two different users try to link same GitHub account | UNIQUE constraint on (provider, provider_user_id) prevents this. Show "This GitHub account is already linked to another user" |
| User changes email on Google after linking account | No impact -- identification uses `provider_user_id` (Google's `sub` claim), not email |
| PWA offline user clicks social login button | Social login requires network (OAuth redirect). Buttons should show "Requires internet connection" when offline, or simply fail gracefully with error message |
| User registers via Google, later tries to register via email with same address | Registration should detect existing account and return "email already taken" (existing behavior). Login page should show "Try signing in with Google" hint |
| OAuth provider is temporarily down | Token exchange fails. Show "Could not connect to {provider}. Please try again later." |
| Race condition: two tabs completing OAuth callback simultaneously | Session creation is idempotent via refresh token. Second callback creates second session, which is fine (user can manage via sessions list) |

---

## Sources

- [Auth0 - Social Login Best Practices](https://auth0.com/learn/social-login)
- [Curity - How to Integrate Social Logins the Right Way](https://curity.medium.com/how-to-integrate-social-logins-the-right-way-7e8c075b484a)
- [Ory - Secure Account Linking](https://www.ory.com/blog/secure-account-linking-iam-sso-oidc-saml)
- [Clerk - Account Linking for OAuth](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/account-linking)
- [Harsh Bothra - Pre-Authentication Account Takeover via Social Login](https://hbothra22.medium.com/attacking-social-logins-pre-authentication-account-takeover-790248cfdc3)
- [Supabase - Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Undercode - OAuth Account Squatting](https://undercodetesting.com/the-oauth-account-squatting-nightmare-how-a-single-misconfiguration-can-lead-to-full-account-takeover/)
- [Google OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Google OAuth Consent Screen Configuration](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Google Brand Verification Requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
- [GitHub - Authorizing OAuth Apps](https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/authorizing-oauth-apps)
- [NextAuth.js - OAuthAccountNotLinked Error Discussion](https://github.com/nextauthjs/next-auth/issues/9992)
- [Stytch - OAuth 2.1 vs 2.0](https://stytch.com/blog/oauth-2-1-vs-2-0/)

---
*Feature research for: Social Login (Google + GitHub OAuth) for Home Warehouse System v1.8*
*Researched: 2026-02-22*
