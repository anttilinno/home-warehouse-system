# Architecture Research: Mobile UX Features (v1.3)

**Project:** Home Warehouse System - v1.3 Mobile UX Overhaul
**Researched:** 2026-01-25
**Overall Confidence:** MEDIUM (library choices verified via web search, integration patterns based on codebase analysis)

## Executive Summary

This research examines how barcode scanning, fuzzy search, and mobile gestures integrate with the existing Next.js 16 / React 19 / shadcn/ui PWA architecture. The existing codebase has solid foundations: IndexedDB offline storage (idb v8), sync infrastructure with iOS fallback, camera-based photo upload, and a command palette (cmdk). New features build on these patterns rather than requiring architectural changes.

Key findings:
1. **Barcode scanning**: Use `html5-qrcode` or `react-zxing` - both integrate with existing camera permission patterns from photo-upload.tsx
2. **Fuzzy search**: Add Fuse.js for client-side search against IndexedDB data - complements existing server-side search in search.ts
3. **FAB/Radial menu**: Build custom using shadcn/ui Button + @use-gesture/react - no good shadcn-native option exists
4. **Progressive disclosure forms**: Extend existing react-hook-form + zod patterns with accordion/stepper components

## Integration Points

### Existing Architecture Components

| Component | Location | Integration Point |
|-----------|----------|-------------------|
| IndexedDB stores | `lib/db/offline-db.ts` | Items, inventory, locations, containers, categories, borrowers - all searchable offline |
| Global search API | `lib/api/search.ts` | Server-side search across entities, transform to SearchResult type |
| Search hook | `lib/hooks/use-global-search.ts` | Debounced search, recent searches, keyboard navigation |
| Command palette | `components/ui/command-palette.tsx` | Uses cmdk library, CommandDialog pattern |
| Photo upload | `components/items/photo-upload.tsx` | Camera access pattern, getUserMedia, file validation |
| Sync manager | `lib/sync/sync-manager.ts` | Mutation queue, offline-first patterns |
| Form patterns | `features/auth/components/login-form.tsx` | react-hook-form + zod + shadcn/ui |
| Sidebar navigation | `components/dashboard/sidebar.tsx` | Navigation structure, badge patterns |

### Existing Dependencies Relevant to Mobile UX

From `frontend/package.json`:
- `cmdk: ^1.1.1` - Command palette UI
- `@use-gesture/react` - NOT present, needs to be added
- `react-hook-form: ^7.70.0` - Form management
- `zod: ^4.3.5` - Schema validation
- `idb: 8.0.3` - IndexedDB wrapper
- `lucide-react: ^0.562.0` - Icons

### New Feature Integration Map

```
+------------------+     +-------------------+     +------------------+
|  Barcode Scanner |---->| Quick Action Menu |---->| Entity Detail/   |
|  (Camera API)    |     | (Post-scan flow)  |     | Create Form      |
+------------------+     +-------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +-------------------+     +------------------+
| html5-qrcode or  |     | Radial Menu       |     | Progressive      |
| react-zxing      |     | Component         |     | Disclosure Form  |
+------------------+     +-------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +-------------------+     +------------------+
| Existing camera  |     | @use-gesture +    |     | Existing react-  |
| permission       |     | shadcn Button     |     | hook-form + zod  |
+------------------+     +-------------------+     +------------------+

+------------------+     +-------------------+
|  Fuzzy Search    |---->| Search Results    |
|  (Fuse.js)       |     | UI                |
+------------------+     +-------------------+
        |                        |
        v                        v
+------------------+     +-------------------+
| IndexedDB data   |     | Existing command  |
| (offline-first)  |     | + global-search   |
+------------------+     +-------------------+
```

## New Components

### 1. Barcode Scanner Component

**Location:** `components/scanner/barcode-scanner.tsx`

**Dependencies to add:**
- `html5-qrcode` (recommended - better permission handling, ~15KB gzipped) OR
- `react-zxing` (alternative - hooks-based API, uses @zxing/library)

**Why html5-qrcode over react-zxing:**
- Better camera permission handling and device selection
- End-to-end scanner UI available (Html5QrcodeScanner)
- Remembers previously granted permissions
- Better documentation for PWA scenarios

**Integration with existing:**
- Reuse camera permission patterns from `photo-upload.tsx` which uses `navigator.mediaDevices.getUserMedia`
- Use existing `useNetworkStatus` hook for offline awareness
- Store scan history in new IndexedDB store or localStorage

**Component structure:**
```typescript
// components/scanner/barcode-scanner.tsx
interface BarcodeScannerProps {
  onScan: (result: ScanResult) => void;
  onError: (error: Error) => void;
  enabled?: boolean;
}

// components/scanner/scan-result-handler.tsx
// Looks up scanned code against items.short_code, containers.short_code, locations.short_code
// Shows quick action menu on match

// lib/hooks/use-barcode-scanner.ts
// Wraps html5-qrcode with React state management
// Handles permission state, camera selection, torch control
```

**iOS PWA Considerations (CRITICAL):**
- Camera permissions NOT persisted in iOS PWA standalone mode (WebKit bug #185448)
- Workaround: Show inline permission prompt explaining repeat permission requests
- Alternative: Detect `display-mode: standalone` and suggest Safari for better experience
- Another workaround: Remove `apple-mobile-web-app-capable` meta tag (forces Safari mode)

### 2. Fuzzy Search Module

**Location:** `lib/search/fuzzy-search.ts`

**Dependencies to add:**
- `fuse.js` (lightweight, zero dependencies, ~4KB gzipped)

**Integration with existing:**
- Enhance `use-global-search.ts` to support dual-mode (online: server, offline: Fuse.js)
- Build Fuse index from IndexedDB stores on initial load
- Update index on sync events via SyncManager subscription

**Component structure:**
```typescript
// lib/search/fuzzy-search.ts
export function createFuseIndex(items: Item[], options?: FuseOptions): Fuse<Item>

// lib/search/offline-search.ts
export async function offlineGlobalSearch(
  query: string,
  limit?: number
): Promise<GlobalSearchResponse>
// Searches across IndexedDB stores using Fuse.js

// lib/hooks/use-global-search.ts (enhanced)
// Add offline detection via useNetworkStatus
// Switch to offlineGlobalSearch when offline
// Merge with existing recentSearches functionality
```

**Fuse.js Configuration (recommended):**
```typescript
const fuseOptions = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'sku', weight: 1.5 },
    { name: 'short_code', weight: 1.5 },
    { name: 'brand', weight: 1 },
    { name: 'model', weight: 1 },
    { name: 'description', weight: 0.5 },
  ],
  threshold: 0.3, // Stricter than default 0.6 - 0.2 is sweetspot per community
  includeScore: true,
  minMatchCharLength: 2,
};
```

**Performance consideration:** For datasets > 10,000 items, consider Web Worker. For typical home inventory (< 10,000), direct search is fast enough with debounce.

### 3. FAB with Radial Menu

**Location:** `components/mobile/floating-action-button.tsx`

**Dependencies to add:**
- `@use-gesture/react` (~6KB gzipped) - for touch/swipe gestures

**Why custom vs library:**
- `react-pie-menu` exists but has different visual style, not actively maintained
- shadcn/ui has no FAB component
- Custom allows matching existing design system (Tailwind, shadcn patterns)
- Full control over animations and touch gestures

**Component structure:**
```typescript
// components/mobile/floating-action-button.tsx
interface FABProps {
  actions: FABAction[];
  position?: 'bottom-right' | 'bottom-center';
  variant?: 'radial' | 'speed-dial';
}

interface FABAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  color?: string;
}

// Example actions for inventory app:
const fabActions: FABAction[] = [
  { id: 'scan', icon: Scan, label: 'Scan', onSelect: openScanner },
  { id: 'add-item', icon: Plus, label: 'Add Item', onSelect: openAddItem },
  { id: 'search', icon: Search, label: 'Search', onSelect: openSearch },
  { id: 'log-loan', icon: HandCoins, label: 'Log Loan', onSelect: openLoanForm },
];
```

**Animation approach:**
- Use CSS transforms for radial positioning (calc-based arc positions)
- @use-gesture/react for drag-to-dismiss, long-press to activate
- Tailwind CSS animations for open/close transitions
- Consider framer-motion only if more complex animations needed

### 4. Progressive Disclosure Forms

**Location:** `components/forms/` (new directory)

**Dependencies:** None new - extend existing react-hook-form + zod patterns

**Integration with existing:**
- Build on patterns from `login-form.tsx` (react-hook-form + zodResolver)
- Use existing shadcn/ui components (Input, Label, Button, Select)
- Add new components: Accordion (from shadcn/ui), custom Stepper

**Component structure:**
```typescript
// components/forms/multi-step-form.tsx
interface MultiStepFormProps<T> {
  steps: FormStep<T>[];
  onSubmit: (data: T) => Promise<void>;
  initialValues?: Partial<T>;
}

interface FormStep<T> {
  id: string;
  title: string;
  fields: (keyof T)[];
  validation: ZodSchema;
  isOptional?: boolean;
}

// components/forms/collapsible-section.tsx
// For grouping related fields in single-page forms
// Uses shadcn Accordion pattern

// components/forms/inline-photo-capture.tsx
// Combines photo-upload patterns with form field
// Mobile-optimized: camera opens inline, not in modal

// components/forms/smart-picker.tsx
// Enhanced Select for mobile:
// - Search within options
// - Recent selections
// - Create new inline
```

**Mobile form patterns to implement:**
1. **Inline validation** (already exists in login-form.tsx)
2. **Auto-advance** on selection fields
3. **Smart keyboard handling** (inputMode, autoComplete attributes)
4. **Thumb-zone optimization** (primary actions at bottom)
5. **Swipe to dismiss** for modals (via @use-gesture/react)

### 5. Quick Action Menu (Post-Scan)

**Location:** `components/scanner/quick-action-menu.tsx`

**Purpose:** After scanning a barcode, show context-aware actions based on what was scanned.

**Component structure:**
```typescript
// components/scanner/quick-action-menu.tsx
interface QuickActionMenuProps {
  scanResult: ScanLookupResult;
  onAction: (action: QuickAction) => void;
  onDismiss: () => void;
}

type ScanLookupResult =
  | { type: 'item'; item: Item }
  | { type: 'container'; container: Container }
  | { type: 'location'; location: Location }
  | { type: 'unknown'; code: string };

// Actions vary by entity type:
// Item: View details, Add to inventory, Log loan
// Container: View contents, Add items, Move
// Location: View items, Add container
// Unknown: Create new item with pre-filled short_code
```

**UI pattern:** Sheet (bottom drawer) from shadcn/ui - already in codebase

## Data Flow Changes

### Current Search Flow (Online Only)

```
User types query
       |
       v
useGlobalSearch (debounced 300ms)
       |
       v
globalSearch API call (lib/api/search.ts)
       |
       v
Backend PostgreSQL full-text search
       |
       v
SearchResult[] response
       |
       v
UI renders results (command-palette or global-search-results)
```

### New Search Flow (Hybrid Online/Offline)

```
User types query
       |
       v
useGlobalSearch (enhanced)
       |
       +---> Online? --> globalSearch API call
       |                        |
       |                        v
       |                 Backend search
       |                        |
       +---> Offline? -> offlineGlobalSearch
       |                        |
       |                        v
       |                 Fuse.js against IndexedDB
       |                        |
       v                        v
Merge/prioritize results
       |
       v
SearchResult[] (normalized to same format)
       |
       v
UI renders (same component, unaware of source)
```

### Barcode Scan Flow

```
User opens scanner (via FAB or nav)
       |
       v
Camera permission check
       |
       +---> Denied --> Show permission instructions (iOS-specific messaging)
       |
       v
html5-qrcode starts streaming
       |
       v
Barcode detected (any format: QR, EAN, UPC, etc.)
       |
       v
Lookup in IndexedDB (items, containers, locations by short_code)
       |
       +---> Found --> QuickActionMenu with entity context
       |
       +---> Not found --> QuickActionMenu with "Create new" option
       |
       v
User selects action
       |
       v
Navigate to entity detail or form
```

### Form Submission Flow (Progressive Disclosure)

```
User opens multi-step form
       |
       v
Step 1: Required fields only
       |
       v
Local validation (zod per-step schema)
       |
       +---> Invalid --> Show errors, stay on step
       |
       v
Step 2: Optional fields (collapsed by default, expand on tap)
       |
       v
Submit
       |
       +---> Online --> POST to API
       |
       +---> Offline --> Queue mutation (existing SyncManager pattern)
       |
       v
Optimistic UI update (existing pattern)
       |
       v
Sync when online (existing SyncManager handles)
```

## Suggested Build Order

Based on dependency analysis and integration complexity:

### Phase 1: Foundation (Search Infrastructure)

1. **Fuzzy search infrastructure**
   - Add Fuse.js dependency: `bun add fuse.js`
   - Create `lib/search/fuzzy-search.ts` - index builders per entity
   - Create `lib/search/offline-search.ts` - search across all stores
   - Enhance `use-global-search.ts` with offline mode detection
   - **Why first:** Enables offline search for scanner lookup

2. **Enhanced search UI**
   - Add recent items section to command palette
   - Add smart suggestions (entity type icons, frequency-based)
   - Mobile-optimize existing search UI (larger touch targets)
   - **Builds on:** Fuzzy search infrastructure

### Phase 2: Barcode Scanning

3. **Barcode scanner component**
   - Add html5-qrcode dependency: `bun add html5-qrcode`
   - Create `lib/hooks/use-barcode-scanner.ts`
   - Create `components/scanner/barcode-scanner.tsx`
   - Handle iOS PWA permission quirks with inline messaging
   - **Why after search:** Uses search infrastructure for code lookup

4. **Quick action menu**
   - Create `components/scanner/quick-action-menu.tsx`
   - Entity lookup logic (by short_code field)
   - Context-aware action sets per entity type
   - **Builds on:** Barcode scanner, Sheet component

### Phase 3: Mobile Navigation

5. **FAB component**
   - Add @use-gesture/react dependency: `bun add @use-gesture/react`
   - Create `components/mobile/floating-action-button.tsx`
   - Radial menu animation with CSS transforms
   - **Independent:** Can be built in parallel with Phase 2

6. **FAB integration**
   - Wire FAB actions to scanner, search, forms
   - Position and visibility logic (hide on scroll, show on dashboard)
   - Mobile breakpoint detection for FAB visibility
   - **Builds on:** FAB component, scanner, search

### Phase 4: Form Improvements

7. **Progressive disclosure form components**
   - Create `components/forms/multi-step-form.tsx`
   - Create `components/forms/collapsible-section.tsx`
   - Mobile keyboard handling (inputMode, autoComplete)
   - **Independent:** Uses existing react-hook-form patterns

8. **Entity form overhauls**
   - Apply progressive disclosure to item creation
   - Apply to inventory creation (complex with location/container dependencies)
   - Inline photo capture for item forms
   - **Builds on:** Progressive disclosure components

### Dependency Graph

```
Phase 1: Foundation
  [Fuse.js dep] --> [Fuzzy search] --> [Enhanced search UI]
                          |
                          v (provides offline lookup)
Phase 2: Scanning
  [html5-qrcode dep] --> [Scanner component] --> [Quick action menu]
                                ^
                                |
                         [Fuzzy search] (code lookup)

Phase 3: Mobile Nav
  [@use-gesture dep] --> [FAB component] --> [FAB integration]
                                                    ^
                                                    |
                              [Scanner, Search] (wired as actions)

Phase 4: Forms
  [react-hook-form (existing)] --> [Progressive form components] --> [Entity forms]
                                                                          ^
                                                                          |
                                              [Photo upload (existing)] (inline capture)
```

## Technical Considerations

### Camera Access on iOS PWA

| Scenario | Behavior | Mitigation |
|----------|----------|------------|
| Safari browser | Permission persisted | Best experience |
| iOS PWA (standalone) | Permission reprompted each session | Show inline explanation |
| iOS Chrome/Firefox | Uses WebKit, same as Safari | N/A |
| Android PWA | Permission persisted | Best experience |

**Recommendation:** Detect `display-mode: standalone` via `window.matchMedia` and show persistent banner explaining camera permission behavior on iOS.

```typescript
const isStandalonePWA = window.matchMedia('(display-mode: standalone)').matches;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
if (isStandalonePWA && isIOS) {
  // Show camera permission explainer
}
```

### IndexedDB Search Performance

| Dataset Size | Fuse.js Search Time | Recommendation |
|--------------|---------------------|----------------|
| < 1,000 items | < 10ms | Direct search |
| 1,000 - 10,000 | 10-50ms | Acceptable with 300ms debounce |
| > 10,000 | > 50ms | Consider Web Worker |

**Recommendation:** For v1.3, assume < 10,000 items per workspace. Add Web Worker implementation in future if needed.

### Bundle Size Impact

| Dependency | Size (gzipped) | Justification |
|------------|----------------|---------------|
| fuse.js | ~4KB | Essential for offline search |
| html5-qrcode | ~15KB | Required for scanning |
| @use-gesture/react | ~6KB | Enables mobile gestures |
| **Total** | ~25KB | Acceptable for PWA |

### Offline-First Patterns

All new features must follow existing patterns from `sync-manager.ts`:

1. **Check online status** via `useNetworkStatus` hook before API calls
2. **Queue mutations** for offline create/update via `useOfflineMutation` hook
3. **Show sync status** via existing `SyncStatusIndicator` component
4. **Handle conflicts** via existing `ConflictResolutionDialog`

The SyncManager subscription pattern allows new components to react to sync events:
```typescript
useEffect(() => {
  return syncManager?.subscribe((event) => {
    if (event.type === 'MUTATION_SYNCED') {
      // Refresh local state / Fuse index
    }
  });
}, []);
```

## Component Files Summary

### New Files to Create

```
frontend/
  components/
    scanner/
      barcode-scanner.tsx         # Main scanner component
      quick-action-menu.tsx       # Post-scan action sheet
      camera-permission-banner.tsx # iOS PWA messaging
    mobile/
      floating-action-button.tsx  # FAB with radial menu
    forms/
      multi-step-form.tsx         # Step-based form wrapper
      collapsible-section.tsx     # Accordion-style field groups
      inline-photo-capture.tsx    # Camera in form field
      smart-picker.tsx            # Enhanced mobile select
  lib/
    search/
      fuzzy-search.ts             # Fuse.js index builders
      offline-search.ts           # Cross-store search
    hooks/
      use-barcode-scanner.ts      # Scanner state management
      use-fuzzy-search.ts         # Optional: dedicated hook
```

### Existing Files to Modify

```
frontend/
  lib/
    hooks/
      use-global-search.ts        # Add offline mode
  components/
    ui/
      command-palette.tsx         # Add recent items, suggestions
    dashboard/
      sidebar.tsx                 # Mobile nav adjustments
```

## Sources

### Barcode Scanning
- [html5-qrcode npm](https://www.npmjs.com/package/html5-qrcode) - Cross-platform QR/barcode library
- [react-zxing npm](https://www.npmjs.com/package/react-zxing) - React hooks wrapper for ZXing
- [Camera Access in iOS PWA - STRICH Knowledge Base](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa) - iOS PWA permission limitations
- [PWA Camera Access Guide](https://simicart.com/blog/pwa-camera-access/) - Implementation patterns
- [WebKit Bug #185448](https://bugs.webkit.org/show_bug.cgi?id=185448) - getUserMedia in standalone PWA

### Fuzzy Search
- [Fuse.js Official](https://www.fusejs.io/) - Library documentation
- [Implementing client-side search with Fuse.js](https://www.daily.co/blog/implementing-client-side-search-in-a-react-app-with-fuse-js/) - React integration
- [react-use-fuzzy GitHub](https://github.com/reaviz/react-use-fuzzy) - React hooks wrapper

### FAB / Radial Menu
- [react-pie-menu GitHub](https://github.com/psychobolt/react-pie-menu) - Radial menu with touch support
- [@use-gesture/react npm](https://www.npmjs.com/package/@use-gesture/react) - Touch gesture library
- [PureCode AI - shadcn FAB](https://purecode.ai/components/shadcn/floating-action-button-(fab)) - Reference implementations

### Progressive Disclosure
- [Progressive Disclosure - NN/g](https://www.nngroup.com/articles/progressive-disclosure/) - UX principles
- [2026 Mobile UX Patterns](https://www.sanjaydey.com/mobile-ux-ui-design-patterns-2026-data-backed/) - Current best practices
- [Progressive disclosure UX - LogRocket](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/) - Implementation patterns
