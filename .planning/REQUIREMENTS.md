# Requirements: Home Warehouse System

**Defined:** 2026-01-25
**Core Value:** Reliable inventory access anywhere — online or offline — with seamless sync

## v1.3 Requirements

Requirements for Mobile UX Overhaul milestone. Each maps to roadmap phases.

### Scanning

- [ ] **SCAN-01**: User can scan QR codes and barcodes (UPC/EAN/Code128) using device camera
- [ ] **SCAN-02**: User receives visual, audio, and haptic feedback on successful scan
- [ ] **SCAN-03**: User can toggle flashlight/torch for low-light scanning
- [ ] **SCAN-04**: User sees scan history with recent scans and timestamps
- [ ] **SCAN-05**: User can enter barcode manually when scanning fails
- [ ] **SCAN-06**: User sees quick action menu after scanning an item (loan/move/view/repair)
- [ ] **SCAN-07**: User sees "Item not found" with create option when scanning unknown code

### Search

- [ ] **SRCH-01**: User sees search results as they type (instant, < 300ms)
- [ ] **SRCH-02**: User can find items despite typos (fuzzy matching)
- [ ] **SRCH-03**: User sees autocomplete suggestions while typing (5-8 items)
- [ ] **SRCH-04**: User sees recent searches on search focus
- [ ] **SRCH-05**: Search touch targets are at least 44x44px
- [ ] **SRCH-06**: User can search while offline (IndexedDB-backed fuzzy search)

### Quick Actions

- [ ] **QACT-01**: User sees floating action button (FAB) on mobile screens
- [ ] **QACT-02**: User can tap FAB to expand radial menu with 3-5 actions
- [ ] **QACT-03**: User can quickly access scan, add item, and log loan from FAB
- [ ] **QACT-04**: User receives haptic feedback when tapping FAB actions
- [ ] **QACT-05**: FAB actions change based on current screen context
- [ ] **QACT-06**: User can long-press list items to enter selection mode

### Forms

- [ ] **FORM-01**: Forms show essential fields first with advanced fields in expandable sections
- [ ] **FORM-02**: Forms use appropriate mobile keyboard types (number pad, email, etc.)
- [ ] **FORM-03**: Form touch targets are at least 44x44px
- [ ] **FORM-04**: Form labels remain visible during and after input (not placeholder-only)
- [ ] **FORM-05**: Form validation errors appear inline near the field
- [ ] **FORM-06**: User can take photo inline without leaving the form
- [ ] **FORM-07**: Form drafts auto-save to IndexedDB and recover on return
- [ ] **FORM-08**: Input fields use 16px+ font size to prevent iOS zoom

## Future Requirements

Deferred to post-v1.3. Tracked but not in current roadmap.

### Scanning Enhancements

- **SCAN-F01**: Unknown barcode triggers product lookup API to populate item data
- **SCAN-F02**: Scanning container shows contents preview
- **SCAN-F03**: Batch scan mode for stocktaking operations

### Search Enhancements

- **SRCH-F01**: Voice search input via Web Speech API
- **SRCH-F02**: Mobile filter chips (tap to add location/category/status)
- **SRCH-F03**: Smart suggestions based on recent activity and low stock

### Quick Actions Enhancements

- **QACT-F01**: Swipe gestures on list items for quick actions
- **QACT-F02**: Customizable FAB action shortcuts per user

### Forms Enhancements

- **FORM-F01**: Multi-step wizard with progress indicator for complex forms
- **FORM-F02**: Barcode scan to populate form fields
- **FORM-F03**: Voice input for text fields

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Offline delete via scan | Conflict resolution too complex, data loss risk |
| Real-time collaborative scanning | Network required, out of offline-first scope |
| Hardware barcode scanner support | USB/Bluetooth scanners add complexity, camera sufficient |
| AR overlay for item location | High complexity, not core to mobile UX |
| NFC tag scanning | Limited device support, QR/barcode covers use cases |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRCH-01 | Phase 18 | Pending |
| SRCH-02 | Phase 18 | Pending |
| SRCH-03 | Phase 18 | Pending |
| SRCH-04 | Phase 18 | Pending |
| SRCH-05 | Phase 18 | Pending |
| SRCH-06 | Phase 18 | Pending |
| SCAN-01 | Phase 19 | Pending |
| SCAN-02 | Phase 19 | Pending |
| SCAN-03 | Phase 19 | Pending |
| SCAN-04 | Phase 19 | Pending |
| SCAN-05 | Phase 19 | Pending |
| SCAN-06 | Phase 19 | Pending |
| SCAN-07 | Phase 19 | Pending |
| QACT-01 | Phase 20 | Pending |
| QACT-02 | Phase 20 | Pending |
| QACT-03 | Phase 20 | Pending |
| QACT-04 | Phase 20 | Pending |
| QACT-05 | Phase 20 | Pending |
| QACT-06 | Phase 20 | Pending |
| FORM-01 | Phase 21 | Pending |
| FORM-02 | Phase 21 | Pending |
| FORM-03 | Phase 21 | Pending |
| FORM-04 | Phase 21 | Pending |
| FORM-05 | Phase 21 | Pending |
| FORM-06 | Phase 21 | Pending |
| FORM-07 | Phase 21 | Pending |
| FORM-08 | Phase 21 | Pending |

**Coverage:**
- v1.3 requirements: 27 total
- Mapped to phases: 27 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-01-25 after v1.3 roadmap created*
