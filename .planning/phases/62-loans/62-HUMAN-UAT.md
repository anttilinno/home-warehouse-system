---
status: partial
phase: 62-loans
source: [62-VERIFICATION.md]
started: 2026-04-17T14:10:00Z
updated: 2026-04-17T14:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end loan flow — create, edit, mark returned, tabs, detail pages
expected: All 29 steps in the 62-04-PLAN.md how-to-verify block produce the described UX outcomes with no uncaught console errors
result: [pending]

**Prereqs:**
1. Backend running: `cd backend && mise run dev` (port 8000)
2. Frontend running: `cd frontend2 && bun run dev` (port 5173)
3. Workspace with ≥2 items and ≥2 borrowers

**Steps (from 62-04-PLAN.md how-to-verify):** Follow all 29 steps covering:
- `/loans` tabbed page with Active/Overdue/History counts
- Create loan via RetroCombobox pickers (item + borrower)
- Create failure paths (already on loan, not available)
- Edit loan due date and notes
- Mark returned → moves to HISTORY
- `/items/:id` ACTIVE LOAN + LOAN HISTORY panels
- `/borrowers/:id` ACTIVE LOANS + LOAN HISTORY panels
- Cache invalidation cross-checks
- i18n spot check (ET fallback to EN msgid acceptable)
- Accessibility (focus rings, aria-labels, Esc on dirty panel)
- Console sanity (no uncaught errors)

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
