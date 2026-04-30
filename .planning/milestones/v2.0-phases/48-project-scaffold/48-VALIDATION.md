---
phase: 48
slug: project-scaffold
status: complete
nyquist_compliant: true
wave_0_complete: true
signed_off: 2026-04-14
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via vite.config.ts) |
| **Config file** | `frontend2/vite.config.ts` |
| **Quick run command** | `cd frontend2 && bun run test --run` |
| **Full suite command** | `cd frontend2 && bun run build && bun run test --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `cd frontend2 && bun run test --run`
- **After every plan wave:** `cd frontend2 && bun run test --run && bun run build`
- **Before `/gsd-verify-work`:** Full suite must be green + build must exit 0
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 48-01-01 | 01 | 1 | SCAF-01 | build | `cd frontend2 && bun run build` | ✅ green |
| 48-01-02 | 01 | 1 | SCAF-03 | build | `cd frontend2 && bun run build` | ✅ green |
| 48-02-01 | 02 | 2 | SCAF-02 | build | `cd frontend2 && bun run build` | ✅ green |
| 48-02-02 | 02 | 2 | SCAF-04 | build + i18n | `cd frontend2 && bun run i18n:extract && bun run i18n:compile` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 48 establishes the test infrastructure. No Wave 0 test stubs required — the scaffold itself is the deliverable. Build pipeline exit 0 serves as the primary verification gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual retro design renders in browser | SCAF-03 | CSS token rendering cannot be verified without a browser rendering engine | Run `cd frontend2 && bun run dev`, open http://localhost:5173. Verify: charcoal background (#2A2A2A), cream panel (#F5F0E1) with 3px border, hazard stripe bar, IBM Plex Mono font loaded. |
| Locale switching works at runtime | SCAF-04 | React re-render with i18n catalog requires live browser execution | On Dashboard page, change LANGUAGE dropdown to 'Eesti'. Verify 'Welcome to Home Warehouse' changes to 'Tere tulemast Home Warehouse'i' without page reload. |
| Client-side navigation (no page reload) | SCAF-02 | SPA history push vs full reload requires browser DevTools observation | From http://localhost:5173, click 'Settings' link. Verify URL changes to /settings with no full page reload (no network waterfall restart in DevTools). |
| 404 route fallback renders | SCAF-02 | Browser navigation to unknown route with client-side fallback requires browser | Navigate to http://localhost:5173/nonexistent. Verify 'SECTOR NOT FOUND' heading and 'RETURN TO BASE' link. |

---

## Validation Sign-Off

- [x] All tasks have automated verify (build pipeline + i18n pipeline)
- [x] Sampling continuity: build pipeline covers all tasks
- [x] No Wave 0 stubs required (scaffold is the deliverable)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Signed off 2026-04-14 — all 4 SCAF requirements satisfied per 48-VERIFICATION.md (6/8 automated checks passed; remaining 2 are inherent browser-only visual checks, not missing implementation)
