# Phase 3: Layout Primitives + Bottombar - Context

**Gathered:** 2026-06-12 (synthesized by orchestrator from parity plan + roadmap + STATE decisions — autonomous run, no discuss session)
**Status:** Ready for planning
**Source:** `docs/FRONTEND2_FEATURE_PARITY_PLAN.md` §4 Phase 3 + ROADMAP Phase 3 + STATE D-05..D-08 + `.planning/sketches/MANIFEST.md`

<domain>
## Phase Boundary

Phase 3 delivers the application chrome every authenticated route lives in:

1. **AppShell** — 2×3 CSS-Grid layout: TopBar / (Sidebar | content) / Bottombar.
2. **TopBar** — brand mark, workspace pill, ONLINE dot, user pill. MUST reserve slots (rendered placeholders or composition points) for: workspace switcher (Phase 5), notifications bell (Phase 13/G-5), SSE status indicator (Phase 6), user menu — chrome wires once.
3. **Sidebar** — grouped nav (Overview / Inventory / System groups carried from legacy, direction-agnostic), active-route emphasis, collapse-to-60px-icon-rail via single `data-collapsed` attribute (CSS-only, no JS measure phase), user menu footer.
4. **Bottombar** (desktop ≥768px only, D-06) — route-scoped shortcut chips + F1 HELP + SESSION/LOCAL clocks ticking every second.
5. **Mobile (<768px, D-05)** — NO Bottombar; FAB with context-aware radial menu (D-07). Sidebar becomes drawer.
6. **`useShortcuts(id, [...])` SSOT** (D-08) — single source of truth consumed by both Bottombar and FAB. `isEditableTarget(e.target)` guard from the FIRST commit: single-letter shortcuts NEVER fire while typing in input/textarea/select/contenteditable. Regression-tested.
7. **PageHeader** — route breadcrumb + session/last-sync meta line.
8. **F1 help dialog** — opens via key or chip click; ESC pops topmost modal first, never logs out while a modal is open (modal stack discipline).

NOT in phase: real nav destinations (most routes don't exist yet — disabled/pending states fine), workspace switching logic (Phase 5), SSE wiring (Phase 6), notifications data (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Locked (from STATE.md — immutable)
- **D-05:** Mobile (<768px) renders FAB only, no Bottombar.
- **D-06:** Desktop (≥768px) renders Bottombar only, no FAB.
- **D-07:** FAB exposes context-aware radial menu — actions adapt per route.
- **D-08:** Bottombar and FAB both consume `useShortcuts` context as single source of truth.

### Direction re-anchor (CRITICAL — resolves stale ROADMAP reference)
- The ROADMAP Phase 3 goal text references "locked sketch 005 chrome" and premium-terminal vocabulary (`// GROUP` comment labels, `[KEY] LABEL` chips, `// ROUTE` breadcrumb). **Sketch 005 belongs to the SCRAPPED premium-terminal direction (sketches 001-005).** Per `.planning/sketches/MANIFEST.md`, the canonical direction is **Retro OS Pastel (006-008)**.
- **What survives verbatim (structure, direction-agnostic):** AppShell grid, TopBar/Sidebar/Bottombar/PageHeader composition, grouped sidebar (Overview/Inventory/System), collapse-to-rail, useShortcuts SSOT, isEditableTarget guard, F1/ESC modal-stack behavior, responsive drawer/FAB split, SESSION/LOCAL clocks.
- **What re-anchors to retro-os:** ALL visual treatment. Bevel system, pinstriped pastel title bars where windows appear, Silkscreen display type (≥16px, uppercase), Plex Sans body, Plex Mono data/clocks, semantic titlebar colors, 2px ink borders, hard sand shadows — per `themes/retro-os.css` tokens (Phase 2) and the sketch-findings skill hard rules. The terminal `//`-comment label affordance and `[KEY]` chip styling are re-interpreted as retro-os equivalents (e.g. beveled key-cap chips fit the System 7 idiom naturally; group labels styled as retro-os section labels). UI-SPEC owns the exact treatment.
- Success Criteria 1's literal `// OVERVIEW` / `// {ROUTE}` strings are part of the stale vocabulary — the OBSERVABLE truth to preserve: group labels exist and read as group labels; breadcrumb shows current route; meta line shows session/last-sync. Exact glyphs per UI-SPEC under retro-os.

### Tech approach
- Tailwind v4 utilities from Phase 2 tokens ONLY (`bg-bg-panel`, `text-fg-ink`, `gap-sp-*`, bevel/shadow tokens). No new hex literals, no new tokens without justification.
- Collapse state: `data-collapsed` attribute + CSS — no JS layout measurement.
- Clocks: one interval, mono font, tabular-nums (guarded by Phase 2 glyph test conventions).
- Keyboard handling: a single document-level listener owned by useShortcuts provider; per-route registration `useShortcuts(id, bindings)`; F1 + ESC are global bindings; modal stack is a small context (open/close push/pop).

### Claude's Discretion
- Exact grid template values, breakpoint plumbing (CSS media vs hook), FAB radial animation details, drawer implementation, icon placeholders (icon style is an OPEN deferred decision from Phase 2 — use minimal/text placeholders or simple geometric icons; do NOT lock an icon library this phase).
- Bottombar overflow strategy on narrow desktop (paginate vs sheet) — pick one, keep F1+ESC right-anchored (Success Criterion 5).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design direction (MANDATORY)
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — retro-os hard rules + anti-patterns
- `.planning/sketches/MANIFEST.md` — locked decisions rolled up across 006-008; sketch 005 is HISTORY ONLY
- `.planning/sketches/006-retro-os-dashboard/` — closest validated chrome reference (window chrome at density)
- `frontend2/src/styles/tokens.css` — Phase 2 token contract (use utilities, never raw hex)

### Phase scope
- `.planning/ROADMAP.md` — Phase 3 section (structure + success criteria; visual vocabulary superseded as noted above)
- `.planning/REQUIREMENTS.md` — SHELL-01..06, BAR-01..05, TUI-01
- `docs/FRONTEND2_FEATURE_PARITY_PLAN.md` §4 Phase 3 — parity-critical slot reservations

### Legacy reference implementations (structure/behavior only — NOT styling)
- `frontend/components/dashboard/dashboard-shell.tsx`, `header.tsx`, `sidebar.tsx`
- `frontend/components/layout/bottombar.tsx`
- `frontend/lib/hooks/use-fab-actions.tsx`, `use-keyboard-shortcuts.ts`

### Existing code
- `frontend2/src/components/` — existing retro primitives (Window, BevelButton, RetroInput, RetroTable, StatCard, RetroBadge) and current static Sidebar from Phase 1 — REPLACE/extend, don't duplicate
- `frontend2/src/App.tsx` + router setup — where AppShell mounts

</canonical_refs>

<specifics>
## Specific Ideas

- TopBar slot reservation pattern: named children/slots with placeholder components (e.g. disabled bell icon) so Phases 5/6/13 swap implementations without touching AppShell.
- `isEditableTarget`: check tagName INPUT/TEXTAREA/SELECT + `isContentEditable` + `closest('[contenteditable="true"]')`; unit-test all four surfaces (Success Criterion 3 demands regression tests).
- ESC handling: modal stack provider; ESC pops top; only when stack empty may ESC reach other handlers; logout NEVER bound to bare ESC.
- Clocks: SESSION = elapsed since login (or app mount as fallback this phase), LOCAL = wall clock; both `font-mono tabular-nums`.

</specifics>

<deferred>
## Deferred Ideas

- Icon library lock (needs sketch 009 — carried from Phase 2 deferral). Use placeholders.
- Workspace switcher logic (Phase 5), SSE indicator wiring (Phase 6), notifications data (Phase 13) — slots only this phase.

</deferred>

---

*Phase: 03-layout-primitives-bottombar*
*Context synthesized: 2026-06-12 (autonomous orchestrator, parity-plan-derived)*
