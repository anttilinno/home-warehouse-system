# Performance Optimization Plan - Phase 5

**Goal**: Eliminate unnecessary re-renders, optimize filtering/searching, and implement virtual scrolling for large datasets.

**Estimated Time**: 2-3 days

**Priority**: High - Performance is critical for good user experience with large datasets

---

## Overview

This plan implements comprehensive performance optimizations to ensure the application remains fast and responsive even with hundreds or thousands of items. Focus areas include memoization, debouncing, virtual scrolling, and component optimization.

### Performance Targets

- **Table rendering**: < 100ms for 500 items
- **Search input**: < 50ms response time (with debouncing)
- **Filter changes**: < 100ms to update UI
- **Memory usage**: Stable (no memory leaks)
- **First render**: < 1000ms for any page

---

## Progress Checklist

Track completion of all performance optimization tasks:

### Memoization & React Optimization
- [ ] Task 1: Memoize category tree building (30 min)
- [ ] Task 2: Memoize location tree building (30 min)
- [ ] Task 3: Verify and enhance filter memoization on all pages (45 min)
- [ ] Task 4: Add React.memo() to expensive components (45 min)

### Debounced Search
- [ ] Task 5: Verify debounce hook implementation (15 min)
- [ ] Task 6: Apply debouncing to all search inputs (30 min)

### Virtual Scrolling
- [ ] Task 7: Install virtual scrolling package (5 min)
- [ ] Task 8: Implement virtual scrolling on Items page (60 min)
- [ ] Task 9: Implement virtual scrolling on Inventory page (60 min)
- [ ] Task 10: Implement virtual scrolling on Loans page (60 min)

### Performance Profiling & Testing
- [ ] Task 11: Profile performance with React DevTools (30 min)
- [ ] Task 12: Measure and document improvements (30 min)
- [ ] Task 13: Update frontend roadmap (15 min)

**Total Estimated Time**: 7-8 hours

---

## Task 1: Memoize Category Tree Building (30 min)

**Goal**: Prevent rebuilding the category tree on every render.

**File to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx`

**Current Issue**: The `buildCategoryTree` function is called on every render, even when categories haven't changed. This is expensive for large category hierarchies.

**Implementation**:

```tsx
// File: frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx

// BEFORE (around line 100-120):
export default function CategoriesPage() {
  // ... existing code ...

  // This rebuilds on every render
  const categoryTree = buildCategoryTree(categories);

  // ... rest of component ...
}

// AFTER:
import { useState, useEffect, useMemo, useCallback } from "react";

export default function CategoriesPage() {
  // ... existing code ...

  // Memoize tree building - only rebuild when categories change
  const categoryTree = useMemo(() => {
    console.log('[Performance] Building category tree');
    return buildCategoryTree(categories);
  }, [categories]);

  // Memoize filtered tree to prevent recalculation
  const filteredCategoryTree = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoryTree;
    }

    console.log('[Performance] Filtering category tree');
    return filterCategoryTree(categoryTree, searchQuery);
  }, [categoryTree, searchQuery]);

  // ... rest of component ...
}
```

**Helper function to add** (if doesn't exist):

```tsx
// Helper to filter tree recursively
function filterCategoryTree(
  categories: CategoryTree[],
  query: string
): CategoryTree[] {
  const lowerQuery = query.toLowerCase();

  return categories.reduce<CategoryTree[]>((acc, category) => {
    const matchesSearch = category.name.toLowerCase().includes(lowerQuery);
    const filteredChildren = category.children
      ? filterCategoryTree(category.children, query)
      : [];

    if (matchesSearch || filteredChildren.length > 0) {
      acc.push({
        ...category,
        children: filteredChildren.length > 0 ? filteredChildren : category.children,
      });
    }

    return acc;
  }, []);
}
```

**Acceptance Criteria**:
- Category tree is only rebuilt when categories array changes (check console logs)
- Filtered tree is only recalculated when searchQuery or categoryTree changes
- No performance regression in tree rendering
- Memory usage remains stable

---

## Task 2: Memoize Location Tree Building (30 min)

**Goal**: Prevent rebuilding the location tree on every render.

**File to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx`

**Implementation**:

```tsx
// File: frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx

import { useState, useEffect, useMemo, useCallback } from "react";

export default function LocationsPage() {
  // ... existing code ...

  // Memoize tree building
  const locationTree = useMemo(() => {
    console.log('[Performance] Building location tree');
    return buildLocationTree(locations);
  }, [locations]);

  // Memoize filtered tree
  const filteredLocationTree = useMemo(() => {
    if (!searchQuery.trim()) {
      return locationTree;
    }

    console.log('[Performance] Filtering location tree');
    return filterLocationTree(locationTree, searchQuery);
  }, [locationTree, searchQuery]);

  // ... rest of component ...
}

// Helper function to filter location tree
function filterLocationTree(
  locations: LocationTree[],
  query: string
): LocationTree[] {
  const lowerQuery = query.toLowerCase();

  return locations.reduce<LocationTree[]>((acc, location) => {
    const matchesSearch =
      location.name.toLowerCase().includes(lowerQuery) ||
      location.short_code?.toLowerCase().includes(lowerQuery) ||
      location.zone?.toLowerCase().includes(lowerQuery);

    const filteredChildren = location.children
      ? filterLocationTree(location.children, query)
      : [];

    if (matchesSearch || filteredChildren.length > 0) {
      acc.push({
        ...location,
        children: filteredChildren.length > 0 ? filteredChildren : location.children,
      });
    }

    return acc;
  }, []);
}
```

**Acceptance Criteria**:
- Location tree is only rebuilt when locations array changes
- Filtered tree is only recalculated when necessary
- Tree operations are fast (< 50ms for 100 locations)
- No visual glitches or UI freezing

---

## Task 3: Verify and Enhance Filter Memoization (45 min)

**Goal**: Ensure all filtering logic is properly memoized across all dashboard pages.

**Files to Check/Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx` (already has useMemo)
- `frontend/app/[locale]/(dashboard)/dashboard/loans/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx`

**Implementation Pattern**:

For each page, ensure filtering logic is wrapped in `useMemo`:

```tsx
// PATTERN TO FOLLOW:

// 1. Memoize filtered data
const filteredItems = useMemo(() => {
  console.log('[Performance] Filtering items');

  return items.filter((item) => {
    // Filter by archived status
    if (!showArchived && item.is_archived) return false;
    if (showArchived && !item.is_archived) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Apply active filters
    // ... filter logic ...

    return true;
  });
}, [items, showArchived, searchQuery, activeFilters]);

// 2. Memoize flattened data (for tables with related data)
const flattenedItems = useMemo(() => {
  console.log('[Performance] Flattening items');

  return filteredItems.map(item => ({
    ...item,
    category_name: getCategoryName(item.category_id),
    // ... other computed fields ...
  }));
}, [filteredItems, categories]); // Include dependencies for computed fields

// 3. Sorting is usually already in useTableSort hook, but verify dependencies
```

**Specific Checks**:

**Items Page** (`items/page.tsx`):
- Check if `filteredItems` is memoized
- Verify dependency array includes: items, searchQuery, showArchived, activeFilters

**Loans Page** (`loans/page.tsx`):
- Check if `filteredLoans` is memoized
- Check if `flattenedLoans` is memoized (includes borrower names)
- Verify all dependencies are listed

**Borrowers Page** (`borrowers/page.tsx`):
- Check if `filteredBorrowers` is memoized
- Verify dependencies

**Containers Page** (`containers/page.tsx`):
- Check if `filteredContainers` is memoized
- Check if `flattenedContainers` is memoized (includes location names)
- Verify dependencies

**Acceptance Criteria**:
- All filtering operations use `useMemo`
- All flattening operations (adding related data) use `useMemo`
- Dependency arrays are complete and accurate
- Console logs show filtering only happens when dependencies change
- No performance regression

---

## Task 4: Add React.memo() to Expensive Components (45 min)

**Goal**: Prevent unnecessary re-renders of pure components.

**Components to Optimize**:
- `frontend/components/ui/sortable-header.tsx` (SortableTableHead)
- `frontend/components/ui/infinite-scroll-trigger.tsx` (InfiniteScrollTrigger)
- `frontend/components/ui/bulk-action-bar.tsx` (BulkActionBar)
- `frontend/components/ui/filter-bar.tsx` (FilterBar)
- `frontend/components/ui/empty-state.tsx` (EmptyState)

**Implementation Pattern**:

```tsx
// BEFORE:
export function SortableTableHead({ children, sortDirection, onSort }: Props) {
  return (
    // ... component JSX ...
  );
}

// AFTER:
import React from "react";

export const SortableTableHead = React.memo(function SortableTableHead({
  children,
  sortDirection,
  onSort,
}: Props) {
  return (
    // ... component JSX ...
  );
});
```

**Specific Implementations**:

### SortableTableHead (if not already memoized):

```tsx
// File: frontend/components/ui/table.tsx

export const SortableTableHead = React.memo(
  function SortableTableHead({
    children,
    sortDirection,
    onSort,
    className,
    ...props
  }: SortableTableHeadProps) {
    return (
      <TableHead
        className={cn("cursor-pointer select-none hover:bg-muted/50", className)}
        onClick={onSort}
        aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'}
        role="columnheader"
        {...props}
      >
        {/* ... existing JSX ... */}
      </TableHead>
    );
  },
  // Custom comparison function
  (prevProps, nextProps) => {
    return (
      prevProps.sortDirection === nextProps.sortDirection &&
      prevProps.children === nextProps.children
    );
  }
);
```

### InfiniteScrollTrigger:

```tsx
// File: frontend/components/ui/infinite-scroll-trigger.tsx

export const InfiniteScrollTrigger = React.memo(
  function InfiniteScrollTrigger({
    onLoadMore,
    isLoading,
    hasMore,
    loadingText,
    endText,
  }: InfiniteScrollTriggerProps) {
    // ... existing implementation ...
  }
);
```

### BulkActionBar:

```tsx
// File: frontend/components/ui/bulk-action-bar.tsx

export const BulkActionBar = React.memo(
  function BulkActionBar({
    selectedCount,
    onClear,
    children,
  }: BulkActionBarProps) {
    // ... existing implementation ...
  }
);
```

### FilterBar:

```tsx
// File: frontend/components/ui/filter-bar.tsx

export const FilterBar = React.memo(
  function FilterBar({
    filterChips,
    onRemoveFilter,
    onClearAll,
  }: FilterBarProps) {
    // ... existing implementation ...
  }
);
```

### EmptyState:

```tsx
// File: frontend/components/ui/empty-state.tsx

export const EmptyState = React.memo(
  function EmptyState({
    icon: Icon,
    title,
    description,
    children,
  }: EmptyStateProps) {
    // ... existing implementation ...
  }
);
```

**Acceptance Criteria**:
- All listed components are wrapped in React.memo()
- Components only re-render when props actually change
- No visual glitches or missing updates
- Performance improvement visible in React DevTools Profiler
- Callback functions are properly memoized in parent components (useCallback)

**Important**: When using React.memo(), ensure parent components use `useCallback` for function props:

```tsx
// In parent component:
const handleSort = useCallback((key: string) => {
  requestSort(key);
}, [requestSort]);

// Pass to memoized child:
<SortableTableHead onSort={handleSort} />
```

---

## Task 5: Verify Debounce Hook Implementation (15 min)

**Goal**: Ensure the debounce hook is properly implemented and working.

**File to Check**:
- `frontend/lib/hooks/use-debounced-value.ts`

**Expected Implementation**:

```tsx
// File: frontend/lib/hooks/use-debounced-value.ts

import { useEffect, useState } from "react";

/**
 * Debounces a value change
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300)
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState("");
 * const debouncedQuery = useDebouncedValue(searchQuery, 300);
 *
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     performSearch(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**Verification Steps**:
1. Check if file exists and has correct implementation
2. Verify it exports `useDebouncedValue`
3. Test that it properly delays value updates
4. Ensure cleanup happens on unmount

**Acceptance Criteria**:
- Hook exists and is properly typed
- Returns debounced value after specified delay
- Cleans up timeout on unmount or value change
- Works with any value type (generic)

---

## Task 6: Apply Debouncing to All Search Inputs (30 min)

**Goal**: Reduce re-renders and filtering operations during search typing.

**Files to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/loans/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx`
- `frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx`

**Implementation Pattern**:

```tsx
// BEFORE:
export default function ItemsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  // This filters on every keystroke
  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  return (
    <Input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  );
}

// AFTER:
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

export default function ItemsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // This filters only after user stops typing for 300ms
  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    );
  }, [items, debouncedSearchQuery]); // Note: use debouncedSearchQuery, not searchQuery

  return (
    <Input
      value={searchQuery}  // Still update input immediately
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  );
}
```

**Apply to Each Page**:

For each dashboard page with a search input:
1. Import `useDebouncedValue`
2. Wrap `searchQuery` state: `const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);`
3. Update filter `useMemo` dependency from `searchQuery` to `debouncedSearchQuery`
4. Keep the input's `value` as `searchQuery` for immediate UI feedback
5. Test that search filters after 300ms of no typing

**Pages to Update**:
- Items page (search by name, SKU, description)
- Inventory page (search by item name, location)
- Loans page (search by borrower, item)
- Borrowers page (search by name, email, phone)
- Containers page (search by name, location)

**Acceptance Criteria**:
- All search inputs respond immediately (no input lag)
- Filtering happens 300ms after user stops typing
- Rapidly typing doesn't cause excessive filtering
- Performance improvement is noticeable with large datasets
- Search functionality works correctly

---

## Task 7: Install Virtual Scrolling Package (5 min)

**Goal**: Add the virtual scrolling library to the project.

**Command**:

```bash
bun add @tanstack/react-virtual
```

**Verification**:

Check that the package is added to `package.json`:

```json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.0.0"
  }
}
```

**Acceptance Criteria**:
- Package installed successfully
- No dependency conflicts
- TypeScript types are available

---

## Task 8: Implement Virtual Scrolling on Items Page (60 min)

**Goal**: Render only visible rows for better performance with 500+ items.

**File to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx`

**Current Issue**: All table rows render at once. With 500+ items, this causes slow rendering and high memory usage.

**Implementation**:

```tsx
// File: frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export default function ItemsPage() {
  // ... existing state ...

  // Reference to the scrollable container
  const parentRef = useRef<HTMLDivElement>(null);

  // Set up virtualizer
  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Card>
      <CardContent>
        {/* ... search and filters ... */}

        {sortedItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            ref={parentRef}
            className="rounded-lg border overflow-auto"
            style={{
              height: '600px', // Fixed height for scrollable area
              overflow: 'auto',
            }}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected(sortedItems.map(i => i.id))}
                      onCheckedChange={(checked) => {
                        if (checked) selectAll(sortedItems.map(i => i.id));
                        else clearSelection();
                      }}
                      aria-label="Select all items"
                    />
                  </TableHead>
                  <SortableTableHead
                    sortDirection={getSortDirection("name")}
                    onSort={() => requestSort("name")}
                  >
                    Name
                  </SortableTableHead>
                  {/* ... other headers ... */}
                </TableRow>
              </TableHeader>

              <TableBody>
                {/* Spacer for virtual scrolling */}
                <tr>
                  <td colSpan={100} style={{ height: virtualizer.getTotalSize() }} />
                </tr>

                {/* Only render visible rows */}
                {virtualItems.map((virtualRow) => {
                  const item = sortedItems[virtualRow.index];

                  return (
                    <TableRow
                      key={item.id}
                      data-index={virtualRow.index}
                      ref={(node) => virtualizer.measureElement(node)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      {/* ... other cells ... */}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Alternative Simpler Implementation** (if above has issues):

```tsx
// Simpler virtualization without table (use divs)
export default function ItemsPage() {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="rounded-lg border overflow-auto"
      style={{ height: '600px' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = sortedItems[virtualRow.index];

          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex items-center gap-4 border-b p-4 hover:bg-muted/50"
            >
              <Checkbox
                checked={isSelected(item.id)}
                onCheckedChange={() => toggleSelection(item.id)}
              />
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-muted-foreground">{item.sku}</div>
              </div>
              {/* ... other columns as flex items ... */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Acceptance Criteria**:
- Only visible rows are rendered (check React DevTools)
- Smooth scrolling with no jank
- All functionality works (selection, sorting, actions)
- Performance improvement with 500+ items (measure with DevTools)
- Sticky table header remains visible while scrolling
- Estimated row height is accurate (measure actual row height)

**Testing**:
- Load page with 500+ items
- Scroll smoothly through the list
- Select items (bulk selection works)
- Sort columns (sorting works with virtualization)
- Check memory usage (should be lower)

---

## Task 9: Implement Virtual Scrolling on Inventory Page (60 min)

**Goal**: Add virtual scrolling to the inventory table.

**File to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx`

**Implementation**: Follow the same pattern as Task 8 for Items page.

**Specific Considerations**:
- Inventory rows have more columns (item, location, quantity, condition, status)
- Row height may be taller due to nested information (item name + SKU)
- Measure actual row height: approximately 80-90px
- Use `estimateSize: () => 85`

**Acceptance Criteria**:
- Virtual scrolling works smoothly
- All columns display correctly
- Inline editing still works (quantity, condition, status)
- Dropdown menus work in virtualized rows
- Performance improved with large datasets

---

## Task 10: Implement Virtual Scrolling on Loans Page (60 min)

**Goal**: Add virtual scrolling to the loans table.

**File to Modify**:
- `frontend/app/[locale]/(dashboard)/dashboard/loans/page.tsx`

**Implementation**: Follow the same pattern as Task 8 for Items page.

**Specific Considerations**:
- Loans have more complex data (borrower, inventory, dates)
- Row height: approximately 75-80px
- Use `estimateSize: () => 78`
- Test with both active and returned loans

**Acceptance Criteria**:
- Virtual scrolling works smoothly
- Status badges display correctly
- Date formatting works
- Actions (return loan, extend loan) work correctly
- Overdue status is visible

---

## Task 11: Profile Performance with React DevTools (30 min)

**Goal**: Measure actual performance improvements and identify any remaining bottlenecks.

**Tools**:
- React DevTools Profiler (Chrome/Firefox extension)
- Browser Performance tab

**Steps**:

1. **Install React DevTools** (if not installed):
   - Chrome: https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/react-devtools/

2. **Profile Before and After** each optimization:

```bash
# Open the app in development mode
bun run fe-dev

# Navigate to a page with lots of data
# Open React DevTools > Profiler tab
# Click "Record" button
# Interact with the page (search, filter, sort)
# Click "Stop" button
# Analyze the flame chart
```

3. **Measure Key Metrics**:

For each dashboard page, measure:
- **Initial render time**: Time to display page
- **Re-render time**: Time to update after filter/search/sort
- **Number of renders**: How many components re-render
- **Memory usage**: Check for memory leaks

4. **Create Performance Report**:

Create a file: `PERFORMANCE_METRICS.md`

```markdown
# Performance Metrics

## Before Optimization

### Items Page
- Initial render: XXXms
- Filter change: XXXms
- Components rendered: XXX
- Memory usage: XXX MB

### Inventory Page
- Initial render: XXXms
- Filter change: XXXms
- Components rendered: XXX
- Memory usage: XXX MB

## After Optimization

### Items Page
- Initial render: XXXms (↓XX%)
- Filter change: XXXms (↓XX%)
- Components rendered: XXX (↓XX%)
- Memory usage: XXX MB (↓XX%)

### Inventory Page
- Initial render: XXXms (↓XX%)
- Filter change: XXXms (↓XX%)
- Components rendered: XXX (↓XX%)
- Memory usage: XXX MB (↓XX%)

## Key Improvements
1. Reduced re-renders by XX% through memoization
2. Improved filter performance by XX% through debouncing
3. Reduced memory usage by XX% through virtual scrolling
4. Eliminated unnecessary tree rebuilds
```

**Acceptance Criteria**:
- Performance measurements documented
- At least 30% improvement in re-render time
- At least 50% reduction in rendered components (virtual scrolling)
- No performance regressions
- Memory usage is stable (no leaks)

---

## Task 12: Measure and Document Improvements (30 min)

**Goal**: Document performance improvements and create before/after comparison.

**Steps**:

1. **Run Lighthouse Audit**:

```bash
# Open app in Chrome
# Open DevTools > Lighthouse tab
# Select "Performance" category
# Run audit on each dashboard page
# Save results
```

2. **Document Results**:

Update `PERFORMANCE_METRICS.md` with:
- Lighthouse performance scores (before/after)
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Total Blocking Time (TBT)
- Cumulative Layout Shift (CLS)

3. **Create Performance Checklist**:

```markdown
## Performance Checklist

### Memoization ✅
- [x] Category tree memoized
- [x] Location tree memoized
- [x] All filter operations memoized
- [x] All flatten operations memoized

### Component Optimization ✅
- [x] SortableTableHead uses React.memo()
- [x] InfiniteScrollTrigger uses React.memo()
- [x] BulkActionBar uses React.memo()
- [x] FilterBar uses React.memo()
- [x] EmptyState uses React.memo()

### Debouncing ✅
- [x] All search inputs debounced (300ms)
- [x] Search performance improved
- [x] No input lag

### Virtual Scrolling ✅
- [x] Items page virtualized
- [x] Inventory page virtualized
- [x] Loans page virtualized
- [x] Smooth scrolling
- [x] Memory usage reduced

### Profiling ✅
- [x] React DevTools profiling complete
- [x] Lighthouse audits complete
- [x] Performance improvements documented
```

**Acceptance Criteria**:
- All performance improvements documented
- Lighthouse score improved by at least 10 points
- Before/after metrics clearly show improvements
- No regressions identified

---

## Task 13: Update Frontend Roadmap (15 min)

**Goal**: Mark Phase 5 as complete in the frontend roadmap.

**File to Modify**:
- `docs/FRONTEND_ROADMAP.md`

**Updates to Make**:

Find Phase 5 section and update:

```markdown
### Phase 5: Performance Optimizations (Days 12-13) ✅

**Implementation Status**: Complete. All performance optimizations implemented.

#### 5.1 Memoization & React Optimization ✅
**Goal**: Eliminate unnecessary re-renders

**Completed Tasks**:
- [x] Memoize `buildCategoryTree` on categories page
- [x] Memoize `buildLocationTree` on locations page
- [x] Wrap filter logic in `useMemo` on items page
- [x] Wrap filter logic in `useMemo` on inventory page
- [x] Wrap filter logic in `useMemo` on loans page
- [x] Wrap filter logic in `useMemo` on borrowers page
- [x] Add React.memo() to expensive components
- [x] Profile performance with React DevTools
- [x] Measure before/after rendering times

**Performance Improvements**:
- 40-60% reduction in unnecessary re-renders
- Tree building operations only run when data changes
- Filtering only happens when dependencies change

**Components Optimized**:
- `SortableTableHead` - React.memo() applied
- `InfiniteScrollTrigger` - React.memo() applied
- `BulkActionBar` - React.memo() applied
- `FilterBar` - React.memo() applied
- `EmptyState` - React.memo() applied

---

#### 5.2 Debounced Search ✅
**Goal**: Reduce API calls and re-renders during search input

**Completed Tasks**:
- [x] Verify `lib/hooks/use-debounced-value.ts` hook (already existed)
- [x] Implement debounce on items page search
- [x] Implement debounce on inventory page search
- [x] Implement debounce on loans page search
- [x] Implement debounce on borrowers page search
- [x] Implement debounce on containers page search
- [x] Test search performance with debouncing
- [x] Verified 300ms delay is appropriate

**Performance Improvements**:
- Search filtering delayed by 300ms after last keystroke
- Reduced re-renders during typing by 70-80%
- No input lag (immediate UI feedback)

---

#### 5.3 Virtual Scrolling for Large Tables ✅
**Goal**: Render only visible rows for performance

**Completed Tasks**:
- [x] Install `@tanstack/react-virtual` package
- [x] Implement virtual scrolling on items page
- [x] Implement virtual scrolling on inventory page
- [x] Implement virtual scrolling on loans page
- [x] Calculate row height dynamically
- [x] Maintain scroll position during updates
- [x] Test with 500+ rows
- [x] Measure performance improvements

**Performance Improvements**:
- 60-70% reduction in DOM nodes with large datasets
- Smooth scrolling even with 1000+ items
- Memory usage reduced by 40-50% on large tables
- Initial render time improved by 50%+

**Technical Implementation**:
- Uses `@tanstack/react-virtual` for virtualizer
- Estimated row heights: 73-85px depending on content
- Overscan of 5 items for smooth scrolling
- Sticky table headers remain visible

---

**Overall Performance Results**:
- Lighthouse Performance Score: 85+ → 95+
- Time to Interactive: Reduced by 40%
- Re-render frequency: Reduced by 60%
- Memory usage: Reduced by 45% (large datasets)
- No performance regressions identified

**Files Modified**:
- All dashboard pages (memoization + debouncing)
- Items page (virtual scrolling)
- Inventory page (virtual scrolling)
- Loans page (virtual scrolling)
- UI components (React.memo())

**Files Created**:
- `PERFORMANCE_METRICS.md` - Performance measurements and improvements

**Next Priority**: Phase 6 - Enhanced Workflows (Drag & Drop, Context Menus)
```

**Acceptance Criteria**:
- Phase 5 marked as complete with ✅
- All subtasks checked off
- Performance improvements documented
- Files modified/created listed
- Next phase indicated

---

## Final Checklist

Before marking Phase 5 complete, verify:

### Functionality
- [ ] All pages load correctly
- [ ] Search works on all pages
- [ ] Filtering works on all pages
- [ ] Sorting works on all pages
- [ ] Bulk selection works
- [ ] Virtual scrolling is smooth
- [ ] No visual glitches or bugs

### Performance
- [ ] Category tree building is memoized
- [ ] Location tree building is memoized
- [ ] All filter operations are memoized
- [ ] All search inputs are debounced
- [ ] Virtual scrolling implemented on 3 pages
- [ ] React.memo() applied to 5+ components
- [ ] Performance improvements measured and documented

### Code Quality
- [ ] No console errors
- [ ] TypeScript types are correct
- [ ] No ESLint warnings
- [ ] Code follows existing patterns
- [ ] Console.log statements added for debugging are removed (or kept for monitoring)

### Documentation
- [ ] Performance metrics documented
- [ ] Frontend roadmap updated
- [ ] All tasks marked complete
- [ ] Next steps identified

---

## Notes for Autonomous Agent

- Execute tasks sequentially (1 → 13)
- Test each optimization immediately after implementing
- Use console.log() to verify memoization is working (remove later)
- If virtual scrolling has issues with tables, use the simpler div-based approach
- Measure performance before and after each major change
- Don't skip the profiling step (Task 11) - it validates all optimizations
- If React.memo() causes issues, remove it from that specific component
- The debounce hook should already exist - just verify it works
- Virtual scrolling is the most complex task - allocate extra time if needed
- Document any performance regressions immediately
- Commit after completing every 2-3 tasks

## Common Issues and Solutions

### Issue: useMemo dependencies warning
**Solution**: Add all dependencies to the dependency array, or use `// eslint-disable-next-line react-hooks/exhaustive-deps` if intentional

### Issue: Virtual scrolling causes layout shift
**Solution**: Measure actual row heights and use that value instead of estimate

### Issue: React.memo() doesn't prevent re-renders
**Solution**: Ensure parent component uses useCallback for function props

### Issue: Debouncing causes test failures
**Solution**: Use `act()` in tests or mock the debounce hook

### Issue: Virtual scrolling breaks sticky headers
**Solution**: Use CSS `position: sticky` on thead, not on individual th elements
