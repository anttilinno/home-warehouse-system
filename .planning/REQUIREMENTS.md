# Requirements: Home Warehouse System

**Defined:** 2026-02-02
**Core Value:** Reliable inventory access anywhere — online or offline — with seamless sync

## v1.5 Requirements

Requirements for Settings Enhancement milestone. Each maps to roadmap phases.

### Account

- [x] **ACCT-01**: User can update profile (full name, email)
- [x] **ACCT-02**: User can upload/change avatar image
- [x] **ACCT-03**: User can set date format preference (MM/DD/YY, DD/MM/YYYY, YYYY-MM-DD)
- [x] **ACCT-04**: User can delete their account (with confirmation)

### Security

- [x] **SEC-01**: User can change password (requires current password)
- [x] **SEC-02**: User can view list of active sessions (device, location, last active)
- [x] **SEC-03**: User can revoke/logout individual sessions
- [x] **SEC-04**: User can logout all other sessions

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Security (Future)

- **SEC-F01**: User can enable two-factor authentication (2FA)
- **SEC-F02**: User can view login history with locations
- **SEC-F03**: User can set up security keys (WebAuthn)

### Account (Future)

- **ACCT-F01**: User can link social accounts (Google, GitHub)
- **ACCT-F02**: User can export all personal data (GDPR)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| OAuth/social login | Current email/password sufficient, adds complexity |
| 2FA/MFA | Deferred to future milestone, requires additional infrastructure |
| Email change verification | Current scope is simple update, verification adds complexity |
| Account recovery options | Password reset exists, additional recovery methods deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACCT-01 | 27 | Complete |
| ACCT-02 | 27 | Complete |
| ACCT-03 | 27 | Complete |
| ACCT-04 | 29 | Complete |
| SEC-01 | 28 | Complete |
| SEC-02 | 28 | Complete |
| SEC-03 | 28 | Complete |
| SEC-04 | 28 | Complete |

**Coverage:**
- v1.5 requirements: 8 total
- Mapped to phases: 8
- Complete: 8

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-03 after Phase 29 complete*
