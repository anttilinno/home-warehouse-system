# v2.2 Scanning & FAB Pitfalls

**Domain:** Adding browser-based barcode/QR scanning + mobile FAB + radial menu + scan-driven workflow integrations to an existing Vite + React 19 + Tailwind 4 SPA. Plus: closing accumulated verification/coverage/hygiene debt from v1.9–v2.1.
**Researched:** 2026-04-18
**Confidence:** HIGH (grounded in shipped v1.3 + v1.9 + v2.1 lessons from PROJECT.md + v1.3/v2.1 audits; library-specific details verified against yudielcurbelo/react-qr-scanner README and MDN)

---

## TOP 5 Most-Likely-to-Bite Pitfalls

These are the pitfalls that combine **highest impact** with **highest recurrence probability** based on the project's own history (v1.3 and v1.9 hit almost every one of these) and ecosystem-wide data.

1. **#1 — iOS PWA camera permission reset on navigation (scan → create item).** Blocker for the "not found → create" flow. Already fixed for v1.9 Quick Capture with the "single-route" pattern (see PROJECT.md Key Decisions row *"Single-page scan flow"*). v2.2 will regress the moment anyone types `navigate('/items/new')` from inside the scanner. The fix is a dialog/sheet overlay **on** `/scan`, not a route push.
2. **#18 — Retroactive VERIFICATION.md written from memory without actually re-running anything.** The v2.1 audit explicitly flagged this shape (3 phases transitively validated, VERIFICATION.md skipped). The v2.2 stabilization phase is about to backfill that debt — the natural shortcut is to write plausible-sounding VERIFICATION.md files from what "should" work rather than running the tests. That poisons the archive and creates false confidence.
3. **#13 — Workspace-scoping missed on barcode-lookup endpoint → cross-tenant leak.** v1.3 lookup was workspace-scoped; `/frontend2` is re-implementing it. A GET handler without `workspace_id` in the WHERE clause returns another tenant's item when two users scan the same UPC — and because a UPC is global (same EAN on every can of Coke in the world), collisions are **guaranteed**, not hypothetical. Severity: data leak.
4. **#4 — React 19 StrictMode double-mount destroying camera init.** Dev mode only, but it wastes hours before someone notices the symptom ("camera only works in production"). `@yudiel/react-qr-scanner` 2.5.1 has no explicit React 19 story in its README; the camera-init pattern must be cleanup-safe (stream-tracking ref array + defensive cleanup).
5. **#16 — TanStack Query cache stale after scan→create→return flow.** User scans unknown UPC, creates item, returns to scanner, scans same UPC again — still "not found" because `useQuery(['itemByBarcode', ean])` was cached on the first miss. Classic. Needs invalidation + a hook-level helper that forces refetch on scan.

Everything else below matters but is less likely to surprise a disciplined team.

---

## Context Snapshot

**What already exists in the app (reuse, don't re-invent):**

- `/frontend` (legacy): `BarcodeScanner`, `FloatingActionButton`, `useFABActions`, `ios-haptics` wrapper, AudioContext beep-unlock pattern — all shipped v1.3, audit-clean.
- `/frontend2` (target): Retro primitives + TanStack Query + react-hook-form/zod + Lingui; **no** scanner, FAB, or haptic wrapper yet.
- Backend: barcode-lookup endpoint exists (used by v1.3). Needs verification of exact path + response shape — this is called out as a prep item in PROJECT.md.
- Key decision already made: **single-route scan flow** (documented in PROJECT.md Key Decisions as a v1.3 + v1.9 precedent).

**What's new vs. v1.3:**

- React 19 (StrictMode double-mount, ref forwarding changes, no more defaultProps).
- Retro component library (no shadcn Dialog/Sheet ready-made).
- TanStack Query (not Next.js router loaders) as the cache layer.
- `@yudiel/react-qr-scanner 2.5.1` (latest as of 2026-01-19) pinned as the library candidate, subject to peer-dep verification.

**Parallel debt items this milestone must close (stabilization):**

- v2.1 Phase 57: 8 unsigned `/demo` human checkpoints.
- v2.1 Phases 58, 59, 60: missing VERIFICATION.md files.
- v1.9 Phases 43–47: Nyquist retroactive validation.
- Backend: `pendingchange` handler.go unit tests (57.3% → ≥80%), `jobs` ProcessTask mocking (20.1% → actionable baseline).
- Test hygiene: 56 `waitForTimeout` calls in 24 E2E files; 4 pre-existing Vitest failures; orphaned Go test factories.

The scanning work and the stabilization work share one team and one calendar. Pitfalls cross-pollinate: "let's ship scan first and backfill docs at the end" → docs never get backfilled → compounds v2.1's debt.

---

## Critical Pitfalls (Blocker-level)

### Pitfall 1: iOS PWA camera permission reset on route navigation

**Severity:** BLOCKER.

**What goes wrong:** Scanner renders on `/scan`. User scans an unknown barcode → app calls `navigate('/items/new?barcode=...')` to open the create form. User saves, goes back to scanner → iOS Safari (especially in installed-PWA standalone mode) re-prompts for camera permission, or `getUserMedia` silently fails with `NotAllowedError`. In the worst case the user is stuck in a permission-prompt loop every scan.

**Why it happens:** Documented WebKit behavior. In standalone-mode PWAs the getUserMedia permission is bound to a narrower scope than in the tabbed browser; route changes that alter the URL (path/hash) can trigger a fresh permission check. Also: leaking `MediaStream` tracks (not calling `stream.getTracks().forEach(t => t.stop())` on unmount) leave the camera "in use," and iOS then demands re-permission next time.

**Prevention (concrete):**
- `/scan` is a **single route with an internal state machine**: `idle → scanning → matched | not-found → action-menu | create-overlay`. NEVER `navigate()` away to open create/loan/move flows mid-scan. Render those as sheet/dialog overlays on the scan route.
- On every camera teardown (including the "pause between scans" state) call:
  ```tsx
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);
  ```
  Use a **ref array** pattern (push new streams, iterate on cleanup) to survive StrictMode's double-invoke — see Pitfall 4.
- If a navigation is truly required (e.g., "View item" from scan-result menu), stop the stream **first**, then navigate. On return, re-init on a fresh mount.
- Explicitly test on installed iOS PWA (Add to Home Screen → launch from home screen), not just Safari tab. These are different permission scopes.

**Detection:**
- Two consecutive scans in a single session: the second one prompts for permission = bug.
- `navigator.permissions.query({ name: 'camera' })` returns `'prompt'` after first successful scan = leaked stream.
- Black viewfinder + `NotAllowedError` in console after returning from a subroute.

**Phase:** Scanning foundation phase (first thing built). This is the anchor decision that shapes the whole scanner architecture.

---

### Pitfall 2: Camera stream not released → battery drain + frozen-on-return

**Severity:** BLOCKER for mobile UX.

**What goes wrong:** User leaves the `/scan` route via back gesture, swipes to another tab, or navigates via FAB. The component unmounts but the `MediaStream` keeps its tracks live because the effect cleanup ran before `getUserMedia` resolved, or because the track reference was captured in a stale closure.

Symptoms:
- Hot phone battery (camera LED stays on in Chrome Android — less obvious on iOS).
- Next visit shows a frozen frame, or `getUserMedia` throws `NotReadableError: Could not start video source`.
- Multiple camera instances stack up across a session.

**Why it happens:** The v1.9 audit explicitly lists this as tech debt: *"Stale closure in QuickCapturePage unmount useEffect — photos at mount may not revoke on navigate-away (mitigated per-action)"* (PROJECT.md Tech Debt from v1.9). Same class of bug applies to MediaStream tracks.

Classic pattern:
```tsx
// BAD — stale closure
useEffect(() => {
  let stream;
  getUserMedia(...).then(s => stream = s);
  return () => stream?.getTracks().forEach(t => t.stop()); // stream may be undefined
}, []);
```

**Prevention (concrete):**
- Use a **ref array** outside the effect, push each new stream into it, iterate all on cleanup:
  ```tsx
  const streamsRef = useRef<MediaStream[]>([]);
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamsRef.current.push(stream);
        videoRef.current!.srcObject = stream;
      });
    return () => {
      cancelled = true;
      streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
      streamsRef.current = [];
    };
  }, []);
  ```
- Also stop on: `visibilitychange` (tab backgrounded), `pagehide`, explicit "exit scanner" button.
- If using `@yudiel/react-qr-scanner`, verify the `<Scanner />` component does this internally (read its source) — if not, wrap it and add the cleanup belt-and-braces.

**Detection:**
- Chrome DevTools → `chrome://media-internals/` shows active MediaStreams after navigation.
- Track the camera LED manually on an Android device.
- E2E test: navigate in, navigate out, navigate in again — second init must succeed.

**Phase:** Scanning foundation phase.

---

### Pitfall 3: Missing `playsInline` on the video element → iOS fullscreen takeover

**Severity:** BLOCKER on iOS.

**What goes wrong:** Without `playsInline` (and `muted` + `autoplay`), iOS Safari hijacks the `<video>` element into native fullscreen playback, ignoring the retro scanner UI entirely. Torch button, scan overlay, cancel button — all invisible.

**Why it happens:** Apple's legacy policy: inline video playback is off-by-default on iPhone (enforced by WebKit) unless the video element has `playsinline` attribute. This is documented and well-known but still missed whenever someone hand-rolls a `<video>` instead of using a library wrapper.

**Prevention:**
- Always:
  ```tsx
  <video ref={videoRef} autoPlay muted playsInline />
  ```
  (Case matters for JSX: `playsInline`. Case doesn't matter for HTML: `playsinline`.)
- If using `@yudiel/react-qr-scanner`, verify this in the rendered DOM via DevTools — don't trust the library blindly.
- Add a Vitest assertion or a Playwright snapshot that the `<video>` element has `playsinline` attribute.

**Detection:** On iPhone, the scanner page goes black-and-fullscreen on first camera frame, losing your UI.

**Phase:** Scanning foundation phase.

---

### Pitfall 4: React 19 StrictMode double-mount breaks camera init

**Severity:** MAJOR (dev-only, but burns hours).

**What goes wrong:** React 19 (and 18) in development mode deliberately mounts → unmounts → mounts every effect to flush out effect-cleanup bugs. For a camera-init effect this means:
1. Effect A starts `getUserMedia`.
2. Effect A's cleanup runs (component "unmounts").
3. Effect B starts a **second** `getUserMedia`.
4. Effect A's promise resolves → writes to an unmounted state.
5. Effect B's promise resolves → writes to the current state.

Result: two cameras claimed, one leaks, StrictMode's second stream is the visible one but A's leak keeps the LED on. On some browsers `getUserMedia` throws on the second call because the camera is already in exclusive use.

**Why it happens:** The library candidate `@yudiel/react-qr-scanner 2.5.1` doesn't advertise StrictMode safety in its README. Same issue already surfaced in `html5-qrcode` (see [GitHub issue #641](https://github.com/mebjas/html5-qrcode/issues/641) — "Two cameras appear on reload").

**Prevention:**
- The ref-array cleanup pattern from Pitfall 2 handles this — as long as **every** obtained stream is pushed to the array and every cleanup iterates the full array, the double-mount doesn't leak.
- Add a `cancelled` flag inside the effect; on cleanup set it, and have the async resolution check it before attaching.
- DO NOT disable StrictMode. It's catching real bugs.
- Test explicitly: run `npm run dev`, open `/scan`, confirm only one track is active (`navigator.mediaDevices.enumerateDevices()` + `MediaStream.active` in console).

**Detection:** In dev mode, console logs `"Camera started"` twice in a row. Two entries in `chrome://media-internals/`.

**Phase:** Scanning foundation phase. **Test in StrictMode from day one — don't disable it to "make things work."**

---

### Pitfall 5: Workspace-scoping missed on barcode-lookup endpoint (cross-tenant data leak)

**Severity:** BLOCKER (data leak / tenant isolation violation).

**What goes wrong:** `GET /api/items/by-barcode?code=5901234123457` returns a match from another workspace because the SQL omits `WHERE workspace_id = $1`. Any user scanning a common UPC (every consumer product has a globally unique one — every can of Coke is `5449000000996`) will see another tenant's item data.

**Why it happens:** Barcodes feel "global" (because they are, in the GS1 sense — that's literally the point of GTIN). Developers model them as primary-ish keys and forget the multi-tenant constraint. The endpoint may have been correctly scoped in v1.3 backend, but v2.2 is adding scan integrations (loan create, quick capture autofill) that may invent **new** lookup endpoints or new query parameters without re-applying scoping.

**Prevention:**
- **All** barcode lookup queries MUST filter by `workspace_id` from the session, never from the request body/query. This is a Go backend rule, but frontend can defend-in-depth by asserting the response's `workspace_id` matches the current session's.
- Add a Go integration test that creates items with the same barcode in two workspaces and asserts User A cannot see User B's match. Run in CI.
- PR review checklist: any new barcode-related endpoint gets flagged for tenant-scoping review.
- If the backend returns zero rows, the frontend MUST show "not found" — **never** fall back to "ambiguous match" logic that drops the workspace filter.

**Detection:** Two-user E2E test. Also: code search for SQL matching `barcode =` that doesn't also match `workspace_id`.

**Phase:** Integration phase (when scan-to-lookup is wired). Add the test before enabling the feature.

---

### Pitfall 6: Barcode normalization missed — GTIN/EAN-13/UPC-A raw-string comparisons fail

**Severity:** MAJOR.

**What goes wrong:** User registers item with UPC-A `049000028904` (12 digits, scanned from a North American product). Next time they scan it, the camera/library returns EAN-13 `0049000028904` (13 digits, because some libraries always pad to 13). Lookup says "not found," user creates a duplicate.

Reverse case: user stored a GTIN-14 (pallet label) with leading zero, scans the same product as EAN-13 → miss.

**Why it happens:** GTIN formats are a family. UPC-A (12 digits) is an EAN-13 (13 digits) with a leading `0`. ZXing by default decodes these as distinct formats unless normalized. ITF-14 exists too (pallet packs). The `type` field from `@yudiel/react-qr-scanner`'s scan result is the barcode **symbology** (CODE_128, EAN_13, UPC_A, QR_CODE) — not the canonical data form.

**Prevention:**
- **Canonicalize on write AND read.** Store as GTIN-14 (left-zero-padded to 14 digits) in the DB. When scanning, pad the decoded value to 14 digits before the lookup query.
  ```ts
  function toGTIN14(raw: string): string {
    return raw.replace(/\D/g, '').padStart(14, '0');
  }
  ```
- Validate check digit on normalization; reject malformed inputs with a clear message rather than storing garbage.
- For **QR codes** (used for internal item tags, not products), store the raw string — don't pad. Distinguish "product barcode" vs "QR asset tag" in the UI and in the data model.
- Add a Vitest for normalization covering: UPC-A → GTIN-14, EAN-13 → GTIN-14, idempotency (GTIN-14 → GTIN-14), empty/invalid.

**Detection:** User reports "I scan the same item twice and get different results." DB query: same item created twice with different `barcode` lengths.

**Phase:** Integration phase (the lookup hook). Canonicalization logic lives in a shared util used by both the lookup and the create-item form.

---

### Pitfall 7: TanStack Query cache returns stale "not found" after scan→create→rescan

**Severity:** MAJOR (UX bug, triggers duplicates).

**What goes wrong:** Flow:
1. User scans `5449000000996` → `useQuery(['itemByBarcode', '5449000000996'])` fetches, gets 404, caches null.
2. UI shows "not found → create?" User creates item.
3. User navigates back to scanner, scans again → TanStack returns the cached null from step 1. UI shows "not found" again. User creates a second duplicate.

**Why it happens:** `invalidateQueries` wasn't called after the create mutation, OR was called with the wrong key (e.g., `['items']` but not `['itemByBarcode']`).

**Prevention:**
- The create-item mutation invalidates BOTH keys on success:
  ```ts
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
    queryClient.invalidateQueries({ queryKey: ['itemByBarcode'] }); // all barcodes, not just this one
  }
  ```
- OR: store `staleTime: 0` on `itemByBarcode` queries (they're user-driven, not chatty — refetch cost is negligible).
- OR: explicit refetch on every scan: `queryClient.refetchQueries({ queryKey: ['itemByBarcode', code] })` before consuming.
- Prefer the invalidation approach — it's the idiomatic TanStack pattern and centralizes the concern in the mutation hook (`useCreateItem`), not in every consumer.
- Build this in a hook: `useBarcodeItemLookup(code)` that wraps the query and exposes a `refetch()` method the scanner calls on every new scan event.

**Detection:** Create-then-rescan E2E test: after create, second scan must show the matched item with "VIEW" action, not "CREATE."

**Phase:** Integration phase (scan → loan / scan → quick capture wiring).

---

### Pitfall 8: Quick Capture barcode autofill clobbering user-typed SKU

**Severity:** MAJOR (data loss).

**What goes wrong:** User types an SKU manually in Quick Capture (e.g., `SHELF-42-A3` for their own labeling), opens scanner to scan a product barcode "just to link it," and the scanner's `onScan` handler overwrites the typed SKU instead of populating a separate `barcode` field.

**Why it happens:** QC-generated SKUs (`QC-{timestamp}-{random}`, per v1.9) live in the `sku` field. Barcodes live in `barcode`. If a scan integration wires `onScan(code) => form.setValue('sku', code)` because "that's how v1.3 did it before barcode field existed," the user's manual entry is lost.

**Prevention:**
- **Barcode and SKU are distinct fields**. Scan autofill ONLY writes to `barcode`. Never `sku`.
- If the user wants to use the scanned code as their SKU, they copy-paste — explicit, not magic.
- The Quick Capture autofill ONLY runs when `barcode` field is empty (`if (form.getValues('barcode')) return;`) — or prompts "Replace existing barcode?" if non-empty.
- Add a Vitest: type SKU, scan code, assert SKU unchanged and barcode populated.

**Detection:** User complaint + DB audit of QC items with non-QC-prefix SKUs that equal a barcode.

**Phase:** Integration phase (Quick Capture wiring).

---

### Pitfall 9: Retroactive VERIFICATION.md backfill that's actually fiction

**Severity:** BLOCKER for the stabilization milestone's integrity.

**What goes wrong:** The v2.2 goal includes *"VERIFICATION.md backfill for v2.1 phases 58/59/60"* and *"Nyquist retroactive validation for v1.9 phases 43–47"*. The natural shortcut: open each phase's SUMMARY, read what the phase claimed to do, write a plausible VERIFICATION.md saying it works. No tests run, no UAT, no /demo visit. Result: the archive looks clean but contains false evidence — worse than acknowledged gaps, because it **lies**.

The v2.1 audit already documented this risk transparently: *"three phases (58, 60, parts of others) skipped the formal VERIFICATION.md / UAT step but were transitively validated when downstream phases (61, 62, 63) exercised them in their own UATs."* That's honest. Writing retrofitted VERIFICATION.md without running anything would be dishonest.

**Why it happens:** Time pressure + "this is just paperwork" mental framing. Also: the phase is already shipped and users haven't complained, so "re-verifying" feels redundant to the person doing the backfill.

**Prevention (process):**
- **Every retroactive VERIFICATION.md MUST cite concrete evidence**: commit SHAs, test files that exercise the requirement, UAT.md sections from downstream phases that transitively exercise it, live MCP-browser checks on a running dev instance.
- Template for the backfill: per requirement, cite (a) the implementing commit/file, (b) the test covering it, (c) the downstream exercise that runs it end-to-end. If any cell is empty, the backfill is not valid — run the missing check.
- The 8 unsigned `/demo` checkpoints for Phase 57 retro primitives: **visit /demo**, click through, capture screenshots. Signing without visiting is disqualifying.
- Nyquist validation: run `/gsd:validate-phase 43-47` as the PROJECT.md tech debt note instructs. Don't hand-edit the VALIDATION.md to claim compliance.
- Pair with another developer (or Claude Code subagent) on the backfill — two pairs of eyes make "let me just mark this done" harder.

**Detection:**
- Grep the backfilled VERIFICATION.md files for "transitively verified" without accompanying evidence pointer.
- If a backfilled VERIFICATION.md doesn't reference a commit SHA, a test file path, or a UAT.md section, it's speculative.
- PR author asserts "I ran it" without logs or screenshots.

**Phase:** Stabilization phase. This is THE pitfall for this milestone — everything else is a subset.

---

### Pitfall 10: Backend coverage gaming — adding line-coverage tests that don't exercise real logic

**Severity:** MAJOR (coverage inflates, bugs still ship).

**What goes wrong:** Target: `pendingchange` handler.go `57.3% → ≥80%`. Easy but wrong approach: write a test that calls every handler with a happy-path payload, asserts 200, doesn't check the DB state, doesn't exercise error branches. Coverage jumps to 85% while the actual logic (conflict resolution, validation, dependency ordering) is as buggy as before.

Same shape for `jobs` 20.1% → "actionable baseline." Mocking the scheduler so tests don't crash isn't the same as testing the scheduled work.

**Why it happens:** Coverage is a lagging metric. A bad test that touches a line still counts. The CI badge goes up. The stabilization phase "closes the debt item" on paper. Real behavior doesn't change.

**Prevention:**
- **Coverage is a floor, not a target.** Pair every coverage goal with a **requirement goal**: for `pendingchange`, list the REQ-IDs or behavior-level claims the tests must exercise (conflict resolution, dependency ordering, rollback on failure, auth guard, workspace scoping). Per-REQ traceability in test names.
- Test names describe the **behavior**, not the method (`TestConflictResolutionChoosesLocalWinsOnCriticalField`, not `TestHandleConflict`).
- Every new backend unit test asserts on either (a) response body content, (b) database state post-call, or (c) an emitted event/log. Just asserting `status == 200` is disqualifying.
- Review: look at the test **diff**, not just the coverage report. If the new tests are all `assert.NoError(err)` with no state inspection, reject.
- For `jobs` ProcessTask: use the interface-extraction pattern already documented in PROJECT.md Key Decisions (`WorkspaceBackupQueries, ServiceInterface enable mocking`). The existing factories (orphaned tech debt from v1.4) are the mocking substrate — adopt them.

**Detection:** Coverage goes up but the list of behaviors tested doesn't grow. PR description says "increased coverage from X to Y" without naming specific bugs/behaviors protected.

**Phase:** Stabilization phase.

---

### Pitfall 11: Nyquist validation backfill without phase context

**Severity:** MAJOR (meaningless evidence).

**What goes wrong:** Nyquist compliance checks whether a phase's implementation satisfies its requirements, at the point in time when the phase was active. Running `/gsd:validate-phase 43-47` **today** against phases that shipped in March 2026 can silently pass because the code has evolved further — the current main branch may implement requirements those phases didn't have, or may have moved files such that the validation hits a different codepath.

PROJECT.md's v1.9 Tech Debt note says: *"Nyquist compliance PARTIAL for all v1.9 phases — run /gsd:validate-phase 43-47 retroactively"*. But a retroactive run without the original context validates the current state against the v1.9 phase requirements, not the v1.9 implementation.

**Why it happens:** Tooling convenience. The command exists; people run it; the output says "compliant"; everyone moves on.

**Prevention:**
- Before running, read each v1.9 phase's SUMMARY.md + plan to understand what that phase actually implemented. Cite the commit range the phase lived in.
- For each REQ-ID the phase claimed, verify in the **current** codebase that the implementation remains (files haven't been deleted/renamed). If renamed, update the REQ traceability before validating.
- If the validation passes, record it alongside the commit SHA of the current state. Future auditors can then say "Nyquist was re-verified against commit X for phase 43-47's original requirements."
- If a file has moved (e.g., QuickCapturePage moved to `/frontend2` eventually), the validation is against `/frontend` — the legacy path — not `/frontend2`. Don't cross-validate.

**Detection:** Validation output names code paths that don't exist at the original phase's timestamp. Test runs pass but don't reference phase-specific behaviors.

**Phase:** Stabilization phase.

---

## Moderate Pitfalls

### Pitfall 12: Barcode library bundle size bomb

**Severity:** MAJOR (perf budget violation, particularly bad on mobile).

**What goes wrong:** `@yudiel/react-qr-scanner` uses ZXing-WASM under the hood. The full ZXing-WASM binary is ~1.37 MiB uncompressed (~500-700 KiB gzipped). Added to the existing `/frontend2` bundle, this could push first-load past a noticeable threshold for mobile users on 4G/3G.

**Prevention:**
- **Route-split the scanner page.** React Router v7 supports lazy routes. `/scan` loads its own chunk that includes the scanner library. The main app bundle stays lean.
  ```ts
  const ScanPage = lazy(() => import('./pages/ScanPage'));
  // in route config:
  { path: '/scan', element: <Suspense fallback={<Loader />}><ScanPage /></Suspense> }
  ```
- Prefer ZXing-WASM **reader-only** build (~966 KiB uncompressed) if the library exposes it. Confirm at lib-config time.
- Configure scanned formats explicitly (QR, EAN-13, UPC-A, Code128 per PROJECT.md). Don't enable all formats — some libraries tree-shake format handlers when you declare the set.
- Measure: add a bundle-size CI check (`size-limit` or `bundlewatch`) with a budget. Fail PR if main bundle grows >50 KiB unexpectedly.

**Detection:** Lighthouse mobile score drops. Network tab shows 1+ MB downloads on `/scan` route. `vite build --report` shows ZXing in the main chunk instead of a lazy one.

**Phase:** Scanning foundation phase.

---

### Pitfall 13: Scan rate vs CPU — continuous decoding drains mobile batteries

**Severity:** MAJOR.

**What goes wrong:** Default continuous-decode loop runs 30+ frames/sec through a WASM decoder. On an iPhone 11 this is ~15% CPU sustained, phone warms noticeably in 60 seconds. Users keep the scanner open for minutes while walking the warehouse.

**Why it happens:** Libraries default to "scan as fast as possible" because that feels responsive. The actual human-scan rate is 1-3 scans per minute.

**Prevention:**
- **Throttle decode to 5-10 fps**, not 30. Most libraries expose a `scanDelay` prop — set it to 150-200 ms.
- After a successful scan, **pause** the decode loop until the user dismisses the result overlay. Don't re-decode the same barcode 60 times/sec while the "Item Found" card is on screen.
- When the scanner viewfinder is scrolled off-screen, idle, or the tab is backgrounded (`visibilitychange`), stop the decode loop entirely. Keep the stream if you plan to resume; release it if the user is likely gone (e.g., >30s background).
- Add a max-session guard: warn + auto-exit after N minutes continuous scanning.

**Detection:** `performance.now()` wrappers around decode calls show >30/sec invocations. Thermal state on iOS via battery API (where available) ramps.

**Phase:** Scanning foundation phase.

---

### Pitfall 14: Memory leaks from uncanceled decode loops

**Severity:** MAJOR.

**What goes wrong:** Decode loop uses `requestAnimationFrame` or `setInterval`. Component unmounts but the loop references a closed-over `videoRef` that's still alive (because the loop is alive and holds the ref). Memory leaks every scan session. After a few hundred scans, tab slows to a crawl or crashes on iOS (which is aggressive about killing high-memory tabs).

**Prevention:**
- Every decode loop is cancellable:
  ```ts
  const rafId = useRef<number>();
  useEffect(() => {
    const tick = () => { /* decode */; rafId.current = requestAnimationFrame(tick); };
    rafId.current = requestAnimationFrame(tick);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);
  ```
- For `setInterval`, pair with `clearInterval` in cleanup.
- Profile memory in Chrome DevTools: scan 50 barcodes, take a heap snapshot, check for retained `MediaStream` / `HTMLVideoElement`.
- If using `@yudiel/react-qr-scanner`, trust but verify — add a Playwright test that mounts/unmounts the scanner 20× and checks for leaks via `window.performance.memory` (Chrome only).

**Detection:** Heap snapshot retaining multiple MediaStream instances. Tab crashes after extended use on iPhone SE / low-RAM device.

**Phase:** Scanning foundation phase.

---

### Pitfall 15: `facingMode: 'environment'` silently fails to rear-camera

**Severity:** MAJOR (wrong camera used).

**What goes wrong:** `getUserMedia({ video: { facingMode: 'environment' } })` is a **hint**, not a constraint. On some laptops/tablets without a rear camera, it silently returns the front camera. User scans themselves, confused. Same on some Android devices where camera-labeling is off (private-mode, unlabeled).

**Prevention:**
- Use `{ facingMode: { ideal: 'environment' } }` explicitly. Still a hint, but more reliable.
- After `getUserMedia`, call `track.getSettings()` — log the resulting `facingMode`. If it's 'user' and we wanted 'environment', show a device-picker UI (`enumerateDevices()`) so the user can select the right camera.
- For desktop dev without a rear camera, that's fine — dev uses front camera. But the picker must work for users on dual-camera tablets.

**Detection:** Scanner viewfinder shows the user's face on mobile. `track.getSettings().facingMode !== 'environment'`.

**Phase:** Scanning foundation phase.

---

### Pitfall 16: Torch capability unreliable on iOS Safari

**Severity:** MODERATE (graceful degradation needed).

**What goes wrong:** `track.getCapabilities().torch` works on Chrome Android but is **absent** (undefined) on iOS Safari and on desktop Chromium without a flashlight. Naive code shows a torch button on every scanner page, tapping it on iOS does nothing, user wonders if it's broken.

**Why it happens:** Image Capture API + `MediaTrackConstraints.torch` is non-standard and unevenly implemented. WebKit hasn't shipped it.

**Prevention:**
- Feature-detect before rendering the torch button:
  ```ts
  const caps = track.getCapabilities?.();
  const hasTorch = caps && 'torch' in caps && caps.torch === true;
  ```
- Only show the button if `hasTorch`. On iOS, don't show it at all.
- When torch is on and user navigates away or re-inits the camera, torch state is lost (the new track starts with torch off). Re-apply on re-init if the user had it on.
- Never show "Torch: ON" if `applyConstraints({ advanced: [{ torch: true }] })` rejected.

**Detection:** iOS users report torch button doesn't work. Torch state in UI disagrees with hardware.

**Phase:** Scanning foundation phase.

---

### Pitfall 17: Autofocus vs continuous focus — some libraries get this wrong

**Severity:** MODERATE.

**What goes wrong:** For barcode scanning the camera needs **continuous** autofocus (refocuses as distance changes). Some libraries default to single-shot or don't request continuous, so the scanner blurs when the user tilts the phone.

**Prevention:**
- Request continuous focus in the constraints:
  ```ts
  { video: { facingMode: { ideal: 'environment' }, focusMode: 'continuous' } }
  ```
  `focusMode` is advanced — check `track.getCapabilities().focusMode` first. If absent, the device's default usually covers it (most phones default to continuous for video streams).
- Test by physically moving the phone between 10cm and 40cm from a barcode — the stream should refocus within ~500ms.

**Detection:** Barcode detection works at some distances but not others — a focus issue, not a decode issue.

**Phase:** Scanning foundation phase (test matrix).

---

### Pitfall 18: iOS Safari silent-fallback trap on `navigator.vibrate`

**Severity:** MODERATE.

**What goes wrong:** iOS Safari does NOT implement `navigator.vibrate` (WebKit has long refused — see [webkit bug 240316]). Naive code `navigator.vibrate(50)` just returns `false` silently, user gets no haptic. v1.3 solved this with the `ios-haptics` library for iOS 17.4+; v2.2 must do the same.

**Prevention:**
- Port the `ios-haptics` wrapper (or equivalent) from `/frontend` to `/frontend2`. PROJECT.md Key Decisions row already commits to this.
- The wrapper's shape: `haptic('success' | 'warning' | 'selection')` — dispatches to `navigator.vibrate` on Android, to `AudioContext`-based HIG haptics on iOS 17.4+, no-op elsewhere.
- Don't check `'vibrate' in navigator` as the gate — it exists in Safari's `navigator` (for feature-detection politeness) but does nothing. Use `ios-haptics` detection instead.

**Detection:** iOS users report no haptic feedback on scan success. `/frontend` works, `/frontend2` doesn't — you forgot to port the wrapper.

**Phase:** Scanning foundation phase (beep+haptic feedback hook).

---

### Pitfall 19: AudioContext blocked until user gesture → silent first-scan beep

**Severity:** MODERATE.

**What goes wrong:** Mobile Safari (and Chrome Android) blocks `AudioContext` from producing sound until it's been `resume()`'d inside a user-gesture handler. If the scanner creates its `AudioContext` lazily on first-scan-success, the context is in `'suspended'` state and the beep is silent. User thinks scanner failed.

`@yudiel/react-qr-scanner` README explicitly notes: *"Beep sound on iOS Safari requires user interaction before playing. The first scan after page load may not play sound."*

**Prevention:**
- Resume AudioContext on the **user gesture that opens the scanner** (FAB tap, or explicit "Start Scanning" button on the scan route), NOT on first scan success.
  ```ts
  const handleOpenScanner = () => {
    audioContextRef.current = audioContextRef.current ?? new AudioContext();
    audioContextRef.current.resume(); // inside the tap handler
    navigate('/scan');
  };
  ```
- v1.3 solved this; port the pattern. PROJECT.md references `AudioContext` in the tech stack — the hook exists in `/frontend`.
- Test on a fresh page load (not a hot-reload), on an iPhone, with headphones plugged in (reveals volume-zero false-positives).

**Detection:** First scan beep silent, subsequent scans work. Autoplay policy warnings in console.

**Phase:** Scanning foundation + FAB phase (the FAB tap is the user gesture that can resume the context).

---

### Pitfall 20: Feedback spam on continuous scans — no debouncing

**Severity:** MODERATE.

**What goes wrong:** Same barcode in frame for 2 seconds → decode fires 30×/sec → 60 beeps/vibrations/toasts in 2 seconds. Unbearable.

**Prevention:**
- Debounce scan-success events by barcode value: same value within 2 seconds = ignored.
  ```ts
  const lastScan = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  function onScan(code: string) {
    const now = Date.now();
    if (code === lastScan.current.code && now - lastScan.current.ts < 2000) return;
    lastScan.current = { code, ts: now };
    // ...emit success
  }
  ```
- After success, transition the state machine to `matched` or `not-found` — the viewfinder pauses or dims, decoding halts until user dismisses. This also fixes Pitfall 13 (CPU drain).

**Detection:** Rapid-fire beeps during hold.

**Phase:** Scanning foundation phase.

---

### Pitfall 21: False-positive scans — tiny QR codes in backgrounds

**Severity:** MODERATE.

**What goes wrong:** Warehouse backgrounds can contain tiny QR codes on equipment, wrist-worn tags, or packaging — the scanner picks up the wrong one while user tries to scan the intended barcode. Also: shelf stripes / text patterns occasionally register as false Code128 hits (Code128 is visually lenient).

**Prevention:**
- **Crop the decode ROI to a centered bounding box** (~60% of viewport width, centered). Only pixels inside the viewfinder overlay are decoded. Library-dependent: `@yudiel/react-qr-scanner` exposes a `scanDelay` and some variants a `constraints.video` crop; ZXing directly supports decode ROI.
- If the library doesn't expose ROI, use a `<canvas>` to copy only the ROI region per frame and hand it to the decoder.
- Show the viewfinder overlay (bright rectangle + corner brackets) so users know where to aim. This is the retro aesthetic opportunity — ASCII-box corners.
- For Code128 specifically: require at least 2 consecutive identical reads before accepting. False positives rarely repeat.

**Detection:** Scanner reports barcodes the user didn't aim at. User reports "random scans" in history.

**Phase:** Scanning foundation phase.

---

### Pitfall 22: FAB over critical UI (pagination, bottom nav)

**Severity:** MODERATE.

**What goes wrong:** FAB at `bottom-right: 16px` covers the last table row, the "NEXT PAGE" button, or (on mobile) tabbar/bottom-safe-area content. Users scroll, hit the FAB by accident, lose their place.

**Prevention:**
- Define a **FAB-aware layout contract**: any page that renders a FAB adds `pb-24` (or equivalent) to its scroll container, so the last content is reachable above the FAB.
- Pagination controls — don't pin to the bottom. Keep them inline at the end of the list.
- Bottom nav (if any) — FAB positions above it, not over it.
- For critical actions (e.g., a save button), DON'T rely on the FAB; use an inline CTA.

**Detection:** Users complain they can't reach the last item / can't hit "save".

**Phase:** FAB phase. Add a visual regression test for list-page layouts with FAB.

---

### Pitfall 23: Radial menu opens off-screen on small viewports

**Severity:** MODERATE.

**What goes wrong:** FAB at `bottom-right`. Radial menu opens in an arc that extends up-and-left. On a 320-wide iPhone SE, some of the menu items hit `x < 0` and are clipped by the viewport. User can't tap them.

**Prevention:**
- Calculate menu positions client-side with viewport-bound clamping. If an arc position would go off-screen, flip to the other side of the FAB.
- Or: for <360px viewports, switch to a vertical stack instead of a radial arc.
- Test at 320×568 (iPhone SE 1st gen), 390×844 (iPhone 14), 414×896 (iPhone 14 Plus). All menu items visible and tappable.

**Detection:** UAT on small devices. Visual regression tests pinned at the narrowest target width.

**Phase:** FAB phase.

---

### Pitfall 24: Accidental FAB taps during scroll

**Severity:** MODERATE.

**What goes wrong:** User scrolls the items list. Thumb drags over the FAB. Touch-end registers as a tap. FAB opens unexpectedly.

**Prevention:**
- Scroll-vs-tap detection: if `touchmove` delta exceeds ~25 px between `touchstart` and `touchend`, don't fire the tap. v1.3 already has this in the `FloatingActionButton` — `25px cancel on movement` is in PROJECT.md's v1.3 requirements list. Port the pattern exactly.
- Hit-area is the FAB's 56×56 px circle only; no invisible padding.
- Settle duration: 150ms between `touchend` and treating next tap as a tap (debounce post-scroll).

**Detection:** Analytics: accidental-open rate (FAB open → immediately closed within 500ms) above 5%.

**Phase:** FAB phase.

---

### Pitfall 25: iOS safe-area-inset ignored — FAB under home indicator

**Severity:** MODERATE.

**What goes wrong:** FAB at `bottom: 16px` gets partially covered by iPhone X+ home indicator, or by the Dynamic Island if positioned at top. Touch works (the indicator is translucent) but hit detection is awkward.

**Prevention:**
- Use `env(safe-area-inset-bottom)` for positioning:
  ```css
  .fab { bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
  ```
- Meta viewport tag must include `viewport-fit=cover` for `env(safe-area-inset-*)` to be non-zero on iOS.
- Test on real iPhone with home indicator visible (not just simulator).

**Detection:** Screenshots on iPhone 14 show FAB overlapping home indicator.

**Phase:** FAB phase.

---

### Pitfall 26: Focus trap missing on radial menu → keyboard users stuck

**Severity:** MODERATE (a11y blocker for some users).

**What goes wrong:** Keyboard user Tab-navigates to FAB, presses Enter, radial menu opens. Tab continues to other page elements instead of cycling through menu items. Or: Escape doesn't close the menu. Or: menu items receive focus visually but Enter does nothing.

**Prevention:**
- Radial menu is a focus-trapping popover. Tab cycles among menu items. Shift-Tab cycles backwards. Escape closes.
- Use a headless library (Radix `@radix-ui/react-popover` or `react-aria`) for focus management if RetroDialog primitive doesn't already handle this.
- `aria-haspopup="menu"` on FAB, `role="menu"` on the radial container, `role="menuitem"` on each action.

**Detection:** Axe/jest-axe assertions. Manual keyboard-only testing.

**Phase:** FAB phase.

---

## Minor Pitfalls

### Pitfall 27: Scan history localStorage quota on long sessions

Last-10-scans in localStorage is fine. If someone changes it to "last 1000" or stores images, quota fills and the history silently fails to save. **Prevention:** Cap at 10 entries, clamp on write; catch `QuotaExceededError`. Matches v1.3 spec.

### Pitfall 28: Manual barcode entry fallback skipped for "accessibility"

Manual entry is required for warehouse workers whose phone camera is broken or dim. Don't skip it because "everyone has a camera." Validate input against the same canonicalization util as scans (Pitfall 6). **Phase:** Scanning foundation.

### Pitfall 29: Scan history privacy — previous user's scans visible after logout

Last-10 in localStorage survives logout by default. Next user on the same device sees the prior user's scans. **Prevention:** Clear scan history on logout. Scope the localStorage key by user ID. **Phase:** Integration phase.

### Pitfall 30: `RetroDialog` used for the scan-result action menu → double-overlay bugs

Action menu (VIEW/LOAN/MOVE/REPAIR) is tempting to render as a `RetroDialog`. But if the scanner then opens a "create item" overlay, you have two modals stacked. **Prevention:** Use a single overlay component (e.g., a bottom-sheet pattern) and swap its content with a state machine. **Phase:** Scanning foundation.

### Pitfall 31: Translations for scanner missing in et.json / ru.json

v1.3 audit explicitly flagged this (later corrected). v2.2 must add every new key to all three catalogs. Run `lingui extract`; diff; fail CI on English-only keys. **Phase:** All phases (already a cross-cutting rule from v2.1 PITFALLS).

### Pitfall 32: Scanner route accessible without auth

Unauth users hitting `/scan` get a camera permission prompt from a page that then shows "please log in." Bad UX. **Prevention:** Route guard — require auth before camera init, not after. **Phase:** Scanning foundation.

### Pitfall 33: Scan-history timestamps use raw Date formatting

Skipping `useDateFormat` / `useTimeFormat` hooks (shipped v1.6). Cross-cutting from v2.1 PITFALLS #15. **Phase:** Integration phase.

### Pitfall 34: No "retry decoding" UX when scan fails for 10+ seconds

User stares at viewfinder, nothing detected (bad lighting, damaged barcode). No feedback. **Prevention:** After 10s of no detection, show a gentle hint: "Having trouble? Try flashlight / manual entry." Don't spam; show once. **Phase:** Scanning foundation.

### Pitfall 35: `waitForTimeout` reintroduced in new E2E tests

Stabilization phase removes 56 of these. Scan-flow E2E tests are tempted to add new ones ("wait for camera"). **Prevention:** Add a CI lint rule against `waitForTimeout`; scanner-specific waits use `await page.getByRole(...).waitFor()` or event-driven assertions. **Phase:** All phases.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Write retrofit VERIFICATION.md from SUMMARY.md without re-running tests | Closes doc gap in 30 min/phase | Archive contains unverified claims; future audits distrusted | **Never** — always cite commit/test/UAT evidence |
| Inflate backend coverage by calling handlers without asserting state | Hits 80% target | Bugs still ship; false confidence | **Never** — every new test must assert behavior, not just status |
| Skip iOS PWA testing in favor of Safari tab | Faster dev loop | Permission reset + fullscreen bugs hit users first | During rapid iteration; MUST test installed PWA before each demo |
| Use `@yudiel/react-qr-scanner` without route-splitting | Ships faster | Main bundle +500KB, mobile-cold-start regression | **Never** — lazy-load the scan route from day one |
| Run `/gsd:validate-phase 43-47` against current main without context | Command succeeds, debt closed on paper | Validates wrong code paths; regressions undetected | Only if a human confirms phase-era code hasn't been refactored |
| Hand-roll FAB focus behavior instead of using headless popover | Avoids dependency | Subtle a11y regressions; keyboard users stuck | Never — use Radix or react-aria for focus management |
| One-off scan integration per page (loan, quick capture, items) | Works for first page | Three implementations diverge, logic duplicated | **Never** — extract `useBarcodeScan` hook before the second integration |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Scan → Loan create | Passing raw barcode as itemId | Lookup barcode → get itemId → pre-fill loan form. Show "not found → create item first" if no match. |
| Scan → Quick Capture | Autofilling SKU field with barcode | Write only to `barcode` field; respect user-typed SKU (see Pitfall 8) |
| Scan → Item detail | `navigate(\`/items/\${id}\`)` mid-scan → camera released | Use action menu overlay on scan route; "VIEW" button closes scanner deliberately then navigates |
| Scanner → backend lookup | Query by raw decoded string | Canonicalize to GTIN-14 client-side (Pitfall 6); backend matches on normalized form |
| Scanner → TanStack Query | Caching scan lookups indefinitely | Invalidate `['itemByBarcode']` on create/update; optionally `staleTime: 0` for scan queries |
| Scanner → audit log | Recording every decoded frame as a scan event | Debounce; one event per user-intended scan, not per decode tick |
| Backend lookup → multi-tenant | `SELECT * FROM items WHERE barcode = $1` | `SELECT * FROM items WHERE barcode = $1 AND workspace_id = $2` — always |
| FAB → route detection | `usePathname()` static snapshot | Subscribe to route changes so FAB actions update on navigation |
| Scanner → offline | Queueing scan events via SyncManager | `/frontend2` is **online-only** per v2.1 constraint — don't import SyncManager. Manual barcode entry is the offline fallback. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-frame decode at 30fps | Hot phone, battery drain | Throttle to 5-10fps; ROI crop | >60s continuous scan on mid-range phones |
| Scanner library in main bundle | Slow first load | Route-lazy-load `/scan` | On 4G mobile; cold PWA launches |
| Scan result card renders all item photos full-size | Janky transition | Use thumbnail URLs, lazy-load | Items with 5+ photos |
| Scan lookup makes N backend calls (on every decode frame) | Server log spam, rate-limit hits | Debounce decode events before query | Fast-scroll through a shelf of barcodes |
| `useQuery` per-scan without cleanup | Memory grows unbounded per session | Single queryKey, refetch on scan | Long scan sessions (50+ items) |
| FAB re-renders on every route change due to `useFABActions` keyed poorly | Minor jank on navigation | Memoize actions by route path | Many route transitions per session |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Barcode-lookup endpoint un-scoped to workspace | **Cross-tenant data leak** (BLOCKER) | `WHERE workspace_id = session.workspace_id` — no exceptions. Integration test with two workspaces sharing a barcode. |
| Trusting client-supplied `workspace_id` in scan lookup request | Forgery → read another tenant | Always derive `workspace_id` server-side from the session |
| Scan history in localStorage persists across users on shared device | Privacy (low severity in home-warehouse context, but still) | Clear on logout; scope by user ID |
| Camera permission request with no HTTPS | Browser blocks, but some devs proxy through http://localhost and miss the prod difference | CI check: `/scan` served over HTTPS in deployed env |
| Barcodes logged verbatim with PII context | GDPR-adjacent if barcode is treated as personal data | Log barcode separately from user identifier in audit logs; consider hashing for aggregates |
| Scan-history exfiltration via prototype pollution in scan-result parser | Depends on library hardening | Pin library version; audit `@yudiel/react-qr-scanner` releases; subscribe to its security advisories |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Scan beep volume uncontrollable | Warehouse environments: too loud or too quiet | Haptic-first feedback; beep secondary; respect system volume |
| "Item not found" dead-ends the flow | User scans unknown → frustration → abandons | Offer "CREATE ITEM WITH BARCODE PREFILLED" as a primary action in the not-found card |
| FAB radial menu shows 5 actions that are 3 disabled + 2 enabled | Visual noise, looks broken | Hide disabled actions context-aware; only render applicable ones |
| Scanner opens with camera off, "TAP TO START" | Extra tap for 90% of users | Auto-start camera on route load; the FAB-tap IS the user gesture (handles audio context) |
| No visual differentiation between matched item vs create-new state | User creates duplicate because they misread | Matched: green stripe + item name; Not-found: yellow stripe + "NEW?" |
| Torch button shown on devices without torch | Taps do nothing, user thinks app broken | Feature-detect, hide button (Pitfall 16) |
| Scan-history panel takes screen real estate from viewfinder | Smaller target area, harder to aim | History is a swipe-up bottom sheet, not always-visible |
| FAB position changes between pages | Muscle memory broken | Fixed position (bottom-right) across the app; only icon/actions vary |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Scanner implementation:** Often missing proper `MediaStream` cleanup on unmount → verify with `chrome://media-internals/` after navigating away
- [ ] **Scanner implementation:** Often missing `playsInline` on `<video>` → verify in DOM inspector on iOS
- [ ] **Scanner implementation:** Often missing StrictMode double-mount defensiveness → dev-mode console shows "camera started" once only
- [ ] **Barcode lookup endpoint:** Often missing `workspace_id` filter → two-user integration test with shared barcode
- [ ] **Scan → create flow:** Often missing TanStack Query invalidation → rescan after create must show matched item
- [ ] **Barcode normalization:** Often missing on read path (normalized on write only) → same product scanned in two formats must match the same row
- [ ] **FAB component:** Often missing `env(safe-area-inset-bottom)` → iPhone X+ physical device check
- [ ] **FAB radial menu:** Often missing focus trap + Escape handler → keyboard-only walkthrough
- [ ] **Haptic feedback:** Often missing iOS path (only `navigator.vibrate` wired) → verify on iPhone 15+ with ios-haptics
- [ ] **Audio beep:** Often missing resume-on-user-gesture → first-scan-after-cold-load must beep
- [ ] **Torch button:** Often missing capability gate → doesn't appear on iOS Safari or desktop Chromium
- [ ] **Manual entry fallback:** Often missing → confirm entry field is reachable without camera
- [ ] **Translations:** Often missing et.json / ru.json for new scanner strings → `lingui compile` shows no orphaned keys
- [ ] **Route bundle:** Often missing lazy split → `vite build --report` confirms `ScanPage` is a separate chunk
- [ ] **Retroactive VERIFICATION.md (stabilization):** Often written without actually running the tests → each REQ-ID cites commit SHA + test path + UAT evidence
- [ ] **Nyquist retroactive validation (stabilization):** Often run against current main without phase context → VALIDATION.md records the commit SHA it validated against, matched against the phase's original implementation files
- [ ] **Backend coverage increase (stabilization):** Often achieved via shallow tests → every new test asserts state, not status; test names describe behaviors not method names
- [ ] **/demo checkpoint signoffs (stabilization):** Often signed without visiting → screenshot + timestamp per checkpoint

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-tenant barcode-lookup leak (#5) | HIGH (hotfix + audit logs review) | 1) Add `workspace_id` filter; 2) Deploy patch; 3) Audit query logs for cross-tenant hits in the affected window; 4) Notify affected tenants if breach occurred |
| Camera stream leak (#2) | LOW | Add ref-array cleanup; redeploy. Users reopen app to reset |
| Stale TanStack cache duplicates (#7) | MEDIUM | Add invalidation; deduplicate existing duplicates via a backend script matching `(workspace_id, barcode, created_within_60s)` |
| Retrofit fiction VERIFICATION.md (#9) | HIGH | Delete the speculative files; re-run `/gsd-verify-work` properly with evidence; audit credibility of any milestone that used them |
| Inflated backend coverage (#10) | MEDIUM | Re-review added tests; rewrite shallow ones with behavioral assertions; communicate to team that the metric was gamed |
| Barcode normalization mismatch causing duplicates (#6) | MEDIUM | Run a migration: canonicalize all existing `barcode` fields to GTIN-14; deduplicate; add DB-level unique constraint on `(workspace_id, canonical_barcode)` |
| iOS PWA permission loop (#1) | LOW | Refactor scan page to single-route overlay pattern; users reinstall PWA (clears permission state) |
| Scanner double-mount in StrictMode (#4) | LOW | Ref-array pattern; test in dev mode |

---

## Pitfall-to-Phase Mapping

How the roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 Camera permission reset on navigation | Scanning foundation | Two-consecutive-scans E2E test on iOS PWA; no re-prompt |
| #2 MediaStream leak | Scanning foundation | `chrome://media-internals/` post-navigation; Playwright memory test |
| #3 Missing `playsInline` | Scanning foundation | DOM snapshot test asserting attribute; manual iOS check |
| #4 StrictMode double-mount | Scanning foundation | Dev-mode single-camera-init assertion |
| #5 Workspace-scoping on lookup | Integration phase | Two-workspace integration test with shared barcode |
| #6 Barcode normalization | Integration phase | Unit tests for UPC-A/EAN-13/GTIN-14 round-trips |
| #7 TanStack cache after create | Integration phase | Scan-create-rescan E2E test |
| #8 Quick Capture SKU clobber | Integration phase | Vitest: manual SKU + scan → barcode-only updated |
| #9 Retrofit VERIFICATION.md fiction | Stabilization phase | Every backfilled VERIFICATION.md cites commit/test/UAT evidence; peer review |
| #10 Coverage gaming | Stabilization phase | PR review: test diffs show behavioral assertions, not status-only |
| #11 Nyquist without context | Stabilization phase | VALIDATION.md records commit SHA validated against phase-era files |
| #12 Bundle size bomb | Scanning foundation | `size-limit` CI check; `/scan` is a separate chunk |
| #13 Decode rate / CPU drain | Scanning foundation | Throttled `scanDelay`; pause on match |
| #14 Uncanceled decode loops | Scanning foundation | Heap snapshot after 50 scans |
| #15 Wrong camera (facingMode hint) | Scanning foundation | `track.getSettings().facingMode` logged; picker fallback |
| #16 Torch capability detection | Scanning foundation | Feature-detect gate; no button on iOS |
| #17 Autofocus continuous | Scanning foundation | Physical device distance test |
| #18 `navigator.vibrate` iOS silent | Scanning foundation (haptic hook port) | Haptic works on iPhone 15; `ios-haptics` wired |
| #19 AudioContext suspended | Scanning foundation + FAB | First-scan-after-cold-load beeps on iPhone |
| #20 Feedback spam | Scanning foundation | Debounce by (code, 2s); paused viewfinder on match |
| #21 False positives / ROI | Scanning foundation | Bounding-box crop; 2-read confirmation on Code128 |
| #22 FAB over pagination | FAB phase | Pages with FAB apply `pb-24` contract |
| #23 Radial menu off-screen | FAB phase | Viewport-clamping at 320px |
| #24 Scroll vs tap | FAB phase | 25px threshold (ported from v1.3) |
| #25 Safe-area-inset | FAB phase | `env(safe-area-inset-bottom)` in CSS; iPhone physical test |
| #26 Focus trap | FAB phase | Axe-accessible + keyboard-only walkthrough |
| #27 Scan history quota | Integration phase | Cap at 10; quota-exceeded handled |
| #28 Manual entry fallback | Scanning foundation | Present + validated like scans |
| #29 Scan history privacy | Integration phase | Cleared on logout; user-scoped key |
| #30 Dialog double-overlay | Scanning foundation | Single bottom-sheet, state-machine content |
| #31 i18n catalog drift | All phases | `lingui extract` CI check; et+ru complete |
| #32 Scanner unauth | Scanning foundation | Route guard; camera init after auth |
| #33 Raw date formatting | Integration phase | Grep: no `toLocaleDateString` in new code |
| #34 No fail-mode UX | Scanning foundation | 10s-no-detection hint |
| #35 `waitForTimeout` regression | All phases / stabilization | CI lint rule |

---

## Sources

- PROJECT.md v2.2 active goal, v1.3 Mobile UX Overhaul shipped requirements, v1.9 Quick Capture decisions + tech debt, v2.1 v2.1 shipped decisions + tech debt — HIGH (project ground truth)
- `.planning/milestones/v1.3-MILESTONE-AUDIT.md` — v1.3 scanner tech debt items (scanner not in sidebar, move action stub) — HIGH
- `.planning/milestones/v2.1-MILESTONE-AUDIT.md` — missing VERIFICATION.md phases 58/59/60, unsigned /demo for Phase 57, Nyquist partial status — HIGH (direct evidence of the retroactive-documentation trap risk)
- `.planning/research/PITFALLS.md` prior v2.1 document — cross-referenced pitfalls #14 (i18n), #15 (format hooks), #20 (16px font), #22 (capture attr), #23 (EXIF) — HIGH (project continuity)
- [MDN: MediaStreamTrack.stop() and getTracks()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop) — HIGH
- [MDN: MediaStreamTrack.getCapabilities()](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities) — HIGH
- [MDN: Web Audio API best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — HIGH (AudioContext user-gesture requirement)
- [MDN: Navigator.vibrate() compat](https://caniuse.com/mdn-api_navigator_vibrate) — HIGH (iOS Safari unsupported)
- [WebKit bug 215884: getUserMedia recurring permissions prompts in standalone when hash changes](https://bugs.webkit.org/show_bug.cgi?id=215884) — HIGH (Pitfall #1 root cause)
- [WebKit bug 185448: getUserMedia not working in apps added to home screen](https://bugs.webkit.org/show_bug.cgi?id=185448) — HIGH (iOS PWA camera quirk)
- [html5-qrcode issue #641: Two cameras appear on reload](https://github.com/mebjas/html5-qrcode/issues/641) — HIGH (class of bug relevant to `@yudiel/react-qr-scanner` too)
- [yudielcurbelo/react-qr-scanner README (v2.5.1, 2026-01-19)](https://github.com/yudielcurbelo/react-qr-scanner) — HIGH (confirms iOS Safari beep requires user interaction; torch+zoom conflict on some mobile browsers)
- [GS1 GTIN normalization — Wikipedia](https://en.wikipedia.org/wiki/Global_Trade_Item_Number) — HIGH (UPC-A ↔ EAN-13 ↔ GTIN-14 canonicalization)
- [TanStack Query: Query Invalidation docs](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation) — HIGH (Pitfall #7 fix)
- [CSS env() safe-area-inset — Ben Frain](https://benfrain.com/css-environment-variables-iphonex/) — HIGH (FAB positioning)
- [Matt Montag: Unlock JavaScript Web Audio in Safari](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos) — MEDIUM (AudioContext resume patterns, verified against MDN)
- [ZXing-WASM bundle sizes (npm)](https://www.npmjs.com/package/zxing-wasm) — MEDIUM (1.37 MiB full, 966 KiB reader-only; gzipped ratios are training-data estimates, verify at implementation)

---

*Pitfalls research for: v2.2 Scanning & Stabilization*
*Researched: 2026-04-18*
