---
phase: 10
slug: taxonomy
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-13
---

# Phase 10 — Taxonomy — UI Design Contract

> Visual and interaction contract for the Taxonomy surface (categories tree,
> locations tree, containers grouped-by-location, label manager). PARITY phase:
> the Retro OS Pastel design system is fully shipped — this contract REUSES the
> existing retro atoms and tokens. It invents exactly ONE net-new visual idiom
> (the recursive Tree row), derived from existing tokens. Everything else maps
> 1:1 onto shipped components.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (hand-rolled Retro OS Pastel; no shadcn) |
| Preset | not applicable |
| Component library | `@/components/retro` barrel (Window, RetroTabs, BevelButton, RetroBadge, RetroConfirmDialog, RetroEmptyState, RetroInput, RetroSelect, RetroCombobox, FilterBar, retroToast) |
| Icon library | unicode glyphs only (no icon font yet — MANIFEST anti-pattern: icon style un-sketched). Use the SAME glyph vocabulary already shipped: `⊕` add, `↧` overflow/more, `←` back, `✓` selected, `⚠` warning, `▸`/`▾` disclosure (NEW — see Tree §). |
| Font | Silkscreen (display, ≥16px uppercase, titlebars only) · IBM Plex Sans (body 14px / labels 11–12px uppercase) · IBM Plex Mono `tabular-nums` (counts, ids, dates) |

**Hard rule (parity):** Do NOT invent new colors, bevels, badge variants, button
variants, or titlebar variants. The only net-new component is the Tree row, and
its styling is composed entirely from existing token classes.

---

## Spacing Scale

Shipped scale (`tokens.css`) — use the Tailwind `sp-N` classes, never raw px for layout.

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| sp-1 | 4px | disclosure caret gap, badge gap, inline action gap |
| sp-2 | 8px | row action button gap, swatch gap |
| sp-3 | 12px | tab padding, group-header padding, dialog body gaps |
| sp-4 | 16px | Window body padding, form field stacks, tabpanel padding |
| sp-5 | 24px | section breaks between grouped container blocks |
| sp-6 | 32px | (unused this phase) |

**Tree indent unit:** `20px` per depth level (raw px is sanctioned here — it is a
component-internal metric, not layout spacing). Rationale: caret 12px + 8px gap
aligns the name column across depths. Declared as a Tree constant `INDENT_PX = 20`.

Exceptions: per-row action BevelButtons use the shipped compact override
`!px-[8px] !py-[2px] !text-[11px]` (verbatim from ItemDetailPage titlebar buttons).

---

## Typography

Reuse shipped roles verbatim — no new sizes.

| Role | Size | Weight | Line Height | Where |
|------|------|--------|-------------|-------|
| Display | 16px | Silkscreen | 1 | Window titlebar (`TAXONOMY`), empty-state heading |
| Tab cap | 11px | bold (700) | — | RetroTabs labels (`CATEGORIES` etc.) |
| Group label / eyebrow | 10–11px | bold (700) | — | container group headers, dl field labels, section eyebrows; `uppercase tracking-[0.08em–0.14em]` |
| Body | 14px | regular/semibold | 1.5 | tree row names, dialog body, list rows |
| Mono | 13–14px | regular | 1.5 | item-count badges, ids, `tabular-nums` |

Tree row name: `text-[14px]` body. Archived row name: add `text-fg-muted` (the
shipped dimming convention — see InventoryListPage row `${archived ? "text-fg-muted" : ""}`).

---

## Color

Reuse shipped tokens 1:1. No new values.

| Role | Token / hex | Usage |
|------|-------------|-------|
| Dominant (60%) | `--bg-panel #ffffff` (panels) on cream `#fdf6ec` desktop | Window body, tree/list rows |
| Secondary (30%) | `--bg-panel-2 #f7f0e2` | group-header strips, recessed toolbars, inactive tab fill |
| Accent (10%) | `--titlebar-blue #b8d8e8` | active tab fill, primary buttons, selected/active tree row |
| Warning | `--titlebar-butter #f6e3a8` / `--warn-bg #f9eccb` | archive-with-items usage-warning dialog titlebar |
| Destructive | `--danger #b73348` on `--danger-bg #fbe3e8` | delete dialogs (pink), danger badge/banner |

Accent (`titlebar-blue`) reserved for: active RetroTab, primary BevelButton, the
selected/keyboard-active tree row fill. NOT for every interactive element.

**Titlebar semantics (locked):** Taxonomy shell Window = `mint` (a positive
inventory-domain surface, matching Items/Borrowers detail). Create/edit forms =
`blue` (matches InventoryFormPage). Archive usage-warning confirm = `butter`
(non-destructive soft-archive decision). Delete confirms = `pink` (destructive).

---

## Three-non-color-cue discipline

Every state distinction must carry ≥3 cues, never color alone (AA + colorblind).

1. **Archived tree row / list row:**
   (a) `text-fg-muted` dimmed name,
   (b) a `RetroBadge variant="neutral"` reading `ARCHIVED` inline (verbatim
       InventoryListPage pattern),
   (c) row actions swap EDIT/ARCHIVE → `RESTORE` (mint), so the affordance set
       differs.
2. **Color labels (label manager + label chips):** a color is NEVER the only
   identifier — every label renders (a) the color swatch, (b) the label NAME text
   beside it, (c) an ink 1px border on the swatch so a pale/white swatch is still
   visible against the white panel. Color is decoration on top of the name, never
   a substitute for it.
3. **Usage warning (archive category w/ items, delete container w/ items):**
   (a) `⚠` glyph, (b) butter/danger titlebar+banner fill, (c) explicit count in
   the copy ("12 items"), so the warning reads without color.

---

## Page Shell & Routing (resolves OQ3, OQ5)

Single route `/taxonomy`, RetroTabs with the active tab in `?tab=` URL (the
shipped LoansListPage `?tab=` pattern verbatim — `setSearchParams(prev => ...)`).

- **Route:** one `<Route path="taxonomy" element={<TaxonomyPage />} />` in
  `routes/index.tsx`. No nested per-tab routes (matches LoansListPage). Forms get
  their own literal-before-param routes (see Forms §).
- **Tabs (4):** `categories` (default) · `locations` · `containers` · `labels`.
  Resolution of OQ3: the label manager is the **4th Taxonomy tab**, NOT a separate
  `/labels` route — it is a workspace taxonomy resource and shares the page chrome.
- **`?tab=` default:** `categories`. Unknown/absent → `categories`.
- **Window:** one `mint` Window, title `TAXONOMY — ${workspaceName}` (the
  `INVENTORY — ${workspaceName}` title pattern). RetroTabs mounted in the body.
- **Density:** standard Window body padding `p-sp-4`; tabpanel already pads `p-sp-4`
  (RetroTabs owns it) — do NOT double-pad inside panels.

```
┌─ TAXONOMY — HOME ──────────────────────────────────[□][□]┐  ← mint pinstripe titlebar
│ ┌CATEGORIES┐ LOCATIONS  CONTAINERS  LABELS                 │  ← RetroTabs (active = blue)
│ ├──────────┴───────────────────────────────────────────┐ │
│ │ [⊕ ADD ROOT CATEGORY]                                 │ │  ← tab toolbar
│ │ ▾ Electronics                          (24) [EDIT][⊕][⌫]│ │
│ │   ▸ Cables                              (8)  …          │ │
│ │   ▾ Audio                               (5)            │ │
│ │     · Headphones                        (2)            │ │
│ └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## NET-NEW: Recursive Tree atom (Categories + Locations)

No analog exists in `components/retro/`. This is the central net-new component.
Place at `frontend2/src/components/retro/data/RetroTree.tsx` (data family — same
folder as RetroTabs/RetroPagination), export through the `data/index.ts` → barrel.
Shared by Categories and Locations tabs.

### Tree-build strategy (resolves OQ1)

Client-build from the flat `GET /categories` / `GET /locations` list + `parent_id`
(NOT lazy root+children). Rationale: the lists are small (home-warehouse scale,
seeded dozens), one query feeds the whole tree, and a single flat read shares one
RQ cache key per the SSE invalidation convention. A pure `buildTree(rows)` util
(`lib/tree.ts`, shared by both tabs) folds `parent_id → children[]`. Clamp the
list read to `limit=100` (binding constraint #1); page-2+ is out of parity scope.

### Component API (proposed — net-new)

```ts
interface RetroTreeNode {
  id: string;
  name: string;
  itemCount: number;        // assigned-items badge value
  isArchived: boolean;
  children: RetroTreeNode[];
}
interface RetroTreeProps {
  nodes: RetroTreeNode[];
  storageKey: string;       // sessionStorage key, e.g. "taxonomy:tree:categories"
  onAddChild: (parentId: string) => void;
  onEdit: (node: RetroTreeNode) => void;
  onArchive: (node: RetroTreeNode) => void;   // open usage-warning confirm
  onRestore: (node: RetroTreeNode) => void;
  emptyState: ReactNode;    // consumer-supplied RetroEmptyState
}
```

### Expand/collapse state (resolves OQ1 sessionStorage)

Per-tab `sessionStorage` set of expanded ids. Key scheme:
`taxonomy:tree:<tab>` (e.g. `taxonomy:tree:categories`, `taxonomy:tree:locations`).
Value = JSON array of expanded node ids. Read on mount, write on every toggle.
Survives tab switches and refresh within the session; cleared on tab close
(sessionStorage semantics — matches "session-scoped" CONTEXT intent).

### Row anatomy (net-new visual — composed from existing tokens)

```
[indent: depth × 20px] [caret 12px] [name 14px] [count badge] ……… [EDIT][⊕][⌫]
 │                       │            │            │                  │
 │                       │            │            │                  └ row actions (hover/focus reveal)
 │                       │            │            └ RetroBadge variant="neutral", mono "(N)"
 │                       │            └ body 14px; archived → text-fg-muted + ARCHIVED badge
 │                       └ ▾ expanded / ▸ collapsed / · leaf (no children, non-interactive)
 └ indent guide: 1px sand rule (border-l border-[--border-sand #e7ddca]) per level
```

- **Disclosure caret:** `▾` (expanded) / `▸` (collapsed) as a focusable
  `<button>` with `aria-expanded`; `·` (centered dot, `text-fg-faint`,
  non-interactive) for leaf nodes so the name column stays aligned. Caret is a
  borderless glyph button; gains nothing on hover (it is already a discrete hit
  target). 12px glyph + sp-1 gap.
- **Indent guides:** each depth level draws a 1px vertical sand rule
  (`#e7ddca`, the shipped table row-rule color) at its indent origin via
  `border-l` on a 20px-wide spacer, giving the System-7 "outline" feel without
  new tokens. Root level draws no guide.
- **Name:** 14px body. Click on the row (outside the action cluster) navigates to
  nothing this phase (categories/locations have no detail page) — instead a row
  click toggles expand (whole-row hit target for the caret, like a finder). The
  action cluster `stopPropagation` (verbatim InventoryListPage `onClick={(e)=>e.stopPropagation()}`).
- **Item-count badge:** `RetroBadge variant="neutral"` with mono `(N)`. Hidden
  when count is 0 (avoid `(0)` noise). This count drives the usage-warning.
- **Archived dimming:** name `text-fg-muted`; an inline
  `RetroBadge variant="neutral"` reading `ARCHIVED`; actions collapse to a single
  mint `RESTORE`. (Three cues — see discipline §.)
- **Row actions:** three compact BevelButtons (`!px-[8px] !py-[2px] !text-[11px]`):
  - `EDIT` (neutral) → opens edit form,
  - `⊕` add-child (neutral, `aria-label="Add child"`) → opens create form with
    parent pre-selected,
  - `⌫`/`ARCHIVE` (neutral, `aria-label="Archive"`) → opens usage-warning confirm.
  Reveal on row hover/`focus-within`; always rendered (not display:none) so they
  are keyboard-reachable — use `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`
  (the MANIFEST "borderless icon buttons that gain bevel on hover" fallback is the
  sanctioned heavy-row mitigation).

### Keyboard a11y (W3C APG tree pattern)

`role="tree"` on the container, `role="treeitem"` on each row with
`aria-expanded` (branch nodes), `aria-level`, `aria-selected`. Roving tabindex:
`↑/↓` move between visible rows, `→` expand/descend, `←` collapse/ascend,
`Enter`/`Space` toggle. Mirror the roving-tabindex discipline already shipped in
RetroTabs (`tabIndex={isActive ? 0 : -1}`).

### Empty state (per tab)

```tsx
<RetroEmptyState
  eyebrow={<Trans>Taxonomy</Trans>}
  glyph="◇"
  heading={<Trans>NO CATEGORIES YET</Trans>}   // or NO LOCATIONS YET
  body={<Trans>Group your inventory by creating a top-level category. You can nest sub-categories underneath it.</Trans>}
  action={{ label: <Trans>⊕ ADD ROOT CATEGORY</Trans>, onClick: openCreateRoot }}
/>
```

---

## Containers tab (grouped-by-location, TAX-05)

Containers are flat with a `location_id`; the grouping is a CLIENT group-by
(binding constraint — never a server feature). NOT a tree — a flat list of
group sections. Reuse the shipped group-header + row idiom (no new atoms).

```
[⊕ ADD CONTAINER]

┌─ Garage ─────────────────────────────────┐   ← group header: bg-bg-panel-2 strip, 11px uppercase
│  Toolbox A            (12)   [EDIT] [⌫]   │   ← container row (RetroTable rows OR flex rows)
│  Bin 3                (4)    [EDIT] [⌫]   │
├─ Office ──────────────────────────────────┤
│  Drawer 1            (0)    [EDIT] [⌫]    │
└────────────────────────────────────────────┘
(Unassigned)  ← containers with null/unknown location_id group last under "(No location)"
```

- **Group header:** `bg-bg-panel-2` strip, 2px ink bottom rule, 11px uppercase
  letterspaced location name (the shipped table-header treatment). Groups sorted
  alphabetically by location name; a `(No location)` group sorts last.
- **Location names:** join via the `usePickerOptions`/`/locations` read (clamp
  `limit=100`); unresolved → `(No location)` group (mirrors the InventoryListPage
  unresolved-name `—` discipline).
- **Container row:** name (14px), item-count badge `(N)`, `EDIT` + `⌫` DELETE
  actions. Archived containers (the API has archive too) follow the same dim +
  `ARCHIVED` badge + `RESTORE` discipline as tree rows.
- **Render:** use `RetroTable` per group OR flat flex rows — pick `RetroTable`
  rows for visual parity with inventory density (sand rules, hover). Each group is
  its own `<RetroTable>` under its header.

### Container delete-with-cascade (TAX-06 — resolves OQ2)

Containers use **DELETE** (not archive) per CONTEXT OQ6. When the container has
assigned items, deleting unassigns those items (sets their `container_id` null)
then deletes the container — the "unassign-and-delete cascade". RESEARCH must
confirm whether this is a single server call (cascade in the service `svc.Delete`)
or a client-confirm-then-force; the UX below holds either way:

- **Container with 0 items:** plain `pink` RetroConfirmDialog (NOT type-to-confirm
  — containers carry no irreplaceable data; mirror the BorrowerDetailPage plain
  pink delete). Copy: see Copywriting §.
- **Container with N>0 items:** SAME pink dialog, but the body carries the
  `⚠` cascade warning with the explicit count and the consequence sentence. The
  confirm button stays `DELETE` (danger). No type-to-confirm gate — the explicit
  count IS the friction.

---

## Label manager (TAX-07 — 4th tab, resolves OQ3)

CRUD list of workspace labels with a color picker. Extends the shipped
`labelsApi` (currently read+attach only — TAX-07 adds create/update/archive/delete
list management). Label shape (`lib/types.ts` `Label`): `{ id, name, color?, description? }`.

```
[⊕ ADD LABEL]

┌────────────────────────────────────────────────┐
│ ■ Fragile          fragile, handle with care  [EDIT][⌫] │  ← swatch + name + (optional desc) + actions
│ ■ Loaned out                                   [EDIT][⌫] │
│ ■ Warranty                                     [EDIT][⌫] │
└────────────────────────────────────────────────┘
```

- **Row anatomy:** `[color swatch 16×16, 1px ink border] [name 14px semibold]
  [description muted 13px, optional] ……… [EDIT][⌫]`. The 1px ink border on the
  swatch is MANDATORY (cue #3 — keeps a white/pale swatch visible).
- **Color field:** `Label.color` is a hex string (optional). Color picker =
  a **fixed swatch palette** drawn from the shipped pastel + deep tokens, NOT a
  free `<input type=color>` (keeps labels on-palette, AA-safe). Offer the 8
  system colors as clickable swatches; selected swatch gets a 2px ink ring + `✓`:
  `--titlebar-blue`, `--titlebar-pink`, `--titlebar-mint`, `--titlebar-butter`,
  `--accent-blue-deep`, `--accent-pink-deep`, `--accent-mint-deep`, `--danger`.
  No-color is allowed (renders a neutral `bg-bg-panel-2` swatch). RESEARCH:
  confirm the backend `color` column accepts arbitrary hex; if it constrains to an
  enum, map the swatch set to that enum.
- **Delete:** plain `pink` RetroConfirmDialog. Labels detach from items on delete
  (RESEARCH: confirm whether server cascades the item↔label links); if labels are
  attached, surface the attached-count in the copy (cue parity with containers).
  Labels also have archive/restore — prefer **archive** as the soft default and
  **delete** as the destructive option, matching the categories/locations split.

---

## Forms / dialogs (resolves OQ4 picker scope)

Mirror the shipped `InventoryFormPage` convention: a single **blue Window**,
centered `max-w-[560px]`, RHF + zod, native field atoms, pinned footer
(`Cancel` neutral + primary submit), dirty-guard butter `DISCARD CHANGES?` confirm.

**Placement decision:** category/location/container forms are **dedicated routes**
(matches InventoryFormPage / BorrowerFormPage `/...new` + `/.../:id/edit`):

```
taxonomy/categories/new        taxonomy/categories/:id/edit
taxonomy/locations/new         taxonomy/locations/:id/edit
taxonomy/containers/new        taxonomy/containers/:id/edit
```

Literal-before-param ordering (binding constraint #5): every `.../new` route
registered ABOVE its `.../:id/edit` sibling. The **label** form is the one
exception — labels are lightweight (name + color), so the label create/edit is an
**inline `RetroDialog`** opened from the Labels tab (no route), matching the
"lightweight modal for trivial forms" precedent. RESEARCH may promote it to a
route if validation grows.

### Parent / location selector — the type-ahead picker (resolves OQ4)

A type-ahead picker component already exists: **`RetroCombobox`** (shipped,
W3C list-autocomplete, virtual focus). USE IT — do NOT build a new picker atom.

- **Category/Location form → "Parent" field:** `RetroCombobox` populated from the
  flat list (the same `buildTree` source, flattened to `{value:id, label:name}`
  with indent prefix or breadcrumb). Empty value = root. Exclude self + own
  descendants from the options (no cycles) — a `flattenExcluding(node)` util.
- **Container form → "Location" field:** `RetroCombobox` backed by
  `/locations/search` (or the clamped `/locations` list). Required.
- **Scope (resolves OQ4):** ship/USE `RetroCombobox` in the Taxonomy forms ONLY.
  Do NOT retrofit the shipped item/inventory/loan forms — those use
  `usePickerOptions` native `RetroSelect` dropdowns and are stable (CONTEXT OQ4
  RISK). Leave them untouched.
- **Empty-source disabled state:** when no locations exist, disable the container
  form's location field + show the shipped `No locations yet — add one first.`
  hint (verbatim InventoryFormPage pattern). Categories/locations parent field
  with no rows simply offers only the root (empty) option — not an error.

---

## Copywriting Contract

### Primary CTAs (per tab toolbar)

| Tab | CTA |
|-----|-----|
| Categories | `⊕ ADD ROOT CATEGORY` (toolbar) · `⊕` add-child (per row) |
| Locations | `⊕ ADD ROOT LOCATION` (toolbar) · `⊕` add-child (per row) |
| Containers | `⊕ ADD CONTAINER` |
| Labels | `⊕ ADD LABEL` |

### Empty states

| Surface | Heading | Body |
|---------|---------|------|
| Categories (no rows) | `NO CATEGORIES YET` | `Group your inventory by creating a top-level category. You can nest sub-categories underneath it.` |
| Locations (no rows) | `NO LOCATIONS YET` | `Add your first location — a room, shelf, or area. Nest sub-locations to mirror your space.` |
| Containers (no rows) | `NO CONTAINERS YET` | `Containers live inside a location. Add one to start grouping items by box, bin, or drawer.` |
| Labels (no rows) | `NO LABELS YET` | `Create a label to tag items across categories — like “Fragile” or “Loaned out”.` |
| Any tab — load error | `COULDN'T LOAD {RESOURCE}` | `Something went wrong. Try again.` + `RETRY` action (verbatim ItemDetailPage error state) |

### Toasts (`retroToast`)

| Action | Toast | Method |
|--------|-------|--------|
| Create category/location/container/label | `{Name} created.` | `.success` |
| Edit | `Changes saved.` | `.success` |
| Archive (category/location/label) | `{Name} archived.` | `.success` |
| Restore | `{Name} restored.` | `.success` |
| Delete (container/label) | `{Name} deleted.` | `.success` |
| Any mutation failure | `Couldn't {verb} {resource}. Try again.` | `.error` (persists — Infinity duration, the shipped default) |

### Destructive / cascade / usage-warning copy

| Dialog | Titlebar | Title | Body | Confirm |
|--------|----------|-------|------|---------|
| Archive category/location, 0 items | butter | `ARCHIVE {RESOURCE}?` | `Archive “{name}”? You can restore it later.` | `Archive` (neutral) |
| **Archive category/location WITH items (usage warning, TAX-02)** | butter | `ARCHIVE {RESOURCE}?` | `⚠ “{name}” has {n} item{s} assigned to it. Archiving keeps those items but hides this {resource} from pickers until you restore it.` | `Archive anyway` (neutral) |
| Delete container, 0 items | pink | `DELETE CONTAINER?` | `Delete “{name}”? This can’t be undone.` | `DELETE` (danger) |
| **Delete container WITH items (cascade, TAX-06)** | pink | `DELETE CONTAINER?` | `⚠ “{name}” holds {n} item{s}. Deleting it will move those items out of any container (they stay in their location) and then delete the container. This can’t be undone.` | `DELETE` (danger) |
| Delete label | pink | `DELETE LABEL?` | `Delete “{name}”? It will be removed from {n} item{s}. This can’t be undone.` (omit the removal clause when n = 0) | `DELETE` (danger) |
| Discard unsaved form edits | butter | `DISCARD CHANGES?` | `Your edits will be lost.` | `Discard` (neutral) — verbatim shipped |

`{s}` = pluralize ("" / "s"); `{resource}` = lowercased ("category"/"location").
None of the destructive dialogs use a type-to-confirm gate (OQ6 precedent: only
items use type-to-confirm; the explicit count is the friction here).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (no shadcn) |
| third-party | none | not applicable |

No registries. All components are first-party retro atoms.

---

## Open UI Questions (RESOLVED)

| OQ | Resolution | Source |
|----|------------|--------|
| OQ1 Tree build + storage | Client-build from flat `GET /{resource}` + `parent_id` via `buildTree` util (lists are small, one query, shares SSE cache). Clamp `limit=100`. Expanded set in `sessionStorage` key `taxonomy:tree:<tab>`. | CONTEXT scale + binding constraint #1, #4 |
| OQ2 Archive usage-warning + container cascade | Categories/locations ARCHIVE (soft) → butter "Archive anyway" with item count. Containers DELETE → pink cascade dialog with count + consequence. No type-to-confirm. Exact HTTP contract (server-cascade vs client-force) → **RESEARCH must confirm**; UX holds either way. | shipped confirm patterns + CONTEXT OQ2/OQ6 |
| OQ3 Label manager placement | 4th Taxonomy tab (`?tab=labels`), NOT a separate `/labels` route. Color picker = fixed on-palette swatch set (8 system colors + none), not free color input. | CONTEXT OQ3 + token palette |
| OQ4 Type-ahead picker scope | `RetroCombobox` ALREADY EXISTS — reuse it. Wire into Taxonomy forms (parent / location fields) ONLY. Do NOT retrofit shipped item/inventory/loan forms. | shipped `RetroCombobox.tsx` + CONTEXT OQ4 RISK |
| OQ5 Page structure | One `/taxonomy` route, RetroTabs, `?tab=` URL (LoansListPage pattern). Forms = dedicated literal-before-param routes; label form = inline RetroDialog. | shipped LoansListPage + routes/index.tsx |
| OQ6 Archive vs delete semantics | Categories/locations/labels = ARCHIVE (soft, restore exists) as primary; DELETE endpoints exist but are the destructive secondary. Containers = DELETE (cascade). | CONTEXT backend surface + OQ6 |

### Genuinely unresolved — flagged for RESEARCH (not visual blockers)

1. **Exact cascade/usage-warning HTTP contract** (OQ2): does `svc.Archive`/
   `svc.Delete` return a specific status/code when items are assigned, and is
   "unassign-and-delete" a server-side cascade or a client `?force=` flag / second
   call? The dialog COPY and UX above are final regardless; only the wiring
   (which API calls fire on confirm) depends on this. RESEARCH must read the Go
   service + `MapDomainError`.
2. **Label `color` column shape**: arbitrary hex vs constrained enum. If enum, map
   the swatch set to it; if hex, the 8-swatch palette is a UI constraint only.
3. **Label delete cascade**: confirm whether deleting a label server-cascades the
   item↔label links (drives whether the "removed from N items" copy is accurate).

### Net-new visual decision made here (no prior analog)

- **Tree caret/indent treatment**: `▾`/`▸`/`·` glyph caret (12px, focusable
  button) + 20px-per-level indent with 1px sand (`#e7ddca`) vertical guides.
  Derived entirely from shipped tokens (the table row-rule color + the existing
  glyph vocabulary). This is the ONE genuinely new idiom; proposed and locked
  above so the planner/executor need not improvise.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
