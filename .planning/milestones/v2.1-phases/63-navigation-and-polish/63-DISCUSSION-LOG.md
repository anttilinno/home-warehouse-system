# Phase 63: Navigation & Polish — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 63-navigation-and-polish
**Areas discussed:** Settings separator, i18n sweep scope, Plan count

---

## Settings Separator

| Option | Description | Selected |
|--------|-------------|----------|
| mt-auto push to bottom | Settings floats to the bottom of the sidebar using flex + mt-auto. Clean separation without a visible line — matches iOS Settings pattern. | ✓ |
| Horizontal divider | A 1px or 3px retro-ink line separates the two groups. More explicit, heavier visual weight. | |
| Flat list, no separation | Keep the current pattern — 6 equal-weight links, no special treatment for Settings. | |

**User's choice:** mt-auto push to bottom
**Notes:** Clean separation without adding a visible border element.

---

## i18n Sweep Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full v2.1 audit | Run bun run extract, then check the ET .po file for all untranslated strings across phases 56–62. Fix any gaps (add ET translations inline). | ✓ |
| New labels only | Add only the 2 new ET labels: BORROWERS → LAENAJAD, TAXONOMY → TAKSONOOMIA. | |
| Extract + flag, don't translate | Run bun run extract and commit with gaps marked as fuzzy/empty — leave ET translation for later. | |

**User's choice:** Full v2.1 audit
**Notes:** "Catalogs complete" means all ET strings filled, not just new ones.

---

## Plan Count

| Option | Description | Selected |
|--------|-------------|----------|
| 1 plan | Everything in one plan: sidebar links + mt-auto, verify dashboard cards, audit 6 empty states, run bun run extract + fill ET gaps. | ✓ |
| 2 plans | Plan 1: sidebar + dashboard verification. Plan 2: empty state audit + full i18n sweep. | |

**User's choice:** 1 plan
**Notes:** Phase is small enough for a single atomic plan and commit.

---

## Claude's Discretion

- Exact Tailwind class for the mt-auto spacer
- Whether to split sidebar into two `<div>` groups vs single flex column with spacer
- Task order within the single plan
