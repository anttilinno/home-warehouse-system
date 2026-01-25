---
phase: 04-pwa-screenshots-polish
plan: 01
subsystem: pwa
tags: [pwa, screenshots, playwright, manifest]

dependency-graph:
  requires: [03-03]  # Requires complete offline PWA functionality
  provides: [pwa-screenshots, screenshot-generation-script]
  affects: []  # Final plan, no downstream dependencies

tech-stack:
  added: []  # Used existing Playwright infrastructure
  patterns:
    - "Standalone Playwright script for screenshot generation"
    - "Headless browser automation for reproducible captures"

key-files:
  created:
    - frontend/e2e/scripts/generate-screenshots.ts
    - frontend/public/screenshots/mobile-dashboard.png
    - frontend/public/screenshots/desktop-inventory.png
  modified: []

decisions:
  - id: screenshot-wait-strategy
    choice: "domcontentloaded + wait for main + 2s delay"
    rationale: "networkidle times out due to continuous API polling; explicit waits are more reliable"
  - id: device-scale-factor
    choice: "deviceScaleFactor: 1"
    rationale: "Matches manifest.json sizes exactly (1080x1920, 1920x1080)"

metrics:
  duration: "6m"
  completed: "2026-01-24"
---

# Phase 04 Plan 01: PWA Screenshot Generation Summary

Automated PWA screenshot generation using Playwright for manifest install prompts.

## What Was Built

### Screenshot Generation Script
Created `/frontend/e2e/scripts/generate-screenshots.ts` that:
- Uses Playwright Chromium in headless mode
- Authenticates via existing storage state (`playwright/.auth/user.json`)
- Captures mobile dashboard view (1080x1920, narrow form factor)
- Captures desktop inventory view (1920x1080, wide form factor)
- Outputs directly to `/frontend/public/screenshots/`

### Generated Screenshots
- `mobile-dashboard.png` - 1080x1920, 87KB - Dashboard view for mobile PWA install
- `desktop-inventory.png` - 1920x1080, 80KB - Items page for desktop PWA install

## Implementation Details

### Script Design
```typescript
// Key configuration
const SCREENSHOTS = [
  {
    name: "mobile-dashboard",
    path: "/en/dashboard",
    viewport: { width: 1080, height: 1920 },
    isMobile: true,
  },
  {
    name: "desktop-inventory",
    path: "/en/dashboard/items",
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
  },
];
```

### Wait Strategy
Used `domcontentloaded` followed by explicit waits:
1. Wait for `main` element visible
2. Wait for `load` state
3. Wait for loading indicators to disappear
4. 2-second delay for animations/lazy content

This approach is more reliable than `networkidle` which times out due to SSE connections and periodic API polling.

## How to Regenerate Screenshots

1. Ensure backend and frontend are running
2. Ensure auth state is current: `npx playwright test auth.setup.ts --project=setup`
3. Run: `cd frontend && npx tsx e2e/scripts/generate-screenshots.ts`

## Verification

All success criteria met:
- [x] Screenshot generation script exists
- [x] mobile-dashboard.png: 1080x1920 dimensions
- [x] desktop-inventory.png: 1920x1080 dimensions
- [x] Script is re-runnable
- [x] manifest.json references correct paths

## Commits

| Commit | Description |
|--------|-------------|
| 3de6e80 | feat(04-01): add PWA screenshot generation script |
| 2acbfa1 | feat(04-01): add PWA manifest screenshots |

## Deviations from Plan

None - plan executed exactly as written.

## Phase 04 Status

Plan 01 complete. Optional Phase 4 (PWA Screenshots & Polish) is now complete.
