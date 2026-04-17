# Phase 63: Navigation & Polish — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the retro sidebar and dashboard to every v2.1 section, audit empty states across all six v2.1 list pages, and complete the Lingui EN/ET catalogs. No new retro primitives. No new routes. No new backend work. Everything this phase touches is already built — this phase connects and polishes.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Links (NAV-01)
- **D-01:** Add `BORROWERS` (→ `/borrowers`) and `TAXONOMY` (→ `/taxonomy`) NavLinks to `Sidebar.tsx` in the order specified by the UI-SPEC: Dashboard → Items → Loans → Borrowers → Taxonomy → Settings.
- **D-02:** Settings is pushed to the bottom of the sidebar using `mt-auto` on its NavLink wrapper — **not** a horizontal divider, **not** a flat equal-weight list. Use `flex flex-col` on the `<nav>` with a `<div className="mt-auto" />` spacer between Taxonomy and Settings. This matches the iOS Settings visual pattern without adding a visible border.
- **D-03:** Do NOT add a `/scan` NavLink — scanning is deferred to v2.2. The `/scan` route remains reachable only from the dashboard quick-action card.

### Dashboard Cards (NAV-02)
- **D-04:** NAV-02 is a **verification step only** — no code changes expected. `QuickActionCards.tsx` already routes ADD ITEM → `/items` and VIEW LOANS → `/loans`, both of which are real v2.1 list pages. The plan task is to manually verify both links resolve correctly (not 404) and record the result. SCAN BARCODE → `/scan` is kept as-is (v2.2 scope).

### Empty State Audit
- **D-05:** Audit all six v2.1 list pages against the UI-SPEC empty state copy table. Any string that deviates from the table is authoritatively wrong and must be rewritten to match the table — do not update the table to match the code. Pages to audit: Items (3 empty state variants), Loans (3 tab variants), Borrowers, Taxonomy (3 tab variants: categories, locations, containers).

### i18n Sweep
- **D-06:** **Full v2.1 audit.** Run `bun run extract` in `frontend2/`, then open `frontend2/locales/et/messages.po` and fill every untranslated (empty `msgstr`) string introduced across phases 56–62. This is the canonical definition of "catalogs complete" for this phase. ET translations for the two new sidebar labels: `BORROWERS` → `LAENAJAD`, `TAXONOMY` → `TAKSONOOMIA` (confirmed in UI-SPEC).

### Plan Structure
- **D-07:** **1 plan** covering everything: sidebar links + mt-auto spacer, dashboard verification, empty state audit + rewrites, `bun run extract` + full ET gap fill.

### Claude's Discretion
- Exact Tailwind class for the `mt-auto` spacer (e.g., `<div className="mt-auto" />` or `flex-1` on the top group)
- Whether to split the sidebar nav into two `<div>` groups vs a single flex column with a spacer element
- Order of tasks within the single plan

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Design Contract (primary reference)
- `.planning/phases/63-navigation-and-polish/63-UI-SPEC.md` — **Full visual and interaction contract for Phase 63.** Covers exact sidebar link order and copy, dashboard card contract, empty state copy table (10 variants), typography, color, spacing tokens, and Lingui copywriting for EN + ET. **Read this entirely before planning.**

### Navigation
- `frontend2/src/components/layout/Sidebar.tsx` — Current sidebar with 4 links. **Action:** add Borrowers + Taxonomy NavLinks, add `mt-auto` spacer before Settings.
- `frontend2/src/features/dashboard/QuickActionCards.tsx` — Current dashboard cards. **Action:** verify only (no code change expected).
- `frontend2/src/routes/index.tsx` — Route tree reference to confirm `/borrowers` and `/taxonomy` routes exist.

### Empty State Pages (audit targets)
- `frontend2/src/features/items/ItemsListPage.tsx` — 3 empty state variants
- `frontend2/src/features/loans/LoansListPage.tsx` — 3 tab empty state variants
- `frontend2/src/features/borrowers/BorrowersListPage.tsx` — 1 empty state
- `frontend2/src/features/taxonomy/TaxonomyPage.tsx` — 3 tab empty state variants (categories, locations, containers)

### i18n
- `frontend2/locales/en/messages.po` — EN catalog (source of truth)
- `frontend2/locales/et/messages.po` — ET catalog (target for gap fill)

### Retro Primitive
- `frontend2/src/components/retro/RetroEmptyState.tsx` — Component API reference for empty state audit

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Sidebar.tsx`: NavLink pattern with `navItemBase`, `navItemDefault`, `navItemActive` constants — reuse verbatim for the two new links. Do not introduce new CSS classes.
- `RetroEmptyState`: Already in use across Items, Loans, Borrowers — audit Taxonomy for any deviation.

### Established Patterns
- NavLinks use `NavLink` from `react-router` with `({ isActive }) =>` className callback.
- All sidebar labels use Lingui `t` macro via `useLingui()`.
- `mt-auto` spacer pattern is idiomatic for flex column layouts pushing items to the bottom — no new utility needed.

### Integration Points
- `Sidebar.tsx` is rendered inside `AppShell.tsx` — no shell changes needed, only sidebar changes.
- `/borrowers` and `/taxonomy` routes are already registered in `routes/index.tsx` (confirmed via Phase 58/59 work).

</code_context>

<specifics>
## Specific Ideas

- Settings pushed to bottom via `mt-auto` spacer (not a horizontal divider, not flat list) — user confirmed this layout during discussion.
- The UI-SPEC copywriting table is the canonical source for all empty state strings — code deviations must be corrected to match the table, not the reverse.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 63-navigation-and-polish*
*Context gathered: 2026-04-17*
