# Phase 60: Items CRUD — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 60-items-crud
**Areas discussed:** Backend gaps, Form scope & fields, Detail page layout, List display & density

---

## Backend gaps

### location/container/status/notes fields

| Option | Description | Selected |
|--------|-------------|----------|
| Add directly to Item entity | Migration + handler to add location_id, container_id, status, notes to v2 Item | |
| Skip for Phase 60, defer to later | Phase 60 uses only current v2 Item fields; ITEM-03 partially satisfied | ✓ |
| Introduce Inventory entity like v1 | New Inventory entity with location/container/status/quantity/condition/notes | |

**User's choice:** Skip — defer location/container/status/notes to a later phase.
**Notes:** User asked how v1 handled it. In v1 these fields lived on a separate Inventory entity, not on Item. v2 never ported that entity. User chose to defer rather than add to Item directly or rebuild the Inventory model.

---

### Backend list endpoint extension

| Option | Description | Selected |
|--------|-------------|----------|
| Extend backend handler | Add search/category_id/archived/sort/sort_dir query params to ListItemsInput | ✓ |
| Client-side filter | Fetch all, filter on frontend | |
| Use /items/search only | Text search only, no category filter or sort | |

**User's choice:** Extend backend handler.
**Notes:** Required to meet ITEM-01 and ITEM-02 acceptance criteria.

---

### DELETE /items/{id} handler

| Option | Description | Selected |
|--------|-------------|----------|
| Archive-first + hard-delete | Wire DELETE handler; primary ARCHIVE, secondary delete permanently link | ✓ |
| Archive-only | Skip DELETE handler, archive is the effective delete | |

**User's choice:** Archive-first with possibility of hard-delete.
**Notes:** Matches borrower and taxonomy patterns. No FK guard needed (items have no active-loan constraint).

---

## Form scope & fields

### Which fields in create/edit form

| Option | Description | Selected |
|--------|-------------|----------|
| Core fields only | Name, SKU (auto), barcode, description, category | ✓ |
| All fields in one form | Every Item field in scrollable slide-over | |
| Tabbed/sectioned form | Basic + Classification + Details sections | |

**User's choice:** Core fields only.

---

### SKU handling

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generated, editable | Pre-filled SKU, user can override | ✓ |
| Required, user types it | Must enter SKU to save | |
| Optional, blank if omitted | Backend needs to allow empty SKU | |

**User's choice:** Auto-generated, editable.

---

### Create vs. edit form scope

| Option | Description | Selected |
|--------|-------------|----------|
| Same fields for create and edit | One panel, same core fields both modes | ✓ |
| Edit expands to all fields | Create = core; edit reveals additional sections | |

**User's choice:** Same fields for both modes.
**Notes:** User asked about where extra fields live — clarified that extra fields (brand/model/warranty etc.) are deferred entirely from Phase 60 UI.

---

### Where extra fields live

| Option | Description | Selected |
|--------|-------------|----------|
| Deferred — not in Phase 60 UI | Brand/model/serial/warranty fields not surfaced in Phase 60 | ✓ |
| Collapsible "More details" in slide-over | Expandable section in same panel | |
| "Edit details" card on detail page | Second card on detail page for extra fields | |

**User's choice:** Deferred — not in Phase 60 UI.

---

## Detail page layout

### Photo and loan placeholders

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include placeholders | Photos section + Loans section with RetroEmptyState | ✓ |
| No placeholders — clean detail page | Sections added entirely by Phase 61/62 | |

**User's choice:** Include placeholders — establishes page structure now.

---

### Archive/delete action location

| Option | Description | Selected |
|--------|-------------|----------|
| Actions row near page header | Archive/Delete buttons near item name (BorrowerDetailPage pattern) | ✓ |
| Bottom "Danger zone" section | Actions grouped at bottom of page | |

**User's choice:** Actions row near page header.

---

## List display & density

### List columns

| Option | Description | Selected |
|--------|-------------|----------|
| Name + SKU + Category + Actions | Four columns, compact | ✓ |
| Name + SKU + Barcode + Category + Actions | Five columns | |
| Name + Category + Actions | Three columns, minimal | |

**User's choice:** Name + SKU + Category + Actions.

---

### Archived items toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox toggle | Consistent with BorrowersListPage | |
| Filter chip | Retro-styled chip/badge toggle | ✓ |

**User's choice:** Filter chip — new UI pattern for the items list.

---

### Search/filter bar placement

| Option | Description | Selected |
|--------|-------------|----------|
| Above table in a filter bar | Compact row: search + category + sort + archived chip | ✓ |
| Collapsible filter panel | Toggle button reveals filter panel | |

**User's choice:** Filter bar above table.

---

## Claude's Discretion

- Filter bar state management (URL params vs. component state)
- Debounce delay for search input
- RetroSelect vs RetroCombobox for category filter
- Query invalidation strategy
- SKU auto-generation pattern (specific format)

## Deferred Ideas

- location_id, container_id, status, notes on Item (future Inventory/Item-Details phase)
- Brand, model, serial number, warranty fields in form (future Item Details expansion)
- Barcode scanning (v2.2)
- Item labels UI (backend exists, not surfaced in Phase 60)
