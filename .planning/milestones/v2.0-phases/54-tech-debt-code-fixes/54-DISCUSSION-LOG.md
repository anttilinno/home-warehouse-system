# Phase 54: Tech Debt Code Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 54-tech-debt-code-fixes
**Areas discussed:** Scope (Phase 51 WR items), AuthContext approach, Plan structure

---

## Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fold them in | Phase 51 WR-01 (timeout leak) + WR-02 (SYSTEM ERROR translation) included in Phase 54 | ✓ |
| No, they're already done | Fixes applied but uncommitted | |
| No, defer to Phase 55 | Park in cleanup phase | |

**User's choice:** Yes, fold them in
**Notes:** Both are small fixes that fit naturally — WR-01 is a real state bug, WR-02 is exactly the kind of i18n gap this phase closes. Brings total to 9 fixes.

---

## AuthContext

| Option | Description | Selected |
|--------|-------------|----------|
| Strict — introduce HttpError class | Typed HttpError(status) in api.ts, check instanceof HttpError && [401,403] in AuthContext | ✓ |
| Pragmatic — current approach is fine | Keep instanceof TypeError as-is, document why it's sufficient | |

**User's choice:** Strict — introduce HttpError class
**Notes:** Matches the ROADMAP success criterion exactly. HttpError exported from api.ts, imported in AuthContext.

---

## Plan structure

| Option | Description | Selected |
|--------|-------------|----------|
| Two plans — nav+auth / i18n+types | Plan 1: Sidebar, AuthContext, DataPage. Plan 2: types, i18n, HazardStripe, barrel imports, WR-01/WR-02 | ✓ |
| One plan — all fixes | Single atomic commit | |
| Three plans — one per concern area | Nav/UX, Auth/types, i18n/consistency | |

**User's choice:** Two plans
**Notes:** Logical grouping with reviewable diffs. Plan 1 touches runtime behavior; Plan 2 touches presentation/consistency.

---
