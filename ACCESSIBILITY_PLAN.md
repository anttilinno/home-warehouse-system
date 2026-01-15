# Accessibility Improvements Plan

**Goal**: Achieve WCAG 2.1 AA compliance across the entire Home Warehouse System frontend.

**Estimated Time**: 2-3 days

**Priority**: High - Accessibility is essential for inclusive design and legal compliance

---

## Overview

This plan implements comprehensive accessibility improvements to ensure the application is usable by people with disabilities, including those using screen readers, keyboard-only navigation, and assistive technologies.

### WCAG 2.1 AA Requirements

The following WCAG 2.1 Level AA success criteria must be met:

1. **Perceivable**: Information and UI components must be presentable in ways users can perceive
2. **Operable**: UI components and navigation must be operable via keyboard
3. **Understandable**: Information and UI operation must be understandable
4. **Robust**: Content must be robust enough to work with assistive technologies

---

## Task Breakdown

### Task 1: Add ARIA Labels to Icon-Only Buttons (30 min)

**Goal**: Ensure all buttons with only icons have accessible names for screen readers.

**Files to Modify**:
- `frontend/components/dashboard/header.tsx`
- `frontend/components/dashboard/sidebar.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/loans/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx`

**Implementation**:

Search for all icon-only buttons and add `aria-label`:

```tsx
// BEFORE:
<Button variant="ghost" size="icon">
  <MoreHorizontal className="h-4 w-4" />
</Button>

// AFTER:
<Button variant="ghost" size="icon" aria-label="Open actions menu">
  <MoreHorizontal className="h-4 w-4" />
</Button>

// BEFORE:
<Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  <Sun className="h-5 w-5" />
</Button>

// AFTER:
<Button
  variant="ghost"
  size="icon"
  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
  <Sun className="h-5 w-5" />
</Button>
```

**Common Icon Buttons to Fix**:
- Mobile menu button: `aria-label="Open navigation menu"`
- Close buttons: `aria-label="Close dialog"`
- Edit buttons: `aria-label="Edit {itemName}"`
- Delete buttons: `aria-label="Delete {itemName}"`
- Archive buttons: `aria-label="Archive {itemName}"`
- More actions (three dots): `aria-label="Open actions menu"`
- Theme toggle: `aria-label="Switch to {opposite} mode"`
- Notification bell: `aria-label="View notifications"`

**Acceptance Criteria**:
- All buttons with only icons have meaningful `aria-label` attributes
- Labels describe the action, not the icon ("Delete item" not "Trash icon")
- Dynamic labels reflect current state (e.g., theme toggle)

---

### Task 2: Add ARIA Attributes to Sortable Table Headers (20 min)

**Goal**: Indicate sort state to screen reader users.

**Files to Modify**:
- `frontend/components/ui/table.tsx` (SortableTableHead component)

**Implementation**:

Update the `SortableTableHead` component to include `aria-sort`:

```tsx
// File: frontend/components/ui/table.tsx

export interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  sortDirection?: 'asc' | 'desc' | null;
  onSort: () => void;
}

export function SortableTableHead({
  children,
  sortDirection,
  onSort,
  className,
  ...props
}: SortableTableHeadProps) {
  // Determine aria-sort value
  const ariaSort = sortDirection === 'asc'
    ? 'ascending'
    : sortDirection === 'desc'
    ? 'descending'
    : 'none';

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50", className)}
      onClick={onSort}
      aria-sort={ariaSort}
      role="columnheader"
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        <div className="ml-auto">
          {sortDirection === 'asc' && <ChevronUp className="h-4 w-4" aria-hidden="true" />}
          {sortDirection === 'desc' && <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          {!sortDirection && <ChevronsUpDown className="h-4 w-4 opacity-30" aria-hidden="true" />}
        </div>
      </div>
    </TableHead>
  );
}
```

**Acceptance Criteria**:
- All sortable headers have `aria-sort` attribute
- `aria-sort` reflects current sort state: "ascending", "descending", or "none"
- Sort icons have `aria-hidden="true"` to prevent redundant announcements

---

### Task 3: Improve Form Accessibility (45 min)

**Goal**: Add proper labels, validation states, and error messages to all forms.

**Files to Modify**:
- All dialog forms in dashboard pages (items, inventory, loans, borrowers, containers, locations, categories)

**Implementation**:

1. **Associate labels with inputs** (most forms already have this):

```tsx
// Ensure all inputs have proper labels
<div className="space-y-2">
  <Label htmlFor="item-name">
    Item Name <span className="text-destructive">*</span>
  </Label>
  <Input
    id="item-name"
    value={formName}
    onChange={(e) => setFormName(e.target.value)}
    aria-required="true"
    aria-invalid={nameError ? "true" : "false"}
    aria-describedby={nameError ? "name-error" : undefined}
  />
  {nameError && (
    <p id="name-error" className="text-sm text-destructive" role="alert">
      {nameError}
    </p>
  )}
</div>
```

2. **Add aria-required to required fields**:

```tsx
<Input
  id="email"
  type="email"
  value={formEmail}
  onChange={(e) => setFormEmail(e.target.value)}
  aria-required="true"
  aria-describedby="email-description"
/>
<p id="email-description" className="text-sm text-muted-foreground">
  We'll never share your email with anyone else.
</p>
```

3. **Add validation feedback**:

```tsx
<Select
  value={formStatus}
  onValueChange={(v) => setFormStatus(v as InventoryStatus)}
  aria-required="true"
  aria-invalid={statusError ? "true" : "false"}
  aria-describedby={statusError ? "status-error" : "status-help"}
>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {/* options */}
  </SelectContent>
</Select>
{statusError && (
  <p id="status-error" className="text-sm text-destructive" role="alert">
    {statusError}
  </p>
)}
```

**Forms to Update**:
1. Create/Edit Item dialog
2. Create/Edit Inventory dialog
3. Create/Edit Loan dialog
4. Create/Edit Borrower dialog
5. Create/Edit Container dialog
6. Create/Edit Location dialog
7. Create/Edit Category dialog

**Acceptance Criteria**:
- All form inputs have associated `<Label>` with matching `htmlFor` and `id`
- Required fields have `aria-required="true"`
- Invalid fields have `aria-invalid="true"`
- Error messages have `role="alert"` and are linked via `aria-describedby`
- Helper text is linked to inputs via `aria-describedby`

---

### Task 4: Add Skip Links for Keyboard Navigation (30 min)

**Goal**: Allow keyboard users to skip repetitive navigation elements.

**Files to Create**:
- `frontend/components/shared/skip-links.tsx`

**Files to Modify**:
- `frontend/components/dashboard/dashboard-shell.tsx`

**Implementation**:

1. Create the SkipLinks component:

```tsx
// File: frontend/components/shared/skip-links.tsx
"use client";

import { cn } from "@/lib/utils";

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className={cn(
          "fixed left-4 top-4 z-50",
          "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        Skip to main content
      </a>
      <a
        href="#navigation"
        className={cn(
          "fixed left-4 top-16 z-50",
          "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        Skip to navigation
      </a>
    </div>
  );
}
```

2. Update dashboard-shell.tsx:

```tsx
// File: frontend/components/dashboard/dashboard-shell.tsx
import { SkipLinks } from "@/components/shared/skip-links";

export function DashboardShell({ children }: DashboardShellProps) {
  // ... existing code

  return (
    <div className="min-h-screen bg-muted/30">
      <SkipLinks />

      {/* Desktop Sidebar */}
      <div className="hidden md:block" id="navigation">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* ... mobile sidebar ... */}

      {/* Main content */}
      <div className={cn(/* ... */)}>
        <DashboardHeader onMenuClick={() => setMobileMenuOpen(true)} />
        <main id="main-content" className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* ... dialogs ... */}
    </div>
  );
}
```

**Acceptance Criteria**:
- Skip links are visually hidden until focused
- Tab from address bar shows "Skip to main content" link
- Links work and move focus to target elements
- Skip links have visible focus indicators

---

### Task 5: Add Live Regions for Dynamic Content (30 min)

**Goal**: Announce loading states and updates to screen reader users.

**Files to Modify**:
- `frontend/components/ui/infinite-scroll-trigger.tsx`
- `frontend/components/ui/bulk-action-bar.tsx`
- All dashboard pages with loading states

**Implementation**:

1. Update InfiniteScrollTrigger with aria-live:

```tsx
// File: frontend/components/ui/infinite-scroll-trigger.tsx

export function InfiniteScrollTrigger({
  onLoadMore,
  isLoading,
  hasMore,
  loadingText = "Loading more...",
  endText = "No more items to load",
}: InfiniteScrollTriggerProps) {
  // ... existing code

  return (
    <div
      ref={observerTarget}
      className="flex justify-center py-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{loadingText}</span>
        </div>
      ) : hasMore ? (
        <span className="sr-only">Scroll to load more</span>
      ) : (
        <span className="text-sm text-muted-foreground">{endText}</span>
      )}
    </div>
  );
}
```

2. Add live region to bulk action bar:

```tsx
// File: frontend/components/ui/bulk-action-bar.tsx

export function BulkActionBar({
  selectedCount,
  onClear,
  children,
}: BulkActionBarProps) {
  // ... existing code

  return (
    <div className={cn(/* ... */)}>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium" aria-live="polite">
          {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
        </span>
        {/* ... rest of component ... */}
      </div>
    </div>
  );
}
```

3. Add loading announcements to pages:

```tsx
// Example for inventory page
{isLoading && (
  <div role="status" aria-live="polite" className="sr-only">
    Loading inventory data
  </div>
)}

{error && (
  <div role="alert" aria-live="assertive" className="sr-only">
    Error loading inventory: {error}
  </div>
)}
```

**Acceptance Criteria**:
- Loading states have `role="status"` and `aria-live="polite"`
- Errors have `role="alert"` and `aria-live="assertive"`
- Selection count changes are announced
- Loading spinners have `aria-hidden="true"`

---

### Task 6: Improve Focus Management in Dialogs (45 min)

**Goal**: Trap focus within dialogs and restore focus when closed.

**Files to Modify**:
- `frontend/components/ui/dialog.tsx` (verify focus trap is working)
- All dialog usage in dashboard pages

**Implementation**:

The Dialog component from shadcn/ui should already handle focus trapping via Radix UI. Verify and enhance:

```tsx
// Verify Dialog has proper focus management
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent
    aria-labelledby="dialog-title"
    aria-describedby="dialog-description"
  >
    <DialogHeader>
      <DialogTitle id="dialog-title">Create New Item</DialogTitle>
      <DialogDescription id="dialog-description">
        Add a new item to your inventory catalog
      </DialogDescription>
    </DialogHeader>

    {/* Form content */}

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setDialogOpen(false)}
        type="button"
      >
        Cancel
      </Button>
      <Button
        onClick={handleSave}
        disabled={isSaving}
        type="submit"
      >
        {isSaving ? "Saving..." : "Create"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Check for**:
1. Focus moves to dialog when opened
2. Tab cycles through only dialog elements
3. Escape closes dialog
4. Focus returns to trigger element when closed
5. First focusable element gets initial focus

**Acceptance Criteria**:
- All dialogs have `aria-labelledby` pointing to DialogTitle
- All dialogs have `aria-describedby` pointing to DialogDescription
- Focus is trapped within open dialogs
- Focus returns to trigger element on close
- Escape key closes dialogs

---

### Task 7: Ensure Proper Heading Hierarchy (30 min)

**Goal**: Maintain logical heading structure (h1 → h2 → h3) for screen reader navigation.

**Files to Modify**:
- All dashboard pages

**Implementation**:

Verify heading structure on each page:

```tsx
// Page structure should follow:
<div className="space-y-6">
  {/* Page title - h1 */}
  <div>
    <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
    <p className="text-muted-foreground">
      Track physical instances of items at specific locations
    </p>
  </div>

  {/* Main section - h2 */}
  <Card>
    <CardHeader>
      <CardTitle className="text-xl">Inventory Tracking</CardTitle> {/* Should be h2 */}
      <CardDescription>
        {sortedInventories.length} inventories
      </CardDescription>
    </CardHeader>
    {/* ... */}
  </Card>
</div>
```

Update CardTitle component if needed:

```tsx
// File: frontend/components/ui/card.tsx

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' }
>(({ className, as: Component = 'h3', ...props }, ref) => (
  <Component
    ref={ref as any}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
```

**Acceptance Criteria**:
- Each page has exactly one h1 (page title)
- Headings follow logical hierarchy (no skipping levels)
- CardTitle uses appropriate heading level based on context
- No purely decorative text using heading tags

---

### Task 8: Add Visual Focus Indicators (30 min)

**Goal**: Ensure all interactive elements have visible focus indicators.

**Files to Modify**:
- `frontend/app/globals.css`
- Verify all button/link components

**Implementation**:

1. Add global focus styles:

```css
/* File: frontend/app/globals.css */

/* Enhance focus visibility */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Ensure focus is visible on all interactive elements */
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
[role="button"]:focus-visible,
[tabindex]:not([tabindex="-1"]):focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Remove default focus for mouse users (keeps keyboard focus) */
*:focus:not(:focus-visible) {
  outline: none;
}
```

2. Verify Button component has focus styles:

```tsx
// File: frontend/components/ui/button.tsx
// Should already have focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
```

**Acceptance Criteria**:
- All interactive elements show visible focus indicator when tabbed to
- Focus indicator has 2:1 contrast ratio with background
- Focus indicator is at least 2px thick
- Mouse clicks don't show focus rings (only keyboard navigation)

---

### Task 9: Add Status Icons to Color-Coded Badges (30 min)

**Goal**: Don't rely on color alone to convey information (WCAG 1.4.1).

**Files to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/loans/page.tsx`
- Any other pages using status badges

**Implementation**:

Update StatusBadge components to include icons:

```tsx
// File: frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx

import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Package,
  Truck,
} from "lucide-react";

const STATUS_OPTIONS: {
  value: InventoryStatus;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "AVAILABLE",
    label: "Available",
    color: "bg-green-500",
    icon: CheckCircle2,
  },
  {
    value: "IN_USE",
    label: "In Use",
    color: "bg-blue-500",
    icon: Package,
  },
  {
    value: "RESERVED",
    label: "Reserved",
    color: "bg-yellow-500",
    icon: Clock,
  },
  {
    value: "ON_LOAN",
    label: "On Loan",
    color: "bg-purple-500",
    icon: Truck,
  },
  {
    value: "MISSING",
    label: "Missing",
    color: "bg-red-500",
    icon: AlertCircle,
  },
  {
    value: "DISPOSED",
    label: "Disposed",
    color: "bg-gray-500",
    icon: XCircle,
  },
];

function StatusBadge({ status }: { status: InventoryStatus }) {
  const statusOption = STATUS_OPTIONS.find(s => s.value === status);
  const Icon = statusOption?.icon;

  return (
    <Badge className={cn("gap-1.5", statusOption?.color)}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      <span>{statusOption?.label || status}</span>
    </Badge>
  );
}
```

**Acceptance Criteria**:
- All status badges include icons
- Icons have `aria-hidden="true"` (text label is sufficient)
- Information is conveyed through both icon and text, not color alone
- High contrast between badge background and text (4.5:1 minimum)

---

### Task 10: Improve Keyboard Navigation in Tree Views (45 min)

**Goal**: Add proper arrow key navigation for Categories and Locations tree views.

**Files to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx`

**Implementation**:

Add keyboard navigation to tree items:

```tsx
// File: frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx

function TreeItem({
  category,
  level = 0,
  onToggle,
  onSelect,
  selectedId,
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = category.children && category.children.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        if (hasChildren && !expanded) {
          e.preventDefault();
          setExpanded(true);
        }
        break;
      case 'ArrowLeft':
        if (expanded) {
          e.preventDefault();
          setExpanded(false);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onSelect(category.id);
        break;
    }
  };

  return (
    <div role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
          selectedId === category.id && "bg-muted"
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        aria-label={`${category.name}${hasChildren ? `, ${expanded ? 'expanded' : 'collapsed'}` : ''}`}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              expanded && "rotate-90"
            )}
            aria-hidden="true"
          />
        )}
        {!hasChildren && <span className="w-4" aria-hidden="true" />}
        <Folder className="h-4 w-4" aria-hidden="true" />
        <span>{category.name}</span>
      </button>

      {expanded && hasChildren && (
        <div role="group">
          {category.children!.map((child) => (
            <TreeItem
              key={child.id}
              category={child}
              level={level + 1}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Wrap tree in proper role
function CategoryTree({ categories }: { categories: Category[] }) {
  return (
    <div role="tree" aria-label="Category hierarchy">
      {categories.map((category) => (
        <TreeItem key={category.id} category={category} />
      ))}
    </div>
  );
}
```

**Acceptance Criteria**:
- Tree has `role="tree"`
- Tree items have `role="treeitem"`
- Arrow Right expands collapsed items
- Arrow Left collapses expanded items
- Enter/Space selects items
- Groups have `role="group"`
- Expanded state communicated via `aria-expanded`

---

### Task 11: Add Keyboard Shortcuts to Tooltips (30 min)

**Goal**: Show keyboard shortcuts in button tooltips for discoverability.

**Files to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/loans/page.tsx`
- `frontend/components/dashboard/header.tsx`

**Implementation**:

Add tooltips with keyboard shortcuts to buttons:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";

// In inventory page:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button onClick={openCreateDialog}>
        <Plus className="mr-2 h-4 w-4" />
        Add Inventory
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <div className="flex items-center gap-2">
        <span>Create new inventory</span>
        <div className="flex items-center gap-1">
          <Kbd>Ctrl</Kbd>
          <span className="text-xs">+</span>
          <Kbd>N</Kbd>
        </div>
      </div>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>

// Refresh button:
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="outline" size="sm" onClick={refetch}>
      <RefreshCw className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <div className="flex items-center gap-2">
      <span>Refresh</span>
      <Kbd>R</Kbd>
    </div>
  </TooltipContent>
</Tooltip>
```

**Common Shortcuts to Show**:
- Create new: Ctrl+N
- Refresh: R
- Select all: Ctrl+A
- Export: Ctrl+E
- Global search: Ctrl+/
- Command palette: Ctrl+K
- Keyboard shortcuts: ?

**Acceptance Criteria**:
- All buttons with keyboard shortcuts have tooltips
- Tooltips show the shortcut keys using Kbd component
- Tooltips appear on hover and keyboard focus
- Tooltips don't obstruct other content

---

### Task 12: Ensure Proper Color Contrast (45 min)

**Goal**: Verify all text meets WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text).

**Files to Check**:
- All dashboard pages
- All UI components
- Badge colors
- Button variants

**Implementation**:

1. Use browser DevTools or online tools to check contrast:
   - Chrome DevTools: Inspect element → Accessibility pane
   - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

2. Fix low-contrast issues:

```tsx
// BEFORE (potentially low contrast):
<Badge variant="outline" className="text-muted-foreground">
  Draft
</Badge>

// AFTER (ensure sufficient contrast):
<Badge variant="outline" className="text-foreground border-2">
  Draft
</Badge>

// For custom colors, ensure sufficient contrast:
const STATUS_COLORS = {
  available: "bg-green-600 text-white", // Ensure 4.5:1 contrast
  inUse: "bg-blue-600 text-white",
  missing: "bg-red-600 text-white",
};
```

3. Check placeholders:

```tsx
// Placeholders should have at least 4.5:1 contrast
<Input
  placeholder="Search items..."
  className="placeholder:text-muted-foreground" // Verify this meets contrast
/>
```

**Elements to Check**:
- Body text on all backgrounds
- Link text (default and visited)
- Button text on all variants
- Badge text on colored backgrounds
- Placeholder text in inputs
- Disabled state text (should be 3:1 minimum)
- Icon-only buttons (use aria-label, not color)

**Acceptance Criteria**:
- All normal text (< 18pt) has 4.5:1 contrast ratio
- All large text (≥ 18pt or ≥ 14pt bold) has 3:1 contrast ratio
- UI component borders have 3:1 contrast with adjacent colors
- Form input borders have 3:1 contrast
- Focus indicators have 3:1 contrast

---

### Task 13: Add Table Accessibility Attributes (30 min)

**Goal**: Improve table semantics for screen readers.

**Files to Modify**:
- All dashboard pages with tables
- `frontend/components/ui/table.tsx`

**Implementation**:

1. Add proper table attributes:

```tsx
// File: All pages with tables

<Table role="table" aria-label="Inventory items">
  <TableHeader>
    <TableRow role="row">
      <TableHead role="columnheader" scope="col">
        <Checkbox
          checked={isAllSelected(sortedInventories.map((i) => i.id))}
          onCheckedChange={/* ... */}
          aria-label="Select all inventory items"
        />
      </TableHead>
      <SortableTableHead
        role="columnheader"
        scope="col"
        sortDirection={getSortDirection("item_name")}
        onSort={() => requestSort("item_name")}
      >
        Item
      </SortableTableHead>
      {/* ... more headers ... */}
    </TableRow>
  </TableHeader>
  <TableBody role="rowgroup">
    {sortedInventories.map((inventory) => (
      <TableRow key={inventory.id} role="row">
        <TableCell role="cell">
          <Checkbox
            checked={isSelected(inventory.id)}
            onCheckedChange={() => toggleSelection(inventory.id)}
            aria-label={`Select ${getItemName(inventory.item_id)}`}
          />
        </TableCell>
        <TableCell role="cell">
          <div>
            <div className="font-medium">{getItemName(inventory.item_id)}</div>
            <div className="text-sm text-muted-foreground">
              {getItemSKU(inventory.item_id)}
            </div>
          </div>
        </TableCell>
        {/* ... more cells ... */}
      </TableRow>
    ))}
  </TableBody>
</Table>
```

2. Add caption for context:

```tsx
<Table aria-label="Inventory items">
  <caption className="sr-only">
    List of inventory items with quantity, location, and status information.
    Currently showing {sortedInventories.length} items.
  </caption>
  {/* ... table content ... */}
</Table>
```

**Acceptance Criteria**:
- All tables have `aria-label` or `<caption>`
- Table headers have `scope="col"` or `scope="row"`
- Checkbox cells have descriptive `aria-label`
- Complex tables have proper header associations

---

### Task 14: Test with Screen Reader (60 min)

**Goal**: Manually test the application with a screen reader.

**Tools**:
- Windows: NVDA (free) or JAWS
- macOS: VoiceOver (built-in)
- Linux: Orca

**Testing Checklist**:

1. **Navigation**:
   - [ ] Tab through all interactive elements in logical order
   - [ ] Skip links work (jump to main content)
   - [ ] Landmark regions are announced (main, navigation, search)
   - [ ] Headings are announced with correct level

2. **Forms**:
   - [ ] Form labels are announced
   - [ ] Required fields are indicated
   - [ ] Error messages are announced
   - [ ] Validation feedback is clear

3. **Tables**:
   - [ ] Table caption/label is announced
   - [ ] Column headers are announced
   - [ ] Row navigation works
   - [ ] Sort state is announced

4. **Dialogs**:
   - [ ] Dialog opening is announced
   - [ ] Dialog title is read
   - [ ] Focus is trapped in dialog
   - [ ] Escape closes dialog
   - [ ] Focus returns to trigger on close

5. **Dynamic Content**:
   - [ ] Loading states are announced
   - [ ] Success/error toasts are announced
   - [ ] Selection count changes are announced
   - [ ] Search results are announced

6. **Tree Views** (Categories, Locations):
   - [ ] Tree role is announced
   - [ ] Expand/collapse state is clear
   - [ ] Arrow key navigation works
   - [ ] Nesting level is communicated

7. **Buttons and Links**:
   - [ ] All buttons have clear labels
   - [ ] Icon-only buttons describe action
   - [ ] Link purposes are clear
   - [ ] Button states (disabled, pressed) are announced

**Issues to Log**:
Create a checklist of issues found and fix them.

**Acceptance Criteria**:
- All major user flows work with screen reader
- No navigation dead-ends
- All information accessible without vision
- No confusing or redundant announcements

---

## Testing Strategy

### Manual Testing

1. **Keyboard-only Navigation**:
   - Unplug your mouse
   - Navigate entire application using only keyboard
   - Verify all features are accessible

2. **Screen Reader Testing**:
   - Test with NVDA/JAWS (Windows) or VoiceOver (Mac)
   - Navigate through all pages
   - Complete key user flows (create item, create loan, search, filter)

3. **Zoom Testing**:
   - Test at 200% zoom (WCAG requirement)
   - Ensure no horizontal scrolling
   - Verify text reflows properly

4. **Automated Testing** (optional):
   - Run axe DevTools extension
   - Run Lighthouse accessibility audit
   - Run WAVE accessibility checker

### Automated Tools

Install axe DevTools browser extension:
- Chrome: https://chrome.google.com/webstore/detail/axe-devtools/lhdoppojpmngadmnindnejefpokejbdd
- Firefox: https://addons.mozilla.org/en-US/firefox/addon/axe-devtools/

Run accessibility audit:
1. Open DevTools
2. Go to axe DevTools tab
3. Click "Scan ALL of my page"
4. Fix all Critical and Serious issues
5. Review Moderate and Minor issues

---

## Completion Criteria

The accessibility implementation is complete when:

- [ ] All tasks (1-14) are completed
- [ ] All ARIA labels added to icon-only buttons
- [ ] All forms have proper labels and validation feedback
- [ ] Skip links are functional
- [ ] Focus management works in all dialogs
- [ ] Heading hierarchy is logical on all pages
- [ ] All interactive elements have visible focus indicators
- [ ] Status badges include icons, not just colors
- [ ] Tree views support keyboard navigation
- [ ] Tooltips show keyboard shortcuts
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Tables have proper semantic structure
- [ ] Screen reader testing completed with no major issues
- [ ] Lighthouse accessibility score ≥ 95
- [ ] axe DevTools shows 0 Critical/Serious issues

---

## Final Task: Update Frontend Roadmap

After completing all accessibility improvements, update the roadmap:

**File**: `docs/FRONTEND_ROADMAP.md`

Mark Phase 4.2 (Accessibility Improvements) as complete with implementation notes:

```markdown
#### 4.2 Accessibility Improvements ✅
**Goal**: Ensure WCAG 2.1 AA compliance

**Implementation Status**: Complete. All accessibility improvements implemented to meet WCAG 2.1 Level AA standards.

**Completed Tasks**:
- [x] Add `aria-label` to icon-only buttons
- [x] Add `aria-sort` to sortable table headers
- [x] Add proper form labels and validation feedback
- [x] Add skip links for keyboard navigation
- [x] Add live regions for dynamic content
- [x] Improve focus management in dialogs
- [x] Ensure proper heading hierarchy
- [x] Add visual focus indicators
- [x] Add status icons to color-coded badges
- [x] Improve keyboard navigation in tree views
- [x] Add keyboard shortcuts to tooltips
- [x] Ensure proper color contrast (4.5:1 for text)
- [x] Add table accessibility attributes
- [x] Test with screen reader (NVDA/VoiceOver)

**Lighthouse Score**: 95+ (Accessibility)
**axe DevTools**: 0 Critical/Serious issues
**WCAG 2.1 Level**: AA compliant

**Files Modified**:
- All dashboard pages (added ARIA labels, improved semantics)
- `frontend/components/ui/table.tsx` - Added aria-sort and table roles
- `frontend/components/ui/dialog.tsx` - Verified focus management
- `frontend/components/shared/skip-links.tsx` - NEW: Skip navigation links
- `frontend/app/globals.css` - Enhanced focus indicators
- Status badge components - Added icons for non-color identification
```

---

## Notes for Autonomous Agent

- This plan should be executed sequentially, task by task
- Each task should be completed fully before moving to the next
- If a file doesn't exist, create it as specified
- If a component already handles accessibility well (like shadcn/ui components), verify and document rather than reimplementing
- Test changes incrementally - don't wait until the end
- Use the Kbd component created in keyboard shortcuts implementation
- Follow existing code style and patterns in the codebase
- Commit changes after completing each major task (every 2-3 tasks)
- The final commit should include the roadmap update
