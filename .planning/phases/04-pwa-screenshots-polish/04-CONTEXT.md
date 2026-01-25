# Phase 4: PWA Screenshots & Polish - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Production-ready offline experience with PWA install screenshots, E2E tests for offline flows, and UI polish for error states and offline indicators. No new functionality — this polishes what exists from Phases 1-3.

</domain>

<decisions>
## Implementation Decisions

### Screenshot content
- Realistic mock data — home inventory items like "Drill", "Extension Cord" with quantities and locations
- Light mode only — clean, bright appearance for store listings
- Mobile screenshot (1080x1920): Full dashboard with data — items, locations, recent activity all populated
- Desktop screenshot (1920x1080): Item grid/list view — multiple items visible with details

### Error state messaging
- Clear and professional tone — "Unable to save changes. Check your connection and retry."
- Expandable technical details — show "Details" link that reveals error code/info
- Retry + dismiss actions — both "Try Again" and "Dismiss" options on errors
- Toast notifications — sync/network errors display as temporary popups

### E2E test scope
- Comprehensive coverage — all edge cases, error recovery, multi-tab scenarios
- Chromium only — fast, reliable, covers most users
- Binary offline/online — toggle network on/off (no slow network simulation)
- Fresh seed data each run — reset to known state before each test

### Offline indicator styling
- Subtle — small icon/badge, noticeable but not attention-grabbing
- Header/navbar area — positioned near sync status or app title
- Attention-getting transition — brief pulse or color flash when connectivity changes
- Icon only — cloud-off icon or similar, no text label

### Claude's Discretion
- Exact screenshot composition and layout
- Specific error message copy variations
- Test file organization and naming
- Animation timing and easing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for PWA screenshots and Playwright tests.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-pwa-screenshots-polish*
*Context gathered: 2026-01-24*
