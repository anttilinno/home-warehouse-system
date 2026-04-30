---
phase: 56
slug: foundation-api-client-and-react-query
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `frontend2/vite.config.ts` |
| **Quick run command** | `cd frontend2 && npm run test -- --run` |
| **Full suite command** | `cd frontend2 && npm run test -- --run && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && npm run test -- --run`
- **After every plan wave:** Run `cd frontend2 && npm run test -- --run && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-01-01 | 01 | 0 | SC-1 | — | N/A | unit | `cd frontend2 && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 56-01-02 | 01 | 1 | SC-1 | — | N/A | integration | `cd frontend2 && npm run build` | ❌ W0 | ⬜ pending |
| 56-02-01 | 02 | 1 | SC-2 | — | N/A | unit | `cd frontend2 && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 56-02-02 | 02 | 1 | SC-3 | — | N/A | unit | `cd frontend2 && npm run test -- --run` | ❌ W0 | ⬜ pending |
| 56-03-01 | 03 | 2 | SC-4 | — | N/A | integration | `cd frontend2 && npm run build` | ❌ W0 | ⬜ pending |
| 56-04-01 | 04 | 2 | SC-5 | — | N/A | build | `cd frontend2 && node scripts/check-forbidden-imports.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/src/lib/api/` — create directory structure with stub modules for each entity
- [ ] `frontend2/src/lib/api/__tests__/` — test stubs for typed entity modules
- [ ] Install `@tanstack/react-query` and `@tanstack/react-query-devtools` if not present
- [ ] `frontend2/scripts/check-forbidden-imports.mjs` — CI grep guard script stub

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QueryClient Devtools visible in browser dev mode | SC-1 | Requires browser runtime | Start dev server, open browser, verify Devtools panel appears in dev build |
| Smoke route shows loading/success/error states | SC-4 | Requires live backend + browser | Start both servers, navigate to /api-demo, verify all three states render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
