# Phase 3: Layout Primitives + Bottombar — Research

**Researched:** 2026-06-12
**Domain:** Application chrome (CSS-Grid AppShell + responsive nav + keyboard-shortcut SSOT) for a Vite 8 / React 19 / Tailwind v4 / react-router 7 SPA under the Retro OS Pastel direction
**Confidence:** HIGH — almost everything here is grounded in the codebase itself (existing frontend2 Phase 1/2 code, working legacy `/frontend` reference implementations, locked Phase 2 tokens, and the validated sketch 006 chrome). Very little leans on training data.

## Summary

Phase 3 builds the shell every authenticated route lives in. The good news for planning: **this is overwhelmingly a port-and-restyle job, not a greenfield design job.** The legacy `/frontend` directory contains battle-tested, structurally-correct implementations of every behavioral primitive this phase needs — `shortcuts-context.tsx` (the `useShortcuts` SSOT), `bottombar.tsx` (chips + single keydown listener + dual clock), `use-keyboard-shortcuts-dialog.ts` (F1/`?` help), `use-fab-actions.tsx` (context-aware radial actions), and `floating-action-button.tsx` (polar-coordinate radial menu). Their **structure and behavior transfer verbatim**; only two things change: (1) all styling re-anchors to the Phase 2 retro-os tokens, and (2) Next.js/PWA/`motion` dependencies are stripped (react-router replaces `next/navigation`; CSS transitions replace `motion`, per the v2.2 D-decision already on record).

The sketch 006 HTML (`.planning/sketches/006-retro-os-dashboard/index.html`) is the canonical chrome reference and is **directly liftable as CSS patterns**: it already implements the menubar, the grouped Navigator sidebar, the active-item treatment, the user footer, and a ticking mono clock. The current frontend2 `Sidebar.tsx` (Phase 1) is already a faithful Tailwind port of that sketch's sidebar — Phase 3 extends it into a collapsible rail and wraps it in the grid shell rather than rewriting it.

The single genuinely new architectural decision is the **collapse mechanism**: SHELL-02 mandates a single `data-collapsed` attribute on the grid root with **zero JavaScript layout measurement**. This is a `grid-template-columns` swap driven by a CSS attribute selector — a well-trodden pattern with no library needed. The other care-areas are all about *correctness discipline*, not novelty: the `isEditableTarget` guard must ship in the first commit and be regression-tested across all four editable surfaces (INPUT/TEXTAREA/SELECT/contenteditable); the modal-stack ESC ordering must never let a bare ESC reach logout; and the clock must tick in an isolated leaf component so it doesn't re-render the whole shell every second.

**Primary recommendation:** Port the five legacy primitives verbatim for structure, restyle to Phase 2 tokens, strip Next/PWA/`motion`, drive collapse via `data-collapsed` + CSS grid-template swap, isolate the clock in its own leaf component, and write the `isEditableTarget` regression suite and the modal-stack ESC suite as Wave 0 before any chrome lands.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-05:** Mobile (<768px) renders FAB only, no Bottombar.
- **D-06:** Desktop (≥768px) renders Bottombar only, no FAB.
- **D-07:** FAB exposes context-aware radial menu — actions adapt per route.
- **D-08:** Bottombar and FAB both consume `useShortcuts` context as single source of truth.

### Direction re-anchor (CRITICAL — resolves stale ROADMAP reference)
- The ROADMAP Phase 3 goal text references "locked sketch 005 chrome" and premium-terminal vocabulary (`// GROUP` comment labels, `[KEY] LABEL` chips, `// ROUTE` breadcrumb). **Sketch 005 belongs to the SCRAPPED premium-terminal direction (sketches 001-005).** Per `.planning/sketches/MANIFEST.md`, the canonical direction is **Retro OS Pastel (006-008)**.
- **What survives verbatim (structure, direction-agnostic):** AppShell grid, TopBar/Sidebar/Bottombar/PageHeader composition, grouped sidebar (Overview/Inventory/System), collapse-to-rail, useShortcuts SSOT, isEditableTarget guard, F1/ESC modal-stack behavior, responsive drawer/FAB split, SESSION/LOCAL clocks.
- **What re-anchors to retro-os:** ALL visual treatment. Bevel system, pinstriped pastel title bars where windows appear, Silkscreen display type (≥16px, uppercase), Plex Sans body, Plex Mono data/clocks, semantic titlebar colors, 2px ink borders, hard sand shadows — per `themes/retro-os.css` tokens (Phase 2) and the sketch-findings skill hard rules. The terminal `//`-comment label affordance and `[KEY]` chip styling are re-interpreted as retro-os equivalents (e.g. beveled key-cap chips fit the System 7 idiom naturally; group labels styled as retro-os section labels). UI-SPEC owns the exact treatment.
- Success Criteria 1's literal `// OVERVIEW` / `// {ROUTE}` strings are part of the stale vocabulary — the OBSERVABLE truth to preserve: group labels exist and read as group labels; breadcrumb shows current route; meta line shows session/last-sync. Exact glyphs per UI-SPEC under retro-os.

### Tech approach (locked)
- Tailwind v4 utilities from Phase 2 tokens ONLY (`bg-bg-panel`, `text-fg-ink`, `gap-sp-*`, bevel/shadow tokens). No new hex literals, no new tokens without justification.
- Collapse state: `data-collapsed` attribute + CSS — no JS layout measurement.
- Clocks: one interval, mono font, tabular-nums (guarded by Phase 2 glyph test conventions).
- Keyboard handling: a single document-level listener owned by useShortcuts provider; per-route registration `useShortcuts(id, bindings)`; F1 + ESC are global bindings; modal stack is a small context (open/close push/pop).

### Claude's Discretion
- Exact grid template values, breakpoint plumbing (CSS media vs hook), FAB radial animation details, drawer implementation, icon placeholders (icon style is an OPEN deferred decision from Phase 2 — use minimal/text placeholders or simple geometric icons; do NOT lock an icon library this phase).
- Bottombar overflow strategy on narrow desktop (paginate vs sheet) — pick one, keep F1+ESC right-anchored (Success Criterion 5).

### Deferred Ideas (OUT OF SCOPE)
- Icon library lock (needs sketch 009 — carried from Phase 2 deferral). Use placeholders.
- Workspace switcher logic (Phase 5), SSE indicator wiring (Phase 6), notifications data (Phase 13) — slots only this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELL-01 | 2×3 CSS-Grid `AppShell` (`grid-template-areas: "topbar topbar" / "sidebar main" / "sidebar bottombar"`); sidebar full-height; bottombar spans only the main column. | Standard CSS Grid `grid-template-areas`. Note the SHELL-01 area string itself: sidebar spans rows 2-3, bottombar lives in `main` column row 3 only. See "Pattern 1: AppShell grid". HIGH. |
| SHELL-02 | Sidebar collapse = single `data-collapsed` attribute toggle on grid root — no JS layout/measure. | `[data-collapsed="true"]` CSS selector swaps `grid-template-columns` first track to the 60px rail. See "Pattern 2: CSS-only collapse". HIGH. |
| SHELL-03 | TopBar: brand mark (beveled square + "HOME WAREHOUSE"), workspace pill, ONLINE dot (SSE-bound), user pill+menu. | Slots reserved as placeholder components (workspace switcher Phase 5, SSE Phase 6). `BrandMark.tsx` already exists. Sketch 006 menubar is the chrome reference. HIGH. |
| SHELL-04 | Sidebar groups Overview/Inventory/System; per-route active indicator (left-border bevel + glow); collapses to icon-rail with badge-dot mode. | Existing `Sidebar.tsx` already implements groups + active treatment from sketch 006. Active-route via `react-router` `NavLink`/`useLocation`. Rail mode = same component, CSS-hidden labels. HIGH. |
| SHELL-05 | PageHeader: route breadcrumb + `SESSION {hh:mm:ss} // LAST SYNC {hh:mm:ss}` meta on every authed route. | Clock pattern lifted from legacy `bottombar.tsx`. LAST SYNC has no real source this phase (SSE is Phase 6) — render a placeholder/static value. MEDIUM (last-sync source deferred). |
| SHELL-06 | Mobile-responsive: sidebar → drawer at `<768px`; bottombar overflow keeps F1+ESC right-anchored, rest paged/overflow-sheet. | Drawer = off-canvas `<aside>` toggled by a state var; legacy used a Sheet. Overflow strategy is Claude's discretion. HIGH (drawer), MEDIUM (overflow strategy — pick one). |
| BAR-01 | Bottombar on every authed route: `[KEY] LABEL` chips for route + globals (F1 HELP) + right-side SESSION+LOCAL clock pair, updated every second. | Legacy `bottombar.tsx` is a verbatim structural port. HIGH. |
| BAR-02 | `useShortcuts(id, [{key,label,action,danger?}])` is SSOT — registers into a context indexed by `useId()`; bar reads context for BOTH render AND keydown. | Legacy `shortcuts-context.tsx` is the exact pattern (`register`/`unregister` keyed by id, `Object.values(groups).flat()`). HIGH. |
| BAR-03 | Keydown honors `isEditableTarget(e.target)` guard — single-letter shortcuts NEVER fire in input/textarea/select/contenteditable. Regression-test every form. | Legacy `isInputFocused` / `isInputField` exact pattern; extend to cover `closest('[contenteditable]')`. **Wave 0 regression suite.** HIGH. |
| BAR-04 | `[KEY]` chips use a theme-`primary`-equivalent token (amber-on-near-black under legacy → retro-os pastel key-cap under this direction). | Re-anchored: retro-os has no `primary` token; use a beveled key-cap (`bg-titlebar-*` + ink border) per UI-SPEC. `danger` variant → `bg-danger`. MEDIUM (exact treatment is UI-SPEC's call). |
| BAR-05 | F1 chip-click AND F1-keydown both open the shortcuts help dialog; ESC NOT bound to logout (confirm-before-logout via menu only). | Legacy `use-keyboard-shortcuts-dialog.ts` listens for `F1`/`?`; chip dispatches a synthetic F1 keydown. HIGH. |
| TUI-01 | Per-route shortcut sets via `useShortcuts(routeName, [...])`; Bottombar reflects active route's set without flicker on route change. | Register-on-mount/unregister-on-unmount in `useShortcuts` hook (the legacy effect pattern). Flicker-free because the context recomputes synchronously on the same render. HIGH. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AppShell grid layout | Browser/Client (CSS) | — | Pure CSS Grid; no server involvement. |
| Sidebar collapse | Browser/Client (CSS) | Client state (toggle) | `data-collapsed` is a single boolean in client state; CSS does all layout work. No measure phase, no API. |
| Active-route emphasis | Frontend Client (router) | — | `react-router` `useLocation`/`NavLink` owns active state. |
| `useShortcuts` SSOT | Client state (React context) | — | In-memory registry; document-level keydown listener. No persistence. |
| Keyboard dispatch + `isEditableTarget` guard | Browser/Client | — | DOM event target inspection; entirely client-side. |
| Modal-stack ESC ordering | Client state (context) | — | A push/pop stack in React context; ESC pops top. |
| SESSION/LOCAL clocks | Browser/Client | — | `setInterval` + `Date`; isolated leaf component. SESSION = elapsed since mount (login time is a Phase 5 concern). |
| FAB radial menu | Browser/Client (CSS transforms) | Router (navigation targets) | Polar-coordinate positioning via CSS `transform`; actions resolve to route pushes. |
| ONLINE dot / SSE status | **API/Backend (Phase 6)** | Client placeholder (this phase) | SSE wiring is Phase 6 — this phase renders a static/placeholder dot slot only. |
| Workspace pill | **API/Backend (Phase 5)** | Client placeholder (this phase) | Workspace switching logic is Phase 5 — slot only. |
| LAST SYNC value | **API/Backend (Phase 6)** | Client placeholder (this phase) | No real sync source until SSE (Phase 6); render placeholder. |

## Standard Stack

This phase adds **zero new runtime dependencies.** Everything is already installed from Phase 1, or is hand-built from the legacy reference with the existing stack. This is by design — the Phase 2 decisions ("fully custom component library", "FAB uses CSS transitions, not `motion`") forbid adding chrome/animation libraries.

### Core (already installed — verified in `frontend2/package.json`)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` / `react-dom` | ^19.2.5 | Component model, context, hooks (`useId`, `useEffect`, `useSyncExternalStore` if needed) | Project baseline. |
| `react-router` | ^7.14.2 | Routing, `useLocation`/`NavLink` for active-route, `useNavigate` for FAB actions | v2.0 locked decision: **library mode, NOT framework mode**. Note: v7 is the unified package — import from `"react-router"`, NOT `"react-router-dom"`. |
| `tailwindcss` + `@tailwindcss/vite` | ^4.2.4 | Utility styling against Phase 2 tokens | Phase 2 token contract; utilities like `bg-bg-panel`, `text-fg-ink`, `shadow-hard`, `gap-sp-*` already resolve. |
| `@lingui/react` (macro) | ^6.0.1 | `<Trans>` for all user-facing strings | i18n is a standing requirement; existing `Sidebar.tsx` already wraps labels in `<Trans>`. |

### Supporting (test-time, already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^4.1.5 | Unit/integration test runner | All component + hook tests. |
| `@testing-library/react` | ^16.3.2 | Render + query DOM | Component tests. |
| `@testing-library/user-event` | latest | Realistic keyboard/typing simulation | `isEditableTarget` guard tests (type into an input, fire a shortcut key, assert it did NOT fire). |
| `@playwright/test` | ^1.59.1 | E2E across chromium+firefox | One end-to-end shell smoke (login → shell renders → collapse toggles → F1 opens help). |

### Alternatives Considered (and rejected by locked decisions)
| Instead of | Could Use | Tradeoff / Why rejected |
|------------|-----------|----------|
| CSS transitions for FAB radial | `motion` (framer-motion) | v2.2 decision on record: "FAB uses CSS transitions, not `motion` — saves ~60kB gzip and matches retro aesthetic." Do NOT add it. |
| Hand-built drawer | a headless dialog/sheet lib (Radix, etc.) | v2.0 decision: "Fully custom component library — shadcn/ui fights retro aesthetic." Build the drawer from a positioned `<aside>` + overlay. |
| `lucide-react` icons | unicode glyph placeholders | Icon library lock is DEFERRED (needs sketch 009). Use the glyph placeholders already in `Sidebar.tsx` (▦ ▣ ⌗ etc.) or simple geometric squares. Do NOT install an icon library this phase. |
| `data-collapsed` CSS swap | JS `ResizeObserver` / measure-then-set-width | SHELL-02 explicitly forbids JS layout work. CSS attribute selector is the mandated approach. |

**Installation:** None. `cd frontend2 && bun install` is already satisfied; no `bun add` in this phase.

> **Version verification note:** All versions above are read directly from `frontend2/package.json` (the installed/locked set), not from training data. No registry lookup is needed because no new packages are introduced. The Package Legitimacy Audit is therefore N/A for this phase.

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** All work uses dependencies already present and locked in `frontend2/package.json` from Phases 1–2. No `bun add` / `npm install` step exists in this phase, so there is no slopcheck surface. If the planner discovers a need for a new package (it should not), that addition must be gated behind a `checkpoint:human-verify` task and run through the Package Legitimacy Gate before install.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
   keydown (document) ───▶│  ShortcutsProvider  (single document         │
                          │  listener; reads merged registry)            │
                          │    registry: { [useId]: Shortcut[] }         │
                          └───────┬───────────────────────┬─────────────┘
   route components             register/unregister     merged shortcuts
   call useShortcuts(id,[..]) ──▶  (on mount/unmount)         │
                                                              ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  AppShell (CSS Grid root, carries data-collapsed)                      │
   │  grid-template-areas: "topbar topbar"/"sidebar main"/"sidebar bottombar"│
   │                                                                        │
   │  ┌── topbar ──────────────────────────────────────────────────────┐   │
   │  │ BrandMark │ [workspace slot] │ ●ONLINE slot │ [user pill+menu]  │   │
   │  └────────────────────────────────────────────────────────────────┘   │
   │  ┌─ sidebar ─┐ ┌─ main ────────────────────────────────────────────┐  │
   │  │ Navigator │ │ PageHeader (breadcrumb + SESSION//LAST SYNC)       │  │
   │  │  groups   │ │ <Outlet/>  ← route content (registers shortcuts)   │  │
   │  │  active   │ │                                                    │  │
   │  │  collapse │ │ ┌─ bottombar (main col only, ≥768px) ───────────┐ │  │
   │  │  user ftr │ │ │ chips ◀reads merged shortcuts │ F1 │SESSION LOCAL│ │  │
   │  └───────────┘ └─└───────────────────────────────────────────────┘─┘  │
   └────────────────────────────────────────────────────────────────────────┘
        ▲                                              ▲
   <768px: sidebar→drawer, bottombar hidden,    ModalStackProvider
   FAB radial menu (reads same merged shortcuts) ESC pops top; only reaches
                                                 global handlers when stack empty
```

Two cross-cutting providers wrap the shell: **ShortcutsProvider** (the SSOT both Bottombar and FAB consume) and **ModalStackProvider** (ESC ordering). Both are context-only, in-memory, client-side. Route components register their shortcuts via `useShortcuts(id, [...])` on mount; the Bottombar and FAB both render from the merged registry.

### Recommended Project Structure
```
frontend2/src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # grid root, carries data-collapsed; composes the rest
│   │   ├── TopBar.tsx            # brand + reserved slots (workspace/SSE/user)
│   │   ├── Sidebar.tsx           # EXTEND existing: add collapse/rail + active-route
│   │   ├── Bottombar.tsx         # port of legacy; chips + clocks + keydown
│   │   ├── PageHeader.tsx        # breadcrumb + SESSION//LAST SYNC meta
│   │   ├── MobileDrawer.tsx      # <768px off-canvas sidebar
│   │   ├── Fab.tsx               # radial menu, CSS transforms (no motion)
│   │   ├── ShortcutChip.tsx      # the [KEY] LABEL key-cap
│   │   └── Clock.tsx             # ISOLATED leaf — owns the single interval
│   ├── shortcuts/
│   │   ├── ShortcutsContext.tsx  # SSOT: provider + register/unregister + merged list
│   │   ├── useShortcuts.ts       # hook: register(id, bindings) on mount; the keydown owner
│   │   └── isEditableTarget.ts   # the guard — its own module so the test imports it directly
│   ├── modal/
│   │   └── ModalStackContext.tsx # push/pop stack; ESC pops top
│   └── retro/                    # EXISTING barrel (Window, BevelButton, …) — reuse, don't duplicate
├── App.tsx                       # add ShortcutsProvider + ModalStackProvider to the stack
└── routes/index.tsx              # wrap authed routes in AppShell (layout route)
```

### Pattern 1: AppShell CSS Grid (SHELL-01)
**What:** A 2-column × 3-row grid using named areas. The sidebar spans rows 2–3; the bottombar occupies only the `main` column on row 3.
**When to use:** The single root layout for all authenticated routes.
**Example:**
```css
/* Source: SHELL-01 area string (REQUIREMENTS.md) + standard CSS Grid */
.app-shell {
  display: grid;
  min-height: 100dvh;
  grid-template-columns: 232px 1fr;            /* sidebar | main  */
  grid-template-rows: auto 1fr auto;           /* topbar | content | bottombar */
  grid-template-areas:
    "topbar  topbar"
    "sidebar main"
    "sidebar bottombar";
}
/* Children: */
.topbar    { grid-area: topbar; }
.sidebar   { grid-area: sidebar; }   /* spans rows 2-3 automatically */
.main      { grid-area: main; min-width: 0; }       /* min-width:0 — Silkscreen overflow guard (bitten in sketch 006) */
.bottombar { grid-area: bottombar; }                /* main column, row 3 only */
```
> Tailwind v4 can express this with arbitrary `grid-template-areas` utilities, OR define the grid in a small `@layer components` / `@utility` block in `globals.css` (consistent with how `.rtable`/`pinstripes` already live there). Either is acceptable per "exact grid template values = Claude's discretion." The `min-width: 0` on the main column is **load-bearing** — sketch 006 documents that Silkscreen values overflow grid children without it.

### Pattern 2: CSS-only collapse via `data-collapsed` (SHELL-02)
**What:** Toggle one attribute on the grid root; CSS swaps the first column track to the 60px rail and hides labels. Zero JS measurement.
**When to use:** Sidebar collapse/expand.
**Example:**
```css
/* Source: SHELL-02 (REQUIREMENTS.md) + CSS attribute-selector pattern */
.app-shell[data-collapsed="true"] {
  grid-template-columns: 60px 1fr;   /* rail width */
}
.app-shell[data-collapsed="true"] .nav-label,
.app-shell[data-collapsed="true"] .nav-count { display: none; }   /* icon-rail mode */
/* optional: transition the columns for a smooth collapse */
.app-shell { transition: grid-template-columns 150ms ease; }
```
```tsx
// React side: a single boolean, no measurement.
const [collapsed, setCollapsed] = useState(false);
return <div className="app-shell" data-collapsed={collapsed} >…</div>;
```
**Anti-pattern caught:** Do NOT `ResizeObserver` the sidebar or read `offsetWidth` to set a pixel width — SHELL-02 forbids it and it causes layout thrash. The attribute selector is the whole mechanism.

### Pattern 3: `useShortcuts` SSOT (BAR-02, TUI-01, D-08)
**What:** A context holding a registry keyed by `useId()`. Route components register their bindings on mount and unregister on unmount. Both the Bottombar and the FAB render from `Object.values(registry).flat()`. A single document-level keydown listener (owned by the provider or the Bottombar — see Pitfall 2) dispatches matching keys.
**When to use:** Every shortcut in the app, both rendering and dispatch.
**Example (port of legacy `shortcuts-context.tsx` — structurally verbatim):**
```tsx
// Source: frontend/components/layout/shortcuts-context.tsx (legacy, working)
export interface Shortcut { key: string; label: string; action: () => void; danger?: boolean; }

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Record<string, Shortcut[]>>({});
  const register   = useCallback((id: string, s: Shortcut[]) =>
    setGroups(p => ({ ...p, [id]: s })), []);
  const unregister = useCallback((id: string) =>
    setGroups(p => { if (!(id in p)) return p; const n = { ...p }; delete n[id]; return n; }), []);
  const shortcuts  = useMemo(() => Object.values(groups).flat(), [groups]);
  const value = useMemo(() => ({ shortcuts, register, unregister }), [shortcuts, register, unregister]);
  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

// The route-facing hook (BAR-02 signature: useShortcuts(id, bindings)):
export function useShortcuts(id: string, bindings: Shortcut[]) {
  const { register, unregister } = useShortcutsContext();
  // register on mount / when bindings change; unregister on unmount.
  useEffect(() => {
    register(id, bindings);
    return () => unregister(id);
  }, [id, bindings, register, unregister]);  // see Pitfall 3 re: bindings identity
}
```
> **Signature note:** BAR-02 specifies the registry is "indexed by `useId()`". The legacy version takes an arbitrary string id. To match the requirement, the hook should default the id from `useId()` when the caller relies on it, OR callers pass a stable route name (TUI-01 says `useShortcuts(routeName, [...])`). Either reading satisfies the requirement; the planner should pick one and document it. The **stable-id** requirement is what prevents flicker on route change (TUI-01) — a stable key means React reconciles rather than unmount/remount-flashing the chip row.

### Pattern 4: `isEditableTarget` guard (BAR-03) — ship in the FIRST commit
**What:** Before dispatching any single-letter shortcut, inspect the event target. If it is an editable surface, bail.
**Example (extend the legacy `isInputField` to cover nested contenteditable):**
```tsx
// Source: frontend/lib/hooks/use-keyboard-shortcuts.ts isInputField (legacy) + CONTEXT.md §specifics
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null   // nested contenteditable (CONTEXT.md §specifics)
  );
}
```
> Keep this in its own module so the regression suite imports the pure function directly and can also drive it through real DOM via `user-event`. CONTEXT.md mandates regression-testing **all four surfaces**.

### Pattern 5: Modal-stack ESC ordering (TUI-02, BAR-05)
**What:** A push/pop stack in context. Every overlay (dialog, drawer, menu, FAB-open) pushes a closer on open and pops on close. A global ESC handler pops the **topmost** entry first; only when the stack is empty may ESC reach other handlers. Logout is NEVER bound to bare ESC.
**Example shape:**
```tsx
// Source: TUI-02 + CONTEXT.md §specifics (modal stack provider)
interface ModalStackValue { push(close: () => void): symbol; pop(token: symbol): void; }
// Global handler (lives once, in the provider):
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (stackRef.current.length === 0) return;   // nothing open → ESC is a no-op here
    e.preventDefault();
    stackRef.current[stackRef.current.length - 1].close();   // pop the TOP
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, []);
```
> The legacy `floating-action-button.tsx` and the search header each had their *own* ESC handler — acceptable in isolation but they would race if combined. The modal-stack provider centralizes the ordering. The FAB, drawer, and F1 dialog should all push onto this one stack.

### Pattern 6: Isolated ticking Clock (BAR-01, SHELL-05)
**What:** A single leaf component owns one `setInterval`; it re-renders only itself each second, not the shell.
**Example (port of legacy `bottombar.tsx` clock, extracted to a leaf):**
```tsx
// Source: frontend/components/layout/bottombar.tsx (legacy clock effect, isolated)
export function Clock() {
  const [time, setTime] = useState<{ start: number; now: Date } | null>(null);
  useEffect(() => {
    const start = Date.now();
    setTime({ start, now: new Date() });
    const id = setInterval(() => setTime(p => p ? { start: p.start, now: new Date() } : p), 1000);
    return () => clearInterval(id);
  }, []);
  // SESSION = elapsed since mount (login-time source is Phase 5); LOCAL = wall clock.
  // Render with font-mono tabular-nums (CONTEXT.md §specifics + Phase 2 glyph conventions).
}
```
> **Performance discipline:** the interval and its state MUST live in this leaf. If the clock state lived in `AppShell`, every tick would re-render the entire chrome (and re-run the shortcut keydown effect). Two clock instances (Bottombar + PageHeader) are fine — each owns its own interval, or share one via a tiny `useClock()` hook backed by a single module-level interval if you want to avoid two timers.

### Pattern 7: FAB radial menu without an animation library (D-07, SHELL-06)
**What:** Polar-coordinate positioning of action items around the FAB, animated with CSS `transform` + `transition` (NOT `motion`).
**Example (port of legacy `floating-action-button.tsx` math, CSS transitions):**
```tsx
// Source: frontend/components/fab/floating-action-button.tsx (polar math; strip motion + lucide + next)
const getPos = (i: number, n: number, radius = 80, start = -Math.PI/2, arc = Math.PI/2) => {
  const angle = n === 1 ? start : start - (arc / (n - 1)) * i;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};
// Closed: items at translate(0,0) opacity:0 pointer-events:none.
// Open:   translate(x, y) opacity:1, with `transition: transform 180ms, opacity 180ms`.
```
> The legacy actions come from `useFABActions()` (context-aware per route). Under D-08 the FAB consumes the **same `useShortcuts` registry** as the Bottombar — so the FAB's actions should derive from the merged shortcut list (or a route-keyed subset), not a separate `useFABActions` source. Reconcile: the SSOT is `useShortcuts`; `useFABActions` is the legacy *shape* to learn from, not a second source of truth.

### Anti-Patterns to Avoid
- **JS layout measurement for collapse** — forbidden by SHELL-02. Use `data-collapsed` + CSS only.
- **Clock state in the shell root** — re-renders the whole chrome every second. Isolate in a leaf.
- **Per-overlay independent ESC handlers** — they race and can let ESC fall through to the wrong target. Centralize via the modal stack.
- **Binding logout to bare ESC** — explicitly forbidden (BAR-05). Logout is confirm-before via the user menu only.
- **`react-router-dom` imports** — v7 unified the package; import from `"react-router"` (the existing code already does).
- **Raw hex / new tokens** — Phase 2 tokens only. No `bg-[#...]`. The `lint:imports` guard + token discipline apply.
- **Adding `motion` / `lucide-react` / a sheet library** — all rejected by locked v2.0/v2.2 decisions.
- **Silkscreen below 16px or in body copy / chip labels** — hard rule 1. Chip `[KEY]` glyphs and labels are small → use Plex Mono/Sans, not Silkscreen. Silkscreen is display-only (titlebars, brand, stat values).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shortcut registry + merge | A bespoke event-bus | Port legacy `shortcuts-context.tsx` (React context + keyed registry) | Already solved, tested in production, exact SSOT shape BAR-02 wants. |
| Input-focus guard | Ad-hoc `if (tag==='INPUT')` sprinkled at call sites | The single `isEditableTarget` module | One guard, one test surface, covers all four editable types incl. nested contenteditable. |
| Active-route detection | Manual `window.location.pathname` parsing | `react-router` `useLocation` / `NavLink` `isActive` | Router owns this; handles trailing slashes, nested routes, basename. |
| Radial-menu animation | Importing `motion`/`framer-motion` | CSS `transform`/`transition` + the legacy polar math | Saves ~60kB gzip; matches retro aesthetic; locked decision on record. |
| Collapse layout | `ResizeObserver` + measured widths | `data-collapsed` attribute + CSS `grid-template-columns` swap | SHELL-02 mandates no JS measure; CSS is simpler and flicker-free. |
| Clock formatting | A date library | `Date` + `padStart` (legacy `formatHHMMSS`) | Trivial; no dependency warranted. |
| Drawer overlay | A modal/sheet library | Positioned `<aside>` + scrim + the modal stack | "Fully custom component library" decision; headless libs fight the retro chrome. |

**Key insight:** The legacy `/frontend` tree is the single most valuable resource for this phase. Five of the seven primitives already exist there in correct, production-tested form. The phase's risk is NOT "can we build these" — it is "do we restyle to tokens, strip Next/PWA/motion, and preserve the guard discipline (isEditableTarget from commit 1, modal-stack ESC ordering) without regressing." Plan the port + regression suite, not a redesign.

## Common Pitfalls

### Pitfall 1: `isEditableTarget` shipped late (or incomplete)
**What goes wrong:** Single-letter shortcuts (e.g. "N" for new) fire while the user types "N" into a search box or item name field, navigating away mid-edit and losing input.
**Why it happens:** The guard is bolted on after chips work, or it omits `contenteditable` / nested-contenteditable.
**How to avoid:** Ship `isEditableTarget` in the FIRST commit that adds keydown dispatch (CONTEXT.md: "from the FIRST commit"). Write the regression suite (all four surfaces) as Wave 0 before chrome. Cover `closest('[contenteditable="true"]')` for nested rich-text.
**Warning signs:** A shortcut test that only checks INPUT; a keydown handler with no target check.

### Pitfall 2: Duplicate / leaked keydown listeners (StrictMode + multiple owners)
**What goes wrong:** Two document-level keydown listeners (e.g. one in the provider AND one in the Bottombar, as the legacy had) both fire → shortcut actions run twice; or a missing cleanup leaks a listener on every route change. Under React 19 StrictMode (dev), effects mount→unmount→remount, exposing missing cleanups as double-fires.
**Why it happens:** The legacy split the listener between `bottombar.tsx` and `use-keyboard-shortcuts-dialog.ts`; combining naively yields multiple owners. Missing `return () => removeEventListener(...)`.
**How to avoid:** Designate **one** owner of the dispatch listener (the provider). Always return a cleanup from the effect. F1/`?` and ESC are global bindings owned by their respective providers (help-dialog, modal-stack) — keep exactly one listener each. Test by asserting an action fires exactly once. [VERIFIED: github.com/facebook/react/issues/25614 — StrictMode double-invoke is intentional and surfaces missing cleanups; correct cleanup makes it a no-op in production.]
**Warning signs:** Action runs twice in dev; listener count grows in DevTools across navigations.

### Pitfall 3: Stale-closure shortcuts / register churn
**What goes wrong:** `useShortcuts(id, bindings)` re-registers on every render because `bindings` is a fresh array literal each time → the registry thrashes, the keydown sees stale actions, or the chip row flickers (violates TUI-01 "without flicker").
**Why it happens:** Callers pass an inline `[{ key:"N", action: () => nav("/new") }]` that has a new identity every render; the register effect depends on it.
**How to avoid:** Either (a) the legacy `useRef(shortcuts)` + effect-sync pattern (keeps a stable handler reading current bindings), or (b) require callers to `useMemo` their bindings, or (c) register by stable id and compare by value. The legacy `use-keyboard-shortcuts.ts` uses the `shortcutsRef` pattern specifically to "avoid recreating handler on every render" — port that discipline.
**Warning signs:** Chip row flashes on route change; shortcut fires the previous route's action.

### Pitfall 4: ESC reaches logout / wrong handler when a modal is open
**What goes wrong:** User opens the F1 help dialog (or FAB), hits ESC expecting to close it, and instead a route-level ESC handler (or, worse, a logout) fires.
**Why it happens:** Independent ESC handlers with no ordering; ESC bound somewhere it shouldn't be.
**How to avoid:** Single modal-stack provider; ESC pops the top entry and stops; only an empty stack lets ESC propagate. NEVER bind logout to bare ESC (BAR-05). Test: open dialog → ESC closes dialog only; with stack empty → ESC does NOT log out.
**Warning signs:** ESC closes two things at once; ESC logs out unexpectedly.

### Pitfall 5: Whole-shell re-render every second (clock not isolated)
**What goes wrong:** The clock's `setInterval` setState lives in `AppShell`, so the entire chrome (and the shortcut keydown effect, and the sidebar) re-renders every second.
**Why it happens:** Convenience — putting the clock state at the top.
**How to avoid:** Isolate clock state in a `<Clock/>` leaf (Pattern 6). The shell never re-renders on tick. Use `tabular-nums` + Plex Mono so digits don't reflow.
**Warning signs:** React DevTools Profiler shows the whole tree re-rendering on a 1s cadence.

### Pitfall 6: Silkscreen used for small chrome (chips, labels, counts)
**What goes wrong:** `[KEY]` chip labels or nav counts rendered in Silkscreen → illegible below 16px, fails the AA/glyph conventions, breaks hard rule 1.
**Why it happens:** Reaching for the "retro" display font everywhere.
**How to avoid:** Silkscreen is display-only (titlebars, brand mark, stat values, ≥16px, uppercase). Chip keys/labels, nav items, counts, clocks → Plex Sans / Plex Mono. The existing `Sidebar.tsx` already follows this (nav items are `text-[13px]`, counts are `font-mono text-[11px]`).
**Warning signs:** `font-display` on anything under 16px or on body/data text.

### Pitfall 7: Vite `/api` proxy rewrite is load-bearing (don't regress it)
**What goes wrong:** Shell wiring touches `vite.config.ts` and drops the `/api` → root rewrite; `RequireAuth`'s `/users/me/workspaces` probe (and every future API call) 404s.
**Why it happens:** The Phase 1 scaffold already dropped it once by accident (per the config comment).
**How to avoid:** Don't touch the proxy. If you must, preserve `rewrite: (p) => p.replace(/^\/api/, "")` + `changeOrigin: true` (cookie binding). The login-dashboard E2E spec guards this contract — run it.
**Warning signs:** API calls 404 against `/api/...`; login E2E fails.

## Common Code Examples

### Active-route nav item (SHELL-04) with react-router
```tsx
// Source: react-router v7 NavLink (library mode) + existing Sidebar.tsx structure
import { NavLink } from "react-router";
<NavLink
  to="/items"
  className={({ isActive }) =>
    `${base} ${isActive ? "border border-border-ink bg-titlebar-blue shadow-hard-ink" : "border-transparent hover:bg-bg-panel-2"}`
  }
>
  {/* glyph + label + count; label/count get .nav-label/.nav-count for rail-mode hiding */}
</NavLink>
```
> The existing `Sidebar.tsx` hardcodes `active` as a prop; SHELL-04 wants per-route active. Swap the `<Link active>` branch for `<NavLink>` with the `isActive` render-prop. Disabled/not-yet-built destinations keep the existing `aria-disabled` div treatment.

### Bottombar chip + keydown (BAR-01/02/03/04) — port shape
```tsx
// Source: frontend/components/layout/bottombar.tsx (restyle to tokens; one keydown listener)
const { shortcuts } = useShortcutsContext();
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(e.target)) return;                 // BAR-03 guard
    const match = shortcuts.find(s => s.key.toUpperCase() === e.key.toUpperCase());
    if (!match) return;
    e.preventDefault(); match.action();
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [shortcuts]);
// Render: hidden md:flex (≥768px only, D-06); chips + F1 + <Clock/> right-anchored.
```

## State of the Art

| Old Approach (legacy `/frontend`) | Current Approach (frontend2) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next/navigation` `useRouter`/`usePathname` | `react-router` v7 `useNavigate`/`useLocation` | v3.0 rebuild | FAB/active-route plumbing swaps router API; structure identical. |
| `react-router-dom` (v6 split packages) | `react-router` v7 unified package | RR v7 | Import from `"react-router"`. |
| `motion`/framer-motion FAB | CSS `transform`/`transition` | v2.2 decision | −60kB gzip; manual polar math + CSS. |
| `lucide-react` icons | unicode glyph placeholders (icon lib deferred) | v3.0 (sketch 009 pending) | No icon dependency this phase. |
| Tailwind v3 semantic tokens (`bg-primary`, `text-foreground`) | Tailwind v4 `@theme inline` retro tokens (`bg-titlebar-blue`, `text-fg-ink`) | Phase 2 | Chip `bg-primary` → retro key-cap; no `primary` token exists. |
| PWA/offline/SSE wired into shell | online-only; SSE deferred to Phase 6; slots only | v3.0 | TopBar reserves slots; no SSE/PWA imports (CI grep guard forbids offline imports). |

**Deprecated/outdated for this phase:**
- Premium-terminal vocabulary (`// GROUP` amber labels, `[KEY]` amber-on-black chips, sketch 005) — superseded by retro-os. Observable behavior survives; visual treatment re-anchors.
- `useFABActions` as a *second* source of truth — under D-08 the FAB consumes the `useShortcuts` SSOT; the legacy hook is a shape reference only.

## Runtime State Inventory

> This is a greenfield chrome phase (new components + CSS), not a rename/refactor/migration. No stored data, live-service config, OS-registered state, secrets, or build artifacts carry a renamed string.
>
> **Stored data:** None — chrome holds no persistent state. (Sidebar collapse could optionally persist to `localStorage`, but that is net-new and out of scope unless the planner adds it; no migration concern.)
> **Live service config:** None.
> **OS-registered state:** None.
> **Secrets/env vars:** None.
> **Build artifacts:** None beyond normal Vite output.
>
> **Nothing found in any category — verified: Phase 3 adds React components + CSS utilities only, touches no datastore, service, or OS registration.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (jsdom) + @testing-library/react 16.3.2 + user-event; Playwright 1.59.1 for E2E |
| Config file | `frontend2/vitest.config.ts` (jsdom, globals, setup `src/test-utils.tsx`, excludes `**/e2e/**`); `frontend2/playwright.config.ts` (chromium+firefox) |
| Quick run command | `cd frontend2 && bunx vitest run <path>` (single file) or `bun run test` (full unit) |
| Full suite command | `cd frontend2 && bun run test` (unit) + `bun run lint:tsc` + `bun run lint:imports` + `bun run build`; E2E via `bun run test:e2e` (needs dev stack per CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BAR-03 | `isEditableTarget` returns true for INPUT/TEXTAREA/SELECT/contenteditable, false otherwise; single-letter shortcut does NOT fire while typing in each surface | unit + integration | `bunx vitest run src/components/shortcuts/isEditableTarget.test.ts` | ❌ Wave 0 |
| BAR-02 / TUI-01 | `useShortcuts(id,[...])` registers on mount, unregisters on unmount; merged list = union of registered groups; re-registering same id replaces; no flicker (stable id) | unit (hook via RTL) | `bunx vitest run src/components/shortcuts/useShortcuts.test.tsx` | ❌ Wave 0 |
| BAR-01 / BAR-04 | Bottombar renders a chip per merged shortcut + F1; matching keydown fires the action exactly once; chips use retro key-cap (not Silkscreen) | integration | `bunx vitest run src/components/layout/Bottombar.test.tsx` | ❌ Wave 0 |
| BAR-05 | F1 keydown AND F1 chip-click both open help dialog; ESC does NOT trigger logout | integration | `bunx vitest run src/components/layout/Bottombar.test.tsx` | ❌ Wave 0 |
| TUI-02 | Modal stack: ESC pops topmost overlay first; with two overlays open ESC closes the top one only; empty stack → ESC is a no-op for logout | integration | `bunx vitest run src/components/modal/ModalStack.test.tsx` | ❌ Wave 0 |
| SHELL-02 | Toggling collapse sets `data-collapsed="true"` on the grid root (assert attribute, NOT pixel width — JSDOM has no layout) | integration | `bunx vitest run src/components/layout/AppShell.test.tsx` | ❌ Wave 0 |
| SHELL-04 | Active route gets `aria-current="page"` / active class; non-built destinations render `aria-disabled` | integration | `bunx vitest run src/components/layout/Sidebar.test.tsx` | ❌ Wave 0 |
| SHELL-06 / D-05/D-06 | Responsive split — assert the `hidden md:flex` (Bottombar) / `md:hidden` (FAB) class contract is present (CSS media query itself is E2E/manual, JSDOM can't evaluate media) | integration (class assertion) + E2E (visual) | `bunx vitest run src/components/layout/AppShell.test.tsx`; E2E viewport toggle | ❌ Wave 0 |
| Pitfall 5 | Clock ticks update only the Clock leaf, not the shell (assert via render-count spy or that shell render count stays 1 across a fake-timer tick) | unit (fake timers) | `bunx vitest run src/components/layout/Clock.test.tsx` | ❌ Wave 0 |
| SHELL-01..06 end-to-end | login → shell renders → collapse toggles → F1 opens help → ESC closes it | E2E (Playwright) | `cd frontend2 && bun run test:e2e` (extend existing `login-dashboard.spec.ts`) | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** `bunx vitest run <touched test file>` + `bun run lint:tsc`
- **Per wave merge:** `bun run test` (full unit) + `bun run lint:imports`
- **Phase gate:** Full unit suite green + `bun run build` clean + E2E shell smoke green (dev stack up) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/shortcuts/isEditableTarget.test.ts` — BAR-03, all four editable surfaces (the headline regression suite; CONTEXT.md demands it)
- [ ] `src/components/shortcuts/useShortcuts.test.tsx` — BAR-02/TUI-01 register/unregister/merge/no-flicker
- [ ] `src/components/modal/ModalStack.test.tsx` — TUI-02 ESC pop ordering + logout-never-on-ESC
- [ ] `src/components/layout/Bottombar.test.tsx` — BAR-01/04/05 chips, keydown-fires-once, F1
- [ ] `src/components/layout/AppShell.test.tsx` — SHELL-02 `data-collapsed` attribute, responsive class contract
- [ ] `src/components/layout/Sidebar.test.tsx` — SHELL-04 active/disabled (extend existing component)
- [ ] `src/components/layout/Clock.test.tsx` — isolated-tick / no-shell-rerender (fake timers)
- [ ] Extend `frontend2/e2e/login-dashboard.spec.ts` — shell-render + collapse + F1/ESC smoke
- [ ] **JSDOM caveat (document for the planner):** JSDOM does not perform layout or evaluate `@media`. Collapse/responsive tests assert **attributes and class strings**, not computed widths or media-query results. True responsive behavior (drawer vs bottombar at breakpoint) belongs in the Playwright E2E with viewport sizing, not unit tests.

## Environment Availability

> Phase 3 is a pure frontend code/CSS change. The only external dependencies are the existing dev stack (already documented in CLAUDE.md) and they are only needed for the E2E smoke, not for unit tests or the build.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun (runner for scripts) | all frontend2 scripts | assumed ✓ (project standard) | — | `npm`/`npx` equivalents exist but project standardizes on bun |
| Vite dev server (:5173) | E2E smoke only | on demand | 8.x (installed) | unit tests + build need no running server |
| Go backend (:8080) | E2E smoke only (login + `/users/me/workspaces`) | on demand (CLAUDE.md runbook) | — | unit/integration tests mock fetch; E2E is the only consumer |
| Postgres (:5432) | E2E smoke only (seeded user) | on demand (`docker compose up -d postgres`) | — | N/A for unit tests |
| Playwright browsers (chromium+firefox) | E2E only | installed (`@playwright/test`) | 1.59.1 | — |

**Missing dependencies with no fallback:** None. The phase's unit tests + `tsc` + `build` run with zero external services.
**Missing dependencies with fallback:** The E2E shell smoke needs the full dev stack (backend + Postgres + dev server) per the CLAUDE.md runbook; if unavailable in CI, the unit suite + build gate the phase and the E2E runs locally / when the stack is up (matches the existing `login-dashboard.spec.ts` posture: "no webServer, expects dev stack running").

## Security Domain

> `security_enforcement` is not set to `false` in config (absent = enabled), so this section is included. Phase 3 is chrome — it handles no credentials, no data persistence, no new network surface. Security exposure is minimal but two items are genuinely relevant.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | indirect | Auth is Phase 5; this phase's `RequireAuth` already gates the shell on the workspaces probe. Do not weaken it. The user-menu logout must be confirm-before (BAR-05), never reachable via bare ESC. |
| V3 Session Management | no | No session handling here; cookie/JWT is Phase 5. The SESSION clock is cosmetic (elapsed-since-mount), not a security timer. |
| V4 Access Control | no | No new authorization surface; nav to not-yet-built routes renders disabled, doesn't enforce access. |
| V5 Input Validation | minimal | No forms in chrome. The one input-adjacent concern is the keyboard dispatcher: the `isEditableTarget` guard is a UX-correctness control (prevents shortcut interference while typing), not a security control. |
| V6 Cryptography | no | None. |
| V7 / V14 (error handling, config) | minor | Do not log session/user PII to console in the shell; the legacy header had `console.log("Selected:", result)` — do not port debug logs. |

### Known Threat Patterns for {React SPA chrome}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Glyph/label rendered from user/workspace data (e.g. user initial, workspace name in pill) | Tampering/XSS | React auto-escapes JSX text — keep names in `{}` expressions, never `dangerouslySetInnerHTML`. The existing `Sidebar.tsx` renders `user.full_name`/`user.email` as escaped text (correct). |
| Shortcut action navigating to an attacker-influenced route | Tampering | Shortcut `action`s are app-defined closures, not data-driven from URLs — keep them static; do not build `action` from untrusted strings. |
| ESC/keyboard handler accidentally triggering destructive action (logout) | Denial of Service (self-inflicted) / EoP-adjacent | Modal-stack ordering + never-bind-logout-to-ESC (TUI-02, BAR-05). |
| Listener leak (keydown) | Resource exhaustion (minor) | Effect cleanup discipline (Pitfall 2). |

## Project Constraints (from CLAUDE.md)

The frontend2-relevant directives extracted from the project CLAUDE.md (note: the global `~/CLAUDE.md` describes a different project — ROT-MUD — and is NOT authoritative for this repo; the repo-root and frontend2 conventions govern):

- **Vite `/api` → root rewrite is load-bearing** — `rewrite: (p) => p.replace(/^\/api/, "")` + `changeOrigin: true`. Backend routes live at root; the `/api` prefix is frontend-only. Do not regress (Pitfall 7). Guarded by `login-dashboard.spec.ts`.
- **Auth contract for E2E:** `/login` → fill Email+Password → submit; after login `access_token` is an HTTP cookie inherited by both page context and `page.request`. Single submit button this phase (OAuth buttons return Phase 5).
- **E2E runbook:** Postgres (`docker compose up -d postgres`, db `warehouse_dev`) + backend (`go run ./cmd/server/main.go`, :8080) + frontend (`bun run dev`, :5173) + seeder user (`E2E_USER`/`E2E_PASS`). Specs in `frontend2/e2e/*.spec.ts` run in chromium+firefox.
- **`lint:imports` CI grep guard** — forbids `idb`/`serwist`/`offline`/`sync` imports (online-only). The shell must not import any offline/PWA/service-worker code (the legacy `dashboard-shell.tsx` was full of `OfflineProvider`/`PendingUploadsIndicator`/PWA — strip ALL of it on port).
- **Retro-os hard rules (sketch-findings skill):** Silkscreen display-only ≥16px uppercase; pastel fills carry ink text only (colored text uses `*-deep`); `--fg-faint` decorative/disabled only; radii 0 except badges (2px); every text pair ≥4.5:1 (enforced by `tokens.test.ts`).
- **Token discipline (Phase 2):** use Tailwind utilities mapped from `tokens.css` (`bg-bg-panel`, `text-fg-ink`, `shadow-hard`, `p-sp-*`, `rounded-chip`); no raw hex, no new tokens without justification.
- **Retro barrel:** all retro primitives import through `@/components/retro`; new layout components compose those, don't duplicate Window/BevelButton/etc.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SESSION clock = elapsed-since-mount this phase (real login-time source is Phase 5/auth) | Pattern 6, SHELL-05 | Low — CONTEXT.md §specifics explicitly states "or app mount as fallback this phase"; planner confirms. |
| A2 | LAST SYNC has no real data source until SSE (Phase 6) → render a static/placeholder value | SHELL-05 | Low — SSE is out of scope per CONTEXT; placeholder is the only honest option. Planner should confirm placeholder treatment with UI-SPEC. |
| A3 | The FAB derives its actions from the `useShortcuts` SSOT (D-08), not a separate `useFABActions` source | Pattern 7, D-07/D-08 | Medium — D-08 says both consume `useShortcuts`; the legacy `useFABActions` is a separate hook. If the planner wants per-route FAB actions richer than the chip set, a route→subset mapping on top of the SSOT is needed. Reconcile during planning. |
| A4 | BAR-04's "amber-on-near-black under retro" re-anchors to a beveled pastel key-cap (no `primary` token exists in retro-os) | BAR-04 | Low — direction re-anchor in CONTEXT.md explicitly hands chip treatment to UI-SPEC; this is the natural retro mapping. |
| A5 | `bun` is the canonical runner (CLAUDE.md uses `bun run` throughout) | Validation Architecture | Low — confirmed by CLAUDE.md commands and `package.json` scripts referencing bun. |
| A6 | Bottombar overflow strategy (paginate vs sheet) is genuinely open — pick one, keep F1+ESC right-anchored | SHELL-06 | Low — explicitly Claude's discretion in CONTEXT.md. |

**Note:** Assumptions A1, A2, A4, A5, A6 are low-risk and supported by CONTEXT.md text. A3 (FAB↔SSOT reconciliation) is the one worth an explicit planner decision.

## Open Questions (RESOLVED)

<!-- RESOLVED 2026-06-12 (orchestrator, autonomous run): (1) FAB derives actions from useShortcutsContext SSOT — no second action source (D-08); (2) LAST SYNC renders an em-dash "—" placeholder until Phase 6 SSE lands, slot markup stable; (3) useShortcuts accepts caller-supplied id with useId() fallback. Baked into plans 03-01/03-04/03-05. -->

1. **FAB actions vs `useShortcuts` SSOT reconciliation (D-07 + D-08)**
   - What we know: D-08 says both Bottombar and FAB consume `useShortcuts`. D-07 says FAB actions adapt per route. Legacy had a separate `useFABActions`.
   - What's unclear: Whether the FAB shows exactly the route's registered shortcuts as radial items, or a curated subset/superset (the legacy FAB had scan/add/quick-capture/wishlist — some of which aren't keyboard shortcuts).
   - Recommendation: Treat `useShortcuts` as the SSOT; FAB renders the route's registered shortcuts (those with a sensible touch action) as radial items. If a richer mobile-only action is needed, register it into the same SSOT under the route's id with a flag — keep ONE source. Decide in planning.

2. **LAST SYNC placeholder treatment (SHELL-05)**
   - What we know: meta line shows `SESSION ... // LAST SYNC ...`; real sync source is SSE (Phase 6).
   - What's unclear: What to render before Phase 6 — a static "—", the app-mount time, or hide the LAST SYNC segment until SSE lands.
   - Recommendation: Render a visible placeholder (e.g. `LAST SYNC --:--:--` or the mount time) so the meta-line layout is locked now and Phase 6 swaps the data source without a layout change. Confirm with UI-SPEC.

3. **`useShortcuts` id source — `useId()` vs route name (BAR-02 vs TUI-01)**
   - What we know: BAR-02 says "indexed by `useId()`"; TUI-01 says `useShortcuts(routeName, [...])`.
   - What's unclear: Whether the id is auto-generated (`useId()`) or caller-supplied (route name).
   - Recommendation: Accept a caller-supplied stable id (route name) for flicker-free re-registration (TUI-01), defaulting to `useId()` when omitted. This satisfies both readings. Lock in planning.

## Sources

### Primary (HIGH confidence — codebase + locked artifacts)
- `frontend2/package.json` — installed dependency versions (no new deps this phase)
- `frontend2/src/App.tsx`, `routes/index.tsx`, `features/auth/RequireAuth.tsx` — current provider stack + route composition
- `frontend2/src/components/layout/Sidebar.tsx` — existing Navigator sidebar (sketch 006 port, extend not rewrite)
- `frontend2/src/components/retro/Window.tsx` + `index.ts` (barrel) — reusable chrome primitives
- `frontend2/src/styles/tokens.css` — Phase 2 token contract (`@theme inline`)
- `frontend2/src/styles/globals.css` — existing `@utility` (bevel-raised, pinstripes) + `.rtable` component layer
- `frontend2/vitest.config.ts`, `playwright.config.ts`, `vite.config.ts` — test + proxy config
- `frontend/components/layout/shortcuts-context.tsx` — **the `useShortcuts` SSOT reference (verbatim structure)**
- `frontend/components/layout/bottombar.tsx` — chips + single keydown listener + dual clock (verbatim structure)
- `frontend/lib/hooks/use-keyboard-shortcuts.ts` — `isInputField` guard + `shortcutsRef` stale-closure pattern
- `frontend/lib/hooks/use-keyboard-shortcuts-dialog.ts` — F1/`?` help dialog listener
- `frontend/lib/hooks/use-fab-actions.tsx` + `frontend/components/fab/floating-action-button.tsx` — context-aware actions + polar-coordinate radial math
- `frontend/components/dashboard/dashboard-shell.tsx`, `header.tsx` — shell composition (strip Next/PWA/SSE/motion on port)
- `.planning/sketches/006-retro-os-dashboard/index.html` — **canonical chrome reference (menubar, sidebar, active item, user footer, ticking clock — directly liftable as CSS)**
- `.planning/sketches/MANIFEST.md` + `.claude/skills/.../SKILL.md` + `references/layout.md` — retro-os locked decisions + hard rules
- `.planning/REQUIREMENTS.md` (SHELL/BAR/TUI rows), `.planning/STATE.md` (D-05..D-08), `03-CONTEXT.md` — phase scope

### Secondary (MEDIUM confidence — verified web)
- React 19 StrictMode double-invoke / listener cleanup behavior — [github.com/facebook/react/issues/25614](https://github.com/facebook/react/issues/25614), [pockit.tools React 19 StrictMode guide](https://pockit.tools/blog/react-19-useeffect-strict-mode-guide/) — confirms intentional double-mount surfaces missing cleanups; correct cleanup is a production no-op.

### Tertiary (LOW confidence)
- None — every claim is grounded in the codebase or an authoritative source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all versions read from installed `package.json`.
- Architecture (grid, collapse, SSOT, modal-stack, clock, FAB): HIGH — five of seven primitives have working legacy references; grid/collapse are standard CSS mandated by the requirements; sketch 006 validates the chrome.
- Pitfalls: HIGH — derived from the legacy code's own patterns + a verified React 19 StrictMode source.
- BAR-04 chip treatment / LAST SYNC source / FAB↔SSOT reconciliation: MEDIUM — open decisions handed to UI-SPEC/planner (see Open Questions).

**Research date:** 2026-06-12
**Valid until:** ~2026-07-12 (30 days — stable; the only fast-moving external is React 19 minor behavior, which is settled for this phase). Re-verify only if dependency majors bump (Vite 8 → 9, react-router 7 → 8, Tailwind 4 → 5).
