# UX Improvement Roadmap

**Last Updated:** 2026-01-14
**Frontend Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui

This document provides a comprehensive analysis of the Home Warehouse System frontend and prioritized UX improvement suggestions.

---

## Executive Summary

The Home Warehouse System has a solid foundation with modern technologies (Next.js 16, React 19, Tailwind 4, shadcn/ui). The current implementation includes:

✅ **Strengths:**
- Modern tech stack with excellent DX
- Comprehensive component library (shadcn/ui)
- Multi-language support (EN, ET, RU)
- Theme support (light/dark)
- Responsive design patterns
- Type-safe forms with validation
- Toast notifications for feedback
- Accessible Radix UI primitives

⚠️ **Areas for Improvement:**
- Accessibility gaps (ARIA labels, keyboard nav, focus management)
- Inconsistent empty states and error handling
- Loading state patterns need standardization
- Mobile UX needs optimization
- Advanced data visualization missing
- Onboarding/help system needed
- Search and filtering capabilities limited

---

## Priority Matrix

| Priority | Category | Items |
|----------|----------|-------|
| **Critical** | Accessibility | WCAG 2.1 AA compliance, keyboard nav, focus management |
| **Critical** | Error Handling | Consistent error states, offline handling, retry mechanisms |
| **High** | Loading States | Skeleton consistency, optimistic updates, progress indicators |
| **High** | Mobile UX | Touch targets, bottom sheets, swipe gestures |
| **High** | Search/Filter | Global search, advanced filters, fuzzy search |
| **Medium** | Data Viz | Charts, analytics dashboards, export previews |
| **Medium** | Onboarding | Guided tours, tooltips, help system |
| **Low** | Polish | Animations, micro-interactions, haptic feedback |

---

## Critical Priority

### 1. Accessibility Compliance (WCAG 2.1 AA)

**Current State:** Partial accessibility - uses Radix UI primitives, has some ARIA labels, but gaps exist.

**Issues Identified:**

1. **Missing ARIA Labels:**
   - Form inputs missing `aria-describedby` for error messages
   - Loading states lack `aria-live` regions
   - Dialog titles missing `aria-labelledby`
   - Tables missing `aria-label` or `caption`

2. **Keyboard Navigation:**
   - No skip-to-content link for keyboard users
   - Focus not trapped in modals/dialogs
   - Tab order unclear in complex layouts (sidebar + main content)
   - No keyboard shortcuts documented or implemented

3. **Focus Management:**
   - Focus not returned to trigger after closing dialogs
   - Loading states don't preserve focus
   - No visible focus indicators on some custom components
   - Focus lost during route transitions

4. **Color Contrast:**
   - Need to audit all colors against WCAG 2.1 AA (4.5:1 for text, 3:1 for UI)
   - Disabled state colors may not meet contrast requirements
   - Chart colors need contrast verification

**Recommended Actions:**

**Phase 1: Audit (1-2 days)**
- [ ] Run automated accessibility checker (axe DevTools, Lighthouse)
- [ ] Test with screen reader (NVDA, VoiceOver)
- [ ] Test keyboard-only navigation through all workflows
- [ ] Verify color contrast for all UI elements

**Phase 2: Critical Fixes (3-5 days)**
```tsx
// Add skip-to-content link in layout
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
  Skip to main content
</a>

// Add aria-live for loading states
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? "Loading..." : content}
</div>

// Improve form accessibility
<Input
  id="email"
  type="email"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
{errors.email && (
  <p id="email-error" role="alert" className="text-destructive">
    {errors.email.message}
  </p>
)}

// Focus trap in dialogs (use Radix Dialog's built-in or react-focus-lock)
<Dialog onOpenChange={(open) => {
  if (!open) {
    // Return focus to trigger
    triggerRef.current?.focus();
  }
}}>
```

**Phase 3: Enhanced Accessibility (5-7 days)**
- [ ] Add keyboard shortcuts (?, Ctrl+K for search, etc.)
- [ ] Implement focus indicators with `focus-visible`
- [ ] Add landmarks (`<main>`, `<nav>`, `<aside>`, `<footer>`)
- [ ] Create accessibility testing checklist
- [ ] Document keyboard navigation in help docs

**Impact:** High - Ensures product is usable by all users, including those with disabilities. Required for compliance.

---

### 2. Consistent Error Handling & Offline Support

**Current State:** Toast notifications for errors, but inconsistent patterns. No offline handling.

**Issues Identified:**

1. **Error Display:**
   - API errors show generic messages ("Failed to load data")
   - No retry mechanism for failed requests
   - Errors not persisted (disappear after toast timeout)
   - No error boundaries for React errors
   - Network errors indistinguishable from API errors

2. **Offline Handling:**
   - No detection of offline state
   - No queue for offline actions
   - No sync indicator when coming back online
   - PWA registered but offline features not implemented

3. **Form Validation:**
   - Inline validation works well (✓)
   - But no validation summary at top of form
   - Long forms don't highlight which fields have errors
   - No autosave for long forms

**Recommended Actions:**

**Phase 1: Error Boundaries (1-2 days)**
```tsx
// Create error boundary component
// File: components/error-boundary.tsx
export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaryPrimitive
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <div className="flex min-h-screen flex-col items-center justify-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-muted-foreground">{error.message}</p>
          <Button onClick={resetErrorBoundary} className="mt-4">
            Try again
          </Button>
        </div>
      )}
    >
      {children}
    </ErrorBoundaryPrimitive>
  );
}

// Wrap dashboard layout
<ErrorBoundary>
  <DashboardShell>{children}</DashboardShell>
</ErrorBoundary>
```

**Phase 2: Offline Detection (2-3 days)**
```tsx
// Create offline hook
// File: lib/hooks/use-online-status.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Show offline banner
{!isOnline && (
  <div className="bg-destructive text-destructive-foreground px-4 py-2">
    <p className="text-center text-sm">
      You're offline. Some features may not work.
    </p>
  </div>
)}
```

**Phase 3: Retry Mechanism (3-4 days)**
```tsx
// Enhance API client with retry
// File: lib/api/client.ts
async function fetchWithRetry(url, options, retries = 3) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (retries > 0 && isNetworkError(error)) {
      await delay(1000); // Exponential backoff
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

// Show retry UI on error
{error && (
  <div className="rounded-lg border border-destructive p-4">
    <p className="text-sm">{error.message}</p>
    <Button onClick={retry} size="sm" className="mt-2">
      Try again
    </Button>
  </div>
)}
```

**Phase 4: Offline Queue (5-7 days)**
- [ ] Implement action queue with IndexedDB
- [ ] Sync queue when coming back online
- [ ] Show pending actions count
- [ ] Handle conflicts (optimistic updates)

**Impact:** Critical - Prevents user frustration, enables offline workflows, improves reliability.

---

## High Priority

### 3. Loading State Standardization

**Current State:** Mix of loading spinners, skeleton loaders, and disabled states. Inconsistent patterns.

**Issues Identified:**

1. **Skeleton Loaders:**
   - Only exist for stats and categories
   - No skeletons for lists, tables, or forms
   - Don't match actual content layout
   - No progressive loading (everything loads at once)

2. **Loading Indicators:**
   - Inconsistent icon usage (some use Loader2, others don't show any)
   - No loading text ("Loading...", "Saving...", etc.)
   - Button loading states inconsistent
   - No progress indication for long operations

3. **Optimistic Updates:**
   - No optimistic updates (always wait for API)
   - Form submissions block UI
   - Delete operations don't show immediate feedback

**Recommended Actions:**

**Phase 1: Skeleton Library (2-3 days)**
```tsx
// Create reusable skeleton components
// File: components/ui/skeleton-patterns.tsx

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
```

**Phase 2: Loading Button Pattern (1 day)**
```tsx
// Enhance button component with loading state
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isLoading ? "Saving..." : "Save"}
</Button>
```

**Phase 3: Optimistic Updates (3-4 days)**
```tsx
// Use React Query or SWR for optimistic updates
const { mutate } = useMutation({
  mutationFn: updateItem,
  onMutate: async (newItem) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['items'] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['items']);

    // Optimistically update
    queryClient.setQueryData(['items'], (old) => [...old, newItem]);

    return { previous };
  },
  onError: (err, newItem, context) => {
    // Rollback on error
    queryClient.setQueryData(['items'], context.previous);
  },
  onSettled: () => {
    // Always refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['items'] });
  },
});
```

**Impact:** High - Significantly improves perceived performance and user confidence.

---

### 4. Mobile UX Optimization

**Current State:** Responsive but not optimized for mobile. Desktop patterns adapted, not mobile-first.

**Issues Identified:**

1. **Touch Targets:**
   - Some buttons/links < 44x44px on mobile
   - Dropdown triggers too small
   - Icon-only buttons lack labels

2. **Mobile Navigation:**
   - Hamburger menu → Sheet drawer works
   - But drawer doesn't show active route
   - No swipe-to-open gesture
   - Close button hard to reach with thumb

3. **Forms:**
   - Input fields good size
   - But labels too small on mobile
   - Virtual keyboard pushes content off-screen
   - No autofill optimization

4. **Tables:**
   - Tables scroll horizontally (acceptable)
   - But no mobile-optimized card view
   - Small text in table cells
   - Actions menu too small

**Recommended Actions:**

**Phase 1: Touch Target Audit (1 day)**
- [ ] Audit all interactive elements for 44x44px minimum
- [ ] Add `min-h-11 min-w-11` to icon buttons
- [ ] Increase padding on mobile (`p-4` instead of `p-2`)

**Phase 2: Mobile Navigation (2-3 days)**
```tsx
// Add swipe gesture to open sidebar
import { useSwipeable } from 'react-swipeable';

export function MobileNav() {
  const handlers = useSwipeable({
    onSwipedRight: () => setIsOpen(true),
    trackMouse: false,
  });

  return (
    <div {...handlers} className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        {/* ... */}
      </Sheet>
    </div>
  );
}

// Show active route in drawer
<nav className="space-y-1">
  {navItems.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2",
        pathname === item.href
          ? "bg-accent text-accent-foreground font-medium"
          : "hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  ))}
</nav>
```

**Phase 3: Mobile Table Alternative (3-4 days)**
```tsx
// Show cards on mobile, table on desktop
<div className="block md:hidden">
  {/* Card view for mobile */}
  {items.map((item) => (
    <Card key={item.id} className="mb-4">
      <CardHeader>
        <CardTitle>{item.name}</CardTitle>
        <CardDescription>{item.category}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Location:</dt>
            <dd>{item.location}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Quantity:</dt>
            <dd>{item.quantity}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Actions
            </Button>
          </DropdownMenuTrigger>
          {/* ... */}
        </DropdownMenu>
      </CardFooter>
    </Card>
  ))}
</div>

<div className="hidden md:block">
  {/* Table view for desktop */}
  <Table>{/* ... */}</Table>
</div>
```

**Phase 4: Bottom Sheet for Actions (2-3 days)**
```tsx
// Use Sheet from bottom on mobile for actions/filters
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline" className="md:hidden">
      Filters
    </Button>
  </SheetTrigger>
  <SheetContent side="bottom" className="h-[80vh]">
    <SheetHeader>
      <SheetTitle>Filters</SheetTitle>
    </SheetHeader>
    {/* Filter form */}
  </SheetContent>
</Sheet>
```

**Impact:** High - Mobile users represent significant portion of warehouse workers.

---

### 5. Advanced Search & Filtering

**Current State:** Basic search exists in categories, but limited functionality.

**Issues Identified:**

1. **Search Limitations:**
   - No global search across all entities
   - Search only matches exact strings (no fuzzy matching)
   - No search history or suggestions
   - No keyboard shortcuts (Ctrl+K, /)

2. **Filtering:**
   - No advanced filters (date ranges, multiple categories, etc.)
   - No saved filter presets
   - Filters not visible in URL (can't bookmark/share)
   - No filter chips showing active filters

3. **Results:**
   - No result count
   - No "no results" state guidance
   - No sorting options
   - No faceted search (show counts per category)

**Recommended Actions:**

**Phase 1: Global Search (3-5 days)**
```tsx
// Create command palette with Ctrl+K
// File: components/command-palette.tsx
import { CommandDialog } from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search items, locations, categories..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Items">
          {items.map((item) => (
            <CommandItem key={item.id} onSelect={() => navigate(item.href)}>
              <Package className="mr-2 h-4 w-4" />
              <span>{item.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Locations">
          {/* ... */}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

**Phase 2: Advanced Filters (4-6 days)**
```tsx
// Create filter builder
// File: components/filter-builder.tsx
<div className="space-y-4">
  {/* Category filter */}
  <Select onValueChange={setCategory}>
    <SelectTrigger>
      <SelectValue placeholder="All categories" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All categories</SelectItem>
      {categories.map((cat) => (
        <SelectItem key={cat.id} value={cat.id}>
          {cat.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  {/* Date range filter */}
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline">
        <CalendarIcon className="mr-2 h-4 w-4" />
        {dateRange ? format(dateRange) : "Select date range"}
      </Button>
    </PopoverTrigger>
    <PopoverContent>
      <Calendar mode="range" selected={dateRange} onSelect={setDateRange} />
    </PopoverContent>
  </Popover>

  {/* Active filters */}
  <div className="flex flex-wrap gap-2">
    {category !== "all" && (
      <Badge variant="secondary">
        Category: {getCategoryName(category)}
        <button onClick={() => setCategory("all")}>
          <X className="ml-1 h-3 w-3" />
        </button>
      </Badge>
    )}
    {dateRange && (
      <Badge variant="secondary">
        Date: {format(dateRange)}
        <button onClick={() => setDateRange(null)}>
          <X className="ml-1 h-3 w-3" />
        </button>
      </Badge>
    )}
  </div>
</div>
```

**Phase 3: Search Enhancements (2-3 days)**
- [ ] Add fuzzy search with Fuse.js
- [ ] Show search suggestions as user types
- [ ] Add search history (localStorage)
- [ ] Highlight search terms in results
- [ ] Add keyboard navigation in results (↑↓, Enter)

**Impact:** High - Critical for users with large inventories (100+ items).

---

## Medium Priority

### 6. Data Visualization & Analytics

**Current State:** Stats cards on dashboard, but no charts or detailed analytics.

**Missing Features:**

1. **Charts:**
   - No chart library integrated
   - Value distribution not visualized
   - Trends over time not shown
   - Category breakdown not visual

2. **Dashboard:**
   - Only shows current counts
   - No historical data
   - No comparisons (this month vs last month)
   - No drill-down capability

3. **Reports:**
   - No export to PDF/Excel with visuals
   - No scheduled reports
   - No shareable dashboard links

**Recommended Actions:**

**Phase 1: Chart Library (2-3 days)**
```bash
bun add recharts
# or
bun add @tremor/react
# or
bun add chart.js react-chartjs-2
```

**Phase 2: Dashboard Charts (5-7 days)**
```tsx
// Add charts to dashboard
// File: app/[locale]/(dashboard)/dashboard/page.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

<Card>
  <CardHeader>
    <CardTitle>Inventory Value Over Time</CardTitle>
  </CardHeader>
  <CardContent>
    <LineChart width={600} height={300} data={valueData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" />
    </LineChart>
  </CardContent>
</Card>

<Card>
  <CardHeader>
    <CardTitle>Items by Category</CardTitle>
  </CardHeader>
  <CardContent>
    <BarChart width={600} height={300} data={categoryData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="category" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="count" fill="hsl(var(--primary))" />
    </BarChart>
  </CardContent>
</Card>
```

**Phase 3: Analytics Page (3-5 days)**
- [ ] Create dedicated `/dashboard/analytics` page
- [ ] Add date range selector
- [ ] Show value trends, most expensive items, depreciation
- [ ] Add drill-down to see details
- [ ] Export charts as PNG/PDF

**Impact:** Medium - Valuable for users tracking investment, but not essential for core workflows.

---

### 7. Onboarding & Help System

**Current State:** No onboarding flow, no in-app help, no documentation links.

**Missing Features:**

1. **First-Time User Experience:**
   - No welcome screen
   - No guided tour
   - No sample data option
   - No getting started checklist

2. **Help System:**
   - No help button/icon
   - No contextual help tooltips
   - No help articles or documentation
   - No video tutorials or demos

3. **Feature Discovery:**
   - Hidden features (keyboard shortcuts, etc.)
   - No hints or tips
   - No "What's new" changelog

**Recommended Actions:**

**Phase 1: Empty State Improvements (2-3 days)**
```tsx
// Enhance empty states with actions
// File: components/ui/empty-state.tsx
<EmptyState
  icon={Package}
  title="No items yet"
  description="Get started by adding your first item to the inventory"
  action={{
    label: "Add item",
    onClick: () => router.push("/dashboard/items/new"),
  }}
  secondaryAction={{
    label: "Import from CSV",
    onClick: () => setImportDialogOpen(true),
  }}
  benefits={[
    "Track item locations and quantities",
    "Manage loans and borrowers",
    "Get alerts for low stock items",
  ]}
/>
```

**Phase 2: Onboarding Tour (5-7 days)**
```bash
bun add react-joyride
```

```tsx
// Add guided tour
// File: components/onboarding-tour.tsx
import Joyride from 'react-joyride';

const steps = [
  {
    target: '.sidebar',
    content: 'Use the sidebar to navigate between different areas of your warehouse',
  },
  {
    target: '.add-item-button',
    content: 'Click here to add your first item',
  },
  {
    target: '.workspace-switcher',
    content: 'Switch between different workspaces here',
  },
  // ...
];

<Joyride
  steps={steps}
  continuous
  showProgress
  showSkipButton
  locale={{
    back: 'Back',
    close: 'Close',
    last: 'Finish',
    next: 'Next',
    skip: 'Skip tour',
  }}
  styles={{
    options: {
      primaryColor: 'hsl(var(--primary))',
    },
  }}
/>
```

**Phase 3: Help Center (3-5 days)**
```tsx
// Add help button and dialog
<Dialog>
  <DialogTrigger asChild>
    <Button variant="ghost" size="icon" className="rounded-full">
      <HelpCircle className="h-5 w-5" />
      <span className="sr-only">Help</span>
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Help & Documentation</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Getting Started</h3>
        <ul className="mt-2 space-y-1 text-sm">
          <li><Link href="/docs/add-items">How to add items</Link></li>
          <li><Link href="/docs/locations">Organizing locations</Link></li>
          <li><Link href="/docs/loans">Managing loans</Link></li>
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Keyboard Shortcuts</h3>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt><kbd>Ctrl + K</kbd></dt>
            <dd>Open search</dd>
          </div>
          <div className="flex justify-between">
            <dt><kbd>?</kbd></dt>
            <dd>Show shortcuts</dd>
          </div>
        </dl>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

**Impact:** Medium - Improves new user adoption, reduces support burden, but experienced users don't need it.

---

## Low Priority (Polish)

### 8. Animations & Micro-interactions

**Current State:** Minimal animations (progress bar, spinner, fade in/out).

**Opportunities:**

1. **Page Transitions:**
   - Add fade/slide transitions between pages
   - Smooth entry animations for lists
   - Stagger animations for cards

2. **Hover States:**
   - Scale on hover for cards
   - Underline animation for links
   - Button lift on hover

3. **Loading:**
   - Skeleton shimmer effect
   - Progress indicators for multi-step forms
   - Success checkmark animation

**Recommended Actions:**

**Phase 1: Framer Motion (2-3 days)**
```bash
bun add framer-motion
```

```tsx
// Add page transitions
// File: app/[locale]/(dashboard)/template.tsx
import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.Node }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

// Staggered list animation
<motion.div
  initial="hidden"
  animate="show"
  variants={{
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }}
>
  {items.map((item) => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
    >
      <Card>{/* ... */}</Card>
    </motion.div>
  ))}
</motion.div>
```

**Impact:** Low - Nice to have, improves perceived quality, but not functional.

---

### 9. Haptic Feedback (PWA)

**Current State:** None.

**Opportunities:**
- Vibrate on successful actions (item added, loan returned)
- Vibrate on errors
- Vibrate on barcode scan success

**Recommended Actions:**

```tsx
// Add haptic feedback hook
// File: lib/hooks/use-haptics.ts
export function useHaptics() {
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  return {
    success: () => vibrate(50),
    error: () => vibrate([50, 100, 50]),
    notification: () => vibrate(200),
  };
}

// Use in components
const haptics = useHaptics();

const handleSubmit = async () => {
  try {
    await createItem(data);
    haptics.success();
    toast.success("Item created");
  } catch (error) {
    haptics.error();
    toast.error("Failed to create item");
  }
};
```

**Impact:** Low - Nice addition for mobile PWA users, but not essential.

---

## Implementation Roadmap

### Sprint 1 (1-2 weeks): Critical Accessibility
- [ ] WCAG 2.1 AA audit
- [ ] Fix keyboard navigation
- [ ] Add ARIA labels and landmarks
- [ ] Focus management in modals
- [ ] Skip-to-content link
- [ ] Color contrast fixes

### Sprint 2 (1-2 weeks): Error Handling & Offline
- [ ] Error boundaries
- [ ] Offline detection
- [ ] Retry mechanisms
- [ ] Better error messages
- [ ] Consistent error states

### Sprint 3 (1-2 weeks): Loading & Mobile
- [ ] Skeleton component library
- [ ] Loading button patterns
- [ ] Touch target audit
- [ ] Mobile navigation improvements
- [ ] Bottom sheets for mobile

### Sprint 4 (2-3 weeks): Search & Filtering
- [ ] Global search (Ctrl+K)
- [ ] Advanced filters
- [ ] Filter URL persistence
- [ ] Fuzzy search
- [ ] Search suggestions

### Sprint 5 (2-3 weeks): Data Viz & Analytics
- [ ] Integrate chart library
- [ ] Dashboard charts
- [ ] Analytics page
- [ ] Export capabilities

### Sprint 6 (1-2 weeks): Onboarding & Help
- [ ] Onboarding tour
- [ ] Help center
- [ ] Documentation
- [ ] Keyboard shortcuts guide

### Sprint 7 (1 week): Polish
- [ ] Animations with Framer Motion
- [ ] Micro-interactions
- [ ] Haptic feedback

---

## Testing Strategy

### Accessibility Testing
- [ ] Automated: Lighthouse, axe DevTools
- [ ] Manual: Screen reader (NVDA, VoiceOver)
- [ ] Manual: Keyboard-only navigation
- [ ] Manual: Color contrast verification

### Mobile Testing
- [ ] Real devices: iOS (Safari), Android (Chrome)
- [ ] Responsive breakpoints: 375px, 768px, 1024px, 1440px
- [ ] Touch target verification
- [ ] Virtual keyboard behavior

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Performance Testing
- [ ] Lighthouse performance audit
- [ ] Core Web Vitals (LCP, FID, CLS)
- [ ] Bundle size analysis
- [ ] Image optimization

---

## Metrics to Track

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| Lighthouse Accessibility Score | ? | 95+ | Lighthouse |
| Lighthouse Performance Score | ? | 90+ | Lighthouse |
| Keyboard Navigation Coverage | ? | 100% | Manual testing |
| Mobile Touch Targets < 44px | ? | 0 | Manual audit |
| API Error Retry Success Rate | 0% | 80%+ | Analytics |
| Skeleton vs Spinner Ratio | 20% | 80% | Code review |
| Time to Interactive (TTI) | ? | < 3s | Lighthouse |

---

## Design Principles

1. **Accessibility First** - Every feature must be keyboard accessible and screen-reader friendly
2. **Mobile-First** - Design for smallest screen, enhance for desktop
3. **Progressive Enhancement** - Core functionality works without JavaScript
4. **Consistent Patterns** - Reuse components and patterns across the app
5. **Fast Feedback** - Loading states, optimistic updates, immediate validation
6. **Error Tolerance** - Retry mechanisms, autosave, offline support
7. **Discoverable** - Features are easy to find and understand

---

## Resources

### Design System
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

### Accessibility
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)

### Testing
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

**Next Steps:**
1. Prioritize based on user feedback and analytics
2. Create Figma designs for new patterns (mobile table view, command palette, etc.)
3. Break down into smaller user stories
4. Estimate effort for each sprint
5. Begin with Sprint 1 (Critical Accessibility)
