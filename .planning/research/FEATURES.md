# Feature Landscape: Quick Capture / Rapid Item Entry (v1.9)

**Domain:** Mobile-first bulk item onboarding for home inventory PWA
**Researched:** 2026-02-27
**Confidence:** HIGH (builds entirely on existing infrastructure)

## Existing Infrastructure

Key assets already in place that reduce scope significantly:

- **`InlinePhotoCapture`** component with camera (`capture="environment"`) and gallery, auto-compression (>2MB to 1920x1920 JPEG 0.85)
- **`CreateItemWizard`** 3-step wizard (Basic -> Details -> Photos) using `MultiStepForm`
- **`useOfflineMutation`** hook with IndexedDB queue, optimistic UI, dependency-aware sync
- **`useFABActions`** hook with context-aware radial menu actions per route
- **`useFormDraft`** hook for IndexedDB-based form draft persistence
- **Item schema** only requires `sku` (auto-generatable) and `name` -- all other fields optional
- **Backend auto-SKU** pattern exists in import worker (`AUTO-{name}-{timestamp}`) and pendingchange service (`SKU = "AUTO"`)
- **Photo upload queue** already works offline via service worker
- **Category/location data** cached in IndexedDB for offline access

**No `needs_details` column exists** on `warehouse.items` -- this requires a new DB migration.

---

## Table Stakes

Features users expect in a rapid capture mode. Missing any of these makes the feature feel broken or pointless compared to just using the existing wizard.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| Camera-first entry point | Every competitor (Everspruce, Sortly, Mobile Inventory) opens camera immediately in quick-add modes. Users expect "tap button, camera opens" with zero intermediate screens. | Low | Reuse `InlinePhotoCapture` with `capture="environment"`. Single new page at `/dashboard/items/capture`. |
| Auto-generated SKU | SKU is `VARCHAR(50) NOT NULL`, unique per workspace, but users should never type one during rapid capture. Typing a SKU per item kills the flow entirely. | Low | Client-side `QC-{timestamp}-{random}` pattern. Backend `pendingchange` service already accepts `SKU = "AUTO"` for offline creates. Import worker uses `AUTO-{name}-{timestamp}`. |
| Minimal required fields | Only photo + name should be mandatory. Asking for category, brand, serial number etc. during rapid capture defeats the purpose. | Low | Existing `createItemSchema` already only requires `sku` and `name`. Quick capture auto-fills SKU, so only `name` needs user input. |
| Save-and-next loop | After saving one item, immediately return to camera for the next item. No navigation away, no confirmation screen that requires dismissal. This IS the core value prop. | Medium | Cannot reuse `MultiStepForm` (navigates away on submit via `router.push`). Needs dedicated `QuickCaptureForm` component with internal state reset. |
| Item counter / session progress | Show "5 items captured" so users know their batch is progressing. Without this, users lose track and the experience feels disconnected. | Low | New UI element, React state counter, no backend dependency. |
| Offline support | Users capture items while walking around a warehouse/garage with no signal. This app's core value is offline-first. | Medium | Wire through existing `useOfflineMutation` with entity `items`, operation `create`. Photo queuing already handled by service worker. |
| Photo compression | Phone cameras produce 3-8MB images. Without compression, offline storage fills up fast and uploads are slow. | Low | Already built in `InlinePhotoCapture` via `compressImage()`. No new work needed. |

---

## Differentiators

Features that transform quick capture from "slightly faster add button" into a genuinely different workflow. Not expected by users unfamiliar with Everspruce-style apps, but significantly improve the experience for bulk onboarding.

| Feature | Value Proposition | Complexity | Dependencies on Existing |
|---------|-------------------|------------|--------------------------|
| Sticky batch settings | Set location and category once at session start, apply to all items in the batch. Walking through kitchen? Set location="Kitchen" once, snap 20 items. Eliminates the most repetitive field selection in bulk entry. Everspruce has a similar concept with "photos per entry" but not location/category. | Medium | Existing category/location selector components reusable. Batch settings in React state. Optionally persist to IndexedDB via `useFormDraft` for crash recovery. |
| "Needs details" flag | Items created via quick capture get auto-flagged as incomplete. Explicit boolean column, not derived from empty fields. Enables the "capture now, detail later" workflow that makes quick capture actually useful beyond the moment of capture. | Medium | Requires new `needs_details BOOLEAN DEFAULT false` column on `warehouse.items`. DB migration + sqlc regen + backend API changes (filter parameter on list endpoint, set on create, clear on update). |
| "Needs details" filter on items list | Dedicated filter chip/tab on the items list page. Users sit down at their desk later and click "Needs Details" to see everything they quick-captured that day. Desktop completion workflow. | Low | Requires "needs details" flag to exist. Frontend filter chip using existing filter infrastructure (`useSavedFilters` hook exists). |
| Batch settings header bar | Persistent bar at top of quick capture screen showing current location + category with tap-to-change. Always visible so user knows context. Collapses to a single line when camera is active. | Low | New UI component. Category/location data available from IndexedDB for offline selection. |
| Session summary screen | After ending a quick capture session, show: "12 items captured, 3 photos queued for upload." Option to tap any item to open edit wizard. Gives closure to the capture session. | Low | New component. Items already in IndexedDB/state from individual saves during session. |
| Haptic + audio feedback on save | Satisfying vibration when an item is saved. Makes rapid capture feel responsive. Subtle enough to not annoy during a 50-item session. | Low | Already have `ios-haptics` and haptic patterns from barcode scanner (v1.3). Reuse `navigator.vibrate` / ios-haptics. |
| FAB integration | Add "Quick Capture" action to the floating action button radial menu. One tap to enter capture mode from items list or any dashboard page. | Low | Add new action to existing `useFABActions` hook. New icon (e.g., `Camera` from lucide-react). Route to `/dashboard/items/capture`. |
| Multi-photo per item | Allow 1-3 photos per item before moving to name entry. Useful for items needing multiple angles (front label + serial number on back). Everspruce allows 1-10 configurable. | Medium | `InlinePhotoCapture` currently handles single photo. Need to track `File[]` per item. Photo upload API already supports multiple photos per item via sequential `uploadItemPhoto` calls. |

---

## Anti-Features

Features to explicitly NOT build. Each has been considered and rejected with reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI image recognition / auto-categorization | High complexity, requires ML model/API (cost + latency), accuracy unreliable for diverse home goods, adds significant scope. | Sticky batch settings handle the common case (all items in one room share a category). Revisit AI as separate milestone. |
| Barcode scanning in quick capture | Quick capture targets items WITHOUT barcodes (household goods, tools, craft supplies). Barcode scanning already has dedicated flow at `/dashboard/scan` with "item not found -> create" path. Mixing flows adds confusion. | Keep barcode scan and quick capture as separate entry points. |
| Voice-to-name entry | Speech recognition unreliable in noisy environments (garage, workshop), browser API complexity, most names are 2-3 words faster to type. | Standard text input with large touch target (`min-h-[44px]`, `text-base` to prevent iOS zoom). |
| Batch editing after capture | Selecting multiple captured items and bulk-editing them. Separate feature from capture itself, adds significant UI complexity. | Ship "needs details" filter first. Bulk edit as follow-up milestone, building on existing bulk photo operations pattern. |
| Photo-only mode (no name) | Tempting "just snap, name later" but items with no name are useless in search, confusing in lists. API requires `name VARCHAR(200) NOT NULL`. | Require minimum a short name. Keep name input visible with large keyboard-friendly field immediately after photo capture. |
| Offline photo sync | Photos excluded from proactive sync by design (storage constraints, 50MB IndexedDB quota). Quick capture should not change this architectural decision. | Photos queue for upload when online, same as existing behavior. Show "X photos pending upload" indicator in session summary. |
| Full edit form in capture flow | Description, warranty, insurance fields during capture defeats the purpose of "rapid." | "Needs details" flag + filter enables desktop completion later via existing edit wizard. |
| Duplicate detection during capture | Checking if a similarly-named item already exists adds latency to each save and interrupts flow. | Duplicates can be caught during desktop "needs details" review. Offline Fuse.js search could power optional suggestions but should not block saves. |
| Configurable photos-per-item setting | Everspruce has this (1-10) but it adds settings complexity. Most users want 1 photo per item during rapid capture. | Default to 1 photo. Allow tapping "+" to add more within the capture screen, but no global setting. |

---

## Feature Dependencies

```
[DB Migration: needs_details column]
    (independent, do first -- filter depends on it)

[Camera-First Entry Point] ------> [Save-and-Next Loop]
[Auto-Generated SKU] ------------> [Save-and-Next Loop]
[Minimal Required Fields] -------> [Save-and-Next Loop]

[Save-and-Next Loop] ------------> [Offline Support] (each save uses useOfflineMutation)
[Save-and-Next Loop] ------------> [Item Counter] (counter increments on save)
[Save-and-Next Loop] ------------> [Haptic Feedback] (trigger on successful save)

[Sticky Batch Settings] ---------> [Batch Settings Header] (UI for batch settings)
[Sticky Batch Settings] ---------> [Save-and-Next Loop] (loop applies batch settings to each item)

[DB Migration] ------------------> ["Needs Details" Flag on Create]
["Needs Details" Flag on Create] -> ["Needs Details" Filter on Items List]

[Item Counter] ------------------> [Session Summary] (summary uses final count)
[Save-and-Next Loop] ------------> [Session Summary] (summary lists captured items)

[Quick Capture Page] ------------> [FAB Integration] (route must exist for FAB to link to)
```

### Dependency Notes

- **Save-and-next loop is the central feature.** Everything else feeds into or extends it. Build the loop first, then layer on batch settings and needs-details.
- **DB migration is independent.** The `needs_details` column can be added without touching the quick capture UI. Do it early so backend API filter is ready when frontend needs it.
- **Batch settings are session-scoped.** Stored in React state, optionally persisted to IndexedDB via `useFormDraft`. Do NOT persist across app restarts -- each session starts fresh with a fresh location/category selection.
- **FAB integration is last.** The quick capture page must exist before FAB can link to it.

---

## MVP Recommendation

### Phase 1 -- Core Quick Capture (must-ship, enables the workflow)

Prioritize these. Without all of them, the feature is not meaningfully different from the existing wizard.

1. **Camera-first entry point** -- New page at `/dashboard/items/capture`, camera trigger on mount
2. **Auto-generated SKU** -- Client-side `QC-{Date.now()}-{randomAlphanumeric(4)}`, unique enough for home use
3. **Minimal single-screen form** -- Photo preview + name input + save button, nothing else visible
4. **Save-and-next loop** -- On save: queue mutation, clear form, increment counter, re-trigger camera
5. **Item counter** -- "5 items captured" badge visible during session
6. **Offline support** -- Wire through `useOfflineMutation` for items + existing photo queue
7. **FAB integration** -- Add "Quick Capture" action to radial menu

### Phase 2 -- Batch Intelligence (high-value, reduces repetitive tapping)

1. **Sticky batch settings** -- Location + category picker shown before first capture
2. **Batch settings header** -- Persistent collapsible bar showing current location/category
3. **Haptic/audio feedback** -- Short vibration on successful save

### Phase 3 -- Completion Workflow (closes the loop, makes captured items useful)

1. **DB migration: `needs_details` column** -- `BOOLEAN DEFAULT false` on `warehouse.items`
2. **Auto-set `needs_details = true`** on items created via quick capture
3. **Backend filter** -- `?needs_details=true` parameter on items list endpoint
4. **"Needs details" filter chip** on items list page
5. **Session summary** -- End-of-session screen listing captured items with edit links

### Defer Entirely

- **Multi-photo per item** -- Adds UX complexity to the capture loop. Users can add photos later via edit wizard. Revisit based on feedback.
- **AI categorization** -- Separate research and milestone entirely.
- **Batch editing** -- Build on top of "needs details" filter in a future milestone.
- **Duplicate detection** -- Interrupts flow. Handle during desktop review.

---

## Complexity & Risk Assessment

| Feature | Effort | Risk | Notes |
|---------|--------|------|-------|
| Camera-first entry + save loop | 1-2 days | LOW | Reuses InlinePhotoCapture, straightforward React state machine |
| Auto-SKU generation | 0.5 days | LOW | Simple client-side generation, backend already handles AUTO prefix |
| Sticky batch settings | 1 day | LOW | Component state + optional IndexedDB draft persistence |
| "Needs details" flag (full stack) | 1-2 days | MEDIUM | DB migration, sqlc regen, Go handler change, frontend filter UI -- touches many layers |
| FAB integration | 0.5 days | LOW | Add one action to existing `useFABActions` hook |
| Session summary | 0.5-1 day | LOW | Read items from component state, simple list UI |
| Offline support wiring | 0.5 days | LOW | Existing `useOfflineMutation` infrastructure handles everything |
| iOS camera permissions | N/A | MEDIUM | `capture="environment"` works but PWA camera permissions volatile on iOS. Already mitigated by single-page approach from v1.3. Quick capture must stay on one page (no route changes during session). |
| Photo upload timing | N/A | LOW | Photos queue for background upload. Session summary should show pending count. Existing pending uploads indicator can be reused. |

---

## Key Technical Decisions

### Single-page capture, not wizard

Quick capture MUST be a single-screen flow. The existing `MultiStepForm` navigates between steps, validates per-step, and redirects on submit (`router.push(/dashboard/items/${item.id})`). Quick capture needs: camera -> name input -> save -> camera (same page, no navigation, no route changes). Build a dedicated `QuickCaptureForm` component that manages its own state machine:

```
States: READY -> CAPTURING -> NAMING -> SAVING -> READY (loop)
```

### Client-side SKU generation

Generate SKU on the client as `QC-{Date.now()}-{random4chars}` to avoid server round-trips. The `UNIQUE(workspace_id, sku)` constraint handles collisions. Timestamp-based ensures reasonable uniqueness. The existing offline create path accepts this pattern. Format: `QC-1709052000000-a3x7` (25 chars, well within VARCHAR(50) limit).

### "Needs details" as explicit DB column

While you could derive "needs details" from checking if description/brand/model are all empty, an explicit boolean is:
- **Queryable** -- efficient SQL filter without scanning nullable columns
- **Explicit** -- users can mark items "complete" after enrichment (UPDATE sets it to false)
- **Intent-clear** -- distinguishes "quick captured, needs work" from "intentionally minimal item"
- **Forward-compatible** -- if item completeness criteria change, the flag remains stable

### Batch settings are session-scoped

Stored in React state. Optionally persist to IndexedDB via `useFormDraft(quickCaptureBatch, sessionId)` so they survive accidental page refresh during a session. Do NOT persist across app restarts or new sessions. Each quick capture session starts with a location/category selection step (skippable).

### Photo handling matches existing pattern

Quick capture photos follow the same path as wizard photos: compress client-side, upload via `itemPhotosApi.uploadItemPhoto`. For offline, photos queue in the service worker. The item itself is created via `useOfflineMutation` (text data only). Photo upload happens separately, same as existing `CreateItemWizard` pattern. This means an item might exist in IndexedDB before its photo uploads -- this is already handled.

---

## Sources

- [Everspruce batch mode](https://everspruceapp.com/capturing-home-inventory-with-multiple-photos/) -- Photo-first batch capture, configurable photos per entry, "add details later" workflow
- [Everspruce home inventory](https://everspruceapp.com/best-home-inventory-app-for-iphone-and-ipad/) -- Market leader for home inventory quick capture
- [Sortly features](https://www.sortly.com/features/) -- Competitor features; limited mobile batch capabilities noted in reviews
- [UXPin inventory app design](https://www.uxpin.com/studio/blog/inventory-app-design/) -- UX patterns for inventory applications
- [UX Magazine default settings](https://uxmag.com/articles/the-ux-of-default-settings-in-a-product) -- Less than 5% of users change defaults; smart defaults matter
- [Toptal settings UX](https://www.toptal.com/designers/ux/settings-ux) -- Settings and preferences UX best practices
- Existing codebase analysis: `InlinePhotoCapture`, `MultiStepForm`, `useOfflineMutation`, `useFABActions`, `CreateItemWizard`, `useFormDraft`, item entity/schema, import worker auto-SKU pattern

---
*Feature research for: Quick Capture / Rapid Item Entry for Home Warehouse System v1.9*
*Researched: 2026-02-27*
