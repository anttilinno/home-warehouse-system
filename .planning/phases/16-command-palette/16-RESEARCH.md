# Phase 16: Command Palette - Research

**Researched:** 2026-06-13
**Domain:** React 19 command palette (cmdk filtering UI + tinykeys global chord) in a Vite/TS SPA
**Confidence:** HIGH (all claims verified against published package source + npm registry this session)

## Summary

`cmdk@1.1.1` formally declares React 19 support in its peer range (`^18 || ^19 || ^19.0.0-rc`) and is the package the legacy `frontend/` already ships, so frontend2 can pin the same version with zero peer warnings. The library is unstyled (CSS-attribute hooks only: `[cmdk-root]`, `[cmdk-item]`, etc.), exposing both dot-notation (`Command.Input`) and named (`CommandInput`) component surfaces from one module — either import style works.

`tinykeys@4.0.0` is the current release (published 2026-05-20), ESM-first, ~2.4KB gzip, and gives exactly the `tinykeys(window, { "$mod+k": fn, "F2": fn })` syntax the ROADMAP names. `$mod` maps ⌘ on mac / Ctrl elsewhere, handlers receive the `KeyboardEvent` (so `event.preventDefault()` works), and the subscribe call returns an unsubscribe function for clean `useEffect` teardown.

**Two findings override CONTEXT.md assumptions and MUST reach the planner:**
1. **tinykeys 4.0.0 ignores keydown events originating from `input`/`textarea`/`select`/`[contenteditable]` by default** (its `defaultKeybindingsHandlerIgnore`). Because we bind to `window`, a focused input is never `currentTarget`, so **`$mod+k`/`F2` will NOT fire while the user is typing in a form field** unless we pass a custom `ignore` option. CONTEXT.md line 18 ("tinykeys fires regardless of focus") is wrong for v4. Fix: supply `{ ignore: () => false }` (or a narrowed predicate).
2. **cmdk imports `@radix-ui/react-dialog` as a top-level `import * as` in its single bundled module** — it does NOT tree-shake out even when you avoid `CommandDialog` and supply your own overlay. So the `palette` lazy chunk will carry cmdk (~5KB gz) **plus** the radix-dialog dependency tree. This makes the code-split decision (CONTEXT.md §Code-split) clearly worthwhile, not marginal.

**Primary recommendation:** Pin `cmdk@^1.1.1` + `tinykeys@^4.0.0`. Drive cmdk in fully-controlled mode (`value`/`onValueChange` + `shouldFilter={false}`), set up the tinykeys listener once in a `useEffect(…, [])` with a custom `ignore`, and React.lazy the palette body into the `palette` chunk to keep cmdk + radix-dialog out of the entry bundle.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Global open chord (⌘K/Ctrl+K/F2) | Browser/Client (window keydown via tinykeys) | — | Keyboard is a browser-level event source; chord owner lives in main bundle |
| Filtering / keyboard nav inside palette | Browser/Client (cmdk in lazy chunk) | — | cmdk is a pure client-side ARIA combobox; no server involvement |
| Static groups (routes/workspaces/recent) | Browser/Client (in-memory + localStorage) | — | Small fixed lists; client-filtered |
| Live entity results | API/Backend (`/search` endpoints) | Browser/Client (debounce + React Query) | Server owns the search index; client owns debounce + cache + render |
| ESC dismiss | Browser/Client (existing modal stack) | — | Reuses `useModalStack` capture-phase popping |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cmdk` | `^1.1.1` | Command-menu primitive: ARIA combobox, filtering, arrow/Enter nav, groups | De-facto React palette lib; already pinned in legacy `frontend/`; React 19 peer-declared [VERIFIED: npm registry — `npm view cmdk peerDependencies`] |
| `tinykeys` | `^4.0.0` | Global keybinding subscription for the open chord | Tiny (~2.4KB gz), ESM, `$mod` cross-platform, handler gets the event for `preventDefault` [VERIFIED: npm registry + dist source] |

`command-score` ships **inside** cmdk's dist (bundled chunk, not a separate runtime dep at our level) — no separate install needed. It is cmdk's fuzzy scorer; you only import it directly if you want to reuse cmdk's exact scoring for the client-side static-group filter (optional — a substring match is fine for ~20 rows).

### Supporting (already in frontend2 — no install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | `^5.100.7` | Debounced entity-search queries, cache by `[domain, wsId, "search", q]` | Live entity results section |
| `react-router` | `^7.14.2` | `useNavigate` for route + entity selection | onSelect handlers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk | kbar | kbar is heavier, opinionated chrome, its own action registry — fights the custom retro overlay + per-entity async wiring CONTEXT.md already specified. cmdk is the locked choice. |
| tinykeys | `react-hotkeys-hook` | Heavier, hook-per-binding ergonomics, more re-render surface. tinykeys' single window subscription is the better fit for one mount-once listener. |

**Installation:**
```bash
cd frontend2 && bun add cmdk@^1.1.1 tinykeys@^4.0.0
```

**Version verification (this session):**
- `cmdk` latest = `1.1.1` (published 2025-03-14). Peer: `react: ^18 || ^19 || ^19.0.0-rc`, `react-dom` same. [VERIFIED: `npm view cmdk version peerDependencies time`]
- `tinykeys` latest = `4.0.0` (modified 2026-05-20), `"type": "module"`, exports both `.mjs` (import) and `.cjs` (require). [VERIFIED: `npm view tinykeys version type exports`]
- `command-score` standalone latest = `0.1.2`, but **bundled in cmdk dist** — do not add separately. [VERIFIED: dist inspection]

## Package Legitimacy Audit

> slopcheck could not be installed in this environment (`pip install slopcheck` unavailable). Per protocol, packages are downgraded to `[ASSUMED]` and the planner should gate installs behind a verify step. However, both packages have overwhelming registry-trust signals (downloads, age, established source repos) that materially de-risk them — see table.

| Package | Registry | Age | Downloads (last wk) | Source Repo | slopcheck | Disposition |
|---------|----------|-----|---------------------|-------------|-----------|-------------|
| `cmdk` | npm | published since 2022; 1.1.1 = 2025-03-14 | 40,853,513 | github.com/pacocoursey/cmdk | unavailable | Approved (already in legacy `frontend/`) |
| `tinykeys` | npm | 4.0.0 = 2026-05-20 (mature lib, jamiebuilds) | 216,757 | github.com/jamiebuilds/tinykeys | unavailable | Approved |
| `command-score` | npm | 0.1.2 | 181,073 | (bundled in cmdk) | unavailable | Not installed (vendored in cmdk) |

**Postinstall script check:** `npm view cmdk scripts.postinstall` and `npm view tinykeys scripts.postinstall` both return empty — no postinstall hooks. [VERIFIED]
**Packages removed due to [SLOP]:** none
**Packages flagged [SUS]:** none (slopcheck unavailable; planner should treat install as `[ASSUMED]` and run a single verify step — both have 200K+ and 40M+ weekly downloads and known maintainers, so risk is minimal).

## Architecture Patterns

### System Architecture Diagram

```
  ⌘K / Ctrl+K / F2 keydown (window)
        │
        ▼
  tinykeys listener  ──(useEffect [], custom ignore)──►  event.preventDefault()
   (stays in MAIN bundle, ~2.4KB)                              │
        │ setPaletteOpen(true)                                 │
        ▼                                                      ▼
  paletteOpen state (ShellChrome owner)            (stops literal "k" being typed)
        │
        │ paletteOpen && <Suspense><LazyPaletteBody/></Suspense>
        ▼
  ┌─────────────────── PALETTE LAZY CHUNK (cmdk + radix-dialog) ──────────────────┐
  │  <Command value={value} onValueChange={setValue} shouldFilter={false}>        │
  │     <CommandInput value={query} onValueChange={setQuery} />  ──► debounce 250ms │
  │     <CommandList>                                                              │
  │        CommandGroup "Routes"      ← static, client substring-filtered          │
  │        CommandGroup "Workspaces"  ← useWorkspace(), client-filtered            │
  │        CommandGroup "Recent"      ← localStorage MRU                           │
  │        CommandGroup "Items/Borrowers/Locations/Containers"                      │
  │              ▲ React Query [domain, wsId, "search", q]  ──►  /api .../search    │
  │        CommandEmpty / CommandLoading                                           │
  │     </CommandList>                                                             │
  │  </Command>                                                                    │
  │  useModalStack(open, onClose)  ← capture-phase ESC pops topmost overlay        │
  └───────────────────────────────────────────────────────────────────────────────┘
        │ onSelect(value) → record MRU → navigate()/setWorkspace() → onClose()
        ▼
  react-router navigate  /  useWorkspace().setWorkspace
```

### Recommended Project Structure
```
frontend2/src/features/command-palette/
├── CommandPalette.tsx        # lazy body: <Command> tree, controlled state, useModalStack
├── usePaletteChord.ts        # tinykeys useEffect([]) — open-chord owner (stays in main)
├── useEntitySearch.ts        # debounced React Query hooks, 4 domains, limit clamp ≤100
├── recentActions.ts          # localStorage MRU (mirror lib/scanner/scan-history.ts)
├── paletteRoutes.ts          # ~17 static route entries with i18n labels
└── index.ts                  # re-export; lazy import target
```
Naming note (CONTEXT.md §3 lint landmine): `lint:imports`/FOUND-02 substring-matches `sync`/`idb`/`offline`. `palette`/`recent`/`command`/`cmdk`/`tinykeys` are all SAFE; never name a file `*sync*`.

### Pattern 1: Confirmed cmdk import surface (React 19)
**What:** cmdk exports a `Command` object with subcomponents AND flat named exports — both styles resolve to the same forwardRef components.
**Verified exports** (from `cmdk@1.1.1/dist/index.d.ts`):
`Command` (root, also `CommandRoot`), `CommandInput`, `CommandList`, `CommandItem`, `CommandGroup`, `CommandEmpty`, `CommandLoading`, `CommandSeparator`, `CommandDialog`, plus `defaultFilter` and the `useCommandState` hook. `Command.Input` === `CommandInput`, etc.
```tsx
// Source: cmdk@1.1.1 dist/index.d.ts (verified this session)
import { Command } from 'cmdk'
// dot-notation: <Command.Input/> <Command.List/> <Command.Item/> <Command.Group/> <Command.Empty/>
// OR named:
import {
  Command, CommandInput, CommandList, CommandItem,
  CommandGroup, CommandEmpty, CommandLoading,
} from 'cmdk'
```

### Pattern 2: Mixed static + async with `shouldFilter={false}` (the canonical pattern)
**What:** Disable cmdk's internal scorer so async server rows are never double-filtered/hidden; you supply already-filtered rows.
**When to use:** Any time some rows come from a server. Locked by CONTEXT.md §Filtering — confirmed correct.
**How keyboard nav behaves with filtering OFF (verified from minified source):**
- Arrow Up/Down, Home/End, and Enter are handled by cmdk's root `onKeyDown` **independent of `shouldFilter`**. Nav walks the DOM list of `[cmdk-item]:not([aria-disabled="true"])`, so **all rendered items remain navigable** with filtering disabled. [VERIFIED: dist source — `Q()`/`X()` walk `querySelectorAll(cmdk-item:not([aria-disabled]))`]
- Enter dispatches a synthetic `cmdk-item-select` event on the selected item → fires that item's `onSelect`. [VERIFIED]
- `CommandItem`'s `onSelect` signature is `(value: string) => void` — it receives the item's resolved `value`. [VERIFIED: dist/index.d.ts]
- **`value` prop is required-in-spirit for async rows:** the typedef warns *"If your `textContent` changes between renders, you must provide a stable, unique `value`."* Give every entity row a stable id-based value (e.g. `value={`item:${item.id}`}`), NOT the display text. [VERIFIED]

```tsx
// Source: cmdk README + dist behavior (verified this session)
const [value, setValue] = useState('')        // controlled SELECTED item
const [query, setQuery] = useState('')         // controlled SEARCH input
const debounced = useDebounced(query, 250)
const entities = useEntitySearch(debounced)    // React Query, fires when length>=2

<Command value={value} onValueChange={setValue} shouldFilter={false} loop>
  <CommandInput value={query} onValueChange={setQuery} placeholder="Search…" />
  <CommandList>
    <CommandEmpty>No results.</CommandEmpty>

    {/* STATIC — client-filter yourself (substring on ~17 rows) */}
    <CommandGroup heading="Routes">
      {paletteRoutes.filter(r => matches(r, query)).map(r => (
        <CommandItem key={r.to} value={`route:${r.to}`} onSelect={() => go(r.to)}>
          {r.label}
        </CommandItem>
      ))}
    </CommandGroup>

    {/* ASYNC — already filtered by the server, render as-is */}
    {entities.isFetching && <CommandLoading>Searching…</CommandLoading>}
    <CommandGroup heading="Items">
      {entities.items.map(it => (
        <CommandItem key={it.id} value={`item:${it.id}`} onSelect={() => go(`/items/${it.id}`)}>
          {it.name}
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</Command>
```

### Pattern 3: Stable selection across async updates (no flicker/jump)
**What goes wrong without this:** when new async rows mount, an uncontrolled cmdk can reset selection to the first item, causing the highlight to jump while the user reads results.
**Verified mechanism (dist source):**
- cmdk only auto-selects the first row when **no value is currently set** — its internal `W()` (sets value to first non-disabled item) runs on item-mount **only `if (!n.current.value)`**. Once a value exists, re-renders/new rows do NOT reset it. [VERIFIED]
- Therefore: **drive `value`/`onValueChange` as controlled state.** Keep the same `value` string across async updates and selection stays put. Because async row `value`s are stable id-based strings (`item:${id}`), a re-fetch that returns the same row keeps it selected.
- **Reset selection deliberately** only when the query changes (e.g. in the debounced-query effect, `setValue('')` so cmdk re-selects the first row of the new result set). Do not reset on every fetch settle.

### Pattern 4: tinykeys open-chord owner (with the input-focus fix)
**What:** One window-level listener, mounted once, fires the chord even while a form input is focused, and prevents the literal key from being typed.
```tsx
// Source: tinykeys@4.0.0 dist/tinykeys.mjs (verified this session)
import { tinykeys } from 'tinykeys'

function usePaletteChord(open: () => void) {
  // stash latest open() in a ref so the effect deps stay []
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open })

  useEffect(() => {
    const unsubscribe = tinykeys(
      window,
      {
        '$mod+k': (e) => { e.preventDefault(); openRef.current() },
        'F2':     (e) => { e.preventDefault(); openRef.current() },
      },
      // CRITICAL: v4 default ignores input/textarea/select/[contenteditable]
      // events because we bind to window (target !== currentTarget).
      // Override so the chord works while typing in a search box.
      { ignore: () => false },
    )
    return unsubscribe          // clean teardown — StrictMode-safe
  }, [])                        // mount once — NO fresh fns in deps
}
```
- `$mod` → `Meta` on `/Mac|iPod|iPhone|iPad/`, else `Control`. [VERIFIED: `MOD = /Mac.../.test(PLATFORM) ? "Meta":"Control"`]
- The handler receives the `KeyboardEvent` → `e.preventDefault()` stops a literal "k" reaching a focused input. [VERIFIED: `handler(event)` in dist]
- Return value of `tinykeys(...)` is an unsubscribe fn that `removeEventListener`s — return it directly from `useEffect` for StrictMode double-mount safety (mount→unmount→mount cleanly re-subscribes). [VERIFIED: dist `return () => target.removeEventListener(...)`]
- F1/F2 modifier-state quirk: tinykeys has a documented Chrome workaround for `getModifierState` on F-keys; bare `"F2"` matches correctly. [VERIFIED: dist comment + `getModifierState` guard]

### Anti-Patterns to Avoid
- **Binding tinykeys inside an effect with non-empty deps** (e.g. `[open]` where `open` is a fresh closure): re-subscribes on every render → the recurring 4× re-render / double-fire bug. Use `[]` + a ref. (CONTEXT.md §3 render-loop landmine.)
- **Leaving cmdk's default `shouldFilter` on with async rows:** double-filters server results and hides valid rows. Always `shouldFilter={false}` here.
- **Using display text as `CommandItem value`:** when the same entity re-renders with changed text, cmdk loses track of selection. Use stable id-based values.
- **Relying on tinykeys firing from inside inputs without `ignore`:** v4 silently swallows it. Always pass the custom `ignore`.
- **Importing `command-score` separately:** it's vendored inside cmdk — a separate install is redundant weight + a needless dep.
- **Using `CommandDialog`** if you want full control of the retro overlay: it wraps radix `Dialog.Root/Portal/Overlay/Content`. You're building a custom overlay (CONTEXT.md §Chrome) — render `<Command>` directly inside your own overlay and let `useModalStack` own ESC. (radix-dialog still bundles regardless — see Bundle Weight.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Combobox keyboard nav (arrows/Home/End/Enter, ARIA `aria-activedescendant`, roving selection) | Custom keydown + index state | cmdk root `onKeyDown` | cmdk already does DOM-ordered nav, loop, scroll-into-view, and full ARIA combobox roles |
| Cross-platform ⌘/Ctrl detection + key parsing | `navigator.platform` sniffing + keydown matching | tinykeys `$mod` | Handles Mac/Win/Linux, AltGraph, F-key Chrome bug, sequences |
| Fuzzy scoring for static groups | Custom scorer | cmdk's vendored `command-score` (`import commandScore from 'command-score'` re-exports the same fn) OR a plain substring match | ~17 rows don't need fuzzy; if you want it, reuse cmdk's, don't write one |
| ESC / overlay stacking | New keydown listener | existing `useModalStack(open, onClose)` | Capture-phase topmost-pop already solves ESC ordering (TUI-02) |

**Key insight:** cmdk + tinykeys cover the two genuinely hard parts (accessible combobox nav, cross-platform chord parsing). The phase's real work is wiring: controlled state, debounced React Query, MRU store, retro skinning.

## Common Pitfalls

### Pitfall 1: tinykeys swallows the chord while typing (v4 default ignore)
**What goes wrong:** ⌘K/F2 does nothing when focus is in any `input`/`textarea`/`select`/`[contenteditable]`.
**Why:** `defaultKeybindingsHandlerIgnore` returns true for form elements unless `target === event.currentTarget`; binding to `window` makes that always false. [VERIFIED: dist source]
**How to avoid:** pass `{ ignore: () => false }` (or a predicate that only ignores `event.isComposing`/`event.repeat`).
**Warning sign:** chord works on the dashboard but not when a search field is focused.

### Pitfall 2: 4× re-render from unstable tinykeys deps
**What goes wrong:** listener re-subscribes each render; rapid double-fire / dropped events.
**Why:** fresh `open`/handler closures in the effect dep array. (CONTEXT.md's documented recurring bug.)
**How to avoid:** `useEffect(..., [])` + `openRef` updated in a separate ref-sync effect. Same recipe for the debounce timer (store timer id in a ref).
**Warning sign:** React DevTools shows the ShellChrome owner re-rendering on keystroke; palette opens twice.

### Pitfall 3: Selection jump on async result arrival
**What goes wrong:** highlight snaps back to row 1 each time a fetch settles.
**Why:** uncontrolled cmdk re-selects first item when value is empty; unstable item `value`s lose tracking.
**How to avoid:** controlled `value`/`onValueChange`, stable id-based item values, reset `value` only on query change (not on fetch settle). [VERIFIED mechanism above]
**Warning sign:** arrow-key position resets mid-typing.

### Pitfall 4: cmdk vim binding Ctrl+k = "move up" inside the input
**What goes wrong:** with focus in `CommandInput`, `Ctrl+k`/`Ctrl+p` moves selection up and `Ctrl+n`/`Ctrl+j` moves down — cmdk's `vimBindings` default `true`. On non-mac, the **open** chord is also Ctrl+k. These don't collide (open chord is handled at window before the palette mounts; once open, the user is unlikely to press Ctrl+k expecting re-open), but if you want to disable vim nav inside the palette, set `vimBindings={false}` on `<Command>`. [VERIFIED: dist `vimBindings:j=!0`, keys `n/j` down, `p/k` up with `ctrlKey`]
**How to avoid:** decide explicitly. Recommendation: leave `vimBindings` on (free power-user nav); it does not break the open chord.

### Pitfall 5: limit clamp / 422
**What goes wrong:** backend returns 422 when `limit > 100`.
**How to avoid:** clamp every search call ≤100 (CONTEXT.md uses small per-group limits like 5). React Query key `[domain, wsId, "search", q]`.
**Warning sign:** entity group empty + 422 in network tab.

## Runtime State Inventory

Not a rename/refactor/migration phase — greenfield feature. Section omitted per protocol, except one durable-state note: the **MRU store writes to `localStorage` key `"hws-palette-recent"`** (new key, no migration; mirror `lib/scanner/scan-history.ts` safe-parse). Nothing else persists.

## Code Examples

### Debounced entity search hook (stable deps)
```tsx
// Pattern mirrors frontend2 useTaxonomySearch (DEBOUNCE_MS=250)
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)  // timer in closure, cleared on change
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

function useEntitySearch(q: string) {
  const { currentWorkspaceId: ws } = useWorkspace()
  const enabled = q.length >= 2 && !!ws
  const limit = 5  // clamp; backend caps 100
  const items = useQuery({ queryKey: ['items', ws, 'search', q], enabled,
    queryFn: () => itemsApi.list(ws!, { search: q, limit }) })
  const borrowers = useQuery({ queryKey: ['borrowers', ws, 'search', q], enabled,
    queryFn: () => borrowersApi.search(ws!, q, limit) })
  // …locations, containers identically
  return { items, borrowers, /* … */, isFetching: items.isFetching || borrowers.isFetching }
}
```

### Lazy chunk wiring (keeps cmdk + radix-dialog out of entry)
```tsx
// In ShellChrome (stays in main bundle):
const CommandPalette = lazy(() => import('@/features/command-palette'))
usePaletteChord(() => setPaletteOpen(true))   // tinykeys owner, tiny, main bundle
…
{paletteOpen && (
  <Suspense fallback={null}>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
  </Suspense>
)}
```
```ts
// vite.config.ts manualChunks (mirror scanner/charts rules):
manualChunks(id) {
  if (id.includes('cmdk') || id.includes('@radix-ui/react-dialog')) return 'palette'
  // …existing rules
}
```
Note: route radix-dialog into the `palette` chunk too — cmdk hard-imports it (see Bundle Weight), so without this rule it can leak into the entry chunk.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tinykeys 1.x global `tinykeys()` fired from inputs by default | tinykeys 2.x+ added `ignore` filter that excludes form elements by default | v2 (carried into 4.0.0) | Must pass `{ ignore: () => false }` for global-from-input behavior |
| cmdk pre-1.0 (React 16/17) | cmdk 1.1.x peer `^18 || ^19` | 1.1.0 (2025-03-14) | React 19 supported with no shim |

**Deprecated/outdated:** none relevant. `react-router-dom` is folded into `react-router` v7 (frontend2 already on `react-router@^7`) — use `useNavigate` from `react-router`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | slopcheck unavailable → packages tagged ASSUMED; planner should add one verify step | Package Legitimacy Audit | Low — both packages have 200K+/40M+ weekly downloads + known maintainers; supply-chain risk minimal but not tool-verified |
| A2 | `{ ignore: () => false }` is the intended override for global-from-input | Pattern 4 / Pitfall 1 | Low — verified the default predicate in source; `ignore` option signature is `(event) => boolean`. A narrower predicate (`e => e.isComposing`) may be preferred to still skip IME composition. |

All other claims are `[VERIFIED]` against package source/registry this session.

## Open Questions (RESOLVED)

1. **Locations/Containers have no per-detail route** (CONTEXT.md §4)
   - RESOLVED: navigate to `/taxonomy?tab=locations` / `?tab=containers` (no per-entity detail route). Do NOT pass `&highlight={id}` — the taxonomy tab does not consume it. Per CONTEXT.md §4.

2. **Disable cmdk vim bindings inside the palette?**
   - RESOLVED: leave `vimBindings` on (no collision with the window-level open chord); document for QA.

## Environment Availability

Frontend-only phase; the only "dependencies" are two npm packages (verified present on the registry, installable via `bun add`). No external runtimes/services beyond the existing dev stack (already documented in CLAUDE.md: Postgres, backend :8080, Vite :5173). No new tooling required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| cmdk (npm) | palette filtering UI | ✓ (registry) | 1.1.1 | — (locked dep) |
| tinykeys (npm) | open chord | ✓ (registry) | 4.0.0 | — |
| bun | install + dev server | ✓ (project standard) | per project | npm/pnpm if needed |

## Validation Architecture

> nyquist_validation is not present in config.json → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.5` (unit) + Playwright `^1.59.1` (E2E), both in frontend2 |
| Config file | `frontend2/vitest.config.*` / `frontend2/playwright.config.ts` |
| Quick run command | `cd frontend2 && bun run test` (vitest) |
| Full suite command | `cd frontend2 && bun run test && E2E_USER=… E2E_PASS=… bun run test:e2e` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| TUI-05 (open) | ⌘K/Ctrl+K/F2 opens palette, incl. from focused input | unit (jsdom keydown) + E2E | `bun run test src/features/command-palette` | ❌ Wave 0 |
| TUI-05 (filter) | typing filters routes/workspaces/recent | unit | vitest on CommandPalette render | ❌ Wave 0 |
| TUI-05 (nav) | Arrow/Enter select, ESC dismiss (modal stack) | E2E | `bun run test:e2e` | ❌ Wave 0 |
| §4 parity | debounced entity results (items/borrowers/locations/containers) | unit w/ MSW mock | vitest + `msw` (already a dep) | ❌ Wave 0 |
| POL-04 | cmdk absent from entry chunk, present in `palette-*.js` | build assertion | `bun run build` + grep chunk (mirror 13b-01 gate) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend2 && bun run test src/features/command-palette`
- **Per wave merge:** full vitest suite
- **Phase gate:** full vitest + E2E green + bundle gate before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend2/src/features/command-palette/__tests__/CommandPalette.test.tsx` — render + filter + onSelect (TUI-05)
- [ ] `frontend2/src/features/command-palette/__tests__/usePaletteChord.test.tsx` — jsdom keydown for `$mod+k`/`F2` + preventDefault + from-input
- [ ] MSW handlers for the 4 `/search` endpoints (entity results)
- [ ] Bundle gate script/test asserting cmdk ∉ entry, ∈ `palette-*` (mirror 13b-01)
- [ ] i18n: new msgids → `bun run i18n:extract` + fill et/ru (Phase 15 catalog guard fails CI on untranslated msgids — CONTEXT.md §1)

## Security Domain

> security_enforcement not disabled in config → included. This is a client-only feature; minimal surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | palette mounts inside authed AppShell; no auth logic added |
| V4 Access Control | yes | entity search must be workspace-scoped — reuse existing per-entity `/search` (backend already enforces `workspace_id` per CLAUDE.md Pitfall #5). Never query without `wsId`. |
| V5 Input Validation | yes | clamp `limit ≤ 100` client-side (backend 422 over); trim query; min length 2 before firing |
| V6 Cryptography | no | none |

### Known Threat Patterns for React SPA palette
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data leak via search | Information disclosure | Always pass current `wsId`; backend scopes by `workspace_id` (verified in by-barcode test, CLAUDE.md) |
| XSS via entity names in results | Tampering | React escapes text children by default — render names as `{it.name}`, never `dangerouslySetInnerHTML` |
| localStorage MRU tampering | Tampering | Safe-parse MRU (return `[]` on bad JSON), treat ids as opaque, re-validate on navigate (route guards already exist) |

## Sources

### Primary (HIGH confidence)
- npm registry — `cmdk` (1.1.1, peerDeps `react: ^18 || ^19 || ^19.0.0-rc`, deps incl. `@radix-ui/react-dialog`, no postinstall), `tinykeys` (4.0.0, `type:module`, ESM/CJS exports), `command-score` (0.1.2). [`npm view` this session]
- `cmdk@1.1.1` dist `index.d.ts` + minified `index.mjs` — export surface, `onSelect: (value:string)=>void`, `shouldFilter`/`value`/`onValueChange` props, top-level radix-dialog import, vim bindings, first-item-select-only-when-empty logic, keyboard nav DOM walk. [dist inspection]
- `tinykeys@4.0.0` dist `tinykeys.mjs` — `$mod`→Meta/Control mapping, `defaultKeybindingsHandlerIgnore` (input/textarea/select/contenteditable), handler receives event, unsubscribe return. [dist inspection]
- npm downloads API — cmdk 40.8M/wk, tinykeys 217K/wk, command-score 181K/wk. [api.npmjs.org]

### Secondary (MEDIUM confidence)
- github.com/jamiebuilds/tinykeys README — API signature, $mod, sequences, options. [WebFetch]
- github.com/pacocoursey/cmdk README — `shouldFilter`, async render pattern, `Command.Loading`, controlled `value`. [WebFetch]

### Tertiary (LOW confidence)
- none.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions + peers verified on registry; cmdk already in sibling frontend
- Architecture/API surface: HIGH — read the actual dist source, not just docs
- tinykeys input-focus + radix-dialog bundling findings: HIGH — confirmed in source, override CONTEXT.md assumptions
- Bundle weight: HIGH — gzip measured locally
- Package legitimacy: MEDIUM — slopcheck unavailable; strong registry signals compensate

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable libs; re-verify if cmdk releases 1.2.x or tinykeys 5.x)

---

## Bundle Weight (POL-04)

Measured gzip this session (`gzip -c`):

| Artifact | Raw | Gzip |
|----------|-----|------|
| cmdk `index.mjs` + bundled chunks (incl. command-score) | ~13.1KB | **~5.0KB** |
| tinykeys `tinykeys.mjs` (ESM) | 6.4KB | **~2.4KB** |
| command-score (standalone, NOT installed — vendored in cmdk) | — | ~0.5KB (already inside cmdk's 5KB) |

**cmdk + command-score ≈ 5.0KB gz** (command-score is inside cmdk). **tinykeys ≈ 2.4KB gz.**

**Critical caveat:** cmdk hard-imports `@radix-ui/react-dialog` at the top of its single module (`import * as w from "@radix-ui/react-dialog"`), which pulls a tree of radix sub-packages (dismissable-layer, focus-scope, focus-guards, portal, presence, use-controllable-state, etc. — ~916KB on disk unminified, gzipped runtime cost realistically **~10–15KB gz** once bundled/minified/shared). This is **not tree-shaken** even though we use a custom overlay rather than `CommandDialog`, because the import is module-top-level. Some of radix's primitives may already be in the bundle if other components use them; rollup will dedupe shared ones.

**Conclusion on code-splitting:** **Worthwhile — strongly.** The palette chunk carries cmdk (~5KB) + the radix-dialog tree (~10–15KB gz). React.lazy-ing the palette body (CONTEXT.md §Code-split) keeps **all** of this out of the entry bundle, loading only when the user first opens the palette. The tinykeys open-chord owner (~2.4KB) stays in main — acceptable. Add the `manualChunks` rule for **both** `cmdk` and `@radix-ui/react-dialog` so the latter doesn't leak into the entry chunk via cmdk's hard import. Verify post-build (mirror 13b-01 gate): `cmdk` and `@radix-ui/react-dialog` appear ONLY in `palette-*.js`; entry `index-*.js` is cmdk-free.
