# Phase 1: Foundation + Conflict Spikes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 01-foundation-conflict-spikes
**Areas discussed:** i18n spike methodology, Mobile FAB fate, Dashboard backend rollups

---

## i18n Spike Methodology

### Q1: What should the i18n spike test?

| Option | Description | Selected |
|--------|-------------|----------|
| Test both: compile + extract + runtime | Full three-part test for both candidates | ✓ |
| Compile only | Just verify both libraries build without error | |
| Skip the spike, pick Lingui v6 | Declare Lingui winner without formal test | |

**User's choice:** Test both: compile + extract + runtime
**Notes:** Full empirical test required — build, message extraction CLI, and runtime rendering of translated strings.

---

### Q2: Include native Intl as option C?

| Option | Description | Selected |
|--------|-------------|----------|
| No, keep it two-way | Lingui v6 vs react-intl only | ✓ |
| Yes, add native Intl as option C | Three-way test | |

**User's choice:** No — two-way test only (Lingui v6 vs react-intl)
**Notes:** Project has existing et/ru catalog; extraction tooling is non-negotiable. Native Intl lacks this.

---

### Q3: Tiebreaker if both pass?

| Option | Description | Selected |
|--------|-------------|----------|
| Prefer Lingui v6 | v2.0 precedent + existing catalog files | ✓ |
| Prefer react-intl | Wider ecosystem | |
| Decide at spike time based on DX | Evaluate extraction CLI ergonomics post-spike | |

**User's choice:** Prefer Lingui v6
**Notes:** v2.0 used Lingui; existing catalog files are an asset. Lingui wins on tie.

---

## Mobile FAB Fate

### Q1: FAB vs Bottombar?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop FAB — Bottombar replaces it | Bottombar covers all actions | |
| Keep FAB alongside Bottombar | FAB for one-thumb reach on mobile + safe-area math | |
| Keep FAB only on scan-heavy routes | Compromise per-route | |

**User's choice:** Free text — "drop bottombar in mobile view, use only fab. And web view, use bottombar."
**Notes:** User proposed a responsive split not in the presented options: FAB-only on mobile (<768px), Bottombar-only on desktop (≥768px). Clean separation.

---

### Q2: What does the mobile FAB expose?

| Option | Description | Selected |
|--------|-------------|----------|
| Radial menu with context-aware actions | Same as v2.1 — scan, add item, log loan — adapts per route | ✓ |
| Single-action Scan button | FAB always opens /scan | |
| Same shortcuts as Bottombar, as FAB menu | Perfect parity between mobile and desktop | |

**User's choice:** Radial menu with context-aware actions
**Notes:** Preserves the full quick-access UX from v2.1. Context-awareness (different actions per route) is retained.

---

## Dashboard Backend Rollups

### Q1: Ship feature-flagged or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship feature-flagged (VITE_FEATURE_HUD_ROLLUPS=false) | DASH-04 in scope, flag defaults off | |
| Defer HUD row to v3.1 | Remove DASH-04 from Phase 13 | |

**User's choice:** Free text — "Don't need feature flags, there is no production"
**Notes:** No production environment = feature flags are unnecessary overhead. User implicitly chose to ship without a flag.

---

### Q2: Kick off backend coordination in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — spec the backend endpoints in Phase 1 docs | CARRY-FORWARD or companion doc specifies endpoint contracts | ✓ |
| No — figure it out in Phase 13 | Defer endpoint design to Phase 13 planning | |

**User's choice:** Yes — spec the backend endpoints in Phase 1 docs
**Notes:** Phase 1 documents the required endpoint shapes so Phase 13 planning can scope backend work precisely.

---

## Claude's Discretion

- Scaffold file structure within `frontend2/` — standard Vite + RR7 library-mode conventions
- CARRY-FORWARD.md format and organization
- CI script implementation details for `check-forbidden-imports.mjs`

## Deferred Ideas

None — discussion stayed within phase scope.
