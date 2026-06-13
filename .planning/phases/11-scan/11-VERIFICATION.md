---
phase: 11-scan
verified: 2026-06-13T13:33:31Z
status: resolved
resolved_at: 2026-06-14T00:00:00Z
resolution_note: "SCAN-10 gap closed by commit 43feceed (fix(11): wire SCAN-10 UpcSuggestionBanner into ItemFormPage). The banner is now imported (ItemFormPage.tsx:19) and mounted under `showFromScan && !upcDismissed` (ItemFormPage.tsx:353), with onUse populating name + scanBrand and onDismiss gating dismissal. 12/12 must-haves now verified. Remaining items are device-only human_verification (camera/torch/iOS) — never automatable in CI."
score: 12/12 must-haves verified (post-fix)
overrides_applied: 1
overrides:
  - must_have: "SCAN-12 claim flow /claim/:code resolves shortlink/barcode and presents a claim-as-loan form (login required)"
    reason: "USER DECISION (binding override 9, 11-CONTEXT.md): SCAN-12 is implemented as PORT LEGACY create-entity — NO claim-as-loan flow, NO new backend. ClaimPage resolves :code via lookupByBarcode; MATCH→/items/:id, 404→/items/new?barcode=. Roadmap 'claim-as-loan' text explicitly superseded by this parity-true decision."
    accepted_by: "USER (orchestrator mandate, 11-CONTEXT.md resolved OQs section)"
    accepted_at: "2026-06-13T00:00:00Z"
gaps:
  - truth: "SCAN-10: item-create form shows suggested name/brand from GET /api/barcode/{code} as opt-in prefill (suggestion banner with USE / USE ALL / DISMISS)"
    status: resolved
    resolved_by: "commit 43feceed — UpcSuggestionBanner imported (ItemFormPage.tsx:19) and mounted (ItemFormPage.tsx:353); onUse wires name + scanBrand, onDismiss gates the banner. The earlier 'failed' finding below predates the fix."
    reason: "UpcSuggestionBanner component is built (src/components/scan/UpcSuggestionBanner.tsx) and calls barcodeApi.lookup, but is NOT imported or mounted in ItemFormPage.tsx. The component is orphaned. Additionally, no surface in the app generates /items/new?name=...&brand=... URLs, making the ?name=/?brand= URL-reading code in ItemFormPage dead. The barcodeApi is never called from the item-create form for any prefilled barcode."
    artifacts:
      - path: "frontend2/src/components/scan/UpcSuggestionBanner.tsx"
        issue: "ORPHANED — exists and is substantive, but not imported/rendered anywhere in features/"
      - path: "frontend2/src/features/items/ItemFormPage.tsx"
        issue: "?name= and ?brand= URL param reading exists (lines 86-88) but no surface generates URLs with those params; UpcSuggestionBanner is not mounted here"
    missing:
      - "Import UpcSuggestionBanner in ItemFormPage.tsx"
      - "Mount <UpcSuggestionBanner code={prefillBarcode} onUse={...} onDismiss={...} /> in the create-mode block (showFromScan=true) so it fires barcodeApi.lookup when a UPC barcode is prefilled"
      - "Wire onUse({name, brand}) to populate the form fields and/or the brand passthrough"
human_verification:
  - test: "Live camera decode fires the correct scan pipeline"
    expected: "Pointing the rear camera at a QR/UPC-A/EAN-13/Code128 barcode triggers the beep, haptic, flash, and the 4-state banner"
    why_human: "Cannot drive a real camera in CI; Playwright spec covers manual-entry path only"
  - test: "Android torch toggle (SCAN-04)"
    expected: "On an Android device with torch capability, the torch button appears and toggles the flashlight"
    why_human: "Device-only; torch capability requires real MediaStreamTrack.getCapabilities().torch"
  - test: "iOS haptic feedback (SCAN-03 ios-haptics path)"
    expected: "On iOS 17.4+ Safari, successful scan triggers haptic.confirm() via ios-haptics (not navigator.vibrate)"
    why_human: "Device-only; ios-haptics uses the iOS DeviceMotion / vibration API unavailable in CI"
  - test: "iOS persistent scanner (SCAN-01/02)"
    expected: "Switching between Scan/Manual/History tabs does not re-trigger iOS camera permission prompt"
    why_human: "Device-only; iOS PWA camera-permission persistence requires a real iOS standalone PWA context"
---

# Phase 11 (Scan) Verification Report

**Phase Goal:** Deliver `/scan` with live rear-camera barcode scanning (BarcodeScanner mounted ONCE), QR/UPC-A/EAN-13/Code128 decode, audio/haptic/visual feedback, Android torch, manual-entry fallback, last-10 scan history (localStorage), 4-state result banner, state-adaptive post-match quick-action overlay, UPC opt-in prefill, and `/claim/:code` legacy create-entity flow.
**Verified:** 2026-06-13T13:33:31Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SCAN-01: `/scan` opens with BarcodeScanner mounted ONCE (persistent sibling, NOT in a RetroTabs panel); pause via `paused` prop, never unmount | VERIFIED | `ScanPage.tsx:174` — `<div className={activeTab === "scan" ? "" : "hidden"}>` wraps BarcodeScanner; comment at line 21-32 explains the architecture. RetroTabs holds only the Manual + History panels (Scan tab panel is `null`). `BarcodeScanner` has `paused={paused}` prop (line 192). |
| 2 | SCAN-02: QR/UPC-A/EAN-13/Code128 via `@yudiel/react-qr-scanner@2.5.1`, prop-driven pause | VERIFIED | `package.json:28` pins `"@yudiel/react-qr-scanner": "2.5.1"` exactly. `BarcodeScanner.tsx:66` passes `formats={[...SUPPORTED_FORMATS]}`. `types.ts:29-34` defines `SUPPORTED_FORMATS = ["qr_code","upc_a","ean_13","code_128"]`. `paused` is a boolean prop consumed by the `<Scanner paused={paused}>` wrapper at `BarcodeScanner.tsx:60`. |
| 3 | SCAN-03: AudioContext beep + haptic + visual flash on successful scan | VERIFIED | `lib/scanner/feedback.ts` — singleton AudioContext, `playSuccessBeep()` (880Hz/100ms/0.25). `useScanFeedback.ts:19` imports `haptic, supportsHaptics` from `ios-haptics` (package.json:30 pins `"ios-haptics":"0.1.4"`); `useScanFeedback.ts:50-54` calls `haptic.confirm()` when `supportsHaptics`. Flash signal: `flash` counter incremented via `setFlash(n=>n+1)` on success (line 55). `reducedMotion` boolean exposed (line 45). `primeAudio` re-exposed for the page's `onPointerDown` (ScanPage.tsx:166). |
| 4 | SCAN-04: Android torch via `getCapabilities().torch`; iOS auto-hide | VERIFIED | `useTorch.ts:33-59` — `isIOS()` check skips probe entirely; `probeTorchSupport()` opens a throwaway `getUserMedia`, reads `track.getCapabilities().torch`, stops all probe tracks. `ScanTorchToggle.tsx:33` — `if (!supported) return null` (auto-hide). `BarcodeScanner.tsx:75` passes `components={{ torch: torchSupported && torchEnabled }}`. |
| 5 | SCAN-05: Manual tab with RetroInput + LOOK UP CODE funnels through useScanResolve | VERIFIED | `ManualBarcodeEntry.tsx` — `RetroInput` labeled `t\`ENTER CODE\`` + `BevelButton` "LOOK UP CODE". `onSubmit` prop calls with `(trimmed, "manual")`. ScanPage.tsx:143 wires `onSubmit={resolve}` → `useScanResolve.handleResolveCode`. |
| 6 | SCAN-06: History last-10 (`hws-scan-history`), row-tap re-fires post-scan flow | VERIFIED | `scan-history.ts:20` — `const SCAN_HISTORY_KEY = "hws-scan-history"`. `scan-history.ts:78` — `.slice(0, MAX_HISTORY_SIZE)` where `MAX_HISTORY_SIZE = 10` (line 21). `ScanHistoryList.tsx:85` — each row `<button onClick={() => onSelect(entry.code, "history")}>`. ScanPage.tsx:125-129 wires `onHistorySelect` → `resolve()` → `handleResolveCode`. |
| 7 | SCAN-07: Clear history with confirm dialog | VERIFIED | `ScanHistoryList.tsx:75-76` — "CLEAR HISTORY" BevelButton opens `confirmOpen` state. `RetroConfirmDialog` at line 106-118 guards the actual `onClear()` call. `clearScanHistory()` in `scan-history.ts:149` removes the localStorage key. |
| 8 | SCAN-08: 4-state banner (LOADING/MATCH/NOT-FOUND/ERROR) with `prefers-reduced-motion`-aware blinking cursor | VERIFIED | `ScanResultBanner.tsx` — four states mapped via `STATE` record (lines 26-33). LOADING cursor: `data-testid="scan-cursor"` span with class `scan-cursor--blink` (lines 74-80). `globals.css:252-258` — `.scan-cursor--blink { animation: status-blink 1s steps(1,end) infinite }` with `@media (prefers-reduced-motion: reduce) { .scan-cursor--blink { animation: none } }`. `useScanResolve.ts:62-65` maps `pending/success+data/success+null/error` → the four states. |
| 9 | SCAN-09: NOT-FOUND state links to `/items/new?barcode=<code>` | VERIFIED | `ScanResultBanner.tsx:91-93` — `<Link to={\`/items/new?barcode=${encodeURIComponent(code)}\`}>⊕ CREATE WITH CODE</Link>`. encodeURIComponent applied (path-injection guard). |
| 10 | SCAN-10: Codes matching `/^\d{8,14}$/` show UpcSuggestionBanner with USE/USE ALL/DISMISS from `GET /api/barcode/{code}` on the item-create form | **FAILED** | `UpcSuggestionBanner.tsx` exists and is substantive — it gates on `/^\d{8,14}$/`, calls `barcodeApi.lookup`, renders USE NAME / USE ALL / DISMISS. BUT it is NOT imported or mounted in `ItemFormPage.tsx`. `grep -rn "UpcSuggestionBanner" src/features/` returns EMPTY. The `?name=/?brand=` URL param reading in `ItemFormPage.tsx:86-88` is dead code because no surface generates those params. `barcodeApi.lookup` is never called from the item-create form. |
| 11 | SCAN-11: Quick-action overlay (View Item / Loan / Back) with state-adaptive gating | VERIFIED | `QuickActionMenu.tsx` — VIEW ITEM always (line 74); LOAN only when `showLoan = !item.is_archived && !hasActiveLoan` (line 54, fail-safe: `hasActiveLoan = (active.length>0) \|\| query.isPending` line 42); UNARCHIVE when `item.is_archived` (line 90); MARK REVIEWED when `item.needs_review` (line 100). `useMarkReviewedItem` imported and wired (lines 8, 32). Rendered as `RetroDialog` so camera stays mounted (line 57). |
| 12 | SCAN-12: `/claim/:code` port of legacy create-entity (MATCH→/items/:id, 404→/items/new?barcode=) | VERIFIED (override) | `ClaimPage.tsx` — uses `itemsApi.lookupByBarcode`; MATCH → `<Navigate to={\`/items/${item.id}\`} replace />` (line 53); 404 → Link to `/items/new?barcode=${encodeURIComponent(code)}` (line 116-134). Route registered under RequireAuth in `routes/index.tsx:129`. USER DECISION: PORT LEGACY, no claim-as-loan (binding override 9, 11-CONTEXT.md). |

**Score: 11/12 truths verified (1 override applied)**

---

### Deferred Items

None identified.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/src/features/scan/ScanPage.tsx` | ScanPage orchestration, persistent scanner | VERIFIED | 239 lines; BarcodeScanner persistent sibling; one funnel; 4-state banner; QuickActionMenu |
| `frontend2/src/features/scan/ClaimPage.tsx` | Port legacy /claim/:code | VERIFIED | 160 lines; full resolve logic with 4 states |
| `frontend2/src/components/scan/BarcodeScanner.tsx` | @yudiel/react-qr-scanner wrapper, prop-driven pause | VERIFIED | 88 lines; paused prop, formats, torch passthrough |
| `frontend2/src/lib/scanner/feedback.ts` | AudioContext beep + raw haptic | VERIFIED | 157 lines; singleton AudioContext; playSuccessBeep/playErrorBeep; triggerHaptic |
| `frontend2/src/features/scan/useScanFeedback.ts` | ios-haptics + beep + flash + reducedMotion | VERIFIED | 70 lines; imports ios-haptics; haptic.confirm(); reducedMotion from matchMedia |
| `frontend2/src/features/scan/useTorch.ts` | Torch probe + iOS auto-hide | VERIFIED | 84 lines; isIOS() guard; probeTorchSupport; supported/enabled/toggle |
| `frontend2/src/components/scan/ScanTorchToggle.tsx` | Android-only torch toggle, iOS renders null | VERIFIED | 48 lines; `if (!supported) return null` |
| `frontend2/src/components/scan/ManualBarcodeEntry.tsx` | RetroInput + LOOK UP CODE button | VERIFIED | 45 lines; ENTER CODE label; LOOK UP CODE button; trims; clears on submit |
| `frontend2/src/features/scan/useScanHistory.ts` | State-backed scan history hook | VERIFIED | 56 lines; seeded from getScanHistory; add/clear/refire |
| `frontend2/src/lib/scanner/scan-history.ts` | hws-scan-history localStorage, 10 cap, dedup | VERIFIED | 164 lines; key=hws-scan-history; MAX_HISTORY_SIZE=10; dedup by code |
| `frontend2/src/components/scan/ScanHistoryList.tsx` | History list with row-tap re-fire + confirm clear | VERIFIED | 120 lines; row buttons call onSelect; RetroConfirmDialog for clear |
| `frontend2/src/features/scan/useScanResolve.ts` | Single post-scan funnel, 4-state query | VERIFIED | 119 lines; ONE handleResolveCode; pause-not-unmount; render-loop guard on effect deps |
| `frontend2/src/components/scan/ScanResultBanner.tsx` | 4-state banner + scan-cursor--blink | VERIFIED | 106 lines; all 4 states; LOADING cursor; encodeURIComponent on NOT-FOUND link |
| `frontend2/src/components/scan/UpcSuggestionBanner.tsx` | UPC suggestion on item-create form | STUB/ORPHANED | Component is substantive (barcodeApi.lookup wired), but NOT mounted in ItemFormPage |
| `frontend2/src/components/scan/QuickActionMenu.tsx` | State-adaptive quick-action overlay | VERIFIED | 119 lines; all 4 actions with correct gating; useMarkReviewedItem wired |
| `frontend2/src/features/items/hooks/useMarkReviewedItem.ts` | PATCH needs_review=false mutation | VERIFIED | 40 lines; itemsApi.update; double-invalidation |
| `frontend2/src/lib/scanner/types.ts` | SUPPORTED_FORMATS, ScanHistoryEntry | VERIFIED | qr_code/upc_a/ean_13/code_128; ScanHistoryEntry shape |
| `frontend2/src/lib/scanner/init-polyfill.ts` | barcode-detector polyfill | VERIFIED | Idempotent; guards native BarcodeDetector; dynamic import of barcode-detector/polyfill |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ScanPage.tsx | BarcodeScanner | `onDecode={resolve}` | WIRED | ScanPage.tsx:192-193; resolve → handleResolveCode |
| ScanPage.tsx | useScanResolve | `useScanResolve({ feedback })` | WIRED | ScanPage.tsx:75 |
| ScanPage.tsx | useScanFeedback | `useScanFeedback()` | WIRED | ScanPage.tsx:74; feedback.success injected into useScanResolve |
| ScanPage.tsx | useTorch | `useTorch()` | WIRED | ScanPage.tsx:79; supported/enabled/toggle passed to BarcodeScanner + ScanTorchToggle |
| ScanPage.tsx | useScanHistory | `useScanHistory()` | WIRED | ScanPage.tsx:80; entries/add/clear passed to ScanHistoryList |
| ScanPage.tsx | ScanResultBanner | status/code/item from lookup | WIRED | ScanPage.tsx:215-223 |
| ScanPage.tsx | QuickActionMenu | item from lookup.data | WIRED | ScanPage.tsx:234-236 |
| useScanResolve.ts | itemsApi.lookupByBarcode | `queryFn: () => itemsApi.lookupByBarcode(wsId, banner.code)` | WIRED | useScanResolve.ts:78 |
| ClaimPage.tsx | itemsApi.lookupByBarcode | `useQuery queryFn` | WIRED | ClaimPage.tsx:33 |
| UpcSuggestionBanner.tsx | barcodeApi.lookup | `queryFn: () => barcodeApi.lookup(code)` | NOT_WIRED (orphaned) | Component itself is wired; but no parent mounts this component |
| ItemFormPage.tsx | UpcSuggestionBanner | (not present) | NOT_WIRED | No import, no render |
| routes/index.tsx | ScanPage (lazy) | `<Route path="scan" element={<Suspense><ScanPage/></Suspense>}>` | WIRED | routes/index.tsx:121-128; inside RequireAuth branch |
| routes/index.tsx | ClaimPage | `<Route path="claim/:code" element={<ClaimPage/>}>` | WIRED | routes/index.tsx:129; inside RequireAuth branch |
| Sidebar.tsx | /scan | `to="/scan"` NavItem | WIRED | Sidebar.tsx:149 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ScanResultBanner | `lookup.data` (Item or null) | `itemsApi.lookupByBarcode` → `GET /workspaces/{wsId}/items/by-barcode/{code}` | Yes — real DB query | FLOWING |
| QuickActionMenu | `loansQuery.data` | `loansApi.byItem` → `GET /workspaces/{wsId}/loans/by-item/{id}` | Yes | FLOWING |
| UpcSuggestionBanner | `query.data` (ProductResponse) | `barcodeApi.lookup` → `GET /barcode/{code}` | Yes (when mounted) | HOLLOW_PROP — component is orphaned; never receives `code` from ItemFormPage |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ScanPage module exports ScanPage function | `node -e "console.log(require('fs').existsSync('./frontend2/src/features/scan/ScanPage.tsx'))"` | True | PASS |
| BarcodeScanner uses `paused` prop (not unmount) | `grep "paused={paused}" frontend2/src/features/scan/ScanPage.tsx` | Line 192: `paused={paused}` | PASS |
| hws-scan-history key correct | `grep "hws-scan-history" frontend2/src/lib/scanner/scan-history.ts` | Line 20: `const SCAN_HISTORY_KEY = "hws-scan-history"` | PASS |
| UpcSuggestionBanner not mounted in ItemFormPage | `grep -c "UpcSuggestionBanner" frontend2/src/features/items/ItemFormPage.tsx` | 0 | FAIL (SCAN-10 gap) |
| Package pins exact | `grep "@yudiel/react-qr-scanner" frontend2/package.json` | `"2.5.1"` exact | PASS |
| barcode-detector pin | `grep "barcode-detector" frontend2/package.json` | `"3.0.8"` exact | PASS |
| ios-haptics pin | `grep "ios-haptics" frontend2/package.json` | `"0.1.4"` exact | PASS |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `frontend2/src/features/items/ItemFormPage.tsx:86-88` | `?name=/?brand=` URL param reading is dead code — no surface generates these URLs | WARNING | SCAN-10 gap root cause; ?name= and ?brand= params are read but UpcSuggestionBanner (the component that would call barcodeApi and then navigate with those params) is never mounted |

No TBD/FIXME/XXX/HACK/PLACEHOLDER markers found in Phase 11 files.

---

### Human Verification Required

#### 1. Live Camera Decode Pipeline

**Test:** On a real device with rear camera, navigate to `/scan` and scan a QR code or EAN-13 barcode from a product label
**Expected:** Device beeps (AudioContext oscillator), feels haptic (ios-haptics on iOS 17.4+, navigator.vibrate on Android), shows a visual flash, and transitions to LOADING → MATCH or NOT-FOUND banner
**Why human:** CI has no real camera; the Playwright E2E spec covers manual-entry path only

#### 2. Android Torch Toggle

**Test:** On an Android device with rear-camera torch, navigate to `/scan` and check for the torch button; click it
**Expected:** The torch button is visible (lightning bolt ⚡), clicking toggles the torch ON/OFF (butter fill + TORCH ON vs neutral + TORCH)
**Why human:** Requires real `MediaStreamTrack.getCapabilities().torch` capability from device hardware

#### 3. iOS Haptics

**Test:** On iOS 17.4+ Safari, scan a barcode
**Expected:** `haptic.confirm()` fires from ios-haptics (not navigator.vibrate, which iOS lacks)
**Why human:** Device-only; ios-haptics uses iOS-specific APIs

#### 4. iOS Camera Permission Persistence

**Test:** On iOS Safari PWA, switch between Scan/Manual/History tabs while on /scan, then return to Scan tab
**Expected:** Camera permission is NOT re-prompted; the video stream continues
**Why human:** iOS PWA camera re-prompt is triggered only when the `<video>` element is unmounted and remounted, which cannot be validated in CI

---

## Gaps Summary

**1 gap blocking SCAN-10** (UPC suggestion banner orphaned):

The `UpcSuggestionBanner` component (built in 11-05) was documented as "11-06 mounts in ItemFormPage" in the 11-05 SUMMARY, but Plan 11-06 instead implemented an alternative approach: reading `?name=/?brand=` URL params directly in `ItemFormPage`. However this alternative is also incomplete — no surface in the application ever generates a URL with `?name=` or `?brand=` parameters. The UpcSuggestionBanner component itself is correct and calls `barcodeApi.lookup`, but it is orphaned (not imported in ItemFormPage). As a result, when a user arrives at `/items/new?barcode=12345678`, the form correctly prefills the barcode field but never calls `GET /api/barcode/12345678` to offer name/brand suggestions.

The fix is straightforward: import `UpcSuggestionBanner` in `ItemFormPage.tsx` and mount it in the `showFromScan` block (when `prefillBarcode.length > 0`), wiring `onUse({name, brand})` to call `reset({ ...formValues, name })` and store brand for the create passthrough.

---

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| SCAN-01 | 11-06 | SATISFIED | ScanPage.tsx persistent sibling architecture |
| SCAN-02 | 11-01/02/04 | SATISFIED | package.json exact pin; SUPPORTED_FORMATS; paused prop |
| SCAN-03 | 11-02/03 | SATISFIED | feedback.ts + useScanFeedback.ts; ios-haptics pin |
| SCAN-04 | 11-04 | SATISFIED | useTorch.ts; ScanTorchToggle.tsx; iOS auto-hide |
| SCAN-05 | 11-05 | SATISFIED | ManualBarcodeEntry.tsx; LOOK UP CODE button |
| SCAN-06 | 11-02/05 | SATISFIED | hws-scan-history; 10 cap; row-tap re-fires funnel |
| SCAN-07 | 11-05 | SATISFIED | RetroConfirmDialog before clear |
| SCAN-08 | 11-03/05 | SATISFIED | 4-state banner; scan-cursor--blink; reduced-motion guard |
| SCAN-09 | 11-05/08 | SATISFIED | NOT-FOUND → /items/new?barcode= with encodeURIComponent |
| SCAN-10 | 11-05/06 | BLOCKED | UpcSuggestionBanner orphaned; barcodeApi never called from item-create form |
| SCAN-11 | 11-05 | SATISFIED | QuickActionMenu with all 4 state-adaptive actions |
| SCAN-12 | 11-07 | SATISFIED (override) | ClaimPage PORT LEGACY per USER DECISION |

---

_Verified: 2026-06-13T13:33:31Z_
_Verifier: Claude (gsd-verifier) — Sonnet 4.6_
