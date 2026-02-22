# Requirements: Home Warehouse System v1.8 — Social Login

**Defined:** 2026-02-22
**Core Value:** Reliable inventory access anywhere — online or offline — with seamless sync

## v1.8 Requirements

Requirements for Social Login milestone. Each maps to roadmap phases.

### OAuth Login

- [x] **OAUTH-01**: User can log in with Google OAuth (Authorization Code flow with PKCE)
- [x] **OAUTH-02**: User can log in with GitHub OAuth (Authorization Code flow with PKCE)
- [x] **OAUTH-03**: User can sign up via Google OAuth (creates account with no password, personal workspace)
- [x] **OAUTH-04**: User can sign up via GitHub OAuth (creates account with no password, personal workspace)
- [x] **OAUTH-05**: Social login auto-links to existing account when provider email matches and is verified
- [x] **OAUTH-06**: Social login rejects auto-link when provider email is not verified
- [ ] **OAUTH-07**: Social login redirects user back to intended page after OAuth flow completes
- [ ] **OAUTH-08**: Social login pre-fills full_name from provider profile on first signup

### Security

- [x] **SEC-01**: OAuth flow uses CSRF state parameter (random 32-byte, HttpOnly cookie, validated on callback)
- [ ] **SEC-02**: OAuth sessions appear in active sessions list and are revocable
- [x] **SEC-03**: OAuth callback endpoints are rate-limited (10 req/min per IP)

### Account Management

- [ ] **ACCT-01**: User can view connected OAuth providers in Security settings
- [ ] **ACCT-02**: User can link additional Google or GitHub account from Security settings
- [ ] **ACCT-03**: User can unlink an OAuth provider from Security settings
- [ ] **ACCT-04**: System prevents unlinking last auth method when user has no password (lockout guard)
- [ ] **ACCT-05**: OAuth-only user can set a password from Security settings (no current password required)
- [ ] **ACCT-06**: User profile includes `has_password` field to enable correct UI for OAuth-only users

### Schema

- [x] **SCHM-01**: Database migration makes password_hash nullable for OAuth-only accounts
- [x] **SCHM-02**: Database migration adds has_password boolean column to auth.users

### Error Handling

- [x] **ERR-01**: User sees specific error message when OAuth authorization is cancelled
- [x] **ERR-02**: User sees specific error message when provider email is not verified
- [x] **ERR-03**: User sees specific error message when OAuth state is expired or invalid
- [x] **ERR-04**: User sees specific error message when provider is temporarily unavailable

### Internationalization

- [x] **I18N-01**: All new OAuth UI strings have translation keys for all 3 supported languages

### Offline Behavior

- [ ] **OFFL-01**: Social login buttons show disabled state or "Requires internet" message when offline

## v2+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Additional Providers

- **PROV-01**: User can log in with Apple OAuth
- **PROV-02**: User can log in with Microsoft OAuth

### Polish

- **PLSH-01**: Provider-sourced avatar used as fallback in profile display
- **PLSH-02**: Re-authentication via provider before security-critical actions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-link by unverified email | Pre-authentication account takeover risk — only verified emails auto-link |
| Storing raw OAuth tokens | App never calls provider APIs after login; token storage adds security surface |
| Many providers (Apple, FB, etc.) | Diminishing returns after 2; add only on user demand |
| Automatic full account merge | Merging separate user records is extremely complex; auto-link is sufficient |
| Popup/window-based OAuth flow | Popup blockers, mobile issues, PWA incompatibility; standard redirect works everywhere |
| Token refresh for providers | No need to call provider APIs after login; app's JWT handles ongoing auth |
| Password prompt during OAuth signup | Adds friction to one-click flow; users can set password later from settings |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| OAUTH-01 | Phase 40 | Complete |
| OAUTH-02 | Phase 40 | Complete |
| OAUTH-03 | Phase 40 | Complete |
| OAUTH-04 | Phase 40 | Complete |
| OAUTH-05 | Phase 40 | Complete |
| OAUTH-06 | Phase 40 | Complete |
| OAUTH-07 | Phase 41 | Pending |
| OAUTH-08 | Phase 41 | Pending |
| SEC-01 | Phase 40 | Complete |
| SEC-02 | Phase 41 | Pending |
| SEC-03 | Phase 40 | Complete |
| ACCT-01 | Phase 41 | Pending |
| ACCT-02 | Phase 41 | Pending |
| ACCT-03 | Phase 41 | Pending |
| ACCT-04 | Phase 41 | Pending |
| ACCT-05 | Phase 41 | Pending |
| ACCT-06 | Phase 41 | Pending |
| SCHM-01 | Phase 40 | Complete |
| SCHM-02 | Phase 40 | Complete |
| ERR-01 | Phase 42 | Complete |
| ERR-02 | Phase 42 | Complete |
| ERR-03 | Phase 42 | Complete |
| ERR-04 | Phase 42 | Complete |
| I18N-01 | Phase 42 | Complete |
| OFFL-01 | Phase 42 | Pending |

**Coverage:**
- v1.8 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation (traceability updated)*
