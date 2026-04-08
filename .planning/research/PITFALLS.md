# Pitfalls Research

**Domain:** Second frontend (retro game UI) for existing home inventory system
**Researched:** 2026-04-08
**Confidence:** HIGH (based on codebase analysis + ecosystem knowledge)

## Critical Pitfalls

### Pitfall 1: OAuth Redirect Lock-in to Frontend1

**What goes wrong:**
The Go backend's OAuth handler redirects to `cfg.AppURL + "/auth/callback"` after provider authentication. This is a single hardcoded URL. Frontend2 running on a different origin (e.g., `localhost:5173` in dev, or a different subdomain in prod) will never receive the OAuth callback. Users clicking "Login with Google" from frontend2 get redirected back to frontend1.

**Why it happens:**
OAuth providers (Google, GitHub) require pre-registered redirect URIs. The backend stores a single `APP_URL` in config (`backend/internal/config/config.go` line 92, defaults to `http://localhost:3000`). The OAuth initiate and callback handlers in `backend/internal/domain/auth/oauth/handler.go` use this single URL for all redirects (lines 258, 415-420). Nobody thinks about this until OAuth login is tested in frontend2.

**How to avoid:**
Modify the backend OAuth flow to support multiple frontends before building auth pages:
- Pass a `redirect_to` parameter in the OAuth initiate request, store it in the state cookie alongside the CSRF token, and use it in the callback redirect. Validate against an allowlist (`ALLOWED_FRONTEND_URLS` env var, comma-separated).
- The state cookie already stores PKCE verifier and CSRF state -- adding a redirect target is a small extension.
- Update `CORS_ALLOWED_ORIGINS` to include frontend2's origin at the same time.

**Warning signs:**
- OAuth login button works but always lands on frontend1
- "Invalid state" errors when testing OAuth from frontend2 (different cookie domain)
- CORS errors on the `/auth/oauth/exchange` endpoint from frontend2's origin

**Phase to address:**
Phase 1 (project scaffold). This requires a backend change and MUST be resolved before any auth UI work in frontend2.

---

### Pitfall 2: CORS Origin Not Registered for Frontend2

**What goes wrong:**
The backend CORS middleware (`backend/internal/api/middleware/cors.go`) has a hardcoded allowlist: `localhost:3000`, `localhost:3001`, `127.0.0.1:3000`. Frontend2 on Vite defaults to `localhost:5173`. Every API call from frontend2 fails with CORS errors. The `Access-Control-Allow-Credentials: true` header requires exact origin match -- no wildcards allowed.

**Why it happens:**
The CORS middleware builds its origin list at startup from hardcoded values plus `CORS_ALLOWED_ORIGINS` env var. Developers forget to update either source for the new frontend. Vite's default port (`5173`) is not in the hardcoded list. The error manifests as silent failures -- fetch calls return empty responses with no useful error message visible to JS.

**How to avoid:**
- Add `http://localhost:5173` to the hardcoded dev origins in `cors.go` line 12-16
- Document in frontend2's setup that `CORS_ALLOWED_ORIGINS` must include the frontend2 production URL
- Verify by checking the `Access-Control-Allow-Origin` response header in the first API call during dev setup

**Warning signs:**
- "CORS policy: No 'Access-Control-Allow-Origin' header" in browser console
- API calls resolve but with empty body and status 0
- Preflight OPTIONS requests return 204 without the Allow-Origin header

**Phase to address:**
Phase 1 (project scaffold). Two-line backend change, but blocks ALL API integration if missed.

---

### Pitfall 3: Copying Next.js Patterns Into Vite (Ghost Framework Syndrome)

**What goes wrong:**
The existing frontend has 177 files with `"use client"` directives, uses `next-intl` for i18n with server-side message loading, relies on Next.js App Router layouts/route groups `(auth)/(dashboard)`, and accesses env vars via `process.env.NEXT_PUBLIC_*`. Developers reference the existing implementation for feature parity and carry over these patterns, creating a Vite app structured like a broken Next.js app.

**Why it happens:**
When building 1:1 feature parity, the natural approach is to look at the existing code. But Next.js and Vite+React Router have fundamentally different models:
- Next.js: Server Components by default, `"use client"` opt-in, file-system routing with `app/` directory, `layout.tsx` for persistent layouts, `next/image` for optimized images, `next/link` for client navigation.
- Vite+React Router v7: Everything is a client component, explicit route config, `<Outlet/>` for nested layouts, standard `<img>` tags, React Router `<Link>` component.

The 3,400+ lines of API client code in `frontend/lib/api/` all reference `process.env.NEXT_PUBLIC_API_URL` -- none of this works in Vite without rewriting.

**How to avoid:**
- Build frontend2's API client from scratch using `import.meta.env.VITE_API_URL`
- Replace `next-intl` with `react-i18next` (supports same nested JSON format)
- Replace `next/link` with React Router `<Link>`, `useRouter()` with `useNavigate()`
- Replace route groups `(auth)/(dashboard)` with React Router nested routes and layout routes
- Strip all `"use client"` directives -- everything is client in Vite
- Replace `next/image` with standard `<img>` + `loading="lazy"` + srcset
- Create a "Next.js to Vite" reference doc in phase 1 so all phases follow correct patterns
- Never import from `@/` paths that assume Next.js module resolution (configure `@/` alias in Vite config instead)

**Warning signs:**
- Import errors referencing `next/*` modules
- `process.env` returning `undefined` in browser
- `"use client"` directives present in the codebase (harmless but indicate copy-paste)

**Phase to address:**
Phase 1 (scaffold). Establish Vite-native patterns in the initial setup so all subsequent phases follow the correct model.

---

### Pitfall 4: Retro Design System Becoming Unusable in Production

**What goes wrong:**
The retro industrial aesthetic (thick borders, beveled buttons, hazard stripes, monospace fonts) looks striking in mockups with 3 items but becomes fatiguing and hard to read in daily use. Dense data tables with 3px borders and monospace text reduce information density by 30-40%. Hazard stripes on every panel create visual noise. Users with visual impairments cannot parse low-contrast retro color schemes.

**Why it happens:**
Game UIs optimize for atmosphere and short play sessions. Production inventory apps require scanning dozens of items, reading small text in tables, and extended use sessions (30+ minutes organizing inventory). The aesthetic goals (retro, industrial, bold) directly conflict with usability goals (scannable, calm, accessible). Designers test with empty states and 3-item lists, not 50-item tables with real data.

**How to avoid:**
- Apply retro styling to chrome only (navigation, headers, panel frames, buttons) -- keep data display areas clean and readable
- Monospace fonts for labels, headings, and display values (SKU, barcode) only; proportional font for body text, table data, and form inputs
- Hazard stripes exclusively for destructive actions (delete, overwrite) and error states, never as decorative borders
- Ensure WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text) even with retro palette
- Test with real inventory data (50+ items in a table) from day one, not synthetic 3-item mockups
- Build the design tokens to support theme adjustment -- if users find it too intense, you can dial it back without rewriting components

**Warning signs:**
- Accessibility audit failures on contrast ratios
- Feature-complete pages feeling "cluttered" despite having same data as frontend1
- Users increasing browser zoom to read table content
- Requests for a "lite" or "simple" mode within weeks of launch

**Phase to address:**
Phase 2 (design system/component library). The retro tokens and base components get locked in here. Getting the balance wrong propagates to every subsequent page build.

---

### Pitfall 5: API Client Code Duplication Leading to Drift

**What goes wrong:**
Frontend2 reimplements the 3,400+ lines of API client code from frontend1's `lib/api/` directory. Over time, bug fixes or API changes are applied to one frontend but not the other. The two frontends develop subtly different API call signatures, error handling, and response type definitions. A backend API change silently breaks one frontend.

**Why it happens:**
The API client in frontend1 uses `process.env.NEXT_PUBLIC_API_URL`, has scattered env var references across multiple files (`client.ts`, `repair-logs.ts`, `importexport.ts`, `item-photos.ts`, `workspace-backup.ts`), and is interleaved with offline/sync logic that frontend2 doesn't need. It's not directly reusable.

**How to avoid:**
- Extract shared TypeScript interfaces for all API request/response types into a shared location (e.g., `/shared/api-types/` at the monorepo root)
- Both frontends import type definitions from the shared package
- Build frontend2's API client from scratch but conforming to the same TypeScript interfaces
- Do NOT try to share the runtime API client -- the env var differences, offline logic, and error handling patterns make a shared runtime client more trouble than it's worth
- Consider generating API types from the backend's OpenAPI spec (Huma generates OpenAPI automatically)

**Warning signs:**
- Same API bug fixed in one frontend but not the other
- Backend developer changes an endpoint and only notifies one frontend
- Type mismatches between frontends when handling the same API response
- Divergent error handling (one frontend handles 409 conflict, the other doesn't)

**Phase to address:**
Phase 1 (scaffold) -- establish the shared types pattern. Phase 2 (API client) -- build the client using shared types.

---

### Pitfall 6: i18n Translation Key Drift Between Frontends

**What goes wrong:**
Frontend1 has 1,198 lines of English translations in a deeply nested JSON structure using `next-intl`. Frontend2 needs the same translations in a format compatible with its i18n library. Over time, new features add keys to one frontend but not the other. Estonian translations go out of sync. Users see raw translation keys (`settings.profile.title`) in production.

**Why it happens:**
Frontend1 uses `next-intl` with `useTranslations('namespace')` and 94 components import translations. Frontend2 will use `react-i18next` with `useTranslation()`. Different import patterns mean different developer habits. The 2-language requirement (EN + ET for v2.0) multiplies the drift surface. Frontend1 already has 3 orphaned translation keys from v1.8 -- drift is already happening within a single frontend.

**How to avoid:**
- Share translation JSON files between frontends -- keep them in a shared location or have frontend2 read from frontend1's `messages/` directory
- `react-i18next` natively supports the same nested JSON format as `next-intl`, so the files are compatible
- Scope v2.0 to EN + ET only (drop Russian for frontend2 initially, as specified in requirements)
- Write a CI check that compares translation keys between frontends and fails on mismatch
- Add translation keys in the same PR that adds the feature, never as a follow-up

**Warning signs:**
- Raw translation keys visible in the UI
- "Translation missing" warnings in browser console
- Estonian translations lagging behind English by multiple PRs

**Phase to address:**
Phase 1 (scaffold) -- decide on shared translation strategy. Every subsequent phase adds translations, so this must be right from the start.

---

### Pitfall 7: Feature Parity Scope Creep from Offline/PWA Features

**What goes wrong:**
Frontend1 has extensive offline capabilities: IndexedDB with 10 stores, SyncManager, conflict resolution UI, service worker caching, offline mutations for 6 entity types, Fuse.js offline search. Developers building "1:1 feature parity" try to replicate all of this. The retro frontend was explicitly scoped as online-only, but the boundary is fuzzy -- does "parity" include the sync status indicator? The offline search? The pending changes UI?

**Why it happens:**
The PROJECT.md says "1:1 feature parity with existing frontend" and also "Online-only (no offline/PWA for this milestone)." These statements conflict at the edges. Frontend1's UI has offline indicators woven into every page. Copying page layouts includes offline components.

**How to avoid:**
- Create an explicit exclusion list in phase 1: no service worker, no IndexedDB, no SyncManager, no offline mutations, no Fuse.js offline search, no sync status indicator, no pending changes page, no conflict resolution UI
- "Feature parity" means: same pages, same CRUD operations, same auth flows, same i18n, same settings -- all via direct API calls
- Remove the offline-related routes from the frontend2 route config: no `/sync-history`, no `/my-changes`
- Replace offline-capable components with simpler online-only versions (e.g., regular API-backed search instead of Fuse.js)

**Warning signs:**
- Importing from `lib/sync/`, `lib/db/`, or `lib/hooks/use-offline-*` in frontend2
- IndexedDB or service worker references in frontend2 code
- Phase estimates ballooning because of "but frontend1 does it this way" discussions

**Phase to address:**
Phase 1 (scaffold) -- document the explicit exclusion list. Reference it in every phase plan.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copy-paste components from frontend1 and adapt | Fast initial feature parity | Carries Next.js idioms, creates dual maintenance when fixing bugs | Never for structural code (layouts, routing, API client). Acceptable for pure business logic (form validation rules, date formatting) |
| Inline retro styles instead of design tokens | Quick prototyping of retro look | Inconsistent styling, impossible to adjust theme globally, dark mode becomes a full rewrite | Only in phase 1 throwaway prototypes. Must extract to tokens before phase 2 ends |
| Skip i18n wiring in early phases | Faster initial development | Retrofitting i18n to 50+ components is painful and error-prone | Never. Wire up i18n from component number one, even if only EN exists initially |
| Hardcode Vite dev port in backend CORS | Quick unblock | Breaks when port changes, forgotten in production deploy | Acceptable for day-one dev, but add env var config in same PR |
| Skip dark mode for retro theme | Simpler initial CSS | Users expect theme toggle (frontend1 has it). Retrofitting dark mode to a retro palette is a full design rework | Acceptable if dark mode is deferred to a later phase AND design tokens support it from day one |
| Use browser fetch directly instead of API client wrapper | No abstraction overhead | No centralized error handling, no auth token injection, no workspace header, inconsistent patterns | Never. Build a thin API client in phase 1 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| JWT Auth (localStorage) | Assuming tokens are shared between frontends on same domain | Different ports = different localStorage. Each frontend manages its own token independently. This is correct behavior -- don't try to share tokens |
| OAuth Callback | Expecting backend to redirect to frontend2 automatically | Backend redirects to single `APP_URL`. Must modify backend to support multiple redirect targets (see Critical Pitfall 1) |
| SSE Connection | Creating per-component EventSource instances | Use a single shared EventSource via React context, same pattern as frontend1's `SSEProvider`. The EventSource API is browser-standard and identical in Vite |
| File Upload (photos) | Expecting a Next.js API route proxy for uploads | Frontend2 must upload directly to the Go backend. Construct multipart/form-data requests directly against `/api/v1/workspaces/{id}/items/{id}/photos` |
| Workspace Header | Forgetting `X-Workspace-ID` header on API calls | Frontend1's API client attaches this automatically. Frontend2's client must do the same. CORS config already allows it (verified in `cors.go` line 55) |
| Cookie-based OAuth State | Assuming cookies work cross-origin in dev | OAuth CSRF state is stored in HttpOnly cookies set by the backend on port 8000. Both frontends hit the same backend, so cookies work. In production with different subdomains, verify `SameSite` and `Domain` attributes |
| Theme Sync | Trying to reuse `next-themes` + `ThemeSyncer` | `next-themes` is Next.js-specific. Use a simple React context with localStorage + backend preference sync for frontend2 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Retro CSS box-shadow/border stacking | Janky scrolling on mobile, high paint times in DevTools | Use CSS `outline` instead of `box-shadow` for thick borders, avoid `filter: drop-shadow` on list items, use `will-change: transform` sparingly | 50+ items in a scrollable list with beveled borders and shadows |
| Custom retro font file size | Slow first contentful paint, FOUT (flash of unstyled text) | Use system monospace stack (`ui-monospace, 'Cascadia Code', 'Fira Code', monospace`) for body text. Only load a custom retro font for headings, with `font-display: swap` | When custom font exceeds 100KB and the page has meaningful text above the fold |
| Unoptimized images without Next.js Image component | Layout shift on load, full-resolution photos downloaded for thumbnails | Implement `loading="lazy"`, use the backend's thumbnail endpoints, add `srcset` with width descriptors, set explicit `width`/`height` attributes | Item list pages with 20+ photo thumbnails |
| Re-rendering on SSE events | Entire page re-renders when any SSE event arrives | Memoize SSE context value object, use selective subscription (subscribe to specific event types, not all), split SSE state from render tree | When SSE sends events every few seconds (e.g., another user editing items) |
| All translation bundles loaded at once | 100KB+ JSON parsed on every page load | Use `react-i18next` lazy backend to load only the active language, split by namespace if translations grow large | When translation files exceed 50KB per language (current EN is already 1,198 lines) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Relaxing CORS to wildcard during dev and shipping it | Any origin can make authenticated API calls with user's cookies/tokens | Never use `Access-Control-Allow-Origin: *` with credentials. Add frontend2's exact production origin to `CORS_ALLOWED_ORIGINS` |
| Exposing secrets via Vite env vars | Vite bundles ALL `VITE_*` prefixed env vars into the client JS, visible in source | Only prefix with `VITE_` what is truly public (API URL). Never put API keys, secrets, or internal URLs in `VITE_*` vars |
| Missing auth guard on frontend2 routes | Unauthenticated users see dashboard shell/layout before redirect to login | Implement route-level auth check in React Router's `loader` function or a wrapper component. Redirect to `/login` before any dashboard component mounts |
| OAuth state parameter validation gap | If frontend2 sends its own `redirect_to` param, ensure the backend validates it against an allowlist | Open redirect vulnerability if `redirect_to` is not validated. Backend must check against `ALLOWED_FRONTEND_URLS` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Retro aesthetic applied uniformly to all surfaces | Data-heavy pages (item tables, import results) become unreadable due to visual noise | Apply retro chrome to navigation, headers, and panel frames. Use clean, minimal styling for data content areas |
| Pixel-art icons at small sizes | Icons become unrecognizable blobs below 24px on high-DPI screens | Use clean vector icons (Lucide, Phosphor) with retro color palette. Reserve pixel art for decorative elements only |
| Scanner/camera UI with heavy retro borders | Camera viewfinder obscured by decorative elements, reduced capture area | Camera/scanner should be full-bleed with minimal overlay. Apply retro styling only to surrounding UI chrome |
| Hazard stripes everywhere | Users become "stripe blind" and miss actual warnings/destructive actions | Reserve hazard stripes exclusively for destructive actions (delete account, overwrite data) and error states |
| Monospace font in form inputs | Input fields feel like code editors, intimidating for non-technical household users | Use monospace for display values (SKU, barcode, IDs) but proportional font for text input fields |
| Missing retro-styled loading/empty states | Jarring switch between styled retro UI and generic browser spinners or blank space | Design retro-themed skeleton loaders, empty states ("No items in this warehouse"), and error screens as part of the core design system |
| Inconsistent retro intensity between pages | Some pages feel intensely retro, others feel generic -- breaks immersion | Define retro "intensity levels" in design tokens and assign consistently by page type |

## "Looks Done But Isn't" Checklist

- [ ] **Auth flow:** Login/register works with email/password, but OAuth redirect goes to frontend1 -- verify full OAuth roundtrip completes within frontend2
- [ ] **i18n:** English works perfectly, but Estonian file has untranslated or missing keys -- verify all keys exist in both EN and ET files, test with locale switcher
- [ ] **Dark mode:** Light retro theme looks correct, but dark variant has unreadable contrast on retro borders/panels -- verify WCAG AA in both themes with automated tooling
- [ ] **Mobile layout:** Desktop retro panels look great, but thick borders consume 20-30% of 375px mobile viewport width -- verify all pages on iPhone SE viewport (375x667)
- [ ] **Table pagination:** First page renders correctly, but page 2+ fails because cursor/offset logic differs from frontend1's implementation -- verify multi-page table navigation with 50+ items
- [ ] **File upload:** Upload button appears and opens file picker, but multipart form encoding or auth header is wrong -- verify photo upload end-to-end including thumbnail generation
- [ ] **SSE reconnection:** Real-time events work on initial page load, but after laptop sleep/wake or network change, the connection is dead with no auto-reconnect -- verify reconnection behavior
- [ ] **Route guards:** Dashboard pages render content, but direct URL access without auth token shows a flash of dashboard layout before redirecting to login -- verify no content flash on protected routes
- [ ] **Format preferences:** Dates display in default format, but user's DD/MM/YYYY preference from settings is not applied -- verify format hooks work with user preferences API
- [ ] **Connected accounts:** OAuth account list shows in settings, but unlink/link flows fail because exchange endpoint has CORS issues -- verify full OAuth account management flow

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OAuth redirect locked to frontend1 | MEDIUM | Add `redirect_to` param to OAuth initiate, validate against allowlist, store in state cookie, use in callback redirect. About 2 hours of backend work plus testing |
| CORS not configured | LOW | Add origin to `cors.go` hardcoded dev list + set `CORS_ALLOWED_ORIGINS` env var for production. 5-minute fix |
| Next.js patterns leaked into codebase | HIGH | Audit all files for `"use client"`, `process.env.NEXT_PUBLIC_*`, `next/*` imports, replace systematically. Cost grows linearly with number of files written before detection |
| Retro design unusable at scale | HIGH | Requires design token adjustment, border width reduction, color contrast fixes, potentially reskinning all components. Much cheaper if tokens were used from the start (just change token values) vs. if styles were inlined (touch every file) |
| API client drift between frontends | MEDIUM | Diff the two API clients, reconcile type definitions, backport fixes. Harder the longer it goes unnoticed -- set up shared types from the start |
| i18n translation key drift | MEDIUM | Write script to diff translation keys, add missing keys, test both locales. Prevent with CI check |
| Scope creep into offline features | HIGH | Remove offline code, simplify to direct API calls. Expensive because offline patterns affect component design, state management, and data flow throughout the app |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OAuth redirect lock-in | Phase 1 (scaffold) -- backend change required | OAuth login initiated from frontend2 redirects back to frontend2 after provider auth |
| CORS not configured | Phase 1 (scaffold) -- backend change required | API call from `localhost:5173` returns correct `Access-Control-Allow-Origin` header |
| Next.js pattern leakage | Phase 1 (scaffold) -- establish conventions | Zero `next/*` imports, zero `"use client"` directives, zero `process.env.NEXT_PUBLIC_*` references |
| Retro design unusability | Phase 2 (design system) -- design tokens + components | WCAG AA contrast audit passes; 50-item table is scannable; tested on 375px mobile viewport |
| API client drift | Phase 1 (scaffold) -- shared types package | Both frontends reference identical TypeScript interfaces for API types |
| i18n translation drift | Phase 1 (scaffold) -- shared translation files | CI check confirms key parity between frontend1 and frontend2 translation files |
| Offline scope creep | Phase 1 (scaffold) -- explicit exclusion list | Zero imports from `lib/sync/`, `lib/db/`, or offline-related modules in frontend2 |
| SSE handling | Phase where notifications/real-time features ship | SSE reconnects after sleep/wake; no connection leaks after 1 hour of use |
| CSS performance | Phase 2 (design system) -- performance budget | Scroll performance profiled on mobile with 50+ beveled list items, no janky frames |
| Images without Next.js | Phase where item photos are displayed | Photos lazy-load, no layout shift (CLS < 0.1), responsive thumbnails served |
| Feature parity verification | Final phase -- integration testing | Side-by-side comparison of all pages between frontend1 and frontend2 |

## Sources

- Codebase: `backend/internal/api/middleware/cors.go` -- CORS allowlist with hardcoded origins and `CORS_ALLOWED_ORIGINS` env var
- Codebase: `backend/internal/domain/auth/oauth/handler.go` -- OAuth redirect uses single `cfg.AppURL` (lines 258, 415-420)
- Codebase: `backend/internal/config/config.go` -- `APP_URL` defaults to `http://localhost:3000` (line 92)
- Codebase: `frontend/lib/api/client.ts` -- API client uses `process.env.NEXT_PUBLIC_API_URL` (line 1)
- Codebase: `frontend/lib/api/*.ts` -- 3,400+ total lines of API code with scattered Next.js env var references
- Codebase: `frontend/messages/en.json` -- 1,198 lines of nested translation JSON
- Codebase: 177 files with `"use client"` directives that would be meaningless in Vite
- Codebase: 94 components importing from `next-intl` translation hooks
- Codebase: `frontend/lib/hooks/use-sse.ts` and `frontend/lib/contexts/sse-context.tsx` -- SSE implementation with Next.js env var dependency
- WCAG 2.1 AA contrast requirements (4.5:1 for normal text, 3:1 for large text)

---
*Pitfalls research for: Retro frontend2 for home inventory system*
*Researched: 2026-04-08*
