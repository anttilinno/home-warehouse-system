# Phase 4: Retro Atoms - Research

**Researched:** 2026-06-12
**Domain:** Frontend component-library completion (React 19 + TS, hand-rolled retro-os atoms; accessibility-critical overlays/combobox/selection)
**Confidence:** HIGH (codebase facts verified by direct read; ARIA patterns cited from W3C APG; sonner deps verified on npm registry)

## Summary

Phase 4 completes the `frontend2` retro-os atom library that every feature page (Phases 5-16) consumes. The phase is overwhelmingly a **build-on-existing-infrastructure** exercise, not a greenfield one: Phase 1 shipped the chrome primitives (`Window`, `BevelButton`, `RetroInput`, `RetroTable`, `RetroBadge`, `StatCard`) and Phase 3 shipped the two cross-cutting providers this phase wires into — `ModalStackProvider` (capture-phase ESC arbiter, TUI-02 already solved) and `ShortcutsProvider` (register-by-id SSOT for the Bottombar). The dominant risk is **inconsistency**: new atoms that don't reuse the established bevel/token/overlay/shortcut conventions will fork the design system. The research below pins every new atom to an existing pattern.

Three decisions carry real engineering weight and are resolved here: (1) **Toast** — skin `sonner` (verified zero runtime deps, CSS-transition animations, no Framer Motion — satisfies the no-motion-lib constraint); (2) **Combobox** — hand-roll on the W3C APG *editable combobox with list autocomplete* pattern using **aria-activedescendant** (virtual focus), not roving tabindex; (3) **Selection model** — an `id`-keyed anchor+range hook (`useTableSelection`) that is immune to sort/filter reordering, surfacing its action set to the Bottombar via the existing `useShortcuts` register-by-id API.

**Primary recommendation:** Extract a single `RetroDialog` overlay primitive (scrim + `Window` + `useModalStack` + focus-trap, generalized from the existing `F1HelpDialog`), then build every other overlay (`RetroConfirmDialog`, `RetroComboboxPopover`, `RetroSelect` listbox, `FilterPopover`) on top of it so focus-trap and ESC behavior are implemented ONCE. Install `sonner@2.0.7` for toasts; hand-roll everything else.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| All retro atoms (form/overlay/feedback/data/filter) | Browser / Client | — | Pure presentational React components; no server contract this phase |
| ESC ordering across overlays (TUI-02) | Browser / Client (`ModalStackProvider`, Phase 3) | — | Already solved capture-phase; Phase 4 only registers new overlays through it |
| Bulk-action surfacing (TUI-06) | Browser / Client (`ShortcutsProvider`, Phase 3) | — | Selection hook registers an action group; Bottombar (Phase 3) renders it |
| SavedFilters persistence | Browser / Client (`localStorage`) | API (deferred to Phase 12 prefs) | CONTEXT locks localStorage now; server prefs explicitly deferred |
| SSE live-dot (TUI-03) | Browser / Client (visual primitive only) | SSEProvider (Phase 6) | Phase 4 ships the *dot*, NOT the wiring — `RetroStatusDot` is dumb-prop-driven |
| FileInput multipart readiness | Browser / Client | API (Phase 7/14b upload) | Atom exposes `File[]`; actual multipart POST is a later phase |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Direction re-anchor:** ROADMAP Phase 4 goal text ("sketch 005 chrome", `// HEADER` slot, hazard-stripe, monospace anchor) is STALE. Canonical direction is **retro-os pastel (sketches 006-008)** per MANIFEST + sketch-findings skill. Observable truths survive (panels have header slots, danger variants exist, numeric columns tabular); "hazard-stripe" → retro-os danger treatment (danger tokens, pink-titlebar semantics) as UI-SPEC decides.
- **Extend, don't fork:** Existing Phase 1 primitives (`Window`, `BevelButton`, `RetroInput`, `RetroTable`, `StatCard`, `RetroBadge`) are already retro-os. Keep established `Retro*`/component names; do NOT rename shipped components.
- **All overlays route ESC through Phase 3 `useModalStack`** (capture-phase arbiter). No overlay owns its own document-level ESC listener.
- **Bulk-action chips surface through the Phase 3 shortcuts SSOT/Bottombar.** `BulkActionBar` atom renders chips inline on mobile; desktop bulk actions integrate with Bottombar (selection context exposes actions; Bottombar consumes) — Success Criterion 5.
- **Status pill variants map to existing tokens:** OK=mint-deep, WARN=warn-deep/butter, INFO=blue-deep, DANGER=danger (#b73348 family). **No new color tokens.**
- **`tabular-nums`** via the established `font-variant-numeric` pattern (glyph-coverage test guards the font side).
- **No new heavyweight dependencies without researcher justification.** Toast: skin `sonner` ONLY if researcher confirms viable under no-motion-lib + bundle constraints; otherwise hand-roll. Combobox: hand-rolled on `RetroInput` + popover primitive (no headless-UI lib) unless researcher finds a hard blocker.

### Claude's Discretion
- Component file organization (`components/atoms/` vs flat), barrel strategy, demo page layout/grouping, SavedFilters preset shape, FileInput drag-drop support level.

### Deferred Ideas (OUT OF SCOPE)
- Icon library (OPEN since Phase 2) — placeholders still (unicode glyphs).
- Virtualized table (`@tanstack/react-virtual`) — defer to Phase 7/7b when row counts demand it.
- Server-persisted saved filters — localStorage now; revisit with Phase 12 prefs.
- SSE wiring (Phase 6), command palette/cmdk (Phase 16), any feature page.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TUI-02 | Modal-stack ESC pops topmost overlay first (dialog→drawer→menu); never logs out while a modal is open | ALREADY SOLVED by `ModalStackProvider` (capture-phase, Phase 3). Phase 4 task: route every new overlay through `useModalStack`; ship integration test across dialog→drawer→menu (see Validation Architecture) |
| TUI-03 | SSE state in panel headers — live dot + `sse: ● live` text | `RetroStatusDot` atom is a **dumb visual primitive** (prop-driven status + optional step-end blink keyframe). NO SSE wiring this phase |
| TUI-04 | Status pills OK/WARN/INFO/DANGER with color tokens; numeric columns `tabular-nums` | Tokens already exist (`--ok-bg`/`--warn-bg`/`--info-bg`/`--danger-bg`, deep companions). `RetroBadge` variants already cover ok/warn/danger/info. `.rtable .mono` already applies `font-variant-numeric: tabular-nums`. Build a thin status-pill preset on `RetroBadge` |
| TUI-06 | Multi-select via Shift+Click on `RetroTable`; Bottombar surfaces bulk actions | `useTableSelection(rows)` hook (id-keyed anchor+range) + `RetroTable` already renders `aria-selected="true"` row treatment. Bottombar consumes via `useShortcuts` register-by-id |
| ATOM-FB-01 | FilterBar atom exists (Phases 7/8/14 consume) | Legacy `frontend/components/ui/filter-bar.tsx` contract: `{filterChips, onRemoveFilter, onClearAll}`. Reskin onto `RetroBadge` chips + `BevelButton` |
| ATOM-FB-02 | FilterPopover atom exists | Build on the extracted overlay/popover primitive (anchored, not centered) |
| ATOM-FB-03 | BulkActionBar atom exists, surfaced for multi-select | Legacy contract: `{selectedCount, onClear, children}`. Mobile inline render; desktop defers to Bottombar per locked decision |
| ATOM-FB-04 | SavedFilters atom exists for presets | Legacy `use-saved-filters.ts` localStorage contract is portable verbatim (see Code Examples) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.2.5 | UI runtime | Already the project runtime |
| typescript | 5.9.3 | Types | Project standard |
| tailwindcss | 4.2.4 | Utility styling (`@theme inline` tokens) | Already the styling layer; all retro tokens mapped |
| sonner | 2.0.7 | Toast system (skinned) | **Verified zero runtime deps, CSS-transition animations (no Framer Motion), peerDeps react 18/19 only** — uniquely satisfies the no-motion-lib constraint while giving `toast.promise` ergonomics required by Phase 6 SC4 |

### Supporting (already installed — reuse, do NOT re-add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.74.0 | Form state | Form atoms should be RHF-compatible (forwardRef, name/onChange) so feature pages wire them with `register()` |
| @hookform/resolvers + zod | 5.2.2 / 4.4.1 | Validation | `RetroFormField` surfaces `error` strings RHF+zod produce; don't build a validation layer in atoms |
| @lingui/react (macro `Trans`/`t`) | 6.0.1 | i18n | ALL user-facing atom text uses `<Trans>` / `t` (see existing atoms) |
| @testing-library/react + user-event + vitest | 16.3.2 / latest / 4.1.5 | Per-atom RTL specs | Established pattern (see `F1HelpDialog.test.tsx`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled combobox | `@radix-ui/react-*` / `cmdk` (used by legacy `/frontend`) | CONTEXT locks hand-roll; legacy frontend1 pulled 18 Radix packages + cmdk — frontend2 deliberately ships none. Adding them forks the no-headless-lib architecture and bloats bundle (POL-04 budget). Reject unless a hard a11y blocker emerges (none found) |
| `sonner` for toast | Hand-rolled on portal/modal infra | Viable (CONTEXT's fallback) but `sonner` gives swipe-dismiss, stacking, `toast.promise`, and a11y live-region for free at ~zero motion-lib cost. Skinning via `toastOptions.unstyled` + `className` is well-supported. **Recommend skinning sonner.** |
| `aria-activedescendant` combobox | Roving tabindex | W3C APG explicitly notes "no use case for combobox with a listbox popup and roving tabindex" — activedescendant is canonical for editable comboboxes |

**Installation:**
```bash
cd frontend2 && bun add sonner@2.0.7
```

**Version verification:** `npm view sonner version` → `2.0.7` (published 2025-08-02). `npm view sonner dependencies` → none. `npm view sonner peerDependencies` → `{ react: ^18||^19, react-dom: ^18||^19 }` (satisfied by 19.2.5). [VERIFIED: npm registry] for existence/version; treat as `[ASSUMED]` for legitimacy (slopcheck unavailable — see Package Legitimacy Audit; planner must gate install behind a verify checkpoint).

## Package Legitimacy Audit

> slopcheck could not be installed in this environment. Per protocol, the single new package is tagged `[ASSUMED]` and the planner MUST gate its install behind a `checkpoint:human-verify` task.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| sonner | npm | published 2.0.7 on 2025-08-02 (project ~3 yrs) | very high (millions/wk, well-known) | github.com/emilkowalski/sonner | unavailable | Flagged `[ASSUMED]` — planner adds checkpoint before `bun add` |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*sonner is a widely-used, well-known package authored by Emil Kowalski (also `vaul`); the `[ASSUMED]` tag reflects tool unavailability this session, not genuine doubt. The planner should still insert a one-line human-verify checkpoint before install per the package-legitimacy gate.*

No `postinstall` script concern: `npm view sonner scripts.postinstall` returns nothing.

## Architecture Patterns

### System Architecture Diagram

```
                          App.tsx provider stack (Phase 3 + Phase 6)
   ┌──────────────────────────────────────────────────────────────────────┐
   │  ModalStackProvider (capture-phase ESC arbiter)                        │
   │  ShortcutsProvider (register-by-id SSOT)                               │
   │  [Phase 6] ToastProvider = sonner <Toaster> skinned                    │
   └──────────────────────────────────────────────────────────────────────┘
                 │ push/pop                 │ register/unregister
                 ▼                          ▼
   ┌─────────────────────────┐   ┌────────────────────────────┐
   │  RetroDialog (extracted) │   │  useTableSelection(rows)   │
   │  scrim + Window +        │   │  anchor + Set<id> range    │
   │  useModalStack + trap    │   │  exposes {selected,actions}│
   └─────────────────────────┘   └────────────────────────────┘
        ▲          ▲    ▲                    │ actions[]
        │          │    │                    ▼ useShortcuts("bulk", actions)
  RetroConfirm  Combo  Filter          ┌────────────────────┐
  Dialog        Popover Popover        │ Bottombar (Phase 3)│ renders chips
                                        └────────────────────┘
                                                 │ (mobile)
                                                 ▼
                                          BulkActionBar (inline)

  Form family (RHF-compatible, forwardRef):
     RetroFormField (label+error+hint wrapper)
        ├─ RetroInput (exists) / RetroTextarea / RetroCheckbox
        ├─ RetroSelect  ──────────► listbox popover (on RetroDialog primitive)
        ├─ RetroCombobox ─────────► aria-activedescendant + listbox popover
        └─ RetroFileInput ────────► drag-drop + click; emits File[]  (→ Phase 7/14b)

  Feedback: RetroToast (sonner skin) · RetroEmptyState · RetroStatusDot(TUI-03) · status pills(TUI-04)
  Data:     RetroTable+selection(TUI-06) · RetroPagination · RetroTabs(roving tabindex)
  Surface:  /demo route inside AppShell (every atom rendered)
```

Data-flow trace (bulk action, Success Criterion 5): user Shift+Clicks rows → `useTableSelection` computes id-range from anchor → `selected: Set<id>` flips `aria-selected` on rows (existing `.rtable` CSS fills them blue) → hook calls `useShortcuts("bulk-actions", actions)` while selection non-empty → `ShortcutsProvider` merges the group → `Bottombar` renders the chips and its single dispatcher fires their `action`.

### Recommended Project Structure (Claude's discretion — recommended)
```
frontend2/src/components/retro/
├── index.ts              # single barrel (locked v2.0 convention: @/components/retro)
├── Window.tsx            # exists
├── BevelButton.tsx       # exists
├── RetroInput.tsx        # exists — keep
├── RetroBadge.tsx        # exists — add StatusPill preset
├── RetroTable.tsx        # exists — pairs with useTableSelection
├── StatCard.tsx          # exists (HUD primitive)
├── overlay/
│   ├── RetroDialog.tsx        # extracted overlay primitive (scrim+Window+trap+useModalStack)
│   ├── RetroConfirmDialog.tsx # preset of RetroDialog (danger, focus-on-cancel)
│   └── Popover.tsx            # anchored overlay primitive (combobox/select/filter)
├── form/
│   ├── RetroFormField.tsx     # label+error+hint wrapper
│   ├── RetroSelect.tsx        # native-ish or listbox popover
│   ├── RetroCombobox.tsx      # aria-activedescendant editable combobox
│   ├── RetroTextarea.tsx
│   ├── RetroCheckbox.tsx
│   └── RetroFileInput.tsx
├── feedback/
│   ├── RetroToast.tsx         # sonner <Toaster> skin + helpers
│   ├── RetroEmptyState.tsx
│   └── RetroStatusDot.tsx     # TUI-03 visual primitive
├── data/
│   ├── useTableSelection.ts   # id-keyed anchor+range hook (TUI-06)
│   ├── RetroPagination.tsx
│   └── RetroTabs.tsx          # roving tabindex
└── filters/
    ├── FilterBar.tsx          # ATOM-FB-01
    ├── FilterPopover.tsx      # ATOM-FB-02
    ├── BulkActionBar.tsx      # ATOM-FB-03
    ├── SavedFilters.tsx       # ATOM-FB-04
    └── useSavedFilters.ts     # localStorage hook (ported from legacy)
```
(Flat-vs-nested is Claude's discretion; nested shown for clarity — whichever is chosen, the single `@/components/retro` barrel must re-export everything, per the locked v2.0 convention.)

### Pattern 1: Overlay primitive (extract from F1HelpDialog)
**What:** The existing `F1HelpDialog` already implements the full correct overlay recipe inline — scrim `div` (`fixed inset-0 z-40 bg-fg-ink/40`, click-to-close), inner `role="dialog" aria-modal aria-labelledby`, `tabIndex={-1}` focus target, a Tab focus-trap, focus restore to invoker on close, and `useModalStack(open, onClose)`. **Generalize this into `RetroDialog`** so it's written once.
**When to use:** Every centered overlay (`RetroDialog`, `RetroConfirmDialog`). `Popover` is a sibling for *anchored* overlays.
**Example:** see Code Examples below (distilled from `F1HelpDialog.tsx`).

### Pattern 2: Modal-stack registration (TUI-02) — already correct
**What:** `useModalStack(isOpen, onClose)` pushes a closer onto the capture-phase stack; ESC pops topmost only; empty stack = ESC no-op (never logout).
**When to use:** EVERY overlay including combobox/select listboxes and FilterPopover. No overlay installs its own document ESC listener.
**Anti-pattern:** a per-overlay `document.addEventListener("keydown", escClose)` — this re-introduces the logout-race TUI-02 explicitly forbids.

### Pattern 3: Shortcut/bulk-action registration (TUI-06 / Success Criterion 5)
**What:** `useShortcuts(id, bindings)` registers a stable-id group into the SSOT; Bottombar renders + dispatches. Selection hook registers a `"bulk-actions"` group while `selected.size > 0`, unregisters when empty.
**Pitfall:** `bindings` must be a stable reference (`useMemo`) or the register effect churns (documented in `useShortcuts.ts` Pitfall 3).

### Pattern 4: aria-activedescendant combobox
**What:** DOM focus stays on the `<input role="combobox" aria-expanded aria-controls aria-activedescendant>`; arrow keys move a *virtual* highlight by setting `aria-activedescendant` to the option's id; `<ul role="listbox">` options have `role="option" aria-selected`. Enter commits the active option; Escape closes (via modal stack). [CITED: w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/]
**When to use:** `RetroCombobox` (filterable). `RetroSelect` may use the same listbox or a native `<select>` styled — see Open Questions.

### Anti-Patterns to Avoid
- **Adding Radix / Headless UI / cmdk:** frontend2 ships zero headless libs by design. Legacy `/frontend` pulled 18 Radix packages + cmdk; do not reintroduce them.
- **Roving tabindex inside a combobox listbox:** wrong pattern for editable comboboxes (W3C APG). Use activedescendant. (Roving tabindex IS correct for `RetroTabs`.)
- **Index-based selection ranges:** selection MUST be id-keyed; sorting/filtering reorders indices and would silently re-select wrong rows.
- **New color tokens for status pills:** locked — map to existing `--ok-bg`/`--warn-bg`/`--info-bg`/`--danger-bg` + deep companions.
- **Per-overlay ESC listeners:** breaks TUI-02; always go through `useModalStack`.
- **`motion`/`framer-motion`/`@react-spring`:** forbidden v3.0 constraint; all transitions are CSS. sonner complies (CSS transitions only).
- **Pixel (Silkscreen) font below 16px or in body/data:** hard rule; values floor at 30px, body/data are Plex Sans/Mono.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast stacking, swipe-dismiss, `toast.promise`, a11y live-region | Custom toast queue + timers + ARIA live | `sonner@2.0.7` skinned | Zero motion-lib cost; edge cases (focus, hover-pause, stacking order, screen-reader announcement) are subtle and already solved |
| ESC ordering across overlays | A new overlay ESC handler | `useModalStack` (Phase 3) | Capture-phase arbiter already guarantees TUI-02; a second handler reintroduces the logout race |
| Keyboard-shortcut dispatch / chip surfacing | A bulk-action keydown listener | `useShortcuts` SSOT (Phase 3) | Single-dispatcher invariant; second listener = double-fire |
| tabular numeric alignment | Manual letter-spacing hacks | `.rtable .mono` (`font-variant-numeric: tabular-nums`, exists) | Already verified; guarded by glyph-coverage test |
| Form validation in atoms | Custom validators | react-hook-form + zod (installed); atoms just render `error` | Atoms stay presentational; validation lives at the form layer |
| Focus trap / focus restore | Per-dialog bespoke trap | Extracted `RetroDialog` (generalize F1HelpDialog) | Write the trap ONCE; every overlay inherits it |

**Key insight:** Phase 3 already paid the hard infrastructure cost (ESC arbiter, shortcuts SSOT, table chrome, tokens). The failure mode for Phase 4 is *re-solving solved problems inconsistently*. Almost every "hard" sub-problem already has an owner — the atom's job is to plug into it.

## Common Pitfalls

### Pitfall 1: Index-based selection breaks under sort/filter
**What goes wrong:** Range selection stored as array indices selects the wrong rows after the table re-sorts or filters.
**Why it happens:** Shift+Click range is naturally expressed as "rows between anchor and target"; tempting to store positions.
**How to avoid:** Store `anchorId` + `Set<id>`. Compute the range by mapping the *current rendered order* to ids at click time, but persist only ids. CONTEXT specifies id-based explicitly.
**Warning signs:** Selection "jumps" after sorting; test by selecting a range, re-sorting, asserting the same ids stay selected.

### Pitfall 2: Combobox focus management (activedescendant vs DOM focus)
**What goes wrong:** Moving real DOM focus into the listbox breaks typing and screen-reader announcement; or `aria-activedescendant` points at an id that isn't scrolled into view.
**Why it happens:** Mixing the two focus models.
**How to avoid:** Keep DOM focus on the input; only update `aria-activedescendant`; `scrollIntoView` the active option. Each option needs a stable `id`. [CITED: w3.org APG combobox-autocomplete-list]
**Warning signs:** Arrow keys don't announce options in VoiceOver/NVDA; the highlighted option scrolls off-screen.

### Pitfall 3: Stale `bindings` reference churns the shortcuts registry
**What goes wrong:** Bulk-action chips flicker / re-register every render.
**Why it happens:** Passing an inline array literal to `useShortcuts` (fresh identity each render).
**How to avoid:** `useMemo` the bindings (documented in `useShortcuts.ts`). The selection hook should memoize its actions array keyed on `selected`.
**Warning signs:** Bottombar chips flash; effect cleanup logs in React 19 StrictMode.

### Pitfall 4: sonner skin leaks rounded corners / motion / mixed-case
**What goes wrong:** Default sonner toasts have rounded corners and a system font — violates retro-os hard rules (radius 0, ink bevel, Plex/Silkscreen).
**Why it happens:** Not overriding sonner's default styling.
**How to avoid:** Mount `<Toaster>` with `toastOptions={{ unstyled: true, classNames: { toast: "...bevel-raised border-2 border-border-ink bg-bg-panel...", title:..., ... } }}`. Render toasts as mini-windows. Verify no rounded radius and CSS-only transitions.
**Warning signs:** Visual-review on `/demo` shows rounded toast; bundle analyzer shows a motion lib (shouldn't — sonner has none).

### Pitfall 5: Overlay primitive not generalized → trap copy-pasted
**What goes wrong:** Each overlay re-implements the Tab focus-trap slightly differently; bugs diverge.
**Why it happens:** Building `RetroDialog`, `RetroConfirmDialog`, `FilterPopover` independently instead of on one primitive.
**How to avoid:** Extract `RetroDialog` from `F1HelpDialog` FIRST (Wave 0 of the phase); build the rest on it.
**Warning signs:** Two different `querySelectorAll` focusable selectors in the codebase.

### Pitfall 6: RetroStatusDot accidentally couples to SSE
**What goes wrong:** Atom imports an SSE hook that doesn't exist until Phase 6.
**Why it happens:** TUI-03's `sse: ● live` text invites wiring live state now.
**How to avoid:** `RetroStatusDot` is prop-driven only (`status`, `blink?`). Phase 6 feeds it `useSSEStatus()`. Demo page passes static props.

## Code Examples

### Selection model (id-keyed anchor + range) — TUI-06
```typescript
// useTableSelection.ts — sketch; ids, never indices
export function useTableSelection<T extends { id: string }>(rows: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const onRowClick = useCallback(
    (id: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && anchorRef.current) {
          const order = rows.map((r) => r.id);          // CURRENT rendered order
          const a = order.indexOf(anchorRef.current);
          const b = order.indexOf(id);
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(order[i]); // store IDS
        } else if (e.metaKey || e.ctrlKey) {
          next.has(id) ? next.delete(id) : next.add(id);
          anchorRef.current = id;
        } else {
          next.clear();
          next.add(id);
          anchorRef.current = id;
        }
        return next;
      });
    },
    [rows],
  );
  const clear = useCallback(() => { setSelected(new Set()); anchorRef.current = null; }, []);
  return { selected, onRowClick, clear };
}
```

### Wiring bulk actions to the Bottombar (Success Criterion 5)
```typescript
// inside a feature list page (illustrative — atom exposes the wiring point)
const { selected, onRowClick, clear } = useTableSelection(rows);
const bulkActions = useMemo<Shortcut[]>(
  () => selected.size === 0 ? [] : [
    { key: "A", label: `Archive ${selected.size}`, action: () => archive([...selected]) },
    { key: "X", label: "Clear", action: clear },
  ],
  [selected, clear],
);
useShortcuts("bulk-actions", bulkActions); // empty array = nothing registered → no chips
```

### Overlay primitive (generalized from F1HelpDialog.tsx)
```typescript
// RetroDialog.tsx — distilled from the verified F1HelpDialog recipe
export function RetroDialog({ open, onClose, title, titlebarVariant = "blue", children }: {...}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<HTMLElement | null>(null);
  useModalStack(open, onClose);                       // TUI-02: ESC via the arbiter, never a local listener
  useEffect(() => {
    if (!open) return;
    invokerRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const node = dialogRef.current;
    const onKeyDown = (e: KeyboardEvent) => { /* Tab focus-trap — same as F1HelpDialog */ };
    node?.addEventListener("keydown", onKeyDown);
    return () => { node?.removeEventListener("keydown", onKeyDown); invokerRef.current?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-fg-ink/40 p-sp-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
           className="w-[min(520px,92vw)] outline-none" onClick={(e) => e.stopPropagation()}>
        <Window title={<span id={titleId}>{title}</span>} titlebarVariant={titlebarVariant}>{children}</Window>
      </div>
    </div>
  );
}
// RetroConfirmDialog = preset: titlebarVariant="pink", confirm/cancel BevelButtons, autofocus the Cancel button.
```

### sonner retro skin (Phase 4 ships the skinned component; Phase 6 mounts it in the provider stack)
```typescript
// RetroToast.tsx — Source: sonner docs (unstyled + classNames API)
import { Toaster as SonnerToaster, toast } from "sonner";
export const retroToast = toast; // re-export ergonomics incl. toast.promise
export function RetroToaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "border-2 border-border-ink bg-bg-panel bevel-raised p-sp-3 font-body text-[13px] text-fg-ink",
          title: "font-display text-[16px] uppercase", // ≥16px display rule honored
          description: "text-fg-muted",
          // radius 0 inherited; NO rounded utilities
        },
      }}
    />
  );
}
```

### SavedFilters localStorage contract (port verbatim from legacy)
```typescript
// useSavedFilters.ts — legacy contract is forward-compatible with Phase 12 server prefs
export interface SavedFilter { id: string; name: string; filters: Record<string, unknown>; createdAt: string; isDefault?: boolean; }
// useSavedFilters({ storageKey, onApplyFilter }) → { savedFilters, saveFilter, deleteFilter, updateFilter, applyFilter, setAsDefault, getDefaultFilter }
// Storage shape is an array of SavedFilter under `storageKey`. Server-prefs migration (Phase 12) can lift this array as-is.
```
(Full legacy implementation at `frontend/lib/hooks/use-saved-filters.ts` — port and retype `any`→`unknown`.)

## State of the Art

| Old Approach (legacy /frontend) | Current Approach (frontend2) | When Changed | Impact |
|---------------------------------|------------------------------|--------------|--------|
| 18 Radix packages + cmdk + sonner for atoms | Hand-rolled atoms; sonner ONLY (for toast) | v2.0/v3.0 rebuild | Smaller bundle, full chrome control, but combobox/select/dialog must be built by hand |
| Tailwind v3 + shadcn `cn()` | Tailwind v4 `@theme inline` tokens, no `cn()` helper | v2.0 | Utilities resolve from token CSS vars; class merging is plain template strings |
| Framer Motion transitions | CSS-only transitions | v3.0 constraint | sonner chosen specifically because it complies |
| next-intl | Lingui macros (`Trans`/`t`) | v2.0 | All atom text uses Lingui |

**Deprecated/outdated:**
- ROADMAP Phase 4 goal text (sketch 005 / premium-terminal / hazard-stripe) — superseded by retro-os pastel 006-008. Use UI-SPEC/MANIFEST as the visual SSOT.
- Legacy `cn()` + shadcn primitives — not present in frontend2; don't import.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sonner@2.0.7` is legitimate/safe (slopcheck unavailable to confirm) | Standard Stack / Package Audit | Low — widely-used package, but planner should add a human-verify checkpoint before install |
| A2 | sonner's `unstyled` + `classNames` API fully suppresses default radius and renders cleanly as retro mini-windows | Code Examples / Pitfall 4 | Medium — if skinning fights sonner internals, fall back to CONTEXT's hand-rolled toast on portal/modal infra. Verify on `/demo` early |
| A3 | `RetroSelect` can use the same activedescendant listbox as combobox (vs. styled native `<select>`) | Open Questions | Low — both are valid; native `<select>` is the safer a11y floor if listbox styling is hard |
| A4 | Demo route should be unlisted-but-routable (not in Sidebar nav, or dev-flag gated) | Open Questions | Low — cosmetic; CONTEXT marks demo layout as Claude's discretion |

## Open Questions (RESOLVED)

<!-- RESOLVED 2026-06-12 (orchestrator arbitration): (1) RetroSelect = NATIVE select skinned (UI-SPEC wins; researcher called native the safe fallback; custom listbox lives in RetroCombobox). (2) /demo = unlisted route under AppShell, DEV-gated nav link. (3) FileInput = click + basic drop emitting File[]. (4) sonner@2.0.7 APPROVED — orchestrator verified on registry: zero runtime deps, react 18/19 peers only, maintainer emilkowalski, est. 2023; supersedes UI-SPEC resolution #2 (engine only — UI-SPEC visual contract for toast region/chrome/semantics still BINDING). -->

1. **RetroSelect: native `<select>` vs. activedescendant listbox**
   - What we know: Combobox MUST be a listbox (filterable). Select is not filterable.
   - What's unclear: Whether to skin a native `<select>` (bulletproof a11y, limited option styling) or reuse the listbox popover (full chrome, more code).
   - Recommendation: Default to the listbox popover for visual consistency, but a styled native `<select>` is an acceptable a11y-safe fallback if popover option styling proves costly. Decide in planning.

2. **Demo route registration**
   - What we know: Router uses declarative `<Routes>` in `routes/index.tsx`; AppShell is the layout route; Sidebar nav items are explicit `<NavItem>`s.
   - What's unclear: Whether `/demo` appears in Sidebar.
   - Recommendation: Register `/demo` as a child route under AppShell but DO NOT add a Sidebar `<NavItem>` (or gate it behind `import.meta.env.DEV`). Keeps it routable for visual review without shipping a nav entry. (Claude's discretion per CONTEXT.)

3. **FileInput drag-drop depth (Claude's discretion)**
   - What we know: Phase 7/14b need multipart photo/attachment upload; atom must emit `File[]`.
   - Recommendation: Ship click-to-browse + basic drag-drop (`onDragOver`/`onDrop`, dropzone highlight). Do NOT build chunked/resumable upload — that's the feature phase's job. Atom is a controlled `File[]` emitter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | install/build/test scripts | ✓ (project standard) | — | npm/pnpm |
| vitest + RTL + user-event | per-atom specs | ✓ | 4.1.5 / 16.3.2 | — |
| @playwright/test | integration ESC spec (optional) | ✓ | 1.59.1 | RTL jsdom integration test suffices for TUI-02 |
| sonner | RetroToast | ✗ (not yet installed) | target 2.0.7 | hand-rolled toast on portal/modal infra (CONTEXT fallback) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `sonner` (install it; fallback is the hand-rolled toast CONTEXT pre-authorized).

## Validation Architecture

> nyquist_validation is absent in `.planning/config.json` → treated as ENABLED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 + @testing-library/react 16.3.2 + user-event |
| Config file | `frontend2/vitest.config.ts` (jsdom env) |
| Quick run command | `cd frontend2 && bun run test -- <file>` |
| Full suite command | `cd frontend2 && bun run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUI-02 | ESC pops topmost across dialog→drawer→menu; never logs out while any overlay open | integration (RTL) | `bun run test -- src/components/retro/overlay/escStack.test.tsx` | ❌ Wave 0 |
| TUI-06 | id-keyed Shift+Click range survives re-sort; range/toggle/single | unit (RTL) | `bun run test -- src/components/retro/data/useTableSelection.test.ts` | ❌ Wave 0 |
| TUI-06 | Bulk actions register/unregister in Bottombar with selection | integration (RTL) | `bun run test -- src/components/retro/data/bulkActions.test.tsx` | ❌ Wave 0 |
| TUI-04 | Status pill renders OK/WARN/INFO/DANGER with token classes; numeric col has `tabular-nums` | unit (RTL) | `bun run test -- src/components/retro/RetroBadge.test.tsx` | partial (`__tests__/retro.test.tsx` exists) |
| TUI-03 | RetroStatusDot renders status + blink prop; NO SSE import | unit (RTL) | `bun run test -- src/components/retro/feedback/RetroStatusDot.test.tsx` | ❌ Wave 0 |
| (combobox) | aria-activedescendant moves with arrows; Enter commits; Escape closes via modal stack | unit (RTL) | `bun run test -- src/components/retro/form/RetroCombobox.test.tsx` | ❌ Wave 0 |
| (dialog) | focus trap cycles; focus restores to invoker; aria-modal set | unit (RTL) | `bun run test -- src/components/retro/overlay/RetroDialog.test.tsx` | ❌ Wave 0 |
| ATOM-FB-04 | saveFilter/applyFilter/setAsDefault persist to localStorage; default auto-applies | unit (RTL) | `bun run test -- src/components/retro/filters/useSavedFilters.test.ts` | ❌ Wave 0 |
| ATOM-FB-01/03 | FilterBar chips removable; BulkActionBar clear/count | unit (RTL) | `bun run test -- src/components/retro/filters/...test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test -- <touched file>` + `bun run lint:tsc`
- **Per wave merge:** `cd frontend2 && bun run test` (full vitest)
- **Phase gate:** Full suite green + `bun run build` (tsc + vite) before `/gsd:verify-work`; visual review on `/demo`.

### Wave 0 Gaps
- [ ] Extract `RetroDialog` overlay primitive FIRST (every other overlay depends on it) + `RetroDialog.test.tsx`
- [ ] `escStack.test.tsx` — TUI-02 integration across a real dialog→drawer→menu stack (model on existing `F1HelpDialog.test.tsx` `LogoutOnEscape` harness — it already proves "never logs out while open")
- [ ] `useTableSelection.test.ts` — id-keyed range survives re-sort (the critical correctness test)
- [ ] `useSavedFilters.test.ts` — localStorage contract (mock `localStorage`)
- [ ] No new framework install needed — vitest/RTL already configured.

*(Existing infra covers framework + jsdom; gaps are the new per-atom spec files.)*

## Security Domain

> security_enforcement is absent → enabled. This is a pure-frontend presentational component-library phase: no auth, no network mutations, no secrets, no server contract. Threat surface is minimal but two input-validation/XSS items apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in atoms) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation / Sanitization | yes | React escapes JSX by default; atoms must NOT use `dangerouslySetInnerHTML` for user/filter text (FilterBar chip labels, SavedFilters names, toast messages). `localStorage` reads (`useSavedFilters`) must `try/catch` parse (legacy already does) and treat parsed shape as untrusted |
| V6 Cryptography | no | — |

### Known Threat Patterns for hand-rolled React atoms

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via SavedFilters name / filter values rendered without escaping | Tampering / Elevation | Render as text nodes (JSX default-escapes); never `dangerouslySetInnerHTML`; validate/clamp on read |
| Corrupted/oversized localStorage payload | DoS (client) | `try/catch` JSON.parse (legacy pattern), tolerate malformed data by resetting to `[]` |
| ARIA mis-wiring causing keyboard-trap / focus loss (accessibility-as-safety) | — (a11y) | Focus-trap + restore in `RetroDialog`; activedescendant scroll-into-view; covered by RTL specs |

## Sources

### Primary (HIGH confidence)
- Direct codebase reads (verified this session): `frontend2/src/components/retro/{Window,BevelButton,RetroInput,RetroTable,RetroBadge,StatCard,index}.tsx`, `frontend2/src/components/modal/{ModalStackContext,useModalStack}.tsx`, `frontend2/src/components/shortcuts/{ShortcutsContext,useShortcuts}.ts`, `frontend2/src/components/layout/{F1HelpDialog,Bottombar,Sidebar}.tsx`, `frontend2/src/styles/{tokens,globals}.css`, `frontend2/src/routes/index.tsx`, `frontend2/package.json`
- Legacy contracts: `frontend/components/ui/{filter-bar,bulk-action-bar,filter-popover,saved-filters}.tsx`, `frontend/lib/hooks/use-saved-filters.ts`, `frontend/package.json`
- CONTEXT/ROADMAP/REQUIREMENTS/MANIFEST/sketch-findings SKILL (this phase's canonical inputs)
- npm registry: `npm view sonner version|dependencies|peerDependencies|dist.unpackedSize|time.modified` → 2.0.7, no deps, react 18/19 peer, published 2025-08-02
- [CITED: w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/] — editable combobox + activedescendant pattern

### Secondary (MEDIUM confidence)
- WebSearch (verified against MDN/W3C): sonner uses CSS transitions, not Framer Motion (confirms no-motion-lib compliance); activedescendant is canonical for combobox listbox vs roving tabindex

### Tertiary (LOW confidence)
- None load-bearing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — sonner deps verified on registry; everything else already in `package.json`
- Architecture: HIGH — every pattern maps to verified existing code (modal stack, shortcuts SSOT, table chrome, tokens)
- Pitfalls: HIGH — derived from the existing code's own documented pitfalls + W3C APG
- Security: HIGH (and minimal surface — presentational phase)

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable; sonner is the only external moving part)
```
