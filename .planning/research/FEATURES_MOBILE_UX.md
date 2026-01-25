# Feature Landscape: v1.3 Mobile UX Overhaul

**Domain:** Mobile inventory management app (PWA)
**Researched:** 2026-01-25
**Focus:** Scanning, search, quick actions, mobile forms
**Confidence:** HIGH (multiple authoritative sources consulted, industry patterns verified)

## Current State Assessment

The application already has foundational capabilities relevant to mobile UX features:

| Existing Feature | Implementation | Relevance |
|------------------|----------------|-----------|
| QR/Barcode short codes | `short_code` on items, containers, locations | Ready for scan lookup |
| Global search | `GlobalSearchResults` component with recent searches | Extend for mobile |
| Command palette | Navigation and action shortcuts | Reference for quick actions |
| IndexedDB stores | 7 entity stores + mutation queue + conflict log | Offline search index source |
| PWA service worker | Serwist with runtime caching | Offline capability foundation |
| Photo upload | Camera integration exists | Reusable for scanning |
| Swipe/selection | Photo gallery multi-select | Extend to list views |

---

## Barcode/QR Scanning Features

### Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Camera-based barcode scanning | Users expect phone camera scanning without external hardware | Medium | MediaDevices API, Barcode Detection API + polyfill | Native API on Chrome/Android; html5-qrcode polyfill for Safari/iOS |
| Support for 1D codes (UPC, EAN, Code128) | Standard product barcodes | Low | Scanning library | All major libraries support these |
| Support for 2D codes (QR, DataMatrix) | Warehouse labels, inventory tags, existing short_codes | Low | Scanning library | Well-supported across libraries |
| Scan feedback (visual + audio + haptic) | Users need confirmation scan succeeded | Low | Navigator.vibrate(), Audio API | 10-20ms haptic pulse, beep sound, visual highlight |
| Auto-detect mode | Camera should detect codes without user pressing button | Medium | Continuous scanning loop | Balance with battery; timeout after 30s inactivity |
| Torch/flashlight toggle | Warehouses often have poor lighting | Low | MediaTrack.applyConstraints() | Native camera API supports this |
| Scan history/recent scans | Quick access to recently scanned items | Low | localStorage/IndexedDB | Store last 10-20 scans with timestamps |
| Unknown code handling | Show "not found" with option to create new item | Low | UI/UX flow | Better than silent failure |

### Differentiators

Features that set product apart.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Scan-to-action radial menu | Scan item, immediately see contextual actions (loan, move, repair, etc.) | Medium | Context from item status | Shows only relevant actions based on item state |
| Batch scan mode | Scan multiple items continuously, then batch process | High | Multi-item state management | Stocktaking, receiving shipments |
| Unknown barcode -> product lookup | Scan product barcode, offer to create new item with auto-populated data | High | External product API (UPC database) | "This looks like a new item, create it?" |
| Multi-code scan | Single camera view can detect multiple codes | Medium | Library capability | Useful for grouped items in warehouse |
| Scan verification feedback | Distinguish "found in system" vs "not found" with different haptics | Low | Haptic patterns | Success: light tap; Not found: double tap |
| Container content preview | Scan container, show what's inside | Low | Existing container-inventory relationship | Quick inventory check without navigation |

### Anti-Features

Features to deliberately NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-submit on scan | User may scan wrong item; needs confirmation | Show scanned item with action options |
| Continuous scanner always-on | Battery drain, accidental scans, privacy concerns | Require explicit activation or timeout after 30s |
| Desktop-style file picker for scan | Poor mobile UX | Camera-first with fallback to gallery |
| Relying solely on Barcode Detection API | Safari/iOS doesn't support it | Use html5-qrcode or ZXing-JS as polyfill |
| Hardware scanner requirement | Most users don't have external scanners | Phone camera with optional Bluetooth scanner support |

---

## Mobile Search Features

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Instant search (as-you-type) | Sub-300ms response expected by 53% of mobile users | Medium | Debouncing, efficient API | Already have global search; needs mobile optimization |
| Autocomplete suggestions | 5-8 suggestions during typing reduces keyboard effort | Medium | Query analysis | Reduces typing on mobile keyboards |
| Recent searches | Users repeat common searches | Low | LocalStorage | Already implemented in GlobalSearchResults |
| Fuzzy matching/typo tolerance | Mobile keyboards cause typos | Medium | Fuse.js or similar | ~6KB gzipped, client-side |
| Search result grouping | Show items, locations, containers separately | Low | Already implemented | Group headers with counts |
| Large touch targets | 44x44px minimum for tap targets | Low | CSS updates | Accessibility requirement |
| Keyboard handling | Dismiss keyboard on scroll, show on focus | Low | Event handlers | Mobile UX standard |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Offline search | Must work without network | High | IndexedDB full-text index | Build index on sync, search locally |
| Voice search input | Hands-free in warehouse | Medium | Web Speech API | Fallback to text gracefully |
| Filter chips | Tap to add common filters (location, category, status) | Medium | UI component | Mobile-friendly filter refinement |
| Smart suggestions | Suggest based on context (time of day, recent activity) | Medium | Usage analytics | "Items you checked recently", "Low stock" |
| Barcode in search | Paste or type barcode number to search | Low | Pattern detection | Detect numeric strings as potential barcodes |
| Natural language hints | "drills in garage" shows as valid search format | Medium | Query parser | Guide users toward natural queries |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full-page search results | Covers entire screen, loses context | Inline dropdown results with preview |
| Scrollable autocomplete dropdowns | Hard to tap, scroll hijacking issues | Limit to 5-8 visible suggestions |
| Placeholder-only labels | Disappear on input, accessibility issue | Always show persistent labels above inputs |
| Delayed search (> 300ms) | Users expect instant response | Debounce to 150-200ms max |
| No offline search | Useless in warehouse with poor signal | Index data in IndexedDB |
| Complex filters on mobile | Hard to use in cramped UI | Simple filter chips, bottom sheet for advanced |

---

## Quick Actions Interface Features

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Floating Action Button (FAB) | Primary action always accessible | Low | React component | Single FAB, bottom-right, 16px from edges |
| Quick action menu from FAB | Expand to show 3-5 common actions | Medium | Animation, state | Radial or linear expansion |
| Scan shortcut in FAB | One-tap access to scanner | Low | Navigation | Most common mobile action |
| Add item shortcut | Quick path to create new item | Low | Already exists in command palette | Promote to FAB |
| Log loan shortcut | Common workflow action | Low | Form/modal | Rapid loan logging |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Scan-to-action flow | Scan item then see relevant actions for that specific item | Medium | Item state context | Context-aware menu based on item status |
| Swipe gestures on list items | Quick actions without tapping into detail | Medium | Gesture library | "Mark as found", "Log loan", "Move" |
| Long-press for selection mode | Multi-select items in lists | Low | Already exists in photo gallery | Extend pattern to all lists |
| Quick quantity adjustment | +/- buttons without opening detail view | Low | Inline controls | High-frequency action |
| Status quick-toggle | Change item status directly from list | Low | Inline chips | AVAILABLE, IN_USE, ON_LOAN |
| Context-aware FAB | FAB actions change based on current screen | Medium | Route awareness | On Items: Add Item; On Inventory: Quick Count |
| Haptic feedback on actions | Confirm action succeeded | Low | Navigator.vibrate | 10-20ms tap for success |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multiple FABs per screen | Violates Material Design, confuses users | One FAB for primary action only |
| Destructive actions in FAB | Delete/archive are not "primary" actions | FAB for positive actions only (create, share, explore) |
| FAB covering content | Blocking important information | 16px margins, consider mini FAB or auto-hide on scroll |
| Custom gestures without discoverability | Users don't know they exist | Visual hints, onboarding, or swipe indicators |
| Aggressive vibrations | Feels cheap, irritating | Short, clear haptic pulses (10-20ms) |
| Too many quick actions | Decision paralysis | 3-5 max in radial menu |

---

## Mobile Form Features

### Table Stakes

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Progressive disclosure | Show essential fields first, advanced in expandable sections | Medium | Multi-step wizard or accordion | Reduce cognitive load |
| Appropriate keyboard types | Number pad for quantities, email keyboard for email | Low | `inputMode` attribute | Standard HTML5 |
| Large touch targets | 44x44px minimum | Low | CSS updates | Accessibility requirement |
| Persistent labels | Labels visible during and after input | Low | CSS, not placeholder-only | Accessibility requirement |
| Clear required field indicators | Know what's mandatory before attempting submit | Low | Asterisk or "Required" label | Reduce frustration |
| Validation feedback | Inline errors near field, not top of form | Low | Form validation library | Immediate feedback preferred |
| Smart defaults | Pre-fill based on context (location, category, time) | Medium | Context awareness | Use recent selections, current time |

### Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Inline photo capture | Take photo without leaving form | Medium | Camera integration | "Add photo" inline, not separate page |
| Multi-step wizard for complex forms | Create Item broken into: Basic -> Details -> Photos | Medium | Step navigation component | Progress indicator, save between steps |
| Voice input for text fields | Speak notes or descriptions | Medium | Web Speech API | Microphone icon on text areas |
| Auto-save drafts | Don't lose progress on navigation | Medium | LocalStorage/IndexedDB | Recover incomplete forms |
| Barcode scan to populate fields | Scan product barcode, auto-fill known data | Medium | Barcode lookup integration | "Scan to fill" button |
| Recent values suggestions | Dropdown of recently used locations/categories | Low | LocalStorage history | Speed up repetitive entry |
| Undo for destructive actions | Recover from accidental submit | Low | Toast with undo button | 5-second window |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Single-page long forms | Overwhelming, high abandonment (81% abandon difficult forms) | Multi-step wizard with progress indicator |
| Removing all friction | Irreversible mistakes happen | Keep confirmations for destructive actions |
| Tiny touch targets | Frustrating, error-prone | 44x44px minimum |
| Complex date/time pickers | Hard to use on mobile | Native date input or simple calendar |
| Password confirmation fields | Annoying on mobile keyboards | Show/hide password toggle instead |
| Required fields without indication | Frustration when form fails | Clear indicators upfront |
| Form resets on error | Lost data infuriating | Preserve input, highlight errors |

---

## Feature Dependencies

```
Existing Infrastructure:
  - short_code fields (items, containers, locations) -----> Ready for scan lookup
  - GlobalSearchResults component -----------------------> Extend for mobile optimization
  - Command palette ----------------------------------------> Reference for quick action patterns
  - IndexedDB stores (7 entities) -------------------------> Offline search index source
  - PWA service worker ------------------------------------> Offline capability foundation
  - Photo upload component ---------------------------------> Camera integration reference
  - Photo gallery multi-select -----------------------------> Extend to list views

New Features - Barcode Scanning:
  +--------------------------+
  | Barcode Scanner Component|
  +--------------------------+
  |                          |
  +-- Camera access (MediaDevices API)
  |
  +-- Barcode detection
  |   +-- Native Barcode Detection API (Chrome/Android)
  |   +-- html5-qrcode polyfill (Safari/iOS)
  |
  +-- Scan-to-action menu
  |   +-- Item context loading
  |   +-- Action routing
  |
  +-- Feedback system
      +-- Haptic (Navigator.vibrate)
      +-- Audio (beep.mp3)
      +-- Visual (overlay highlight)

New Features - Mobile Search:
  +------------------------+
  | Mobile Search Overhaul |
  +------------------------+
  |                        |
  +-- Depends on: Existing search API
  |
  +-- Fuzzy matching layer (Fuse.js)
  |
  +-- Offline search index
  |   +-- Build on initial sync
  |   +-- Rebuild on sync completion
  |   +-- Query IndexedDB directly
  |
  +-- Voice input (optional)
      +-- Web Speech API
      +-- Fallback to text input

New Features - Quick Actions:
  +---------------------+
  | FAB + Quick Actions |
  +---------------------+
  |                     |
  +-- FAB component (bottom-right)
  |
  +-- Radial/expandable menu
  |   +-- Scan
  |   +-- Add Item
  |   +-- Log Loan
  |
  +-- Swipe actions on lists
  |   +-- Reveal secondary actions
  |   +-- Accessibility: long-press alternative
  |
  +-- Context-aware actions
      +-- Based on current route
      +-- Based on scanned item state

New Features - Mobile Forms:
  +---------------------+
  | Mobile Form Redesign|
  +---------------------+
  |                     |
  +-- Multi-step wizard component
  |   +-- Progress indicator
  |   +-- Step navigation
  |   +-- Draft persistence
  |
  +-- Inline photo capture
  |   +-- Camera modal within form
  |   +-- Photo preview + retake
  |
  +-- Smart defaults
      +-- Recent locations/categories
      +-- Current time for dates
      +-- Context from scan

Dependency Graph:
  Scanner -----------------> short_code lookup API
  Scan-to-action ----------> Item/Container/Location detail APIs
  Offline search ----------> IndexedDB entity stores
  Voice search -------------> Web Speech API (browser support)
  Haptic feedback ----------> Navigator.vibrate (browser support)
  Form drafts --------------> IndexedDB or localStorage
```

---

## Technology Recommendations

### Barcode Scanning

**Recommended:** [html5-qrcode](https://github.com/mebjas/html5-qrcode)

| Library | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| html5-qrcode | Built-in UI, uses native BarcodeDetector where available, quick setup | In maintenance mode | Use for MVP |
| ZXing-JS | Comprehensive format support, mature | Maintenance mode, slower on low-end devices | Alternative |
| Quagga2 | Rotation invariant for 1D codes, active maintenance | No 2D support (QR, DataMatrix) | Not suitable |

**Implementation approach:**
1. Feature detect native `BarcodeDetector` API
2. Use html5-qrcode as polyfill when native unavailable
3. Wrap in custom component with consistent API

### Fuzzy Search

**Recommended:** [Fuse.js](https://fusejs.io/)

- Client-side fuzzy search library
- ~6KB gzipped
- Good typo tolerance
- Configurable scoring

### Haptic Feedback

**Approach:**
```typescript
const haptic = {
  success: () => navigator.vibrate?.(15),    // Short tap
  error: () => navigator.vibrate?.(100),     // Longer buzz
  select: () => navigator.vibrate?.(10),     // Light tap
  notFound: () => navigator.vibrate?.([10, 50, 10]),  // Double tap
};
```

### Voice Input

**Recommended:** Web Speech API (native)

- `webkitSpeechRecognition` or `SpeechRecognition`
- Fallback: hide microphone icon if unsupported
- No third-party dependencies

---

## MVP Recommendation

### Priority 1: Barcode Scanner with Basic Lookup

**Effort:** ~16-20 hours

1. **Scanner component** (8h)
   - Camera access with permissions
   - html5-qrcode integration
   - Torch toggle
   - Scan overlay UI

2. **Lookup integration** (4h)
   - Query items/containers/locations by short_code
   - Display found entity info
   - "Not found" handling

3. **Basic action menu** (4h)
   - View details
   - Quick actions based on entity type
   - Haptic + audio feedback

### Priority 2: FAB with 3 Quick Actions

**Effort:** ~8-10 hours

1. **FAB component** (4h)
   - Bottom-right positioning
   - Expandable to radial menu
   - Smooth animations

2. **Quick action integration** (4h)
   - Scan (opens scanner)
   - Add Item (opens create form)
   - Log Loan (opens quick loan dialog)

### Priority 3: Mobile Search Optimization

**Effort:** ~12-16 hours

1. **Touch optimization** (4h)
   - Larger tap targets
   - Better spacing
   - Keyboard handling

2. **Filter chips** (4h)
   - Location, category, status filters
   - Mobile-friendly UI

3. **Fuzzy matching** (4h)
   - Integrate Fuse.js
   - Handle typos gracefully

### Priority 4: Scan-to-Action Menu

**Effort:** ~10-12 hours

1. **Context-aware actions** (6h)
   - Item: Loan, Move, Repair, Edit
   - Container: View contents, Move
   - Location: View inventory

2. **Quick workflows** (4h)
   - One-tap loan from scan
   - Status update from scan

### Defer to Post-MVP

- **Offline search:** High complexity, needs careful index strategy
- **Voice search:** Needs fallback handling, accent considerations
- **Batch scan mode:** Complex state management
- **Natural language search:** Requires NLP/LLM integration
- **Swipe gestures on all lists:** Medium complexity, accessibility considerations
- **Multi-step form wizard:** Implement when form complexity warrants it

---

## Sources

### Barcode Scanning
- [Shopify Barcode Inventory Management](https://www.shopify.com/blog/barcode-inventory-management)
- [PWA Barcode Scanner Capabilities - Progressier](https://progressier.com/pwa-capabilities/qr-code-and-barcode-reader)
- [html5-qrcode GitHub](https://github.com/mebjas/html5-qrcode)
- [STRICH comparison with OSS](https://strich.io/comparison-with-oss.html)
- [Scanbot: Popular open-source JavaScript barcode scanners](https://scanbot.io/blog/popular-open-source-javascript-barcode-scanners/)
- [Scanbot: Quagga2 vs html5-qrcode](https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/)

### Mobile Search UX
- [Design Monks: Master Search UX in 2026](https://www.designmonks.co/blog/search-ux-best-practices)
- [DesignRush: 6 Essential Search UX Best Practices](https://www.designrush.com/best-designs/websites/trends/search-ux-best-practices)
- [Baymard: 9 UX Design Patterns for Autocomplete Suggestions](https://baymard.com/blog/autocomplete-design)
- [Algolia: Search Autocomplete on Mobile](https://www.algolia.com/blog/ecommerce/search-autocomplete-on-mobile)
- [LogRocket: Search Bar UI Best Practices](https://blog.logrocket.com/ux-design/design-search-bar-intuitive-autocomplete)
- [Algolia: Mobile Search UX Best Practices](https://www.algolia.com/blog/ux/mobile-search-ux-best-practices)

### FAB and Quick Actions
- [Mobbin: Floating Action Button Best Practices](https://mobbin.com/glossary/floating-action-button)
- [Android Developers: FAB in Compose](https://developer.android.com/develop/ui/compose/components/fab)
- [Icons8: FAB in UX Design](https://blog.icons8.com/articles/floating-action-button-ux-design/)
- [Usersnap: Floating Action Buttons SaaS Guide](https://usersnap.com/blog/floating-action-button/)
- [Hakuna Matata Tech: Gestures in Mobile App](https://www.hakunamatatatech.com/our-resources/blog/gestures-in-mobile-app)
- [LogRocket: Designing swipe-to-delete interactions](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/)

### Mobile Form Design
- [Design Studio: 12 Form UI/UX Best Practices 2026](https://www.designstudiouiux.com/blog/form-ux-design-best-practices/)
- [Smashing Magazine: Best Practices for Mobile Form Design](https://www.smashingmagazine.com/2018/08/best-practices-for-mobile-form-design/)
- [Forms on Fire: 13 Mobile Form Design Best Practices](https://www.formsonfire.com/blog/mobile-form-design)
- [UXPin: Inventory App Design Guide](https://www.uxpin.com/studio/blog/inventory-app-design/)
- [Justinmind: Complete guide to form UI design](https://www.justinmind.com/blog/form-design/)

### Haptic Feedback
- [DesignRush: What Is Haptic Feedback?](https://www.designrush.com/agency/ui-ux-design/trends/haptic-feedback)
- [Android Developers: Haptics Design Principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles)
- [Boreas: Guidelines of Haptic UX Design](https://pages.boreas.ca/blog/piezo-haptics/guidelines-of-haptic-ux-design)
- [Saropa: 2025 Guide to Haptics](https://saropa-contacts.medium.com/2025-guide-to-haptics-enhancing-mobile-ux-with-tactile-feedback-676dd5937774)

### Anti-Patterns
- [MindInventory: Common App UX Design Mistakes](https://www.mindinventory.com/blog/common-app-ux-design-mistakes-to-avoid/)
- [SitePoint: Mobile Design Anti-Patterns](https://www.sitepoint.com/examples-mobile-design-anti-patterns/)
- [SolveIT: UI/UX Mistakes That Limit Scalability](https://solveit.dev/blog/ui-ux-design-mistakes)

### Competitor Analysis
- [Sortly Software Reviews](https://www.softwareadvice.com/inventory-management/sortly-pro-profile/)
- [SelectHub: Best Inventory Apps 2026](https://www.selecthub.com/inventory-management/best-inventory-app-mobile/)
- [NerdWallet: Home Inventory Apps](https://www.nerdwallet.com/insurance/homeowners/learn/home-inventory-app-template)
- [Technical Ustad: 7 Best Home Inventory Apps 2026](https://technicalustad.com/home-inventory-apps/)
