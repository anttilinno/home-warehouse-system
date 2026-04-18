# Phase 64: Scanner Foundation & Scan Page — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `64-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 64 — Scanner Foundation & Scan Page
**Areas discussed:** Scope & post-scan UX, Tabs & camera bootstrap, Error states & retry, Viewfinder + manual entry

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Scope & post-scan UX | Phase 64/65/66 boundary + post-scan UX before action menu exists | ✓ |
| Tabs & camera bootstrap | Default tab, tab persistence, camera perm prompt timing, AudioContext init | ✓ |
| Error states & retry | Which error panels to build, retry affordances, logging | ✓ |
| Viewfinder + manual entry | Viewfinder visuals, manual entry validation, history-tap behavior, torch UI | ✓ |

**User's choice:** All four areas.

---

## Scope & post-scan UX

### Q1 — How far should Phase 64 build toward the Phase 65 lookup + Phase 66 action menu?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure primitives (Recommended) | No API client, no useScanLookup hook. Phase 65 adds scan.ts + useScanLookup. | |
| Primitives + stub API/hook | Empty `lib/api/scan.ts` + `useScanLookup` returning hardcoded null/loading. Phase 65 fills backend. | ✓ |
| Primitives + live lookup | Wire useScanLookup to existing items ?search= at Phase 64; Phase 65 adds not-found flow. | |

**User's choice:** Primitives + stub API/hook.
**Notes:** Gives Phase 65 less new surface area while keeping the roadmap split clean.

### Q2 — On a successful scan at Phase 64 (before Phase 66's action menu exists), what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Pause + result banner (Recommended) | Scanner pauses, retro banner shows decoded code + format + SCAN AGAIN button. Phase 66 replaces banner. | ✓ |
| Auto-resume continuous | Beep + flash + history + scanner keeps running. | |
| Pause + placeholder slot | Scanner pauses, shows "QUICK ACTIONS · PHASE 66" placeholder. | |

**User's choice:** Pause + result banner.
**Notes:** Matches the Phase 66 paused-but-mounted pattern so no UI rework when Phase 66 lands.

### Q3 — How should successful scans be deduplicated against the last scan?

| Option | Description | Selected |
|--------|-------------|----------|
| Legacy dedupe (Recommended) | Same code = move-to-top in history. Scanner still pauses + re-shows banner. | ✓ |
| Throttle re-decodes | Ignore same code within N seconds. | |
| No dedupe | Every decode writes a new entry and fires banner. | |

**User's choice:** Legacy dedupe.

### Q4 — Should useScanHistory expose 'clear all' as a hook method or a direct localStorage utility call?

| Option | Description | Selected |
|--------|-------------|----------|
| Hook method (Recommended) | useScanHistory() returns `{ entries, add, clear, remove }`. | ✓ |
| Utility module + hook reads only | scan-history.ts exports functions; hook only subscribes to storage events. | |
| You decide | Claude picks based on existing hooks. | |

**User's choice:** Hook method.

---

## Tabs & camera bootstrap

### Q1 — Which tab is active on first mount of /scan?

| Option | Description | Selected |
|--------|-------------|----------|
| Scan (Recommended) | Scan tab active; scanner starts immediately. | ✓ |
| Manual | Manual tab active; camera never starts unless switched. | |
| History | History tab active; scanner starts on switch. | |

**User's choice:** Scan.

### Q2 — Should the active tab persist across page visits?

| Option | Description | Selected |
|--------|-------------|----------|
| No persistence (Recommended) | Always start on default tab. | ✓ |
| URL hash | Tab state in URL hash; shareable; watch for iOS hash-change perm re-prompt. | |
| localStorage | Sticky across sessions. | |

**User's choice:** No persistence.

### Q3 — When should the camera permission prompt fire?

| Option | Description | Selected |
|--------|-------------|----------|
| Page mount, Scan-tab default (Recommended) | Scanner mounts paused=false on first render. | ✓ |
| Explicit Start button | Scan tab opens with START SCANNING button; perm prompt on tap. | |
| Deferred until Scan-tab first activation | Hybrid: immediate if default is Scan; on switch otherwise. | |

**User's choice:** Page mount, Scan-tab default.

### Q4 — Where is the AudioContext created + resumed to satisfy iOS gesture rules?

| Option | Description | Selected |
|--------|-------------|----------|
| Resume on first tab click (Recommended) | pointerdown handler at RetroTabs / page wrapper level resumes on first interaction. | ✓ |
| Resume on Start/Scan button only | Only works with explicit Start button answer above. | |
| Lazy on first beep | iOS rejects without prior user interaction (Pitfall #19). | |

**User's choice:** Resume on first tab click.

---

## Error states & retry

### Q1 — Which error states each get a dedicated retro panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Permission denied | User or OS denied camera access. | ✓ |
| No camera hardware | NotFoundError/OverconstrainedError. | ✓ |
| Library init failure | zxing-wasm or polyfill fails to load. | ✓ |
| Unsupported browser | getUserMedia unavailable. | ✓ |

**User's choice:** All four.

### Q2 — Primary retry affordance for permission-denied?

| Option | Description | Selected |
|--------|-------------|----------|
| Platform instructions + Manual fallback (Recommended) | Per-platform instructions + USE MANUAL ENTRY button. No fake Retry. | ✓ |
| Retry button that re-calls getUserMedia | Will immediately fail again after denial. | |
| Instructions only | User must discover Manual tab via tab strip. | |

**User's choice:** Platform instructions + Manual fallback.

### Q3 — On library-init-failure, what should the panel do?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry button + Manual fallback (Recommended) | Dynamic re-import + Manual fallback. | ✓ |
| Hard refresh button | Wipes scan history state. | |
| Silent fall-through to Manual | Auto-switch with toast; hides real issue. | |

**User's choice:** Retry button + Manual fallback.

### Q4 — Should error state telemetry be captured anywhere?

| Option | Description | Selected |
|--------|-------------|----------|
| console.error only (Recommended) | Structured log with error name + UA + timestamp. No backend. | ✓ |
| No logging | Zero noise; debug-hostile. | |
| Dev-only via import.meta.env.DEV | Hides real user issues in prod. | |

**User's choice:** console.error only.

---

## Viewfinder + manual entry

### Q1 — Which viewfinder visual treatment best matches the retro aesthetic?

| Option | Description | Selected |
|--------|-------------|----------|
| Corner reticle + scanline (Recommended) | Thick retro-ink corner brackets + amber horizontal scanline. Disabled under prefers-reduced-motion. | ✓ |
| Corner reticle only | Static brackets, no animation. | |
| Full CRT scanline overlay | Faint scanlines across entire viewfinder. | |
| Minimal frame | RetroPanel border only. | |

**User's choice (with preview accepted):**
```
┌──   ──┐
│       │
 ──═════──  <- amber scanline
│       │
└──   ──┘
```

### Q2 — Manual tab validation before accepting a submitted code?

| Option | Description | Selected |
|--------|-------------|----------|
| Min-length + non-empty (Recommended) | Trim, ≥1 char, max 256. No format gate. | ✓ |
| GTIN 8-14 digits | Breaks QR + Code128 support. | |
| Split numeric + QR modes | Two inputs + submit buttons. | |

**User's choice:** Min-length + non-empty.

### Q3 — What happens when user taps a history entry at Phase 64?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-fire scan result banner (Recommended) | Same code path as live decode; Phase 65 has nothing to rewire. | ✓ |
| Copy code to clipboard + toast | Doesn't set up Phase 65 plumbing. | |
| Navigate to Scan tab + prefill manual entry | Extra clicks. | |
| No-op with Phase 65 tooltip | User-hostile. | |

**User's choice:** Re-fire scan result banner.

### Q4 — Should the torch toggle show as disabled/hidden on iOS + desktops?

| Option | Description | Selected |
|--------|-------------|----------|
| Visually absent when unsupported (Recommended) | Feature-detected per-stream; not rendered when unsupported. Matches SCAN-04 wording. | ✓ |
| Rendered but disabled with tooltip | Clutters retro UI on iOS. | |
| You decide | Claude picks based on RetroButton disabled state. | |

**User's choice:** Visually absent when unsupported.

---

## Claude's Discretion

- Exact RetroTabs API fit (existing barrel export) for the 3-tab strip
- Scanline animation timing / easing (likely ~2s linear, consistent with retro feel)
- Exact per-platform copy in permission-denied panel (EN first, ET filled in same phase)
- Banner visual arrangement (code, format label, SCAN AGAIN button position)
- Torch icon glyph (ASCII vs retro monospace bold)
- Module file split inside `lib/scanner/` — 1:1 port of legacy structure with `"use client"` stripped
- AudioContext singleton ownership (hook vs module-scope)

## Deferred Ideas

Documented in `64-CONTEXT.md` `<deferred>` section. Summary:
- Real lookup / not-found flow / UPC enrichment → Phase 65
- Quick-action menu → Phase 66
- FAB → Phase 67
- Loan preselect → Phase 68
- Quick Capture scan → Phase 69
- GTIN-14 canonicalization → revisit in Phase 65 if regressions surface
- Scanning containers/locations, offline queue, cross-device sync, CRT overlay, differentiated haptics, history delete, duplicate-scan warning → v2.3+
- Hardware scanner, NFC, auto-submit, batch mode, image-scan → Never (per PROJECT.md)
