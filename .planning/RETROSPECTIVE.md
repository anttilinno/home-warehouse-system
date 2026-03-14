# Project Retrospective: Home Warehouse System

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.9 — Quick Capture

**Shipped:** 2026-03-14
**Phases:** 5 (43-47) | **Plans:** 9

### What Was Built

- Backend `needs_review` schema + filter API + PATCH mark-complete threaded through all layers
- IndexedDB v5 `quickCapturePhotos` blob store, auto-SKU hook, batch session context
- Camera-first `QuickCapturePage` — single-route for iOS permission persistence, save-reset loop, haptic/audio feedback
- Photo sync pipeline with temp→real ID resolution, per-photo retry, failed-status pattern
- Session summary sheet, Needs Review filter chip, amber banner + Mark as Reviewed

### What Worked

- **Research-first for iOS camera constraints** — discovering the single-route requirement early shaped the entire phase 45 architecture and avoided a major rework
- **Pre-write pattern for retry** — writing `resolvedItemId` to all photos before the upload loop made retry completely stateless; elegant solution to a hard distributed-systems problem
- **Zero new npm deps** — building on existing stack (AudioContext, ios-haptics, IndexedDB) avoided dependency debt
- **Chaining via events** — `MUTATION_SYNCED` event from OfflineContext as the trigger for photo upload kept concerns cleanly separated

### What Was Inefficient

- **Tech debt in tests** — pre-existing test failures (6 total) were carried forward again without being fixed; these slow down future audits
- **Nyquist validation skipped for phases 43-45** — VALIDATION.md files were only partially created; retroactive validation is available but adds friction

### Patterns Established

- **Per-photo delete pattern** — delete IndexedDB record individually on success; mark `status=failed` with `resolvedItemId` on failure; status-index retry
- **`|| undefined` for optional query params** — avoids spurious `?param=false` in URLs (pass `value || undefined` not `value ?? false`)
- **Mutual exclusion via reset** — when toggling Needs Review filter, reset Show Archived (and vice versa) rather than combining
- **i18n parity rule** — every key added to en.json must be simultaneously added to et.json and ru.json in the same commit

### Key Lessons

1. **Single-route for camera-first flows on iOS** — iOS PWA camera permissions reset on navigation; any camera-heavy feature must stay on one route
2. **Separate photo queue from mutation queue** — photo blobs in a dedicated IndexedDB store with chained upload after item sync is cleaner than attempting to queue photos alongside mutations
3. **Pre-write before loops** — when processing a list of items that could fail mid-loop, write all state (resolvedItemId, status) before starting the loop so interruption leaves the system in a retryable state

### Cost Observations

- Zero new npm dependencies — no bundle growth for v1.9
- Notable: Phases 46 and 47 each completed in a single session from plan to verification

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1 | 5 | 14 | Initial offline PWA foundation |
| v1.1 | 6 | 12 | Entity extension pattern established |
| v1.2 | 6 | 19 | Repair log + bulk photo patterns |
| v1.3 | 4 | 22 | Mobile-first UX patterns (FAB, barcode, fuzzy search) |
| v1.4 | 5 | 20 | Test infrastructure + CI parallelization |
| v1.5 | 3 | 9 | Settings hub architecture |
| v1.6 | 5 | 9 | Format personalization hooks pattern |
| v1.7 | 5 | 7 | Modular iOS-style settings |
| v1.8 | 3 | 7 | Backend-driven OAuth, zero-NextAuth philosophy |
| v1.9 | 5 | 9 | Camera-first offline capture, photo sync pipeline |

### Top Lessons (Validated Across Milestones)

1. **Research constraints before building UI** — v1.3 (iOS camera), v1.8 (OAuth redirect), v1.9 (camera permissions) all benefited from pre-build research discovering non-obvious platform constraints
2. **Zero new dependencies where possible** — every milestone has maintained this discipline; existing stack (IndexedDB, Web APIs, existing libs) covers most needs
3. **Single-source i18n** — always add en/et/ru translation keys in the same commit to prevent parity drift
4. **IndexedDB version guard pattern** — `if (oldVersion < X)` upgrade guards are reliable and repeatable across schema changes
