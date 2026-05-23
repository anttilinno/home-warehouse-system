---
phase: 1
slug: foundation-conflict-spikes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + bun |
| **Config file** | `frontend2/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `cd frontend2 && bun run typecheck && bun run lint:imports` |
| **Full suite command** | `cd frontend2 && bunx vitest run && bun run typecheck && bun run lint:imports && bun run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend2 && bun run typecheck && bun run lint:imports`
- **After every plan wave:** Run `cd frontend2 && bunx vitest run && bun run typecheck && bun run lint:imports && bun run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUND-01 | — | N/A | build | `cd frontend2 && bun run dev --port 5173 & sleep 3 && curl -s http://localhost:5173 | grep -q "<!DOCTYPE"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | FOUND-02 | — | Forbidden imports blocked in CI | lint | `cd frontend2 && bun run lint:imports` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | FOUND-03 | — | N/A | manual | CARRY-FORWARD.md exists with both sections | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | FOUND-04 | — | N/A | manual | I18N-DECISION.md exists with locked decision | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | FOUND-05 | — | N/A | manual | FAB/Bottombar scope decision documented | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | FOUND-06 | — | N/A | manual | HUD endpoint specs documented in CARRY-FORWARD.md | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend2/vitest.config.ts` — vitest config (scaffolded in Wave 0)
- [ ] `frontend2/package.json` `lint:imports` script — forbidden-imports guard wired
- [ ] `scripts/check-forbidden-imports.mjs` — ported from v2.1 predecessor

*If Wave 0 scaffold plan runs first, the test infrastructure exists before other waves.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `bun run dev` serves placeholder shell at localhost:5173 | FOUND-01 | Dev server output requires human visual confirmation | Run `cd frontend2 && bun run dev`, open browser at localhost:5173, confirm shell renders |
| CARRY-FORWARD.md lists port-verbatim vs rebuild items correctly | FOUND-03 | Content correctness requires human review | Read `.planning/research/CARRY-FORWARD.md`, verify auth flow / OAuth callback / format hooks / Playwright helper / grep guard are listed as port-verbatim; chrome / atoms / layout / providers as rebuild |
| I18N-DECISION.md records locked decision with empirical test results | FOUND-04 | Empirical spike outcome requires human interpretation | Read `.planning/research/I18N-DECISION.md`, verify compile / extract / runtime test results for both candidates are present and a winner is declared |
| Lingui v6 (or winning i18n library) compiles + extracts + renders correctly | FOUND-04 | Runtime rendering requires browser | Verify i18n spike: compile check, `bun run i18n:extract` produces messages, translated string renders at runtime |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
