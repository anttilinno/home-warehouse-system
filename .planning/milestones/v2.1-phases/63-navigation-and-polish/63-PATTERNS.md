# Phase 63: Navigation & Polish — Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 6 files to modify (no new files)
**Analogs found:** 6 / 6 (all files are their own analog — this phase modifies existing files only)

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `frontend2/src/components/layout/Sidebar.tsx` | component (layout) | event-driven | itself — extend in-place | exact |
| `frontend2/src/features/dashboard/QuickActionCards.tsx` | component | request-response | itself — verify only, no code change | exact |
| `frontend2/src/features/items/ItemsListPage.tsx` | component (list page) | request-response | itself — audit empty state copy | exact |
| `frontend2/src/features/loans/LoansListPage.tsx` | component (list page) | request-response | itself — audit empty state copy | exact |
| `frontend2/src/features/borrowers/BorrowersListPage.tsx` | component (list page) | request-response | itself — audit empty state copy | exact |
| `frontend2/src/features/taxonomy/tabs/LocationsTab.tsx` | component (tab) | request-response | `CategoriesTab.tsx` — identical structure | exact |
| `frontend2/locales/et/messages.po` | i18n catalog | transform | itself — fill empty msgstr entries | exact |

---

## Pattern Assignments

### `frontend2/src/components/layout/Sidebar.tsx` (layout component, event-driven)

**Change:** Add two NavLinks (BORROWERS → `/borrowers`, TAXONOMY → `/taxonomy`) between the existing LOANS and SETTINGS links, with a `mt-auto` spacer before SETTINGS to push it to the bottom.

**Current file state** (lines 1-63 of `Sidebar.tsx`):

The file has 4 NavLinks in this order: DASHBOARD (line 24), ITEMS (line 34), LOANS (line 43), SETTINGS (line 52).

**NavLink pattern to copy verbatim** (lines 43-50 — LOANS link, representative example):
```tsx
<NavLink
  to="/loans"
  className={({ isActive }) =>
    `${navItemBase} ${isActive ? navItemActive : navItemDefault}`
  }
  onClick={onNavClick}
>
  {t`LOANS`}
</NavLink>
```

**Lingui translation pattern** (lines 17, 32, 41, 50, 59 — all existing labels):
```tsx
const { t } = useLingui();  // line 17 — already present, do not re-declare
// Usage: {t`BORROWERS`}  {t`TAXONOMY`}
```

**mt-auto spacer pattern** — add this `<div>` between the TAXONOMY NavLink and the SETTINGS NavLink:
```tsx
<div className="mt-auto" />
```

**Exact new `<nav>` children order after modification:**
```tsx
<NavLink to="/" end …>{t`DASHBOARD`}</NavLink>
<NavLink to="/items" …>{t`ITEMS`}</NavLink>
<NavLink to="/loans" …>{t`LOANS`}</NavLink>
<NavLink to="/borrowers" …>{t`BORROWERS`}</NavLink>
<NavLink to="/taxonomy" …>{t`TAXONOMY`}</NavLink>
<div className="mt-auto" />
<NavLink to="/settings" …>{t`SETTINGS`}</NavLink>
```

The `<nav>` element already carries `flex flex-col gap-sm` (line 22). `mt-auto` on the spacer div pushes SETTINGS to the bottom of the flex column. No new CSS classes or variables are needed.

---

### `frontend2/src/features/dashboard/QuickActionCards.tsx` (component, request-response)

**Change:** Verification only — no code change expected.

**Current routes** (lines 6-9):
```tsx
const actions = [
  { labelKey: "ADD ITEM", to: "/items" },
  { labelKey: "SCAN BARCODE", to: "/scan" },
  { labelKey: "VIEW LOANS", to: "/loans" },
] as const;
```

**Verification contract:** Navigate to `/items` (must render `ItemsListPage`, not 404 or DemoPage) and `/loans` (must render `LoansListPage`). `/scan` is a v2.2 placeholder — leave as-is.

---

### `frontend2/src/features/items/ItemsListPage.tsx` (list page component, request-response)

**Change:** Audit empty state copy — all three variants are already present and match the UI-SPEC table exactly. No code change expected (confirm only).

**Current empty states** (lines 255-299):

Variant 1 — filter active, 0 matches (lines 258-267):
```tsx
<RetroEmptyState
  title={t`NO MATCHES`}
  body={t`No items match your filters. Clear them to see all items.`}
  action={
    <RetroButton variant="neutral" onClick={clearFilters}>
      {t`CLEAR FILTERS`}
    </RetroButton>
  }
/>
```

Variant 2 — no filter, archived count > 0 (lines 273-283):
```tsx
<RetroEmptyState
  title={t`NO ACTIVE ITEMS`}
  body={t`All items are currently archived. Toggle "Show archived" to view them.`}
  action={
    <RetroButton variant="primary" onClick={handleNew}>
      {t`+ NEW ITEM`}
    </RetroButton>
  }
/>
```

Variant 3 — no filter, no archived items (lines 288-298):
```tsx
<RetroEmptyState
  title={t`NO ITEMS YET`}
  body={t`Create your first item to start tracking inventory.`}
  action={
    <RetroButton variant="primary" onClick={handleNew}>
      {t`+ NEW ITEM`}
    </RetroButton>
  }
/>
```

All three match the UI-SPEC table verbatim. Record "confirmed" in the plan task.

---

### `frontend2/src/features/loans/LoansListPage.tsx` (list page component, request-response)

**Change:** Audit empty state copy — all three tab variants are already present and match the UI-SPEC table. No code change expected.

**Current empty states** (lines 145-176):

Active tab (lines 149-158):
```tsx
<RetroEmptyState
  title={t`NO ACTIVE LOANS`}
  body={t`Nothing is currently out on loan.`}
  action={
    <RetroButton variant="primary" onClick={handleNew}>
      {t`+ NEW LOAN`}
    </RetroButton>
  }
/>
```

Overdue tab (lines 163-167):
```tsx
<RetroEmptyState
  title={t`NO OVERDUE LOANS`}
  body={t`Nothing is past its due date. Nice.`}
/>
```

History tab (lines 172-175):
```tsx
<RetroEmptyState
  title={t`NO LOAN HISTORY`}
  body={t`Returned loans will appear here.`}
/>
```

All three match the UI-SPEC table verbatim. Record "confirmed" in the plan task.

---

### `frontend2/src/features/borrowers/BorrowersListPage.tsx` (list page component, request-response)

**Change:** Audit empty state copy — single empty state is already present and matches the UI-SPEC table. No code change expected.

**Current empty state** (lines 194-204):
```tsx
{workspaceId && isEmpty && (
  <RetroEmptyState
    title={t`NO BORROWERS YET`}
    body={t`Create your first borrower to start tracking loans.`}
    action={
      <RetroButton variant="primary" onClick={handleNew}>
        {t`+ NEW BORROWER`}
      </RetroButton>
    }
  />
)}
```

Matches the UI-SPEC table verbatim. Record "confirmed" in the plan task.

---

### `frontend2/src/features/taxonomy/tabs/LocationsTab.tsx` (tab component, request-response)

**Change:** Audit empty state copy — the current body text does NOT match the UI-SPEC table and must be rewritten.

**Current empty state body** (line 138):
```tsx
body={t`Create your first location to describe where items live.`}
```

**UI-SPEC required body:**
```
Create your first location to start placing items.
```

**Required fix** (lines 135-145 — replace the `body` prop value):
```tsx
{workspaceId && query.isSuccess && allItems.length === 0 && (
  <RetroEmptyState
    title={t`NO LOCATIONS YET`}
    body={t`Create your first location to start placing items.`}
    action={
      <RetroButton variant="primary" onClick={handleNew}>
        {t`+ NEW LOCATION`}
      </RetroButton>
    }
  />
)}
```

**What stays the same:** title (`NO LOCATIONS YET`), action label (`+ NEW LOCATION`), all surrounding conditional logic, the `RetroEmptyState` component itself. Only the `body` string changes.

**ET catalog consequence:** After this fix, `bun lingui extract` will emit a new msgid `"Create your first location to start placing items."` and the old msgid `"Create your first location to describe where items live."` will become orphaned. The old ET translation (`[ET] Create your first location to describe where items live.` at ET catalog line 630) will no longer match. The new msgid must be translated to Estonian as part of the i18n sweep task.

**Analog — CategoriesTab.tsx lines 133-143** (identical structure, confirmed matching):
```tsx
{workspaceId && query.isSuccess && allItems.length === 0 && (
  <RetroEmptyState
    title={t`NO CATEGORIES YET`}
    body={t`Create your first category to start organizing items.`}
    action={
      <RetroButton variant="primary" onClick={handleNew}>
        {t`+ NEW CATEGORY`}
      </RetroButton>
    }
  />
)}
```

---

### `frontend2/src/features/taxonomy/tabs/ContainersTab.tsx` (tab component, request-response)

**Change:** Audit empty state copy — already matches the UI-SPEC table. No code change expected.

**Current empty state** (lines 165-179):
```tsx
{workspaceId && isEmpty && (
  <RetroEmptyState
    title={t`NO CONTAINERS YET`}
    body={t`Containers belong to a location. Create a location first, then add containers inside it.`}
    action={
      <RetroButton
        variant="primary"
        onClick={handleNew}
        disabled={!hasLocations}
      >
        {t`+ NEW CONTAINER`}
      </RetroButton>
    }
  />
)}
```

Matches the UI-SPEC table verbatim (including the `disabled={!hasLocations}` behavior). Record "confirmed" in the plan task.

---

### `frontend2/locales/et/messages.po` (i18n catalog, transform)

**Change:** Fill all empty `msgstr ""` entries for strings introduced in phases 56–62 and in this phase. Run `bun lingui extract` first after adding the two Sidebar NavLinks.

**Catalog format pattern** (lines 1-19 of ET messages.po — header, then first translated entry):
```po
msgid ""
msgstr ""
"POT-Creation-Date: 2026-04-09 09:21+0300\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=utf-8\n"
…

#: src/features/borrowers/BorrowersListPage.tsx:158
msgid "BORROWERS"
msgstr ""
```

**New sidebar labels — already have msgid entries in the catalog:**
- `msgid "BORROWERS"` at ET line 313 — `msgstr ""` → must become `msgstr "LAENAJAD"`
- `msgid "TAXONOMY"` at ET line 1913 — `msgstr "[ET] TAXONOMY"` → must become `msgstr "TAKSONOOMIA"`

**Known gap — NO BORROWERS YET** (ET line 1320-1321): `msgstr ""` → translate to Estonian.

**Known gap — locations body string** (ET line 629-630): old string `"Create your first location to describe where items live."` has a placeholder translation `[ET] …`; after the LocationsTab fix, the new msgid `"Create your first location to start placing items."` will need a real ET translation.

**i18n operation order:**
1. Edit `LocationsTab.tsx` body string first.
2. Edit `Sidebar.tsx` to add BORROWERS and TAXONOMY NavLinks.
3. Run `bun lingui extract` from `frontend2/` — this regenerates msgid entries.
4. Open `frontend2/locales/et/messages.po` and fill all `msgstr ""` entries.
5. Run `bun lingui compile` to regenerate compiled bundles.
6. Verify with `grep -n 'msgstr ""' frontend2/locales/et/messages.po` — must return zero or only intentional empties.

---

## Shared Patterns

### RetroEmptyState usage pattern
**Source:** `frontend2/src/components/retro/RetroEmptyState.tsx` (lines 6-10 — props interface)
**Apply to:** All list pages / tab components with empty states

```tsx
interface RetroEmptyStateProps {
  title: string;       // UPPERCASE, renders as h2 text-[20px] font-bold
  body?: ReactNode;    // sentence-case, renders as text-[16px]
  action?: ReactNode;  // optional — omit for informational-only empty states
  showHazardStripe?: boolean;
  className?: string;
}
```

Rule: informational-only empty states (overdue loans, history loans) pass no `action` prop. Action-bearing empty states pass a `<RetroButton variant="primary">` for the primary CTA, or `variant="neutral"` for clear-filters.

### Lingui `t` macro pattern
**Source:** Every list page and Sidebar.tsx
**Apply to:** All user-visible strings

```tsx
import { useLingui } from "@lingui/react/macro";
// inside component:
const { t } = useLingui();
// usage:
{t`STRING LITERAL HERE`}
```

Do not use `Trans` component or `i18n._()` — the `t` tagged template literal from `useLingui()` is the established pattern throughout phases 48–62.

### NavLink class pattern
**Source:** `frontend2/src/components/layout/Sidebar.tsx` lines 9-14
**Apply to:** New BORROWERS and TAXONOMY NavLinks

```tsx
const navItemBase =
  "w-full text-left px-md py-sm font-bold uppercase text-[14px] border-retro-thick border-retro-ink cursor-pointer outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber";
const navItemDefault =
  "bg-retro-cream text-retro-ink shadow-retro-raised hover:bg-retro-amber";
const navItemActive =
  "bg-retro-amber text-retro-ink shadow-retro-pressed";
// className callback:
className={({ isActive }) =>
  `${navItemBase} ${isActive ? navItemActive : navItemDefault}`
}
```

These three constants are already declared at module scope in Sidebar.tsx. Do not re-declare or create variants.

---

## Pre-flight: Empty State Audit Summary

| Surface | File | Current body | UI-SPEC body | Delta |
|---------|------|-------------|-------------|-------|
| `/items` — no data | `ItemsListPage.tsx:291` | `Create your first item to start tracking inventory.` | same | none |
| `/items` — filter | `ItemsListPage.tsx:260` | `No items match your filters. Clear them to see all items.` | same | none |
| `/items` — all archived | `ItemsListPage.tsx:275` | `All items are currently archived. Toggle "Show archived" to view them.` | same | none |
| `/loans` — active | `LoansListPage.tsx:151` | `Nothing is currently out on loan.` | same | none |
| `/loans` — overdue | `LoansListPage.tsx:165` | `Nothing is past its due date. Nice.` | same | none |
| `/loans` — history | `LoansListPage.tsx:173` | `Returned loans will appear here.` | same | none |
| `/borrowers` | `BorrowersListPage.tsx:197` | `Create your first borrower to start tracking loans.` | same | none |
| `/taxonomy` categories | `CategoriesTab.tsx:137` | `Create your first category to start organizing items.` | same | none |
| `/taxonomy` locations | `LocationsTab.tsx:138` | `Create your first location to describe where items live.` | `Create your first location to start placing items.` | **REWRITE REQUIRED** |
| `/taxonomy` containers | `ContainersTab.tsx:168` | `Containers belong to a location. Create a location first, then add containers inside it.` | same | none |

---

## No Analog Found

None. All modified files exist in the codebase with clear patterns. No net-new files are created in Phase 63.

---

## Metadata

**Analog search scope:** `frontend2/src/components/layout/`, `frontend2/src/features/`, `frontend2/locales/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-04-17
