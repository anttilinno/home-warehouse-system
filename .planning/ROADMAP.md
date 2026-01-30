# Roadmap: Home Warehouse System

## Milestones

- v1 **PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- v1.1 **Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- v1.2 **Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- v1.3 **Mobile UX Overhaul** — Phases 18-21 (active)

## Phases

<details>
<summary>v1 PWA Offline Completion (Phases 1-5) — SHIPPED 2026-01-24</summary>

See `.planning/MILESTONES.md` for full details.

**Delivered:** Complete offline capabilities for PWA - view workspace data and create/update items while offline with automatic sync.

- Phase 1: IndexedDB Setup (3 plans)
- Phase 2: Mutation Queue Infrastructure (3 plans)
- Phase 3: Conflict Resolution (2 plans)
- Phase 4: Sync Manager & iOS Fallback (3 plans)
- Phase 5: Item Form Migration (3 plans)

</details>

<details>
<summary>v1.1 Offline Entity Extension (Phases 6-11) — SHIPPED 2026-01-25</summary>

See `.planning/milestones/v1.1-ROADMAP.md` for full details.

**Delivered:** Offline mutations for all core entities with dependency-aware sync ordering and conflict history UI.

- Phase 6: Infrastructure & Borrowers (2 plans)
- Phase 7: Categories (2 plans)
- Phase 8: Locations (2 plans)
- Phase 9: Containers (2 plans)
- Phase 10: Inventory (3 plans)
- Phase 11: Conflict History (1 plan)

</details>

<details>
<summary>v1.2 Phase 2 Completion (Phases 12-17) — SHIPPED 2026-01-25</summary>

See `.planning/milestones/v1.2-ROADMAP.md` for full details.

**Delivered:** Enhanced item lifecycle management with repair tracking, declutter assistance, photo processing improvements, and SSE test coverage.

- Phase 12: Repair Log Foundation (3 plans)
- Phase 13: Repair Log Extensions (4 plans)
- Phase 14: Declutter Assistant (3 plans)
- Phase 15: Background Thumbnail Processing (3 plans)
- Phase 16: Bulk Photo Operations (2 plans)
- Phase 17: Testing & Polish (4 plans)

</details>

### v1.3 Mobile UX Overhaul (Phases 18-21) — ACTIVE

Transform the PWA into a warehouse-grade mobile inventory tool with barcode scanning, offline-capable fuzzy search, floating action buttons with radial menus, and mobile-optimized forms.

**Phase 18: Fuzzy Search Infrastructure**

**Goal:** Users can find items instantly despite typos, works completely offline

**Dependencies:** None (pure infrastructure)

**Requirements:** SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06

**Success Criteria:**
1. User types a search query and sees results appear within 300ms without network
2. User can find items with 1-2 character typos (fuzzy matching working)
3. User sees 5-8 autocomplete suggestions matching their partial input
4. User focuses the search box and sees their 5 most recent searches
5. Search works while device is in airplane mode (IndexedDB-backed)

**Key Deliverables:**
- Fuse.js v7.1.0 integration with IndexedDB
- Enhanced use-global-search.ts hook with offline mode detection
- Fuse index builders per entity store (items, inventory, locations, containers, borrowers, categories)
- Memoized Fuse instances to avoid re-indexing on every render
- Debounced search input (300ms) with useMemo optimization
- Hybrid query approach (IndexedDB filters → Fuse on subset)

**Research Flags:** Standard patterns - monitor performance with real dataset size

**Plans:** 4 plans

Plans:
- [ ] 18-01-PLAN.md — Install Fuse.js and enhance search touch targets (SRCH-05)
- [ ] 18-02-PLAN.md — Create Fuse index builders per entity type
- [ ] 18-03-PLAN.md — Create offline search module with pending mutations merge
- [ ] 18-04-PLAN.md — Enhance useGlobalSearch with offline mode detection

---

**Phase 19: Barcode Scanning**

**Goal:** Users can scan items and take immediate action without manual searching

**Dependencies:** Phase 18 (offline fuzzy search for code lookup)

**Requirements:** SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, SCAN-07

**Success Criteria:**
1. User points camera at QR code or barcode (UPC/EAN/Code128) and receives scan within 2 seconds
2. User receives visual overlay highlight, audio beep, and haptic vibration on successful scan
3. User taps flashlight toggle and sees torch activate for scanning in low-light warehouse
4. User scans an item and sees quick action menu with loan/move/view/repair options
5. User scans unknown barcode and sees "Item not found" with create option
6. User can enter barcode manually when camera scan fails or barcode damaged
7. User navigates to scan history and sees last 10 scans with timestamps

**Key Deliverables:**
- BarcodeScanner component using @yudiel/react-qr-scanner v2.5.0
- QuickActionMenu component with context-aware actions based on entity type
- IndexedDB lookup by short_code field (items/containers/locations)
- Scan history persistence to localStorage with timestamps
- Manual barcode entry fallback input
- Camera permission patterns from photo-upload.tsx
- Single-page scan flow to avoid iOS permission revocation
- Reduced FPS (5-10) and scan region targeting for performance
- Torch/flashlight toggle control

**Research Flags:** REQUIRES BENCHMARKING - Test scanning performance on iPhone 12+ and mid-range Android, validate ZXing fallback behavior, memory usage with continuous scanning

---

**Phase 20: Mobile Navigation - FAB and Gestures**

**Goal:** Users can access common actions instantly from any screen via floating action button

**Dependencies:** Phase 19 (FAB opens scanner)

**Requirements:** QACT-01, QACT-02, QACT-03, QACT-04, QACT-05, QACT-06

**Success Criteria:**
1. User sees floating action button in bottom-right corner on all mobile screens (16px margins)
2. User taps FAB and sees radial menu expand with 3-5 action shortcuts
3. User can quickly access scan, add item, and log loan from FAB without navigation
4. User receives haptic feedback (10-20ms vibration) when tapping FAB actions
5. User navigates to different screens and sees FAB actions change based on context (Items page: Add Item, Inventory page: Quick Count)
6. User long-presses a list item and enters multi-select mode with checkboxes

**Key Deliverables:**
- FloatingActionButton component using shadcn Button + motion v12.27.0
- Radial menu animation with arc positioning (Math.cos/sin)
- @use-gesture/react v10.3.1 for touch handling
- Context-aware action configuration based on current route
- Long-press gesture handler for list items (tap-and-hold, not swipe to avoid accessibility issues)
- Haptic feedback via navigator.vibrate(20)
- Mobile breakpoint detection (hidden on desktop)
- Keyboard navigation and screen reader support (role="menu", ARIA attributes)

**Research Flags:** REQUIRES ACCESSIBILITY TESTING - Test VoiceOver/TalkBack, keyboard navigation, validate radial menu on various screen sizes, test in iOS PWA standalone mode

---

**Phase 21: Mobile Form Improvements**

**Goal:** Users can complete forms efficiently on mobile with progressive disclosure and smart defaults

**Dependencies:** Phase 19 (inline barcode scan to populate fields), Phase 20 (FAB to open forms)

**Requirements:** FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06, FORM-07, FORM-08

**Success Criteria:**
1. User opens Create Item form and sees essential fields first with "Advanced Options" expandable section
2. User taps quantity field and sees number pad keyboard, taps email field and sees email keyboard with @ symbol
3. User taps form controls and experiences 44x44px minimum touch targets throughout
4. User focuses input field and sees label remain visible above field (not disappear like placeholder)
5. User submits incomplete form and sees inline validation errors appear next to each invalid field
6. User taps "Add Photo" button inline within form and takes photo without leaving form context
7. User starts filling form, navigates away, returns later and sees form draft recovered from storage
8. User enters text in form fields using 16px+ font size without iOS triggering zoom

**Key Deliverables:**
- MultiStepForm component for complex forms (Create Item wizard: Basic → Details → Photos)
- CollapsibleSection component for progressive disclosure (Advanced fields)
- InlinePhotoCapture component combining camera modal with form field
- Form draft auto-save to IndexedDB on every change
- Smart defaults from recent selections (last used category/location)
- Mobile keyboard handling (inputMode="numeric", inputMode="email", etc.)
- All input fields use min 16px font size to prevent iOS zoom
- Visual Viewport API integration to handle iOS keyboard hiding fixed elements
- Inline validation errors with clear messaging near each field
- Barcode scan button to populate form fields (integrates Phase 19 scanner)

**Research Flags:** REQUIRES IOS TESTING - Test keyboard behavior on iOS 17-18 in PWA standalone mode, validate Visual Viewport API handling, test form auto-save recovery after backgrounding

---

## Progress

| Phase | Milestone | Plans | Status | Shipped |
|-------|-----------|-------|--------|---------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18 | v1.3 | 4 | Planned | — |
| 19 | v1.3 | TBD | Pending | — |
| 20 | v1.3 | TBD | Pending | — |
| 21 | v1.3 | TBD | Pending | — |

**Total:** 17 phases shipped (45 plans), 4 phases pending

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-01-30 after Phase 18 planning*
