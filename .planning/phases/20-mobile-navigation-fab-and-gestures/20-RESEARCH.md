# Phase 20: Mobile Navigation - FAB and Gestures - Research

**Researched:** 2026-01-31
**Domain:** Floating action button (FAB), radial menu animations, touch gestures, haptic feedback
**Confidence:** HIGH

## Summary

This research covers implementing a floating action button with radial menu expansion, context-aware actions, long-press gestures for list item selection, and haptic feedback for mobile PWA. The primary stack is **motion v12.27.0** (formerly framer-motion) for animations with **use-long-press v3.x** for long-press detection, using CSS-based mobile breakpoint detection consistent with the existing codebase pattern.

The most critical finding is that **iOS Safari does not support the Vibration API**. The workaround is the **ios-haptics** library which uses a hidden `<input type="checkbox" switch>` element introduced in Safari 17.4+ to trigger native haptic feedback. For radial menu positioning, CSS trigonometric functions (`cos()`, `sin()`) or JavaScript-based polar coordinate calculations position menu items in an arc. The FAB should be positioned bottom-right with 16px margins, sized at 56px (or 48px mini), and must include proper ARIA attributes for accessibility.

**Primary recommendation:** Use motion for staggered radial animations, use-long-press for gesture detection, ios-haptics for cross-platform haptic feedback, and implement context-aware actions via `usePathname()` from next-intl (already in use).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | ^12.27.0 | Animation library | Already at this version in project description, stagger() for radial menu, variants for state management |
| use-long-press | ^3.2.0 | Long press gesture detection | Dedicated hook with threshold, callbacks, touch+mouse support |
| ios-haptics | ^1.0.0 | Cross-platform haptic feedback | Works on iOS 17.4+ via checkbox hack, falls back to navigator.vibrate on Android |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-visually-hidden | ^1.2.4 | Screen reader only text | Already installed - use for icon-only button labels |
| next-intl | ^4.7.0 | Route detection via navigation hooks | Already installed - `usePathname()` for context-aware actions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| use-long-press | @use-gesture/react useDrag with delay | More complex setup, no dedicated long-press API |
| use-long-press | React Aria useLongPress | Better accessibility but adds Adobe dependency |
| ios-haptics | Raw navigator.vibrate | No iOS support at all |
| motion | CSS animations only | Less control over staggering, exit animations harder |

**Installation:**
```bash
bun add motion use-long-press ios-haptics
```

**Note:** motion v12.27.0 is a drop-in replacement for framer-motion. Import from `motion/react`.

## Architecture Patterns

### Recommended Project Structure
```
components/
├── fab/
│   ├── floating-action-button.tsx   # Main FAB component with radial menu
│   ├── fab-action-item.tsx          # Individual menu action with animation
│   ├── fab-context.tsx              # Context for FAB state management
│   └── use-fab-actions.ts           # Hook for context-aware action configuration
├── list/
│   └── selectable-list-item.tsx     # List item with long-press selection
lib/
├── hooks/
│   └── use-haptic.ts                # Haptic feedback utility hook
```

### Pattern 1: FAB with Radial Menu using Motion Variants
**What:** Staggered radial animation using motion variants and CSS trigonometric positioning.
**When to use:** For the FAB radial expansion animation.
**Example:**
```typescript
// Source: motion.dev/docs/stagger + una.im/radial-menu
"use client";

import { motion, stagger } from "motion/react";
import { useState } from "react";
import { Plus, X, ScanLine, Package, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "ios-haptics";

interface FABAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const containerVariants = {
  closed: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 }
  },
  open: {
    transition: { delayChildren: 0.1, staggerChildren: 0.07 }
  }
};

const itemVariants = {
  closed: {
    opacity: 0,
    scale: 0,
    transition: { duration: 0.15 }
  },
  open: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 25 }
  }
};

export function FloatingActionButton({ actions }: { actions: FABAction[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const radius = 80; // Distance from center
  const startAngle = -Math.PI / 2; // Start from top
  const arcAngle = Math.PI / 2; // 90 degree arc

  const toggle = () => {
    haptic(); // Trigger haptic on toggle
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 md:hidden">
      <motion.div
        initial={false}
        animate={isOpen ? "open" : "closed"}
        variants={containerVariants}
        className="relative"
      >
        {/* Radial action items */}
        {actions.map((action, index) => {
          const angle = startAngle - (arcAngle / (actions.length - 1)) * index;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={action.id}
              variants={itemVariants}
              className="absolute"
              style={{
                left: `calc(50% + ${x}px - 22px)`,
                top: `calc(50% + ${y}px - 22px)`,
              }}
            >
              <Button
                size="icon"
                variant="secondary"
                className="h-11 w-11 rounded-full shadow-lg"
                onClick={() => {
                  haptic();
                  action.onClick();
                  setIsOpen(false);
                }}
                aria-label={action.label}
              >
                {action.icon}
              </Button>
            </motion.div>
          );
        })}

        {/* Main FAB button */}
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={isOpen ? "Close menu" : "Open actions"}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="h-6 w-6" />
          </motion.div>
        </Button>
      </motion.div>
    </div>
  );
}
```

### Pattern 2: Context-Aware FAB Actions
**What:** Different FAB actions based on current route using usePathname.
**When to use:** For context-sensitive quick actions.
**Example:**
```typescript
// Source: next-intl navigation API
"use client";

import { usePathname } from "@/i18n/navigation";
import { ScanLine, Package, HandCoins, Plus, Box, MapPin } from "lucide-react";

interface FABActionConfig {
  id: string;
  icon: React.ReactNode;
  label: string;
  href?: string;
  action?: () => void;
}

export function useFABActions(): FABActionConfig[] {
  const pathname = usePathname();

  // Default actions available everywhere
  const baseActions: FABActionConfig[] = [
    { id: "scan", icon: <ScanLine className="h-5 w-5" />, label: "Scan", href: "/dashboard/scan" },
    { id: "add-item", icon: <Package className="h-5 w-5" />, label: "Add Item", href: "/dashboard/items/new" },
    { id: "log-loan", icon: <HandCoins className="h-5 w-5" />, label: "Log Loan", href: "/dashboard/loans/new" },
  ];

  // Route-specific actions
  if (pathname === "/dashboard/items" || pathname.startsWith("/dashboard/items/")) {
    return [
      { id: "add-item", icon: <Plus className="h-5 w-5" />, label: "Add Item", href: "/dashboard/items/new" },
      ...baseActions.filter(a => a.id !== "add-item"),
    ];
  }

  if (pathname === "/dashboard/inventory") {
    return [
      { id: "quick-count", icon: <Package className="h-5 w-5" />, label: "Quick Count", action: () => {} },
      ...baseActions,
    ].slice(0, 5); // Max 5 actions
  }

  if (pathname === "/dashboard/containers") {
    return [
      { id: "add-container", icon: <Box className="h-5 w-5" />, label: "Add Container", href: "/dashboard/containers/new" },
      ...baseActions,
    ].slice(0, 5);
  }

  if (pathname === "/dashboard/locations") {
    return [
      { id: "add-location", icon: <MapPin className="h-5 w-5" />, label: "Add Location", href: "/dashboard/locations/new" },
      ...baseActions,
    ].slice(0, 5);
  }

  return baseActions;
}
```

### Pattern 3: Long-Press for Multi-Select Mode
**What:** Long-press gesture to enter multi-select mode on list items.
**When to use:** For bulk selection in item lists.
**Example:**
```typescript
// Source: use-long-press npm documentation
"use client";

import { useLongPress } from "use-long-press";
import { useState, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { haptic } from "ios-haptics";

interface SelectableListItemProps {
  id: string;
  children: React.ReactNode;
  selectionMode: boolean;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onEnterSelectionMode: () => void;
}

export function SelectableListItem({
  id,
  children,
  selectionMode,
  selected,
  onSelect,
  onEnterSelectionMode,
}: SelectableListItemProps) {
  const longPressHandlers = useLongPress(
    () => {
      haptic(); // Haptic feedback on long press
      onEnterSelectionMode();
      onSelect(id, true);
    },
    {
      threshold: 500, // 500ms to trigger
      cancelOnMovement: 25, // Cancel if moved more than 25px
      detect: "touch", // Touch only (not mouse)
    }
  );

  const handleClick = useCallback(() => {
    if (selectionMode) {
      haptic();
      onSelect(id, !selected);
    }
  }, [selectionMode, selected, id, onSelect]);

  return (
    <div
      {...longPressHandlers()}
      onClick={handleClick}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
      role="listitem"
      aria-selected={selected}
    >
      {selectionMode && (
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(id, checked === true)}
          aria-label={`Select item ${id}`}
        />
      )}
      {children}
    </div>
  );
}
```

### Pattern 4: Haptic Feedback Hook
**What:** Cross-platform haptic feedback utility.
**When to use:** For all touch feedback in the app.
**Example:**
```typescript
// Source: ios-haptics GitHub + MDN navigator.vibrate
"use client";

import { haptic as iosHaptic } from "ios-haptics";

export function useHaptic() {
  const triggerHaptic = (pattern: "tap" | "success" | "error" = "tap") => {
    switch (pattern) {
      case "success":
        iosHaptic.confirm();
        break;
      case "error":
        iosHaptic.error();
        break;
      case "tap":
      default:
        iosHaptic();
    }
  };

  return { triggerHaptic };
}

// Direct usage without hook (for simpler cases)
export function triggerHaptic(durationMs: number = 20): void {
  iosHaptic();
}
```

### Anti-Patterns to Avoid
- **Using `navigator.vibrate()` directly:** No iOS support. Always use ios-haptics wrapper.
- **Hardcoding radial positions:** Use Math.cos/sin for dynamic positioning based on item count.
- **FAB visible on desktop:** Hide with `md:hidden` class, follows existing codebase pattern.
- **Too many FAB actions:** Maximum 5-6 items. Requirements specify 3-5.
- **Swipe gestures for selection:** Accessibility issues. Use long-press instead (per requirements).
- **Missing ARIA attributes on FAB:** Must have `role="menu"`, `aria-expanded`, `aria-label`.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Long press detection | setTimeout + pointer events | use-long-press | Handles touch vs mouse, movement cancellation, prevents context menu |
| iOS haptic feedback | navigator.vibrate | ios-haptics | Safari requires checkbox switch workaround |
| Staggered animations | Manual delays | motion staggerChildren | Handles enter/exit, spring physics, cleanup |
| Radial positioning | Fixed translate values | Math.cos/sin calculation | Scales to any number of items |
| Mobile detection | window.matchMedia hook | CSS `md:hidden` | Already pattern in codebase, no hydration mismatch |

**Key insight:** Touch gestures have many edge cases (context menu prevention, scroll interference, multi-touch) that dedicated libraries handle correctly.

## Common Pitfalls

### Pitfall 1: iOS Safari No Vibration API Support
**What goes wrong:** `navigator.vibrate()` does nothing on iOS.
**Why it happens:** WebKit intentionally does not implement the Vibration API.
**How to avoid:**
- Use ios-haptics library which uses hidden checkbox switch workaround
- Works on iOS 17.4+ (Safari 17.4)
- Falls back to navigator.vibrate on Android
**Warning signs:** QA reports "haptic works on Android but not iPhone"

### Pitfall 2: Radial Menu Accessibility
**What goes wrong:** Screen readers can't navigate radial menu, keyboard users stuck.
**Why it happens:** Radial layout doesn't map to linear keyboard navigation.
**How to avoid:**
- Add `role="menu"` to container, `role="menuitem"` to actions
- Implement arrow key navigation (up/down cycles through items)
- Add `aria-label` to all icon buttons
- Provide skip link or keyboard shortcut to access FAB
- Consider alternative linear layout for reduced motion preference
**Warning signs:** VoiceOver announces "button" without context

### Pitfall 3: Long Press Triggering on Scroll
**What goes wrong:** Scrolling triggers long-press callback.
**Why it happens:** Touch start fires before scroll intent is detected.
**How to avoid:**
- Use `cancelOnMovement: 25` option in use-long-press
- This cancels if finger moves more than 25px
**Warning signs:** Users accidentally entering selection mode while scrolling

### Pitfall 4: FAB Blocking Content
**What goes wrong:** FAB covers important UI elements at bottom of lists.
**Why it happens:** Fixed positioning + long lists.
**How to avoid:**
- Add bottom padding to scrollable containers when FAB is visible
- Consider hiding FAB on scroll down, showing on scroll up
- Ensure list items have enough bottom margin for last item visibility
**Warning signs:** Users complain they can't tap last list item

### Pitfall 5: Animation Performance on Low-End Devices
**What goes wrong:** Radial menu animation stutters, janky.
**Why it happens:** Too many animated properties, no GPU acceleration.
**How to avoid:**
- Only animate transform and opacity (GPU accelerated)
- Use `will-change: transform` sparingly
- Respect `prefers-reduced-motion` media query
- Test on older devices
**Warning signs:** Frame drops visible during FAB open/close

### Pitfall 6: Context Menu Interfering with Long Press
**What goes wrong:** Browser context menu appears on long press.
**Why it happens:** Native long-press triggers context menu on many browsers.
**How to avoid:**
- use-long-press handles this automatically
- If using custom implementation, add `onContextMenu={(e) => e.preventDefault()}`
**Warning signs:** Context menu appears when trying to select items

## Code Examples

Verified patterns from official sources:

### Motion Stagger with delayChildren
```typescript
// Source: motion.dev/docs/stagger
import { motion, stagger } from "motion/react";

const menuVariants = {
  open: {
    transition: {
      delayChildren: stagger(0.07, { startDelay: 0.1 }),
    },
  },
  closed: {
    transition: {
      delayChildren: stagger(0.05, { from: "last" }),
    },
  },
};

const itemVariants = {
  open: { opacity: 1, y: 0 },
  closed: { opacity: 0, y: 20 },
};

function Menu({ isOpen, children }) {
  return (
    <motion.ul
      initial="closed"
      animate={isOpen ? "open" : "closed"}
      variants={menuVariants}
    >
      {React.Children.map(children, (child) => (
        <motion.li variants={itemVariants}>{child}</motion.li>
      ))}
    </motion.ul>
  );
}
```

### Radial Positioning with CSS Trig
```css
/* Source: una.im/radial-menu - CSS trigonometry approach */
.radial-item {
  --radius: 80px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform:
    translateX(calc(cos(var(--angle)) * var(--radius) - 50%))
    translateY(calc(sin(var(--angle) * -1) * var(--radius) - 50%));
}

.radial-item:nth-child(1) { --angle: 180deg; }
.radial-item:nth-child(2) { --angle: 135deg; }
.radial-item:nth-child(3) { --angle: 90deg; }
```

### use-long-press Basic Usage
```typescript
// Source: use-long-press npm package
import { useLongPress } from "use-long-press";

const handlers = useLongPress(
  () => console.log("Long pressed!"),
  {
    threshold: 500,
    cancelOnMovement: 25,
    onStart: () => console.log("Press started"),
    onFinish: () => console.log("Press finished"),
    onCancel: () => console.log("Press cancelled"),
  }
);

return <button {...handlers()}>Press and hold me</button>;
```

### ios-haptics Usage
```typescript
// Source: github.com/tijnjh/ios-haptics
import { haptic } from "ios-haptics";

haptic();           // Single pulse
haptic.confirm();   // Two rapid pulses (success)
haptic.error();     // Three rapid pulses (error)
```

### FAB Accessibility Pattern
```typescript
// Source: web.dev/articles/building/a-fab-component + MDN ARIA
<div role="group" aria-label="Quick actions">
  <button
    aria-expanded={isOpen}
    aria-haspopup="menu"
    aria-label={isOpen ? "Close quick actions menu" : "Open quick actions menu"}
    onClick={toggle}
  >
    <Plus aria-hidden="true" />
  </button>

  <div role="menu" aria-label="Quick actions" hidden={!isOpen}>
    <button role="menuitem" aria-label="Scan barcode">
      <ScanLine aria-hidden="true" />
    </button>
    <button role="menuitem" aria-label="Add new item">
      <Package aria-hidden="true" />
    </button>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| framer-motion package | motion package | 2025 (v12) | Same API, new name, smaller bundle |
| navigator.vibrate on iOS | ios-haptics checkbox workaround | Safari 17.4 (March 2024) | iOS finally has web haptics |
| JS media queries for mobile | CSS `md:hidden` classes | Tailwind v3+ | No hydration mismatch, simpler |
| Manual stagger delays | stagger() function | motion v12 | Cleaner API, dynamic stagger |
| aria-role="menu" overuse | Semantic button groups | WCAG 2.2 | Only use menu role for app-like menus |

**Deprecated/outdated:**
- **framer-motion package name:** Renamed to motion. framer-motion still works but motion is preferred.
- **react-use-gesture:** Replaced by @use-gesture/react in v10.
- **quaggaJS:** Abandoned, don't use for any touch gesture handling.

## Open Questions

Things that couldn't be fully resolved:

1. **iOS 17.4+ Adoption Rate**
   - What we know: ios-haptics requires Safari 17.4+ (March 2024) for haptic to work
   - What's unclear: What percentage of iOS users have updated
   - Recommendation: Implement with graceful fallback (no haptic is acceptable, not a blocker)

2. **CSS Trigonometry Browser Support**
   - What we know: `cos()` and `sin()` have good modern browser support
   - What's unclear: Edge cases on older iOS Safari versions
   - Recommendation: Use JavaScript calculation as primary, it's more explicit anyway

3. **Exact Touch Target Size for FAB**
   - What we know: Requirements say 44px minimum, Material Design says 56px standard
   - What's unclear: Whether 48px mini variant is acceptable
   - Recommendation: Use 56px for main FAB, 44px for radial menu items (matches 44px requirement)

## Sources

### Primary (HIGH confidence)
- [Motion stagger documentation](https://motion.dev/docs/stagger) - Official API for staggerChildren
- [MDN Navigator.vibrate()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) - Browser support table
- [ios-haptics GitHub](https://github.com/tijnjh/ios-haptics) - Safari checkbox workaround details
- [use-long-press npm](https://www.npmjs.com/package/use-long-press) - Long press hook API
- [web.dev FAB component](https://web.dev/articles/building/a-fab-component) - Accessibility patterns

### Secondary (MEDIUM confidence)
- [una.im radial menu](https://una.im/radial-menu/) - CSS trig positioning pattern
- [Motion for React installation](https://motion.dev/docs/react) - motion package setup
- [MDN ARIA menu role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menu_role) - Accessibility requirements
- [Mobbin FAB best practices](https://mobbin.com/glossary/floating-action-button) - UX positioning guidance

### Tertiary (LOW confidence)
- WebSearch results for iOS 18 haptic status - needs device testing
- FAB scroll-hide behavior - needs prototyping to validate UX

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - motion v12.27.0 confirmed, use-long-press and ios-haptics verified via GitHub/npm
- Architecture: HIGH - Patterns based on existing codebase (usePathname, md:hidden) and official docs
- Pitfalls: HIGH - iOS vibration limitation well-documented, accessibility patterns from W3C/MDN

**Research date:** 2026-01-31
**Valid until:** 60 days (libraries stable, iOS Safari evolving slowly)
