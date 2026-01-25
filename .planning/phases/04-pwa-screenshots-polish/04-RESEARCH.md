# Phase 4: PWA Screenshots & Polish - Research

**Researched:** 2026-01-24
**Domain:** PWA screenshots, Playwright E2E testing, UI polish
**Confidence:** HIGH

## Summary

This research covers creating PWA screenshots for app store listings, E2E testing of offline flows with Playwright, and UI polish for offline indicators and error states.

The project already has a solid foundation with Playwright configured, PWA manifest with screenshot entries defined, Serwist service worker, and offline-related components including `OfflineIndicator`, `SyncStatusIndicator`, and `OfflineContext`. The screenshots directory exists but is empty.

For screenshots, Playwright can automate capture at exact viewport sizes. For offline testing, Playwright's `context.setOffline()` API enables network simulation. The existing Sonner toast integration supports action buttons for retry/dismiss functionality.

**Primary recommendation:** Use Playwright to generate screenshots programmatically with mock data, implement comprehensive offline E2E tests using `context.setOffline()`, and enhance the existing `OfflineIndicator` with subtle icon-only styling using Tailwind's `animate-ping` for attention-getting transitions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | ^1.57.0 | E2E testing, screenshot automation | Already in project, full network simulation support |
| Serwist | ^9.5.0 | Service worker, PWA caching | Already in project, handles offline caching |
| sonner | ^2.0.7 | Toast notifications | Already in project, supports action buttons |
| lucide-react | ^0.562.0 | Icons (CloudOff, etc.) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | ^4 | Animations, transitions | Already configured |
| tw-animate-css | ^1.4.0 | Additional animations | Already in devDependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright for screenshots | Manual browser screenshots | Playwright enables reproducible, automated captures |
| Custom animations | Framer Motion | Tailwind animations sufficient for subtle effects |

**Installation:**
No additional packages needed. All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── public/
│   └── screenshots/
│       ├── mobile-dashboard.png    # 1080x1920, form_factor: narrow
│       └── desktop-inventory.png   # 1920x1080, form_factor: wide
├── e2e/
│   ├── offline/
│   │   ├── offline-flows.spec.ts   # Offline mode E2E tests
│   │   └── sync.spec.ts            # Sync flow tests
│   └── scripts/
│       └── generate-screenshots.ts # Screenshot generation script
└── components/
    └── pwa/
        └── offline-indicator.tsx   # Enhanced offline indicator
```

### Pattern 1: Playwright Screenshot Generation
**What:** Automated screenshot capture with controlled viewport and mock data
**When to use:** Generating PWA screenshots for manifest
**Example:**
```typescript
// Source: https://playwright.dev/docs/screenshots
import { chromium } from '@playwright/test';

const browser = await chromium.launch();

// Mobile screenshot (1080x1920)
const mobileContext = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
});
const mobilePage = await mobileContext.newPage();
await mobilePage.goto('/en/dashboard');
await mobilePage.waitForLoadState('networkidle');
await mobilePage.screenshot({ path: 'public/screenshots/mobile-dashboard.png' });

// Desktop screenshot (1920x1080)
const desktopContext = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const desktopPage = await desktopContext.newPage();
await desktopPage.goto('/en/dashboard/items');
await desktopPage.waitForLoadState('networkidle');
await desktopPage.screenshot({ path: 'public/screenshots/desktop-inventory.png' });
```

### Pattern 2: Playwright Offline Mode Testing
**What:** Network simulation for offline E2E tests
**When to use:** Testing offline flows, sync behavior, error handling
**Example:**
```typescript
// Source: https://playwright.dev/docs/api/class-browsercontext#browser-context-set-offline
import { test, expect } from '@playwright/test';

test('app works offline after caching', async ({ page, context }) => {
  // Load page while online to cache data
  await page.goto('/en/dashboard');
  await page.waitForLoadState('networkidle');

  // Go offline
  await context.setOffline(true);

  // Verify offline indicator shows
  await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

  // Verify cached data still displays
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Go back online
  await context.setOffline(false);

  // Verify back online indicator
  await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
});
```

### Pattern 3: Sonner Toast with Action Buttons
**What:** Error toasts with retry and dismiss actions
**When to use:** Sync failures, network errors, recoverable errors
**Example:**
```typescript
// Source: https://sonner.emilkowal.ski/toast
import { toast } from 'sonner';

// Error with retry action
toast.error('Unable to save changes', {
  description: 'Check your connection and try again.',
  action: {
    label: 'Retry',
    onClick: () => handleRetry(),
  },
});

// With expandable details
toast.error('Sync failed', {
  description: (
    <div>
      <p>Check your connection and try again.</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs">Details</summary>
        <pre className="text-xs mt-1">{errorCode}</pre>
      </details>
    </div>
  ),
  action: {
    label: 'Retry',
    onClick: () => handleRetry(),
  },
});
```

### Pattern 4: Subtle Offline Indicator with Attention Transition
**What:** Icon-only indicator in header with pulse animation on state change
**When to use:** Showing network status without being intrusive
**Example:**
```typescript
// Using Tailwind animate-ping for attention transition
<span className="relative flex size-3">
  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
  <span className="relative inline-flex size-3 rounded-full bg-amber-500"></span>
</span>

// Or using CloudOff icon with transition
<CloudOff
  className={cn(
    "h-4 w-4 text-amber-500",
    isTransitioning && "animate-pulse"
  )}
/>
```

### Anti-Patterns to Avoid
- **Testing service worker cache directly:** Service worker cache API is async and flaky; test user-visible behavior instead
- **Hardcoded waits in offline tests:** Use `waitForSelector` or `waitForLoadState` instead of `setTimeout`
- **Full-page offline banners:** Too intrusive; use subtle header icon per user decision
- **Network throttling for offline tests:** Binary offline/online toggle per user decision

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network simulation | Custom fetch mocking | `context.setOffline()` | Playwright handles at browser level |
| Toast actions | Custom modal dialogs | Sonner action prop | Already integrated, handles dismiss |
| Pulse animations | Custom CSS keyframes | Tailwind `animate-ping` or `animate-pulse` | Built-in, well-tested |
| Screenshot automation | Manual captures | Playwright screenshot API | Reproducible, exact dimensions |

**Key insight:** Playwright provides comprehensive browser-level APIs for both screenshot generation and network simulation. No need for custom solutions.

## Common Pitfalls

### Pitfall 1: Service Worker Isolation in Tests
**What goes wrong:** Service workers persist across tests, causing flaky behavior
**Why it happens:** Playwright doesn't automatically clear service worker registrations
**How to avoid:** Each test should handle its own state; consider disabling service worker for most E2E tests
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 2: Screenshot Resolution Mismatch
**What goes wrong:** Screenshots appear blurry or wrong size in app stores
**Why it happens:** Using `deviceScaleFactor: 2` produces 2x dimensions; viewport doesn't match target
**How to avoid:** Set exact viewport dimensions (1080x1920, 1920x1080) with `deviceScaleFactor: 1`
**Warning signs:** Screenshot files have unexpected dimensions

### Pitfall 3: Offline State Detection Timing
**What goes wrong:** Offline indicator doesn't show immediately after `setOffline(true)`
**Why it happens:** Browser's `navigator.onLine` updates asynchronously
**How to avoid:** Wait for offline indicator visibility before asserting offline behavior
**Warning signs:** Tests timing out waiting for offline state

### Pitfall 4: Toast Duration Too Short
**What goes wrong:** Error toasts disappear before user can click retry
**Why it happens:** Default duration may be too short for error recovery actions
**How to avoid:** Use `duration: Infinity` or longer duration for error toasts with actions
**Warning signs:** Users report not being able to click action buttons

### Pitfall 5: PWA Manifest Screenshot Format
**What goes wrong:** Screenshots don't show in install prompt
**Why it happens:** Missing `form_factor`, wrong dimensions, or unsupported format
**How to avoid:** Use PNG format, include `form_factor: "narrow"` or `"wide"`, respect dimension constraints
**Warning signs:** Install prompt shows but without screenshots

## Code Examples

Verified patterns from official sources:

### PWA Manifest Screenshots Entry
```json
// Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/screenshots
{
  "screenshots": [
    {
      "src": "/screenshots/mobile-dashboard.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Dashboard view on mobile"
    },
    {
      "src": "/screenshots/desktop-inventory.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Inventory management on desktop"
    }
  ]
}
```

### Playwright Offline Test with Fresh State
```typescript
// Source: https://playwright.dev/docs/best-practices
import { test, expect } from '../fixtures/authenticated';

test.describe('Offline flows', () => {
  // Chromium only as per user decision
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only');

  test('shows offline indicator when network disconnected', async ({ page, context }) => {
    await page.goto('/en/dashboard');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Trigger network check (page reload or interaction)
    await page.reload().catch(() => {}); // Expect failure

    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
  });

  test('syncs pending changes when back online', async ({ page, context }) => {
    await page.goto('/en/dashboard');
    await page.waitForLoadState('networkidle');

    // Create some data while online
    // ...

    // Go offline
    await context.setOffline(true);

    // Make a change that will be queued
    // ...

    // Verify pending indicator
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('pending');

    // Go back online
    await context.setOffline(false);

    // Wait for sync
    await expect(page.locator('[data-testid="sync-status"]')).not.toContainText('pending');
  });
});
```

### Enhanced Offline Indicator Component
```typescript
// Pattern for subtle header icon with pulse on transition
"use client";

import { useState, useEffect } from "react";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function OfflineIndicatorIcon() {
  const { isOffline, wasOffline } = useNetworkStatus();
  const [showPulse, setShowPulse] = useState(false);

  // Show pulse animation when transitioning to offline
  useEffect(() => {
    if (isOffline) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="relative"
          data-testid="offline-indicator"
          role="status"
          aria-label="You are offline"
        >
          {showPulse && (
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-75" />
          )}
          <CloudOff className={cn(
            "h-4 w-4 text-amber-500",
            showPulse && "animate-pulse"
          )} />
        </div>
      </TooltipTrigger>
      <TooltipContent>You are offline</TooltipContent>
    </Tooltip>
  );
}
```

### Error Toast with Retry and Details
```typescript
// Pattern for professional error messaging
import { toast } from 'sonner';

interface SyncError {
  message: string;
  code?: string;
  details?: string;
}

export function showSyncError(error: SyncError, onRetry: () => void) {
  toast.error('Unable to save changes', {
    description: (
      <div className="space-y-1">
        <p>{error.message || 'Check your connection and try again.'}</p>
        {(error.code || error.details) && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Details
            </summary>
            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
              {error.code && `Code: ${error.code}\n`}
              {error.details}
            </pre>
          </details>
        )}
      </div>
    ),
    duration: 10000, // Longer for error recovery
    action: {
      label: 'Retry',
      onClick: onRetry,
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual PWA screenshots | Playwright automation | 2024 | Reproducible, exact dimensions |
| Full-page offline banners | Subtle header indicators | 2025 | Better UX, less intrusive |
| Custom network mocking | `context.setOffline()` | Playwright 1.x | Browser-level simulation |
| Alert dialogs for errors | Toast with actions | 2024 | Non-blocking, actionable |

**Deprecated/outdated:**
- Using `deviceScaleFactor: 2` for screenshots intended for stores (produces 2x size)
- Testing service worker internals directly (test user behavior instead)
- Complex network throttling for offline tests (binary toggle preferred)

## Open Questions

Things that couldn't be fully resolved:

1. **Mock data seeding for screenshots**
   - What we know: Screenshots need realistic data (Drill, Extension Cord, etc.)
   - What's unclear: How to seed consistent mock data for screenshot generation
   - Recommendation: Create a dedicated API endpoint or script to seed mock data before screenshot capture

2. **Multi-tab sync testing complexity**
   - What we know: User wants comprehensive multi-tab scenarios
   - What's unclear: Playwright context isolation may make multi-tab sync testing complex
   - Recommendation: Use `browser.newContext()` for each "tab" to simulate multi-tab behavior

## Sources

### Primary (HIGH confidence)
- [Playwright Screenshots Documentation](https://playwright.dev/docs/screenshots) - screenshot API, viewport, scale options
- [Playwright BrowserContext API](https://playwright.dev/docs/api/class-browsercontext) - setOffline(), network simulation
- [MDN PWA Manifest Screenshots](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/screenshots) - form_factor requirements
- [Tailwind CSS Animation](https://tailwindcss.com/docs/animation) - animate-ping, animate-pulse utilities
- [Sonner Toast Documentation](https://sonner.emilkowal.ski/toast) - action buttons, dismiss, duration

### Secondary (MEDIUM confidence)
- [web.dev Richer Install UI](https://web.dev/patterns/web-apps/richer-install-ui) - screenshot best practices
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) - test isolation, assertions

### Tertiary (LOW confidence)
- Various blog posts on PWA testing patterns (verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already in project
- Architecture: HIGH - patterns verified against official docs
- Pitfalls: HIGH - based on official documentation and issue trackers

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable domain)
