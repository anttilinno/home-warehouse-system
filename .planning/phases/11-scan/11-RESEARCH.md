# Phase 11: Scan (single-route) — Research

**Researched:** 2026-06-13
**Domain:** Camera barcode scanning (React 19 + @yudiel/react-qr-scanner), iOS PWA camera-permission persistence, post-scan state machine, claim flow
**Confidence:** HIGH (parity: a fully-shipped legacy `/frontend` scanner + a verified v2.2 archived 64-RESEARCH both exist; lib pins confirmed on npm)

## Summary

Phase 11 is a **parity port**, not greenfield. The exact scanner stack ships in
production today in the legacy Next.js `/frontend` app (`@yudiel/react-qr-scanner@^2.5.1`
+ `barcode-detector@^3.0.0` + `ios-haptics@^0.1.4`), and the abandoned v2.2 `frontend2`
rebuild produced a deeply-verified `64-RESEARCH.md` that pinned the same versions against
the npm registry. Both are authoritative parity sources cited throughout. The job is to
reproduce the proven `lib/scanner/*` modules (feedback, scan-history, init-polyfill, types)
verbatim-ish, wrap `<Scanner>` in a retro `BarcodeScanner`, and wire the post-scan state
machine to the **already-built** v3.0 surfaces: `itemsApi.lookupByBarcode`, `ItemFormPage`
`?barcode=` prefill, `/loans/new?itemId=`, and the disabled Sidebar Scan nav item.

The dominant constraint is **iOS PWA camera-permission persistence**: the `<Scanner>` must
mount ONCE and stay mounted for the life of the `/scan` route — only its `paused` prop
toggles. Unmounting (or `track.stop()`) re-prompts for camera permission on iOS standalone.
This collides head-on with the v3.0 `RetroTabs` atom, which renders **only the active tab's
panel** (verified `RetroTabs.tsx:94` — `{active && <div role="tabpanel">{active.content}</div>}`).
Therefore the scanner CANNOT be hosted inside RetroTabs panel content. OQ4 resolves to:
keep `<BarcodeScanner>` mounted in a persistent layer above/behind the tab panels, drive
visibility with CSS (`hidden`/`display:none`), and use RetroTabs only for the tab strip +
the Manual/History panels.

Two requirements in CONTEXT do NOT match the shipped reality and need a planner/discuss
decision (see Assumptions Log + Open Questions): (1) **SCAN-12 "claim-as-loan"** — the
legacy `/claim/[code]` page is a *create-new-entity* flow for an UNMATCHED short_code, not a
loan flow, and there is **no JSON resolve endpoint** (only the browser-facing 302
`/r/{code}` redirect that points at legacy Next.js `/{locale}/dashboard/...` paths).
(2) **SCAN-11 "Mark Reviewed if needs_review"** — `needs_review` exists on the backend item
entity and is returned by the handler, but is **absent from the v3.0 `frontend2` `Item`
type** (`frontend2/src/lib/types.ts:113-135`).

**Primary recommendation:** 1:1 port the four legacy `lib/scanner/*` modules into
`frontend2/src/lib/scanner/`; add deps via a single foundation plan (`bun add` non-frozen);
build `<BarcodeScanner>` as a persistent always-mounted layer with prop-driven `paused`;
funnel live-scan + manual + history through ONE `handleResolveCode(code, format)` handler;
escalate SCAN-12 and SCAN-11(needs_review) to the planner as scope decisions.

## User Constraints (from CONTEXT.md)

> CONTEXT.md is the phase CONTEXT (verified surface + open questions), not a discuss-phase
> decisions file — it contains no `## Decisions` / `## Claude's Discretion` / `## Deferred`
> sections. The binding constraints below are copied verbatim from its
> "Hard parity facts" and "Binding constraints / carry-forward" sections and are treated
> with locked-decision authority.

### Locked parity facts (CONTEXT.md "Hard parity facts baked into the roadmap")
- `<BarcodeScanner>` mounts ONCE, stays mounted; overlays render ON TOP; pause-on-match is
  PROP-DRIVEN (NOT unmount) — iOS PWA camera-permission persistence (SCAN-01/02).
- Feedback (SCAN-03): AudioContext oscillator beep + haptic (`ios-haptics` on iOS 17.4+
  Safari, `navigator.vibrate` elsewhere) + visual flash/checkmark.
- Torch (SCAN-04): `MediaStreamTrack.getCapabilities().torch` gate; auto-hidden on iOS.
- Manual tab (SCAN-05): RetroInput + LOOK UP CODE.
- History (SCAN-06/07): localStorage key `hws-scan-history`, last 10, row tap re-fires the
  post-scan flow, clear with confirm dialog.
- Banner (SCAN-08): LOADING/MATCH/NOT-FOUND/ERROR; `prefers-reduced-motion`-aware cursor.
- NOT-FOUND (SCAN-09): "Create item with this barcode" → `/items/new?barcode=<code>`.
- UPC prefill (SCAN-10): codes matching `/^\d{8,14}$/` → suggestion banner USE / USE ALL /
  DISMISS from `GET /barcode/{code}` — wired into the item-create form.
- Quick actions (SCAN-11): View Item / Loan / Back to Scan; Loan hidden if active loan,
  Unarchive if archived, Mark Reviewed if `needs_review`.
- Claim (SCAN-12): `/claim/:code` resolve → claim-as-loan form (login required).

### Binding constraints / carry-forward (CONTEXT.md)
1. `routes/index.tsx` single-writer (the `/scan`, `/claim/:code` routes) — one plan owns it.
2. `Sidebar.tsx` single-writer (enable Scan nav).
3. Declare EVERY edited file; same-wave plans disjoint files.
4. Query keys `["barcode", wsId, code]` / `["item-by-barcode", wsId, code]`; render-loop guard.
5. `encodeURIComponent` on codes (path-injection guard T-07-02, already in lookupByBarcode).

### Deferred Ideas (OUT OF SCOPE)
- None declared in CONTEXT. (The mobile FAB that hides on `/scan` is Phase-19-era v2.2
  archaeology — NOT this phase.)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-01 | `/scan` route with single-mount live rear-camera preview | `<Scanner constraints={{facingMode:{ideal:'environment'}}}>`, persistent layer (OQ4), `React.lazy` + manualChunks (Pattern 5). Sidebar:149 + routes/index.tsx:120. |
| SCAN-02 | Decode QR / UPC-A / EAN-13 / Code128 | `formats={['qr_code','upc_a','ean_13','code_128']}` (lib enum verified). |
| SCAN-03 | Audio + haptic + visual feedback | `lib/scanner/feedback.ts` (AudioContext oscillator) + `useHaptic` (ios-haptics) + visual flash. |
| SCAN-04 | Android torch toggle, hidden on iOS | `track.getCapabilities().torch` probe + `applyConstraints({advanced:[{torch}]})`; iOS UA gate (OQ2). |
| SCAN-05 | Manual-entry fallback | RetroInput + LOOK UP CODE button → same resolve handler. |
| SCAN-06/07 | Last-10 scan history (localStorage) + clear-confirm | `lib/scanner/scan-history.ts` key `hws-scan-history`, dedup, slice(0,10). |
| SCAN-08 | 4-state result banner | `ScanResultBanner` (LOADING/MATCH/NOT-FOUND/ERROR) driven by lookup query state. |
| SCAN-09 | NOT-FOUND → create with barcode | `/items/new?barcode=<encodeURIComponent(code)>` (ItemFormPage already consumes it). |
| SCAN-10 | UPC opt-in prefill | `/^\d{8,14}$/` gate → `GET /barcode/{code}` → USE/USE ALL/DISMISS → `?barcode=` (+ name/brand). |
| SCAN-11 | State-adaptive quick-action overlay | `QuickActionMenu`; gating from `is_archived` + active-loan + `needs_review` (see OQ7 gaps). |
| SCAN-12 | `/claim/:code` resolve → claim flow | **DISCREPANCY** — see OQ6. Needs scope decision. |
| (gap) G-65-01 | Re-add by-barcode Playwright spec | `frontend2/e2e/scan-lookup.spec.ts` manual-entry + lookup against real backend. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera capture + decode | Browser / Client | — | `getUserMedia` + `BarcodeDetector` are browser APIs; lib runs client-side only. |
| Torch capability detect/toggle | Browser / Client | — | `MediaStreamTrack.getCapabilities/applyConstraints` are device-local. |
| Audio/haptic/visual feedback | Browser / Client | — | Web Audio + Vibration + ios-haptics are client-only. |
| Scan history persistence | Browser / Client (localStorage) | — | Per-device recent list; never server-side (matches legacy). |
| Code → item resolution | API / Backend | Frontend Server (Vite proxy) | `GET /workspaces/{wsId}/items/by-barcode/{code}` — backend is the case-sensitive, ws-scoped authority (D-07/D-08). |
| UPC → product metadata | API / Backend | External (OpenFoodFacts/OpenProductsDB) | `GET /barcode/{barcode}` proxies external DBs server-side. |
| short_code → entity resolution | API / Backend | — | Global `warehouse.short_codes` registry; **currently only via 302 `/r/{code}`** (no JSON endpoint — OQ6 gap). |
| Loan creation from scan | API / Backend | Frontend Server | `loansApi.create` posts `inventory_id` (NOT item_id) — `/loans/new?itemId=` pre-filters the inventory picker. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@yudiel/react-qr-scanner` | `2.5.1` (EXACT, no caret) | Camera QR + 1D barcode scan with `paused`/`formats`/`components.torch` | Ships in legacy `/frontend` production; CONTEXT/SCAN-02 lock exact pin for parity. React 19 peer-clean. [VERIFIED: npm registry — `npm view @yudiel/react-qr-scanner@2.5.1 version` → 2.5.1, 2026-06-13] [CITED: github.com/yudielcurbelo/react-qr-scanner README] |
| `barcode-detector` | `3.0.8` (transitive of lib; pin if imported directly for polyfill) | `BarcodeDetector` polyfill for Safari/Firefox; `BarcodeFormat` type | Bundled by the scanner lib at exactly 3.0.8; legacy imports `barcode-detector/polyfill` side-effect + `BarcodeFormat` type. [VERIFIED: `npm view @yudiel/react-qr-scanner@2.5.1 dependencies` → `{ 'webrtc-adapter': '9.0.3', 'barcode-detector': '3.0.8' }`] |
| `ios-haptics` | `0.1.4` (legacy pin; `^0.1.4` acceptable) | iOS 17.4+ Safari haptics via hidden-checkbox workaround | Legacy `use-haptic.ts` uses `haptic.confirm()` / `haptic.error()` / `haptic()` + `supportsHaptics`. [VERIFIED: `npm view ios-haptics@0.1.4 version` → 0.1.4; repo git+https://github.com/tijnjh/ios-haptics.git] |

### Supporting (NO new dep — already in frontend2)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | ^5.100.7 | `useQuery` for `lookupByBarcode` + `barcode` product lookup; drives the 4-state banner | Always — banner state = query state (pending=LOADING, data=MATCH/NOT-FOUND, error=ERROR). |
| `react-hook-form` + `zod` | ^7.74 / ^4.4 | ItemFormPage already wired; no change needed for `?barcode=` | UPC prefill plumbs via URL params, not new RHF wiring. |
| `sonner` (`retroToast`) | 2.0.7 | toast on found/not-found/error | Mirrors legacy `toast.success/info/error`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@yudiel/react-qr-scanner@2.5.1` | `@yudiel/...@2.6.0` (current latest) | 2.6.0 exists [VERIFIED 2026-06-13] but CONTEXT/SCAN-02 lock 2.5.1 for byte-parity with `/frontend`. Do NOT bump. |
| `ios-haptics` lib | inline `navigator.vibrate` only | Inline drops iOS 17.4+ haptics (Safari has no `navigator.vibrate`). The lib is the documented iOS path; legacy ships it. Keep. |
| Library `components.torch` button | custom retro `ScanTorchToggle` | Built-in renders a non-retro DOM button. v2.2 archived RESEARCH chose custom retro toggle (`components.torch:false`). Recommend custom for retro fidelity. |

**Installation (foundation plan ONLY — non-frozen):**
```bash
cd frontend2 && bun add @yudiel/react-qr-scanner@2.5.1 ios-haptics@^0.1.4
# barcode-detector arrives transitively at 3.0.8; add it explicitly ONLY if a
# plan imports `barcode-detector/polyfill` or its `BarcodeFormat` type directly:
#   bun add barcode-detector@^3.0.0
# Commit package.json + bun.lockb in this plan. Do NOT pass --frozen-lockfile.
```
All LATER plans branch from the merged base (deps in lockfile) and use `bun install --frozen-lockfile` normally.

## Package Legitimacy Audit

> slopcheck was NOT available in this session (`command -v slopcheck` → not found).
> Per protocol, packages are marked with verification evidence below; the planner SHOULD
> gate the foundation install behind a `checkpoint:human-verify` task as defense-in-depth.
> Mitigating factor: all three packages ship in the legacy `/frontend` production app
> (`frontend/package.json:43,49,51`) and were independently npm-verified in the v2.2
> archived `64-RESEARCH.md`.

| Package | Registry | Age | Source Repo | npm verify | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `@yudiel/react-qr-scanner@2.5.1` | npm | ~mature (2.6.0 latest) | github.com/yudielcurbelo/react-qr-scanner | `version`→2.5.1; deps→`{webrtc-adapter:9.0.3, barcode-detector:3.0.8}` | Approved (parity-locked; in legacy prod) |
| `barcode-detector@3.0.8` | npm | mature (3.2.0 latest) | github.com/Sec-ant/barcode-detector | bundled by scanner lib at 3.0.8 | Approved (transitive; in legacy prod) |
| `ios-haptics@0.1.4` | npm | created 2025-06-03 (~1yr); single maintainer `tijnjh` | github.com/tijnjh/ios-haptics | `version`→0.1.4 (latest 0.1.5) | Approved with note — young/small package, but shipped in legacy prod through v1.9. [WARNING: low-profile single-maintainer dep — keep the foundation-install human-verify checkpoint.] |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged suspicious:** `ios-haptics` (young, single-maintainer) — planner should keep a `checkpoint:human-verify` before the foundation install.

## Architecture Patterns

### System Architecture Diagram

```
                         /scan route (React.lazy)
                                 │
                 ┌───────────────┴────────────────────────────┐
                 │  ScanPage  (owns the state machine)         │
                 │  state: activeTab, paused, banner, match    │
                 └───────────────┬────────────────────────────┘
                                 │
   ┌─────────────────────────────┼──────────────────────────────────┐
   │ PERSISTENT LAYER            │  TAB STRIP (RetroTabs strip only)  │
   │ <BarcodeScanner            │  [Scan] [Manual] [History]         │
   │   paused={paused}          │                                    │
   │   onScan={handleScan}/>    │  ── active=scan  → scanner visible │
   │  (ALWAYS MOUNTED — CSS     │  ── active=manual→ ManualEntry      │
   │   hidden when tab≠scan)    │  ── active=history→ ScanHistoryList │
   └─────────────────────────────┴──────────────────────────────────┘
                 │ live scan (IDetectedBarcode[])
   manual submit │   history row tap
                 ▼   ▼   ▼
        ┌────────────────────────────────┐
        │ handleResolveCode(code, format)│  ← THE single funnel (OQ7)
        │  1. setPaused(true)            │
        │  2. setBanner({code,format})   │  → drives useQuery(item-by-barcode)
        │  3. addToScanHistory(...)      │
        │  4. feedback (beep+haptic)     │
        └───────────────┬────────────────┘
                        │
        useQuery(["item-by-barcode",wsId,code]) → itemsApi.lookupByBarcode
                        │
        ┌───────────────┼────────────────┬───────────────────┐
   pending          data=Item        data=null            error
   LOADING           MATCH            NOT-FOUND            ERROR
        │               │                  │                  │
   spinner      QuickActionMenu      "Create item       Retry banner
                (View/Loan/...)       w/ this barcode"
                                      + (if /^\d{8,14}$/) UPC suggestion
                                        → GET /barcode/{code}
```

### Recommended Project Structure
```
frontend2/src/
├── lib/
│   ├── scanner/                    # NEW — 1:1 port of legacy lib/scanner
│   │   ├── feedback.ts             # AudioContext oscillator beep + navigator.vibrate
│   │   ├── scan-history.ts         # hws-scan-history localStorage, last 10, dedup
│   │   ├── init-polyfill.ts        # barcode-detector/polyfill registration
│   │   ├── types.ts                # SUPPORTED_FORMATS, BarcodeFormat, ScanHistoryEntry
│   │   └── index.ts                # barrel
│   └── api/
│       └── barcode.ts              # NEW — barcodeApi.lookup(code) → ProductResponse
├── features/
│   └── scan/
│       ├── ScanPage.tsx            # state machine + RetroTabs strip + persistent scanner
│       ├── useScanResolve.ts       # the single funnel + useQuery wiring (OQ7)
│       ├── useScanHistory.ts       # React wrapper over lib/scanner/scan-history
│       ├── useScanFeedback.ts      # beep + useHaptic
│       ├── useTorch.ts             # capability probe + applyConstraints (OQ2)
│       └── ClaimPage.tsx           # /claim/:code (scope pending — OQ6)
├── components/
│   └── scan/                       # NEW domain components (retro)
│       ├── BarcodeScanner.tsx      # <Scanner> wrapper, prop-driven paused
│       ├── ScanViewfinderOverlay.tsx
│       ├── ScanTorchToggle.tsx
│       ├── ManualBarcodeEntry.tsx
│       ├── ScanResultBanner.tsx    # 4 states
│       ├── QuickActionMenu.tsx     # state-adaptive overlay
│       ├── UpcSuggestionBanner.tsx # USE / USE ALL / DISMISS (SCAN-10)
│       └── ScanHistoryList.tsx
└── routes/index.tsx                # +/scan (lazy) +/claim/:code  (single-writer)
```

### Pattern 1: Scanner stays mounted; pause is prop-driven (iOS PWA — SCAN-01/02)
**What:** `<Scanner>` has a `paused` prop. Toggle it; never unmount, never `track.stop()`.
**When:** Always on `/scan`.
**Example:**
```tsx
// Source: frontend/components/scanner/barcode-scanner.tsx:212-238 (legacy prod)
//         + github.com/yudielcurbelo/react-qr-scanner README (WebFetch 2026-06-13)
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";

<Scanner
  onScan={(codes: IDetectedBarcode[]) => {
    if (codes.length === 0 || paused) return;       // render-loop / double-fire guard
    const { rawValue, format } = codes[0];          // allowMultiple:false ⇒ length 1
    onDecode(rawValue, format);
  }}
  onError={handleError}
  paused={paused}                                   // PROP-DRIVEN pause (NOT unmount)
  formats={['qr_code', 'upc_a', 'ean_13', 'code_128']}  // SCAN-02 subset
  scanDelay={200}
  allowMultiple={false}
  sound={false}                                     // we own audio feedback
  components={{ finder: false, torch: false }}      // custom retro overlay + torch
  constraints={{ facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }}
  styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
/>
```
The lib mounts its own `<video>` internally (handles `playsInline`) — do NOT inject one.
[CITED: README; VERIFIED against legacy source]

### Pattern 2: Single-mount architecture with RetroTabs (OQ4 — CRITICAL)
**What:** `RetroTabs.tsx:94` renders **only the active tab's `content`** (`{active && <tabpanel>{active.content}</tabpanel>}`). Putting `<BarcodeScanner>` in a tab's `content` would unmount it whenever the user switches to Manual/History → iOS camera re-prompt. So the scanner lives OUTSIDE RetroTabs.
**When:** Always.
**Example:**
```tsx
// ScanPage.tsx — scanner is a PERSISTENT sibling; RetroTabs swaps only the
// Manual/History panels. The Scan "panel" is just a CSS-shown window onto the
// always-mounted scanner. Tab switch toggles visibility, never mounts/unmounts.
const [activeTab, setActiveTab] = useState<'scan'|'manual'|'history'>('scan');
return (
  <Window title="SCAN" titlebarVariant="blue" onPointerDown={primeAudioOnce}>
    {/* PERSISTENT — mounted for the life of the route */}
    <div className={activeTab === 'scan' ? '' : 'hidden'}>
      <BarcodeScanner paused={paused} onDecode={handleResolveCode} onError={...} />
      <ScanTorchToggle ... />
      {banner && <ScanResultBanner state={lookup.status} .../>}
      {match && <QuickActionMenu ... />}
    </div>
    {/* RetroTabs hosts ONLY the manual + history panels; the scan tab's
        content is an empty spacer because the real scanner is the sibling above. */}
    <RetroTabs
      value={activeTab}
      onChange={setActiveTab}
      tabs={[
        { id: 'scan',    label: 'SCAN',    content: null },          // visual = sibling above
        { id: 'manual',  label: 'MANUAL',  content: <ManualBarcodeEntry onSubmit={handleResolveCode}/> },
        { id: 'history', label: 'HISTORY', content: <ScanHistoryList onSelect={(e)=>handleResolveCode(e.code,'history')} /> },
      ]}
    />
  </Window>
);
```
> NOTE (Rule-3-class deviation to flag in the plan): the legacy `/frontend` ScanPage
> uses Radix `Tabs`/`TabsContent` which ALSO conditionally renders — but legacy gets away
> with it because the scanner is inside `TabsContent value="scan"` and Radix keeps the
> active panel mounted while on it. v3.0's RetroTabs has the same unmount-on-switch
> behavior, so the v3.0 port MUST hoist the scanner out of the tab content (above). This is
> the single most important divergence from the legacy file. **Alternative** the planner may
> consider: render all three RetroTabs panels and CSS-hide inactive ones via a small
> RetroTabs variant — but that changes a shared atom (avoid; the hoist pattern is local).

### Pattern 3: The single resolve funnel (OQ7)
**What:** Live scan, manual submit, and history-tap all call ONE handler so behavior is identical. The banner/quick-action state is derived from a TanStack `useQuery`, not hand-managed.
**Example:**
```tsx
// useScanResolve.ts
const [banner, setBanner] = useState<{ code: string; format: string } | null>(null);
const [paused, setPaused] = useState(false);

const lookup = useQuery({
  queryKey: ["item-by-barcode", wsId, banner?.code],     // CONTEXT key 4
  queryFn: () => itemsApi.lookupByBarcode(wsId, banner!.code),
  enabled: Boolean(wsId && banner?.code),
  staleTime: 0,
});

const handleResolveCode = useCallback((code: string, format: string) => {
  if (!code) return;
  setPaused(true);                                        // pause-not-unmount
  setBanner({ code, format });                            // triggers the query
  feedback();                                             // beep + haptic (SCAN-03)
  addToScanHistory({ code, format, entityType: 'unknown' }); // updated post-lookup
}, [feedback]);

// On lookup settle, refine the history entry with match data. Deps are the
// PRIMITIVE status/match fields — NOT [history] (render-loop guard, CONTEXT 4 /
// Phase 65 D-22).
useEffect(() => {
  if (lookup.status === 'success' && banner) {
    updateScanHistory(banner.code, lookup.data); // null → unknown; Item → item/name
  }
}, [lookup.status, lookup.data, banner?.code]);
```
> History re-fire MUST reuse `handleResolveCode` with the stored code, NOT a separate path.
> This guarantees the 4-state banner + quick actions behave identically (legacy
> `scan/page.tsx:205-216` re-looks-up on history select — same intent).

### Pattern 4: Torch capability detect + toggle (OQ2)
**What:** v2.5.1 `IScannerHandle` exposes `getStream()` (per README), but the legacy prod
code does NOT use it — it probes a throwaway `getUserMedia` stream, reads
`track.getCapabilities().torch`, then stops the probe. iOS is gated by UA before probing.
**Example:**
```tsx
// Source: frontend/components/scanner/barcode-scanner.tsx:62-86 (legacy prod)
async function checkTorchSupport(): Promise<boolean> {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return false;   // iOS auto-hide
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
    stream.getTracks().forEach((t) => t.stop());                     // release probe
    return caps?.torch === true;
  } catch { return false; }
}
```
Two ways to ACTUALLY toggle the torch:
1. **Lib-managed (simplest):** `components={{ torch: torchSupported && torchEnabled }}` — the
   lib applies the constraint on its own stream. Legacy uses THIS (`barcode-scanner.tsx:220`).
2. **Direct (richer retro UI):** grab the active stream via the lib ref
   (`ref.current?.getStream()` per README `IScannerHandle.getStream()`), then
   `track.applyConstraints({ advanced: [{ torch: true }] })`.
   **Recommendation:** Use approach (1) for parity + reliability (legacy-proven); render a
   custom retro `ScanTorchToggle` that flips the boolean fed into `components.torch`. The
   v2.2 archived RESEARCH flagged that v2.5.1's ref-exposed stream is unreliable for the
   probe race on Android — prefer the probe-and-release detect + lib-managed apply.
[VERIFIED against legacy source; README confirms `IScannerHandle.getStream()`]

### Pattern 5: AudioContext + haptics feedback (SCAN-03 / OQ3)
**What:** Singleton AudioContext, `resume()` ONLY inside a real user gesture
(`pointerdown`), oscillator beep. Haptics split: `ios-haptics` for iOS 17.4+ Safari (which
has no `navigator.vibrate`), `navigator.vibrate` elsewhere.
**Example:**
```tsx
// lib/scanner/feedback.ts — 1:1 from frontend/lib/scanner/feedback.ts:69-119
export function playSuccessBeep() { playBeep(880, 100, 0.25); }  // sine oscillator
export function playErrorBeep()   { playBeep(300, 200, 0.3); }
// useHaptic.ts — 1:1 from frontend/lib/hooks/use-haptic.ts:4-36
import { haptic, supportsHaptics } from "ios-haptics";
function trigger(pattern: 'tap'|'success'|'error') {
  if (!supportsHaptics) return;                      // covers both iOS + non-iOS
  if (pattern === 'success') haptic.confirm();
  else if (pattern === 'error') haptic.error();
  else haptic();
}
```
> `ios-haptics`' `supportsHaptics` already abstracts the iOS-17.4-vs-`navigator.vibrate`
> split internally (the lib uses a hidden-`<input type=checkbox switch>` workaround on iOS
> and falls back to `navigator.vibrate` on Android). You do NOT need to branch on UA in app
> code — call the lib. The legacy `feedback.ts:128` ALSO has a raw `navigator.vibrate`
> path used independently of `ios-haptics`; the v3.0 port can keep both (beep is always
> Web Audio; haptic prefers `ios-haptics`). [VERIFIED against legacy source]

### Pattern 6: UPC suggestion prefill (SCAN-10 / OQ5)
**What:** On NOT-FOUND, if the code matches `/^\d{8,14}$/`, call `GET /barcode/{code}`. If
`product.found`, show a USE / USE ALL / DISMISS banner. The form already consumes
`?barcode=` — extend the create URL with the chosen fields.
**Backend response shape (VERIFIED `backend/internal/domain/barcode/handler.go:42-49`):**
```jsonc
// GET /api/barcode/{barcode}  (GLOBAL — NOT /workspaces; param named {barcode}, minLen 8 maxLen 14)
{
  "barcode": "0123456789012",
  "name": "Product Name",        // "" when not found
  "brand": "Acme",               // omitempty (optional)
  "category": "Snacks",          // omitempty
  "image_url": "https://...",    // omitempty
  "found": true                  // false → product unknown; suppress the banner
}
```
**Plumbing (ItemFormPage already supports `?barcode=`, verified `ItemFormPage.tsx:80-100`):**
- `?barcode=` → prefills the Barcode field with a FROM SCAN badge (existing).
- The form has a `brand` field on the backend create input (`handler.go:752`) and a BRAND
  field was added to the v3.0 ItemForm in the archived 65-05 plan — confirm the BRAND field
  exists in the current `frontend2/src/features/items/ItemForm`; if present, extend the
  create URL: `/items/new?barcode={code}&name={name}&brand={brand}`.
- USE = apply name only; USE ALL = name + brand (+ category/image where the form has fields);
  DISMISS = navigate with `?barcode=` only.
> **Gap to confirm:** the current `ItemFormPage.tsx` reads ONLY `searchParams.get("barcode")`
> — it does NOT yet read `?name=`/`?brand=`. SCAN-10's "USE ALL" therefore needs NEW wiring
> in ItemFormPage to consume `?name=`/`?brand=` (the archived 65-05 plan did this; it was
> wiped). Plan must add `searchParams.get("name")`/`("brand")` prefill to ItemFormPage.
[VERIFIED: barcode handler shape + ItemFormPage current behavior]

### Anti-Patterns to Avoid
- **Hosting `<BarcodeScanner>` inside a RetroTabs panel** — unmounts on tab switch → iOS
  camera re-prompt. (Pattern 2.)
- **Calling `track.stop()` or unmounting on decode** — same re-prompt; use `paused`.
- **`useQuery` deps on `[history]`** — re-render loop (CONTEXT 4 / Phase 65 D-22). Depend on
  primitive `status`/`code`.
- **Resuming AudioContext from `useEffect`** — iOS rejects it; resume in `pointerdown`.
- **Treating `/r/{code}` as a JSON API** — it is a 302 redirect to legacy Next paths (OQ6).
- **`item_id` in a loan body** — it is `inventory_id` (`loans.ts:9`); claim/loan must resolve item → inventory entry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera + barcode decode | Custom `getUserMedia` + canvas + zxing wiring | `@yudiel/react-qr-scanner@2.5.1` | Handles video lifecycle, `playsInline`, format decode, paused, torch. |
| Safari/Firefox `BarcodeDetector` | Custom polyfill | `barcode-detector/polyfill` | Bundled, side-effect import, maintained. |
| iOS 17.4+ haptics | Hidden-checkbox switch hack | `ios-haptics` | Encapsulates the documented workaround + `navigator.vibrate` fallback. |
| Scan history store | Custom localStorage logic | Port `lib/scanner/scan-history.ts` | Dedup, size-cap, error-tolerant — already proven. |
| Code → item lookup | New fetch | `itemsApi.lookupByBarcode` (exists) | 404→null, encodeURIComponent, ws-scoped (D-07/D-08). |
| UPC → product | New fetch | `GET /barcode/{code}` (exists) | Server proxies OpenFoodFacts + OpenProductsDB. |

**Key insight:** Every hard part of this phase already exists in shipped code — the v3.0
work is retro-UI wrapping + state-machine wiring, not new mechanism.

## Runtime State Inventory

> Not a rename/refactor/migration phase. localStorage note included because the port reuses
> a key that may already hold legacy-shaped data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | localStorage key `hws-scan-history` (same key as legacy `/frontend`) | None — the entry shape is identical (`code/format/entityType/entityId/entityName/timestamp`); the port's validator (`scan-history.ts:40-45`) filters malformed entries, so stale legacy data is safe. |
| Live service config | None | None — verified: scanning is client-side + existing backend endpoints. |
| OS-registered state | None | None. |
| Secrets/env vars | E2E_USER / E2E_PASS for the Playwright spec (already in CLAUDE.md) | None new. |
| Build artifacts | Scanner WASM (`zxing-wasm`) must be manual-chunked | Add `manualChunks` rule in `vite.config.ts` (slot already reserved at line 47-48). |

## Common Pitfalls

### Pitfall 1: RetroTabs unmounts the active panel on switch
**What goes wrong:** Scanner inside a tab panel → unmount on tab change → iOS re-prompts camera.
**Why:** `RetroTabs.tsx:94` renders only `active.content`.
**How to avoid:** Hoist `<BarcodeScanner>` out of RetroTabs; CSS-toggle visibility (Pattern 2).
**Warning signs:** Camera permission dialog reappears when tapping Manual then back to Scan.

### Pitfall 2: `inventory_id` vs `item_id` in loans
**What goes wrong:** Posting `item_id` to `loansApi.create` 400s — a loan is against an inventory ENTRY.
**Why:** `loans.ts:8-15` — body is `inventory_id`. `/loans/new?itemId=` pre-filters the inventory picker (`LoanFormPage.tsx:68-94`); it does NOT preselect an item field.
**How to avoid:** Quick-action "Loan" navigates to `/loans/new?itemId={encodeURIComponent(id)}` and lets the form resolve the entry (auto-selects when exactly one matches).
**Warning signs:** 400 on create; or a loan form with no inventory entries.

### Pitfall 3: `needs_review` missing from frontend2 Item type
**What goes wrong:** SCAN-11 "Mark Reviewed if needs_review" can't gate — `Item` (`types.ts:113-135`) has no `needs_review`.
**Why:** v3.0 type was trimmed; backend entity HAS it (`item/entity.go:131`, returned by handler `handler.go:659`).
**How to avoid:** Plan must add `needs_review?: boolean` to the frontend2 `Item` type AND confirm the by-barcode handler's `ItemResponse` serializes it (it does — `handler.go:659 NeedsReview: i.NeedsReview()`). Then add a `useMarkReviewedItem` PATCH mutation (`{needs_review:false}`) — the archived 66-01 plan did exactly this.
**Warning signs:** Quick action never shows Mark Reviewed; TS error on `item.needs_review`.

### Pitfall 4: AudioContext suspended on iOS
**What goes wrong:** First beep is silent on iOS.
**Why:** AudioContext starts suspended; `resume()` must be in a gesture.
**How to avoid:** `onPointerDown` primer on the page wrapper (Pattern 5).

### Pitfall 5: Path-injection via scanned code
**What goes wrong:** A scanned QR carrying `../` could escape the API path.
**Why:** Codes are user-controlled.
**How to avoid:** `encodeURIComponent(code)` everywhere — `lookupByBarcode` already does it (`items.ts:94`); apply to `/barcode/{code}`, `/items/new?barcode=`, `/loans/new?itemId=`, `/claim/:code`. (T-07-02.)

### Pitfall 6: render-loop from history dependency
**What goes wrong:** Effect depending on the history array re-fires every render.
**Why:** New array identity each render.
**How to avoid:** Depend on primitive `lookup.status` + `banner.code` (Pattern 3; Phase 65 D-22).

### Pitfall 7: literal-vs-param route ordering
**What goes wrong:** `/claim/:code` or `/scan` parsed wrong if ordered after a wildcard.
**Why:** Library-mode RR7 first-match (`routes/index.tsx:27-31`).
**How to avoid:** Register `/scan` + `/claim/:code` as literal/param child routes BEFORE the `*` placeholder; one plan owns `routes/index.tsx` (CONTEXT 1).

### Pitfall 8: non-frozen install only in the foundation plan
**What goes wrong:** A later plan's `bun add` or a `--frozen-lockfile` in the foundation plan breaks CI / drops the dep.
**Why:** The lockfile must be written once and frozen thereafter.
**How to avoid:** Foundation plan runs `bun add ...` (writes lockfile, commits it, NO `--frozen-lockfile`); all later plans branch from merged base + use frozen install. (CONTEXT NEW DEPENDENCY; OQ8.)

## Code Examples

### Manual-entry → resolve (SCAN-05)
```tsx
// ManualBarcodeEntry.tsx — RetroInput + LOOK UP CODE → same funnel
function ManualBarcodeEntry({ onSubmit }: { onSubmit: (code: string, format: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); const c = value.trim(); if (c) { onSubmit(c, 'manual'); setValue(''); } }}>
      <RetroInput label={<Trans>Barcode</Trans>} value={value} onChange={(e) => setValue(e.target.value)} mono autoFocus />
      <BevelButton type="submit" variant="primary"><Trans>Look up code</Trans></BevelButton>
    </form>
  );
}
```

### barcodeApi (SCAN-10)
```ts
// lib/api/barcode.ts
import { get } from "@/lib/api";
export interface ProductResponse {
  barcode: string; name: string; brand?: string; category?: string; image_url?: string; found: boolean;
}
export const barcodeApi = {
  lookup(code: string): Promise<ProductResponse> {
    return get<ProductResponse>(`/barcode/${encodeURIComponent(code)}`);  // GLOBAL route
  },
};
// useQuery key (CONTEXT 4): ["barcode", wsId, code]  (wsId for cache isolation even though route is global)
```

### Quick-action gating (SCAN-11 / OQ7)
```tsx
// QuickActionMenu derives actions from the matched Item's state.
function actionsFor(item: Item, hasActiveLoan: boolean): QuickAction[] {
  const out: QuickAction[] = ['view'];
  if (!item.is_archived && !hasActiveLoan) out.push('loan');   // Loan hidden if active loan
  if (item.is_archived) out.push('unarchive');                 // itemsApi.restore
  if (item.needs_review) out.push('mark-reviewed');            // needs_review (add to type!)
  out.push('back-to-scan');
  return out;
}
// hasActiveLoan: loansApi.byItem(wsId, item.id) → partitioned.active.length > 0 (loans.ts:30-41).
// There is NO active-loan flag on Item or on the by-barcode response — it requires a
// SECOND query (loansApi.byItem). Flag for planner: this adds a per-match loans fetch.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Radix Tabs with scanner in active TabsContent (legacy) | Scanner hoisted out of RetroTabs, CSS-visibility (v3.0) | This phase | RetroTabs unmounts panels; legacy pattern would re-prompt camera. |
| `lookupByShortCode` against IndexedDB (legacy offline) | `itemsApi.lookupByBarcode` against backend (v3.0 online-only) | Phase 65 | v3.0 is online-only (CI grep-guarded); no IndexedDB. |
| `/dashboard/loans/new?item=` (legacy) | `/loans/new?itemId=` pre-filtering inventory picker (v3.0) | Phase 8 | Different param name + inventory-entry semantics. |
| `@yudiel/react-qr-scanner` 2.6.0 (latest) | pinned 2.5.1 (parity) | — | Do not bump; SCAN-02 locks exact pin. |

**Deprecated/outdated:**
- The entire v2.2 Phases 64-66 plan tree (`.planning/milestones/v2.2-phases-abandoned/`) is
  ARCHAEOLOGY ONLY — frontend2 was wiped. Reuse its RESEARCH/patterns, NOT its plan IDs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SCAN-12 "claim-as-loan" is the intended behavior | OQ6 / SCAN-12 | HIGH — legacy `/claim/[code]` is create-new-ENTITY, not loan; no JSON resolve endpoint exists. Building a loan flow may contradict shipped UX + require a NEW backend endpoint. MUST confirm with user. |
| A2 | `ItemForm` has a BRAND field (from wiped 65-05) | Pattern 6 | MEDIUM — if absent, "USE ALL" can't apply brand; verify current ItemForm before planning SCAN-10. |
| A3 | Adding `needs_review` to frontend2 Item type is in-scope | Pitfall 3 / SCAN-11 | MEDIUM — backend returns it; frontend type lacks it. If out-of-scope, drop Mark-Reviewed action. |
| A4 | Active-loan signal requires a second `loansApi.byItem` fetch | OQ7 / SCAN-11 | MEDIUM — no active-loan flag on Item/by-barcode response; gating Loan needs an extra query (perf + complexity). |
| A5 | `ios-haptics@0.1.4` is safe to install | Package Audit | LOW — young/single-maintainer but in legacy prod; keep human-verify checkpoint. |
| A6 | `scanDelay=200` + `formats` subset matches desired UX | Pattern 1 | LOW — legacy values; tune if needed. |

## Open Questions (RESOLVED)

### OQ1 — `@yudiel/react-qr-scanner@2.5.1` API (single-mount + pause + formats + onScan/onError + track) — RESOLVED
- **Pin:** `2.5.1` exact [VERIFIED npm]. Deps: `barcode-detector@3.0.8` + `webrtc-adapter@9.0.3` [VERIFIED].
- **Props:** `onScan: (IDetectedBarcode[]) => void` (required), `onError`, `paused?` (default false), `formats?: BarcodeFormat[]` (omit = all), `scanDelay?` (default 0; use 200), `allowMultiple?` (default false), `sound?` (set false), `components?: { torch?, finder?, zoom?, onOff?, audio?, tracker? }`, `constraints?: MediaTrackConstraints`, `styles?`, `classNames?`, `children?`. [CITED: README; VERIFIED: legacy `barcode-scanner.tsx:212-238`]
- **`IDetectedBarcode`:** `{ rawValue: string; format: string; boundingBox; cornerPoints }`.
- **Format enum (SCAN-02 subset):** `['qr_code', 'upc_a', 'ean_13', 'code_128']`. Full set includes `ean_8, upc_e, code_39, data_matrix, pdf417, aztec, itf, codabar, ...`. The prop name is `formats` (NOT `enabledFormats`).
- **Reaching the track:** `IScannerHandle.getStream()` via `useRef`+forwardRef (README). Legacy does NOT use it — it probes a throwaway `getUserMedia` for capabilities (Pattern 4).
- **Single-mount architecture:** Pattern 2 — scanner is a persistent sibling, RetroTabs hosts only Manual/History panels, tab switch = CSS visibility, never mount/unmount.

### OQ2 — Torch via the lib + iOS auto-hide — RESOLVED
- **Detect:** UA-gate iOS first (`/iPad|iPhone|iPod/` → false), else probe `getUserMedia({video:{facingMode:'environment'}})`, read `track.getCapabilities().torch`, stop the probe (Pattern 4; `barcode-scanner.tsx:62-86`).
- **Apply:** Two paths — (1) lib-managed `components={{torch: enabled}}` (legacy-proven, RECOMMENDED), or (2) `ref.getStream()` → `track.applyConstraints({advanced:[{torch:true}]})`. v2.5.1 DOES expose `getStream()`, but the probe race on Android makes the lib-managed apply more reliable. Render a custom retro `ScanTorchToggle` that flips the boolean fed into `components.torch`.
- **iOS auto-hide:** the UA gate returns false → no torch button rendered (legacy `barcode-scanner.tsx:251`).

### OQ3 — `ios-haptics` real dep + iOS-vs-vibrate split — RESOLVED
- **Real npm package** [VERIFIED: `npm view ios-haptics@0.1.4` → 0.1.4; repo github.com/tijnjh/ios-haptics]. Legacy pins `^0.1.4` (`frontend/package.json:51`); latest 0.1.5.
- **Split:** `ios-haptics` internally handles iOS 17.4+ Safari (hidden-checkbox `switch` workaround — Safari has no `navigator.vibrate`) AND falls back to `navigator.vibrate` on Android. App code calls `haptic()/haptic.confirm()/haptic.error()` gated by `supportsHaptics` — NO UA branching needed (`use-haptic.ts:4-36`).
- **Beep:** Web Audio oscillator (sine), success=880Hz/100ms/0.25, error=300Hz/200ms/0.3 (`feedback.ts:69-119`). Singleton ctx, `resume()` in `pointerdown`.

### OQ4 — Single-mount architecture (scanner stays mounted across tabs) — RESOLVED
- **Resolution (CRITICAL):** `RetroTabs.tsx:94` renders only the active tab's content (unmounts others). Therefore the scanner is hoisted OUT of RetroTabs into a persistent layer; RetroTabs drives only the tab strip + Manual/History panels; the Scan tab toggles the scanner's CSS visibility. Result banner + quick-action overlay render OVER the always-mounted scanner. (Pattern 2.) This is the chief divergence from the legacy file (which relies on Radix keeping the active panel mounted).

### OQ5 — `GET /barcode/{barcode}` shape + ItemFormPage plumbing — RESOLVED
- **Route:** GLOBAL `GET /api/barcode/{barcode}` (NOT ws-scoped; param `{barcode}`, minLen 8 maxLen 14) [VERIFIED `barcode/handler.go:12,32-33`].
- **Response:** `{ barcode, name, brand?, category?, image_url?, found }` [VERIFIED `handler.go:42-49`]. `found:false` ⇒ suppress banner.
- **Gate:** `/^\d{8,14}$/` on the code before calling.
- **Plumbing:** ItemFormPage ALREADY reads `?barcode=` (`ItemFormPage.tsx:80`) with a FROM SCAN badge. It does NOT yet read `?name=`/`?brand=` → **new wiring needed** for "USE ALL". USE = name only; USE ALL = name + brand (+ category/image where form fields exist); DISMISS = barcode only. Verify the ItemForm BRAND field exists (A2).

### OQ6 — SCAN-12 claim flow — RESOLVED (with a scope ESCALATION)
- **Backend reality** [VERIFIED `shortlink/handler.go` + `api/router.go:404`]: the ONLY resolver is `GET /r/{code}` — a raw Chi (NOT huma) **302 redirect** handler that auths via cookie, resolves the global `warehouse.short_codes` registry scoped to the user's workspaces, and redirects to a **legacy Next.js path** (`/{locale}/dashboard/items/{id}` or `?focus=` for container/location), or to `/{locale}/dashboard/claim/{code}` when unmatched. **There is NO JSON resolve endpoint.**
- **Legacy `/claim/[code]`** [VERIFIED `frontend/app/.../claim/[code]/page.tsx`]: NOT a loan flow — it is a **create-new-entity** page reached only for an UNMATCHED code, offering Create Item / Location / Container with `?short_code=` prefill.
- **CONTEXT says "claim-as-loan"** — this contradicts both the shipped UX and the available backend. To build SCAN-12 as written, you would need EITHER (a) a NEW JSON resolve endpoint (`GET /workspaces/{wsId}/resolve/{code}` or similar) returning `{type,id}` so frontend2 can route, plus a new claim-as-loan form, OR (b) reinterpret SCAN-12 as a v3.0 port of the existing create-entity claim page (matching legacy).
- **Recommendation:** ESCALATE to discuss-phase/planner. Most-likely-correct scope = (b) port the create-entity claim page to frontend2 retro (`/claim/:code` reads `:code`, offers create-item with `?barcode=`/`?short_code=`), AND retarget the backend `/r/{code}` redirect destinations to v3.0 routes (`/items/{id}`, `/claim/:code`) since the legacy `/{locale}/dashboard/*` paths no longer exist in v3.0. The "claim-as-loan" + `loansApi.create` framing in CONTEXT appears to be an error; do NOT build a loan flow without user confirmation. (A1.)

### OQ7 — Scan-result state machine (one funnel) + quick-action gating — RESOLVED
- **One funnel:** `handleResolveCode(code, format)` called by live scan, manual submit, AND history-tap (Pattern 3). Banner = `useQuery(["item-by-barcode",wsId,code])` state. (Legacy `scan/page.tsx` re-looks-up on every entry — same intent.)
- **Gating fields:** `is_archived?` EXISTS on `Item` (`types.ts:127`). `needs_review` does NOT (backend has it; add to type — Pitfall 3). Active-loan: NO flag on Item or by-barcode response → requires `loansApi.byItem(wsId,id)` → `partitioned.active.length>0` (A4). Loan hidden if `is_archived || hasActiveLoan`; Unarchive if `is_archived`; Mark Reviewed if `needs_review`.

### OQ8 — Plan split + which plan adds the dep — RESOLVED (recommendation below)

## Recommended Plan Split (OQ8)

Disjoint files per wave; the foundation plan is the SINGLE non-frozen installer.

- **Plan 11-01 (Wave 0 — FOUNDATION, non-frozen install):** `bun add @yudiel/react-qr-scanner@2.5.1 ios-haptics@^0.1.4` (+ `barcode-detector@^3.0.0` if importing polyfill/type directly); commit `package.json` + `bun.lockb`. Add `vite.config.ts` `manualChunks` scanner rule (slot reserved line 47-48). Add test-infra camera mocks to `src/test/setup.ts` (`navigator.mediaDevices.getUserMedia` stub + `BarcodeDetector` stub) + an MSW handler for `GET /api/barcode/:barcode`. **Files:** package.json, bun.lockb, vite.config.ts, vitest.config.ts (if needed), src/test/setup.ts, src/test/msw/handlers.ts. **Must NOT use --frozen-lockfile.**
- **Plan 11-02 (Wave 1 — lib port):** `src/lib/scanner/{feedback,scan-history,init-polyfill,types,index}.ts` (1:1 port) + `src/lib/api/barcode.ts` + unit tests. Disjoint from all UI.
- **Plan 11-03 (Wave 2 — hooks):** `src/features/scan/{useScanHistory,useScanFeedback,useTorch,useScanResolve}.ts` + tests.
- **Plan 11-04 (Wave 2 — scanner components):** `components/scan/{BarcodeScanner,ScanViewfinderOverlay,ScanTorchToggle}.tsx`. Disjoint from 11-05.
- **Plan 11-05 (Wave 2 — result/manual/history components):** `components/scan/{ManualBarcodeEntry,ScanResultBanner,QuickActionMenu,ScanHistoryList,UpcSuggestionBanner}.tsx` + barrel. Add `needs_review?` to `lib/types.ts` Item + `useMarkReviewedItem`. Disjoint from 11-04.
- **Plan 11-06 (Wave 3 — page + routes + sidebar, SINGLE-WRITERS):** `features/scan/ScanPage.tsx` orchestration; extend `ItemFormPage.tsx` to read `?name=`/`?brand=` (SCAN-10 USE ALL); `routes/index.tsx` (+`/scan` lazy, +`/claim/:code`); `Sidebar.tsx` (enable Scan nav, line 149). Owns the three single-writer files.
- **Plan 11-07 (Wave 3 — claim, scope-gated by OQ6 decision):** `features/scan/ClaimPage.tsx` + (if scope b) backend `/r/{code}` redirect-target retargeting to v3.0 routes. **BLOCKED on A1 decision.**
- **Plan 11-08 (Wave 4 — Lingui + Playwright):** EN/ET catalog extract; re-add `frontend2/e2e/scan-lookup.spec.ts` (G-65-01 guard) driving MANUAL tab + lookup against the real backend (camera can't be driven in CI). Bundle gate (scanner chunk budget).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | install/build/test | ✓ (CLAUDE.md workflow) | — | — |
| npm registry | dep verification | ✓ | — | — |
| `@yudiel/react-qr-scanner@2.5.1` | SCAN-01/02 | ✓ on registry | 2.5.1 | none — required |
| `ios-haptics@0.1.4` | SCAN-03 | ✓ on registry | 0.1.4 | `navigator.vibrate` only (drops iOS haptics) |
| Camera (`getUserMedia`) | live scan runtime | device-dependent | — | manual-entry tab (SCAN-05) |
| `BarcodeDetector` | decode | polyfilled | — | `barcode-detector/polyfill` |
| Postgres + backend (8080) | Playwright spec | per CLAUDE.md runbook | — | none for E2E |
| `slopcheck` | package audit | ✗ | — | manual npm verify (done) + human-verify checkpoint |

**Missing dependencies with no fallback:** none blocking (scanner libs exist on registry).
**Missing dependencies with fallback:** `slopcheck` (manual verification done); live camera (manual-entry fallback).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 (jsdom) + @testing-library/react 16 + MSW 2.14; Playwright 1.59 for E2E |
| Config file | `frontend2/vitest.config.ts` (setupFiles: `src/test-utils.tsx`, `src/test/setup.ts`) |
| Quick run command | `cd frontend2 && bun run test -- <file>` (vitest) |
| Full suite command | `cd frontend2 && bun run test && bun run typecheck && bun run lint:imports && bun run build` |
| E2E command | `cd frontend2 && E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAN-03 | beep + haptic feedback | unit | `bun run test -- lib/scanner/feedback` | ❌ Wave 1 |
| SCAN-06/07 | history dedup + last-10 + clear | unit | `bun run test -- lib/scanner/scan-history` | ❌ Wave 1 |
| SCAN-02 | format subset passed to Scanner | unit (mocked lib) | `bun run test -- components/scan/BarcodeScanner` | ❌ Wave 2 |
| SCAN-08 | 4-state banner from query status | unit | `bun run test -- components/scan/ScanResultBanner` | ❌ Wave 2 |
| SCAN-10 | `/^\d{8,14}$/` gate + USE/USE ALL/DISMISS | unit | `bun run test -- components/scan/UpcSuggestionBanner` | ❌ Wave 2 |
| SCAN-11 | action gating (archived/loan/review) | unit | `bun run test -- components/scan/QuickActionMenu` | ❌ Wave 2 |
| SCAN-01/05/07 | funnel: scan/manual/history → banner | unit | `bun run test -- features/scan/ScanPage` | ❌ Wave 3 |
| G-65-01 | manual-entry → MATCHED banner (real backend) | e2e | `bun run test:e2e -- scan-lookup` | ❌ Wave 4 (re-add) |

### Sampling Rate
- **Per task commit:** the touched-file vitest run.
- **Per wave merge:** full vitest suite.
- **Phase gate:** full suite + typecheck + lint:imports + build green; Playwright spec green on chromium+firefox.

### Wave 0 Gaps
- [ ] `src/test/setup.ts` — add `navigator.mediaDevices.getUserMedia` mock + `BarcodeDetector` stub (camera-mocked tests; mirror the existing `MockEventSource` pattern in that file).
- [ ] `src/test/msw/handlers.ts` — add `GET /api/barcode/:barcode` handler (found + not-found cases).
- [ ] Mock module for `@yudiel/react-qr-scanner` (the v2.2 archived 64-02 plan did exactly this — `vi.mock` returning a stub `Scanner` that calls `onScan` on a test trigger).
- [ ] `frontend2/e2e/scan-lookup.spec.ts` — covers G-65-01 (was wiped; CLAUDE.md documents its prior shape: login → seed item → /scan → MANUAL tab → MATCHED banner).

## Security Domain

> `security_enforcement` not set to false in config → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `/scan` + `/claim/:code` are under `RequireAuth` AppShell; cookie-JWT (existing). |
| V4 Access Control | yes | by-barcode + barcode lookups are ws-scoped/auth'd backend-side (D-07/D-08); short_code resolver scopes to the user's workspaces (`shortlink/handler.go:102-117`). |
| V5 Input Validation | yes | scanned code is user input → `encodeURIComponent` on every path use (T-07-02); zod length bounds on the barcode field; `/^\d{8,14}$/` gate before UPC lookup. |
| V6 Cryptography | no | none — no crypto in this phase. |

### Known Threat Patterns for camera-scan + redirect stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path injection via scanned `../` code | Tampering | `encodeURIComponent` on all path interpolations (Pitfall 5). |
| Open-redirect via `/r/{code}` next param | Tampering / EoP | Server builds the `next` path server-side, never echoes client input (`shortlink/handler.go:136-139`, T-uzt-04) — preserve if retargeting `/r/{code}`. |
| Cross-tenant barcode leak | Info Disclosure | `FindByBarcode WHERE workspace_id=$1` (G-65-01 integration test guards it). |
| XSS via scanned value rendered in banner | Tampering | React auto-escapes; never `dangerouslySetInnerHTML` the code/name. |

## Sources

### Primary (HIGH confidence)
- `github.com/yudielcurbelo/react-qr-scanner` README (WebFetch 2026-06-13) — full Scanner props, IDetectedBarcode, format enum, components.torch, IScannerHandle.getStream().
- npm registry (2026-06-13): `@yudiel/react-qr-scanner@2.5.1` (deps `barcode-detector@3.0.8`, `webrtc-adapter@9.0.3`), `ios-haptics@0.1.4`, `barcode-detector@3.2.0`.
- Codebase (VERIFIED file:line): `barcode/handler.go:12,42-49`; `shortlink/handler.go` (whole); `api/router.go:395,404`; `item/handler.go:192,659`; `item/entity.go:131`; `frontend2/src/lib/api/items.ts:91-101`; `loans.ts:8-15,30-41,57`; `ItemFormPage.tsx:80-100`; `LoanFormPage.tsx:68-94`; `routes/index.tsx`; `Sidebar.tsx:149`; `lib/types.ts:113-135`; `components/retro/data/RetroTabs.tsx:94`; `test/setup.ts`; `vite.config.ts:47`.
- Legacy `/frontend` shipped scanner (parity gold): `components/scanner/barcode-scanner.tsx`, `quick-action-menu.tsx`, `manual-entry-input.tsx`; `lib/scanner/{feedback,scan-history,init-polyfill,types}.ts`; `lib/hooks/use-haptic.ts`; `app/[locale]/(dashboard)/dashboard/scan/page.tsx`, `.../claim/[code]/page.tsx`.

### Secondary (MEDIUM confidence)
- `.planning/milestones/v2.2-phases-abandoned/64-scanner-foundation-scan-page/64-RESEARCH.md` — independently npm-verified the same pins + transitive footprint (zxing-wasm, manualChunks budget, StrictMode probe race). Archaeology, but its verification is reusable.

### Tertiary (LOW confidence)
- `pointerdown`-not-`click` for AudioContext unlock on iOS — widely-reported pattern, not spec'd (from 64-RESEARCH citing Matt Montag).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pins npm-verified + shipping in legacy prod.
- Architecture (single-mount/funnel/torch/feedback): HIGH — proven legacy source + lib docs; RetroTabs unmount behavior verified at file:line.
- SCAN-12 claim flow: LOW — CONTEXT contradicts shipped reality; escalated (A1/OQ6).
- SCAN-11 needs_review/active-loan gating: MEDIUM — fields located but type/extra-query gaps (A3/A4).
- Pitfalls: HIGH — drawn from verified code + Phase 65 locked decisions.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable libs; pin is fixed). Re-confirm only if SCAN-12 scope changes.
