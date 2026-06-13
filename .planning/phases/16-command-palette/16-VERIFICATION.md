---
phase: 16-command-palette
verified: 2026-06-14T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 16: Command Palette Verification Report

**Phase Goal:** User can open a Cmd+K / F2 command palette filtering across routes, recent actions, and workspaces, with keyboard-first navigation.
**Requirement:** TUI-05 (REQUIREMENTS.md:176) + §4 parity (legacy global entity-search folded into the palette).
**Verified:** 2026-06-14
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Cmd+K / Ctrl+K / F2 opens a cmdk palette with full-screen retro chrome | ✓ VERIFIED | `usePaletteChord.ts` binds tinykeys `$mod+k`+`F2` with `{ignore:()=>false}`, `event.preventDefault()`, mount-once `useEffect([])`, latest-`open()`-via-ref. `CommandPalette.tsx` renders cmdk `Command` tree (lines 165-298) inside a full-screen scrim (`fixed inset-0 z-50`), retro pinstriped powder-blue title bar (`bg-titlebar-blue`, Silkscreen `font-display`), `role="dialog" aria-modal`, `autoFocus` `CommandInput`. `AppShell.tsx` calls `usePaletteChord(() => setPaletteOpen(true))` (line 105) and lazy-mounts the body under `<Suspense>` gated on `paletteOpen` (lines 176-183). |
| SC2 | Typing fuzzy-filters across routes + recent + workspaces | ✓ VERIFIED | `CommandPalette.tsx` uses `shouldFilter={false}` + controlled `query`/`value` (lines 166-176). Client `matches()` substring filter (lines 46-50) applied to all 3 static groups: Routes (`paletteRoutes.filter(matches(t(r.label),query))` line 193), Workspaces (`(workspaces ?? []).filter(matches(ws.name,query))` line 220), Recent (`recent.filter(matches(entry.label,query))` line 245). |
| SC3 | Arrow navigate / Enter select / ESC dismiss; tinykeys opens, cmdk filters | ✓ VERIFIED | Arrows/Enter owned by cmdk (`Command loop` + `CommandItem onSelect`). ESC routed through `useModalStack(open, onClose)` (line 62) — the shared capture-phase modal stack (`useModalStack.ts` pushes a ref-stable token on open, pops on close/unmount), NOT a custom keydown listener. E2E spec asserts ESC closes overlay while route stays intact (spec lines 47-50, 81-86). |
| SC4 (§4 parity) | Global entity search folded into palette (items/borrowers/locations/containers), debounced + live; results navigate; MRU records selections | ✓ VERIFIED | `useEntitySearch.ts` debounces (250ms, ref-held timer) and fires 4 `useQuery` calls — `itemsApi.list({search})`, `borrowersApi.search`, `locationApi.search`, `containerApi.search` — `enabled` only when `wsId && trimmed.length>=2`, domain-prefixed query keys (tenant-safe), `limit:5`. `CommandPalette.tsx` `renderEntityGroup` navigates item→`/items/{id}`, borrower→`/borrowers/{id}`, location/container→`/taxonomy?tab=...` (lines 273-296). `recentActions.ts` `addRecent` records every selection (de-dup by id, cap 10, safe-parse) and `run()` calls `addRecent` before navigating (lines 86-101). API `.search` methods confirmed present in borrowers/location/container; `itemsApi.list` supports `search` param. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `usePaletteChord.ts` | tinykeys chord owner, mount-once, ignore-false, preventDefault | ✓ VERIFIED | 44 lines, substantive, named-exported from index.ts, imported directly (not via barrel) in AppShell. |
| `CommandPalette.tsx` | cmdk body, retro chrome, controlled filter, 3 static + 4 entity groups | ✓ VERIFIED | 302 lines, default-exported, lazy target. |
| `useEntitySearch.ts` | debounced 4-domain search hook | ✓ VERIFIED | 135 lines, wired to all 4 API layers. |
| `recentActions.ts` | localStorage MRU store | ✓ VERIFIED | 98 lines, safe-parse + de-dup + cap; used by CommandPalette `run()`. |
| `paletteRoutes.ts` | static Routes table (i18n descriptors) | ✓ VERIFIED | 18 routes, `msg` descriptors for catalog extraction. |
| `index.ts` | barrel: default=body, named=chord | ✓ VERIFIED | Correct split for lazy chunk. |
| `AppShell.tsx` mount | lazy + Suspense + chord | ✓ VERIFIED | `lazy(() => import("@/features/command-palette"))`, chord wired to `setPaletteOpen`, gated Suspense mount. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| AppShell ShellChrome | usePaletteChord | direct module import + `usePaletteChord(() => setPaletteOpen(true))` | ✓ WIRED | Line 20 import, line 105 call. |
| AppShell | CommandPalette body | `lazy()` + Suspense, `open`/`onClose` props | ✓ WIRED | Lines 26, 176-183. |
| CommandPalette | router | `useNavigate()` in `run()` go-callbacks | ✓ WIRED | navigate per group. |
| CommandPalette | workspace switch | `setWorkspace(ws.id)` | ✓ WIRED | Lines 228, 253. |
| CommandPalette | useEntitySearch | `useEntitySearch(query)` | ✓ WIRED | Line 80, rendered via renderEntityGroup. |
| useEntitySearch | 4 API search endpoints | itemsApi/borrowersApi/locationApi/containerApi | ✓ WIRED | `.search`/`.list` methods all present. |
| CommandPalette | recentActions MRU | `addRecent` in `run()`, `getRecent()` per open | ✓ WIRED | Lines 84, 96. |
| CommandPalette | ESC dismiss | `useModalStack(open, onClose)` | ✓ WIRED | Line 62, shared stack (no custom listener). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CommandPalette Routes group | `paletteRoutes` | static i18n table | Yes (18 real route entries) | ✓ FLOWING |
| CommandPalette Workspaces group | `workspaces` | `useWorkspace()` context (real provider) | Yes | ✓ FLOWING |
| CommandPalette Recent group | `getRecent()` | localStorage MRU | Yes (real persisted selections) | ✓ FLOWING |
| CommandPalette entity groups | `entities.{items,...}` | `useEntitySearch` → 4 live `useQuery` against real `/search` endpoints | Yes (real backend queries, `enabled` gated) | ✓ FLOWING |

No hardcoded-empty props or static fallbacks. Entity arrays default to a shared `EMPTY` const only until queries settle.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| POL-04 bundle gate: cmdk absent from entry index-*.js | grep dist/assets/index-*.js for cmdk/command-score | cmdk ABSENT from entry; present in `palette-D7m0s8l1.js` + `command-palette-D51P-c9R.js` | ✓ PASS |
| Deps present at pinned versions | grep package.json | cmdk 1.1.1, tinykeys 4.0.0 | ✓ PASS |
| et/ru palette catalog parity (Phase 15 guard) | grep et/ru messages.po for palette msgstr | All 5 palette msgids translated non-empty in both et + ru | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TUI-05 | 16-01/02/03 | Command palette (Cmd+K/F2) via cmdk; filters routes/recent/workspaces; keyboard-first | ✓ SATISFIED | SC1-3 verified above. |
| §4 parity | 16-02 | Legacy global entity-search folded into palette | ✓ SATISFIED | SC4 verified above. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in palette feature or AppShell mount. `return null` on `!open` (line 103) is a legitimate closed-state guard, not a stub. |

### Human Verification Required

None block the gate. The following are residues for `v3.0-FINAL-REVIEW-CHECKLIST` (browser-UAT, non-blocking per VALIDATION.md §Residues), already acknowledged by the planner and covered by the passing chromium E2E spec at the presence level:

- Live visual fidelity of full-screen retro chrome vs sketches 006-008 (E2E asserts presence not pixels).
- Cross-workspace switch via palette with ≥2 seeded workspaces (unit test covers `setWorkspace` call).
- et/ru palette translation quality (machine-translated; parity guard confirms non-empty).

These are explicitly deferred residues, not unmet success criteria — they do not change the PASS verdict.

### Gaps Summary

No gaps. All 4 success criteria are delivered by substantive, wired, data-flowing code:

- SC1 PASS — tinykeys chord (mount-once, ignore-false, preventDefault) + cmdk body with retro chrome + lazy AppShell mount.
- SC2 PASS — `shouldFilter={false}` controlled client filter across Routes/Workspaces/Recent.
- SC3 PASS — cmdk owns arrows/Enter; ESC via shared `useModalStack` (not custom keydown).
- SC4 PASS — debounced 4-domain entity search wired to real `/search` endpoints, navigates to detail routes, records MRU.

Supporting evidence corroborated by spot-check: POL-04 bundle gate GREEN (cmdk only in palette chunks, absent from entry), deps pinned (cmdk 1.1.1 / tinykeys 4.0.0), et/ru catalog parity confirmed for all 5 palette msgids, comprehensive unit tests (chord, palette body, MRU, MSW-backed entity search) + 3/3 chromium E2E covering both open chords, route filter, Arrow+Enter nav, ESC close, and entity-search → `/items/{id}`. No debt markers.

---

_Verified: 2026-06-14_
_Verifier: Claude (gsd-verifier)_
