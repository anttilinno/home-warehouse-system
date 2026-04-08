# Stack Research

**Domain:** Retro-styled second frontend for home inventory system (SPA, online-only)
**Researched:** 2026-04-08
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | ^8.0.6 | Build tool / dev server | Current stable (2026-03-12). Rolldown-powered bundler delivers 10-30x faster builds over Vite 7. First-party Tailwind and React Router plugins. Node 20.19+ required. |
| React | 19.2.3 | UI library | Pin to same version as frontend1 to avoid version drift. React 19 is stable and well-supported by all chosen libraries. |
| React DOM | 19.2.3 | DOM renderer | Must match React version exactly. |
| React Router | ^7.14.0 | Routing (framework mode) | Framework mode with `ssr: false` gives file-based routing, type-safe routes, automatic code splitting, and SPA output -- all without SSR complexity. v7 is the Remix merger and the current stable line. |
| @react-router/dev | ^7.14.0 | React Router Vite plugin | Required for framework mode. Provides the Vite plugin, typegen, and build pipeline. |
| @react-router/fs-routes | ^7.14.0 | File-based route conventions | Enables automatic route discovery from `app/routes/` directory. File naming conventions: dots for nested paths, underscores for pathless layouts. |
| @react-router/node | ^7.14.0 | Node adapter | Required even in SPA mode -- React Router still pre-renders `index.html` at build time using this adapter. |
| Tailwind CSS | ^4.2.2 | Utility CSS | Same version line as frontend1. CSS-first configuration with `@theme` blocks for custom properties. Rust engine for speed. |
| @tailwindcss/vite | ^4.2.2 | Tailwind Vite plugin | First-party Vite integration. Replaces the PostCSS approach used in frontend1's Next.js setup. Simpler: just add the plugin, no postcss.config needed. |
| TypeScript | ^5.8 | Type safety | Match frontend1. React Router framework mode generates route types automatically. |

### i18n

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @lingui/react | ^5.9.4 | React i18n bindings | 2KB runtime (vs react-i18next's 22KB combined). Compile-time message extraction produces minimal bundles. Macro-based API (`<Trans>`, `t()`) is ergonomic. |
| @lingui/core | ^5.9.4 | i18n core engine | Powers locale switching, message catalogs, plurals, ICU MessageFormat. |
| @lingui/cli | ^5.9.4 | Message extraction CLI | `lingui extract` scans source for translatable strings, `lingui compile` produces optimized catalogs. |
| @lingui/vite-plugin | ^5.9.3 | Vite integration | Compiles Lingui catalogs on-the-fly during dev. Works with both Babel and SWC Vite plugins. |
| @lingui/babel-plugin-lingui-macro | ^5.9.4 | Babel macro transform | Transforms `<Trans>` and `t()` macros at build time. Required when using `@vitejs/plugin-react`. |

**Why Lingui over react-i18next:** Frontend1 uses `next-intl` (Next.js-specific, won't work with Vite). For a Vite SPA, the two real options are react-i18next and Lingui. Lingui wins on bundle size (10KB total vs 22KB), has first-class Vite plugin support, compile-time extraction (no runtime JSON loading), and type-safe message catalogs. The 2-language scope (EN + ET) is small enough that Lingui's compile-time approach is ideal -- translations bake into the JS bundle with zero network requests.

**Translation key strategy:** Frontend2 uses its own message catalogs (not shared with frontend1). The retro UI has different copy, labels, and tone. Extract from frontend1's `messages/en.json` and `messages/et.json` as a starting reference, but maintain independently.

### Retro Design System Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| motion | ^12.38.0 | Animation (button press, panel transitions) | Already used in frontend1 as `motion v12.29`. Rename-from-framer-motion is complete. Provides spring physics for beveled button press/release, layout animations for panel open/close, and gesture detection. |
| clsx | ^2.1.1 | Conditional classnames | Already in frontend1. Tiny (< 1KB). Used with Tailwind for conditional retro style application. |
| tailwind-merge | ^3.4.0 | Tailwind class merging | Already in frontend1. Prevents class conflicts in component variants (e.g., default vs pressed button states). |
| class-variance-authority | ^0.7.1 | Component variant API | Already in frontend1. Defines retro component variants (panel types, button sizes, alert levels) with type-safe props. |

### Shared with Frontend1 (same versions)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| zod | ^4.3.5 | Schema validation | Form validation, API response parsing. Same schemas can be shared if extracted to a common package later. |
| react-hook-form | ^7.70.0 | Form state management | With @hookform/resolvers for Zod integration. |
| @hookform/resolvers | ^5.2.2 | Form resolver adapters | Connects react-hook-form to Zod. |
| date-fns | ^4.1.0 | Date formatting | Locale-aware date display. |
| lucide-react | ^0.562.0 | Icon library | Consistent iconography. Can be styled with retro color palette via CSS custom properties. |
| sonner | ^2.0.7 | Toast notifications | Lightweight toast library. Style with retro theme CSS. |
| uuid | ^13.0.0 | UUID generation | UUIDv7 for entity creation (same as frontend1 pattern). |
| recharts | ^3.6.0 | Charts/dashboard | If dashboard feature parity requires charts. |

### NOT Needed in Frontend2

| Library | Why Excluded | Frontend1 Uses It For |
|---------|-------------|----------------------|
| next-intl | Next.js-specific i18n, incompatible with Vite | Frontend1 i18n |
| next-themes | Next.js-specific theme provider | Theme toggle (frontend2 uses CSS custom properties directly) |
| @serwist/next, serwist | PWA/offline -- frontend2 is online-only | Service worker, offline caching |
| idb | IndexedDB wrapper -- frontend2 is online-only | Offline data storage |
| fuse.js | Client-side fuzzy search -- frontend2 hits API directly | Offline search |
| ios-haptics | Mobile PWA haptics -- frontend2 is not a PWA | iOS haptic feedback |
| @yudiel/react-qr-scanner | Can add later if needed, not MVP | Barcode scanning |
| shadcn/ui, Radix UI primitives | Frontend2 builds its own retro component library from scratch | Component system |
| cmdk | Command palette -- not retro aesthetic | Command menu |
| next-nprogress-bar | Next.js-specific | Page load progress |
| @dnd-kit/* | Drag-and-drop -- add only if feature parity demands it | Sortable lists |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | ^4.0.18 | Unit testing | Same version as frontend1 for consistency. |
| @testing-library/react | ^16.3.2 | Component testing | Same version as frontend1. |
| @testing-library/jest-dom | ^6.9.1 | DOM assertions | Same version as frontend1. |
| @testing-library/user-event | ^14.6.1 | User interaction simulation | Same version as frontend1. |
| @playwright/test | ^1.57.0 | E2E testing | Same version as frontend1. Can share test infrastructure. |
| ESLint | ^9 | Linting | Flat config format. No eslint-config-next -- use @eslint/js + typescript-eslint directly. |
| jsdom | ^27.4.0 | Test environment | Vitest DOM environment. |

## Retro Design System Approach

**No external retro CSS library is needed.** The retro industrial aesthetic is best achieved with Tailwind CSS 4's native capabilities:

### CSS Custom Properties via @theme

```css
/* app/styles/retro-theme.css */
@import "tailwindcss";

@theme {
  /* Retro color palette */
  --color-panel-bg: #2a2a2a;
  --color-panel-border: #1a1a1a;
  --color-panel-highlight: #3a3a3a;
  --color-hazard-yellow: #f5c518;
  --color-hazard-black: #1a1a1a;
  --color-status-ok: #4ade80;
  --color-status-warn: #facc15;
  --color-status-danger: #ef4444;
  --color-text-primary: #e8e8e8;
  --color-text-secondary: #a0a0a0;

  /* Beveled button shadows */
  --shadow-bevel-out: inset 1px 1px 0 rgba(255,255,255,0.15), inset -1px -1px 0 rgba(0,0,0,0.3);
  --shadow-bevel-in: inset 1px 1px 3px rgba(0,0,0,0.4), inset -1px -1px 0 rgba(255,255,255,0.05);

  /* Industrial spacing */
  --spacing-panel: 1rem;
  --radius-panel: 2px;

  /* Thick borders */
  --border-thick: 3px;
  --border-panel: 2px solid var(--color-panel-border);
}
```

### Beveled Buttons with Motion

Button press effect uses `box-shadow` transition (bevel-out to bevel-in) combined with Motion's `whileTap` for a 1-2px translate to simulate physical depression. No animation library beyond Motion is needed.

### Hazard Stripes

CSS `repeating-linear-gradient` on pseudo-elements or dedicated `<HazardStripe>` component. Pure CSS, no library needed:

```css
.hazard-stripe {
  background: repeating-linear-gradient(
    -45deg,
    var(--color-hazard-yellow),
    var(--color-hazard-yellow) 10px,
    var(--color-hazard-black) 10px,
    var(--color-hazard-black) 20px
  );
}
```

### Why No External Retro Library

Searched for retro CSS frameworks/libraries. Options like NES.css, 98.css, and XP.css exist but target specific nostalgic aesthetics (8-bit, Windows 98, Windows XP). The project's "industrial game UI" aesthetic (think Factorio, Barotrauma, military HUD) is a custom design language that doesn't match any existing library. Building with Tailwind custom properties + Motion animations gives full control.

## Project Structure

```
frontend2/
  app/
    root.tsx                  # Shell (html, head, body, Outlet)
    routes/
      _index.tsx              # Dashboard (/)
      login.tsx               # Login (/login)
      register.tsx            # Register (/register)
      dashboard.tsx           # Layout for authenticated routes
      dashboard._index.tsx    # Dashboard home
      dashboard.items.tsx     # Items list
      dashboard.items.$id.tsx # Item detail
      ...
    components/
      retro/                  # Retro design system components
        Panel.tsx
        Button.tsx
        Input.tsx
        Badge.tsx
        HazardStripe.tsx
        ...
      layout/
        Sidebar.tsx
        Header.tsx
        ...
    styles/
      retro-theme.css         # @theme with CSS custom properties
    lib/
      api.ts                  # API client (fetch to Go backend)
      auth.ts                 # Auth context/hooks
      i18n.ts                 # Lingui setup
    locales/
      en/
        messages.po           # English translations
      et/
        messages.po           # Estonian translations
  react-router.config.ts      # React Router config (ssr: false)
  vite.config.ts              # Vite + React + Tailwind + Lingui + React Router
  lingui.config.ts            # Lingui extraction config
  tsconfig.json
  package.json
```

## Key Configuration Files

### react-router.config.ts

```typescript
import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "app",
  ssr: false,  // SPA mode -- pre-renders index.html at build time only
} satisfies Config;
```

### vite.config.ts

```typescript
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),  // Replaces @vitejs/plugin-react -- includes React support
    lingui(),
    tsconfigPaths(),
  ],
  server: {
    port: 3002,  // Different from frontend1 (3001)
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
```

**Note on React plugin:** The `reactRouter()` Vite plugin internally includes `@vitejs/plugin-react` (Babel-based). You do NOT add `@vitejs/plugin-react` separately. Configure Lingui's Babel plugin through React Router's config or a separate Babel config file.

### lingui.config.ts

```typescript
import type { LinguiConfig } from "@lingui/conf";

const config: LinguiConfig = {
  locales: ["en", "et"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "app/locales/{locale}/messages",
      include: ["app"],
    },
  ],
};

export default config;
```

## Installation

```bash
# Create frontend2 directory
mkdir frontend2 && cd frontend2

# Core (React Router framework mode)
npm install react@19.2.3 react-dom@19.2.3 react-router@^7.14.0 \
  @react-router/node@^7.14.0 @react-router/fs-routes@^7.14.0

# Tailwind
npm install tailwindcss@^4.2.2

# i18n
npm install @lingui/react@^5.9.4 @lingui/core@^5.9.4

# Retro design system utilities
npm install motion@^12.38.0 clsx@^2.1.1 tailwind-merge@^3.4.0 \
  class-variance-authority@^0.7.1

# Forms & validation
npm install react-hook-form@^7.70.0 @hookform/resolvers@^5.2.2 zod@^4.3.5

# Utilities
npm install date-fns@^4.1.0 lucide-react@^0.562.0 sonner@^2.0.7 uuid@^13.0.0

# Dev dependencies
npm install -D @react-router/dev@^7.14.0 @tailwindcss/vite@^4.2.2 \
  @lingui/cli@^5.9.4 @lingui/vite-plugin@^5.9.3 \
  @lingui/babel-plugin-lingui-macro@^5.9.4 \
  vite@^8.0.6 vite-tsconfig-paths@^5.1.0 \
  typescript@^5.8.0 @types/react@^19 @types/react-dom@^19 \
  vitest@^4.0.18 jsdom@^27.4.0 \
  @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 \
  @testing-library/user-event@^14.6.1 \
  @playwright/test@^1.57.0 \
  eslint@^9
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React Router v7 (framework mode) | TanStack Router | If you want the most type-safe router with zero Remix heritage. However, React Router v7 framework mode has superior file-based routing DX and broader ecosystem support. |
| React Router v7 (framework mode) | React Router v7 (library mode) | If you want to avoid the Vite plugin and define routes manually. Loses file-based routing, code splitting, and type-safe routes. Not worth the trade-off. |
| React Router v7 (framework mode) | React Router v7 (declarative mode) | Simplest mode, but no data loading, no code splitting, no type-safe routes. Only suitable if you already have a complete data layer. |
| Lingui | react-i18next | If you need runtime JSON loading for many locales or dynamic locale switching without rebuild. Overkill for 2 locales. Larger bundle (22KB vs 10KB). |
| Lingui | typesafe-i18n | Even smaller than Lingui but less mature ecosystem, no Vite plugin, manual catalog management. |
| Motion | CSS animations only | If you want zero JS animation overhead. CSS can handle simple transitions, but Motion adds spring physics, gesture detection (`whileTap`, `whileHover`), and layout animations that make the retro UI feel tactile. Worth the ~15KB. |
| Custom retro components | NES.css / 98.css / XP.css | If you wanted a specific nostalgic aesthetic. These are pixel-perfect recreations of old UIs, not industrial/game aesthetics. Wrong vibe entirely. |
| Tailwind CSS 4 @theme | CSS Modules | If you prefer scoped CSS. Tailwind's @theme gives CSS custom properties globally AND utility classes. CSS Modules add complexity without benefit here. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| shadcn/ui | Frontend2 needs its own retro component library. shadcn's clean, minimal design conflicts with industrial aesthetic. Also brings Radix UI primitives that add unnecessary weight. | Custom components with CVA + Tailwind + Motion |
| Next.js patterns (use client, server components, app router) | Frontend2 is a Vite SPA. No server components, no use client directives, no Next.js API routes. | React Router framework mode conventions |
| @serwist/next, any SW libraries | Frontend2 is online-only. No service worker, no offline caching, no IndexedDB. | Direct fetch() to Go backend API |
| styled-components / Emotion | CSS-in-JS adds runtime overhead and conflicts with Tailwind. | Tailwind utility classes + CSS custom properties |
| Chakra UI / Mantine / MUI | Full component libraries fight against custom retro styling. | Build retro components from scratch with Tailwind |
| postcss / @tailwindcss/postcss | Vite has a first-party Tailwind plugin. PostCSS adapter is for non-Vite setups (like Next.js). | @tailwindcss/vite |
| @vitejs/plugin-react (standalone) | The `reactRouter()` Vite plugin already includes React support internally. Adding both causes conflicts. | Use `reactRouter()` plugin which bundles React support |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Vite ^8.0 | @tailwindcss/vite ^4.2 | Confirmed compatible. Tailwind docs require Vite 5.0+. |
| Vite ^8.0 | @react-router/dev ^7.14 | React Router framework mode requires Vite. Tested with Vite 6+, works with 8. |
| React 19.2.3 | react-router ^7.14.0 | Full support. React Router v7 designed for React 18+/19. |
| React 19.2.3 | motion ^12.38.0 | Full support. Motion v12 supports React 19. |
| React 19.2.3 | @lingui/react ^5.9.4 | Full support. Lingui 5.x targets React 18+. |
| @lingui/vite-plugin ^5.9.3 | Vite ^8.0 | Should work -- Lingui plugin is a simple transform. If issues arise, Babel config file is the fallback. |
| @react-router/dev ^7.14 | @lingui/babel-plugin | React Router's Vite plugin uses @vitejs/plugin-react internally. Lingui's Babel plugin integrates via the Babel config that React Router exposes. |

## Backend Integration

Frontend2 connects to the **same Go backend** as frontend1. No backend changes needed for core integration.

| Concern | Approach |
|---------|----------|
| API proxy (dev) | Vite `server.proxy` forwards `/api/*` to `localhost:8080` |
| API proxy (prod) | Nginx/Caddy routes `/api/*` to Go backend, serves frontend2 build output from a separate path or subdomain |
| Auth | Same cookie-based sessions. Go backend sets HttpOnly cookies. Frontend2 calls same `/api/auth/*` endpoints. |
| OAuth | Same Google/GitHub OAuth flows. Redirect URI needs a frontend2-specific callback route registered with providers. |
| CORS | Not needed if proxied through same origin. If served from different origin, add frontend2's origin to Go backend CORS config. |
| API client | Thin `fetch()` wrapper in `app/lib/api.ts`. No axios needed. Pattern: `fetch("/api/v1/items")` with auth cookie auto-sent. |

## Sources

- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown bundler, Node 20.19+ requirement (HIGH confidence)
- [React Router modes documentation](https://reactrouter.com/start/modes) -- Framework vs Library vs Declarative mode comparison (HIGH confidence)
- [React Router file route conventions](https://reactrouter.com/how-to/file-route-conventions) -- File naming patterns (HIGH confidence)
- [React Router SPA mode](https://reactrouter.com/how-to/spa) -- `ssr: false` configuration (HIGH confidence)
- [Tailwind CSS v4 Vite installation](https://tailwindcss.com/docs) -- @tailwindcss/vite setup (HIGH confidence)
- [Lingui Vite plugin docs](https://lingui.dev/ref/vite-plugin) -- Vite integration setup (HIGH confidence)
- [Lingui installation docs](https://lingui.dev/installation) -- Core setup and Babel plugin (HIGH confidence)
- [Lingui vs i18next comparison](https://lingui.dev/misc/i18next) -- Bundle size and architecture differences (HIGH confidence)
- [Motion for React docs](https://motion.dev/docs/react) -- Animation library (HIGH confidence)
- [npm: react-router](https://www.npmjs.com/package/react-router) -- v7.14.0 confirmed current (HIGH confidence)
- [npm: @tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) -- v4.2.2 confirmed current (HIGH confidence)
- [npm: @lingui/react](https://www.npmjs.com/package/@lingui/react) -- v5.9.4 confirmed current (HIGH confidence)
- [npm: vite](https://www.npmjs.com/package/vite) -- v8.0.6 confirmed current (HIGH confidence)
- [i18n comparison 2026](https://dev.to/erayg/best-i18n-libraries-for-nextjs-react-react-native-in-2026-honest-comparison-3m8f) -- Lingui vs react-i18next bundle sizes (MEDIUM confidence)

---
*Stack research for: v2.0 Retro Frontend (frontend2)*
*Researched: 2026-04-08*
