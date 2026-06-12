# Phase 4: Retro Atoms - Context

**Gathered:** 2026-06-12 (synthesized by orchestrator — autonomous run, no discuss session)
**Status:** Ready for planning
**Source:** ROADMAP Phase 4 + parity plan §4 + sketches MANIFEST + Phase 1-3 shipped code

<domain>
## Phase Boundary

Phase 4 completes the retro atom library every feature page (Phases 5-16) consumes:

1. **Form family** — RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox, RetroFileInput, RetroFormField (label+error+hint wrapper). RetroInput exists (Phase 1) — keep/extend.
2. **Overlay family** — RetroDialog, RetroConfirmDialog (both consume Phase 3 `useModalStack`), menu/popover primitive. TUI-02 ESC discipline ALREADY IMPLEMENTED in Phase 3 (capture-phase ModalStackContext) — Phase 4 task is wiring every new overlay through it + an integration test across dialog → drawer → menu stack.
3. **Feedback family** — RetroToast (skinned toast system), RetroEmptyState, RetroStatusDot (TUI-03 visual primitive: `sse: ● live` text + step-end blinking dot for panel headers — NO SSE wiring, that's Phase 6), status pills (TUI-04: OK/WARN/INFO/DANGER variants from tokens).
4. **Data family** — RetroTable upgrades: multi-select with Shift+Click range selection (TUI-06) + selection-set context that Bottombar bulk-action chips read; `tabular-nums` numeric columns (TUI-04, pattern exists from Phase 2); RetroPagination; RetroTabs.
5. **Filter atoms (ATOM-FB-01..04, parity additions)** — FilterBar, FilterPopover, BulkActionBar, SavedFilters. Built ONCE here; Phases 7/8/14 consume. SavedFilters = preset save/load UI atom (storage contract minimal: localStorage this phase; server prefs later if a phase needs it).
6. **`/demo` page** — renders every atom (Success Criterion 1); doubles as the visual review surface and the integration playground. Route lives inside AppShell, registered in Sidebar (can be dev-only/unlisted-but-routable).
7. **HUD primitives** — RetroHUD/StatCard family already partially exists (Phase 1 StatCard); ensure variants needed by Phase 13 exist as atoms.

NOT in phase: SSE wiring (6), command palette/cmdk (16), any feature page, icon library (still OPEN).

</domain>

<decisions>
## Implementation Decisions

### Direction re-anchor (same as Phase 3)
- ROADMAP Phase 4 goal cites "sketch 005 chrome" + premium-terminal vocabulary (`// HEADER` slot, hazard-stripe, monospace anchor). STALE. Canonical: retro-os pastel (006-008) per MANIFEST + sketch-findings skill. Observable truths survive (panels have header slots, danger variants exist, numeric columns tabular); exact treatment per UI-SPEC. "Hazard-stripe" → retro-os danger treatment (danger tokens, pink-titlebar semantics) as UI-SPEC decides.
- Existing Phase 1 primitives (Window, BevelButton, RetroInput, RetroTable, StatCard, RetroBadge) are already retro-os — extend, don't fork. Naming: keep the established `Retro*`/component names; do NOT rename shipped components.

### Locked
- All overlays route ESC through Phase 3 `useModalStack` (capture-phase arbiter). No overlay owns its own document-level ESC listener.
- Bulk-action chips surface through the Phase 3 shortcuts SSOT/Bottombar — BulkActionBar atom renders chips inline on mobile contexts but desktop bulk actions integrate with Bottombar per Success Criterion 5 (selection context exposes actions; Bottombar consumes).
- Status pill variants map to existing tokens: OK=mint-deep, WARN=warn-deep/butter, INFO=blue-deep, DANGER=danger (#b73348 family). No new color tokens.
- tabular-nums via the established `font-variant-numeric` pattern (glyph-coverage test guards the font side).
- No new heavyweight dependencies without researcher justification. Toast: prefer skinning `sonner` ONLY if researcher confirms it's viable under the no-motion-lib + bundle constraints; otherwise a small hand-rolled toast (the modal-stack + portal infra makes this cheap). Combobox: hand-rolled on RetroInput + popover primitive (no headless-UI lib) unless researcher finds a hard blocker.

### Claude's Discretion
- Component file organization (components/atoms/ vs flat), barrel strategy, demo page layout/grouping, SavedFilters preset shape, FileInput drag-drop support level.

</decisions>

<canonical_refs>
## Canonical References

### Design (MANDATORY)
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — hard rules
- `.planning/sketches/MANIFEST.md` — locked decisions; 008 (table density) is the data-family reference
- `frontend2/src/styles/tokens.css` — token contract
- `.planning/phases/03-layout-primitives-bottombar/03-UI-SPEC.md` — chrome treatment established in Phase 3 (keycaps, bevels, titlebar semantics) — stay consistent

### Phase scope
- `.planning/ROADMAP.md` Phase 4 + `.planning/REQUIREMENTS.md` TUI-02/03/04/06, ATOM-FB-01..04
- `docs/FRONTEND2_FEATURE_PARITY_PLAN.md` §4 Phase 4

### Existing code (extend, don't fork)
- `frontend2/src/components/` — Window, BevelButton, RetroInput, RetroTable, StatCard, RetroBadge (Phase 1); ShortcutChip, Clock, layout chrome (Phase 3); modal/ + shortcuts/ providers (Phase 3)
- Legacy STRUCTURE references: `frontend/components/ui/filter-bar.tsx`, `filter-popover.tsx`, `bulk-action-bar.tsx`, `saved-filters.tsx`, `infinite-scroll-trigger.tsx`, plus form controls in `frontend/components/ui/`

</canonical_refs>

<specifics>
## Specific Ideas

- Selection context: `useTableSelection(rows)` hook — click selects, Shift+Click range-selects, Ctrl/Cmd+Click toggles; exposes `{selected, actions}`; Bottombar reads a registered bulk-action set when selection non-empty.
- RetroConfirmDialog = RetroDialog preset: danger semantics (pink titlebar per MANIFEST), confirm/cancel BevelButtons, focus on cancel by default.
- Toast region: bottom-right above Bottombar (desktop), above FAB (mobile); retro-os window-chrome mini-panels; auto-dismiss + manual close.
- Demo page sections mirror the atom families; each section header uses the panel header-slot treatment.

</specifics>

<deferred>
## Deferred Ideas

- Icon library (OPEN since Phase 2) — placeholders still.
- Virtualized table (`@tanstack/react-virtual`) — defer to Phase 7/7b when row counts demand it.
- Server-persisted saved filters — localStorage now; revisit with Phase 12 prefs.

</deferred>

---

*Phase: 04-retro-atoms*
*Context synthesized: 2026-06-12 (autonomous orchestrator)*
