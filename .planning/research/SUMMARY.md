# Project Research Summary

**Project:** Home Warehouse System v1.3 Mobile UX Overhaul
**Domain:** Mobile inventory UX - barcode/QR scanning, fuzzy search, quick actions, progressive forms
**Researched:** 2026-01-25
**Confidence:** HIGH

## Executive Summary

v1.3 Mobile UX Overhaul transforms the existing PWA into a warehouse-grade mobile inventory tool by adding barcode/QR scanning, offline-capable fuzzy search, floating action buttons with radial menus, and mobile-optimized forms. The research reveals excellent news: all capabilities are achievable with just **4 new frontend dependencies** totaling ~45-50 KB gzipped. The existing stack (Next.js 16, React 19, shadcn/ui, Tailwind CSS 4, idb v8) provides a solid foundation that requires extension, not replacement.

The recommended approach prioritizes actively maintained libraries with proven PWA compatibility. For scanning: **@yudiel/react-qr-scanner v2.5.0** (leverages native BarcodeDetector API, 15-60KB). For search: **Fuse.js v7.1.0** (client-side fuzzy matching, 6KB). For gestures: **@use-gesture/react v10.3.1** (swipe/drag primitives, 10KB). For animations: **motion v12.27.0** (custom FAB/radial menu, 15KB). The architecture integrates cleanly with existing IndexedDB offline storage, mutation queue, and camera permission patterns from photo upload.

The critical risks center on iOS PWA quirks and performance optimization. iOS Safari does not persist camera permissions across PWA route changes, requiring single-page scan flows with persistent MediaStream references. Browser-based scanning (ZXing/html5-qrcode) has performance limitations on mobile, necessitating reduced FPS, scan region targeting, and manual entry fallbacks. Fuse.js re-indexing on every render causes severe lag without proper memoization. IndexedDB + fuzzy search hits a performance cliff above 5000 items without hybrid querying. Swipe gestures conflict with iOS Safari's native swipe-to-go-back. iOS keyboard hides fixed-position elements and may fail to appear in PWA standalone mode. All risks have clear mitigation strategies validated through authoritative sources.

## Key Findings

### Recommended Stack

**Four new frontend libraries** extend the existing stack without architectural changes. Total bundle addition: ~45-50 KB gzipped with tree-shaking.

**Core technologies to add:**
- **@yudiel/react-qr-scanner v2.5.0**: Barcode/QR scanning — Uses native BarcodeDetector API when available (15KB), falls back gracefully (60KB), supports QR + EAN/UPC/Code128, built-in torch/zoom/audio, full TypeScript support
- **fuse.js v7.1.0**: Fuzzy/typo-tolerant search — Client-side search, 6KB gzipped, zero dependencies, 21M monthly downloads, works offline with IndexedDB
- **@use-gesture/react v10.3.1**: Mobile gesture primitives — Swipe/drag/pinch hooks, pmndrs ecosystem, 10KB gzipped, composable with existing interactions
- **motion v12.27.0**: Animation framework — Custom FAB/radial menu animations, 15KB tree-shaken, de facto React animation standard (renamed from framer-motion)

**Existing stack components reused:**
- **IndexedDB (idb v8)**: Offline data source for fuzzy search, scan result lookup
- **react-hook-form v7.70.0 + zod v4.3.5**: Progressive form validation (already integrated)
- **shadcn/ui components**: FAB built with Button + motion, dialogs for scanner
- **Camera patterns from photo-upload.tsx**: getUserMedia permissions, mobile camera access

**What NOT to add:**
- html5-qrcode: In maintenance mode, @yudiel/react-qr-scanner is better maintained
- MiniSearch/FlexSearch: Overkill for < 10,000 items, Fuse.js simpler and sufficient
- react-tiny-fab: Abandoned (4 years), custom motion-based FAB more maintainable
- Material UI FAB: Conflicts with shadcn design system, excessive bundle size
- Server-side pg_trgm fuzzy search: This milestone focuses on offline mobile UX

### Expected Features

**Barcode/QR Scanning - Table stakes:**
- Camera-based scanning (QR + UPC/EAN/Code128) — users expect phone camera without hardware
- Scan feedback (visual + audio + haptic) — confirmation via beep, 10-20ms vibration, overlay
- Auto-detect mode with torch toggle — continuous scanning, flashlight for low-light warehouses
- Scan history/recent scans — last 10-20 scans with timestamps in localStorage
- Unknown code handling — "not found" with create item option rather than silent failure

**Barcode/QR Scanning - Differentiators:**
- Scan-to-action radial menu — contextual actions based on item status (loan/move/repair)
- Container content preview — scan container, instantly see what's inside
- Unknown barcode -> product lookup — offer to create item with API-populated data

**Mobile Search - Table stakes:**
- Instant search (as-you-type, < 300ms) — expected by 53% of mobile users
- Fuzzy matching/typo tolerance — mobile keyboards cause frequent typos
- Autocomplete suggestions (5-8 items) — reduce keyboard effort
- Recent searches persistence — already in GlobalSearchResults, keep pattern
- Large touch targets (44x44px minimum) — accessibility requirement

**Mobile Search - Differentiators:**
- Offline search — works without network by indexing IndexedDB
- Filter chips for mobile — tap to add location/category/status filters
- Voice search input — hands-free warehouse use via Web Speech API
- Smart suggestions — context-based (recent activity, low stock alerts)

**Quick Actions Interface - Table stakes:**
- Floating Action Button (FAB) — primary action always accessible, bottom-right, 16px margins
- Quick action menu (3-5 actions) — radial or linear expansion from FAB
- Scan/add item/log loan shortcuts — most common mobile workflows
- Haptic feedback on actions — 10-20ms confirmation taps

**Quick Actions Interface - Differentiators:**
- Scan-to-action flow — scan item then show relevant actions for that specific item
- Swipe gestures on list items — quick actions without navigation (mark found, log loan, move)
- Context-aware FAB — actions change based on current screen (Items: Add Item; Inventory: Quick Count)
- Long-press for selection mode — multi-select pattern from photo gallery extended to all lists

**Mobile Forms - Table stakes:**
- Progressive disclosure — essential fields first, advanced in expandable sections
- Appropriate keyboard types — number pad for quantities, email keyboard via inputMode
- Large touch targets (44x44px) — accessibility requirement
- Persistent labels — visible during and after input, not placeholder-only
- Inline validation feedback — errors near field, immediate response

**Mobile Forms - Differentiators:**
- Inline photo capture — take photo without leaving form
- Multi-step wizard for complex forms — Create Item: Basic -> Details -> Photos
- Auto-save drafts to IndexedDB — recover incomplete forms on navigation
- Barcode scan to populate fields — "Scan to fill" button for product data
- Voice input for text fields — microphone icon on text areas

**Defer to post-MVP:**
- Offline search (initial version) — hybrid approach with complexity
- Voice search — accent handling, fallback UX needs refinement
- Batch scan mode — complex state management for stocktaking
- Natural language search — requires NLP/LLM integration
- Swipe actions on all lists — accessibility considerations need careful design
- Multiple thumbnail sizes in scanner — single size sufficient

### Architecture Approach

The architecture extends existing patterns without introducing new infrastructure. Barcode scanning integrates with camera permission patterns from photo-upload.tsx. Fuzzy search adds a client-side layer over existing IndexedDB stores. FAB/radial menu is a custom component using shadcn Button primitives with motion animations. Progressive forms extend react-hook-form + zod patterns with accordion/stepper components. All features follow the established offline-first approach with IndexedDB as source of truth and mutation queue for syncing.

**Major components:**

1. **Barcode Scanner Component (components/scanner/barcode-scanner.tsx)** — Dynamic import with ssr: false (camera APIs browser-only). Wraps @yudiel/react-qr-scanner with React state management. Reuses camera permission patterns from photo-upload.tsx. Handles iOS PWA permission quirks with persistent MediaStream. Fallback to file upload for image-based scanning when camera fails. Single-page scan flow to avoid iOS permission revocation on route changes.

2. **Fuzzy Search Module (lib/search/fuzzy-search.ts + offline-search.ts)** — Enhances existing use-global-search.ts with offline mode detection via useNetworkStatus. Builds Fuse.js index from IndexedDB on initial load. Updates index on sync events via SyncManager subscription. Dual-mode: online hits server API, offline uses Fuse.js. Normalizes results to same SearchResult format for UI compatibility. Memoizes Fuse instance with useMemo to avoid re-indexing on every render.

3. **FAB with Radial Menu (components/mobile/floating-action-button.tsx)** — Custom component using shadcn Button + motion animations (no pre-built FAB library). Radial menu calculates arc positions (Math.cos/sin) for item placement. @use-gesture/react for touch handling. AnimatePresence for staggered expansion. Configurable actions array with icons from lucide-react. Context-aware based on route (scanner/add/search actions vary by page).

4. **Quick Action Menu (components/scanner/quick-action-menu.tsx)** — Post-scan sheet (shadcn Sheet/Dialog) showing context-aware actions. Looks up scanned code in IndexedDB (items/containers/locations by short_code). Entity-specific action sets (Item: loan/move/repair, Container: view contents/add items, Location: view items). Unknown codes offer "Create new" flow with pre-filled short_code.

5. **Progressive Disclosure Forms (components/forms/multi-step-form.tsx, collapsible-section.tsx)** — Extends existing react-hook-form + zod patterns. Multi-step wizard with progress indicator, per-step validation, draft persistence to IndexedDB. Auto-save on every change. Smart defaults from recent selections. Inline photo capture component combining camera modal with form field. Mobile keyboard handling (inputMode, autoComplete, 16px font size to avoid iOS zoom).

**Integration with existing architecture:**

- **IndexedDB stores (offline-db.ts)**: Fuse.js searches items/inventory/locations/containers/categories/borrowers stores. Scanner lookup queries by short_code field. Form drafts persist to new formDrafts store.
- **Mutation queue**: Scan-triggered actions (create item, log loan) use existing useOfflineMutation hook for offline queueing.
- **Sync manager**: Subscribe to MUTATION_SYNCED events to refresh Fuse index after sync completes.
- **Command palette**: Reference for keyboard navigation patterns in search UI.
- **Photo upload**: Camera permission patterns reused for scanner component.
- **Global search API**: Offline fuzzy search complements server-side search, uses same SearchResult type.

**Data flow patterns:**

- **Scan flow**: User opens scanner (FAB/nav) -> Camera permission check -> html5-qrcode streams -> Barcode detected -> IndexedDB lookup by short_code -> QuickActionMenu with entity context -> User selects action -> Navigate to entity detail or form
- **Search flow**: User types query -> useGlobalSearch (debounced 300ms) -> Online? Hit server API : Offline? Fuse.js against IndexedDB -> Normalize to SearchResult[] -> Render (same UI for both)
- **FAB action flow**: User taps FAB -> Radial menu expands (motion animation) -> User selects action (scan/add/search) -> Action handler (open scanner modal, navigate to form, focus search)
- **Form auto-save**: Field changes -> Update form state -> Save to IndexedDB formDrafts -> On submit: Clear draft, queue mutation -> Optimistic update -> Sync when online

### Critical Pitfalls

1. **iOS Camera Permission Volatility (Pitfall 3-A, CRITICAL)** — iOS does not persist camera permissions across PWA route changes. Hash changes and SPA navigation can revoke permissions mid-session. Mitigation: Single-page scanning flow (keep camera component mounted, hide/show with CSS). Use persistent MediaStream reference in React context. Don't call getUserMedia() multiple times. Add fallback file upload input. Test specifically in PWA standalone mode (add to home screen), not just Safari browser.

2. **ZXing/html5-qrcode Performance on Mobile (Pitfall 3-B, CRITICAL)** — Browser-based scanning has significant performance issues, especially on iPhones. Code39 barcodes slow, damaged/blurry barcodes fail, low-light causes complete failure. ZXing in maintenance mode (security patches only). Mitigation: Lower frame rate to 5-10 FPS to reduce CPU. Implement scan region targeting (smaller analysis area = faster). Add visual feedback during scanning. Provide manual barcode entry fallback for every scan operation. Pre-load scanning library in background. Add auditory/haptic feedback on successful scan.

3. **Fuse.js Re-indexing on Every Render (Pitfall 3-F, CRITICAL)** — Creating new Fuse instance on every render causes severe lag with 1000+ items. Each keystroke rebuilds search index. Mitigation: `const fuse = useMemo(() => new Fuse(items, options), [items])` to only re-index when data changes. Debounce search input (300-500ms). Limit results to first N. React 19 compiler handles some memoization but explicitly memoize Fuse for stability.

4. **IndexedDB + Fuzzy Search Performance Cliff (Pitfall 3-G, CRITICAL)** — Loading all IndexedDB data into memory for fuzzy search works for 500 items but becomes unusable at 5000+. Mobile devices with limited RAM suffer most. Fuse.js operates on in-memory arrays, defeating offline storage benefits. Mitigation: Hybrid approach (IndexedDB indexes for initial filtering, Fuse.js on smaller result set). Paginated loading using cursors, not getAll(). Consider uFuzzy (no index needed, 5ms for 162k phrases) or FlexSearch (persistent indexes) if dataset grows. Web Worker for offloading search to keep UI responsive.

5. **iOS Safari Swipe-Back Conflicts (Pitfall 3-J, CRITICAL)** — Custom swipe gestures conflict with iOS Safari's native swipe-to-go-back. iOS Safari in standalone PWA mode handles edge swipes differently than browser mode. Swipe-to-delete triggers browser navigation. Mitigation: Avoid horizontal swipe gestures near screen edges (left 20px especially). Use vertical swipes for destructive actions or explicit buttons. Test in PWA standalone mode specifically. Consider tap-and-hold for actions instead of swipes.

6. **Gesture-Accessibility Conflicts with Screen Readers (Pitfall 3-K, CRITICAL)** — Custom gestures override screen reader gestures. VoiceOver/TalkBack users cannot navigate when app captures accessibility gestures (swipe for next, double-tap to activate, two-finger scrub). Mitigation: Always provide button alternatives for every gesture-based action. Test with VoiceOver (iOS) and TalkBack (Android) enabled. Don't capture four-finger tap, two-finger scrub, standard navigation swipes. Use aria-label to describe alternatives. For radial menu: ensure keyboard and screen reader navigation works with role="menu" and ARIA attributes.

7. **iOS Keyboard Hides Fixed-Position Elements (Pitfall 3-P, CRITICAL)** — Fixed-position elements (submit button, FAB) become hidden behind iOS keyboard or float in wrong position. iOS Safari doesn't resize Layout Viewport when keyboard appears, only Visual Viewport. After keyboard dismisses, elements remain misaligned (particularly bad on iOS 26 with persistent offset bug). Mitigation: Use Visual Viewport API to detect and adjust. Avoid position: fixed; bottom: 0 for form actions - use position: sticky or inline. Consider react-ios-keyboard-viewport hook. Use dvh (dynamic viewport height) instead of vh. Test keyboard open/close cycle specifically.

8. **iOS PWA Keyboard Fails to Appear (Pitfall 3-Q, CRITICAL)** — Tapping input fields in PWA doesn't trigger keyboard. Often intermittent, caused by multiple PWAs open simultaneously, background/foreground cycling. Once triggered, affects all PWAs until device restart. Mitigation: Add explicit inputMode attribute to all inputs. Ensure proper type attributes. Avoid programmatic focus on load. Document workaround: close all PWAs, force-quit Safari, retry. Add "keyboard not working?" help link that opens in Safari browser as fallback. This is an Apple bug with no complete prevention, only mitigation.

9. **Scanning Results Must Work Offline (Pitfall 3-D, CRITICAL - INTEGRATION)** — Barcode scanning works but lookup requires network. Users in warehouse without connectivity can scan but not act. Mitigation: Scan result lookup must query IndexedDB first (items/inventory/locations/containers stores already exist). Use same offline mutation queue for scan-triggered actions. Test scanning workflow in airplane mode. Show "item not in local cache" message if barcode not found locally (not "network error").

10. **Search Must Include Offline Mutations (Pitfall 3-I, MODERATE - INTEGRATION)** — User creates item offline (queued), searches for it, item doesn't appear. Fuzzy search only queries synced IndexedDB data, ignoring pending mutations. Mitigation: Search must merge IndexedDB results + pending creates from mutation queue. Mark pending items visually (existing pending indicator UI). Handle potential conflicts gracefully in search results.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes dependencies, integration complexity, and risk mitigation:

### Phase 1: Foundation - Fuzzy Search Infrastructure
**Rationale:** Enables offline search for scanner lookup. No UI changes, pure infrastructure. Low risk to test memoization patterns and IndexedDB querying before adding complex features on top.

**Delivers:** Client-side fuzzy search working against IndexedDB. Enhanced use-global-search.ts with offline mode detection. Fuse.js index builders per entity. Offline search across all stores.

**Addresses:** Table stakes search (instant, typo tolerance, autocomplete). Offline capability (differentiator).

**Uses:** Fuse.js v7.1.0, existing IndexedDB stores (idb v8), useNetworkStatus hook.

**Avoids:** Pitfall 3-F (re-indexing via useMemo), Pitfall 3-G (performance cliff via hybrid querying), Pitfall 3-H (debounce handler with useMemo), Pitfall 3-I (offline mutations in results).

**Research flag:** Standard patterns - no additional research needed. Monitor performance with real dataset size.

### Phase 2: Barcode Scanning
**Rationale:** Depends on Phase 1 fuzzy search for offline code lookup. Core mobile UX feature. Highest user impact. Tests iOS PWA camera challenges early.

**Delivers:** Camera-based barcode/QR scanning. Item/container/location lookup by short_code. Quick action menu with context-aware actions (scan-to-action flow). Scan history persistence.

**Addresses:** Table stakes scanning (camera, QR + UPC/EAN, feedback, torch). Differentiators (scan-to-action menu, container preview).

**Uses:** @yudiel/react-qr-scanner v2.5.0, existing camera permission patterns from photo-upload.tsx, IndexedDB lookup via Phase 1 fuzzy search.

**Implements:** BarcodeScanner component, QuickActionMenu component, ScanResultHandler logic, camera permission banner for iOS.

**Avoids:** Pitfall 3-A (iOS camera permissions via single-page flow), Pitfall 3-B (performance via reduced FPS, scan regions, manual fallback), Pitfall 3-C (HTTPS requirement in deployment docs), Pitfall 3-D (offline lookup via IndexedDB), Pitfall 3-E (Android WebView freeze via animated SVG overlay).

**Research flag:** REQUIRES BENCHMARKING - Test scanning performance on target iOS devices (iPhone 12+) and low-end Android. Validate ZXing fallback behavior in Safari. Memory usage testing with continuous scanning sessions.

### Phase 3: Mobile Navigation - FAB and Gestures
**Rationale:** Can parallel with Phase 2. Independent feature. Tests gesture library integration and iOS edge cases. Provides access points to scanner and forms.

**Delivers:** Floating Action Button with radial menu. Scan/add item/log loan shortcuts. Context-aware actions based on current route. Swipe gestures on list items (optional, start with tap-and-hold). Mobile breakpoint detection for FAB visibility.

**Addresses:** Table stakes quick actions (FAB, menu, shortcuts, haptic). Differentiators (scan-to-action integration, context-aware FAB).

**Uses:** @use-gesture/react v10.3.1, motion v12.27.0, shadcn Button components, lucide-react icons.

**Implements:** FloatingActionButton component, radial menu animation with arc positioning, gesture handlers for lists.

**Avoids:** Pitfall 3-J (iOS swipe-back via avoiding edge swipes), Pitfall 3-K (accessibility via button alternatives, VoiceOver testing), Pitfall 3-L (content obstruction via bottom padding), Pitfall 3-M (color contrast via shadow/ring), Pitfall 3-N (keyboard navigation via focus management), Pitfall 3-O (gesture conflicts via audit).

**Research flag:** REQUIRES ACCESSIBILITY TESTING - Test VoiceOver, TalkBack, keyboard navigation. Validate radial menu on various screen sizes. Test in iOS PWA standalone mode specifically.

### Phase 4: Mobile Form Improvements
**Rationale:** Builds on Phase 2 (inline barcode scan to populate fields) and Phase 3 (FAB to open forms). Extends existing react-hook-form patterns. Tests iOS keyboard challenges.

**Delivers:** Progressive disclosure forms (multi-step wizard for Create Item). Inline photo capture within forms. Auto-save drafts to IndexedDB. Smart defaults from recent selections. Mobile keyboard handling (inputMode, 16px font size). Barcode scan to populate fields.

**Addresses:** Table stakes forms (progressive disclosure, keyboard types, touch targets, persistent labels, inline validation). Differentiators (inline photo capture, multi-step wizard, auto-save drafts, scan to fill).

**Uses:** Existing react-hook-form v7.70.0 + zod v4.3.5, shadcn Accordion/Sheet, IndexedDB for draft persistence, camera from photo-upload.tsx.

**Implements:** MultiStepForm component, CollapsibleSection component, InlinePhotoCapture component, SmartPicker component (enhanced Select), form draft management.

**Avoids:** Pitfall 3-P (iOS keyboard hiding via Visual Viewport API, avoid fixed bottom), Pitfall 3-Q (iOS PWA keyboard bug via inputMode, workaround docs), Pitfall 3-R (100vh breakage via dvh units), Pitfall 3-S (input zoom via 16px font size), Pitfall 3-T (form state loss via auto-save to IndexedDB).

**Research flag:** REQUIRES IOS TESTING - Test keyboard behavior on iOS 17-18 in PWA standalone mode. Validate Visual Viewport API handling across devices. Test form auto-save recovery after backgrounding.

### Phase Ordering Rationale

- **Search first** because it's pure infrastructure with no UI risk. Establishes offline data patterns that scanner depends on. Memoization and performance patterns surface early when easier to fix.
- **Scanner second** because it's the highest-impact mobile UX feature. Depends on search for offline lookup. Tests iOS PWA camera challenges early in isolated component before adding gesture/form complexity.
- **FAB/gestures third** because they're independent and can parallel with scanner. Provides access points to scanner and forms. Tests gesture library integration and accessibility before forms add more complexity.
- **Forms last** because they build on scanner (scan to fill fields) and FAB (form access). Extends well-established react-hook-form patterns. iOS keyboard issues are isolated to this phase, not affecting earlier deliverables.

This ordering surfaces integration risks (3-D offline lookup, 3-I offline mutations in search) early in Phase 1-2 when architecture is still flexible. It defers iOS-specific challenges (keyboard, gestures, camera) to dedicated phases with clear mitigation strategies rather than tackling all iOS quirks simultaneously.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Scanning):** Benchmark scanning performance on target devices (iPhone 12+, mid-range Android). Test ZXing fallback behavior. Memory usage with continuous scanning. Camera permission persistence across iOS versions.
- **Phase 3 (FAB/Gestures):** VoiceOver/TalkBack testing for radial menu. Keyboard navigation flow. Swipe gesture testing in iOS PWA standalone mode. Screen size variations (small phones to tablets).
- **Phase 4 (Forms):** iOS keyboard behavior testing on iOS 17-18 in PWA standalone mode. Visual Viewport API handling. Form auto-save recovery after backgrounding/foregrounding cycles.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Search):** Well-documented Fuse.js patterns. IndexedDB querying already established. React memoization patterns standard.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries actively maintained (verified npm stats, GitHub activity). Versions current as of Jan 2025. Bundle size verified (45-50KB acceptable for PWA). Integration patterns validated via docs. |
| Features | HIGH | Table stakes identified from mobile inventory UX research (Algolia, Baymard, NN/g authoritative sources). Differentiators based on competitor analysis (Sortly, Encircle apps). Anti-features prevent scope creep. MVP prioritization clear. |
| Architecture | HIGH | Integration points verified via codebase analysis (photo-upload.tsx camera patterns, use-global-search.ts structure, offline-db.ts stores, mutation-queue.ts patterns). All new components follow existing conventions. No infrastructure changes needed. |
| Pitfalls | HIGH | iOS PWA issues verified via multiple sources (Apple Developer Forums, GitHub issues, STRICH KB). Performance benchmarks from authoritative sources (DEV.to, uFuzzy benchmarks, RxDB IndexedDB performance). Accessibility requirements from W3C, ACM Queue. |

**Overall confidence:** HIGH

The existing codebase provides comprehensive integration points. Stack research is definitive (verified library stats, maintenance status, React 19 compatibility). Architecture confidence is high due to direct pattern matching with existing components (scanner mirrors photo-upload.tsx, search extends use-global-search.ts, forms extend login-form.tsx). Pitfalls research is thorough with multi-source validation for critical issues (iOS PWA bugs verified via Apple Developer Forums + GitHub issues, performance benchmarks from multiple sources).

### Gaps to Address

- **Fuzzy search performance threshold:** Research recommends < 10,000 items for Fuse.js direct search, hybrid approach above that. Need to validate actual dataset size per workspace during implementation. Monitor performance in production and implement Web Worker if P95 search latency exceeds 300ms.

- **Barcode scanning library final choice:** @yudiel/react-qr-scanner recommended but needs device testing to confirm performance claims. If ZXing fallback proves too slow on target devices, may need to evaluate commercial alternatives (Scanbot SDK, Dynamsoft) or adjust UX to emphasize manual entry.

- **Swipe gesture scope:** Research recommends starting with tap-and-hold for accessibility reasons, adding swipe gestures later if user research validates benefit. Phase 3 should implement tap-and-hold first, defer swipe to post-MVP based on feedback.

- **Voice search accuracy:** Web Speech API accent handling not validated. Phase 1 should add feature flag for voice search, enable only for workspaces that opt in. Monitor accuracy reports and disable if < 80% accuracy.

- **Multiple thumbnail sizes:** Research recommends single size (400x400 matching existing) for v1.3. Scanner may benefit from smaller preview sizes. Defer to post-v1.3 based on feedback about load times.

## Sources

### Primary (HIGH confidence)
- **Existing codebase** — Direct analysis of frontend/lib/hooks/use-global-search.ts (search patterns), frontend/components/items/photo-upload.tsx (camera permissions), frontend/lib/db/offline-db.ts (IndexedDB stores), frontend/lib/sync/mutation-queue.ts (offline mutations), frontend/features/auth/components/login-form.tsx (form patterns)
- [@yudiel/react-qr-scanner v2.5.0 npm](https://www.npmjs.com/package/@yudiel/react-qr-scanner) — Updated Jan 2025, bundle size, feature list
- [Fuse.js Official](https://www.fusejs.io/) + [npm](https://www.npmjs.com/package/fuse.js) — v7.1.0, 21M monthly downloads, API docs
- [@use-gesture/react npm](https://www.npmjs.com/package/@use-gesture/react) — v10.3.1, 1.1M weekly downloads
- [Motion Official](https://motion.dev/) — v12.27.0 (renamed from framer-motion), React 19 support
- [html5-qrcode GitHub](https://github.com/mebjas/html5-qrcode) — iOS PWA camera issues (#713)
- [ZXing-js GitHub](https://github.com/zxing-js/library) — Maintenance mode status, performance issues (#544)
- [Apple Developer Forums: iOS 26 viewport bug](https://developer.apple.com/forums/thread/800125) — Critical keyboard issue
- [W3C Mobile Accessibility Challenges](https://www.w3.org/WAI/GL/mobile-a11y-tf/wiki/Mobile_Accessibility_Challenges) — Gesture conflicts
- [Material Design 3: FAB Accessibility](https://m3.material.io/components/floating-action-button/accessibility) — Best practices

### Secondary (MEDIUM confidence)
- [Scanbot Blog: Barcode scanner comparison](https://scanbot.io/blog/popular-open-source-javascript-barcode-scanners/) — Library evaluation
- [Dynamsoft Blog: Browser scanning challenges](https://www.dynamsoft.com/blog/insights/browser-barcode-scanning-challenges-best-practices/) — Performance benchmarks
- [DEV.to: Fuse.js Advanced Use Cases](https://dev.to/koushikmaratha/a-deep-dive-into-fusejs-advanced-use-cases-and-benchmarking-357p) — Optimization patterns
- [uFuzzy GitHub](https://github.com/leeoniya/uFuzzy) — Alternative with performance benchmarks (5ms for 162k phrases)
- [RxDB: Solving IndexedDB Slowness](https://rxdb.info/slow-indexeddb.html) — Performance cliff analysis
- [Dmitri Pavlutin: React Throttle Debounce](https://dmitripavlutin.com/react-throttle-debounce/) — Debounce patterns
- [Ionic Framework Issue #22299: iOS swipe back](https://github.com/ionic-team/ionic-framework/issues/22299) — PWA gesture conflicts
- [Brainhub: PWA on iOS Limitations 2025](https://brainhub.eu/library/pwa-on-ios) — iOS PWA issues
- [saricden: iOS virtual keyboard handling](https://saricden.com/how-to-make-fixed-elements-respect-the-virtual-keyboard-on-ios) — Visual Viewport API solution
- [react-ios-keyboard-viewport](https://github.com/RyoSogawa/react-ios-keyboard-viewport) — Keyboard handling hook
- [Baymard: Autocomplete Suggestions](https://baymard.com/blog/autocomplete-design) — 9 UX patterns
- [Algolia: Mobile Search UX](https://www.algolia.com/blog/ux/mobile-search-ux-best-practices) — Best practices
- [Mobbin: FAB Best Practices](https://mobbin.com/glossary/floating-action-button) — Design patterns
- [LogRocket: Swipe-to-delete interactions](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/) — Accessibility
- [Smashing Magazine: Mobile Form Design](https://www.smashingmagazine.com/2018/08/best-practices-for-mobile-form-design/) — Best practices
- [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — UX principles

### Tertiary (LOW confidence)
- [Sortly Software Reviews](https://www.softwareadvice.com/inventory-management/sortly-pro-profile/) — Feature inspiration
- [SelectHub: Best Inventory Apps 2026](https://www.selecthub.com/inventory-management/best-inventory-app-mobile/) — Competitor analysis
- [Technical Ustad: Home Inventory Apps 2026](https://technicalustad.com/home-inventory-apps/) — Feature comparison

---
*Research completed: 2026-01-25*
*Ready for roadmap: yes*
