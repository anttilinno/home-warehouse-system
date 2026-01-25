# Project Milestones: Home Warehouse System

## v1.2 Phase 2 Completion (Shipped: 2026-01-25)

**Delivered:** Enhanced item lifecycle management with repair tracking, declutter assistant, async thumbnail processing, bulk photo operations, and comprehensive SSE test coverage.

**Phases completed:** 12-17 (19 plans total)

**Key accomplishments:**

- Repair log tracking with full lifecycle — photos, attachments, warranty claims, maintenance reminders
- Declutter assistant — unused item detection, scoring, grouping by category/location, CSV export
- Background thumbnail processing via Asynq — async generation, WebP output, multiple sizes
- Bulk photo operations — multi-select, bulk delete/caption, zip download, duplicate detection
- SSE test coverage — 47 tests across 11 handlers with EventCapture pattern
- Import testing checklist — 8 comprehensive manual test scenarios

**Stats:**

- 80 files created/modified
- ~9,000 lines of TypeScript/Go (net +8,948)
- 6 phases, 19 plans
- 1 day from start to ship (Jan 25, 2026)

**Git range:** `88d19c7` → `b702771` (41 commits)

**Tech debt carried forward:**
- Linear retry delay in thumbnail processing (vs exponential backoff)
- No VERIFICATION.md for Phase 17 (tests serve as verification)

**What's next:** v1.3 Mobile UX Overhaul — scanning, search, quick actions

---

## v1.1 Offline Entity Extension (Shipped: 2026-01-25)

**Delivered:** Offline create/update support for all core entities (borrowers, categories, locations, containers, inventory) with dependency-aware sync ordering and conflict history UI.

**Phases completed:** 6-11 (12 plans total)

**Key accomplishments:**

- Dependency-aware sync infrastructure with `dependsOn` field for prerequisite tracking
- Entity-type ordered sync processing (categories → locations → borrowers → containers → items → inventory)
- Topological sort (Kahn's algorithm) for hierarchical entities (categories, locations)
- Cross-entity dependency tracking for containers→locations and inventory→items/locations/containers
- Conflict history UI at `/dashboard/sync-history` with entity type and date range filtering
- Offline mutations for 5 entity types with optimistic UI and pending indicators

**Stats:**

- 25 files created/modified
- ~6,800 lines of TypeScript (net +4,700)
- 6 phases, 12 plans
- 2 days from start to ship (Jan 24-25, 2026)

**Git range:** `aaff4f3` → `3b4b6a8`

**Tech debt carried forward:**
- E2E tests blocked by auth setup timeout (test code correct, infrastructure issue)
- Modal edit and move dialog features not implemented
- Bulk status update uses direct API (not offline-enabled)

**What's next:** TBD — milestone complete, ready for next feature work

---

## v1 PWA Offline Completion (Shipped: 2026-01-24)

**Delivered:** Complete offline capabilities for the PWA — users can view all workspace data and create/update items while offline, with automatic sync on reconnection.

**Phases completed:** 1-5 (14 plans total)

**Key accomplishments:**

- IndexedDB offline storage with 8 entity stores and typed CRUD operations
- Mutation queue with UUIDv7 idempotency keys, exponential backoff retry, and 7-day TTL
- Conflict resolution with critical field detection (inventory quantity/status) and last-write-wins for non-critical
- PWA screenshots (1080x1920 mobile, 1920x1080 desktop) for install prompts
- Item forms migrated to offline mutation hooks with optimistic UI and pending indicators
- 17+ E2E tests covering offline flows, sync behavior, and multi-tab scenarios

**Stats:**

- 29 files created/modified
- ~5,200 lines of TypeScript
- 5 phases, 14 plans
- 2 days from start to ship (Jan 22-24, 2026)

**Git range:** `5c56812` → `b87dce7`

**Tech debt carried forward:**
- Conflict history UI not exposed (getConflictLog function exists)
- Safari iOS manual testing pending

**What's next:** TBD — milestone complete, ready for next feature work

---
