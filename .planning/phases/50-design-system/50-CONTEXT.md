# Phase 50: Design System - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Build ten retro-styled UI primitives in `frontend2/src/components/retro/` (RetroButton, RetroPanel, RetroInput, RetroCard, RetroDialog, RetroTable, RetroTabs, RetroToast, RetroBadge, HazardStripe), then refactor the existing auth pages to consume them, and validate everything through a fully-interactive `/demo` living style guide page.

</domain>

<decisions>
## Implementation Decisions

### Auth Page Refactor
- **D-01:** Phase 50 includes a full refactor of the auth pages to use the design system components. After building the components, replace inline Tailwind retro classes in `AuthPage.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`, and `OAuthButtons.tsx` with the formal `<RetroButton>`, `<RetroInput>`, `<RetroPanel>`, `<RetroTabs>` etc. Eliminates duplicate patterns before they spread to more pages.

### Demo Page
- **D-02:** The `/demo` route is fully interactive — not a static state grid. Real buttons respond to clicks (showing press states), a dialog can be triggered and closed, toasts can be fired by clicking buttons, inputs accept live typing with an error state toggle. Tests that components work end-to-end, not just render.
- **D-03:** The `/demo` route is public (no authentication required). It is a developer tool, not a user feature.

### RetroToast Behavior
- **D-04:** RetroToast has both 4s auto-dismiss AND a manual X dismiss button. User can close early after reading. The X button sits in the top-right corner of the toast item, consistent with the red X close pattern used on RetroPanel and RetroDialog.

### Claude's Discretion
- Component file structure within `components/retro/` (one file per component + barrel `index.ts`)
- Exact class composition and `forwardRef` patterns (follow RESEARCH.md Pattern 1 as guide)
- `RetroDialog` imperative handle API (`open()` / `close()` via `useImperativeHandle`) — already specified in UI-SPEC
- Toast X button styling (small, consistent with close button pattern on panels)
- Demo page layout details (section order, exact interactive example content per UI-SPEC copywriting contract)
- Test structure and coverage level for component unit tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Design Reference (BAM aesthetic — pixel-accurate target)
- `.planning/references/retro-ui/1.png` — BAM icon set: color-coded square icons with thick outlines
- `.planning/references/retro-ui/2.png` — BAM UI components: buttons (default/hover/down), dialogs, hazard stripes, progress bars, badges, toggles
- `.planning/references/retro-ui/3.png` — BAM full app layout: dark background, cream panels, hazard stripe headers, card grid, tabs
- `.planning/references/retro-ui/4.png` — BAM character editor: file-folder tabs, grid selection, hazard stripe accents
- `.planning/references/retro-ui/5.png` — BAM auth forms: login/register with thick borders, inline validation, toggle switches, text button states
- `.planning/references/retro-ui/6.png` — BAM settings panels: tabbed navigation, sliders, dropdowns, checkboxes, key binding display

### UI Design Contract (exact pixel specs for all 10 components)
- `.planning/phases/50-design-system/50-UI-SPEC.md` — Component visual contracts, spacing exceptions, accessibility rules, copywriting contract for /demo, z-index scale

### Technical Research
- `.planning/phases/50-design-system/50-RESEARCH.md` — Architecture patterns (forwardRef, native dialog, toast context), anti-patterns to avoid, auth extraction table (which auth file patterns become which components)

### Existing Tokens & Patterns
- `frontend2/src/styles/globals.css` — All `@theme` design tokens (colors, borders, shadows, fonts, spacing) + `bg-hazard-stripe` utility class
- `frontend2/src/features/auth/AuthPage.tsx` — Existing tab/panel patterns to extract into RetroTabs + RetroPanel
- `frontend2/src/features/auth/LoginForm.tsx` — Existing input/button/error patterns to extract into RetroInput + RetroButton
- `frontend2/src/routes/index.tsx` — Inline `RetroPanel` component (to be replaced by the formal component)

### Project Context
- `.planning/REQUIREMENTS.md` — DS-01 through DS-10 requirements
- `.planning/phases/48-project-scaffold/48-CONTEXT.md` — Color palette, font decisions, directory layout (D-01 through D-08)
- `.planning/phases/49-auth-api-client/49-CONTEXT.md` — Auth page layout decisions (tabs, error messages, OAuth buttons)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `globals.css` `@theme` block — All retro design tokens already defined; components use these, do not hardcode hex values
- `bg-hazard-stripe` CSS utility — `HazardStripe` component simply wraps this in a configurable height prop
- Auth page inline patterns — direct extraction targets (see RESEARCH.md Pattern 4 table for mapping)
- `components/retro/` directory already exists (empty `.gitkeep`)

### Established Patterns
- Tailwind CSS 4 utility classes for all styling — no CSS-in-JS, no styled-components
- `forwardRef` + `className` merge pattern for composability (see RESEARCH.md Pattern 1)
- Native `<dialog>` element for RetroDialog (no portal library needed)
- React context + `useState` for toast system (no external dependency)
- IBM Plex Mono (or JetBrains Mono fallback) for monospace data fields

### Integration Points
- `frontend2/src/routes/index.tsx` — Add `/demo` route (public, no RequireAuth wrapper); replace inline `RetroPanel` with formal component
- `frontend2/src/App.tsx` — Add `ToastProvider` wrapper so `useToast()` is available app-wide
- All auth files — Replace inline retro utility classes with design system component props

</code_context>

<specifics>
## Specific Ideas

- The retro X close button pattern (red square, white X, `aria-label="Close"`) appears on RetroPanel, RetroDialog, and RetroToast items — all three share the same button design
- `/demo` must be accessible before login for development workflow (public route)
- The UI-SPEC's copywriting contract (EXECUTE, ABORT MISSION, STANDBY button labels; "SYSTEM ERROR DETECTED" toast; etc.) is the exact copy to use in the demo — not approximate

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 50-design-system*
*Context gathered: 2026-04-10*
