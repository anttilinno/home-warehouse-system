# Phase 48: Project Scaffold - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up a working Vite + React 19 development environment in `/frontend2` with React Router v7 (library mode) routing, Tailwind CSS 4 retro design tokens, Lingui v5 i18n extraction (EN + ET), and Vite dev server proxying API requests to the Go backend.

</domain>

<decisions>
## Implementation Decisions

### Retro Design Aesthetic
- **D-01:** Follow the BAM (Build & Mad) industrial game UI aesthetic pixel-accurately. Reference images stored in `.planning/references/retro-ui/` (6 screenshots covering icons, UI components, full app layout, character editor, auth forms, and settings panels).
- **D-02:** Color palette extracted from BAM references:
  - Panel background: `#F5F0E1` (cream)
  - App background: `#2A2A2A` (charcoal)
  - Borders/outlines: `#1A1A1A` (near-black, 3-4px thick)
  - Amber/gold accent: `#D4A017` (active highlights, progress)
  - Orange accent: `#E67E22` (icon backgrounds, warnings)
  - Danger red: `#CC3333` (close buttons, errors)
  - Success green: `#4A7C4A` (save/OK, checkmarks)
  - Info blue: `#3366AA` (info icons)
  - Hazard yellow: `#FFD700` (hazard stripe pattern)
  - Hazard black: `#1A1A1A` (hazard stripe pattern)
  - Medium gray: `#8B8B8B` (disabled states, secondary panels)
- **D-03:** Light theme only for scaffold. Retro-dark variant deferred to Phase 50 or 51 when components exist to test against.
- **D-04:** Design patterns from BAM: thick dark outlines (3-4px) on all panels, hazard stripes (yellow/black diagonal) as decorative borders, beveled buttons with default/hover/down states, physical file-folder tabs, red square X close buttons, segmented progress bars.

### Font Strategy
- **D-05:** System sans-serif font stack for body text. Monospace font (e.g., JetBrains Mono or IBM Plex Mono) for data fields, codes, and technical display. No custom retro font files needed.
- **D-06:** Uppercase text (via CSS `text-transform: uppercase`) for headings, tab labels, and button text -- matching BAM reference style.

### Package Manager
- **D-07:** Use Bun as the package manager for `/frontend2`, consistent with frontend1 and the project's `.mise.toml` configuration.

### Directory Layout
- **D-08:** Feature-based directory structure:
  ```
  frontend2/
    src/
      components/
        retro/         # Shared retro UI primitives (Phase 50)
        layout/        # App shell, sidebar, topbar (Phase 51)
      features/
        auth/          # Login, register, route guard (Phase 49)
        dashboard/     # HUD stats, activity feed (Phase 52)
        items/         # Item CRUD, search (future)
        settings/      # 8 settings subpages (Phase 53)
      hooks/           # Shared hooks
      lib/             # API client, i18n config, utilities
      routes/          # Route definitions (React Router v7)
      styles/          # Global CSS, retro Tailwind tokens
    public/
    locales/           # EN, ET Lingui message catalogs
  ```

### Claude's Discretion
- Vite configuration details (plugins, build settings)
- React Router v7 route structure (as long as placeholder routes exist per success criteria)
- Lingui configuration specifics (extraction method, catalog format)
- Vite proxy configuration for backend API
- ESLint/TypeScript configuration
- Which specific monospace font to use (JetBrains Mono or IBM Plex Mono or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Design Reference
- `.planning/references/retro-ui/1.png` -- BAM icon set: color-coded square icons with thick outlines (blue, green, orange, red categories)
- `.planning/references/retro-ui/2.png` -- BAM UI components: buttons (default/hover/down), dialogs, hazard stripes, progress bars, notification badges, toggle switches
- `.planning/references/retro-ui/3.png` -- BAM full app layout: dark background, cream panels, hazard stripe headers, card grid, tabs, pagination, search bar
- `.planning/references/retro-ui/4.png` -- BAM character editor: file-folder tabs, grid selection, hazard stripe accents, level/XP display, pagination
- `.planning/references/retro-ui/5.png` -- BAM auth forms: login/register with thick borders, inline validation, toggle switches, text button states, error/success/info messages
- `.planning/references/retro-ui/6.png` -- BAM settings panels: tabbed navigation, sliders, dropdowns, checkboxes, key binding display, hazard stripe corners

### Project Context
- `.planning/REQUIREMENTS.md` -- SCAF-01 through SCAF-04 requirements for this phase
- `.planning/ROADMAP.md` -- Phase 48 success criteria and dependency info
- `.planning/PROJECT.md` -- v2.0 milestone context, tech stack decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None directly reusable -- `/frontend2` is a greenfield Vite + React 19 project, separate from the Next.js frontend1
- `.mise.toml` already has `bun = "latest"` configured for the project

### Established Patterns
- Frontend1 uses Tailwind CSS 4 with `@theme` blocks for design tokens -- same approach applies to frontend2
- Frontend1 uses `@/` path alias in tsconfig.json -- adopt same pattern for frontend2
- Backend runs on port 8080, frontend1 on port 3000 -- frontend2 needs a different port (e.g., 5173 Vite default)

### Integration Points
- Vite dev server proxy must forward `/api/*` requests to `http://localhost:8080` (Go backend)
- Backend CORS configuration needs update to allow the frontend2 origin
- Lingui catalogs in `locales/` directory with EN and ET locales

</code_context>

<specifics>
## Specific Ideas

- BAM (Build & Mad) game UI is THE reference -- not "inspired by" but pixel-accurate reproduction of the style
- The 6 reference screenshots cover the full component vocabulary: icons, buttons, panels, dialogs, tabs, forms, settings, layouts
- Hazard stripes are a signature decorative element -- should be available as a reusable pattern/utility from the start

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 48-project-scaffold*
*Context gathered: 2026-04-08*
