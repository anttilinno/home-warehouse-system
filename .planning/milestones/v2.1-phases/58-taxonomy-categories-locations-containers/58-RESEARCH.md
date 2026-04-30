# Phase 58: Taxonomy — Categories, Locations, Containers — Research

**Researched:** 2026-04-16
**Domain:** React 19 + TanStack Query v5 + react-hook-form + Zod — hierarchical CRUD UI over Go/Huma backend
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 Page Structure:** Single `/taxonomy` route with `RetroTabs`. Three tabs: Categories, Locations, Containers. Active tab persists in URL hash (`#categories`, `#locations`, `#containers`). Default `#categories` when absent. No per-entity routes.
- **D-02 Tree Data Fetching:** Fetch-all-and-build strategy. Use flat `/categories` and `/locations` list endpoints (unpaginated — or high-limit — depending on endpoint shape) and build the tree client-side. Do NOT use `/categories/root` or `/categories/{id}/children` for initial tree.
- **D-03 Create/Edit Interaction:** Slide-over panel docks right. Tree stays visible. One panel component reused for create and edit. Dismissed on successful save or explicit cancel. Parent picker uses `RetroCombobox` (async) inside the panel.
- **D-04 Archive/Delete Flow:** Archive-first confirm dialog:
  - Primary: **ARCHIVE** (amber) — soft-archive, reversible via Restore
  - Secondary: small `delete permanently` text link → second danger-styled confirm dialog → hard-delete
  - **409 on category with children:** toast only ("Move or delete child nodes first.") — no confirm dialog shown
  - Archived nodes display with muted/strikethrough style + `ARCHIVED` badge, with a Restore action
  - Backend endpoints used: `POST /archive`, `POST /restore`, `DELETE`
  - **No item-count display** — backend does not expose item assignment counts
- **D-05 short_code:** Optional user-editable field on container and location forms. Auto-populates from name (first 3 chars uppercase + auto-suffix) but user can override; user typing severs the auto-link for the form instance. Category form has NO short_code field.

### Claude's Discretion
- Tree node expand/collapse state management (local component state is fine)
- Slide-over panel implementation (custom div with CSS transition, or extend `RetroDialog` — whichever fits retro aesthetic)
- Auto-population logic for short_code (debounced derivation from name input)
- Archived nodes placement: inline (collapsed by default) vs separate "Archived" section at bottom of tree
- Query invalidation strategy (invalidate entity `.all`)
- Plan batching strategy (researcher/planner decide)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAX-01 | Categories tree view with indentation | `categoriesApi.list()` returns flat list; build tree client-side (D-02); UI-SPEC `padding-inline-start: 24px` per depth |
| TAX-02 | Create category (name req, optional parent + desc) | `categoriesApi.create()`; `RetroFormField` + `RetroCombobox` for parent picker |
| TAX-03 | Edit category (name, parent, description) | `categoriesApi.update()`; slide-over reused (D-03); exclude self + descendants in parent picker |
| TAX-04 | Archive/delete category with 409 handling | `categoriesApi.archive/restore/remove`; 409 → toast-only (D-04); HttpError.status=409 detectable |
| TAX-05 | Locations tree view | `locationsApi.list()` paginated — need high limit; `parent_location` is `*uuid.UUID` from backend (verified) |
| TAX-06 | Create location (name req, optional parent + desc + short_code) | `locationsApi.create()`; D-05 short_code auto-fill; `parent_location?: string` accepts UUID |
| TAX-07 | Edit location | `locationsApi.update()`; exclude self + descendants |
| TAX-08 | Archive/delete location | `locationsApi.archive/restore/remove`; no 409 cascade semantics on backend |
| TAX-09 | Containers grouped by location | `containersApi.list()` paginated, `location_id` filter available; group client-side by `location_id` |
| TAX-10 | Create container (name req, location req, optional desc + short_code) | `containersApi.create()`; `RetroCombobox` searches `locationsApi.list()` |
| TAX-11 | Edit container | `containersApi.update()` |
| TAX-12 | Archive/delete container | `containersApi.archive/restore/remove`; no 409 cascade |
</phase_requirements>

## Summary

Phase 58 is a pure feature-UI phase built on the foundations laid in Phase 56 (TanStack Query + per-entity API modules with query-key factories) and Phase 57 (retro primitives: `RetroTabs`, `RetroFormField`, `RetroCombobox`, `RetroConfirmDialog`, `RetroEmptyState`, `RetroDialog`, toast). There are **no new runtime dependencies** to add. The backend is fully typed in `frontend2/src/lib/api/{categories,locations,containers}.ts` with query-key factories already exported. The phase assembles three tab bodies (two tree tabs and one grouped-list tab), a shared slide-over panel for create/edit, and two nested confirm dialogs for archive → hard-delete. The only backend semantic that needs careful handling is the **409 Conflict on category delete with children** (verified in `backend/.../category/handler.go:259`) which short-circuits the archive-first dialog and fires a toast instead.

**Primary recommendation:** Build a feature directory `frontend2/src/features/taxonomy/` containing (1) three hook files (`useCategoriesTree`, `useLocationsTree`, `useContainersByLocation`) that wrap TanStack Query, (2) three list/tree view components, (3) one shared slide-over panel with three form variants selected via a discriminator prop, (4) a reusable `ArchiveDeleteFlow` component that composes two `RetroConfirmDialog` instances and handles the 409 short-circuit. Plan batching: 3 plans (hooks+forms; tab views; page + slide-over + archive flow + route wiring).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab state / URL hash persistence | Browser (React state + `window.location.hash`) | — | Pure navigation concern; server is stateless wrt hash |
| Tree building (flat → hierarchical) | Browser (derive-on-render) | — | D-02 explicitly client-side; taxonomy is small |
| Parent-picker search / async combobox | Browser (filter results cached by React Query) | API (`/categories`, `/locations`) | Fetch-all-then-filter; network cost negligible |
| CRUD mutations | API (Go/Huma handlers) | Browser (optimistic/invalidation layer) | Server is source of truth; RQ invalidates `{entity}Keys.all` |
| Archive vs delete semantics | API (distinct endpoints `/archive`, `/restore`, `DELETE`) | Browser (UI surfaces them as two dialogs) | Backend enforces; frontend orchestrates |
| 409 cascade guard on category delete | API (`ErrHasChildren` → `huma.Error409Conflict`) | Browser (`HttpError.status === 409` → toast) | Server authoritative; client maps to UX |
| short_code auto-derivation | Browser (debounced from name input) | — | Purely ergonomic; server accepts whatever client sends |
| Query cache invalidation | Browser (TanStack Query) | — | In-memory only |

## Standard Stack

### Core (already installed — verified in `frontend2/package.json`)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5 | Server state, mutation hooks, cache invalidation | Phase 56 D-01 locked [VERIFIED: package.json] |
| `react-hook-form` | ^7.72.1 | Form state + isDirty tracking for unsaved-changes guard | Phase 57 D-03 locked [VERIFIED: package.json] |
| `zod` | ^4.3.6 | Schema validation for create/update payloads | Phase 57 D-04 locked [VERIFIED: package.json] |
| `@hookform/resolvers` | ^5.2.2 | Bridge zod → react-hook-form | Phase 57 D-04 locked [VERIFIED: package.json] |
| `@floating-ui/react` | ^0.27.19 | `RetroCombobox` dropdown positioning (already used) | Phase 57 D-02 locked [VERIFIED: package.json] |
| `react-router` | ^7.14.0 | `/taxonomy` route registration | v2.0 decision [VERIFIED: package.json] |
| `@lingui/react` + `@lingui/core` | ^5.9.5 | All user-visible strings via `t` macro | v2.0 i18n locked [VERIFIED: package.json] |
| `lucide-react` | (check) | Chevron + action icons | Referenced by UI-SPEC [CITED: 58-UI-SPEC.md §Design System] |

### No New Dependencies
Phase 58 adds zero runtime packages. All retro primitives already exist in `@/components/retro` barrel [VERIFIED: `frontend2/src/components/retro/index.ts`].

### Alternatives Considered
| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Client-side tree build (D-02) | `/categories/root` + `/children` lazy fetch | Adds complexity, N+1 requests, negligible benefit at <100 nodes |
| New slide-over component | Extend `RetroDialog` (native `<dialog>`) | Native `<dialog>` centers; slide-over needs right-docked positioning + transform transition — CONTEXT D-03 leaves to discretion but UI-SPEC §Layout Contract requires a distinct right-docked pattern. A fresh component is cleaner than subclassing RetroDialog. |
| Per-entity archive dialogs | One parameterized `ArchiveDeleteFlow` component | DRY; entity-specific copy interpolated via Lingui `t` |

## Architecture Patterns

### System Architecture Diagram

```
  URL hash (#categories|#locations|#containers)
         │
         ▼
 ┌───────────────────────┐
 │  <TaxonomyPage>       │◄──── /taxonomy route (routes/index.tsx)
 │  - useHashTab()       │
 │  - RetroTabs          │
 └──────────┬────────────┘
            │ activeTab
            ▼
  ┌─────────┴─────────────────────────────────────────┐
  ▼                     ▼                              ▼
<CategoriesTab>   <LocationsTab>              <ContainersTab>
  │                     │                              │
  │ useCategoriesQuery  │ useLocationsQuery            │ useContainersQuery
  │  (flat list)        │  (flat list, page=1/large)   │  (paginated, optional loc filter)
  │ buildTree(items)    │ buildTree(items)             │ groupBy(location_id)
  │                     │                              │
  └────────┬────────────┴──────────┬───────────────────┘
           │                       │
           ▼                       ▼
    <TaxonomyTree>            <ContainerGroups>
     - row actions            - group header per location
     - expand/collapse        - row actions
           │                       │
           └────────────┬──────────┘
                        │ onCreateClick | onEditClick(node) | onArchiveClick(node)
                        ▼
                ┌───────────────────────┐
                │ <SlideOverPanel>      │
                │  variant ∈ {category, │
                │    location, container}│
                │  - RetroFormField*    │
                │  - zod schema         │
                │  - unsaved-guard      │
                └───────────┬───────────┘
                            │ submit
                            ▼
                  useCreate/useUpdate mutation
                            │
                            ▼
                   queryClient.invalidateQueries({ queryKey: *Keys.all })
                            │
                            ▼
                       Tree refetches

      archive action path:
   <ArchiveDeleteFlow>
     ├─ RetroConfirmDialog (archive, amber)
     │      └─ onConfirm → archive mutation
     │              └─ if category + 409 → toast "Move or delete child nodes first."
     │              └─ else → success toast
     └─ "delete permanently" link → RetroConfirmDialog (delete, red+hazard)
            └─ onConfirm → remove mutation
                    └─ if category + 409 → close dialog + toast
                    └─ else → success toast
```

### Recommended Project Structure
```
frontend2/src/features/taxonomy/
├── TaxonomyPage.tsx                 # /taxonomy route entry; tab state via URL hash
├── hooks/
│   ├── useHashTab.ts                 # sync activeTab ↔ window.location.hash
│   ├── useCategoriesTree.ts          # useQuery + client-side tree builder
│   ├── useLocationsTree.ts           # useQuery (high page size) + tree builder
│   ├── useContainersByLocation.ts    # useQuery + group-by-location
│   ├── useCategoryMutations.ts       # create/update/archive/restore/remove + invalidation
│   ├── useLocationMutations.ts
│   └── useContainerMutations.ts
├── tree/
│   ├── buildTree.ts                  # pure fn: flat[] → Tree<T>
│   ├── TreeNode.tsx                  # recursive row w/ chevron + actions
│   └── TaxonomyTree.tsx              # wraps root nodes + keyboard nav
├── tabs/
│   ├── CategoriesTab.tsx
│   ├── LocationsTab.tsx
│   └── ContainersTab.tsx             # grouped list (flat-by-location)
├── forms/
│   ├── CategoryForm.tsx              # RHF + zod; emits onSubmit
│   ├── LocationForm.tsx              # includes short_code auto-derive
│   ├── ContainerForm.tsx             # includes short_code + required location
│   └── schemas.ts                    # zod schemas (Create/Update per entity)
├── panel/
│   ├── SlideOverPanel.tsx            # right-docked overlay w/ transform transition,
│   │                                   backdrop, focus trap, Esc handler,
│   │                                   unsaved-changes guard (nested ConfirmDialog)
│   └── EntityPanel.tsx               # selects form variant + wires submit
├── actions/
│   ├── ArchiveDeleteFlow.tsx         # two nested RetroConfirmDialog + 409 toast short-circuit
│   └── shortCode.ts                  # derive(name) + isAutoLinked state machine
└── __tests__/
    ├── buildTree.test.ts
    ├── shortCode.test.ts
    ├── ArchiveDeleteFlow.test.tsx
    └── TaxonomyPage.test.tsx
```

### Pattern 1: Flat → Tree (pure function)

**What:** Convert flat `Category[]` (with nullable `parent_category_id`) into a tree.
**When:** Every time the query returns — use `useMemo` for memoization.

```typescript
// Source: standard adjacency-list → tree; inline implementation
export interface TreeNode<T> { node: T; children: TreeNode<T>[]; depth: number }

export function buildTree<T extends { id: string }>(
  items: T[],
  parentOf: (t: T) => string | null | undefined
): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  items.forEach((n) => byId.set(n.id, { node: n, children: [], depth: 0 }));
  const roots: TreeNode<T>[] = [];
  for (const n of items) {
    const pid = parentOf(n) ?? null;
    const self = byId.get(n.id)!;
    if (pid && byId.has(pid)) {
      const parent = byId.get(pid)!;
      self.depth = parent.depth + 1;
      parent.children.push(self);
    } else {
      roots.push(self);
    }
  }
  return roots;
}

// Usage:
const tree = useMemo(
  () => buildTree(categories, (c) => c.parent_category_id),
  [categories]
);
```

### Pattern 2: Parent-picker "exclude self + descendants" (editing)

```typescript
function collectDescendantIds(root: TreeNode<{ id: string }>): Set<string> {
  const ids = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    ids.add(cur.node.id);
    cur.children.forEach((c) => stack.push(c));
  }
  return ids;
}

// In edit form:
const excluded = useMemo(
  () => (editing ? collectDescendantIds(treeIndex.get(editing.id)!) : new Set()),
  [editing, treeIndex]
);
const options = items.filter((c) => !excluded.has(c.id));
```

### Pattern 3: TanStack Query mutation with invalidation + toast + 409 handler

```typescript
// Source: TanStack Query v5 useMutation contract [CITED: tanstack.com/query/v5]
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HttpError } from "@/lib/api";
import { categoriesApi, categoryKeys } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { useLingui } from "@lingui/react/macro";

export function useDeleteCategory() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();

  return useMutation({
    mutationFn: (id: string) => categoriesApi.remove(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      addToast(t`Category deleted.`, "success");
    },
    onError: (err) => {
      if (err instanceof HttpError && err.status === 409) {
        addToast(t`Move or delete child nodes first.`, "error");
        return; // swallow — caller uses `isError`/409 to close dialogs
      }
      addToast(t`Connection lost. Your change was not saved.`, "error");
    },
  });
}
```

### Pattern 4: URL hash → tab state

```typescript
// Two-way sync: hashchange listener + replaceState on tab change
function useHashTab(defaultTab: string, valid: string[]): [string, (k: string) => void] {
  const read = () => {
    const h = window.location.hash.slice(1);
    return valid.includes(h) ? h : defaultTab;
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const change = (k: string) => {
    if (!valid.includes(k)) return;
    history.replaceState(null, "", `#${k}`);
    setTab(k);
  };
  return [tab, change];
}
```

### Pattern 5: Slide-over panel with unsaved-changes guard

Use a native `<div role="dialog" aria-modal="true">` portal-mounted to `document.body`, not the `<dialog>` element — native `<dialog>` forces center alignment and is awkward to slide from the right.

```tsx
// Pseudocode skeleton
<FloatingPortal>
  <div
    className="fixed inset-0 bg-retro-charcoal/40 z-40"
    onClick={attemptClose}
  />
  <aside
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    className="fixed top-0 right-0 h-dvh w-full sm:w-[60vw] lg:w-[480px]
               bg-retro-cream border-l-retro-thick border-retro-ink z-50
               transform transition-transform duration-150 ease-out
               motion-reduce:transition-none"
    style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
  >
    {/* header, body, sticky footer */}
  </aside>
</FloatingPortal>

// attemptClose:
const attemptClose = () => {
  if (formState.isDirty) openDiscardConfirm();
  else onClose();
};
```

Focus trap: on mount, focus first input; on Tab/Shift-Tab, loop within the panel. `@floating-ui/react`'s `useDismiss` + `FloatingFocusManager` already gives this for free — consider using them since the library is already installed.

### Anti-Patterns to Avoid
- **Don't build the tree in render without `useMemo`** — O(n) on every keystroke in a sibling input. Memoize on `items` identity.
- **Don't use `/categories/{id}/children` for initial render** — CONTEXT D-02 forbids. Use it only if a future lazy-load mode is added.
- **Don't put `workspaceId` in query keys as a raw string** — follow the Phase 56 factories; `categoryKeys.all` is already `['categories']` and implicitly scoped by the workspace in the HTTP call. If you need multi-workspace caching later, revise the factories (out of scope here).
- **Don't show an item-count in the archive dialog** — backend does not return one. CONTEXT D-04 is explicit. UI-SPEC §Destructive Confirmations also documents this divergence from Phase 57.
- **Don't catch 409 inside the button handler only** — centralize in the mutation `onError` so any trigger path behaves the same.
- **Don't auto-close the archive dialog on 409** — the mutation `onError` must explicitly close the surrounding confirm dialog AND suppress the default "saved" toast. Treat 409-for-children as a first-class error path.
- **Don't tie `short_code` auto-derive to a form-wide "dirty" sentinel** — use a local state `{ autoLinked: boolean }` that flips to `false` on the first user keystroke in the short_code field. RHF's `isDirty` is orthogonal.
- **Don't set `credentials: "include"` manually** — `lib/api.ts` already does this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown positioning for combobox | Custom CSS absolute positioning | `RetroCombobox` (already wraps `@floating-ui/react`) | Viewport edge flip, width matching, scroll clipping |
| Confirm dialog | Custom modal | `RetroConfirmDialog` | Focus management, native `<dialog>` + backdrop, pending state, hazard stripe |
| Form state / validation | `useState` + manual validators | `react-hook-form` + `zod` via `RetroFormField` | isDirty, isValid, fieldState.error, touched tracking |
| Fetch + cache + dedupe | `useEffect` + `useState` fetching | `@tanstack/react-query` useQuery | Stale-while-revalidate, dedupe, invalidation, retry |
| Query keys | Ad-hoc string arrays | `categoryKeys` / `locationKeys` / `containerKeys` factories | Phase 56 D-03 — already exported |
| Toast UI | Custom notification stack | `useToast()` from `RetroToast.tsx` | Already in app provider chain |
| Tab component | Custom div+button | `RetroTabs` | Has overflow-x, active-state styling |
| Icons | SVG hand-drawn | `lucide-react` | Already established; `ChevronRight`, `ChevronDown`, `Pencil`, `Archive`, `Undo2`, `Trash2`, `X`, `Plus` |
| i18n strings | Hard-coded literals | Lingui `t` macro + en/et catalogs | Mandatory per v2.0 — CI extracts catalogs |

**Key insight:** Every problem in this phase has a solved primitive. The phase is ~80% composition, ~20% taxonomy-specific logic (tree build, group-by, short_code derive, 409 short-circuit).

## Runtime State Inventory

Not applicable — Phase 58 is greenfield UI work. No renames, refactors, or migrations. No stored data, live service config, OS-registered state, secrets, or build artifacts to audit. State explicitly: nothing to migrate.

## Common Pitfalls

### Pitfall 1: Locations endpoint is paginated — default `limit` may cut off the tree

**What goes wrong:** `/locations` returns `LocationListResponse { items, total, page, total_pages }`. If the default backend page size is e.g. 25, a workspace with 30 locations will render a broken tree (orphan children whose parents are on page 2).

**Why it happens:** The locations list was typed as paginated in Phase 56 without a "fetch-all" helper.

**How to avoid:** When fetching the full tree, call with an explicit large `limit` (e.g., `limit: 1000`) OR page through until `page > total_pages`. Simplest and sufficient for v2.1: `locationsApi.list(wsId, { limit: 1000 })`. Verify the backend accepts arbitrary limits (check `backend/internal/domain/warehouse/location/handler.go` input schema validation) — if the server caps the limit, add a paging loop in the hook. Categories `/categories` returns `{ items: Category[] }` with no pagination envelope [VERIFIED: `lib/api/categories.ts:14-16`] — no issue there.

**Warning signs:** Tree renders N roots where expected hierarchy shows child-less roots; DevTools shows `total > items.length`.

### Pitfall 2: 409 Conflict on category delete must bypass the confirm dialog

**What goes wrong:** User clicks hard-delete, server returns 409, dialog stays open with a generic "try again" message — but retrying will always 409.

**Why it happens:** Standard mutation error handlers don't distinguish structural conflicts from transient errors.

**How to avoid:** In `onError`, branch on `err instanceof HttpError && err.status === 409`. When true: close the surrounding confirm dialog imperatively (pass a `onConflict` callback or use `RetroConfirmDialogHandle.close()`) AND fire the specific toast "Move or delete child nodes first." UI-SPEC §Error States row 5 specifies this copy verbatim.

**Warning signs:** Dialog freezes on a category with children; repeated clicks do nothing visible.

### Pitfall 3: `parent_location` type mismatch (UUID vs string)

**What goes wrong:** `CreateLocationInput.parent_location?: string` in `lib/api/locations.ts:32`, but backend expects `*uuid.UUID` [VERIFIED: `backend/.../location/handler.go:350,364,377`]. Sending an empty string or a non-UUID string will 400.

**Why it happens:** TypeScript `string` is wider than `uuid.UUID`.

**How to avoid:** The Zod schema must enforce `z.string().uuid().optional()`. When the parent picker is cleared, submit `undefined`, not `""`. When editing and the user unsets the parent, send `parent_location: undefined` (or omit the key) — verify backend accepts null/omitted to mean "make root". If the server requires explicit null to clear parent, test and document. (At minimum, test clearing a parent in the edit flow end-to-end.)

### Pitfall 4: URL hash tab persistence + React Router 7 library mode

**What goes wrong:** Using `useNavigate({ replace: true })` to `#tab` works but the route's own navigation wrapper may strip the hash. Also, Router v7 has different `useLocation().hash` semantics than v6 in rare cases.

**How to avoid:** Use `window.history.replaceState(null, "", "#" + key)` plus a `hashchange` listener (see Pattern 4). Avoid `useNavigate` for hash-only changes. Confirm behavior with back/forward browser buttons.

### Pitfall 5: Slide-over panel + RetroDialog can't coexist easily

**What goes wrong:** The slide-over uses a portal'd `<div>` overlay. The archive/delete confirm dialogs use native `<dialog>` via `RetroConfirmDialog`. If the slide-over is open and the user triggers archive from the row actions (not from inside the panel), both overlays stack. The native `<dialog>` `showModal()` puts it on top of the DOM but its backdrop is the `<dialog>`'s own — it won't respect the slide-over's backdrop z-index, but visually it will still render above it since modal dialogs use the top layer.

**How to avoid:** Row-level archive actions live outside the slide-over (the slide-over is only for create/edit). The only nested dialog is the unsaved-changes guard, which is a confirm dialog — it works because `<dialog>` top-layer sits above the portal'd div. Test this interaction explicitly.

### Pitfall 6: `short_code` auto-derivation race with backend uniqueness

**What goes wrong:** Auto-derivation generates `GAR-937`. User saves. Backend rejects with "short_code already exists" (if the backend enforces uniqueness). The 3-digit random space is only 1000 values — collisions likely at scale.

**How to avoid:** Check if the backend enforces `short_code` uniqueness (grep `short_code` in `backend/.../location/service.go` and `container/service.go`). If unique: (a) use a longer random suffix (6 chars alphanumeric) or (b) generate server-side on create when `short_code` is omitted. If not unique: proceed with 3 chars but document that label collisions are a user problem. UI-SPEC §short_code auto-fill rule is silent on collision — flag as open question.

**Warning signs:** Intermittent 409 on create with "short_code" in the error detail.

### Pitfall 7: `RetroCombobox` shows label from `options`, but the parent picker needs to search — async vs static

**What goes wrong:** `RetroCombobox.onSearch` fires debounced on query change, but `options` is a static prop. If the form wires `options` to the full unpaginated list and doesn't filter on `onSearch`, the user sees everything regardless of query.

**How to avoid:** Either (a) wire `onSearch` → local state → filter locally by `label.includes(q)`, or (b) fetch-all then client-filter via `useMemo`. Option (b) is simpler for taxonomy (<100 nodes). The `onSearch` callback can be a no-op if `options` is already filtered.

## Code Examples

### Example 1: Hook — categories tree

```typescript
// frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { categoriesApi, categoryKeys, type Category } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";
import { buildTree } from "../tree/buildTree";

export function useCategoriesTree(showArchived: boolean) {
  const { workspaceId } = useAuth();
  const query = useQuery({
    queryKey: categoryKeys.list({ archived: showArchived ? undefined : false }),
    queryFn: () => categoriesApi.list(workspaceId!, { archived: showArchived ? undefined : false }),
    enabled: !!workspaceId,
  });

  const tree = useMemo(
    () => (query.data ? buildTree(query.data.items, (c) => c.parent_category_id ?? null) : []),
    [query.data]
  );

  return { ...query, tree };
}
```

### Example 2: Category form with zod schema

```typescript
// frontend2/src/features/taxonomy/forms/schemas.ts
import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120, "Must be 120 characters or fewer."),
  parent_category_id: z.string().uuid().optional(),
  description: z.string().max(500, "Must be 500 characters or fewer.").optional(),
});
export type CategoryCreateValues = z.infer<typeof categoryCreateSchema>;
```

```tsx
// frontend2/src/features/taxonomy/forms/CategoryForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RetroFormField, RetroInput, RetroCombobox, RetroTextarea } from "@/components/retro";
import { categoryCreateSchema, type CategoryCreateValues } from "./schemas";

export function CategoryForm({ defaultValues, parentOptions, onSubmit }) {
  const { control, handleSubmit, formState } = useForm<CategoryCreateValues>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues,
    mode: "onBlur",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md">
      <RetroFormField name="name" control={control} label="NAME">
        <RetroInput />
      </RetroFormField>
      <RetroFormField name="parent_category_id" control={control} label="PARENT CATEGORY">
        <RetroCombobox options={parentOptions} />
      </RetroFormField>
      <RetroFormField name="description" control={control} label="DESCRIPTION">
        <RetroTextarea />
      </RetroFormField>
      {/* footer buttons rendered by SlideOverPanel via formState + handleSubmit */}
    </form>
  );
}
```

### Example 3: Archive → Delete flow component

```tsx
// frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx
import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroConfirmDialog, type RetroConfirmDialogHandle } from "@/components/retro";

interface Props {
  entityName: "category" | "location" | "container";
  node: { id: string; name: string };
  onArchive: () => Promise<void>;  // throws for 409 handling
  onDelete: () => Promise<void>;   // throws for 409 handling
}

export function ArchiveDeleteFlow({ entityName, node, onArchive, onDelete }: Props) {
  const { t } = useLingui();
  const archiveRef = useRef<RetroConfirmDialogHandle>(null);
  const deleteRef = useRef<RetroConfirmDialogHandle>(null);

  const entityUpper = entityName.toUpperCase();

  return (
    <>
      <RetroConfirmDialog
        ref={archiveRef}
        variant="soft"
        title={t`CONFIRM ARCHIVE`}
        body={t`This will hide '${node.name}' from item pickers. You can restore it later.`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`ARCHIVE ${entityUpper}`}
        onConfirm={async () => {
          await onArchive(); // mutation onError handles 409 toast + dialog close via ref.current?.close()
        }}
      />
      <RetroConfirmDialog
        ref={deleteRef}
        variant="destructive"
        title={t`CONFIRM DELETE`}
        body={t`This permanently deletes '${node.name}'. This action cannot be undone.`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`DELETE ${entityUpper}`}
        onConfirm={async () => {
          await onDelete();
        }}
      />
      {/* Trigger buttons rendered by caller; imperatively open via refs */}
    </>
  );
}
```

### Example 4: short_code auto-derive state machine

```typescript
// frontend2/src/features/taxonomy/actions/shortCode.ts
export function deriveShortCode(name: string): string {
  const prefix = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  if (prefix.length === 0) return "";
  const suffix = Math.floor(100 + Math.random() * 900); // 3-digit
  return `${prefix}-${suffix}`;
}

// Hook: debounced auto-fill; breaks link on manual edit of short_code
export function useAutoShortCode(
  name: string,
  shortCode: string,
  setShortCode: (v: string) => void
) {
  const [autoLinked, setAutoLinked] = useState(true);
  useEffect(() => {
    if (!autoLinked) return;
    const handle = setTimeout(() => setShortCode(deriveShortCode(name)), 300);
    return () => clearTimeout(handle);
  }, [name, autoLinked, setShortCode]);

  // Call from RetroInput onChange for short_code:
  const onManualEdit = (v: string) => {
    setAutoLinked(false);
    setShortCode(v);
  };
  return { onManualEdit };
}
```

## State of the Art

| Old Approach | Current Approach | Source |
|--------------|------------------|--------|
| Redux for server state | `@tanstack/react-query` v5 | TanStack Query blog, TK-dodo [CITED: tanstack.com] |
| Uncontrolled forms | `react-hook-form` + `zod` + `@hookform/resolvers` | React ecosystem standard 2024+ [CITED: react-hook-form.com] |
| CSS absolute positioning for dropdowns | `@floating-ui/react` | Replacement for deprecated Popper.js [CITED: floating-ui.com] |
| `useEffect` data fetching | `useQuery`/`useMutation` with invalidation | TanStack Query docs |

**Deprecated/outdated for this phase:** None. Phase 56 and 57 already standardized the modern stack.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backend accepts `limit=1000` on `/locations` without capping | Pitfall 1, Pattern hooks | Tree renders incomplete; mitigation: paging loop in hook |
| A2 | `short_code` uniqueness enforcement in backend is unknown | Pitfall 6 | Intermittent 409 on save; mitigation: longer random suffix or server-side generation |
| A3 | Clearing `parent_category_id` / `parent_location` can be done by omitting the field in PATCH | Pitfall 3 | Edit "move to root" fails; mitigation: test and, if needed, add explicit null semantics |
| A4 | Native `<dialog>` top-layer sits above portal'd slide-over `<aside>` correctly | Pitfall 5 | Unsaved-changes dialog visually trapped behind slide-over; mitigation: manual z-index or portal-both approach |
| A5 | `lucide-react` is already a project dependency | Standard Stack table | Need to add it; low risk — UI-SPEC already names it; verify in package.json on plan kickoff |
| A6 | Lingui `t` macro interpolation with `${entityUpper}` works for button labels containing dynamic entity names | ArchiveDeleteFlow example | Catalogs may need separate keys per entity; mitigation: use separate literal `t` strings per variant |

## Open Questions (RESOLVED 2026-04-16)

**Resolutions from Wave 0 backend verification:**

1. **Location pagination cap** — RESOLVED: `ListLocationsInput.Limit` is capped at `maximum: 100` (see `backend/internal/domain/warehouse/location/handler.go:325`). The `limit: 1000` plan from earlier drafts is INVALID — the backend rejects it. Use `limit: 100` and page through until `page > total_pages` in `useLocationsTree`. Same cap applies to containers and the search endpoint (line 401).

2. **short_code uniqueness** — RESOLVED: Backend enforces unique-per-workspace on both Location and Container `short_code` via `ShortCodeExists` check in `service.go:50-59` (location) and `service.go:53-62` (container). On collision the service returns `ErrShortCodeTaken` → HTTP 400. Backend auto-generates an 8-char alphanumeric code when `short_code` is empty/omitted (`generateShortCode()`). Strategy: when the user has NOT manually edited the short_code field (`autoLinked === true` in `useAutoShortCode`), submit `short_code: undefined` so the backend auto-generates a guaranteed-unique code. Only when the user has manually entered a value do we send it as-is. This replaces the client-side 3-digit random suffix approach, which had a >1% collision rate.

3. **Parent clearing semantics** — RESOLVED: Backend `UpdateCategoryInput.Body.ParentCategoryID` is typed as `*uuid.UUID` with `json:"parent_category_id,omitempty"` (`category/handler.go:348`). In Go's `encoding/json`, both an absent key AND an explicit `null` unmarshal to a nil pointer — and the handler (line 150) passes it through unchanged to `UpdateInput.ParentCategoryID`. There is therefore NO way to clear a parent via the current API; "move node to root" is UNSUPPORTED on the backend. Frontend MUST NOT offer a "clear parent" affordance that would imply this works. UI guidance: The parent picker in edit forms should NOT allow clearing a previously set parent; if the user wants to re-root a subtree, they must raise a backend change request. LocationForm has the same constraint (`parent_location`). This is documented as a known gap for TAX-03/TAX-07 — see plan 03 action notes. Plans 03 CategoryForm/LocationForm submit handler must therefore ONLY include `parent_*` in the patch payload when the user SET a value (not when cleared); never send explicit null expecting a clear.

4. **Lingui interpolation for entity-specific UPPERCASE labels** — RESOLVED: Confirmed that `t\`ARCHIVE ${entityUpper}\`` produces a dynamic catalog key that the Lingui CLI (`@lingui/cli` extract) cannot statically resolve to `ARCHIVE CATEGORY`/`ARCHIVE LOCATION`/`ARCHIVE CONTAINER`. Switch ArchiveDeleteFlow to discriminated literals: compute the label at render time via a `switch (entityKind)` with three separate `t` macro invocations per label (archive, delete, confirm title, etc.). Plan 03 Task 3 updated accordingly.

---

### Original Open Questions (for historical reference)

1. **Location pagination cap**
   - What we know: Locations endpoint returns paginated envelope. Default/max `limit` on server unknown.
   - What's unclear: Can we request `limit=1000` and get all rows?
   - Recommendation: Executor reads `backend/internal/domain/warehouse/location/handler.go` `ListLocationsInput` schema bounds in Wave 0; if capped, planner adds paging loop to `useLocationsTree`.

2. **short_code uniqueness**
   - What we know: Backend has `short_code` field on Location and Container.
   - What's unclear: Is it server-unique? Per workspace or global?
   - Recommendation: Grep `short_code` in `backend/.../location/service.go` + `container/service.go` at Wave 0. If unique, use `crypto.randomUUID().slice(0,6).toUpperCase()` suffix instead of 3 digits. If backend auto-generates on omission, prefer omitting in create payload.

3. **Parent clearing semantics**
   - What we know: `UpdateCategoryInput.parent_category_id?: string` — optional.
   - What's unclear: Does the backend interpret "absent" as "no change" or "clear"?
   - Recommendation: Test at Wave 0. If "no change", we need an explicit null/empty-string convention. The Go handler likely patches only present fields — verify and document in PLAN.

4. **Lingui interpolation for entity-specific UPPERCASE button labels**
   - What we know: Lingui supports `t\`\${x}\`` interpolation.
   - What's unclear: Whether `${entityUpper}` inside `t` produces clean catalog entries or messy dynamic keys.
   - Recommendation: Prefer discriminated literals (separate `t\`ARCHIVE CATEGORY\``, `t\`ARCHIVE LOCATION\``, `t\`ARCHIVE CONTAINER\`` strings). Catalog explicit > clever.

## Environment Availability

Phase 58 is pure frontend composition work against already-installed deps; runs inside Vite/Vitest. No new external services or binaries required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / bun | Build | ✓ | (existing) | — |
| `@tanstack/react-query` | Hooks | ✓ | ^5 | — |
| `react-hook-form` | Forms | ✓ | ^7.72.1 | — |
| `zod` | Schemas | ✓ | ^4.3.6 | — |
| `@hookform/resolvers` | zod→RHF | ✓ | ^5.2.2 | — |
| `@floating-ui/react` | Combobox/portal/focus trap | ✓ | ^0.27.19 | — |
| `@lingui/cli` (extract) | i18n catalogs | ✓ | ^5.9.5 | — |
| `lucide-react` | Icons | Assumed ✓ | — | Verify in plan Wave 0; `npm ls lucide-react` |
| Backend running (for manual UAT) | Human checkpoint | — | — | — |

**Missing dependencies with no fallback:** None confirmed missing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.3 + @testing-library/react ^16.3.2 + jsdom ^29.0.2 |
| Config file | `frontend2/vitest.config.ts` |
| Quick run command | `cd frontend2 && bun test` (runs vitest run; fast) |
| Full suite command | `cd frontend2 && bun test && bun run lint && bun run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAX-01 | Categories tree renders with indentation | unit | `cd frontend2 && bunx vitest run src/features/taxonomy/__tests__/TaxonomyPage.test.tsx -t "categories tree"` | ❌ Wave 0 |
| TAX-02 | Create category happy path | integration | `bunx vitest run src/features/taxonomy/__tests__/CategoryForm.test.tsx` | ❌ Wave 0 |
| TAX-03 | Edit category excludes self + descendants from parent picker | unit | `bunx vitest run src/features/taxonomy/__tests__/buildTree.test.ts -t "excludeDescendants"` | ❌ Wave 0 |
| TAX-04 | 409 on category delete → toast + dialog close | integration | `bunx vitest run src/features/taxonomy/__tests__/ArchiveDeleteFlow.test.tsx -t "409"` | ❌ Wave 0 |
| TAX-05 | Locations tree renders | unit | same as TAX-01 pattern, LocationsTab | ❌ Wave 0 |
| TAX-06 | Create location with short_code auto-fill | integration | `bunx vitest run src/features/taxonomy/__tests__/shortCode.test.ts` | ❌ Wave 0 |
| TAX-07 | Edit location | manual-only (backend round-trip) | human UAT | — |
| TAX-08 | Archive/restore/delete location | manual-only | human UAT | — |
| TAX-09 | Containers grouped by location | unit | `bunx vitest run src/features/taxonomy/__tests__/ContainersTab.test.tsx` | ❌ Wave 0 |
| TAX-10 | Create container with required location | integration | `bunx vitest run src/features/taxonomy/__tests__/ContainerForm.test.tsx` | ❌ Wave 0 |
| TAX-11 | Edit container | manual-only | human UAT | — |
| TAX-12 | Archive/delete container | integration | covered by ArchiveDeleteFlow entity-parametric test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test` (taxonomy tests only, default vitest-changed scope)
- **Per wave merge:** full `bun test && bun run lint`
- **Phase gate:** full suite green + manual UAT for the edit/archive round-trips against a running backend

### Wave 0 Gaps
- [ ] `src/features/taxonomy/__tests__/buildTree.test.ts` — pure unit tests for tree builder
- [ ] `src/features/taxonomy/__tests__/shortCode.test.ts` — derive() and auto-link state machine
- [ ] `src/features/taxonomy/__tests__/ArchiveDeleteFlow.test.tsx` — 409 short-circuit, archive→delete link flow, Lingui wrapper
- [ ] `src/features/taxonomy/__tests__/CategoryForm.test.tsx` — zod validation, parent exclusion
- [ ] `src/features/taxonomy/__tests__/LocationForm.test.tsx` — short_code auto-fill integration
- [ ] `src/features/taxonomy/__tests__/ContainerForm.test.tsx` — required location enforcement
- [ ] `src/features/taxonomy/__tests__/ContainersTab.test.tsx` — group-by-location
- [ ] `src/features/taxonomy/__tests__/TaxonomyPage.test.tsx` — tab switching via URL hash
- [ ] Shared test fixture: `src/features/taxonomy/__tests__/fixtures.ts` with seed category/location/container arrays and a `QueryClientProvider + ToastProvider + AuthContext` render helper

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` present in repo root — verified via `ls`. No top-level project directives to enforce beyond conventions documented in STATE.md and prior phase CONTEXT.md files:

- TypeScript strict; no `any`.
- `@/` path alias for `frontend2/src/`.
- All user-visible strings via Lingui `t` macro; catalogs (`en` + `et`) extracted before phase checkpoint.
- All retro imports from `@/components/retro` barrel only.
- Touch targets `min-height: 44px` on interactive controls.
- CI grep guard in frontend2: no `idb` / `serwist` / `*offline*` / `*sync*` imports (v2.1 online-only).
- No new external component libraries (no Radix, shadcn). Custom retro only.

## Sources

### Primary (HIGH confidence)
- `frontend2/src/lib/api/categories.ts`, `locations.ts`, `containers.ts` — API shapes, query key factories [VERIFIED: Read]
- `frontend2/src/lib/api.ts` — HttpError, fetch helpers [VERIFIED]
- `frontend2/src/components/retro/index.ts` + individual components — Reusable primitives [VERIFIED]
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth().workspaceId` [VERIFIED]
- `frontend2/src/lib/queryClient.ts` — QueryClient defaults [VERIFIED]
- `frontend2/package.json` — Installed versions [VERIFIED]
- `backend/internal/domain/warehouse/category/handler.go:259` + `errors.go:11` + `service.go:191` — 409 ErrHasChildren cascade logic [VERIFIED: grep]
- `backend/internal/domain/warehouse/location/handler.go:350` — `parent_location *uuid.UUID` shape [VERIFIED: grep]
- `.planning/phases/58-taxonomy-categories-locations-containers/58-CONTEXT.md` — Locked decisions
- `.planning/phases/58-taxonomy-categories-locations-containers/58-UI-SPEC.md` — UI contract
- `.planning/phases/56-foundation-api-client-and-react-query/56-CONTEXT.md` — Query key factory, workspace threading
- `.planning/phases/57-retro-form-primitives/57-CONTEXT.md` — RHF/zod/floating-ui baselines
- `.planning/REQUIREMENTS.md` — TAX-01..TAX-12
- `.planning/config.json` — nyquist_validation key absent → validation section included

### Secondary (MEDIUM confidence)
- TanStack Query v5 mutation + invalidation patterns — [CITED: tanstack.com/query/v5/docs/react/guides/invalidations-from-mutations]
- react-hook-form `Controller` + `isDirty` — [CITED: react-hook-form.com/docs]
- Zod `z.string().uuid().optional()` — [CITED: zod.dev]

### Tertiary (LOW confidence)
- None. All load-bearing claims are verified against the codebase or cited from official primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — directly verified in `package.json` and existing code
- Architecture: HIGH — mechanically composes primitives already proven in Phase 57 demo + Phase 56 query-key factories
- Pitfalls 1–7: HIGH for 2–5 (verified or design-level certainty); MEDIUM for 1 (depends on backend limit enforcement, verifiable at Wave 0); MEDIUM for 6 (uniqueness TBD)
- Validation: HIGH — Vitest infra and patterns match existing retro `__tests__` suite
- Assumptions A1–A6: LOW-MEDIUM — flagged and resolvable with < 10 min of Wave 0 verification each

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — stack is stable for this phase)
