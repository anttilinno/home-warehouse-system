---
phase: 48-project-scaffold
plan: 01
subsystem: frontend2
tags: [scaffold, vite, react, tailwind, lingui, design-tokens]
dependency_graph:
  requires: []
  provides: [frontend2-project, retro-design-tokens, vite-dev-server]
  affects: [frontend2/]
tech_stack:
  added: [vite@8.0.8, react@19.2.5, react-dom@19.2.5, react-router@7.14.0, tailwindcss@4.2.2, "@tailwindcss/vite@4.2.2", "@lingui/core@5.9.5", "@lingui/react@5.9.5", "@vitejs/plugin-react-swc@4.3.0", "@lingui/swc-plugin@5.11.0", "@lingui/vite-plugin@5.9.5", "@lingui/cli@5.9.5", typescript@6.0.2, eslint@10.2.0, vitest@4.1.3]
  patterns: [css-first-tailwind-config, vite-proxy, swc-transforms, feature-based-directories]
key_files:
  created:
    - frontend2/package.json
    - frontend2/vite.config.ts
    - frontend2/tsconfig.json
    - frontend2/tsconfig.app.json
    - frontend2/tsconfig.node.json
    - frontend2/index.html
    - frontend2/src/main.tsx
    - frontend2/src/App.tsx
    - frontend2/src/vite-env.d.ts
    - frontend2/src/styles/globals.css
    - frontend2/eslint.config.mjs
    - frontend2/lingui.config.ts
  modified: []
decisions:
  - Use plain @theme (not @theme inline) for static retro hex tokens
  - IBM Plex Mono via Google Fonts CDN with ui-monospace fallback
  - Lingui config created in Task 1 (pulled forward from Task 2) to unblock build
metrics:
  duration: 214s
  completed: "2026-04-09T06:17:38Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 23
  files_modified: 0
---

# Phase 48 Plan 01: Vite + React 19 Scaffold with Retro Design Tokens Summary

Scaffolded greenfield frontend2/ SPA with Vite 8 + React 19 + SWC, Tailwind CSS 4 retro design tokens (11 colors, 2 border widths, 2 shadows, 2 font stacks, 7 spacing values), hazard stripe utility, Lingui i18n config, and /api proxy to Go backend.

## Task Results

### Task 1: Scaffold Vite + React 19 project with dependencies and configuration
**Commit:** `5cbde14`
**Status:** Complete

Created the frontend2/ project from Vite template with all runtime and dev dependencies. Configured Vite with SWC React plugin, Tailwind CSS 4 Vite plugin, Lingui Vite plugin, @/ path alias, and /api proxy to localhost:8080. Set up TypeScript project references with strict mode. Created feature-based directory structure with placeholder .gitkeep files. IBM Plex Mono loaded via Google Fonts CDN in index.html. ESLint flat config with typescript-eslint and react-hooks plugins.

### Task 2: Configure Tailwind CSS 4 retro design tokens and globals.css
**Commit:** `2b23c6a`
**Status:** Complete

Added complete @theme block to globals.css with all retro design tokens from UI-SPEC: 11 colors (cream, charcoal, ink, amber, orange, red, green, blue, hazard-yellow, hazard-black, gray), 2 border widths (thick 3px, extra-thick 4px), 2 shadows (raised, pressed), 2 font stacks (sans, mono), 7 spacing values (xs through 3xl). Added bg-hazard-stripe utility class with diagonal yellow/black repeating gradient. No tailwind.config.js -- CSS-first configuration per Tailwind v4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lingui config pulled forward from Task 2 into Task 1**
- **Found during:** Task 1 verification (bun run build)
- **Issue:** Vite build fails without lingui.config.ts because @lingui/vite-plugin is loaded in vite.config.ts
- **Fix:** Created lingui.config.ts during Task 1 instead of Task 2
- **Files modified:** frontend2/lingui.config.ts
- **Commit:** 5cbde14

**2. [Rule 3 - Blocking] Vite template generated vanilla TS instead of React**
- **Found during:** Task 1 scaffolding
- **Issue:** `bun create vite frontend2 --template react-swc-ts` generated a vanilla TypeScript template without React
- **Fix:** Manually installed react, react-dom, @vitejs/plugin-react-swc and created JSX source files
- **Files modified:** frontend2/package.json, frontend2/src/main.tsx, frontend2/src/App.tsx
- **Commit:** 5cbde14

**3. [Rule 2 - Missing] Added .tsbuildinfo to .gitignore**
- **Found during:** Task 1 commit staging
- **Issue:** tsc -b produces .tsbuildinfo files that are build artifacts
- **Fix:** Added *.tsbuildinfo to frontend2/.gitignore
- **Files modified:** frontend2/.gitignore
- **Commit:** 5cbde14

## Verification Results

- `bun run build` exits 0 (tsc -b + vite build passes)
- All 11 retro colors present in globals.css @theme block
- @theme used (NOT @theme inline) per RESEARCH.md Pitfall 2
- bg-hazard-stripe utility class defined with repeating-linear-gradient
- /api proxy configured to localhost:8080 in vite.config.ts
- Feature-based directory structure created per D-08
- IBM Plex Mono loaded from Google Fonts CDN
- No tailwind.config.js or tailwind.config.ts exists

## Known Stubs

None -- all plan artifacts are fully wired.

## Self-Check: PASSED

All 12 created files verified present. All 11 directories verified present. Both commit hashes (5cbde14, 2b23c6a) verified in git log.
