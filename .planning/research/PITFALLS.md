# Domain Pitfalls: PWA Offline Sync

**Domain:** Progressive Web App offline sync for inventory management
**Researched:** 2026-01-24 (Updated for v1.1 Offline Entity Extension)
**Last updated:** 2026-01-25 (Added v1.3 Mobile UX Overhaul section)
**Confidence:** HIGH (verified with multiple authoritative sources)

---

## v1.3 Mobile UX Overhaul: Scanning, Search, Gestures, Forms

Pitfalls specific to adding barcode/QR scanning, fuzzy search, floating action buttons, radial menus, and mobile form improvements to the existing Home Warehouse System PWA.

---

## v1.3 Scanning Pitfalls

### Pitfall 3-A: iOS Camera Permission Volatility (CRITICAL)

**What goes wrong:** iOS does not persist camera permissions across PWA route changes. Hash changes and SPA navigation can revoke permissions mid-session, causing repeated permission prompts or complete camera failure.

**Why it happens:** Safari on iOS treats each route change as a potential new "session" and may re-request camera permissions. PWAs running in standalone mode are particularly affected. iOS 17-18 have introduced additional bugs where permissions reset unpredictably.

**Warning signs:**
- Users report camera prompts appearing multiple times in a session
- Camera feed shows black screen after navigating away and back
- Works in Safari browser but fails when added to home screen

**Prevention:**
1. Implement single-page scanning flow - keep camera component mounted, hide/show with CSS
2. Use persistent `MediaStream` across routes - don't call `getUserMedia()` multiple times
3. Store stream reference in React context or global state
4. Add fallback: file upload input for image-based scanning when camera fails
5. Test specifically in PWA standalone mode (home screen), not just Safari browser

**Phase addressing:** Phase 1 (Scanning) - Core architecture decision

**Sources:**
- [html5-qrcode Issue #713: Camera won't launch on iOS PWA](https://github.com/mebjas/html5-qrcode/issues/713)
- [Scandit FAQ: iOS permission persistence](https://support.scandit.com/hc/en-us/articles/360008443011-Why-does-iOS-keep-asking-for-camera-permissions)
- [Apple Developer Forums: PWA camera access](https://developer.apple.com/forums/thread/118527)

---

### Pitfall 3-B: ZXing/html5-qrcode Performance on Mobile (CRITICAL)

**What goes wrong:** Browser-based barcode scanning using ZXing (the underlying decoder for html5-qrcode) has significant performance issues on mobile, especially iPhones. Code39 barcodes scan slowly, damaged/blurry barcodes fail, and low-light conditions cause complete failure.

**Why it happens:**
- ZXing is in maintenance mode (security patches only, no feature updates)
- Browser JavaScript has limited CPU/GPU access compared to native apps
- No auto-focus control in many mobile browsers
- ZXing struggles with small, damaged, or poorly lit barcodes

**Warning signs:**
- Scanning takes 3+ seconds in good conditions
- Users report "scanner never finds barcode" in real-world lighting
- iPhone users have worse experience than Android users
- Code39 (common retail barcode) scans significantly slower than QR codes

**Prevention:**
1. Lower frame rate to 5-10 FPS to reduce CPU usage
2. Implement scan region targeting (smaller analysis area = faster processing)
3. Add visual feedback during scanning (scanning indicator, target overlay)
4. Provide manual barcode entry fallback for every scan operation
5. Consider WebAssembly-based alternatives (Scanbot SDK, Dynamsoft) for better performance
6. Pre-load scanning library in background before user needs it
7. Add auditory/haptic feedback on successful scan

**Phase addressing:** Phase 1 (Scanning) - Library selection and performance tuning

**Sources:**
- [ZXing-js Issue #544: iPhone scanning performance](https://github.com/zxing-js/library/issues/544)
- [Scanbot Blog: Open-source barcode scanner comparison](https://scanbot.io/blog/popular-open-source-javascript-barcode-scanners/)
- [Dynamsoft Blog: Browser barcode scanning challenges](https://www.dynamsoft.com/blog/insights/browser-barcode-scanning-challenges-best-practices/)

---

### Pitfall 3-C: HTTPS Requirement Forgotten in Development (MODERATE)

**What goes wrong:** Camera access requires HTTPS (or localhost). Developers test on localhost, deploy to HTTP staging environment, and camera silently fails.

**Why it happens:** Browser security policy requires secure context for `getUserMedia()`. The error is often unclear or silent.

**Warning signs:**
- "Works on my machine" reports from developers
- Camera works locally but not on staging/preview deployments
- Unclear browser error messages about "insecure context"

**Prevention:**
1. Use HTTPS for all environments including staging/preview (Vercel, Netlify do this by default)
2. Add explicit error handling that detects insecure context and shows user-friendly message
3. Document HTTPS requirement in deployment checklist

**Phase addressing:** Phase 1 (Scanning) - Environment setup

---

### Pitfall 3-D: Scanning Results Must Work Offline (CRITICAL - INTEGRATION)

**What goes wrong:** Barcode scanning works, but looking up scanned barcode requires network. Users in warehouse without connectivity can scan but not act on scans.

**Why it happens:** Scanning feature implemented without considering existing offline architecture. Item lookup hits API instead of IndexedDB.

**Warning signs:**
- "No network" error after successful scan
- Scan works online but fails offline
- Feature feels incomplete without network

**Prevention:**
1. Scan result lookup must query IndexedDB first (you already have items store)
2. Use same offline mutation queue for scan-triggered actions (add item, log loan)
3. Test scanning workflow in airplane mode
4. Show "item not in local cache" message if barcode not found locally (not "network error")

**Phase addressing:** Phase 1 (Scanning) - Architecture requirement

---

### Pitfall 3-E: Android WebView Camera Freeze (MINOR)

**What goes wrong:** On Android WebView (some in-app browsers), camera feed freezes and appears stuck.

**Why it happens:** Android WebView requires periodic DOM updates to maintain camera stream rendering.

**Prevention:**
- Add animated SVG overlay in camera background to keep WebView refreshing
- Not critical for PWA standalone mode, but affects users clicking links from other apps

**Phase addressing:** Phase 1 (Scanning) - Edge case handling

---

## v1.3 Search Pitfalls

### Pitfall 3-F: Fuse.js Re-indexing on Every Render (CRITICAL)

**What goes wrong:** Creating a new Fuse.js instance on every render causes severe performance degradation. With your inventory data (potentially 1000+ items), this creates noticeable lag on every keystroke.

**Why it happens:** React re-renders trigger function recreation. Without memoization, `new Fuse(data, options)` runs repeatedly, rebuilding the search index each time.

**Warning signs:**
- Typing in search feels sluggish (200ms+ response time)
- Device gets warm during search
- Profile shows excessive time in Fuse constructor

**Prevention:**
```typescript
// WRONG - re-indexes on every render
const fuse = new Fuse(items, options);

// RIGHT - only re-index when data changes
const fuse = useMemo(() => new Fuse(items, options), [items]);
```

1. Memoize Fuse instance with `useMemo`, dependency on data array
2. Debounce search input (300-500ms) to avoid searching on every keystroke
3. For React 19: The compiler handles some memoization, but explicitly memoize Fuse for third-party library stability
4. Limit search to first N results to avoid processing entire dataset

**Phase addressing:** Phase 2 (Search) - Core implementation pattern

**Sources:**
- [DEV.to: Fuse.js Advanced Use Cases and Benchmarking](https://dev.to/koushikmaratha/a-deep-dive-into-fusejs-advanced-use-cases-and-benchmarking-357p)
- [Medium: Implementing Fuzzy Search in React Native](https://medium.com/@harshitmadhav/implementing-fuzzy-search-in-react-native-apps-using-fuse-js-d33ed8710eba)

---

### Pitfall 3-G: IndexedDB + Fuzzy Search Performance Cliff (CRITICAL)

**What goes wrong:** Loading all IndexedDB data into memory for fuzzy search works fine for 500 items but becomes unusable at 5000+ items. Mobile devices with limited RAM suffer most.

**Why it happens:** Fuse.js operates on in-memory arrays. Loading entire IndexedDB store into memory for search defeats offline storage benefits and can exceed mobile memory limits.

**Warning signs:**
- Search slows dramatically as inventory grows
- App crashes or freezes on older mobile devices
- Memory usage spikes during search

**Prevention:**
1. **Hybrid approach:** Use IndexedDB indexes for initial filtering, Fuse.js for final fuzzy matching
   ```typescript
   // First: IndexedDB query to narrow down (e.g., by category, recent items)
   // Then: Fuse.js on smaller result set
   ```
2. **Paginated loading:** Load data in chunks using cursors, not `getAll()`
3. **Pre-computed search index:** Store Fuse.js index in IndexedDB, not raw data
4. **Consider alternatives:**
   - uFuzzy: No index needed, 5ms for 162k phrases
   - FlexSearch: Better for large datasets, supports persistent indexes
5. **Web Worker:** Offload search to worker thread to keep UI responsive

**Phase addressing:** Phase 2 (Search) - Architecture decision for offline search

**Sources:**
- [RxDB: Solving IndexedDB Slowness](https://rxdb.info/slow-indexeddb.html)
- [uFuzzy GitHub: Performance benchmarks](https://github.com/leeoniya/uFuzzy)
- [Nolan Lawson: Speeding up IndexedDB](https://nolanlawson.com/2021/08/22/speeding-up-indexeddb-reads-and-writes/)

---

### Pitfall 3-H: Debounce Handler Recreation Bug (MODERATE)

**What goes wrong:** Debounced search handler gets recreated on each render, resetting the debounce timer. Users experience no debouncing effect (every keystroke triggers search) or infinite re-renders.

**Why it happens:** Without `useCallback` or `useMemo`, the debounced function is recreated, losing its internal timer state. ESLint may complain about dependencies, leading developers to "fix" it incorrectly.

**Warning signs:**
- Debouncing doesn't seem to work (search fires on every keystroke)
- Console warning: "React Hook useCallback received a function whose dependencies are unknown"
- Infinite re-render loops

**Prevention:**
```typescript
// CORRECT approach using useMemo for debounced handler
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    // search logic
  }, 300),
  [] // empty deps - handler is stable
);

// Clean up on unmount
useEffect(() => {
  return () => debouncedSearch.cancel();
}, [debouncedSearch]);
```

**Phase addressing:** Phase 2 (Search) - Implementation pattern

**Sources:**
- [Dmitri Pavlutin: How to Debounce and Throttle in React](https://dmitripavlutin.com/react-throttle-debounce/)
- [The Writing Dev: Fixing React Debounce](https://thewriting.dev/fixing-react-debounce/)

---

### Pitfall 3-I: Search Must Include Offline Mutations (MODERATE - INTEGRATION)

**What goes wrong:** User creates item offline (queued for sync), searches for it, item doesn't appear in results.

**Why it happens:** Fuzzy search only queries IndexedDB synced data, ignoring pending mutations in queue.

**Warning signs:**
- "I just created this item but can't find it"
- Items appear after sync completes but not before
- Inconsistent search results when offline

**Prevention:**
1. Search must merge: IndexedDB results + pending creates from mutation queue
2. Mark pending items visually (you already have pending indicator UI)
3. Consider: pending items might have conflicts - handle gracefully in search results

**Phase addressing:** Phase 2 (Search) - Integration with existing mutation queue

---

## v1.3 Mobile Gesture Pitfalls

### Pitfall 3-J: iOS Safari Swipe-Back Conflicts (CRITICAL)

**What goes wrong:** Custom swipe gestures (swipe-to-delete on list items, radial menu activation) conflict with iOS Safari's native swipe-to-go-back gesture, causing double navigation or gesture cancellation.

**Why it happens:** iOS Safari in standalone PWA mode handles edge swipes differently than browser mode. When your app captures swipe gestures near screen edges, they compete with system gestures.

**Warning signs:**
- Swipe-to-delete triggers browser back navigation
- Users accidentally exit lists while trying to interact
- Gesture works in browser but fails in PWA standalone mode

**Prevention:**
1. Avoid horizontal swipe gestures near screen edges (left 20px especially)
2. Use vertical swipes for destructive actions (swipe-down-to-delete) or explicit buttons
3. For PWA standalone mode, native back gesture may not exist - implement your own navigation
4. Test in PWA standalone mode specifically, not just mobile Safari
5. Consider tap-and-hold for actions instead of swipes

**Phase addressing:** Phase 3 (Gestures/FAB) - Gesture design decisions

**Sources:**
- [Ionic Framework Issue #22299: iOS swipe back in PWA](https://github.com/ionic-team/ionic-framework/issues/22299)
- [Brainhub: PWA on iOS Limitations 2025](https://brainhub.eu/library/pwa-on-ios)

---

### Pitfall 3-K: Gesture-Accessibility Conflicts with Screen Readers (CRITICAL)

**What goes wrong:** Custom gestures (swipes, pinches, long-press) override screen reader gestures. VoiceOver/TalkBack users cannot navigate your app because their accessibility gestures are captured by your custom handlers.

**Why it happens:** Screen readers use specific gestures (swipe for next item, double-tap to activate, two-finger scrub to escape). If your app captures these, accessibility is broken.

**Warning signs:**
- VoiceOver users report being "trapped" in components
- TalkBack gestures don't work as expected
- No accessibility complaints during dev (developers rarely test with screen readers)

**Prevention:**
1. **Always provide button alternatives** for every gesture-based action
2. Test with VoiceOver (iOS) and TalkBack (Android) enabled
3. Don't capture four-finger tap, two-finger scrub, or standard navigation swipes
4. Use `aria-label` to describe what gesture alternatives exist
5. For radial menu: ensure keyboard and screen reader navigation works
6. Add `role="menu"` and proper ARIA attributes to gesture-triggered menus

**Phase addressing:** Phase 3 (Gestures/FAB) - Accessibility requirements

**Sources:**
- [W3C: Mobile Accessibility Challenges](https://www.w3.org/WAI/GL/mobile-a11y-tf/wiki/Mobile_Accessibility_Challenges)
- [ACM Queue: Accessibility for Mobile Applications](https://queue.acm.org/detail.cfm?id=3704628)

---

### Pitfall 3-L: FAB Covers Content and Blocks Interaction (MODERATE)

**What goes wrong:** Floating Action Button (FAB) positioned at bottom-right covers list items, action buttons, or form submit buttons. Users cannot tap items beneath it.

**Why it happens:** FAB is absolutely positioned and doesn't participate in document flow. As users scroll, different content passes behind the FAB.

**Warning signs:**
- Users report they "can't tap the last item" in lists
- Actions at bottom of forms are unreachable
- Swipe-to-reveal actions are blocked by FAB

**Prevention:**
1. Add bottom padding to scrollable content equal to FAB height + safe margin
2. Hide/collapse FAB when scrolling down, show when scrolling up
3. Position FAB to avoid common tap targets (not directly over list item actions)
4. For lists with swipe actions, hide FAB when swipe is active
5. Consider Extended FAB with text label for better tap target and clarity

**Phase addressing:** Phase 3 (Gestures/FAB) - Layout considerations

**Sources:**
- [Medium: Why FAB Is Not Always a Good UX Choice](https://aleseverojr.medium.com/why-the-floating-action-button-is-not-always-a-good-ux-choice-bb1abd9a0ac3)
- [Material Design 3: FAB Accessibility](https://m3.material.io/components/floating-action-button/accessibility)

---

### Pitfall 3-M: FAB Color Contrast Issues (MODERATE)

**What goes wrong:** FAB appears over varying backgrounds as user scrolls. A FAB that has good contrast against a white list background fails contrast against a dark image or colored section.

**Why it happens:** FAB color is usually static while background content varies. Meeting 3:1 contrast ratio becomes impossible without adaptive styling.

**Warning signs:**
- FAB "disappears" visually when scrolled over certain content
- Accessibility audits fail contrast requirements
- Users miss the FAB when it's over similarly-colored content

**Prevention:**
1. Add subtle shadow/outline that provides contrast regardless of background
2. Use a ring/border in contrasting color
3. Consider semi-transparent backdrop behind FAB
4. Test FAB visibility against all screen backgrounds in your app

**Phase addressing:** Phase 3 (Gestures/FAB) - Visual design

**Sources:**
- [Medium: FAB Accessibility Options](https://danny-payne.medium.com/accessibility-options-for-floating-action-buttons-99bdf8146988)

---

### Pitfall 3-N: Radial Menu Keyboard Navigation Overlooked (MINOR)

**What goes wrong:** Radial/pie menu looks great with touch but has no keyboard support. Users who navigate with keyboards or switch devices cannot access menu items.

**Why it happens:** Radial menus are inherently touch/mouse-oriented. Arrow key navigation in a circle is non-intuitive.

**Prevention:**
1. Implement focus management: Tab cycles through menu items in logical order
2. Use `role="menu"` and `aria-label` for screen readers
3. Support Escape key to close menu
4. Provide alternative access via long-press on FAB or keyboard shortcut

**Phase addressing:** Phase 3 (Gestures/FAB) - Accessibility

**Sources:**
- [MDN: ARIA menu role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menu_role)
- [CSS Script: Accessible Circular Menu](https://www.cssscript.com/modern-accessible-circular-menu/)

---

### Pitfall 3-O: Gesture Conflicts with Existing Pull-to-Refresh (MINOR - INTEGRATION)

**What goes wrong:** New swipe gestures conflict with any existing pull-to-refresh implementation or native PWA refresh behavior.

**Why it happens:** Multiple touch handlers competing for same gesture.

**Prevention:**
1. Audit existing touch handlers before adding new gestures
2. Use gesture library that supports gesture composition (@use-gesture/react)
3. Define clear gesture zones (pull-to-refresh only at top of scroll container)

**Phase addressing:** Phase 3 (Gestures) - Integration check

---

## v1.3 Form/Keyboard Pitfalls

### Pitfall 3-P: iOS Keyboard Hides Fixed-Position Elements (CRITICAL)

**What goes wrong:** Fixed-position elements (submit button, navigation bar, FAB) become hidden behind the iOS keyboard or float in wrong position. After keyboard dismisses, elements remain misaligned.

**Why it happens:** iOS Safari doesn't resize the Layout Viewport when keyboard appears - only the Visual Viewport shrinks. Elements with `position: fixed; bottom: 0` are anchored to Layout Viewport, not visible area.

**Warning signs:**
- Submit button disappears when keyboard opens
- Elements "float" in middle of screen during keyboard open
- After dismissing keyboard, fixed elements are offset and don't return to correct position
- Particularly bad on iOS 26 with persistent offset bug

**Prevention:**
1. Use Visual Viewport API to detect and adjust for keyboard:
   ```typescript
   useEffect(() => {
     const viewport = window.visualViewport;
     if (!viewport) return;

     const handleResize = () => {
       const offsetY = viewport.height - window.innerHeight + viewport.offsetTop;
       // Adjust fixed elements based on offsetY
     };

     viewport.addEventListener('resize', handleResize);
     return () => viewport.removeEventListener('resize', handleResize);
   }, []);
   ```
2. Avoid `position: fixed; bottom: 0` for form actions - use `position: sticky` or inline placement
3. Consider `react-ios-keyboard-viewport` hook for React apps
4. Use `dvh` (dynamic viewport height) instead of `vh` for full-height layouts
5. Test keyboard open/close cycle specifically, not just keyboard open state

**Phase addressing:** Phase 4 (Forms) - Critical for all form screens

**Sources:**
- [saricden: Making fixed elements respect iOS virtual keyboard](https://saricden.com/how-to-make-fixed-elements-respect-the-virtual-keyboard-on-ios)
- [Apple Developer Forums: iOS 26 viewport bug](https://developer.apple.com/forums/thread/800125)
- [GitHub: react-ios-keyboard-viewport](https://github.com/RyoSogawa/react-ios-keyboard-viewport)

---

### Pitfall 3-Q: iOS PWA Keyboard Fails to Appear (CRITICAL)

**What goes wrong:** Tapping input fields in PWA doesn't trigger keyboard. Users cannot enter any text. Often intermittent and hard to reproduce.

**Why it happens:** Multiple iOS PWA bugs: having two PWAs open simultaneously, background/foreground cycling, specific iOS versions. Once triggered, affects all PWAs until device restart.

**Warning signs:**
- "Keyboard stopped working" user reports with no pattern
- Works fine for most users, completely broken for some
- Input focuses (shows cursor) but keyboard never appears
- Clearing Safari data sometimes fixes it

**Prevention:**
1. Add explicit `inputMode` attribute to all inputs (`inputMode="text"`, `inputMode="numeric"`)
2. Ensure inputs have proper `type` attributes
3. Avoid programmatic focus on load (can trigger the bug)
4. Document workaround for users: close all PWAs, force-quit Safari, retry
5. Add "keyboard not working?" help link that opens in Safari browser as fallback
6. This is an Apple bug - no complete prevention, only mitigation

**Phase addressing:** Phase 4 (Forms) - Known limitation to document

**Sources:**
- [GitHub: actualbudget - iOS PWA keyboard issue](https://github.com/actualbudget/actual/issues/2392)
- [Discourse Meta: iOS keyboard not prompted on PWA](https://meta.discourse.org/t/ios-keyboard-not-prompted-on-pwa/373010)

---

### Pitfall 3-R: 100vh Breaks on Mobile (MODERATE)

**What goes wrong:** Full-height layouts using `height: 100vh` overflow the visible area on mobile. Browser chrome (URL bar) is included in `vh` calculation but may hide/show dynamically.

**Why it happens:** Mobile browsers have collapsible UI. `100vh` equals the maximum height when URL bar is hidden, but initial view has URL bar visible, causing overflow.

**Warning signs:**
- Content cut off at bottom on initial load
- Scrolling feels "bouncy" or reveals extra space
- Layout shifts when scrolling triggers URL bar hide/show

**Prevention:**
1. Use `100dvh` (dynamic viewport height) instead of `100vh`:
   ```css
   .full-height {
     height: 100dvh; /* Falls back to 100vh in older browsers */
     height: 100vh; /* Fallback */
   }
   ```
2. For critical layouts, use JavaScript to set height based on `window.innerHeight`
3. Avoid full-height layouts for forms - let content determine height
4. Test with browser chrome visible and hidden

**Phase addressing:** Phase 4 (Forms) - CSS foundation

**Sources:**
- [DEV.to: Fix mobile form inputs breaking layout](https://dev.to/swhabitation/how-to-fix-mobile-form-inputs-breaking-layout-on-sites-1b5d)
- [Bram.us: Virtual Keyboard API](https://www.bram.us/2021/09/13/prevent-items-from-being-hidden-underneath-the-virtual-keyboard-by-means-of-the-virtualkeyboard-api/)

---

### Pitfall 3-S: Input Zoom on iOS (MODERATE)

**What goes wrong:** iOS Safari zooms in when user focuses on input with font-size below 16px. After blur, page may remain zoomed, requiring manual pinch-to-zoom out.

**Why it happens:** iOS Safari auto-zooms to make small text readable when focused. This is a "feature" that becomes a bug for responsive designs.

**Warning signs:**
- Page zooms when tapping input fields
- Layout breaks after interacting with forms
- Users complain about having to zoom out manually

**Prevention:**
1. Ensure all input font sizes are at least 16px:
   ```css
   input, textarea, select {
     font-size: 16px; /* or larger */
   }
   ```
2. Alternatively, disable zoom (not recommended for accessibility):
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
   ```
3. Better approach: Design inputs to look good at 16px

**Phase addressing:** Phase 4 (Forms) - CSS requirement

---

### Pitfall 3-T: Form State Lost on Background/Foreground Cycle (MINOR)

**What goes wrong:** User fills out form, switches to another app (to copy text, check photo), returns to PWA, and form state is lost or PWA reloads.

**Why it happens:** iOS aggressively manages memory for PWAs. When backgrounded, PWA may be suspended or killed. On return, it may reload from scratch.

**Warning signs:**
- Users report "form cleared itself" when multitasking
- Long forms are particularly affected
- More common on older devices with less RAM

**Prevention:**
1. Auto-save form state to localStorage/sessionStorage on every change
2. Restore form state on component mount
3. Add explicit "draft saved" indicator so users know their work is preserved
4. For complex forms, save to IndexedDB (aligns with your existing offline architecture)
5. Warn users before navigating away from unsaved forms

**Phase addressing:** Phase 4 (Forms) - UX enhancement (aligns with existing IndexedDB patterns)

---

## v1.3 Phase-Specific Warnings Summary

| Phase | Likely Pitfall | Priority | Mitigation |
|-------|---------------|----------|------------|
| Phase 1: Scanning | 3-A: iOS camera permission volatility | CRITICAL | Single-page scan flow, persistent MediaStream |
| Phase 1: Scanning | 3-B: ZXing mobile performance | CRITICAL | Lower FPS, scan regions, manual fallback |
| Phase 1: Scanning | 3-D: Offline item lookup | CRITICAL | IndexedDB-first lookup |
| Phase 2: Search | 3-F: Fuse.js re-indexing | CRITICAL | useMemo with data dependency |
| Phase 2: Search | 3-G: Large dataset memory | CRITICAL | Hybrid IndexedDB + fuzzy, consider uFuzzy |
| Phase 2: Search | 3-H: Debounce handler bug | MODERATE | useMemo for debounced function |
| Phase 2: Search | 3-I: Offline mutations in search | MODERATE | Merge pending queue into results |
| Phase 3: Gestures | 3-J: iOS swipe-back conflict | CRITICAL | Avoid edge swipes, use vertical/tap |
| Phase 3: Gestures | 3-K: Accessibility conflicts | CRITICAL | Button alternatives, VoiceOver testing |
| Phase 3: FAB | 3-L: Content obstruction | MODERATE | Bottom padding, scroll-aware visibility |
| Phase 4: Forms | 3-P: iOS keyboard hides elements | CRITICAL | Visual Viewport API, avoid fixed bottom |
| Phase 4: Forms | 3-Q: iOS PWA keyboard bug | CRITICAL | Document workaround, fallback link |
| Phase 4: Forms | 3-R: 100vh mobile breakage | MODERATE | Use dvh units |

---

## v1.3 Integration Risk Matrix

Risks specific to integrating v1.3 features with existing Home Warehouse System:

| Existing Component | New Feature | Risk Level | Key Concern |
|-------------------|-------------|------------|-------------|
| IndexedDB stores | Search | HIGH | Memory usage with full dataset load |
| Mutation queue | Search | MEDIUM | Including pending items in results |
| Offline sync | Scanning | HIGH | Scan actions must work offline |
| Serwist SW | Scanning library | LOW | Pre-caching scanner assets |
| iOS Safari fallback | All features | MEDIUM | Existing fallbacks may conflict |
| PWA standalone mode | Scanning, Forms | HIGH | iOS PWA-specific bugs |

---

## v1.3 Pre-Implementation Checklist

Before starting v1.3 Mobile UX implementation:

- [ ] Choose barcode scanning library (html5-qrcode vs alternatives)
- [ ] Benchmark scanning performance on target iOS devices
- [ ] Choose fuzzy search library (Fuse.js vs uFuzzy vs FlexSearch)
- [ ] Benchmark search performance with 1000+ items from IndexedDB
- [ ] Audit existing touch handlers for gesture conflicts
- [ ] Document accessibility requirements for gestures/FAB
- [ ] Test iOS PWA keyboard behavior on current app
- [ ] Verify input font sizes are >= 16px in current forms
- [ ] Plan camera permission persistence strategy

---

## v1.3 Sources Summary

| Source | Confidence | Topics |
|--------|------------|--------|
| [html5-qrcode GitHub](https://github.com/mebjas/html5-qrcode) | HIGH | iOS camera issues, library limitations |
| [ZXing-js GitHub](https://github.com/zxing-js/library) | HIGH | Performance issues, maintenance status |
| [Scanbot Blog](https://scanbot.io/blog/popular-open-source-javascript-barcode-scanners/) | MEDIUM | Library comparison |
| [Dynamsoft Blog](https://www.dynamsoft.com/blog/insights/browser-barcode-scanning-challenges-best-practices/) | MEDIUM | Browser scanning challenges |
| [DEV.to Fuse.js](https://dev.to/koushikmaratha/a-deep-dive-into-fusejs-advanced-use-cases-and-benchmarking-357p) | HIGH | Performance optimization |
| [uFuzzy GitHub](https://github.com/leeoniya/uFuzzy) | HIGH | Alternative fuzzy search |
| [RxDB IndexedDB](https://rxdb.info/slow-indexeddb.html) | HIGH | IndexedDB performance |
| [Ionic Framework Issues](https://github.com/ionic-team/ionic-framework/issues/22299) | HIGH | iOS PWA gesture conflicts |
| [Brainhub PWA iOS](https://brainhub.eu/library/pwa-on-ios) | MEDIUM | iOS PWA limitations |
| [W3C Mobile Accessibility](https://www.w3.org/WAI/GL/mobile-a11y-tf/wiki/Mobile_Accessibility_Challenges) | HIGH | Gesture accessibility |
| [Material Design FAB](https://m3.material.io/components/floating-action-button/accessibility) | HIGH | FAB best practices |
| [Apple Developer Forums](https://developer.apple.com/forums/thread/800125) | HIGH | iOS viewport bugs |
| [react-ios-keyboard-viewport](https://github.com/RyoSogawa/react-ios-keyboard-viewport) | MEDIUM | Keyboard handling solution |
| [Dmitri Pavlutin](https://dmitripavlutin.com/react-throttle-debounce/) | HIGH | React debounce patterns |
| [isitdev React 19](https://isitdev.com/react-19-compiler-usememo-usecallback-2025/) | MEDIUM | React 19 memoization |

---

## v1.2 Phase 2: Repair Tracking, Declutter Assistant, Photo Processing

Pitfalls specific to adding repair tracking, declutter assistant, and background photo processing to the existing Home Warehouse System. Focus is on integration risks with existing infrastructure.

---

## v1.2 Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 2-A: Repair Log Orphaning on Inventory Deletion

**What goes wrong:** Repair logs reference `inventory_id` but existing system uses soft-delete (is_archived) for inventory. If repair logs use ON DELETE CASCADE foreign key, soft-deleted inventory could be restored but repair history would be lost. If repair logs use ON DELETE RESTRICT, deleting inventory fails unexpectedly.

**Why it happens:** The existing schema uses soft-delete patterns inconsistently. The `inventory` table has `is_archived` but actual deletion also occurs in some flows. Repair logs need careful FK design.

**Consequences:**
- Lost maintenance history on archived items
- Broken foreign key constraints blocking inventory operations
- Orphaned repair records cluttering database

**Warning signs:**
- Test failures when archiving/deleting inventory with repair logs
- FK constraint violations during inventory cleanup
- Empty repair history for restored items

**Prevention:**
1. Use `ON DELETE SET NULL` for `repair_logs.inventory_id` foreign key
2. Store denormalized item/inventory identifiers (name, SKU snapshot) in repair log
3. Add `inventory_id_snapshot` column to preserve reference after deletion
4. Index repair logs by workspace_id for tenant isolation regardless of inventory state

**Detection:**
- Test deleting/archiving inventory with repair logs attached
- Run FK constraint validation in integration tests
- Add SQL check for orphaned repair records

**Phase addressing:** Phase 2 - Repair Tracking schema design

---

### Pitfall 2-B: Condition State Machine Corruption

**What goes wrong:** The existing system has `item_condition_enum` (NEW, EXCELLENT, GOOD, FAIR, POOR, DAMAGED, FOR_REPAIR). Repair tracking needs to change condition states, but without proper state machine validation, items can get stuck in invalid states (e.g., FOR_REPAIR with no active repair record, or DAMAGED with completed repair).

**Why it happens:** The current condition field is a simple enum with no enforcement of valid transitions. Adding repair tracking creates implicit state machine requirements that aren't codified.

**Consequences:**
- Items stuck in FOR_REPAIR indefinitely
- Condition history inconsistent with repair history
- Users unable to understand item state
- Audit trail gaps

**Warning signs:**
- Query returns FOR_REPAIR items with no open repair records
- Condition field shows FOR_REPAIR after repair marked complete
- Activity log shows condition changes without corresponding repair actions

**Prevention:**
1. Define explicit condition transition rules in domain layer
2. Create `condition_transitions` validation before allowing condition changes
3. Link condition changes to repair_log entries automatically
4. Add validation: FOR_REPAIR requires open repair record
5. Add validation: repair completion must set condition to non-FOR_REPAIR state

**Example transition rules:**
```
AVAILABLE -> FOR_REPAIR: Requires repair record creation
FOR_REPAIR -> GOOD/FAIR/POOR: Requires repair record completion
FOR_REPAIR -> DAMAGED: Requires repair record with "unrepairable" status
DAMAGED -> FOR_REPAIR: Requires new repair record
```

**Detection:**
- Query for FOR_REPAIR items with no open repair records
- Integration tests for condition transition flows
- Add database check constraint or trigger

**Phase addressing:** Phase 2 - Repair Tracking domain logic

---

### Pitfall 2-C: Declutter Algorithm Triggering False Positives on New Items

**What goes wrong:** Declutter assistant identifies "unused" items based on activity/movement history. New items or recently migrated data appear unused because they have no activity_log entries, getting incorrectly flagged for declutter.

**Why it happens:** The algorithm treats "no activity" as "unused" without distinguishing between "never used" and "just added." The existing `activity_log` only tracks changes, not access patterns.

**Consequences:**
- New items immediately flagged as unused
- Users lose trust in declutter recommendations
- Bulk imports trigger mass declutter alerts
- Support complaints about false recommendations

**Warning signs:**
- Declutter suggestions appear immediately after adding items
- Imported items all flagged as unused
- High dismissal rate on declutter suggestions

**Prevention:**
1. Use `created_at` as baseline - items under N days old exempt from declutter detection
2. Require minimum observation period (30-90 days) before flagging
3. Consider `date_acquired` on inventory as acquisition signal
4. Track "seen" events separately from "modified" events if viewing counts
5. Weight recent additions lower in declutter scoring

**Detection:**
- Test declutter algorithm against fresh import data
- Monitor declutter recommendations vs. item age correlation
- Add warning UI for items with insufficient history

**Phase addressing:** Phase 2 - Declutter Assistant algorithm design

---

### Pitfall 2-D: Background Worker Memory Exhaustion on Large Photo Batches

**What goes wrong:** Background thumbnail worker processes photos with in-memory image operations. Processing large batches (e.g., bulk photo upload, migration from old system) causes worker memory to spike beyond container limits, crashing the worker.

**Why it happens:** The existing `imageprocessor` loads full images into memory (see `imaging.Open()` in processor.go). Processing multiple concurrent images multiplies memory usage. Current import worker pattern processes rows sequentially but doesn't account for image memory.

**Current code pattern (from imageprocessor/processor.go):**
```go
// This loads entire image into memory
src, err := imaging.Open(sourcePath, imaging.AutoOrientation(true))
```

**Consequences:**
- Worker OOM kills during peak usage
- Failed thumbnail jobs retry indefinitely
- Stuck photos without thumbnails
- User frustration with "processing" status never completing

**Warning signs:**
- Worker pod restarts with OOMKilled status
- Photo processing jobs stuck in retry queue
- Memory graphs spike during photo operations
- Thumbnail_path remains empty in database

**Prevention:**
1. Implement memory-aware concurrency limiting (not just count-based)
2. Process one image at a time per worker, scale workers horizontally
3. Add timeout per photo processing (current system lacks this)
4. Implement max file size pre-check before loading (10MB limit exists but enforce earlier)
5. Use streaming processing for large images if possible
6. Add circuit breaker to pause photo queue under memory pressure

**Detection:**
- Monitor worker memory usage during photo batch processing
- Add memory metrics to worker health endpoint (port 8081 already has /health)
- Alert on worker restarts
- Track photo processing duration histograms

**Phase addressing:** Phase 2 - Background Worker implementation

---

## v1.2 Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 2-E: Repair Cost Tracking Currency Mismatch

**What goes wrong:** Repair costs tracked in different currencies than original purchase_price. Reports mixing currencies produce nonsensical totals.

**Why it happens:** Existing inventory has `purchase_price` with `currency_code`. Repair logs need separate cost tracking. Without enforced currency consistency, multi-currency workspaces accumulate unconvertible totals.

**Warning signs:**
- Reports show costs without currency indicators
- Totals mix EUR, USD, etc.
- Users confused by cost summaries

**Prevention:**
1. Store repair cost with currency_code (same pattern as inventory)
2. Implement currency conversion at report time, not storage time
3. Add workspace-level default currency setting
4. Show currency alongside all monetary values in UI
5. Consider cents/minor units storage (existing uses integer cents)

**Phase addressing:** Phase 2 - Repair Tracking schema

---

### Pitfall 2-F: Declutter Suggestions Ignoring Multi-Location Context

**What goes wrong:** Item used frequently at Location A but copy at Location B never moved. Declutter flags the Location B inventory as unused, ignoring that users intentionally keep distributed stock.

**Why it happens:** Algorithm looks at individual inventory records, not item-level usage patterns. The same item can exist in multiple locations/containers.

**Warning signs:**
- Backup/spare inventory flagged for declutter
- Seasonal items at storage location flagged
- Users dismiss same items repeatedly

**Prevention:**
1. Aggregate usage at item level across all inventory records
2. Distinguish between "this specific inventory unused" vs "this item type unused anywhere"
3. Allow user to mark locations as "archive/storage" exempt from declutter
4. Weight by quantity - low quantity stock more likely intentional reserve

**Phase addressing:** Phase 2 - Declutter Assistant algorithm refinement

---

### Pitfall 2-G: Activity Log Pollution from Repair Updates

**What goes wrong:** Each repair log status update creates activity_log entry. Repair-heavy workflows flood activity feed, burying actual inventory changes.

**Why it happens:** Existing activity_log pattern logs all entity changes. Repair tracking introduces high-frequency updates (parts ordered, technician notes, status changes).

**Current activity_log schema supports:**
- action: CREATE, UPDATE, DELETE, MOVE, LOAN, RETURN
- entity_type: ITEM, INVENTORY, LOCATION, CONTAINER, CATEGORY, LABEL, LOAN, BORROWER

**Warning signs:**
- Activity feed dominated by repair updates
- Users miss important inventory changes
- Activity log table grows rapidly
- Activity queries slow down

**Prevention:**
1. Create separate `repair_activity_log` or use metadata field to distinguish
2. Add REPAIR to activity_entity_enum and REPAIR_UPDATE to activity_action_enum
3. Filter repair-related activities in main activity feed by default
4. Aggregate repair activities in UI (show summary, expand for details)
5. Consider not logging every repair status change, only key milestones

**Phase addressing:** Phase 2 - Activity Logging integration

---

### Pitfall 2-H: Thumbnail Worker Idempotency Failures

**What goes wrong:** Photo upload creates DB record with empty `thumbnail_path`. Worker fails mid-processing. Retry creates duplicate thumbnail file with different name. Original record points to missing file, new file orphaned.

**Why it happens:** Current photo upload (itemphoto/service.go) generates thumbnail synchronously at upload time. Moving to async creates split between DB record creation and thumbnail generation, requiring idempotency handling.

**Current sync pattern (from itemphoto/service.go):**
```go
// Thumbnail generated inline during upload
thumbnailFilename := "thumb_" + header.Filename
thumbnailTempPath := filepath.Join(s.uploadDir, "thumb-"+uuid.New().String()+filepath.Ext(header.Filename))
// ... generates thumbnail synchronously
```

**Warning signs:**
- Orphaned thumbnail files in storage
- Database thumbnail_path pointing to missing files
- Same photo processed multiple times in queue
- Storage costs increasing unexpectedly

**Prevention:**
1. Use deterministic thumbnail paths based on photo ID (not random UUID)
2. Check if thumbnail exists before processing (skip if already done)
3. Store processing status on photo record (pending/processing/complete/failed)
4. Use Asynq's unique task option to deduplicate retries
5. Clean up orphaned files on job failure

**Example deterministic path:**
```go
// Instead of: "thumb-" + uuid.New().String() + ext
// Use: "thumb-" + photoID.String() + ext
thumbnailPath := fmt.Sprintf("thumbnails/%s/%s_thumb%s", workspaceID, photoID, ext)
```

**Detection:**
- Compare DB thumbnail_path entries against actual filesystem/storage
- Monitor for photos stuck in "processing" state
- Track thumbnail generation latency P99
- Add storage audit job

**Phase addressing:** Phase 2 - Background Worker idempotency

---

### Pitfall 2-I: Repair History Query Performance Degradation

**What goes wrong:** Repair history grows large over time. Queries for "all repairs for item X" scan entire repair_log table because queries join through inventory to items.

**Why it happens:** Natural query path: item -> inventory -> repair_log. But repair_log indexed by inventory_id, not item_id. Over time, items accumulate many inventory records (disposals, replacements), each with repair history.

**Warning signs:**
- Repair history page loads slowly
- Database CPU spikes on repair queries
- EXPLAIN shows sequential scans on repair_log

**Prevention:**
1. Denormalize: add `item_id` directly to repair_log (derived from inventory at insert time)
2. Index repair_log by (workspace_id, item_id) for item-level queries
3. Index repair_log by (workspace_id, created_at) for recent repairs feed
4. Partition repair_log by workspace_id if multi-tenant scale requires
5. Consider archiving old repairs (closed > 2 years) to separate table

**Recommended indexes:**
```sql
CREATE INDEX idx_repair_log_workspace_item ON repair_log (workspace_id, item_id);
CREATE INDEX idx_repair_log_workspace_created ON repair_log (workspace_id, created_at DESC);
CREATE INDEX idx_repair_log_workspace_status ON repair_log (workspace_id, status) WHERE status = 'open';
```

**Phase addressing:** Phase 2 - Schema design and indexing

---

### Pitfall 2-J: Bulk Photo Operations Bypassing Rate Limits

**What goes wrong:** "Regenerate all thumbnails" admin feature bypasses normal upload rate limiting, overwhelming storage backend or image processing capacity.

**Why it happens:** Normal upload path has per-user rate limits. Admin bulk operations don't use same path, having no limits.

**Warning signs:**
- Storage API rate limit errors during bulk operations
- Worker queue depth spikes
- Other jobs starved during bulk regeneration
- System becomes unresponsive

**Prevention:**
1. All photo operations route through same queue regardless of source
2. Implement queue-level rate limiting (jobs per minute)
3. Add priority levels: normal uploads > bulk regeneration
4. Expose queue depth in admin UI before starting bulk operations
5. Allow cancellation of bulk operations

**Phase addressing:** Phase 2 - Admin bulk photo tools

---

## v1.2 Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 2-K: Repair Log Notes Truncation

**What goes wrong:** Repair notes field too short for detailed technician entries. Users work around by creating multiple log entries, fragmenting history.

**Prevention:**
1. Use TEXT type for notes, not VARCHAR(255)
2. Add optional structured fields for common data (cost, duration, parts)
3. Keep notes as freeform supplement

**Phase addressing:** Phase 2 - Schema design

---

### Pitfall 2-L: Declutter UI Dismissal Not Persisted

**What goes wrong:** User dismisses declutter suggestion, refreshes page, sees same suggestion again.

**Prevention:**
1. Store dismissed suggestions with timestamp and expiry
2. Create `declutter_dismissals` table or use user preferences
3. Re-suggest after configurable cooldown (90 days)

**Phase addressing:** Phase 2 - Declutter UI implementation

---

### Pitfall 2-M: Thumbnail Size Inconsistency with Existing Photos

**What goes wrong:** Existing photos have 400x400 thumbnails (hardcoded in service.go). New background worker uses configurable sizes from env vars. Different thumbnail dimensions cause layout issues in UI.

**Current code (from itemphoto/service.go):**
```go
// Hardcoded 400x400
if err := s.processor.GenerateThumbnail(ctx, tempPath, thumbnailTempPath, 400, 400); err != nil {
```

**Config options (from imageprocessor/processor.go):**
```go
SmallSize:   150,  // from PHOTO_THUMBNAIL_SMALL_SIZE
MediumSize:  400,  // from PHOTO_THUMBNAIL_MEDIUM_SIZE
LargeSize:   800,  // from PHOTO_THUMBNAIL_LARGE_SIZE
```

**Prevention:**
1. Migrate existing photos to new thumbnail sizes OR
2. Use same hardcoded sizes as existing system (400x400)
3. Add thumbnail size metadata to photo record for UI adaptation
4. Document thumbnail size changes in migration notes

**Phase addressing:** Phase 2 - Thumbnail worker configuration

---

### Pitfall 2-N: Repair Technician Field Without User Management

**What goes wrong:** Repair log has "technician" text field. Over time, same person entered differently ("John", "John Smith", "J. Smith"). Reports by technician produce fragmented data.

**Prevention:**
1. Consider separate `technicians` table (like borrowers pattern)
2. Or use existing `users` table with optional external technician flag
3. Or implement autocomplete from previous entries
4. Defer structured technician management to future phase if scope creep concern

**Phase addressing:** Phase 2 - Repair Tracking schema (consider deferring structured approach)

---

## v1.2 Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Repair log schema | 2-A: FK cascade on soft-delete | Use SET NULL + denormalized snapshots |
| Condition state machine | 2-B: Invalid state combinations | Explicit transition validation |
| Declutter algorithm | 2-C: False positives on new items | Observation period + created_at baseline |
| Background worker | 2-D: Memory exhaustion | Single-image processing + horizontal scaling |
| Activity logging | 2-G: Repair activity pollution | Separate or filter repair activities |
| Bulk photo operations | 2-J: Rate limit bypass | Queue-based limiting for all operations |
| Thumbnail migration | 2-M: Size inconsistency | Match existing sizes or migrate all |

---

## v1.2 Integration Risk Matrix

Risks specific to integrating with existing Home Warehouse System components:

| Existing Component | New Feature | Risk Level | Key Concern |
|-------------------|-------------|------------|-------------|
| activity_log | Repair tracking | MEDIUM | Activity feed pollution |
| item_condition_enum | Repair tracking | HIGH | State machine coherence |
| inventory soft-delete | Repair history | HIGH | Orphaned/lost history |
| item_photos sync upload | Background worker | MEDIUM | Migration path for existing photos |
| import_worker pattern | Photo worker | LOW | Same patterns applicable |
| Redis queue (existing) | Photo worker | LOW | Infrastructure exists |
| workspace isolation | All features | LOW | Existing patterns work |

---

## v1.2 Pre-Implementation Checklist

Before starting Phase 2 implementation:

- [ ] Decide repair_log FK strategy (SET NULL vs denormalization)
- [ ] Define condition state machine transitions explicitly
- [ ] Determine declutter observation period (30/60/90 days)
- [ ] Benchmark memory usage of current imageprocessor with large images
- [ ] Audit existing thumbnail sizes vs planned configuration
- [ ] Decide on synchronous vs async thumbnail generation for new uploads
- [ ] Review activity_log table size and query patterns
- [ ] Determine if repair costs need multi-currency support

---

## v1.2 Sources

- Existing codebase analysis: schema.sql, import_worker.go, itemphoto/service.go, imageprocessor/processor.go
- [Asynq Task Queue Best Practices](https://github.com/hibiken/asynq) - idempotency patterns
- [Background Jobs Guide](https://medium.com/@harshgharat663/background-jobs-for-backend-developers-the-complete-guide-with-go-examples-a69d15f21e81) - error handling
- [MySQL Cascading Changes](https://www.artie.com/blogs/mysql-cascading-changes-and-why-you-shouldnt-use-them) - FK cascade risks
- [Technical Debt Management](https://www.atlassian.com/agile/software-development/technical-debt) - feature addition patterns
- [Inventory Management Challenges](https://www.netsuite.com/portal/resource/articles/inventory-management/inventory-management-challenges.shtml) - tracking pitfalls
- [Maintenance Tracking Best Practices](https://www.clickmaint.com/blog/maintenance-tracking) - repair log patterns

---

## v1.1 Critical Pitfalls: Hierarchical and Relational Entities

Pitfalls specific to extending offline mutations from items to hierarchical (locations, categories) and relational (containers, inventory) entities.

---

### Pitfall 1-A: Unsynced Parent Reference on Child Creation (NEW)

**What goes wrong:** User creates a child entity (container, subcategory, child location) while its parent entity is still pending sync. The child's foreign key references a temporary client-generated ID (UUIDv7) that doesn't exist on the server yet. When sync runs, the server rejects the child with a foreign key constraint violation.

**Why it happens:**
- Current mutation queue processes mutations in FIFO order by timestamp
- No dependency tracking between related mutations
- Parent and child may be created in the same offline session
- Queue processes all "pending" mutations without FK awareness

**Affected entities:**
- Locations (parent_location references parent)
- Categories (parent_category_id references parent)
- Containers (location_id references location - if location is also pending)
- Inventory (location_id, container_id, item_id all required)

**Consequences:**
- Child mutation fails permanently (400/422 from server)
- After max retries, mutation marked as "failed"
- User sees failed mutations that can't be resolved
- Potential data loss if user doesn't notice/understand

**Warning signs:**
- Backend returns "foreign key constraint violation" errors
- Child entities stuck in failed queue while parent synced successfully
- E2E tests fail when creating nested structures offline

**Prevention:**
1. **Topological sort before sync:** Sort mutation queue by dependency order. Parents must sync before children.
2. **Dependency tracking:** Add optional `dependsOn: string[]` field to `MutationQueueEntry` storing idempotency keys of prerequisite mutations.
3. **Blocking strategy:** When processing queue, skip mutations whose dependencies haven't completed yet.
4. **Verify parent exists:** Before syncing a child, check if parent ID is a pending mutation ID vs a server-confirmed ID.

**Implementation guidance:**
```typescript
// In mutation-queue.ts, add dependency tracking
interface QueueMutationParams {
  // ... existing fields
  dependsOn?: string[]; // idempotency keys of prerequisite mutations
}

// In sync-manager.ts, sort before processing
function sortByDependencies(mutations: MutationQueueEntry[]): MutationQueueEntry[] {
  // Build dependency graph
  // Topological sort
  // Return ordered list
}
```

**Phase to address:** Phase 1 of v1.1 - Implement dependency tracking before adding hierarchical entities.

**Sources:**
- [urql Offline Mutations Discussion](https://github.com/urql-graphql/urql/discussions/1773)
- [Topological Sorting for Dependencies](https://medium.com/@amit.anjani89/topological-sorting-explained-a-step-by-step-guide-for-dependency-resolution-1a6af382b065)

---

### Pitfall 1-B: Cascading Failures in Multi-Entity Workflows (NEW)

**What goes wrong:** User creates a new location offline, then immediately creates inventory at that location. The inventory record references the location's temporary ID. Even with dependency ordering, if the location sync fails (e.g., name conflict), the inventory mutation will also fail with an unresolvable reference.

**Why it happens:**
- Inventory has required FK to location_id
- Location creation might fail for various reasons (duplicate name, validation)
- Child mutation depends on parent success, not just parent being queued first
- Cascading failures aren't handled gracefully

**Affected entities:**
- Inventory (depends on location, container, item all existing)
- Containers (depends on location)
- Any entity with non-null FK requirements

**Consequences:**
- Cascading mutation failures
- User creates valid-looking data that silently fails
- Difficult to diagnose which failure caused downstream issues

**Warning signs:**
- Multiple "failed" mutations that seem related
- User confusion: "I created the location, why can't I add inventory there?"

**Prevention:**
1. **Cascade failure handling:** When a mutation fails, automatically fail all mutations that depend on it.
2. **Show relationship in error UI:** "This failed because [Parent Location] also failed to sync."
3. **Retry chain:** When retrying a failed mutation, offer to retry its failed dependencies too.
4. **Validate references at queue time:** Check if referenced entity is synced or pending, adjust UI accordingly.

**Phase to address:** Phase 1 of v1.1 - Design failure cascade handling with dependency tracking.

**Sources:**
- [Salesforce Mobile SDK Sync](https://developer.salesforce.com/docs/platform/mobile-sdk/guide/entity-framework-sync-related.html)

---

### Pitfall 1-C: Orphaned Optimistic Data on Sync Failure (NEW)

**What goes wrong:** User creates a child location under a parent, sees it immediately in UI (optimistic update). Parent sync fails. Child sync then fails. The optimistic child remains visible in IndexedDB and UI until page refresh, showing stale/incorrect data.

**Why it happens:**
- Optimistic writes to IndexedDB happen immediately
- Sync failures don't automatically clean up optimistic data
- `_pending: true` flag isn't cleared on failure
- No rollback mechanism for dependency chains

**Affected entities:**
- All entities with `_pending` flag
- Hierarchical displays (location tree, category tree)

**Consequences:**
- UI shows data that doesn't actually exist
- User may continue building on top of phantom data
- Confusing state after page refresh when phantom data disappears

**Warning signs:**
- Pending indicators stay visible indefinitely
- Data disappears after page refresh
- Tree structures show inconsistent state

**Prevention:**
1. **Rollback on failure:** When a mutation fails permanently, remove its optimistic entry from the entity store.
2. **Cascade rollback:** When parent fails, also rollback dependent children.
3. **Failure UI state:** Replace `_pending: true` with `_failed: true, _error: "reason"` for clear UI indication.
4. **Persist failure state:** Keep failed mutations visible with clear "Failed - Retry?" UI rather than silently disappearing.

**Phase to address:** Phase 2 of v1.1 - Implement rollback alongside hierarchical entity support.

---

### Pitfall 1-D: Inventory Quantity Without Operational Transform (NEW)

**What goes wrong:** Two users (or same user on two devices) both modify inventory quantity offline. User A: 10 -> 15. User B: 10 -> 8. With LWW, one change is lost. With server-wins, both users' intent is lost.

**Why it happens:**
- Quantity changes are often additive/subtractive operations
- LWW treats quantity as absolute value
- Current critical field classification only flags for manual review
- No operational transform or CRDT semantics

**Affected entities:**
- Inventory (quantity field - already marked as critical in `CRITICAL_FIELDS`)
- Loans (quantity field - already marked as critical)

**Consequences:**
- Inventory counts become incorrect
- Manual review required for every quantity conflict
- High conflict rate for busy inventory

**Warning signs:**
- Frequent quantity conflicts requiring manual resolution
- Users complain about lost quantity changes
- Audit trails show unexpected quantity jumps

**Prevention:**
1. **Operational transform (future):** Store operations (+5, -2) rather than absolute values, merge by replaying ops.
2. **Three-way merge:** Compare local/server/base to detect actual delta, apply combined delta.
3. **Conflict resolution hint:** When showing conflict UI, calculate "your change was +5, server has +10 from you" to help user decide.
4. **Accept higher conflict rate:** For inventory, quantity conflicts may be acceptable with good manual resolution UI.

**Current mitigation:** Quantity/status already in `CRITICAL_FIELDS` - manual resolution required. This is acceptable for v1.1.

**Phase to address:** Deferred - Current manual resolution is acceptable. Operational transform is complex.

---

### Pitfall 1-E: Concurrent Hierarchy Modification Conflicts (NEW)

**What goes wrong:** User A moves Location X under Location Y while offline. User B moves Location Y under Location X while offline (on different device). Both sync - potential circular reference.

**Why it happens:**
- Hierarchical structures can have complex concurrent modifications
- Move operations can create cycles if not validated
- Server may not detect cycle until both operations applied

**Affected entities:**
- Locations (parent_location updates)
- Categories (parent_category_id updates)

**Consequences:**
- Circular reference (A -> B -> A)
- Broken tree structure
- UI infinite loops when rendering

**Warning signs:**
- Server returns "circular reference" errors
- Tree rendering hangs or crashes
- parent_location chain has cycles

**Prevention:**
1. **Server-side cycle detection:** Backend must validate no cycles before applying parent change.
2. **Treat parent changes as critical:** Add `parent_location` and `parent_category_id` to CRITICAL_FIELDS for manual resolution.
3. **Optimistic cycle check:** Before queuing parent change offline, validate locally that it won't create obvious cycle.
4. **Handle cycle conflicts:** When cycle detected, show conflict UI explaining the issue.

**Recommended CRITICAL_FIELDS update:**
```typescript
export const CRITICAL_FIELDS: Record<string, string[]> = {
  // Existing
  inventory: ["quantity", "status"],
  loans: ["quantity", "returned_at"],
  // New for v1.1
  locations: ["parent_location"],
  categories: ["parent_category_id"],
};
```

**Phase to address:** Phase 2 of v1.1 - When implementing location/category offline mutations.

**Sources:**
- [Loro Movable Tree CRDTs](https://loro.dev/blog/movable-tree)

---

## v1.1 Moderate Pitfalls

---

### Pitfall 1-F: Hierarchical Display Inconsistency During Partial Sync (NEW)

**What goes wrong:** User creates Location A, then child Location B offline. Location A syncs successfully, Location B is still pending. UI shows Location A as synced but Location B as pending child. Tree structure shows mixed synced/unsynced state that may confuse users.

**Why it happens:**
- Parent and child sync independently (even if ordered)
- Tree UI doesn't account for mixed pending/synced state
- Breadcrumbs may show pending items in path

**Affected entities:**
- Locations (hierarchical tree view)
- Categories (hierarchical tree view)

**Consequences:**
- Confusing UI state
- User may not understand which items are "real"
- Potential for user to take actions based on false assumptions

**Warning signs:**
- Parent shows as synced but children show pending
- Tree collapse/expand behaves unexpectedly with pending items

**Prevention:**
1. **Propagate pending state up:** If any descendant is pending, show parent with "has pending children" indicator.
2. **Consistent visual treatment:** Pending items in tree use consistent styling (opacity, badge).
3. **Prevent certain operations:** Don't allow certain operations on pending parents (e.g., moving synced item into pending location).
4. **Batch visual update:** After sync completes, update entire tree state rather than individual items.

**Phase to address:** Phase 2 of v1.1 - Tree UI enhancements when implementing location/category.

---

### Pitfall 1-G: Category/Location Path Drift (NEW)

**What goes wrong:** User creates subcategory "Tools > Power Tools > Drills" offline. While offline, user renames "Power Tools" to "Electric Tools". Path stored in child references outdated parent name. Sync happens, but UI caches may show inconsistent paths.

**Why it happens:**
- Hierarchical paths are often denormalized for display
- Parent rename doesn't automatically update child cached paths
- Breadcrumb computation may use stale IndexedDB data

**Affected entities:**
- Locations (breadcrumb paths)
- Categories (category paths)

**Consequences:**
- Inconsistent breadcrumb display
- Search/filter by path may miss items
- User confusion about "where" items are

**Warning signs:**
- Breadcrumbs don't match actual hierarchy
- Same item shows different paths in different views

**Prevention:**
1. **Don't cache paths:** Compute paths on-demand from parent references.
2. **Invalidate on parent change:** When parent entity updates, invalidate any cached path data for children.
3. **Refresh after sync:** After sync batch completes, re-fetch affected hierarchies from server.

**Phase to address:** Phase 2 of v1.1 - Breadcrumb computation should be dynamic.

---

### Pitfall 1-H: Stale Dropdown Options for Foreign Keys (NEW)

**What goes wrong:** Location dropdown in Container form shows stale data. User selects location that was deleted on server while offline. Container sync fails with "location not found".

**Affected entities:**
- Containers (location_id dropdown)
- Inventory (location_id, container_id, item_id dropdowns)
- Items (category_id dropdown)
- Loans (borrower_id dropdown)

**Warning signs:**
- FK validation errors after selecting from dropdown
- Dropdown shows items that don't exist on server

**Prevention:**
1. **Sync before showing form:** If online, quick-refresh the relevant entity list before showing create form.
2. **Validate on sync:** Catch FK errors gracefully, show "Location no longer exists, please select another".
3. **Soft-delete awareness:** If using soft deletes, filter out `is_archived: true` from dropdowns.

**Phase to address:** Phase 3 of v1.1 - When implementing inventory offline mutations.

---

## v1.1 Minor Pitfalls

---

### Pitfall 1-I: Short Code Collision in Offline Creates (NEW)

**What goes wrong:** User creates two locations offline with same short_code, or offline-generated short_code collides with existing server-side code.

**Affected entities:**
- Locations (short_code field)
- Containers (short_code field)
- Items (short_code field)

**Warning signs:**
- "Duplicate short_code" errors on sync
- QR code scanning resolves to wrong item

**Prevention:**
1. **Generate unique short codes:** Use prefix + timestamp/random to reduce collision chance.
2. **Allow server to reassign:** If collision detected, server can auto-assign new code and return it.
3. **Mark short_code as non-critical:** Let LWW resolve (server wins), notify user of new code.

**Phase to address:** Minor - handle in validation layer.

---

### Pitfall 1-J: Optimistic UI Flicker on Rapid Create/Sync (NEW)

**What goes wrong:** User creates item offline, goes online immediately. Item appears with pending indicator, then disappears briefly during sync, then reappears with server ID. Causes visual flicker.

**Affected entities:**
- All entities during create flow

**Warning signs:**
- Items briefly disappear from lists during sync
- Users report "data loss" that turns out to be flicker

**Prevention:**
1. **ID stability:** Use UUIDv7 as permanent ID (current approach) - no ID replacement needed.
2. **Merge not replace:** When sync returns, update existing record rather than delete/recreate.
3. **Optimistic to real transition:** Clear `_pending` flag without triggering re-render cascade.

**Current mitigation:** UUIDv7 already used. No ID replacement occurs. This should be minimal issue.

**Phase to address:** Already mitigated by current design.

---

## v1.1 Entity-Specific Implementation Order

Based on pitfall analysis, recommended order for implementing offline support:

| Entity | Complexity | Key Pitfalls | Recommendation |
|--------|-----------|--------------|----------------|
| Borrowers | Low | None - standalone entity | **Implement first** as practice |
| Categories | Medium | 1-A, 1-E (hierarchy) | Add dependency tracking |
| Locations | Medium | 1-A, 1-E, 1-F, 1-G (hierarchy) | Add dependency tracking, test tree UI |
| Containers | Medium | 1-A, 1-B (depends on location) | Queue after locations |
| Inventory | High | 1-A, 1-B, 1-D, 1-H (multi-FK, quantity) | Implement last, most complex |

---

## v1.1 Critical Fields Recommendation

Extend the existing configuration in `conflict-resolver.ts`:

```typescript
export const CRITICAL_FIELDS: Record<string, string[]> = {
  // Existing (from v1)
  inventory: ["quantity", "status"],
  loans: ["quantity", "returned_at"],

  // New for v1.1
  locations: ["parent_location"],    // Hierarchy changes need review
  categories: ["parent_category_id"], // Hierarchy changes need review
  // containers: [],  // No critical fields - LWW acceptable
  // borrowers: [],   // No critical fields - LWW acceptable
};
```

---

## Original v1 Pitfalls (Reference)

The following pitfalls from v1 have been **addressed** in the shipped implementation:

| Pitfall | Status | Mitigation |
|---------|--------|------------|
| Safari Data Eviction (7-Day Rule) | **Addressed** | `navigator.storage.persist()` called on init |
| Missing Idempotency Keys | **Addressed** | UUIDv7 idempotency keys in mutation queue |
| No Background Sync for Safari/iOS | **Addressed** | `online` + `visibilitychange` fallback |
| Optimistic UI Without Rollback | **Addressed** | `_pending` flag, before-state tracking |
| Last-Write-Wins Data Loss | **Addressed** | Critical field classification, conflict UI |

The following v1 pitfalls remain relevant for v1.1:

---

### Pitfall 6: Service Worker Update Traps Users on Old Version

**Status:** Partially addressed with `skipWaiting()`. Monitor during v1.1 rollout.

---

### Pitfall 7: IndexedDB Transaction Auto-Commit Surprise

**Status:** Addressed in current patterns. Continue following async-outside-transaction pattern.

---

### Pitfall 8: Sync Queue Grows Without Bounds

**Status:** Addressed with retry limits (5) and TTL (7 days). Continue monitoring.

---

### Pitfall 10: Testing Offline Only Manually

**Status:** Addressed with E2E tests (17+ offline scenarios). Expand tests for new entities.

---

## Sources Summary

| Source | Confidence | Topics |
|--------|------------|--------|
| [urql Offline Mutations](https://github.com/urql-graphql/urql/discussions/1773) | HIGH | Dependency ordering, FK constraints |
| [Salesforce Mobile SDK](https://developer.salesforce.com/docs/platform/mobile-sdk/guide/entity-framework-sync-related.html) | HIGH | Parent-first sync, ID mapping |
| [Atlassian Two ID Problem](https://www.atlassian.com/blog/atlassian-engineering/sync-two-id-problem) | MEDIUM | Client/server ID strategies |
| [Topological Sorting](https://medium.com/@amit.anjani89/topological-sorting-explained-a-step-by-step-guide-for-dependency-resolution-1a6af382b065) | HIGH | Dependency graph resolution |
| [Loro Movable Tree CRDTs](https://loro.dev/blog/movable-tree) | MEDIUM | Hierarchical conflict resolution |
| [PWA Conflict Resolution](https://gtcsys.com/comprehensive-faqs-guide-data-synchronization-in-pwas-offline-first-strategies-and-conflict-resolution/) | MEDIUM | General conflict strategies |
| [TanStack Query Optimistic](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) | HIGH | Rollback patterns |
| [Asynq Task Queue](https://github.com/hibiken/asynq) | HIGH | Background job idempotency |
| [Maintenance Tracking Best Practices](https://www.clickmaint.com/blog/maintenance-tracking) | MEDIUM | Repair log patterns |
| Existing codebase analysis | HIGH | `mutation-queue.ts`, `conflict-resolver.ts`, `sync-manager.ts`, `schema.sql`, `import_worker.go`, `itemphoto/service.go` |

---

*Last updated: 2026-01-25 for v1.3 Mobile UX Overhaul*
