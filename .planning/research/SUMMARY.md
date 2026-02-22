# Project Research Summary

**Project:** Home Warehouse System v1.8 — Social Login (Google OAuth + GitHub OAuth)
**Domain:** OAuth2 social login integration into existing Go + Next.js auth system
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

Adding Google and GitHub OAuth to the Home Warehouse System is a well-scoped, lower-risk feature addition because the codebase already anticipates it. The `auth.user_oauth_accounts` table exists in the initial migration, all four OAuth environment variables are already read in `config.go`, and a non-functional `SocialLogin` component with Google and GitHub buttons is already rendered on the login page. The only new dependency is `golang.org/x/oauth2` (1 Go package, 0 npm packages). The implementation follows a standard backend-driven Authorization Code flow where the Go backend handles all token exchange and account logic — the frontend never touches client secrets.

The recommended approach is a three-phase build: first, the database migration and all backend OAuth logic (handlers, service, repository, user entity changes); second, the frontend wiring (callback page, social login buttons, connected accounts settings UI); third, polish (error handling, password UX for OAuth-only users, i18n, tests). The backend-driven redirect pattern keeps client secrets server-side and is the correct choice for this architecture, which already has custom JWT issuance and session tracking in Go. Adding NextAuth.js or any frontend OAuth library would create a parallel auth system and must be avoided.

The critical risks fall into two categories: security (account takeover via unverified email linking, CSRF via weak state parameter, cross-origin cookie loss in production) and account lockout (user deletes last OAuth provider with no password set, new OAuth user gets no workspace). All six critical pitfalls have clear, concrete preventions and should be built in from day one, not retrofitted. The highest-impact risk is the cross-origin cookie issue (Pitfall 8-D) which only manifests in production and is easily missed in development — the recommended mitigation is a one-time authorization code exchange on the frontend callback page rather than passing the JWT directly in the redirect URL.

---

## Key Findings

### Recommended Stack

The codebase is already 90% ready. The single new backend dependency is `golang.org/x/oauth2 v0.35.0`, the official Go team library with built-in PKCE support (`oauth2.GenerateVerifier()`, `oauth2.S256ChallengeOption()`, `oauth2.VerifierOption()`). It provides pre-configured endpoints for Google and GitHub via the `golang.org/x/oauth2/endpoints` sub-package. No frontend packages are needed because the flow is entirely backend-driven via browser redirects.

See `.planning/research/STACK.md` for full dependency analysis, version compatibility, and alternatives considered.

**Core technologies:**
- `golang.org/x/oauth2 v0.35.0`: OAuth2 client with PKCE — official Go library, battle-tested, native PKCE, pre-configured Google/GitHub endpoints
- `golang-jwt/jwt v5` (existing): JWT issuance after OAuth — already used for email/password login, reused identically for OAuth login
- `auth.user_oauth_accounts` (existing table): OAuth account storage — table already created in migration 001 with correct schema; no new table needed
- `SocialLogin` component (existing): UI buttons — already rendered on login page with Google/GitHub SVGs; just needs `onClick` handlers

**What NOT to add:**
- `markbates/goth`: Over-abstraction for 2 providers, wraps golang.org/x/oauth2, obscures PKCE
- `NextAuth.js / Auth.js`: Creates parallel auth system in Node.js alongside existing Go auth
- Google Identity Services JS SDK: Uses deprecated implicit grant, not available for GitHub

### Expected Features

The full v1.8 feature set forms a single cohesive release. All core OAuth features are P1 (must-have) because partial OAuth is worse than no OAuth from a security standpoint — incomplete implementations leave attack vectors open.

See `.planning/research/FEATURES.md` for full feature landscape with complexity ratings, dependency graph, and edge case specifications.

**Must have (table stakes):**
- Google OAuth login via Authorization Code flow — standard provider, users expect one-click sign-in
- GitHub OAuth login — developer-oriented app, natural second provider for the target audience
- Auto-link by verified email — user with existing email/password account expects Google login with same email to "just work"
- New user creation via social login — social signup creates user (NULL password), personal workspace, OAuth link
- CSRF state parameter — random 32-byte state in HttpOnly cookie, validated on callback, deleted after use
- Session creation on OAuth login — OAuth logins must appear in active sessions list and be revocable
- Clear error messages — specific messages for cancel, unverified email, expired state, provider unavailable

**Should have (differentiators within v1.8):**
- Connected accounts management in Security settings — view linked providers, disconnect with safety check
- Link additional provider from settings — authenticated user adds Google/GitHub to existing account
- Set password for OAuth-only users — "Set Password" form variant (no current password required) prevents lockout
- `has_password` field on `/users/me` — enables frontend to show correct UI for OAuth-only vs. password users
- Pre-fill name from provider profile on first OAuth signup — low effort, good UX

**Defer to v2+:**
- Additional providers (Apple, Microsoft, Facebook) — only if users request; each adds maintenance burden
- Provider-sourced avatar fallback in profile display — nice polish, not required for launch
- Re-authentication before security actions — beyond current security requirements

### Architecture Approach

The architecture follows a backend-driven Authorization Code pattern. The frontend initiates OAuth by redirecting the browser to the Go backend, which generates the authorization URL with a CSRF state parameter, handles the provider callback, performs all token exchange and user resolution server-side, then redirects to a frontend callback page with a short-lived one-time code. The frontend callback page exchanges the code for JWT tokens via a same-origin API call, avoiding all cross-origin cookie issues.

See `.planning/research/ARCHITECTURE.md` for full component inventory, data flow diagrams, code examples, and the detailed build order.

**Major components:**
1. `backend/internal/domain/auth/oauth/` (NEW domain package) — OAuth entity, handler (initiate + callback), service (find-or-create, link/unlink), repository interface, provider configs (Google/GitHub), domain errors
2. `backend/internal/infra/postgres/oauth_repository.go` (NEW) — PostgreSQL implementation of OAuth repository using sqlc queries against existing `auth.user_oauth_accounts` table
3. `backend/db/migrations/012_oauth_nullable_password.sql` (NEW) — single migration: `ALTER TABLE auth.users ALTER COLUMN password_hash DROP NOT NULL; ALTER TABLE auth.users ADD COLUMN has_password BOOLEAN NOT NULL DEFAULT true;`
4. `frontend/app/[locale]/(auth)/callback/page.tsx` (NEW) — OAuth callback landing page: reads one-time code from URL, calls backend exchange endpoint, stores tokens, redirects to dashboard
5. `frontend/components/settings/connected-accounts.tsx` (NEW) — Link/unlink Google and GitHub accounts with safety checks and "set a password first" messaging
6. Modified existing: `user/entity.go` (nullable password_hash, `NewOAuthUser`, `HasPassword()`), `user/service.go` (add `CreateOAuthUser`), `user/handler.go` (`has_password` on `/users/me`, password change for OAuth-only users), `router.go` (register OAuth routes), `social-login.tsx` (add onClick handlers), `security-settings.tsx` (add Connected Accounts section)

**Key patterns to follow:**
- Backend-driven redirect flow — frontend never handles client secrets or authorization codes
- State parameter serves dual purpose: CSRF protection + encoding flow type (login vs. link)
- Email-based auto-linking only when provider confirms `email_verified: true`
- Personal workspace creation for new OAuth signups must use shared service (not copy-paste from register handler)
- One-time code pattern for token handoff (not direct JWT in redirect URL) to survive cross-origin redirects

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full analysis with recovery strategies and a "looks done but isn't" verification checklist.

1. **`password_hash NOT NULL` blocks OAuth-only user creation (8-A, CRITICAL)** — First change must be migration to drop NOT NULL constraint; add `NewOAuthUser()` constructor; update `CheckPassword()` to return false for empty hash immediately; update scanner for nullable column
2. **Account takeover via unverified email (8-B, CRITICAL)** — For Google: trust `email_verified` claim in OIDC token; for GitHub: call `/user/emails` and filter `verified: true AND primary: true`; never auto-link unverified emails under any circumstances
3. **CSRF via missing state parameter (8-C, CRITICAL)** — Generate 32-byte random state per flow, store in HttpOnly SameSite=Lax cookie (10-minute TTL), validate on callback and reject with 403 on mismatch, delete cookie after use; additionally implement PKCE with `oauth2.S256ChallengeOption()`
4. **Cross-origin cookie loss in production (8-D, CRITICAL)** — Do not rely on cookies surviving the cross-origin redirect chain; instead redirect to `{APP_URL}/auth/callback?code=ONETIME_CODE`, frontend exchanges one-time code for tokens via same-origin POST
5. **No workspace created for new OAuth signups (8-E, CRITICAL)** — Extract workspace creation from register handler into shared service method; OAuth callback must call the same method for new users; add integration test to verify
6. **Unlinking last auth method locks user out (8-F, CRITICAL)** — Before allowing unlink, verify user has at least one remaining auth method (password OR another provider); return 409 with clear "Set a password first" message if check fails

---

## Implications for Roadmap

Based on research, the feature maps to three implementation phases with a clear dependency chain.

### Phase 1: Database Migration and Backend OAuth Core

**Rationale:** Everything else depends on the database migration and backend OAuth logic. The migration must be absolutely first because all OAuth code requires nullable `password_hash`. The backend can be built and tested independently of any frontend changes. All six critical pitfalls must be addressed here — they cannot be deferred to later phases.
**Delivers:** Fully functional OAuth login and signup via Google and GitHub, accessible via API redirect URLs, with CSRF protection, PKCE, verified email linking, session tracking, workspace creation, connected accounts API, and account lockout prevention.
**Addresses features from FEATURES.md:** Google OAuth login, GitHub OAuth login, auto-link by verified email, new user creation via social login, CSRF state parameter, session creation, `has_password` field on `/users/me`, connected accounts list/unlink API
**Avoids pitfalls:** 8-A (nullable migration), 8-B (email verification check), 8-C (state parameter + PKCE), 8-D (one-time code strategy defined), 8-E (workspace creation), 8-F (unlink guard), 8-G (GitHub private email via `/user/emails`), 8-H (no plaintext token storage), 8-I (session tracking)
**Key tasks:**
- Migration 012: `password_hash` nullable, `has_password` column
- `sqlc` queries for `user_oauth_accounts` (get by provider+id, list by user, create, delete)
- `auth/oauth/` domain package: `OAuthAccount` entity, repository interface, `FindOrCreateUser` service, `LinkAccount`, `UnlinkAccount`, `initiateOAuth` handler, `handleCallback` handler, provider configs (Google + GitHub)
- `infra/postgres/oauth_repository.go` implementation
- User entity: `NewOAuthUser()`, `HasPassword()`, nullable-safe `CheckPassword()`
- User service: `CreateOAuthUser()`, extract workspace creation into shared method
- Add `has_password` to `/users/me` response
- Router: register public OAuth routes + rate-limited callback + protected accounts routes
- PKCE via `oauth2.GenerateVerifier()` + `oauth2.S256ChallengeOption()`
- One-time code store (Redis with 60s TTL) for token handoff to frontend

### Phase 2: Frontend Wiring and Settings UI

**Rationale:** Frontend work is unblocked after the backend API exists. The callback page design must implement the one-time code exchange pattern decided in Phase 1. Connected Accounts UI requires both the API and frontend component work. The `has_password` field from Phase 1 is a prerequisite for the password form variant and the unlink safety messaging.
**Delivers:** Social login buttons functional on login/register pages, complete OAuth redirect/callback flow, Connected Accounts section in Security settings (list providers, link/unlink with safety check), and "Set Password" form variant for OAuth-only users.
**Addresses features from FEATURES.md:** Wire up SocialLogin component, OAuth callback page, connected accounts UI, link additional provider from settings, unlink safety check, set password form for OAuth-only users, error handling, redirect after OAuth
**Avoids pitfalls:** 8-D (frontend callback page implements code exchange, not direct JWT), 8-F (UI enforces "set a password first" messaging), 8-J (PWA standalone mode must be tested)
**Uses stack elements from STACK.md:** No new packages; existing SocialLogin component, existing Security settings page structure
**Implements architecture components:** Frontend callback page, ConnectedAccounts component, SocialLogin onClick handlers
**Key tasks:**
- `app/[locale]/(auth)/callback/page.tsx`: reads one-time code from URL, POSTs to backend exchange endpoint, stores token pair, redirects to dashboard (or `redirect_to`)
- `SocialLogin` component: add `onClick` handlers (`window.location.href = BACKEND_URL + /auth/oauth/{provider}`), add "Redirecting..." loading state
- `auth.ts` API client: add `OAuthAccount` type, `getConnectedAccounts()`, `unlinkAccount()`, `exchangeOAuthCode()`, add `has_password` to `User` type
- `connected-accounts.tsx`: new component with provider list, connect/disconnect buttons, disabled state with "Set a password first" message
- `security-settings.tsx`: add Connected Accounts section between Sessions and Danger Zone
- Password UX: detect `has_password: false` from user data, show "Set Password" form (no current password field) vs. "Change Password" form
- Error handling: map OAuth error codes to user-friendly messages on login page (cancelled, unverified email, expired state, duplicate provider link)

### Phase 3: Tests, i18n, and Production Polish

**Rationale:** Integration tests verify all the edge cases that pitfall research identified. The "looks done but isn't" checklist from PITFALLS.md covers exactly the cases that are easy to miss. i18n strings are required for all new UI text. PWA standalone mode on iOS requires deliberate testing.
**Delivers:** Verified correctness via integration tests covering all critical pitfall scenarios, i18n support for all OAuth strings, rate limiting on OAuth endpoints, and production-readiness verification.
**Addresses:** All 12 items on the "Looks Done But Isn't" checklist in PITFALLS.md
**Key tasks:**
- Backend integration tests: new OAuth user has workspace, OAuth sessions visible, GitHub private email handled, wrong state returns 403, unlink-sole-provider-no-password returns 409, callback handles `?error=access_denied`
- Frontend tests: ConnectedAccounts component renders correctly, password form variant detection
- i18n translation keys for all new OAuth strings (error messages, connected accounts UI, set-password form)
- Rate limiting on `/auth/oauth/{provider}/callback` (10 req/min per IP)
- PWA standalone mode test on iOS home screen (Pitfall 8-J)
- Confirm `provider_user_id` stores Google `sub` / GitHub numeric `id` (not email, not username)

### Phase Ordering Rationale

- Phase 1 must precede Phase 2: the database migration and backend API are hard prerequisites for any frontend work. The one-time code pattern for token handoff (Pitfall 8-D mitigation) must be decided and implemented in Phase 1 before the frontend callback page can be built.
- Phase 2 can begin immediately after Phase 1 backend API is available. Within Phase 2, most frontend tasks are independent of each other and can be developed in parallel.
- Phase 3 is last so integration tests validate the complete system end-to-end. Individual unit tests belong in Phases 1 and 2 alongside the code they test.
- The `has_password` field (added in Phase 1) is a dependency for both the Connected Accounts UI (Phase 2) and the set-password form variant (Phase 2).
- Do not ship the social login buttons as UI-only (clicking and doing nothing) between phases — the current state of non-functional buttons is already a UX problem noted in PITFALLS.md. Phase 1 and Phase 2 should be completed before enabling the feature for any users.

### Research Flags

Phases with well-documented patterns (skip additional research-phase):
- **Phase 1 (Database + Backend Core):** The `golang.org/x/oauth2` API is fully documented and verified. Google and GitHub endpoint URLs, scopes, and user profile fields are confirmed in official docs. The existing codebase patterns for JWT issuance, session creation, and cookie management are established and OAuth reuses them directly.
- **Phase 2 (Frontend):** The OAuth callback page and connected accounts UI follow standard patterns with existing UI components. The frontend architecture is well-established in this codebase.

Phases likely needing deeper research during planning:
- **Phase 3 (Testing):** The existing integration test setup in `backend/tests/` may need extension to support OAuth callback testing with mocked provider redirects. Review the test infrastructure before writing Phase 3 tasks to understand what mocking patterns are available.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Single new dependency verified on pkg.go.dev. Existing infrastructure confirmed via direct codebase analysis. No version conflicts. All 4 OAuth env vars already in config.go. |
| Features | HIGH | Feature set derived from existing infrastructure constraints plus standard OAuth UX patterns. All features validated against codebase (e.g., `SocialLogin` component exists, `user_oauth_accounts` table exists). |
| Architecture | HIGH | Backend-driven Authorization Code flow is the established pattern for Go + Next.js. All integration boundaries verified against existing code. Cross-origin cookie issue is a known pitfall with a well-understood solution. |
| Pitfalls | HIGH | Critical pitfalls sourced from PortSwigger, RFC 9700, and recent vulnerability reports (Doyensec 2025). Each pitfall was validated specifically against this codebase (e.g., `password_hash NOT NULL` confirmed in migration 001 line 113). |

**Overall confidence:** HIGH

### Gaps to Address

- **One-time code exchange implementation details:** The recommended approach for Pitfall 8-D requires the backend to store a short-lived one-time authorization code (Redis with 60s TTL) that the frontend exchanges for the JWT pair. The exact API contract (endpoint path, request/response shape) needs to be defined during Phase 1 planning. Redis is already available in this project.
- **Token storage decision:** The `auth.user_oauth_accounts` table has columns for `access_token`, `refresh_token`, `token_expires_at` with a schema comment requiring encryption. Since the app has no need to call provider APIs after initial login, the recommended approach is not to store tokens at all (leave columns NULL). This must be confirmed as the implementation decision during Phase 1 to avoid the encryption complexity of Pitfall 8-H.
- **Google OAuth Consent Screen verification:** For production use of Google OAuth, the app needs to pass Google's brand verification review. This is an external process (not a code task) that should be started early — it can take days to weeks. During development and testing, the app can use "Testing" mode with up to 100 test users.
- **PWA standalone mode on iOS (Pitfall 8-J):** This requires testing on an actual iOS device. The recommended mitigation (`window.location.href` redirect with correct callback URL scope) is standard, but iOS PWA behavior varies. Cannot be fully verified without a physical test.

---

## Sources

### Primary (HIGH confidence — official documentation + codebase verification)

- [golang.org/x/oauth2 package docs](https://pkg.go.dev/golang.org/x/oauth2) — PKCE functions verified (GenerateVerifier, S256ChallengeOption, VerifierOption), version v0.35.0 confirmed
- [golang.org/x/oauth2/endpoints](https://pkg.go.dev/golang.org/x/oauth2/endpoints) — Google and GitHub endpoint constants verified
- [Google OAuth Web Server guide](https://developers.google.com/identity/protocols/oauth2/web-server) — Authorization code flow with PKCE
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) — openid+email+profile scopes, userinfo endpoint, `email_verified` claim
- [GitHub OAuth PKCE support](https://github.com/orgs/community/discussions/15752) — PKCE support confirmed July 2025, client_secret still required
- [GitHub REST API for emails](https://docs.github.com/en/rest/users/emails) — `user:email` scope, primary+verified email filtering
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/rfc9700/) — authoritative security guidance
- [PortSwigger: OAuth 2.0 authentication vulnerabilities](https://portswigger.net/web-security/oauth) — comprehensive attack taxonomy
- [Doyensec: Common OAuth Vulnerabilities (2025)](https://blog.doyensec.com/2025/01/30/oauth-common-vulnerabilities.html) — recent patterns
- Codebase: `backend/db/migrations/001_initial_schema.sql` (user_oauth_accounts table, lines 154-177)
- Codebase: `backend/internal/config/config.go` (OAuth env vars, lines 36-39, 81-84)
- Codebase: `frontend/features/auth/components/social-login.tsx` (existing buttons)
- Codebase: `frontend/app/[locale]/(auth)/login/page.tsx` (SocialLogin already rendered)
- Codebase: `backend/internal/domain/auth/user/handler.go` (login flow, cookie pattern, session creation)

### Secondary (MEDIUM confidence)

- [Auth0: Social Login Best Practices](https://auth0.com/learn/social-login) — UX patterns and security recommendations
- [Curity: How to Integrate Social Logins the Right Way](https://curity.medium.com/how-to-integrate-social-logins-the-right-way-7e8c075b484a) — integration patterns
- [Ory: Secure Account Linking](https://www.ory.com/blog/secure-account-linking-iam-sso-oidc-saml) — account linking approaches
- [Harsh Bothra: Pre-Authentication Account Takeover via Social Login](https://hbothra22.medium.com/attacking-social-logins-pre-authentication-account-takeover-790248cfdc3) — unverified email attack vector
- [Curity: OAuth and Cookies in Browser Based Apps](https://curity.io/resources/learn/oauth-cookie-best-practices/) — cross-origin cookie handling
- [WorkOS: Defending OAuth - Common Attacks](https://workos.com/blog/oauth-common-attacks-and-how-to-prevent-them) — attack prevention
- [Auth0: Prevent CSRF Attacks in OAuth 2.0](https://auth0.com/blog/prevent-csrf-attacks-in-oauth-2-implementations/) — state parameter best practices
- [better-auth: Can't unlink if only OAuth provider](https://github.com/better-auth/better-auth/issues/4742) — unlink lockout pattern

### Tertiary (needs runtime validation)

- PWA standalone mode OAuth behavior on iOS — documented behavior varies by iOS version; requires device testing
- One-time code Redis TTL choice — 60s is standard but should be validated against observed OAuth flow completion times in production

---

*Research completed: 2026-02-22*
*Ready for roadmap: yes*
