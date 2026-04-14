# Feature Landscape — v2.1 Feature Parity (frontend2)

**Domain:** Home inventory management (online-only retro UI)
**Researched:** 2026-04-14
**Reference:** `/frontend` (Next.js) — full-featured frontend1 as parity baseline
**Constraint:** Lean — strip frontend1's offline/PWA/import-export complexity; keep only core CRUD + scanning + loans

## Scope Framing

frontend1 is a mature, heavily-featured app (virtualized tables, infinite scroll, saved filters, bulk actions, CSV import/export, IndexedDB offline queue, SSE, approvals, declutter, analytics, etc.). v2.1 is **not** a port of all of that. v2.1 delivers **basic online parity** for the four feature areas so the retro UI becomes usable as a primary surface.

Rule of thumb: if frontend1 has a hook named `useOffline*`, `useSaved*`, `useBulk*`, `useInfiniteScroll`, or `useVirtualizer` — that belongs to deferred, not v2.1.

---

## Feature Area 1: Items CRUD

### Table Stakes (v2.1)

| Feature | Why Expected | Complexity | Backend API | Notes |
|---|---|---|---|---|
| List items (paginated) | Core inventory view | Low | GET `/api/v1/items?page&per_page` | Server pagination, no virtualization; 25/page default |
| Search by name/SKU/barcode | Find items fast | Low | GET `/api/v1/items?search=` | Debounced input (300ms), server-side |
| Filter by category | Primary slicing | Low | GET `/api/v1/items?category_id=` | Dropdown select, single value |
| Filter by location | Primary slicing | Low | via inventory join | Confirm available filter in phase planning |
| Item detail view | Read full record | Low | GET `/api/v1/items/:id` | Single retro panel with all fields |
| Create item | Base write op | Medium | POST `/api/v1/items` | Single-page form; required: name, sku (auto-gen allowed); optional: brand, model, category, description, barcode, serial |
| Edit item | Correct data | Medium | PUT `/api/v1/items/:id` | Reuse create form component |
| Delete item | Housekeeping | Low | DELETE `/api/v1/items/:id` | Confirmation dialog; online-only, immediate |
| Archive/unarchive | Soft-hide without delete | Low | PATCH (is_archived) | Toggle in detail view; "Archived" filter chip |
| Show inventory qty + location(s) | Item is useless without stock context | Medium | GET `/api/v1/inventories?item_id=` | Display on detail page; list of {location, container, quantity} |
| Photo display | Items have photos | Medium | GET `/api/v1/items/:id/photos` | Primary image on list/detail; no upload in v2.1 (see deferred) |
| Basic sort | name / created_at | Low | `sort=` query | Two options: Name A-Z, Recently added |

### Differentiators (v2.1 — retro UI specific)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Retro "terminal row" list style | Fits v2.0 aesthetic; distinguishes from frontend1 | Low | Use existing retro Table component |
| SKU short-code prominence | Retro/industrial feel; fast visual ID | Low | Monospace display, existing `short_code` field |

### Anti-Features (explicitly NOT in v2.1)

| Anti-Feature | Why Avoid | Alternative |
|---|---|---|
| Virtualized list (`@tanstack/react-virtual`) | Premature optimization at this scale | Paginated table |
| Infinite scroll | Complexity; pagination is fine | Numbered pagination |
| Bulk select + bulk actions | Significant UI+state surface | Single-item actions only |
| Saved filter presets | Niche power-user feature | Stateless filters only |
| Keyboard shortcut system | Polish layer | — |
| CSV import/export dialogs | Whole feature area | Deferred to later milestone |
| Offline queue / pending indicators | Scope says online-only | — |
| Photo upload UI in v2.1 items form | Upload UI + camera integration is its own phase | Read-only photo display |
| Quick-capture flow | Exists in frontend1 as dedicated mode | Defer; reuse later |
| SSE real-time list updates | Nice, but pull-on-nav is fine | Refresh on mount |
| Item approvals workflow | Multi-tenant admin feature | Out of v2.1 |
| Needs-review flag UX | Tied to quick-capture | Defer |
| Declutter / unused-item detection | Whole separate page in frontend1 | Deferred |

---

## Feature Area 2: Loan Management

### Table Stakes (v2.1)

| Feature | Why Expected | Complexity | Backend API | Notes |
|---|---|---|---|---|
| List loans (active / returned / overdue) | Core loans view | Low | GET `/api/v1/loans?status=` | Tabs or segmented control for status |
| Create loan | Primary write op | Medium | POST `/api/v1/loans` | Fields: item/inventory, borrower, quantity, due_date, notes |
| Mark loan returned | Core lifecycle | Low | PATCH return action (or PUT returned_at) | One-click action with confirmation |
| Loan detail view | See full context | Low | GET `/api/v1/loans/:id` | Shows item, borrower, dates, notes |
| Edit loan (due date, notes) | Fix mistakes | Low | PUT `/api/v1/loans/:id` | Restrict to non-returned loans |
| Overdue indicator | Primary value of loan tracking | Low | `is_overdue` field exists | Red retro badge; overdue filter |
| Borrower picker (searchable) | Loans need borrowers | Medium | GET `/api/v1/borrowers?search=` | Searchable select; "Create new" inline option |
| Item picker (searchable) | Loans need items | Medium | GET `/api/v1/items?search=` | Same pattern; show current availability |
| Borrower CRUD | Required for loan creation | Medium | `/api/v1/borrowers` full CRUD | Simple list + create/edit dialog; name/email/phone/notes |
| Loan history per item | "Where did I lend this?" | Low | GET `/api/v1/loans?item_id=` | Section on item detail page |
| Loan history per borrower | "What does Alice have?" | Low | GET `/api/v1/loans?borrower_id=` | Section on borrower detail |

### Differentiators (v2.1)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Overdue dashboard card (already built v2.0) | Single-glance status | Low | Wire existing card to live loan data |
| "Return all from borrower" quick action | Common real-world flow | Low | Loop POSTs, or backend bulk endpoint if exists |

### Anti-Features (NOT in v2.1)

| Anti-Feature | Why Avoid | Alternative |
|---|---|---|
| Automated reminder emails/notifications | Backend/SMTP complexity | Manual check via overdue filter |
| Recurring loans / templates | Niche | — |
| Loan approval workflow | Not needed at household scale | Direct creation |
| CSV export of loan history | Import/export deferred | — |
| Bulk loan creation | Uncommon | One-at-a-time |
| Borrower avatars / photos | Polish | Text initials only |
| SSE live loan updates | Pull-on-nav sufficient | Refresh button |

---

## Feature Area 3: Barcode Scanning

### Table Stakes (v2.1)

| Feature | Why Expected | Complexity | Backend API | Notes |
|---|---|---|---|---|
| Open camera scanner page | Entry point | Medium | — | Reuse `@yudiel/react-qr-scanner` (already a dep); single-page route to avoid iOS permission reset |
| Decode QR + common 1D barcodes | Must recognize what users scan | Low | — | Library supports QR, UPC/EAN, Code128 out of box |
| Lookup by barcode → find item | The whole point | Low | GET `/api/v1/items?barcode=` or `domain/barcode` endpoint | Navigate to item detail on match |
| "Not found → create item" flow | Onboarding new items fast | Medium | POST `/api/v1/items` with prefilled barcode | Skip to create form with barcode pre-populated |
| Manual barcode entry fallback | Camera may fail (lighting/privacy) | Low | Same as lookup | Text input on scanner page |
| Scan feedback (visual + audio) | UX expectation; avoid double-scans | Low | — | Retro beep fits aesthetic; existing AudioContext patterns |
| Flashlight toggle | Dark rooms, low light | Low | MediaTrack torch constraint | Mobile only; hide if unsupported |

### Differentiators (v2.1)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Retro CRT-style scanner viewfinder overlay | Brand-defining; delight factor | Medium | CSS/SVG scan-line animation over video element |
| Post-scan action sheet (View / Loan / Edit) | Reduces taps for common flows | Low | Retro dialog appears after match |

### Anti-Features (NOT in v2.1)

| Anti-Feature | Why Avoid | Alternative |
|---|---|---|
| Scan history with 10-item recall | Nice-to-have; adds localStorage state | — |
| Continuous multi-scan / batch mode | Quick-capture territory | Defer |
| External barcode lookup (UPC database) | Auto-fill product info from web | Manual entry |
| NFC scanning | Listed out-of-scope in PROJECT.md | — |
| Hardware scanner support | Out-of-scope per PROJECT.md | — |
| Offline scan queue | Online-only | — |

---

## Feature Area 4: Categories, Locations, Containers

### Table Stakes (v2.1)

| Feature | Why Expected | Complexity | Backend API | Notes |
|---|---|---|---|---|
| List categories | Basic management | Low | GET `/api/v1/categories` | Flat or tree; see complexity below |
| Create category (with parent) | Hierarchies matter in inventory | Medium | POST `/api/v1/categories` | Tree is backend-supported; UI needs parent picker |
| Edit / delete category | Maintenance | Low | PUT / DELETE `/api/v1/categories/:id` | Confirm; backend handles orphan behavior |
| List locations | Basic management | Low | GET `/api/v1/locations` | Fields: name, parent, zone/shelf/bin |
| Create/edit/delete location | Maintenance | Medium | Full CRUD `/api/v1/locations` | Parent picker + zone/shelf/bin fields |
| List containers | Required — items live in containers-in-locations | Low | GET `/api/v1/containers` | Each belongs to a location |
| Create/edit/delete container | Maintenance | Medium | Full CRUD `/api/v1/containers` | Location required; name, description, capacity |
| Archive toggle | Soft-hide without delete | Low | PATCH is_archived | All three entities support this |
| Usage count display | "Can I safely delete this?" | Low | Backend response includes count, or count from items query | Simple "N items" next to each row |

### Differentiators (v2.1)

| Feature | Value | Complexity | Notes |
|---|---|---|---|
| Unified "Taxonomy" settings page | One place for all three vs three menu items | Low | Tabbed retro panel: Categories / Locations / Containers |
| Tree view for categories + locations | Matches data model; intuitive | Medium | Simple indented list; no drag-drop in v2.1 |

### Anti-Features (NOT in v2.1)

| Anti-Feature | Why Avoid | Alternative |
|---|---|---|
| Drag-and-drop reordering / reparenting | Complex state + backend moves | Edit parent via form |
| Merge categories/locations tool | Advanced admin feature | — |
| Bulk operations on taxonomy | Unusual at household scale | — |
| Color-coding / icons per category | Polish layer | Text only |
| Location floor-plan visualizer | Out-of-scope (AR also out per PROJECT.md) | Text hierarchy |

---

## Feature Dependencies

```
Borrowers CRUD ────┐
Items CRUD ────────┼──> Loans (needs borrower + item/inventory)
Inventory (existing v1.x backend) ┘

Categories ────┐
Locations ─────┼──> Items form (pickers for category/location)
Containers ────┘

Barcode Scanner ──> Items (lookup + create flow)

Items list/detail ──> depends on: Categories, Locations, Containers (for display labels)
```

**Build order implication for roadmap:**
1. Categories + Locations + Containers (leaf dependencies, unblock Items form)
2. Items CRUD (depends on #1)
3. Borrowers CRUD (independent; can parallel with #1–#2)
4. Loans (depends on Items + Borrowers)
5. Barcode Scanning (depends on Items)

---

## MVP Recommendation (v2.1 scope)

**Must ship:**
1. Categories / Locations / Containers basic CRUD (unified taxonomy page)
2. Items list + detail + create + edit + delete + archive
3. Borrowers CRUD (minimal)
4. Loans list + create + return + detail
5. Barcode scanner: scan → find item → action sheet; "not found → create" path
6. Wire existing v2.0 dashboard cards (overdue, inventory stats) to live data

**Defer explicitly:**
- Photo upload UI (read-only display in v2.1 if photos exist; upload in a later phase)
- Import/export (CSV, JSON, backups)
- Offline queueing / sync / conflict resolution
- Bulk select, saved filters, infinite scroll, virtualization
- Quick-capture mode
- SSE real-time updates (use refresh-on-nav)
- Repair logs, declutter, approvals, analytics — none of these are in scope
- Advanced taxonomy ops (drag-drop, merge)

---

## Backend API Availability (confirmed)

All required endpoints exist — v1.x shipped full backend coverage. Domain packages under `backend/internal/domain/`:
- `warehouse` — items, inventory, loans, borrowers, categories, locations, containers
- `barcode` — dedicated lookup support
- `importexport`, `batch`, `sync`, `events`, `analytics`, `auth` — present but not needed for v2.1

Endpoints in use:
- `/api/v1/items` + `/:id` + `/:id/photos`
- `/api/v1/inventories` (for item-location-container join)
- `/api/v1/loans` + `/:id` + return action
- `/api/v1/borrowers`
- `/api/v1/categories` (hierarchical)
- `/api/v1/locations` (hierarchical)
- `/api/v1/containers`
- Barcode lookup: `/api/v1/items?barcode=` filter (confirm during phase planning)

**Frontend2 API client gap:** `/frontend2` currently has only auth + dashboard stats client. Every feature area above needs a new API client module — mechanical work following frontend1 `lib/api/` module shape.

---

## Complexity Summary

| Area | Overall Complexity | Dominant Cost |
|---|---|---|
| Categories / Locations / Containers | Low-Medium | Hierarchical parent pickers |
| Items CRUD | Medium | Form with ~15 fields + inventory display join |
| Borrowers CRUD | Low | Simple flat entity |
| Loans | Medium | Two searchable pickers + lifecycle states |
| Barcode Scanning | Medium | Camera permission/UX + retro viewfinder styling |

**Aggregate v2.1 sizing:** Medium. Backend is done; this is ~5 feature slices of mechanical UI work plus one camera-integration slice. Estimate 5–7 phases depending on how taxonomy/borrowers are grouped.

## Sources

- `.planning/PROJECT.md` (v1.x–v2.0 shipped features, out-of-scope list) — HIGH
- `/frontend/app/[locale]/(dashboard)/dashboard/{items,loans,categories,locations,containers,borrowers,scan}/` (direct inspection of reference implementation) — HIGH
- `/frontend/lib/types/{items,loans,borrowers,locations,containers}.ts` (field schemas) — HIGH
- `backend/internal/domain/{warehouse,barcode}/` package listing (endpoint coverage) — HIGH
