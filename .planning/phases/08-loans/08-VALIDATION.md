---
phase: 8
slug: loans
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 8 — Validation Strategy

> Pure frontend integration. Three verified backend facts override earlier
> assumptions: loans key on inventory_id (NOT item_id); overdue is a server
> is_overdue flag (NOT client-computed); NO backend loan CSV (client-generate).
> loansApi extends the existing module; LoanPanels stub made real.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + RTL + MSW; Playwright vs live stack (batch — 20/min auth limiter) |
| **Quick run command** | `cd frontend2 && bun run test src/features/loans/` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build && bun run lint:imports && bun run lint:tsc` |
| **Estimated runtime** | ~60s full |

---

## Sampling Rate

- After every task commit: affected specs
- After every plan wave: full suite + build + lint
- Before phase verification: full suite + live E2E (loan create→active→return→history) — run isolated to dodge the auth limiter
- Max feedback latency: 60s

---

## Per-Requirement Verification Map

| Requirement | Behavior to prove | Test Type |
|-------------|-------------------|-----------|
| LOAN-01 | Tabbed Active/Overdue/History (RetroTabs, ?tab= URL); Active=/loans/active, Overdue=/loans/overdue, History=GET /loans client-filtered !is_active (bare {items}, no pagination meta); status pill from returned_at/is_overdue/is_active server flags; overdue row highlight (bg-danger-bg + pill word + ⚠ chip, not color-only) | unit |
| LOAN-02 | /loans/new: **inventory_id** picker (NOT item — create body keys inventory_id) + borrower picker; ?itemId= PRE-FILTERS the inventory picker (locked FROM ITEM badge); due-date + notes | unit |
| LOAN-03 | Return via blue ConfirmDialog → POST return → moves to History tab; optimistic + toast | unit |
| LOAN-04 | Edit due-date + notes (blue dialog); extend via PATCH /loans/{id}/extend (blue dialog, body shape per research) | unit |
| LOAN-05 | Item-detail LoanPanels made REAL (Phase 7 stub): Active Loan + History panels with live RETURN + EXTEND + ⊕ LOAN THIS ITEM | unit |
| LOAN-06 | BorrowerLoanPanels component (borrowerId-driven, Active + History) — component-only, unit-tested; Phase 9 mounts (no borrower route yet) | unit |
| CSV | per-tab export CLIENT-GENERATED from fetched rows (NO downloadBlob — backend returns 400 for loan export) | unit |
| E2E | live: create loan (inventory+borrower pickers) → Active tab → return → History | e2e (phase gate, isolated run) |

---

## Wave 0 Requirements

- [ ] loansApi extension (list/active/overdue/create/return/extend/edit) + MSW fixtures with is_active/is_overdue flags + bare {items} shape FIRST
- [ ] Picker limit clamp ≤100 (Phase 7/7b 422 lesson)

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Overdue row highlight + tab counts | visual | seed an overdue loan, view tabs |
| Return/extend dialog feel | interaction | exercise on live data |
| ?itemId= locked picker | visual | open /loans/new?itemId=… |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
