---
phase: 7b
slug: inventory
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 7b — Validation Strategy

> Pure frontend integration (backend fully built + live-verified). No new deps
> (@tanstack/react-virtual DEFERRED — 45 entries fit one page). Mirrors Phase 7
> patterns. Key pitfall: scoped endpoints (by-item/location/container/movements)
> return bare {items}, no pagination envelope — different from GET /inventory.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + RTL + MSW; Playwright vs live stack (UP) |
| **Quick run command** | `cd frontend2 && bun run test src/features/inventory/` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build && bun run lint:imports && bun run lint:tsc` |
| **Estimated runtime** | ~55s full |

---

## Sampling Rate

- After every task commit: affected specs
- After every plan wave: full suite + build + lint
- Before phase verification: full suite + live E2E (entry create → list → move → movements)
- Max feedback latency: 55s

---

## Per-Requirement Verification Map

| Requirement | Behavior to prove | Test Type |
|-------------|-------------------|-----------|
| INV-01 | Inventory list (item/location/container/qty/status/condition), CLIENT-side filters (no server param), pagination 25/page, status+condition StatusPills | unit |
| INV-02 | Create entry: item/location/container simple selects (populated from read endpoints), qty/condition/status/expiry/warranty fields | unit |
| INV-03 | Expiry + warranty date fields persist | unit |
| INV-04 | Move dialog: whole-entry relocation (location_id + optional container_id; NO qty split), invalidate ["inventory",wsId] + ["movements",wsId] (manual — no SSE) | unit |
| INV-05 | Inline edit: qty→/quantity (min 0), status→/status, condition→full PATCH; click-to-edit single cell, optimistic + revert-on-error, ESC field-local cancel | unit |
| INV-06 | /inventory/expiring view: near (butter) vs past (danger) client-computed, color not sole signal | unit |
| INV-07 | Movements panel: row drawer on /inventory (per-inventory) + item-detail HISTORY (per-item); bare {items} shape handled | unit |
| INV-08 | Item-detail inventory panel replaces InventoryPanelStub at the 07-06 slot; IN STOCK total, per-entry rows w/ pills + location/container links + MOVE/EDIT | unit |
| Enums | Condition 7 + Status 7 → StatusPill variant maps (from entity.go) | unit |
| E2E | live: create entry → list → move to new location → movements drawer shows the move | e2e (phase gate) |

---

## Wave 0 Requirements

- [ ] inventoryApi + movementsApi (bare-{items} shape handled distinctly from GET /inventory envelope) with MSW fixtures FIRST
- [ ] StatusPill enum maps (condition/status) before list/panel consumers

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Inline-edit feel (click→edit→save/revert) | interaction nuance | edit a qty cell on /inventory, blur + ESC |
| Move flow on live data | visual/file | move an entry, confirm list + drawer update |
| Expiring near/past color distinction | visual | eyeball /inventory/expiring |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 55s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
