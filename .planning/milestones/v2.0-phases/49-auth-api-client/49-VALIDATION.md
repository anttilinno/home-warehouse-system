---
phase: 49
slug: auth-api-client
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
signed_off: 2026-04-14
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.3 |
| **Config file** | frontend2/vite.config.ts (vitest uses vite config) |
| **Quick run command** | `cd frontend2 && bun run test` |
| **Full suite command** | `cd frontend2 && bun run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && bun run test`
- **After every plan wave:** Run `cd frontend2 && bun run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 49-01-01 | 01 | 1 | AUTH-03 | T-49-01 | API client uses credentials: "include" for HttpOnly cookies | unit | `cd frontend2 && bunx vitest run src/lib/__tests__/api.test.ts` | ✅ | ✅ green |
| 49-01-02 | 01 | 1 | AUTH-03 | T-49-02 | 401 retry sends refresh via cookie, not body | unit | `cd frontend2 && bunx vitest run src/lib/__tests__/api.test.ts` | ✅ | ✅ green |
| 49-02-01 | 02 | 1 | AUTH-01 | — | Login calls POST /auth/login and updates auth state | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/AuthContext.test.tsx` | ✅ | ✅ green |
| 49-02-02 | 02 | 1 | AUTH-04 | — | Register calls POST /auth/register and auto-logs in | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/AuthContext.test.tsx` | ✅ | ✅ green |
| 49-02-03 | 02 | 1 | AUTH-05 | — | Logout calls POST /auth/logout and clears state | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/AuthContext.test.tsx` | ✅ | ✅ green |
| 49-03-01 | 03 | 1 | AUTH-02 | T-49-03 | RequireAuth redirects unauthenticated to /login | unit | `cd frontend2 && bunx vitest run src/features/auth/__tests__/RequireAuth.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `frontend2/src/lib/__tests__/api.test.ts` — stubs for AUTH-03 (API client refresh)
- [x] `frontend2/src/features/auth/__tests__/AuthContext.test.tsx` — stubs for AUTH-01, AUTH-04, AUTH-05
- [x] `frontend2/src/features/auth/__tests__/RequireAuth.test.tsx` — stubs for AUTH-02
- [x] Test setup: jsdom environment config in vitest
- [x] Mock fetch utility for API client tests
- [x] React Router test wrapper (MemoryRouter) for route guard tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth redirect to Google/GitHub | AUTH-01 | Requires real OAuth provider | Click Google/GitHub button, verify redirect URL contains correct client_id and redirect_uri |
| OAuth callback page | AUTH-01 | Requires real auth code from provider | Navigate to /auth/callback?code=test&state=test, verify error handling for invalid codes |
| Visual BAM styling match | D-01, D-02 | Visual comparison | Compare auth form to .planning/references/retro-ui/5.png |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Signed off 2026-04-14 — all 5 AUTH requirements satisfied per 49-VERIFICATION.md (5/5 truths verified, 92 tests pass, human visual verification complete per 49-02-SUMMARY.md)
