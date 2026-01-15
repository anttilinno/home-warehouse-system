# Manual Testing Guide: Infinite Scroll Pagination

## Overview

This guide provides instructions for manually testing the infinite scroll pagination feature implemented across all dashboard pages.

## Prerequisites

- Backend server running (`mise run dev`)
- Frontend server running (`mise run fe-dev`)
- PostgreSQL database running (`mise run dc-up`)
- Test data seeded in the database

## Test Data Setup

### Option 1: Using the Database Seeder

The project includes a database seeder CLI tool that can generate test data:

```bash
# Seed with default amounts (good for basic testing)
mise run seed

# Seed with custom amounts for stress testing
cd backend
go run cmd/seeder/main.go \
  --users 5 \
  --workspaces 2 \
  --categories 20 \
  --locations 30 \
  --items 250 \
  --inventory 300 \
  --borrowers 50 \
  --loans 100
```

### Option 2: Manual Data Entry via UI

For smaller datasets, you can create items manually through the dashboard UI to test the feature incrementally.

## Pages to Test

Infinite scroll has been implemented on the following dashboard pages:

1. **Items** (`/dashboard/items`)
2. **Inventory** (`/dashboard/inventory`)
3. **Loans** (`/dashboard/loans`)
4. **Borrowers** (`/dashboard/borrowers`)
5. **Containers** (`/dashboard/containers`)

## Test Cases

### 1. Basic Infinite Scroll (All Pages)

**Test Steps:**
1. Navigate to each dashboard page
2. Scroll down to the bottom of the table
3. Observe the loading indicator appears
4. Wait for new items to load
5. Continue scrolling to load more batches

**Expected Behavior:**
- Initial load shows first 50 items
- Loading spinner appears when scrolling near bottom
- Next 50 items load automatically
- No duplicate items appear
- Scroll position maintains smoothly
- "Load More" button appears if auto-load fails

**Success Criteria:**
- ✅ Items load in batches of 50
- ✅ Loading indicator is visible during fetch
- ✅ No flickering or layout shifts
- ✅ Scroll position doesn't jump
- ✅ Performance remains smooth with 200+ items

### 2. Search + Infinite Scroll

**Test Steps:**
1. Navigate to Items page
2. Enter a search query (e.g., "laptop")
3. Scroll through filtered results
4. Clear search and scroll again

**Expected Behavior:**
- Search filters items correctly
- Infinite scroll works with filtered results
- Clearing search resets to full list
- Scroll state resets when search changes

**Success Criteria:**
- ✅ Search results paginate correctly
- ✅ No items from previous search appear
- ✅ Loading indicator works with search
- ✅ Empty state shows when no results found

### 3. Sort + Infinite Scroll (Items Page)

**Test Steps:**
1. Navigate to Items page
2. Click a column header to sort (e.g., "Name")
3. Scroll down to load more items
4. Verify sort order is maintained
5. Change sort direction and test again

**Expected Behavior:**
- Sorting works correctly on loaded items
- New items loaded maintain sort order
- Sort indicator (arrow) shows current state
- Clicking same column toggles direction

**Success Criteria:**
- ✅ Sort order is consistent across all loaded items
- ✅ Client-side sorting performs well
- ✅ Sort state persists during scrolling

### 4. Performance Testing (200+ Items)

**Test Steps:**
1. Seed database with 250+ items
2. Navigate to Items page
3. Scroll continuously to load all pages
4. Measure page responsiveness
5. Check browser memory usage
6. Test on different devices/browsers

**Expected Behavior:**
- Initial page load is fast (< 2 seconds)
- Each scroll load completes quickly (< 1 second)
- UI remains responsive throughout
- No memory leaks after loading all items
- Smooth scrolling even with 200+ rendered items

**Success Criteria:**
- ✅ Page load time < 2 seconds
- ✅ Scroll fetch time < 1 second
- ✅ No UI freezing or stuttering
- ✅ Memory usage stable (no leaks)
- ✅ Smooth on mobile devices

### 5. Edge Cases

#### Test Case 5.1: Less Than 50 Items
**Steps:**
1. Create a workspace with < 50 items
2. Navigate to Items page
3. Scroll to bottom

**Expected:**
- All items load immediately
- No loading indicator appears
- No "Load More" button
- End of list indicator shows

#### Test Case 5.2: Exactly 50 Items
**Steps:**
1. Create exactly 50 items
2. Navigate to Items page
3. Scroll to bottom

**Expected:**
- All 50 items visible
- Loading indicator briefly appears
- Empty response received
- End of list indicator shows

#### Test Case 5.3: Network Error During Load
**Steps:**
1. Open browser DevTools
2. Navigate to Items page
3. Scroll to trigger load
4. Throttle network to "Offline" during fetch
5. Click "Load More" button after error

**Expected:**
- Error message appears
- "Load More" button with retry option shows
- Clicking retry re-attempts the fetch
- Previous items remain visible

#### Test Case 5.4: Rapid Scrolling
**Steps:**
1. Navigate to Items page with 200+ items
2. Scroll very quickly to the bottom
3. Observe loading behavior

**Expected:**
- Debouncing prevents duplicate requests
- Only one fetch happens at a time
- Items load sequentially
- No race conditions or duplicates

### 6. Mobile/Responsive Testing

**Test Steps:**
1. Open dashboard on mobile device or resize browser
2. Test infinite scroll with touch gestures
3. Verify loading states are visible
4. Test with slow 3G connection

**Expected Behavior:**
- Touch scrolling works smoothly
- Loading indicator is appropriately sized
- Tables are horizontally scrollable
- Performance acceptable on slow connections

**Success Criteria:**
- ✅ Touch scrolling triggers pagination
- ✅ Loading states visible on small screens
- ✅ No horizontal overflow issues
- ✅ Acceptable performance on 3G

## Browser Compatibility Testing

Test on the following browsers:

- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Performance Metrics to Monitor

### Frontend Performance

Open browser DevTools > Performance tab:

- **First Contentful Paint (FCP)**: Should be < 1 second
- **Largest Contentful Paint (LCP)**: Should be < 2.5 seconds
- **Interaction to Next Paint (INP)**: Should be < 200ms
- **Cumulative Layout Shift (CLS)**: Should be 0 (no layout shifts)

### Network Performance

Open browser DevTools > Network tab:

- **Initial page load**: Should fetch only first 50 items
- **Scroll load**: Each fetch should be ~50 items
- **Request rate**: Should not exceed 1 request per second
- **Payload size**: Should be reasonable (< 100KB per request)

### Memory Performance

Open browser DevTools > Memory tab:

1. Take heap snapshot at page load
2. Scroll to load 200+ items
3. Take another heap snapshot
4. Compare memory usage

**Expected:** Memory increase should be proportional to items loaded (no leaks)

## Common Issues and Troubleshooting

### Issue: Items appear duplicated

**Possible Causes:**
- Race condition in API requests
- State not properly deduplicating items
- Backend returning wrong page offset

**Debug:**
- Check Network tab for duplicate requests
- Verify `page` parameter is incrementing correctly
- Check React DevTools for state updates

### Issue: Loading spinner doesn't appear

**Possible Causes:**
- Intersection Observer not triggering
- Loading state not updating
- CSS hiding the spinner

**Debug:**
- Check if `isLoading` state is true in React DevTools
- Verify InfiniteScrollTrigger component is rendered
- Check CSS for `display: none` or `visibility: hidden`

### Issue: "Load More" button doesn't work

**Possible Causes:**
- onClick handler not wired correctly
- Network error preventing retry
- State not resetting after error

**Debug:**
- Check browser console for errors
- Verify onClick handler in React DevTools
- Check Network tab for failed requests

### Issue: Performance degradation with many items

**Possible Causes:**
- Too many DOM nodes (> 500)
- Inefficient re-renders
- Large images not optimized
- No virtualization

**Debug:**
- Profile with React DevTools Profiler
- Check for unnecessary re-renders
- Consider implementing virtual scrolling for 500+ items

## Reporting Issues

When reporting issues, please include:

1. **Browser and version** (e.g., Chrome 120.0.6099.129)
2. **Device** (e.g., MacBook Pro M1, iPhone 14)
3. **Steps to reproduce** (detailed)
4. **Expected vs actual behavior**
5. **Screenshots or screen recording**
6. **Console errors** (from browser DevTools)
7. **Network requests** (from DevTools Network tab)

## Test Results Template

```markdown
## Test Session: [Date]

**Tester:** [Name]
**Environment:** [Dev/Staging/Production]
**Browser:** [Browser + Version]
**Device:** [Device Name]

### Items Page
- [ ] Basic infinite scroll
- [ ] Search + scroll
- [ ] Sort + scroll
- [ ] Performance (200+ items)
- [ ] Edge cases

### Inventory Page
- [ ] Basic infinite scroll
- [ ] Performance (200+ items)

### Loans Page
- [ ] Basic infinite scroll
- [ ] Performance (100+ loans)

### Borrowers Page
- [ ] Basic infinite scroll
- [ ] Performance (50+ borrowers)

### Containers Page
- [ ] Basic infinite scroll
- [ ] Performance (100+ containers)

### Issues Found
1. [Issue description]
2. [Issue description]

### Performance Notes
- FCP: [time]
- LCP: [time]
- INP: [time]
- Memory: [usage]

### Overall Assessment
[Pass/Fail] - [Comments]
```

## Next Steps After Testing

Once manual testing is complete:

1. Document any bugs found in GitHub issues
2. Update this guide with any new test cases discovered
3. Consider adding automated E2E tests for critical flows
4. Monitor production metrics after deployment
5. Collect user feedback on the new pagination experience

## Notes

- The infinite scroll feature loads **50 items per page** by default
- Backend supports pagination with `page` and `limit` query params
- Maximum `limit` is **100 items** (enforced by backend validation)
- Frontend uses Intersection Observer API for scroll detection
- Fallback "Load More" button provided for browsers without observer support
