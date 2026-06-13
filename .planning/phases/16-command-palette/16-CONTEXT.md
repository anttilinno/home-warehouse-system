# Phase 16 — Command Palette — CONTEXT

**Requirement:** TUI-05. **Surface:** frontend-only (no Go). **Branch base:** current HEAD.

## Goal (3 Success Criteria, from ROADMAP/REQUIREMENTS)
1. **Cmd+K / Ctrl+K / F2** opens a `cmdk`-driven command palette with full-screen retro-panel chrome.
2. Typing **fuzzy-filters** across **routes + recent actions + workspaces**.
3. **Arrow-key navigate, Enter select, ESC dismiss**; `tinykeys` owns the open chord, `cmdk` owns filtering inside.
4. **Parity merge (§4, docs/FRONTEND2_FEATURE_PARITY_PLAN.md:229-230):** fold the legacy global entity-search dropdown INTO the palette — one surface for nav + per-entity search. Live, debounced entity results section.

## Verified surface (file:line)

### Mount point — DECIDED
`frontend2/src/components/layout/AppShell.tsx:80 ShellChrome` — sits INSIDE `WorkspaceProvider` (`:62`) + under `QueryClientProvider` + `BrowserRouter`. This is the ONLY place that has wsId (`useWorkspace`), query client (entity search), AND `useNavigate`. Palette is authed-only (entity search + workspaces need a session) → mount here, exactly like the existing `helpOpen` + `<F1HelpDialog>` pattern (`:86`, `:148-153`). Owner holds `[paletteOpen, setPaletteOpen]`.

### Open-chord listener — tinykeys (NEW dep), NOT useShortcuts
- `frontend2/src/components/shortcuts/ShortcutsContext.tsx:67-82` — the single global keydown handler **returns early on `e.metaKey || e.ctrlKey || e.altKey`** (`:70`) and only matches bare single chars. So **Cmd+K / Ctrl+K can NEVER reach it** — no collision. F2 also won't match (no group registers "F2").
- Therefore the open chord lives in a **separate tinykeys listener**, per the ROADMAP contract ("tinykeys owns the open chord, cmdk owns filtering inside"). tinykeys `"$mod+k"` (⌘ on mac / Ctrl elsewhere) + `"F2"`. tinykeys fires regardless of focus → palette opens even from inside an input (desired — global). Do NOT gate it through `isEditableTarget`.
- **Render-loop landmine (recurring 4×):** set up the tinykeys listener in a `useEffect(…, [])` mounted ONCE; toggle open via the stable `setPaletteOpen` setter. No fresh fns/objects in deps.

### ESC dismiss — reuse modal stack
- `frontend2/src/components/modal/useModalStack.ts:17` — `useModalStack(isOpen: boolean, onClose: () => void): void`. Call inside the palette body with `useModalStack(open, onClose)`. Capture-phase ESC (`ModalStackContext`) pops the TOPMOST overlay first → ESC closes the palette before any underlying dialog (TUI-02 contract). `onClose` read through a ref → fresh closure each render does NOT churn the stack.

### Filtering — cmdk owns it
- cmdk provides arrow/Enter/keyboard nav + fuzzy filter (`command-score`) out of the box.
- **Async/live entity-search pattern:** set cmdk **`shouldFilter={false}`** and filter the small static groups (routes/workspaces/recent ~20 items) ourselves with a trivial substring/`command-score` pass; entity results arrive pre-filtered from the server. Keyboard nav still works with filtering off. (Mixing cmdk's built-in filter with async server results double-filters and hides valid rows — disable it.) Planner: confirm exact cmdk API for React 19; legacy `frontend/` already ships `cmdk@^1.1.1`.

### Palette content — 4 source groups
1. **Routes** — static nav list. Source of truth is inline in `Sidebar.tsx:140-167` (`<NavItem to=… label=…>`), NOT exported. DECISION: define a small `paletteRoutes` array in the palette feature (≈17 entries: Dashboard `/`, Analytics `/analytics`, Items `/items`, Inventory `/inventory`, Maintenance `/maintenance/due`, Locations `/taxonomy?tab=locations`, Containers `/taxonomy?tab=containers`, Categories `/taxonomy?tab=categories`, Loans `/loans`, Borrowers `/borrowers`, Scan `/scan`, Approvals `/approvals`, My Changes `/my-changes`, Wishlist `/wishlist`, Declutter `/declutter`, Imports `/imports`, Sync History `/sync-history`, Settings `/settings`). Duplicating keeps `Sidebar.tsx` untouched (single-writer file) — acceptable for ~17 static rows. Labels via `<Trans>`/`t` so they stay i18n + et/ru-translated (Phase 15 catalog guard fails CI on new untranslated msgids — run `bun run i18n:extract` + fill et/ru).
2. **Workspaces** — `frontend2/src/features/workspace/useWorkspace.ts:11` → `{ currentWorkspaceId, setWorkspace, workspaces, isLoading }`; query key `["workspaces"]`; `setWorkspace(id)` persists + invalidates all caches (no reload). Workspace `{ id, name }`. Palette workspace row → `setWorkspace(id)` then close.
3. **Recent actions** — NO MRU store exists. BUILD `frontend2/src/features/command-palette/recentActions.ts` mirroring `frontend2/src/lib/scanner/scan-history.ts` (localStorage rolling list, de-dup by id, cap 10, newest first, safe-on-bad-JSON returns `[]`). Storage key e.g. `"hws-palette-recent"`. Record on every palette selection (nav OR entity). **LINT LANDMINE:** `lint:imports` (FOUND-02) substring-matches `sync`/`idb`/`offline` — `palette`/`recent`/`command`/`cmdk`/`tinykeys` are all SAFE; do NOT name anything `*sync*`.
4. **Live entity search (parity merge)** — debounced (~250ms; mirror `frontend2/src/features/taxonomy/hooks/useTaxonomySearch.ts` DEBOUNCE_MS=250) query when input length ≥2. Endpoints that EXIST in frontend2 `src/lib/api/`:
   - Items: `itemsApi.list(wsId, { search, limit })` → `ItemListResponse` (paginated; use `search` + small `limit`). Row → `/items/{id}`.
   - Borrowers: `borrowersApi.search(ws, q, limit≤100)` → `Borrower[]`. Row → `/borrowers/{id}`.
   - Locations: `locationApi.search(ws, q, limit≤100)` → `Location[]` (unwrapped). Row → `/taxonomy?tab=locations` (no per-location detail route — navigate to the tab; planner confirm).
   - Containers: `containerApi.search(ws, q, limit≤100)` → `Container[]` (unwrapped). Row → `/taxonomy?tab=containers`.
   - Categories / Loans / Inventory: list-only, NO `/search`. Scope entity search to items+borrowers+locations+containers (matches legacy `globalSearch` grouping exactly: items/borrowers/containers/locations). Query keys PREFIXED by domain: `[domain, wsId, "search", q]` (Lock #4 pattern).
   - **Backend `limit` caps 100** → clamp every search ≤100 (422 over). Use small limit (e.g. 5) per group like legacy `globalSearch` default.

### Chrome / aesthetic
- Full-screen retro-panel overlay (SC-1). Reuse retro atoms; the palette is its own overlay (NOT the F1 `RetroDialog` titlebar shell necessarily, but match the retro-os pastel direction — pinstriped title bar, Silkscreen heading, IBM Plex body). **Load `sketch-findings-home-warehouse-system` skill before styling** (tokens: `danger=#b73348`, titlebar-blue/pink, bevel-raised-ink, etc.). cmdk renders unstyled `Command`/`CommandInput`/`CommandList`/`CommandItem`/`CommandGroup` — skin them with retro tokens.
- Focus: cmdk autofocuses input; restore invoker focus on close (RetroDialog already does this `:78-79` if used as wrapper).

### Code-split (POL-04 bundle budget)
- `frontend2/vite.config.ts:55-94` manualChunks. Add a `palette` chunk rule for `cmdk` + `command-score`. The palette BODY is `React.lazy`-loaded (only pulled when first opened); the tiny tinykeys open-chord owner stays in main (tinykeys ≈ <1KB). Pattern mirrors `scanner`/`charts` lazy chunks. Verify after build: cmdk appears ONLY in `palette-*.js`, entry `index-*.js` is cmdk-free (bundle gate, like 13b-01).

## Deps to ADD (frontend2/package.json) — RESEARCH-CONFIRMED
- `cmdk@1.1.1` (peer range `^18 || ^19 || ^19.0.0-rc` — clean on React 19.2, same pin as legacy `frontend/`). **`command-score` is VENDORED inside cmdk — do NOT install separately.**
- `tinykeys@4.0.0` (current, published 2026-05-20, ESM-first, ≈2.4KB gz).
- Run `bun install` (lockfile updates — executor uses `--frozen-lockfile` AFTER deps land; the dep-adding plan runs a normal `bun install` and commits the lockfile).

## RESEARCH OVERRIDES (2 — supersede earlier assumptions in this doc)
- **OVERRIDE A — tinykeys v4 ignores inputs by default.** tinykeys@4.0.0's `defaultKeybindingsHandlerIgnore` skips keydown from `input`/`textarea`/`select`/`[contenteditable]`. Bound to `window`, ⌘K/F2 will **NOT fire while an input is focused** unless you pass `tinykeys(window, {...}, { ignore: () => false })`. The open chord IS global → **pass `{ ignore: () => false }`**, and `event.preventDefault()` in the handler to stop a literal "k" landing in the focused input. (Supersedes the "fires regardless of focus" note in the Open-chord section above.)
- **OVERRIDE B — cmdk hard-imports `@radix-ui/react-dialog` at module top-level** (non-tree-shakable). The lazy `palette` chunk carries cmdk (~5KB gz) **+ the radix-dialog tree (~10–15KB gz)**. → The `vite.config.ts` manualChunks rule MUST route **both `cmdk` AND `@radix-ui/react-dialog`** into the `palette` chunk, and the bundle gate must assert BOTH are absent from entry `index-*.js`. Code-splitting is clearly worthwhile (≈15-20KB gz off main). `@radix-ui/react-dialog` is pulled transitively by cmdk — no separate install needed, but confirm it's hoisted in the lockfile.

## RESEARCH-confirmed API facts
- cmdk exports work BOTH as `Command.Input`/`Command.List`/… dot-notation AND named `CommandInput`/`CommandList`/`CommandItem`/`CommandGroup`/`CommandEmpty`/`CommandLoading`/`CommandSeparator`. `onSelect: (value: string) => void`.
- `shouldFilter={false}` CONFIRMED correct; arrows/Home/End/Enter walk the DOM independent of filtering — all rendered rows stay navigable.
- **Stable selection across async updates:** cmdk auto-selects first row only `if (!value)` → use controlled `value`/`onValueChange` with **stable id-based item values** (`item:${id}`, NOT display text) to prevent flicker/jump when entity results arrive.
- QA note: cmdk's default `vimBindings` make Ctrl+K = "move selection up" INSIDE the input (no collision with the window-level open chord — leave vim bindings on).

## Open Questions (for researcher)
- OQ1: cmdk@1.1.1 React-19 peer compatibility + the canonical async/`shouldFilter={false}` pattern + how `CommandItem` `value`/`onSelect` + keyboard nav behave with filtering disabled.
- OQ2: tinykeys `"$mod+k"` + `"F2"` binding syntax, cleanup return, and SSR/StrictMode double-bind safety.
- OQ3: Does opening from inside a focused `<input>` (tinykeys default fires) need `e.preventDefault()` to stop a literal "k" being typed? (Yes — confirm tinykeys passes the event for preventDefault.)
- OQ4: bundle weight of cmdk+command-score gzip (POL-04 budget headroom).

## Open Questions (RESOLVED inline above)
- Mount point → ShellChrome (WorkspaceProvider scope). RESOLVED.
- Open chord owner → separate tinykeys listener (ShortcutsProvider ignores modifier combos). RESOLVED.
- ESC → reuse `useModalStack(open, onClose)`. RESOLVED.
- Entity search scope → items/borrowers/locations/containers (the 4 with `/search` or `?search`), matching legacy globalSearch grouping. RESOLVED.
- Routes list → palette-local `paletteRoutes` array (Sidebar not exported, keep it single-writer). RESOLVED.
- MRU → build localStorage module mirroring scan-history.ts. RESOLVED.
