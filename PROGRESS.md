# Progress - Quick Access Features

## Completed

### 1. Recently Modified
- Already implemented (`GET /dashboard/recent`)

### 2. Location Breadcrumbs
- Created `frontend/components/ui/location-breadcrumb.tsx`
- Integrated into inventory detail page

### 3. Favorites Feature
**Backend:**
- Created `backend/src/warehouse/domain/favorites/` module (models, schemas, repository, service, controllers)
- Registered controller in `app.py`
- Unit tests passing (8 tests)

**Frontend:**
- Created `frontend/components/ui/favorite-button.tsx`
- Created `frontend/app/[locale]/dashboard/favorites/page.tsx`
- Added `favoritesApi` to `frontend/lib/api.ts`
- Added favorites to sidebar menu
- Integrated favorite button into items list and inventory detail page
- Added translations (EN, ET, RU)

### 4. README Updated
- Marked "Quick access features" as complete

### 5. Dashboard Alert Links
**Implemented filters:**
- Loans page: `?filter=overdue` - Shows only overdue loans
- Inventory page: `?filter=low-stock` - Shows items with quantity <= 5

**Implementation details:**
- Loans: Added `showOverdueOnly` state, `filteredLoans` memo, "Overdue" toggle button
- Inventory: Added `showLowStockOnly` state, `filteredInventory` memo, "Low Stock" toggle button

**Not implemented (future work):**
- `?filter=expiring` - Requires extending Inventory API to include expiration_date
- `?filter=warranty` - Requires extending Inventory API to include warranty_expires

---

## Verified

- Frontend build passes with no type errors (`mise run fe-build`)
- All filter links functional for implemented filters

---

## Future Enhancements

1. **Expiring/Warranty filters** - Extend Inventory API to include `expiration_date` and `warranty_expires` fields
2. **Optional**: Add E2E test for favorites flow (`backend/e2e/test_favorites_flow.py`)
