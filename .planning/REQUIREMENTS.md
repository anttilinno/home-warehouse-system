# Requirements: Home Warehouse System

**Defined:** 2026-02-27
**Core Value:** Reliable inventory access anywhere — online or offline — with seamless sync

## v1.9 Requirements

Requirements for Quick Capture milestone. Each maps to roadmap phases.

### Quick Capture Core

- [x] **QC-01**: User can open quick capture mode from the floating action button
- [x] **QC-02**: User sees camera viewfinder immediately on entering quick capture
- [x] **QC-03**: User can take 1-5 photos per item with tap-to-capture
- [x] **QC-04**: User types only item name to save (single required field)
- [x] **QC-05**: System auto-generates SKU for quick-captured items
- [x] **QC-06**: After saving, form resets instantly and camera is ready for next item
- [x] **QC-07**: User sees running count of items captured this session
- [x] **QC-08**: User feels haptic/audio feedback on successful save

### Batch Settings

- [x] **BATCH-01**: User can set a default category that applies to all items in the session
- [x] **BATCH-02**: User can set a default location that applies to all items in the session
- [x] **BATCH-03**: User sees a batch settings bar showing current category/location defaults
- [x] **BATCH-04**: Batch settings persist across items but reset when session ends

### Offline & Sync

- [x] **SYNC-01**: Quick capture works fully offline — items queued in IndexedDB
- [x] **SYNC-02**: Photos stored as blobs in IndexedDB for offline display
- [x] **SYNC-03**: Photos upload automatically after item syncs to server (chained sync)
- [x] **SYNC-04**: Offline-captured items appear in item list with pending indicator

### Completion Workflow

- [x] **COMP-01**: Quick-captured items are flagged as "needs details" in the database
- [x] **COMP-02**: User can filter item list to show only "needs details" items
- [x] **COMP-03**: User can mark an item as complete (remove "needs details" flag)
- [ ] **COMP-04**: User sees session summary when ending quick capture (count + thumbnails)

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Batch Enhancements

- **BATCH-05**: Barcode scanning integration in quick capture (scan barcode → auto-fill name from lookup)
- **BATCH-06**: Voice-to-text for item naming (hands-free capture)

### Import Integration

- **IMP-01**: CSV-imported items with missing fields flagged as "needs details"

## Out of Scope

| Feature | Reason |
|---------|--------|
| Capture without photo (name-only) | Camera-first is the core value prop; regular wizard handles text-only |
| Location auto-creation during capture | Cross-entity dependency adds sync complexity; pick from existing list |
| Inventory entry during capture | Inventory is a separate entity with quantity/status; capture is for item catalog |
| AI-based item recognition from photo | High complexity, API dependency, not core to rapid capture |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| QC-01 | Phase 45 | Complete |
| QC-02 | Phase 45 | Complete |
| QC-03 | Phase 45 | Complete |
| QC-04 | Phase 45 | Complete |
| QC-05 | Phase 44 | Complete |
| QC-06 | Phase 45 | Complete |
| QC-07 | Phase 45 | Complete |
| QC-08 | Phase 45 | Complete |
| BATCH-01 | Phase 44 | Complete |
| BATCH-02 | Phase 44 | Complete |
| BATCH-03 | Phase 44 | Complete |
| BATCH-04 | Phase 44 | Complete |
| SYNC-01 | Phase 44 | Complete |
| SYNC-02 | Phase 44 | Complete |
| SYNC-03 | Phase 46 | Complete |
| SYNC-04 | Phase 46 | Complete |
| COMP-01 | Phase 43 | Complete |
| COMP-02 | Phase 43 | Complete |
| COMP-03 | Phase 43 | Complete |
| COMP-04 | Phase 47 | Pending |

**Coverage:**
- v1.9 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after Phase 43 completion (COMP-02, COMP-03 complete)*
