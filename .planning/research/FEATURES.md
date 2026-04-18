# Feature Landscape — v2.2 Scanning & FAB (frontend2)

**Domain:** Warehouse-grade mobile inventory scanning + quick-action UX in the retro `/frontend2`
**Researched:** 2026-04-18
**Reference:** `/frontend` (Next.js) ships a working v1.3 scanning + FAB implementation — mined here as the UX ground truth
**Constraint:** Port and adapt the v1.3 mobile scan experience to `/frontend2`'s retro aesthetic and React-Router/TanStack Query stack. No offline queue for scans (online-only scope per v2.1). No external product-API lookup beyond the existing `/barcode/{code}` backend endpoint.

## Scope Framing

v2.2 is **not** greenfield scanning UX research — the pattern has shipped, been validated by real users in v1.3, and the legacy frontend1 source is in the tree. This file categorizes each discrete behavior as **table stakes** (must-ship parity with v1.3), **differentiator** (retro-polish opportunity), or **anti-feature** (explicitly excluded).

Two dependency realities shape every recommendation:

1. **iOS PWA camera permissions reset on route change** (the single largest UX-defining constraint — frontend1 solved it with a single-page scan flow that mounts `<BarcodeScanner>` once and overlays UI on top of it instead of navigating away).
2. **frontend2 has zero scanner dependencies today.** Every camera/haptic/audio util is new code. Backend barcode endpoint exists (`GET /barcode/{barcode}` — returns `{ found: bool, name, brand?, category?, image_url? }`), but the in-repo lookup (items/containers/locations by `short_code` or `items.barcode`) is done client-side in v1.3 via IndexedDB — in frontend2 with no offline layer, this becomes a server search (`GET /api/v1/items?search=<code>` or `?barcode=<code>`).

Rule of thumb for v2.2 scope: if the v1.3 behavior needed IndexedDB, either reroute it through the existing TanStack Query API layer or drop it. If the behavior needed `navigator.vibrate` + AudioContext + torch, port it — all three work online-only.

---

## Feature Area 1: Barcode/QR Scanner Core

### Table Stakes (v2.2)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Camera-based scanner page at `/scan` (route already exists as stub) | Primary entry point for the whole feature | Medium | `@yudiel/react-qr-scanner@2.5.1` (React-19 peerDep confirmed via `npm view`) | Frontend1's BarcodeScanner stays MOUNTED throughout flow — action menu overlays on top. Do not navigate away between scan and quick-action. |
| Decode QR + UPC/EAN/Code128 via Barcode Detection API with `barcode-detector` polyfill | Match v1.3 format coverage | Low | `SUPPORTED_FORMATS = ["qr_code","ean_13","ean_8","upc_a","upc_e","code_128"]` | Library handles polyfill loading; we just declare formats. |
| Lookup scanned code → find item | The whole point | Medium | Items API (exists). New: `GET /api/v1/items?barcode=<code>` (confirm during phase planning) or fall back to `?search=<code>` | In v1.3 this was an IndexedDB-parallel-scan over items/containers/locations by `short_code`. In v2.2, restrict to **items only** — containers/locations are not scannable entities in frontend2 yet. |
| Pause scanner on match (prop-driven pause, NOT unmount) | iOS permission persistence | Low | `paused` prop on `<Scanner>` | Frontend1 pattern: `isPaused` state → `paused={isPaused}` on `<Scanner>` — stops scan loop without tearing down MediaStream. |
| Visual scan-active indicator (pulsing dot + "SCANNING" text) | User must know camera is live | Low | — | Retro styling opportunity: swap pulse for CRT scanline or green-on-black terminal text. |
| Torch/flashlight toggle (Android/Chromium only — hide on iOS) | Dark rooms, basements, garages are the modal use case for household inventory | Low | `MediaTrackCapabilities.torch` feature-detect + `components.torch` prop | iOS Safari does NOT expose torch — feature-detect and hide button (frontend1: `isIOS` UA check + `getCapabilities` probe). |
| Manual barcode entry fallback (text input) | Damaged labels, privacy-sensitive environments, stylus/gloved hands | Low | Same lookup endpoint | Tab or toggle inside `/scan` page. `autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off"` mandatory. |
| Camera permission denied state | Users revoke permissions, need clear recovery | Low | `error.name === "NotAllowedError"` detection | Show retro error panel: "CAMERA ACCESS DENIED — enable in browser settings." No auto-retry loop. |
| Scan initialization state (loading spinner + "Initializing scanner…") | Camera startup is slow (~500ms–2s) | Low | `isInitializing` flag | Retro treatment: ASCII spinner or "BOOTING OPTICAL SENSOR…" terminal text. |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Retro CRT scanline viewfinder overlay | Brand-defining — turn a generic camera view into `/frontend2`'s signature screen | Medium | SVG or CSS animated horizontal sweep line over the `<video>` element. Disable on `prefers-reduced-motion`. |
| Green-on-black terminal feedback text over scanner | Fits retro aesthetic, replaces shadcn toast | Low | Overlay short text ("LOCKED ON: ITEM-4532") instead of sonner toast, sits above quick-action sheet. |
| Corner brackets / "targeting reticle" finder overlay | Industrial feel + improves aim on small codes | Low | Replace library `finder: true` with custom corner brackets (4 absolutely-positioned elements) |
| Scan-cooldown indicator (200ms lockout visualization) | Prevents "I double-scanned my hand" frustration | Low | Brief retro-styled overlay between scan events |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Scanning containers or locations | v2.2 items-only scope; `short_code` on containers/locations isn't wired through frontend2 entity APIs yet | Items-only lookup; add other entities in a later milestone |
| External UPC-database auto-fill (via backend `/barcode/{code}` "found" field) | Backend endpoint exists but its value prop (auto-fill product name/brand) overlaps with user-curated data and complicates the "not-found" flow | Pass through the raw code to "create item" — let user fill details |
| Continuous batch-scan mode | Quick-capture territory; stocktaking not in v2.2 | One scan → pause → act → resume |
| Auto-submit / auto-navigate on first scan | User scans wrong code frequently; always needs confirmation step | Show quick-action menu, require tap to proceed |
| Multi-code simultaneous scan | Not supported by chosen library config (`allowMultiple={false}`); UX confusing | Single code per scan event |
| Scanning from uploaded image file | Mobile-first; camera is the expected input; adds UI complexity | Manual entry fallback only |
| Hardware scanner support (USB/Bluetooth HID) | Explicit out-of-scope in PROJECT.md | Camera + manual entry |
| NFC tag read | Explicit out-of-scope in PROJECT.md | — |

**Dependencies on existing v2.1:** Items API (`GET /api/v1/items`, `GET /api/v1/items/:id`), item detail route (`/items/:id`). Nothing from taxonomy/borrowers/loans at the scanner-core layer.

---

## Feature Area 2: Scan Feedback (Visual / Audio / Haptic)

### Table Stakes (v2.2)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Audio beep on successful scan (Web Audio API oscillator) | Warehouse environments are noisy; silence = "did it work?" | Low | `new AudioContext()` + oscillator, 800–880 Hz, 100–150 ms | Frontend1: `playBeep(freq, duration, volume)` with `playSuccessBeep(880, 100, 0.25)`. No mp3 file needed. |
| AudioContext user-gesture init (tap/click once before first beep) | iOS Safari refuses to play audio without prior user gesture | Low | `initAudioContext()` on `click` + `touchstart` listeners, attached once on scan-page mount | Frontend1 pattern verified shipping. |
| AudioContext resume-if-suspended | iOS auto-suspends inactive AudioContext | Low | `audioContext.resume()` if `state === "suspended"` | — |
| Haptic vibration on successful scan (Android + Chromium) | Tactile confirmation, works with noise + gloves | Low | `navigator.vibrate(50)` — silent no-op on iOS Safari | — |
| Visual "found" state in quick-action overlay | Primary feedback for iOS (no haptic, muted audio) | Low | Entity icon + name + short_code displayed prominently in retro panel | Entity name in large uppercase text. |
| Distinct visual "not found" state | Users must distinguish "silence = failed" from "silence = not in system" | Low | Yellow/amber retro hazard stripe + "NOT FOUND" heading | — |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| ios-haptics library integration for iOS 17.4+ Safari haptics | Closes the iOS tactile-feedback gap | Low | Library already in use in frontend1 (confirmed in PROJECT.md v1.3 key decisions). Single util wrapping `navigator.vibrate` + `ios-haptics`. |
| Differentiated haptic patterns (found: single tap; not-found: double tap) | Users can identify outcome without looking at screen | Low | `navigator.vibrate([10, 50, 10])` for not-found vs `navigator.vibrate(50)` for found | Cited in v1.3 research as a warehouse-ops requested feature. |
| Error beep on not-found (lower pitch, longer duration) | Audio-channel equivalent of haptic differentiation | Low | `playBeep(300, 200, 0.3)` per frontend1 `playErrorBeep()` | — |
| Brief green flash overlay on match | Peripheral-vision confirmation without reading text | Low | 200–400 ms opacity-fading green layer over viewfinder | Use retro accent green (#00ff66-ish); respect `prefers-reduced-motion`. |
| Respect user's notification preferences (sound on/off from v1.7 settings) | Consistent with rest of app's mute toggle | Low | Check existing notification-prefs store before `playSuccessBeep()` | Optional — defer if it bloats phase scope. |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Default-loud long vibrations | Feels cheap, drains battery, annoys shared-office users | 50 ms single pulse max |
| Recorded sound effects (.mp3/.wav assets) | Bundle bloat, licensing overhead, async-load flakiness | Web Audio oscillator (zero asset cost) |
| Always-on continuous beeping while scanner is idle | Confusing and irritating | Beep only on scan-decode event |
| Full-screen flash-bang on scan success | Jarring, flickers badly at 60Hz+ | Subtle corner indicator or brief green tint |
| Auto-voice confirmation ("Item found: Power Drill") | Speech synthesis is slow, privacy-awkward in shared spaces | Silent visual/haptic/beep only |

**Dependencies on existing v2.1:** None directly — new utilities. Optional dependency on v1.7 notifications settings if respecting mute toggle.

---

## Feature Area 3: "Not Found" → Create Item Flow

### Table Stakes (v2.2)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Clear "not found" result state with scanned code visible | Tells user "system searched and came up empty," not "scanner broke" | Low | Quick-action overlay panel with hazard stripe + raw code | Frontend1 pattern: retro panel with code shown verbatim. |
| "Create item" primary action button in not-found panel | Primary recovery path for new inventory | Low | Items create form route + query-param prefill | Frontend1 uses `/dashboard/items/new?barcode=<encoded>`. |
| Barcode pre-filled in create form via URL query param | Zero-retyping of a freshly-scanned code | Low | `useSearchParams()` → `barcode` → `defaultValues.barcode` in `<ItemForm>` | ItemForm already accepts `defaultValues.barcode` (confirmed in frontend2 source). |
| "Scan again" secondary action in not-found panel | User may have scanned the wrong thing; don't force create | Low | `onClose` → resume scanner | — |
| Close (X) button on not-found panel | Escape hatch, matches found-state dismiss | Low | Same onClose | — |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Open "create item" as an in-page retro dialog/sheet (not a navigation) | Keeps scanner mounted → no iOS permission re-prompt → user can keep scanning after creating | High | Requires porting or shrinking `ItemForm` into a dialog variant, or a mini-inline form with just name+barcode+category | Material win for batch stock-in workflows; consider deferring to avoid phase bloat. |
| Backend UPC lookup on not-found (optional auto-suggest brand/name) | If `/barcode/{code}` returns `found: true`, prefill more than just the raw code | Medium | Existing backend endpoint; gate on `found` flag | Only useful when user scans commercial UPC/EAN. Add as "suggest these details?" hint, NEVER auto-write. |
| "Duplicate scan?" detection when same code scanned recently | Prevents the "oh right, I already scanned this" double-create | Low | Consult scan history before declaring not-found | Soft warning, not a block. |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Auto-create an item with auto-generated name after N seconds | Data-quality disaster; always yields "Untitled Item" inventory | Always require explicit user action |
| Silent failure / toast-only "not found" | Loses the actionable recovery path | Full overlay panel with clear CTAs |
| Suggesting arbitrary fuzzy matches as "did you mean?" | Complexity + data-quality risk; `short_code` is exact by design | Exact match only; not-found is genuinely not-found |
| Forcing user to `/scan → /items/new → /scan` round-trip | Breaks iOS PWA permission model (scanner tears down) | In-place dialog OR accept the nav cost and document it |

**Dependencies on existing v2.1:** Items API (POST `/api/v1/items`), `<ItemForm>` component, `/items/new` route (needs to be added if missing — frontend2 currently only has list + detail routes; create is inline via ItemPanel per v2.1).

---

## Feature Area 4: Context-Aware Quick Actions After Scan

### Table Stakes (v2.2)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Overlay action sheet appears over scanner when code matches | Post-scan must offer actions without leaving page | Low | Absolute-positioned panel at bottom of scanner container | Frontend1 wraps `<QuickActionMenu>` in `absolute inset-x-0 bottom-0 p-4`. |
| **View** action — navigate to item detail | Most common post-scan intent | Low | React-Router `useNavigate()` → `/items/:id` | — |
| **Loan** action — navigate to loan-create prefilled with item | Warehouse lending is a primary use case | Low | `/loans?new=1&item=<id>` or a URL param the Loans page respects; requires LoansListPage to read query and open create dialog with item pre-selected | See Feature Area 6 for the full loan integration. |
| **Edit** action — navigate to item edit (inline) | Correct label typos found during a scan-audit | Low | `/items/:id` already has edit affordances in frontend2 ItemPanel | Thin wrapper over View. |
| Entity name + short_code displayed prominently | User must confirm "yes this is the right item" before acting | Low | Retro panel header with icon + name + short_code | — |
| "Scan again" dismissal button | Return to continuous scanning flow | Low | `onClose` → clear match, resume scanner | — |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Context-adaptive action set based on item state | Reduces cognitive load; hides nonsensical options | Medium | Query item state fields: `is_archived`, `needs_review`, active-loan-count. Show different buttons: <br>- **Archived item** → only "View", "Unarchive"; hide Loan/Move <br>- **Already loaned out** → "View loan", "Mark returned"; hide "Loan again" <br>- **needs_review** → surface "Mark reviewed" as first action <br>- **Normal item** → full set (View / Loan / Edit) | Medium complexity because it requires the scan-lookup response to include state flags or a follow-up fetch. |
| **Move** action — reassign location/container | Physical reorg workflow (move item from Garage → Workshop) | Medium | Inventory API (PUT on inventory row) + location/container picker dialog | Frontend1 shipped this as "Coming soon" toast — implementing it here would exceed v1.3 parity. Candidate for differentiator if scope allows. |
| **Repair** action — create repair log entry or navigate to item repairs tab | Maintenance workflows | Medium | Repair log feature is NOT in frontend2 yet (v1.2 domain). | Only viable if v2.2 also ports repair-log UI — probably out of scope. Drop from v2.2 or defer to V2.3. |
| Show recent-loan history on panel when scanning an already-loaned item | "Who has my drill?" — answered in one scan | Low | Small inline text showing active-loan borrower name | High-value for warehouse-loan UX. |
| Swipe-down to dismiss quick-action sheet (mobile gesture) | Native-feeling mobile UX | Medium | Gesture library or manual touch handler | Polish; keyboard-X is sufficient table-stakes. |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Showing all 4 actions (View/Loan/Move/Repair) always | Buttons that lead to unimplemented flows damage trust | Show only what's wired through to working routes |
| Auto-executing default action after N seconds | Accidental scans lead to bad state changes | Always require explicit tap |
| Destructive actions (Archive/Delete) in quick-action menu | Post-scan is not the moment for destructive ops | Keep those on the item detail page |
| More than 4 actions in the sheet | Decision paralysis, violates Material FAB guidance (3–5 max) | Cap at 4; prioritize View + Loan + Edit + one context action |
| Modal dialogs that cover the scanner | Defeats the single-page-stay-mounted pattern → iOS permission loss | Bottom sheets / overlays only |

**Dependencies on existing v2.1:** Items API (for state flags), Loans API (for Loan action + active-loan count), `/items/:id` route, `/loans` route with query-param support (needs to be added).

---

## Feature Area 5: Scan History

### Table Stakes (v2.2)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Last-10 scans persisted to localStorage | Quick-recall of items just touched; battery-efficient (no network) | Low | `hws-scan-history` key, JSON-serialized array, max 10 entries | Frontend1 implementation is ~150 LOC — port almost verbatim. |
| De-duplication: same code rescanned moves to top (doesn't add duplicate entry) | Users scan the same shelf repeatedly; cluttering history is annoying | Low | `filter(h => h.code !== code)` before unshift | — |
| Timestamp per entry with "Just now / N min ago / N hr ago / date" formatting | Temporal context ("was that this morning or yesterday?") | Low | `Date.now()` + `formatScanTime()` util | Reuse existing `useDateFormat` hook for dates older than 24h. |
| History accessible via tab on `/scan` page | One-tap access; no navigation | Low | `<Tabs>` with Scan / Manual / History tabs | Matches frontend1 layout (scan/manual/history 3-tab `<TabsList>`). |
| Tap history entry → re-lookup and show quick-action menu | "I scanned this 5 minutes ago but lost the menu" recovery | Low | `lookupByShortCode(entry.code)` → set match state | Frontend1 re-fetches because entity may have changed (e.g., archived since last scan). |
| "Clear all" button | Housekeeping; privacy when sharing device | Low | `clearScanHistory()` | Icon-only trash button with retro confirm. |
| Entity icon per row (item/container/location/unknown) | Visual scannability of the list | Low | Icon map; unknown = retro question-mark | Items-only in v2.2 means mostly Package icon + unknown. |
| Empty state ("No recent scans") | Communicates "you haven't scanned anything yet" vs "broken" | Low | — | — |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Barcode format badge per entry (QR / EAN-13 / Code128 / Manual) | Warehouse-nerd detail; helps diagnose "why did this one not scan" | Low | Already captured in `entry.format`; show as small monospace badge | — |
| Per-entry delete (remove single from history) | Privacy; clean up mis-scans | Low | `removeFromScanHistory(code)` already exists in frontend1 lib | Swipe-to-delete or trailing X button. |
| "Found" vs "Not found" visual distinction in list | Quickly see which scans need follow-up creation | Low | Color/icon based on `entityType !== "unknown"` | — |
| Sync history to server (cross-device) | Scan on phone, view history on desktop | High | New backend table + sync endpoint | Out of v2.2 scope — noted for future. |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Unbounded history growth | localStorage quota concerns; scroll fatigue | Hard cap at 10 entries |
| Storing full entity snapshot per scan | Stale data, wasted space, privacy concerns | Store only code + timestamp + minimal metadata (id/name), re-lookup on tap |
| Syncing history across users in same workspace | Privacy mismatch — scans are personal navigation trail | Per-device, per-user only |
| Exposing history in other pages (sidebar, dashboard widget) | Feature creep; scan history lives on `/scan` | Keep scoped to `/scan` page |

**Dependencies on existing v2.1:** None — self-contained localStorage util + Items API for re-lookup.

---

## Feature Area 6: Loan Creation Integration (Scan-to-Loan)

### Table Stakes (v2.2)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| "Loan" action on scanned item → opens loan-create with item pre-selected | Warehouse lending's canonical workflow: pick up item, scan, pick borrower | Low | Loan form already exists (`LoanForm` in frontend2); needs query-param-driven initial state OR prop-driven item preselect | Current LoanForm takes `mode: "create"`; needs ability to accept `defaultItemId` prop OR URL param. |
| Inline barcode-scan button inside Loan create form (Item field) | Skip the combobox search when item is physical-in-hand | Medium | Mini-scanner modal or reuse `/scan` route with return-URL | Opens camera, scans, closes with item ID resolved into form. |
| Scan feedback persists into form as filled combobox value | Visual confirmation "yes the right item made it in" | Low | `setValue("inventory_id", resolved)` + combobox-display-value sync | Be careful with `RetroCombobox` controlled-value patterns (see existing v2.1 LoanForm). |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Double-scan workflow: scan item → scan borrower (via a borrower QR/short_code) | Hands-free lending; powers fast stock-out during warehouse ops | Medium | Borrowers would need `short_code` field + QR badge printing (out of scope). For v2.2: support if borrower short_code already exists on entity; otherwise defer. | Borrowers entity in frontend2 doesn't currently surface a `short_code` — **feasibility check needed during phase planning.** |
| Auto-open quick-loan form after scanning an item on `/scan` page (bypass quick-action menu) | Single-intent workflow when user's primary verb is "lend" | Medium | Intent toggle on `/scan`: "Scan mode: Lookup / Lend" | User toggles intent once, then every scan triggers the loan flow directly. |
| Quick-loan from scan with minimal fields (just item + borrower, defaults for dates) | Ultra-fast stock-out; skip due-date/notes | Low | Submit with loaned_at=today, due_date=today+7, quantity=1 | Defaults feel opinionated but sensible for household scale. |
| Return loan via scan: scan item → if actively loaned, "Mark returned" is primary action | Closes the lending loop symmetrically | Low | Covered by Feature Area 4 context-aware actions (already-loaned state) | — |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Auto-submitting a loan on single scan | Loans have 5+ fields; auto-creation yields bad data | Always show confirmation form, however minimal |
| Requiring borrower QR codes for v2.2 loan integration | Borrower short_code not yet in data model; scope explosion | Keep borrower selection via combobox, item via scan |
| Bulk "lend all these to Alice" batch-scan mode | Niche; adds significant state management | Single loan at a time |

**Dependencies on existing v2.1:** Loans API (POST `/api/v1/loans`), `LoanForm` component (needs `defaultItemId` support or URL-param reading), Borrowers API (combobox is already wired).

---

## Feature Area 7: Quick Capture Integration (Barcode Autofill)

### Scope Note

Quick Capture is **not currently built in `/frontend2`** — it exists only in legacy frontend1 (v1.9, shipped 2026-03-14). PROJECT.md lists "Quick capture flow in `/frontend2`" under active v2.2, so this feature area assumes Quick Capture arrives in v2.2 alongside scanning. If Quick Capture is pushed to v2.3, drop this entire section.

### Table Stakes (v2.2 — if Quick Capture ships)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| Barcode scan button inside Quick Capture header/form | Scanning a commercial UPC onto a newly-captured item is THE v1.9 value prop we missed | Low | Shared scanner modal/overlay | One-handed, mobile-first. |
| Scanned code autofills barcode field (not SKU) | SKU is auto-generated (`QC-{timestamp}-{random}`); barcode is the user-visible value from camera | Low | `setBarcode(scannedCode)` | Frontend1 v1.9 does NOT currently integrate scan into capture — this would be new behavior. |
| Visual + audio + haptic feedback consistent with main scanner | Muscle memory across scan contexts | Low | Shared feedback util | — |
| Manual entry fallback inside capture | Barcode damaged / too small / in low light | Low | Text input on barcode field with inputMode="text" | — |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Auto-advance to "save item" after scan in capture mode | One-handed warehouse workflow: photo → scan → done | Medium | Scan triggers name-field focus OR direct save if name already entered | Opinionated; could be a setting. |
| Backend UPC lookup autofills item name from `/barcode/{code}` | Scanning a Coca-Cola can → name="Coca-Cola" pre-filled | Medium | Existing `/barcode/{code}` endpoint returns name/brand | Only useful for commercial products; household-made items still need manual name. |
| Duplicate-barcode detection at capture time | Scanning a code that's already in inventory → "Existing item: X — update or create new?" | Medium | Check `?barcode=<code>` before save | Prevents accidental duplicates during session capture. |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Opening the full `/scan` page from Quick Capture | Breaks capture-session flow; re-mount breaks camera on iOS | Inline scanner modal reusing the same `<BarcodeScanner>` component |
| Blocking save until barcode is scanned | Not every item has a barcode; don't force it | Barcode remains optional |
| Auto-populating SKU from barcode | SKU is the internal `QC-{ts}-{rand}` identifier; barcode is the external code; keep them separate | Fill barcode field only |

**Dependencies on existing v2.1:** Items API, Quick Capture feature (must exist first), shared `<BarcodeScanner>` component.

---

## Feature Area 8: Floating Action Button + Radial Menu

### Table Stakes (v2.2)

| Feature | Why Expected | Complexity | Depends On | Notes |
|---|---|---|---|---|
| FAB component at bottom-right, mobile-only (`md:hidden`) | Material Design standard; mobile quick-access | Low | `motion` library for Tailwind-free animation OR CSS transitions | Frontend1 uses `motion/react` v12.27.0 + `@use-gesture/react` v10.3.1. For v2.2, prefer plain CSS/Tailwind transitions to avoid adding `motion` — check during phase planning. |
| 56×56 px FAB (Material standard) | WCAG AA touch target + familiar size | Low | Tailwind `h-14 w-14 rounded-full shadow-lg` | Retro skin: square with shadow-retro-raised instead of circle, OR circle with retro border/stripe. |
| Radial-arc expansion of 3 action items (44px each) | Efficient use of thumb zone; top-arc layout (startAngle=-π/2, arcAngle=π/2) | Medium | Polar-coords calculation (Math.cos/sin) per action, staggered animation | Frontend1 formula: `x = cos(angle) * radius`, `y = sin(angle) * radius`, radius=80px. Translate to absolute-positioned children. |
| Context-aware action set per route | Different page → different primary verbs (see below) | Medium | `useLocation()` from react-router + action-config map | Match frontend1's `useFABActions()` hook pattern. |
| FAB rotates/morphs icon when open (+ → ×) | Visual affordance: "tap again to close" | Low | CSS transform rotate(45deg) on the Plus icon | — |
| Haptic pulse on FAB tap | Tactile ack for primary interaction | Low | `navigator.vibrate(20)` + ios-haptics on open/close | Short taps only, not sustained buzz. |
| Dismiss on outside-click + Escape key | Standard overlay behavior | Low | document click listener + keydown listener | Frontend1 pattern: ~10 lines each. |
| Hidden on desktop (breakpoint-based) | FAB is a mobile pattern; desktop has sidebar | Low | `className="md:hidden"` | — |
| Hidden on `/scan` and `/items/quick-capture` pages | Scanner has its own primary action; FAB would overlay video | Low | `if (pathname === "/scan") return []` in hook | — |
| ARIA roles + keyboard accessibility | A11y must not regress vs v1.3 | Low | `role="group"`, `role="menu"`, `role="menuitem"`, `aria-expanded`, `aria-haspopup`, `aria-label` | Frontend1 has this wired. |

### Context-Aware Action Mapping (Table Stakes)

Per frontend1's `useFABActions()`, the exact route → actions mapping:

| Route | Actions (in radial order) | Notes |
|---|---|---|
| `/scan` | (hidden — scanner owns the primary action) | — |
| `/items/quick-capture` | (hidden — capture owns the primary action) | Only if Quick Capture ships in v2.2 |
| `/items` or `/items/*` | Quick Capture → Add Item → Scan | Quick Capture first because it's the fastest create |
| `/loans` | Scan → Add Item → Quick Capture (default) OR Scan → Add Loan → Add Item | Debatable; v1.3 used the default set. Recommendation: swap "Add Item" for "Add Loan" on loans routes. |
| `/` (dashboard), `/borrowers`, `/taxonomy`, `/settings/*` | Scan → Quick Capture → Add Item (default) | Scanning and quick-adding are the global primary verbs |

### Differentiators (v2.2)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Retro-styled FAB (square with hazard stripe, or neon glow) | Brand consistency with rest of `/frontend2` | Low | Swap `rounded-full` for `shadow-retro-raised` square | Design call; defer to visual design review. |
| Tooltip labels on action items on long-hover | Discoverability for power users | Low | Native title or small retro tooltip panel | — |
| Badge on FAB indicating offline-pending count / sync status | Visible persistent state | Medium | Small red badge overlay | Moot in v2.2 since offline isn't in scope; defer. |
| Long-press on list items to toggle selection mode | Multi-select for bulk ops | Medium | `@use-gesture/react` or manual pointer events | Frontend1 has this infrastructure but it's unused — not needed in v2.2 unless bulk ops are in scope. |
| Auto-hide FAB on scroll-down, reveal on scroll-up | iOS-style safe-area management | Low | Scroll-direction hook + transform translateY | Polish; Material spec mentions as optional. |
| Different FAB icon per context (Scan icon on items pages, Plus on dashboard) | Visual affordance for primary verb | Low | Config returns icon per route | — |

### Anti-Features (NOT in v2.2)

| Anti-Feature | Why Avoid | Instead |
|---|---|---|
| Multiple FABs on same screen | Violates Material guidance; user confusion | Single FAB with radial menu |
| More than 5 radial actions | Decision paralysis; radial layout breaks visually | 3–4 actions max; frontend1 ships with 3 |
| Destructive actions (Delete, Archive) in FAB | FAB = positive/create actions per Material | Put destructive ops in row actions, not FAB |
| Drag-to-reposition FAB | Preference-heavy, low-value, complicates everything | Fixed bottom-right |
| Persistent FAB on desktop | Sidebar provides navigation; FAB wastes screen space | `md:hidden` |
| Animating FAB on every route change | Visual noise, distracts from content | Animate only on open/close |
| Overlapping FAB with bottom sheet/dialog | Obscures content | Hide or push FAB during overlay display |

**Dependencies on existing v2.1:** AppShell layout (for mount point), react-router `useLocation()` (already available), any new `motion/react` dependency (or CSS-only alternative).

---

## Feature Dependencies

```
Backend APIs (shipped):
  GET /api/v1/items?barcode=<code>  ────┐
  GET /api/v1/items/:id                 │
  POST /api/v1/items                    ├──> Scanner core + not-found flow
  GET /barcode/{code}  (UPC DB lookup)  ┘    (optional enrichment)
  POST /api/v1/loans ──────────────────────> Scan-to-loan

Frontend2 existing (v2.1):
  ItemForm + ItemPanel ────────────┐
  LoanForm + LoansListPage ────────┼──> Quick-action targets
  RetroPanel + RetroInput + Tabs ──┘

NEW in v2.2:
  <BarcodeScanner>   (wraps @yudiel/react-qr-scanner)
       │
       ├─> scanner/feedback.ts  (audio, haptic, visual)
       │
       ├─> scanner/history.ts   (localStorage last-10)
       │
       ├─> scanner/lookup.ts    (hits Items API, NOT IndexedDB)
       │
       └─> ScanPage             (full-screen-ish single-page flow)
                │
                ├─> <QuickActionMenu> (context-aware overlay)
                │        └─> navigates to /items/:id, /loans?item=, /items/:id (edit)
                │
                └─> <ManualEntryInput> (fallback)

  <FloatingActionButton>  (mobile-only, radial 3-action menu)
       │
       └─> useFABActions()  (route-aware action config)
                │
                └─> opens /scan, /items (new), /items/quick-capture
```

**Build order implication for roadmap:**

1. **Scanner core + feedback** (Feature Areas 1+2) — unblocks everything else. Zero dependencies on new frontend2 features.
2. **Scan page with history + quick-action overlay + not-found flow** (Feature Areas 3+4+5) — depends on #1.
3. **FAB + context-aware actions** (Feature Area 8) — can parallel with #1/#2; depends on route structure only.
4. **Loan integration** (Feature Area 6) — depends on #1 and on v2.1 LoanForm accepting a preselected item.
5. **Quick Capture integration** (Feature Area 7) — depends on #1 AND on Quick Capture existing in frontend2 (separate v2.2 workstream).

---

## MVP Recommendation (v2.2 scope)

**Must ship (table-stakes parity with v1.3 scanning):**
1. `<BarcodeScanner>` component with torch + manual fallback
2. `/scan` page with 3-tab layout (Scan / Manual / History)
3. Audio (Web Audio API beep) + haptic (vibrate + ios-haptics) + visual feedback
4. Quick-action overlay with View + Loan + Edit actions (context-aware subset where possible)
5. "Not found" panel with "Create item (prefilled barcode)" + "Scan again" actions
6. Scan history persistence (localStorage, last 10, dedupe, re-lookup on tap)
7. FAB component (mobile-only) with radial 3-action menu
8. Context-aware FAB actions per route (default + `/items` variant)
9. FAB hidden on `/scan` (and `/items/quick-capture` if it ships)
10. Loan-create integration: scanned item preselects in loan form (via URL param or prop)

**Ship if time permits (differentiators):**
- Retro CRT scanline viewfinder overlay
- Context-adaptive action set (archived → only View/Unarchive; loaned → Mark returned)
- Active-loan borrower shown on quick-action panel for loaned items
- Per-entry delete in scan history
- UPC backend lookup autofill in not-found flow

**Defer explicitly:**
- Container/location scanning (items-only in v2.2)
- Batch/continuous scan mode
- External UPC-database auto-fill beyond the not-found enrichment case
- Move action (requires inventory-move UI not yet in frontend2)
- Repair action (repair-log feature not yet in frontend2)
- Hardware scanner support (out-of-scope per PROJECT.md)
- NFC (out-of-scope per PROJECT.md)
- Cross-device scan history sync
- Borrower-code double-scan loan workflow (requires borrower short_code data-model work)
- Long-press selection mode (infrastructure ready in legacy, not needed for v2.2)
- FAB auto-hide on scroll

---

## Prep Items / Open Questions

Per PROJECT.md, these must be answered during phase planning before implementation:

1. **Canonical barcode-lookup endpoint:**
   - Does `GET /api/v1/items?barcode=<code>` exist, or is it `?search=<code>`? Both? Confirm exact response shape.
   - Does the items list endpoint accept `short_code` as a filter? (v1.3 frontend1 hits IndexedDB for short_code lookup; v2.2 must use the API.)
   - Relationship with `GET /barcode/{barcode}` (external UPC lookup) — when is one used vs the other?

2. **`@yudiel/react-qr-scanner@2.5.1` React 19 peerDep:** **CONFIRMED via `npm view`** — peer deps are `react: '^17 || ^18 || ^19'`. No blocker; no alternative library needed.

3. **`motion` (ex-framer-motion) dependency for FAB animations:** Frontend1 uses `motion/react@12.27.0` + `@use-gesture/react@10.3.1`. Evaluate during phase planning whether CSS-only transitions are sufficient for the radial arc, or whether adopting motion into frontend2 is the right call. Recommendation: prefer CSS for v2.2 to keep the bundle lean; revisit if FAB animation feels janky.

4. **Quick Capture inclusion in v2.2:** PROJECT.md lists it under active v2.2; if it slips to v2.3, Feature Area 7 (scan-in-capture) drops from this milestone entirely.

5. **LoanForm preselect API:** `LoanForm` in frontend2 takes `mode: "create" | "edit"` but no `defaultItemId` prop today. Either extend props or implement URL-param-reading in `LoansPage`. Recommendation: URL param is simpler and matches frontend1 pattern (`/dashboard/loans/new?item=<id>`).

6. **Torch feature detection cost:** The `checkTorchSupport()` probe in frontend1 opens a full `getUserMedia` stream just to read capabilities — this double-prompts permissions on some browsers. Worth reviewing for alternatives, or accepting the cost.

---

## Complexity Summary

| Feature Area | Complexity | Dominant Cost |
|---|---|---|
| 1. Scanner Core | Medium | Library wiring + iOS-PWA permission discipline |
| 2. Scan Feedback | Low | AudioContext user-gesture discipline |
| 3. Not-Found → Create | Low | URL-param plumbing (can escalate to High if inline-dialog is chosen) |
| 4. Context-Aware Quick Actions | Medium | State-dependent action resolution |
| 5. Scan History | Low | Straight port from frontend1 |
| 6. Loan Integration | Medium | LoanForm preselect + potential borrower-code double-scan |
| 7. Quick Capture Integration | Medium | Only if Quick Capture ships; else N/A |
| 8. FAB + Radial Menu | Medium | Animation choice (motion vs CSS) + context-aware hook |

**Aggregate v2.2 sizing:** Medium — the feature is well-scoped because v1.3 is the reference implementation. Estimate 4–6 phases:
- P1: Scanner core + feedback (FA 1+2)
- P2: Scan page with history + not-found + quick-action overlay (FA 3+4+5)
- P3: FAB + context-aware actions (FA 8)
- P4: Loan integration (FA 6)
- P5: Quick Capture integration (FA 7) — if applicable
- P6: Retro-polish pass (differentiator CRT overlay, adaptive actions) — if scope allows

---

## Warehouse-Workflow Context Preserved

Every "table stakes" designation above was gated by these real-world constraints (carried forward from v1.3 research):

- **One-handed operation:** FAB at thumb-reachable bottom-right; scanner tap-target sizes ≥44 px; manual entry uses oversized inputs.
- **Gloved hands:** Haptic feedback required (gloves defeat touch screens intermittently; vibration confirms action); low reliance on fine gestures.
- **Noisy environments:** Audio beep is a differentiator, not sole channel; haptic and visual are always co-channel.
- **Poor lighting:** Torch toggle is table-stakes; camera autofocus configured to `facingMode: "environment"` explicitly.
- **Battery-sensitive operation:** No always-on continuous scan beyond 30s idle; pause scanner whenever action sheet is up; avoid unnecessary renders during long scan sessions.
- **Intermittent network:** v2.2 is online-only, but the scan page should degrade gracefully — manual entry fallback works regardless of backend availability, and scan-history is localStorage-backed so it survives page reload even offline.

---

## Sources

- `.planning/PROJECT.md` (v2.2 active milestone definition, v1.3 shipped features) — HIGH
- `.planning/research/FEATURES_MOBILE_UX.md` (v1.3 mobile-UX research, industry patterns) — HIGH
- `.planning/milestones/v1.3-ROADMAP.md` (shipped v1.3 scanning deliverables) — HIGH
- `frontend/app/[locale]/(dashboard)/dashboard/scan/page.tsx` (reference ScanPage implementation) — HIGH
- `frontend/components/scanner/{barcode-scanner,quick-action-menu,manual-entry-input,scan-history-list}.tsx` (reference UX) — HIGH
- `frontend/lib/scanner/{scan-lookup,scan-history,feedback,types}.ts` (reference lib modules) — HIGH
- `frontend/components/fab/{floating-action-button,fab-action-item}.tsx` (reference FAB) — HIGH
- `frontend/lib/hooks/use-fab-actions.tsx` (reference context-aware FAB hook) — HIGH
- `backend/internal/domain/barcode/handler.go` (backend UPC-lookup endpoint shape) — HIGH
- `frontend2/package.json` + `frontend2/src/routes/index.tsx` (confirmed no scanner deps present; `/scan` route stub exists) — HIGH
- `npm view @yudiel/react-qr-scanner` (peerDependencies React 17/18/19 confirmed; version 2.5.1) — HIGH
- [@yudiel/react-qr-scanner on npm](https://www.npmjs.com/package/@yudiel/react-qr-scanner) — MEDIUM (referenced for version metadata)
- [yudielcurbelo/react-qr-scanner on GitHub](https://github.com/yudielcurbelo/react-qr-scanner) — MEDIUM
