# Phase 49: Auth & API Client - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Login, register, logout, route protection, JWT-based API client, and OAuth social login buttons for the retro frontend (`/frontend2`). Users can authenticate with email/password or Google/GitHub OAuth and access protected routes.

</domain>

<decisions>
## Implementation Decisions

### Auth Form Layout
- **D-01:** Single page with tab toggle between Login and Register tabs -- matches BAM reference image 5 exactly (two tabs at top, form content switches below).
- **D-02:** Decorative red X close button in the corner of the auth panel -- present for retro aesthetic, non-functional (no navigation target).
- **D-03:** No guest mode -- the app requires authentication. The "Enter as Guest" button from BAM ref is visual inspiration only, not a feature.

### Social OAuth
- **D-04:** Include Google and GitHub OAuth buttons on the auth form below email/password fields, separated by an "OR" divider. Backend already supports the full OAuth flow.
- **D-05:** Dedicated `/auth/callback` route that reads the authorization code from URL params, calls the backend exchange endpoint (`/auth/oauth/exchange`), stores the token, and redirects to dashboard.

### Error & Validation
- **D-06:** Inline banner style for auth errors -- colored text message inside the form panel (red for errors, green for success), appearing between form fields and submit button. Matches BAM ref 5 message format. No per-field inline validation.

### API Client
- **D-07:** Build a lightweight fetch wrapper for frontend2 (not a port of frontend1's class-based ApiClient). Online-only SPA doesn't need the complexity of workspace headers, offline detection, or SSR URL switching.

### Claude's Discretion
- Guest mode decision: Claude decided no guest mode (app requires auth)
- Token refresh mechanism (HttpOnly cookie silent refresh)
- Auth context/provider architecture
- Route guard implementation pattern
- Form state management approach
- Register form fields (name, email, password, confirm password -- standard set)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Design Reference
- `.planning/references/retro-ui/5.png` -- BAM auth forms: login/register with thick borders, inline validation, toggle switches, text button states, error/success/info messages

### Backend Auth API (existing)
- `frontend/lib/api/auth.ts` -- Frontend1 auth API functions (login, register, logout, getMe, exchangeOAuthCode) -- reference for endpoint contracts
- `frontend/lib/api/client.ts` -- Frontend1 API client with JWT + HttpOnly cookie auth -- reference for auth flow patterns
- `backend/internal/api/router.go` -- Backend route definitions including OAuth endpoints

### Project Context
- `.planning/ROADMAP.md` -- Phase 49 success criteria (AUTH-01 through AUTH-05)
- `.planning/PROJECT.md` -- v2.0 milestone context, tech stack decisions
- `.planning/phases/48-project-scaffold/48-CONTEXT.md` -- Phase 48 decisions (retro design tokens, directory layout, BAM aesthetic)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend2/src/routes/index.tsx` -- Existing route structure with `RetroPanel` component and `NavBar` -- auth pages should use similar retro panel wrapping
- `frontend2/src/lib/i18n.ts` -- Lingui i18n already configured -- auth strings should use `t` macro
- `frontend2/src/styles/` -- Retro Tailwind tokens available (bg-retro-cream, border-retro-thick, shadow-retro-raised, etc.)

### Established Patterns
- Tailwind CSS 4 with retro design tokens for all styling
- React Router v7 library mode for routing
- Lingui v5 `t` macro for i18n strings
- BrowserRouter wrapping in App.tsx

### Integration Points
- Vite proxy already configured to forward `/api/*` to Go backend on port 8080
- `features/auth/` directory exists (empty) -- auth components go here
- `lib/` directory exists -- API client and auth utilities go here
- Routes defined in `routes/index.tsx` -- needs auth routes and route guards added
- App.tsx -- needs auth context provider wrapping

</code_context>

<specifics>
## Specific Ideas

- Tab toggle matches BAM ref 5 pixel-accurately -- two file-folder tabs at top switching between LOGIN and REGISTER forms
- Red X close button is decorative only -- retro aesthetic element
- OAuth buttons styled as retro beveled buttons with provider icons, separated from email/password by an "OR" divider
- Error messages use BAM's inline text format (red for errors, positioned between fields and submit button)

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 49-auth-api-client*
*Context gathered: 2026-04-09*
