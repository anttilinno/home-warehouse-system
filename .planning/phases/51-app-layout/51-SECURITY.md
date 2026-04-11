---
phase: 51
slug: app-layout
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-11
---

# Phase 51 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser / AuthContext | `useAuth()` provides `user.full_name`, `user.avatar_url` from authenticated session | Personal user data (name, avatar URL) — rendered in TopBar |
| React Router / AppShell | `RequireAuth` wraps the layout route; unauthenticated requests redirect to `/login` | Route access control |
| AppShell / ErrorBoundaryPage | `errorElement` catches uncaught errors in authenticated routes | Error messages (not stack traces) displayed to user |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-51-01 | Spoofing / XSS | TopBar | mitigate | React auto-escapes all text content; `avatar_url` used only in `img src` attribute; no `dangerouslySetInnerHTML` anywhere in layout components | closed |
| T-51-02 | Auth (logout) | TopBar | accept | Logout is low-risk (user re-authenticates to regain access); no confirmation dialog needed per UI-SPEC | closed |
| T-51-03 | Information Disclosure | ErrorBoundaryPage | mitigate | Only `error.message` displayed (not full stack trace); production builds strip detailed error information | closed |
| T-51-04 | Auth Bypass | routes/index.tsx + AppShell | mitigate | Single `<RequireAuth>` wraps the parent layout Route — all 12 child authenticated routes inherit protection automatically; no per-route guards needed | closed |
| T-51-05 | Reliability / Error Boundary | routes/index.tsx | mitigate | `errorElement={<ErrorBoundaryPage />}` on layout route confirmed working in React Router v7 declarative mode (verified in RESEARCH.md Assumption A1); fallback: class ErrorBoundary wrapping Outlet | closed |
| T-51-06 | Accessibility / Focus Management | AppShell (mobile drawer) | accept | Escape key, backdrop click, and nav-item click all close drawer; `aria-expanded` on hamburger button; no full focus trap (acceptable for 2-item nav at ASVS L1) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-51-01 | T-51-02 | Logout without re-auth confirmation is low-risk UX choice; standard pattern per UI-SPEC; user can log back in | gsd-security-auditor | 2026-04-11 |
| AR-51-02 | T-51-06 | Full focus trap not implemented for 2-item mobile drawer; basic keyboard/pointer close handlers meet ASVS L1; screen readers have `aria-expanded` signal | gsd-security-auditor | 2026-04-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-11 | 6 | 6 | 0 | gsd-security-auditor (State B — from PLAN.md artifacts) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-11
