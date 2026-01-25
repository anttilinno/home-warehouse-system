# Technology Stack: v1.3 Mobile UX Overhaul

**Project:** Home Warehouse System - Barcode Scanning, Fuzzy Search, Mobile Gestures
**Researched:** 2026-01-25
**Scope:** Stack additions for browser-based barcode/QR scanning, client-side fuzzy search, mobile gestures (swipe, FAB, radial menu), and progressive form patterns
**Overall Confidence:** HIGH

## Executive Summary

This milestone requires **4 new frontend libraries**. The existing stack (Next.js 16, React 19, shadcn/ui, Tailwind CSS 4, idb v8) provides a solid foundation. Recommendations prioritize actively maintained libraries with TypeScript support and minimal bundle impact.

**Total estimated bundle addition:** ~45-50 KB gzip (with tree-shaking)

---

## Recommended Additions

### 1. Barcode/QR Scanning

| Library | Version | Bundle Size | Maintenance |
|---------|---------|-------------|-------------|
| **@yudiel/react-qr-scanner** | ^2.5.0 | ~15-60 KB gzip | Active (updated Jan 2025) |

**Rationale:** This library leverages the native BarcodeDetector API when available (reducing bundle to ~15KB), falls back gracefully, and provides React hooks (`useDevices`) that integrate cleanly with React 19. Supports both continuous scanning and single-scan modes needed for inventory workflows.

**Key features:**
- QR codes + EAN/UPC/Code128 barcode formats (needed for product lookup)
- Built-in torch (flashlight), zoom, camera switching
- Audio feedback on successful scans
- Full TypeScript support
- Minimal dependencies

**Installation:**
```bash
bun add @yudiel/react-qr-scanner
```

**Integration example:**
```tsx
import { Scanner } from '@yudiel/react-qr-scanner';

function InventoryScanner({ onScan }: { onScan: (code: string) => void }) {
  return (
    <Scanner
      onScan={(result) => onScan(result[0].rawValue)}
      formats={['qr_code', 'ean_13', 'ean_8', 'code_128']}
      components={{ audio: true, torch: true }}
    />
  );
}
```

**Next.js integration (browser-only):**
```tsx
// Must use dynamic import - camera APIs are browser-only
const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then(m => m.Scanner),
  { ssr: false }
);
```

---

### 2. Fuzzy/Typo-Tolerant Search

| Library | Version | Bundle Size | Maintenance |
|---------|---------|-------------|-------------|
| **fuse.js** | ^7.1.0 | ~6 KB gzip (basic) | Active (3.1K stars, 21M monthly downloads) |

**Rationale:** Fuse.js provides the best balance of fuzzy search quality and simplicity. Since the app already uses IndexedDB for offline storage (idb v8), Fuse.js can search the local cache directly without network calls - enabling "search as you type" that works offline.

**Why Fuse.js over alternatives:**

| Library | Verdict | Reason |
|---------|---------|--------|
| **Fuse.js** | CHOSEN | Simple API, excellent fuzzy matching, zero dependencies |
| MiniSearch | REJECTED | Better for full-text indexing; overkill for inventory search |
| FlexSearch | REJECTED | Faster on huge datasets but more complex API; inventory data fits in memory |
| Server-side pg_trgm | REJECTED | This milestone focuses on offline-capable mobile UX |

**Installation:**
```bash
bun add fuse.js
```

**Integration example:**
```tsx
import Fuse from 'fuse.js';

// Initialize with IndexedDB data
const fuse = new Fuse(items, {
  keys: [
    { name: 'name', weight: 2 },      // Prioritize name matches
    { name: 'sku', weight: 1.5 },     // Then SKU
    { name: 'description', weight: 1 }
  ],
  threshold: 0.4,        // 0.0 = exact, 1.0 = match anything
  distance: 100,         // Characters to search within
  includeScore: true,
  minMatchCharLength: 2,
});

// Typo-tolerant search
const results = fuse.search('shlef');  // finds "shelf" with typo
```

**React hook pattern:**
```tsx
function useItemSearch(items: Item[]) {
  const fuse = useMemo(
    () => new Fuse(items, { keys: ['name', 'sku'], threshold: 0.4 }),
    [items]
  );

  const search = useCallback((query: string) => {
    if (!query) return items;
    return fuse.search(query).map(r => r.item);
  }, [fuse, items]);

  return search;
}
```

---

### 3. Mobile Gestures (Swipe, Drag)

| Library | Version | Bundle Size | Maintenance |
|---------|---------|-------------|-------------|
| **@use-gesture/react** | ^10.3.1 | ~10 KB gzip | Active (pmndrs ecosystem, 1.1M weekly downloads) |

**Rationale:** @use-gesture provides low-level gesture primitives that can power swipe-to-delete, drag-to-reorder, and pull-to-refresh. It's maintained by the pmndrs collective (same team as react-spring, zustand) and has excellent TypeScript support. The hook-based API (`useDrag`, `useSwipe`) integrates cleanly with React 19.

**Why @use-gesture over alternatives:**

| Library | Verdict | Reason |
|---------|---------|--------|
| **@use-gesture/react** | CHOSEN | Comprehensive (drag, swipe, pinch, scroll), composable hooks |
| react-swipeable | REJECTED | Swipe-only; @use-gesture covers more use cases |
| Custom implementation | REJECTED | Reinventing the wheel; gesture handling is subtle |

**Installation:**
```bash
bun add @use-gesture/react
```

**Integration examples:**

```tsx
import { useSwipe, useDrag } from '@use-gesture/react';

// Swipe-to-delete pattern
function SwipeableItem({ onDelete }: { onDelete: () => void }) {
  const bind = useSwipe(({ direction: [dx], velocity: [vx] }) => {
    if (dx < 0 && vx > 0.5) onDelete(); // swipe left fast
  });

  return <div {...bind()}>Item content</div>;
}

// Drag-to-reorder (combine with @dnd-kit already in stack)
function DraggableHandle() {
  const bind = useDrag(({ down, movement: [mx, my] }) => {
    // Handle drag state
  });

  return <div {...bind()} className="cursor-grab" />;
}
```

---

### 4. FAB with Radial Menu Animation

| Library | Version | Bundle Size | Maintenance |
|---------|---------|-------------|-------------|
| **motion** | ^12.27.0 | ~15 KB gzip (tree-shaken) | Very Active (updated daily, 25K stars) |

**Rationale:** Build the FAB/radial menu as a custom component using Motion's animation primitives rather than using a pre-built FAB library. This approach provides:

1. **Full control** over the radial menu design and behavior
2. **Consistency** with the rest of the app's animation language
3. **No dependency on stale libraries** (react-tiny-fab last updated 4 years ago)

Motion (formerly Framer Motion) is the de facto standard for React animation.

**Why custom Motion-based FAB over pre-built:**

| Library | Verdict | Reason |
|---------|---------|--------|
| **Custom + Motion** | CHOSEN | Full control, consistent animation language, actively maintained |
| react-tiny-fab | REJECTED | Last updated 4 years ago; not maintained |
| Material UI FAB | REJECTED | Would require importing MUI; conflicts with shadcn design system |
| Syncfusion FAB | REJECTED | Commercial license; heavier dependency |

**Installation:**
```bash
bun add motion
```

**Note:** The package was renamed from `framer-motion` to `motion`. Import from `motion/react`:

```tsx
import { motion, AnimatePresence } from 'motion/react';
```

**Radial menu implementation pattern:**

```tsx
import { motion, AnimatePresence } from 'motion/react';

interface FABItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function RadialFAB({ items, isOpen, onToggle }: {
  items: FABItem[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const itemCount = items.length;
  const radius = 80; // Distance from center

  return (
    <div className="fixed bottom-6 right-6">
      {/* Radial menu items */}
      <AnimatePresence>
        {isOpen && items.map((item, i) => {
          // Calculate position in arc (180 degrees spread)
          const angle = (i * Math.PI) / (itemCount - 1) + Math.PI;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.button
              key={item.id}
              initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
              animate={{ scale: 1, x, y, opacity: 1 }}
              exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 25,
                delay: i * 0.05, // Stagger
              }}
              onClick={item.onClick}
              className="absolute w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center"
              aria-label={item.label}
            >
              {item.icon}
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onToggle}
        className="relative z-10 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
      >
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="text-2xl"
        >
          +
        </motion.span>
      </motion.button>
    </div>
  );
}
```

---

## Complete Installation

```bash
# All new dependencies for Mobile UX v1.3
bun add @yudiel/react-qr-scanner fuse.js @use-gesture/react motion
```

**Bundle impact summary:**

| Library | Gzip Size | Notes |
|---------|-----------|-------|
| @yudiel/react-qr-scanner | 15-60 KB | 15KB when native BarcodeDetector available |
| fuse.js | ~6 KB | Using basic build |
| @use-gesture/react | ~10 KB | Tree-shakeable |
| motion | ~15 KB | Tree-shakeable |
| **Total** | **~45-50 KB** | With tree-shaking |

---

## Integration Points with Existing Stack

### Next.js 16

| Feature | Integration |
|---------|-------------|
| Barcode scanner | Dynamic import with `ssr: false` - camera APIs browser-only |
| Fuzzy search | Works in both client and server components |
| Gestures | Client components only (`'use client'`) |
| Animations | Client components only (`'use client'`) |

### React 19

All recommended libraries support React 19:
- @yudiel/react-qr-scanner: Hook-based, works with React 19
- fuse.js: Framework-agnostic, no React dependency
- @use-gesture/react: Explicitly supports React 18+ hooks
- motion: Updated for React 19 in v12

### shadcn/ui

| Component | Integration |
|-----------|-------------|
| FAB | Build with shadcn Button + motion animations |
| Swipeable lists | Wrap shadcn components with gesture handlers |
| Search input | shadcn Input + Fuse.js for filtering |
| Scanner modal | shadcn Dialog/Sheet + Scanner component |

Example combining shadcn Dialog with scanner:

```tsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Scanner } from '@yudiel/react-qr-scanner';

function ScannerDialog({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Scan Barcode</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <Scanner
          onScan={(result) => {
            onScan(result[0].rawValue);
            setOpen(false);
          }}
          formats={['qr_code', 'ean_13']}
        />
      </DialogContent>
    </Dialog>
  );
}
```

### Tailwind CSS 4

Motion works well with Tailwind - use Tailwind for static styles, Motion for dynamic animations:

```tsx
<motion.div
  className="bg-primary rounded-lg p-4"  // Tailwind: static styles
  animate={{ scale: 1.1 }}                // Motion: dynamic animations
  whileHover={{ scale: 1.05 }}
/>
```

### IndexedDB (idb v8)

Fuse.js search integrates with existing offline data layer:

```tsx
import { getDB } from '@/lib/db';
import Fuse from 'fuse.js';

async function searchOfflineItems(query: string) {
  const db = await getDB();
  const items = await db.getAll('items');

  const fuse = new Fuse(items, {
    keys: ['name', 'sku', 'description'],
    threshold: 0.4,
  });

  return query ? fuse.search(query).map(r => r.item) : items;
}
```

### PWA (Serwist)

Scanner requires camera permissions - handle gracefully:

```tsx
function useCameraAvailable() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAvailable(devices.some(d => d.kind === 'videoinput'));
      } catch {
        setAvailable(false);
      }
    };
    check();
  }, []);

  return available;
}
```

### @dnd-kit (already installed)

@use-gesture complements @dnd-kit rather than replacing it:
- **@dnd-kit**: Complex drag-and-drop with drop zones (already used for photo reordering)
- **@use-gesture**: Simple gestures (swipe-to-delete, pull-to-refresh)

---

## Progressive Form Patterns (No New Libraries Needed)

Progressive form patterns for mobile can be implemented with existing stack:

| Pattern | Implementation |
|---------|----------------|
| Step-by-step forms | React state + conditional rendering |
| Form validation | react-hook-form v7.70.0 + zod v4.3.5 (already installed) |
| Auto-save drafts | IndexedDB via idb v8 (already installed) |
| Optimistic UI | React 19 useOptimistic hook |
| Loading states | shadcn Skeleton + Sonner toasts (already installed) |

**Example: Multi-step form with auto-save:**

```tsx
function useFormDraft<T>(key: string, defaultValues: T) {
  const [values, setValues] = useState<T>(defaultValues);

  // Load draft on mount
  useEffect(() => {
    const db = await getDB();
    const draft = await db.get('formDrafts', key);
    if (draft) setValues(draft);
  }, [key]);

  // Auto-save on change
  const updateValues = useCallback(async (newValues: Partial<T>) => {
    const merged = { ...values, ...newValues };
    setValues(merged);
    const db = await getDB();
    await db.put('formDrafts', merged, key);
  }, [values, key]);

  const clearDraft = useCallback(async () => {
    const db = await getDB();
    await db.delete('formDrafts', key);
  }, [key]);

  return { values, updateValues, clearDraft };
}
```

---

## What NOT to Add

### Rejected: react-tiny-fab (v4.0.4)
**Why not:** Last updated 4 years ago, not actively maintained. Building a custom FAB with Motion provides more flexibility and uses an actively maintained dependency.

### Rejected: MiniSearch (v7.2.0)
**Why not:** Overkill for this use case. MiniSearch maintains a full-text search index, which adds complexity. Fuse.js's simpler fuzzy matching is sufficient for inventory item search. Consider MiniSearch only if search performance becomes an issue with 10,000+ items.

### Rejected: FlexSearch.js
**Why not:** While faster than Fuse.js on large datasets, it has a more complex API and larger bundle. The inventory app's dataset size doesn't warrant the additional complexity.

### Rejected: react-swipeable (v7.0.2)
**Why not:** Limited to swipe gestures only. @use-gesture provides swipe plus drag, pinch, and scroll gestures with one dependency, covering more mobile UX use cases.

### Rejected: nimiq/qr-scanner (v1.4.2)
**Why not:** QR-only, no barcode support. Last updated 3 years ago. The inventory app needs EAN/UPC barcode scanning for product lookup.

### Rejected: @zxing/library + @zxing/browser
**Why not:** In maintenance mode only. While still functional, @yudiel/react-qr-scanner provides a better React integration and is actively maintained.

### Rejected: Full Material UI (for FAB)
**Why not:** Adding MUI just for FAB would conflict with shadcn/ui design system and significantly increase bundle size. Custom Motion-based FAB is more appropriate.

### Rejected: Server-side pg_trgm fuzzy search
**Why not:** This milestone focuses on mobile UX with offline capability. Client-side Fuse.js provides instant search without network latency and works offline. The PostgreSQL search_vector already handles full-text search when online.

### Rejected: framer-motion (legacy package name)
**Why not:** Package renamed to `motion`. Use the new package name for latest features and smaller bundle.

### Rejected: react-zxing (v2.1.0)
**Why not:** Less actively maintained (10 months since update) compared to @yudiel/react-qr-scanner. Underlying @zxing/library is in maintenance mode.

---

## Summary Table

| Capability | Library | Version | Status |
|------------|---------|---------|--------|
| Barcode/QR scanning | @yudiel/react-qr-scanner | ^2.5.0 | ADD |
| Fuzzy search | fuse.js | ^7.1.0 | ADD |
| Mobile gestures | @use-gesture/react | ^10.3.1 | ADD |
| FAB/animations | motion | ^12.27.0 | ADD |
| Progressive forms | (existing stack) | - | NO CHANGE |

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Barcode scanner | HIGH | @yudiel/react-qr-scanner actively maintained, verified npm stats |
| Fuzzy search | HIGH | Fuse.js is industry standard, 21M monthly downloads |
| Mobile gestures | HIGH | @use-gesture from pmndrs ecosystem, 1.1M weekly downloads |
| FAB animations | HIGH | Motion is de facto React animation standard |
| Integration | HIGH | All libraries explicitly support React 19 |

---

## Sources

### Barcode/QR Scanning
- [@yudiel/react-qr-scanner npm](https://www.npmjs.com/package/@yudiel/react-qr-scanner) - v2.5.0, updated Jan 2025
- [react-qr-scanner GitHub](https://github.com/yudielcurbelo/react-qr-scanner) - Feature list, TypeScript support
- [react-zxing npm](https://www.npmjs.com/package/react-zxing) - Alternative considered
- [@zxing/browser npm](https://www.npmjs.com/package/@zxing/browser) - Maintenance mode status
- [nimiq/qr-scanner GitHub](https://github.com/nimiq/qr-scanner) - QR-only limitation

### Fuzzy Search
- [Fuse.js Official](https://www.fusejs.io/) - API documentation
- [Fuse.js npm](https://www.npmjs.com/package/fuse.js) - v7.1.0, 21M monthly downloads
- [Fuse.js GitHub](https://github.com/krisk/Fuse) - 3.1K stars
- [MiniSearch npm](https://www.npmjs.com/package/minisearch) - Alternative considered
- [npm-compare: fuse.js vs flexsearch vs minisearch](https://npm-compare.com/elasticlunr,flexsearch,fuse.js,minisearch)

### Mobile Gestures
- [@use-gesture/react npm](https://www.npmjs.com/package/@use-gesture/react) - v10.3.1, 1.1M weekly downloads
- [@use-gesture documentation](https://use-gesture.netlify.app/) - API reference
- [pmndrs/use-gesture GitHub](https://github.com/pmndrs/use-gesture) - Upgrade guide
- [react-swipeable npm](https://www.npmjs.com/package/react-swipeable) - Alternative considered

### Animation/FAB
- [Motion Official](https://motion.dev/) - Documentation
- [motion npm](https://www.npmjs.com/package/motion) - v12.27.0
- [Motion Upgrade Guide](https://motion.dev/docs/react-upgrade-guide) - framer-motion to motion migration
- [Motion Changelog](https://motion.dev/changelog) - Latest features
- [react-tiny-fab npm](https://www.npmjs.com/package/react-tiny-fab) - Last updated 4 years ago

### Framework Compatibility
- [Framer Motion + Tailwind 2025](https://dev.to/manukumar07/framer-motion-tailwind-the-2025-animation-stack-1801) - Integration patterns
