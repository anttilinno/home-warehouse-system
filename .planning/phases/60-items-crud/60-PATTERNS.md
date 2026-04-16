# Phase 60: Items CRUD - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 28 (21 new, 7 modified)
**Analogs found:** 26 / 28 (exact: 18, role-match: 8, none: 2)

Phase 60 is a near-verbatim mirror of Phase 59 (borrowers) with three deviations:

1. **Server-side filter/sort/search/pagination** where Phase 59 fetched all. All list-side analogs come from Phase 58 (`categoriesApi.list({archived})`) for param shape and Phase 59 (`BorrowersListPage`) for composition shape.
2. **Filter chip primitive** (`ShowArchivedChip`) has no existing analog and must be composed from base tokens. UI-SPEC + `RetroCheckbox` + `RetroBadge` styling provide the token language.
3. **Category name resolver** (`useCategoryNameMap`) has no existing analog. Pattern is a one-shot `useQuery({categoriesApi.list, staleTime: 60_000})` + `useMemo` to build a `Map`.

Every other file has a Phase 58 or Phase 59 analog that can be copied, renamed, and mutated minimally.

## File Classification

### Frontend (new files)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend2/src/features/items/ItemsListPage.tsx` | component (page) | request-response | `frontend2/src/features/borrowers/BorrowersListPage.tsx` | exact |
| `frontend2/src/features/items/ItemDetailPage.tsx` | component (page) | request-response | `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` | exact |
| `frontend2/src/features/items/panel/ItemPanel.tsx` | component (ref) | request-response | `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx` | exact |
| `frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx` | component (ref) | request-response | `frontend2/src/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx` | exact |
| `frontend2/src/features/items/forms/ItemForm.tsx` | component (form) | request-response | `frontend2/src/features/borrowers/forms/BorrowerForm.tsx` | exact |
| `frontend2/src/features/items/forms/schemas.ts` | utility (zod) | transform | `frontend2/src/features/borrowers/forms/schemas.ts` | exact |
| `frontend2/src/features/items/hooks/useItemsList.ts` | hook | request-response | `frontend2/src/features/borrowers/hooks/useBorrowersList.ts` | exact |
| `frontend2/src/features/items/hooks/useItem.ts` | hook | request-response | `frontend2/src/features/borrowers/hooks/useBorrower.ts` | exact |
| `frontend2/src/features/items/hooks/useItemMutations.ts` | hook | CRUD | `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` | exact |
| `frontend2/src/features/items/hooks/useCategoryNameMap.ts` | hook | request-response | `frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts` | role-match |
| `frontend2/src/features/items/filters/ItemsFilterBar.tsx` | component | event-driven | `frontend2/src/features/borrowers/BorrowersListPage.tsx` (lines 165-171) | role-match (partial analog — new composition) |
| `frontend2/src/features/items/filters/ShowArchivedChip.tsx` | component (leaf) | event-driven | none — compose from `RetroCheckbox`/`RetroBadge` tokens | **no analog** |
| `frontend2/src/features/items/filters/useItemsListQueryParams.ts` | hook (URL state) | transform | none — use `useSearchParams` (react-router v7) | **no analog** |
| `frontend2/src/features/items/icons.tsx` | utility | — | `frontend2/src/features/borrowers/icons.tsx` | exact |
| `frontend2/src/features/items/__tests__/fixtures.ts` | test util | — | `frontend2/src/features/borrowers/__tests__/fixtures.tsx` | exact |
| `frontend2/src/features/items/__tests__/ItemForm.test.tsx` | test | — | `frontend2/src/features/borrowers/__tests__/BorrowerForm.test.tsx` | exact |
| `frontend2/src/features/items/__tests__/ItemPanel.test.tsx` | test | — | `frontend2/src/features/borrowers/__tests__/BorrowerPanel.test.tsx` | exact |
| `frontend2/src/features/items/__tests__/ItemArchiveDeleteFlow.test.tsx` | test | — | `frontend2/src/features/borrowers/__tests__/BorrowerArchiveDeleteFlow.test.tsx` | exact |
| `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx` | test | — | `frontend2/src/features/borrowers/__tests__/BorrowersListPage.test.tsx` | exact |
| `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` | test | — | `frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx` | exact |
| `frontend2/src/features/items/__tests__/ItemsFilterBar.test.tsx` | test | — | n/a (new shape) | **no analog** |
| `frontend2/src/features/items/__tests__/ShowArchivedChip.test.tsx` | test | — | n/a (new shape) | **no analog** |
| `frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts` | test | — | n/a (new shape) | **no analog** |
| `frontend2/src/features/items/__tests__/useItemsListQueryParams.test.ts` | test | — | n/a (new shape) | **no analog** |

### Frontend (modified files)

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `frontend2/src/lib/api/items.ts` | api-client | CRUD | `frontend2/src/lib/api/borrowers.ts` | exact |
| `frontend2/src/routes/index.tsx` | config (routes) | — | same file (borrowers entries, lines 14-15, 78-79) | exact |
| `frontend2/src/features/items/ItemsPage.tsx` | page (placeholder) | — | to be deleted/replaced by `ItemsListPage.tsx` | n/a |

### Backend (new files)

None. All backend work is in-place edits to existing Phase 60 domain/infra files plus sqlc regen.

### Backend (modified files)

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `backend/internal/domain/warehouse/item/handler.go` | controller | request-response | `backend/internal/domain/warehouse/borrower/handler.go` (DELETE + List filter shape) | exact |
| `backend/internal/domain/warehouse/item/service.go` | service | CRUD | `backend/internal/domain/warehouse/borrower/service.go` (Delete + List+filter) | exact |
| `backend/internal/domain/warehouse/item/repository.go` | repository (interface) | CRUD | `backend/internal/domain/warehouse/borrower/repository.go` | exact |
| `backend/internal/infra/postgres/item_repository.go` | repository (impl) | CRUD | `backend/internal/infra/postgres/borrower_repository.go` (Delete, FindByWorkspace w/ archived) | exact |
| `backend/db/queries/items.sql` | model (sqlc) | — | `backend/db/queries/borrowers.sql` (ListBorrowers, DeleteBorrower) | exact |
| `backend/internal/infra/queries/items.sql.go` | generated | — | regenerated by sqlc | n/a |
| `backend/internal/domain/warehouse/item/handler_test.go` | test | — | `backend/internal/domain/warehouse/borrower/handler_test.go` (TestBorrowerHandler_Delete / _List_Archived*) | exact |
| `backend/internal/infra/postgres/item_repository_test.go` | test | — | `backend/internal/infra/postgres/borrower_repository_test.go` (Delete hard-delete tests) | exact |

## Pattern Assignments

### `frontend2/src/features/items/ItemsListPage.tsx` (component, request-response)

**Analog:** `frontend2/src/features/borrowers/BorrowersListPage.tsx`

**Imports pattern** (lines 1-29):

```typescript
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { Pencil, Archive, Undo2, Trash2 } from "./icons";
import {
  RetroPanel, RetroButton, RetroEmptyState, RetroCheckbox,
  RetroBadge, RetroTable, HazardStripe,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
// ... hooks + panel + flow + types
```

For Phase 60, adjust: replace `RetroCheckbox` with local `ShowArchivedChip`; add `RetroPagination` from barrel; import `ItemsFilterBar` + `useItemsListQueryParams` + `useCategoryNameMap`.

**Workspace guard pattern** (lines 33, 51):

```typescript
const { workspaceId, isLoading: authLoading } = useAuth();
// ...
if (authLoading) return null;
```

**Imperative ref pattern** (lines 37-38, 53-58):

```typescript
const panelRef = useRef<BorrowerPanelHandle>(null);
const archiveFlowRef = useRef<BorrowerArchiveDeleteFlowHandle>(null);
// ...
const handleNew = () => panelRef.current?.open("create");
const handleEdit = (b: Borrower) => panelRef.current?.open("edit", b);
const handleArchiveClick = (b: Borrower) => {
  setArchiveTarget(b);
  archiveFlowRef.current?.open();
};
```

**Row rendering with archived styling + per-cell font override** (lines 70-103):

```typescript
const rows = borrowers.map((b) => ({
  name: (
    <Link
      to={`/borrowers/${b.id}`}
      className={`font-sans ${
        b.is_archived ? "line-through text-retro-gray" : "no-underline text-retro-ink"
      }`}
    >
      {b.name}
      {b.is_archived && (
        <RetroBadge variant="neutral" className="ml-sm font-mono">
          {t`ARCHIVED`}
        </RetroBadge>
      )}
    </Link>
  ),
  // ...font-mono for SKU cell, font-sans for Category cell
}));
```

**CRITICAL:** Pitfall 5 — `RetroTable` forces `font-mono` on all cells. Name and Category cells MUST wrap with `<span className="font-sans">` (or use a `font-sans` class as here on the Link).

**Row action button pattern** (lines 107-125):

```typescript
<button
  type="button"
  aria-label={t`Edit ${b.name}`}
  onClick={() => handleEdit(b)}
  className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
>
  <Pencil size={14} />
  <span className="hidden lg:inline">{t`EDIT`}</span>
</button>
```

Touch target 44px mobile, 36px desktop; icon always visible; label hidden on mobile.

**Loading / error / empty / success states** (lines 173-212):

```typescript
{workspaceId && borrowersQuery.isPending && (
  <RetroPanel>
    <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
  </RetroPanel>
)}
{workspaceId && borrowersQuery.isError && (
  <RetroPanel>
    <HazardStripe className="mb-md" />
    <p className="text-retro-red mb-md">{t`Could not load borrowers.`}</p>
    <RetroButton variant="primary" onClick={() => borrowersQuery.refetch()}>
      {t`Retry`}
    </RetroButton>
  </RetroPanel>
)}
{workspaceId && isEmpty && (
  <RetroEmptyState
    title={t`NO BORROWERS YET`}
    body={t`Create your first borrower to start tracking loans.`}
    action={<RetroButton variant="primary" onClick={handleNew}>{t`+ NEW BORROWER`}</RetroButton>}
  />
)}
{workspaceId && borrowersQuery.isSuccess && borrowers.length > 0 && (
  <RetroPanel><RetroTable columns={columns} data={rows} /></RetroPanel>
)}
```

Phase 60 additions: replace `RetroCheckbox` block (lines 165-171) with the new `<ItemsFilterBar>`; append `<RetroPagination page={ui.page} pageSize={25} totalCount={total} onPageChange={(p) => updateUi({page: p})} />` after the table panel.

**Panel + flow mount at page root** (lines 214-228):

```typescript
<BorrowerPanel ref={panelRef} />
<BorrowerArchiveDeleteFlow
  ref={archiveFlowRef}
  nodeName={archiveTarget?.name ?? ""}
  onArchive={() => archiveTarget ? archiveMutation.mutateAsync(archiveTarget.id) : Promise.resolve()}
  onDelete={() => archiveTarget ? deleteMutation.mutateAsync(archiveTarget.id) : Promise.resolve()}
/>
```

---

### `frontend2/src/features/items/ItemDetailPage.tsx` (component, request-response)

**Analog:** `frontend2/src/features/borrowers/BorrowerDetailPage.tsx`

**Route params + detail query pattern** (lines 13-15):

```typescript
const { id } = useParams<{ id: string }>();
const borrowerQuery = useBorrower(id);
```

**Loading / 404 guards** (lines 17-44):

```typescript
if (borrowerQuery.isPending) {
  return (<RetroPanel><p className="font-mono text-retro-charcoal">{t`Loading…`}</p></RetroPanel>);
}
if (borrowerQuery.isError || !borrowerQuery.data) {
  return (
    <RetroPanel>
      <HazardStripe className="mb-md" />
      <h1 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
        {t`BORROWER NOT FOUND`}
      </h1>
      <p className="text-retro-ink mb-md">{t`This borrower may have been deleted.`}</p>
      <Link to="/borrowers" className="inline-flex items-center gap-xs font-mono text-[14px] text-retro-ink underline">
        <ArrowLeft size={14} />{t`BACK TO BORROWERS`}
      </Link>
    </RetroPanel>
  );
}
```

**Back link pattern** (lines 50-56):

```typescript
<Link to="/borrowers" className="inline-flex items-center gap-xs font-mono text-[14px] text-retro-ink">
  <ArrowLeft size={14} />
  {t`BORROWERS`}
</Link>
```

For Phase 60: text is `{t\`ITEMS\`}` and destination is `/items`.

**Header with amber rail + archived badge** (lines 58-67):

```typescript
<div className="border-l-2 border-retro-amber pl-md flex items-center gap-md flex-wrap">
  <h1 className="text-[24px] font-bold uppercase text-retro-ink">{b.name}</h1>
  {b.is_archived && (
    <RetroBadge variant="neutral" className="font-mono">{t`ARCHIVED`}</RetroBadge>
  )}
</div>
```

Phase 60 must add Edit/Archive/Restore/Delete action buttons to the right of this header (per D-06) — copy the row-action button shape from `BorrowersListPage.tsx:107-147`. Phase 60 does NOT have an analog for the detail-page header action cluster; planner composes from the row button tokens + `RetroButton` for the primary EDIT action.

**Section pattern with dl/dt/dd** (lines 69-99):

```typescript
<RetroPanel>
  <h2 className="text-[14px] font-semibold uppercase tracking-wider text-retro-ink mb-md">
    {t`CONTACT`}
  </h2>
  <dl className="grid grid-cols-[auto_1fr] gap-x-lg gap-y-sm">
    <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">{t`EMAIL`}</dt>
    <dd className={`font-mono text-[16px] ${b.email ? "text-retro-ink" : "text-retro-gray"}`}>
      {b.email ? b.email : "—"}
    </dd>
    {/* ... */}
  </dl>
</RetroPanel>
```

For Phase 60 DETAILS card: SKU (font-mono always — `item.sku`), barcode, description, category name (resolved via `useCategoryNameMap().map.get(item.category_id)`, "—" if null), created_at / updated_at (Intl format).

**Empty-state section for deferred data** (lines 101-125):

```typescript
<section aria-labelledby="active-loans-h2">
  <h2 id="active-loans-h2" className="text-[20px] font-bold uppercase text-retro-ink mb-md">
    {t`ACTIVE LOANS`}
  </h2>
  <RetroEmptyState title={t`NO ACTIVE LOANS`} body={t`Loan data will be available soon.`} />
</section>
```

Phase 60 uses this shape for both PHOTOS (Phase 61 seam) and LOANS (Phase 62 seam).

---

### `frontend2/src/features/items/panel/ItemPanel.tsx` (component, request-response)

**Analog:** `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx`

**forwardRef + imperative handle pattern** (lines 1-50):

```typescript
import { forwardRef, useCallback, useId, useImperativeHandle, useRef, useState } from "react";
import { SlideOverPanel, type SlideOverPanelHandle } from "@/features/taxonomy/panel/SlideOverPanel";

export interface BorrowerPanelHandle {
  open: (mode: "create" | "edit", borrower?: Borrower) => void;
  close: () => void;
}

const BorrowerPanel = forwardRef<BorrowerPanelHandle, {}>(
  function BorrowerPanel(_props, ref) {
    const { t } = useLingui();
    const panelRef = useRef<SlideOverPanelHandle>(null);
    const [mode, setMode] = useState<"create" | "edit">("create");
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const formId = useId();

    const createMutation = useCreateBorrower();
    const updateMutation = useUpdateBorrower();

    useImperativeHandle(ref, () => ({
      open: (m, b) => {
        setMode(m);
        setBorrower(b ?? null);
        setIsDirty(false);
        panelRef.current?.open();
      },
      close: () => panelRef.current?.close(),
    }));
    // ...
```

**Title / submit label derivation** (lines 55-61):

```typescript
const isPending = createMutation.isPending || updateMutation.isPending;
const title = mode === "create" ? t`NEW BORROWER` : t`EDIT BORROWER`;
const submitLabel = isPending ? t`WORKING…` : mode === "create" ? t`CREATE BORROWER` : t`SAVE BORROWER`;
```

Phase 60: `NEW ITEM` / `EDIT ITEM`, `CREATE ITEM` / `SAVE ITEM`.

**Submit dispatch pattern** (lines 63-70):

```typescript
const onSubmit = async (values: BorrowerCreateValues) => {
  if (mode === "create") {
    await createMutation.mutateAsync(values);
  } else if (borrower) {
    await updateMutation.mutateAsync({ id: borrower.id, input: values });
  }
  closePanel();
};
```

**Default values for edit mode** (lines 72-80):

```typescript
const defaultValues: Partial<BorrowerCreateValues> | undefined =
  mode === "edit" && borrower
    ? { name: borrower.name, email: borrower.email ?? "", phone: borrower.phone ?? "", notes: borrower.notes ?? "" }
    : undefined;
```

**Phase 60 deviation — SKU auto-gen on create open:**
In `useImperativeHandle`, when `mode === "create"`, compute SKU via `generateSku()` from `forms/schemas.ts` and pass into `defaultValues` — the form displays it pre-filled and user-editable. On edit, use `item.sku`.

**SlideOverPanel composition** (lines 82-117):

```typescript
<SlideOverPanel
  ref={panelRef}
  title={title}
  isDirty={isDirty}
  onClose={() => setIsDirty(false)}
  footer={
    <>
      <RetroButton variant="neutral" type="button" onClick={() => panelRef.current?.close()}>
        {t`← BACK`}
      </RetroButton>
      <RetroButton variant="primary" type="submit" disabled={isPending} form={formId}>
        <span className={isPending ? "font-mono" : ""}>{submitLabel}</span>
      </RetroButton>
    </>
  }
>
  <BorrowerForm formId={formId} onSubmit={onSubmit} onDirtyChange={setIsDirty} defaultValues={defaultValues} />
</SlideOverPanel>
```

---

### `frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx` (component, request-response)

**Analog:** `frontend2/src/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx`

**forwardRef + two-dialog ref pattern** (lines 20-37):

```typescript
export const BorrowerArchiveDeleteFlow = forwardRef<
  BorrowerArchiveDeleteFlowHandle, BorrowerArchiveDeleteFlowProps
>(function BorrowerArchiveDeleteFlow({ nodeName, onArchive, onDelete }, ref) {
  const { t } = useLingui();
  const archiveRef = useRef<RetroConfirmDialogHandle>(null);
  const deleteRef = useRef<RetroConfirmDialogHandle>(null);

  useImperativeHandle(ref, () => ({
    open: () => archiveRef.current?.open(),
    close: () => { archiveRef.current?.close(); deleteRef.current?.close(); },
  }));
```

**Archive handler — closes dialog on success, keeps open on error** (lines 39-46):

```typescript
const handleArchive = async () => {
  try {
    await onArchive();
    archiveRef.current?.close();
  } catch {
    // mutation hook already emits a toast; keep dialog open for retry context
  }
};
```

**Delete handler with 400 guard** (lines 48-65) — Phase 60 DEVIATION:

For items, there is no `HasActiveLoans` analog (per D-04), so Phase 60 `handleDelete` SHOULD NOT include the `HttpError.status === 400` short-circuit branch. Simplified:

```typescript
const handleDelete = async () => {
  try {
    await onDelete();
    deleteRef.current?.close();
  } catch {
    // mutation hook's onError surfaces the toast; dialog close is decided by RetroConfirmDialog
  }
};
```

**Dialog-to-dialog handoff** (lines 67-70):

```typescript
const switchToDelete = () => {
  archiveRef.current?.close();
  setTimeout(() => deleteRef.current?.open(), 0);  // timing critical — 0ms delay avoids dialog race
};
```

**Two-stage dialog render** (lines 72-97):

```typescript
<RetroConfirmDialog
  ref={archiveRef}
  variant="soft"
  title={t`ARCHIVE BORROWER`}
  body={t`This will hide ${nodeName} from loan pickers. You can restore them later.`}
  headerBadge={t`HIDES FROM LOAN PICKERS`}
  escapeLabel={t`← BACK`}
  destructiveLabel={t`ARCHIVE BORROWER`}
  onConfirm={handleArchive}
  secondaryLink={{ label: t`delete permanently`, onClick: switchToDelete }}
/>
<RetroConfirmDialog
  ref={deleteRef}
  variant="destructive"
  title={t`CONFIRM DELETE`}
  body={t`Permanently delete ${nodeName}? This action cannot be undone.`}
  escapeLabel={t`← BACK`}
  destructiveLabel={t`DELETE BORROWER`}
  onConfirm={handleDelete}
/>
```

Phase 60 copy per UI-SPEC:

- Archive title `t\`ARCHIVE ITEM\``; body `t\`This will hide '${nodeName}' from the items list. You can restore it later.\``; badge `t\`HIDES FROM DEFAULT VIEW\``; destructiveLabel `t\`ARCHIVE ITEM\``
- Delete title `t\`CONFIRM DELETE\``; body `t\`Permanently delete '${nodeName}'? This cannot be undone.\``; destructiveLabel `t\`DELETE ITEM\``
- NOTE: current borrowers implementation does NOT quote `${nodeName}`; per 60-CONTEXT `<specifics>` and Phase 59 commit `1b84a45` (fix: remove ICU-escaping quotes around nodeName), follow the current unquoted form.

---

### `frontend2/src/features/items/forms/ItemForm.tsx` (component, request-response)

**Analog:** `frontend2/src/features/borrowers/forms/BorrowerForm.tsx`

**Resolver with empty-string coercion** (lines 18-28):

```typescript
const baseResolver = zodResolver(borrowerCreateSchema);
const resolver: typeof baseResolver = (values, ctx, opts) => {
  const v = values as Record<string, unknown>;
  const cleaned = {
    ...v,
    email: v.email === "" ? undefined : v.email,
    phone: v.phone === "" ? undefined : v.phone,
    notes: v.notes === "" ? undefined : v.notes,
  };
  return baseResolver(cleaned as BorrowerCreateValues, ctx, opts);
};
```

Phase 60 fields to coerce: `barcode`, `description`, `category_id` (UUID validator fires on `""` otherwise).

**useForm + dirty propagation** (lines 44-57):

```typescript
const { control, handleSubmit, formState } = useForm<BorrowerCreateValues>({
  resolver,
  defaultValues: {
    name: defaultValues?.name ?? "",
    email: defaultValues?.email ?? "",
    phone: defaultValues?.phone ?? "",
    notes: defaultValues?.notes ?? "",
  } as BorrowerCreateValues,
  mode: "onSubmit",
});
useEffect(() => { onDirtyChange?.(formState.isDirty); }, [formState.isDirty, onDirtyChange]);
```

Phase 60: field list becomes `{ name, sku, barcode, description, category_id }`. For create mode, `defaultValues.sku` is pre-generated by `ItemPanel` via `generateSku()`. SKU field is editable.

**Submit with `"" → undefined` coerce** (lines 59-67):

```typescript
const submit = handleSubmit((values) => {
  const cleaned: BorrowerCreateValues = {
    name: values.name,
    email: values.email || undefined,
    phone: values.phone || undefined,
    notes: values.notes || undefined,
  };
  return onSubmit(cleaned);
});
```

**Field rendering with RetroFormField Controller-for-all** (lines 70-86):

```typescript
<form id={formId} onSubmit={submit} className="flex flex-col gap-md">
  <RetroFormField name="name" control={control} label={t`NAME`}>
    <RetroInput autoFocus placeholder={t`e.g. Alice Smith`} />
  </RetroFormField>
  <RetroFormField name="email" control={control} label={t`EMAIL`}>
    <RetroInput type="email" placeholder={t`alice@example.com`} />
  </RetroFormField>
  {/* ... */}
</form>
```

**Category combobox pattern** — copy from `CategoryForm.tsx:76-85` (taxonomy):

```typescript
<RetroFormField name="category_id" control={control} label={t`CATEGORY`}>
  <RetroCombobox
    options={categoryOptions}  // built from categoriesApi.list({archived: false}) + useMemo → RetroOption[]
    placeholder={t`Search categories…`}
  />
</RetroFormField>
```

For the picker, exclude archived categories (don't assign new items to archived categories). The name-resolver on list/detail pages DOES include archived (Pitfall 7).

---

### `frontend2/src/features/items/forms/schemas.ts` (utility, transform)

**Analog:** `frontend2/src/features/borrowers/forms/schemas.ts`

**Zod schema structure** (lines 17-38):

```typescript
export const borrowerCreateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120, "Must be 120 characters or fewer."),
  email: z.string().email("Enter a valid email address.").max(254, "Must be 254 characters or fewer.")
    .optional().or(z.literal("")),
  phone: z.string().max(40, "Must be 40 characters or fewer.").optional(),
  notes: z.string().max(1000, "Must be 1000 characters or fewer.").optional(),
});
export const borrowerUpdateSchema = borrowerCreateSchema.partial();
export type BorrowerCreateValues = z.infer<typeof borrowerCreateSchema>;
```

Phase 60 schema (per RESEARCH Pattern 3):

```typescript
export const itemCreateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(200, "Must be 200 characters or fewer."),
  sku: z.string()
    .min(1, "SKU is required.")
    .max(64, "Must be 64 characters or fewer.")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores only."),
  barcode: z.string()
    .max(64, "Must be 64 characters or fewer.")
    .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only.")
    .optional().or(z.literal("")),
  description: z.string().max(2000, "Must be 2000 characters or fewer.").optional().or(z.literal("")),
  category_id: z.string().uuid("Pick a category from the list.").optional().or(z.literal("")),
});
```

**Extra file-level concern — SKU generator:**

```typescript
export function generateSku(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1679616).toString(36).toUpperCase().padStart(4, "0");
  return `ITEM-${ts}-${rand}`;
}
```

No existing analog. Server enforces uniqueness via `Repository.SKUExists()` → `ErrSKUTaken` → `huma.Error400BadRequest`.

---

### `frontend2/src/features/items/hooks/useItemsList.ts` (hook, request-response)

**Analog:** `frontend2/src/features/borrowers/hooks/useBorrowersList.ts`

**Full hook shape** (lines 1-33):

```typescript
import { useQuery } from "@tanstack/react-query";
import { borrowersApi, borrowerKeys, type Borrower, type BorrowerListParams } from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";

export function useBorrowersList(showArchived: boolean) {
  const { workspaceId } = useAuth();
  const params: BorrowerListParams = { page: 1, limit: 100, archived: showArchived ? true : undefined };
  const query = useQuery({
    queryKey: borrowerKeys.list(params),
    queryFn: () => borrowersApi.list(workspaceId!, params),
    enabled: !!workspaceId,
  });
  const items: Borrower[] = query.data?.items ?? [];
  return { ...query, items };
}
```

**Phase 60 deviations:**

- Accept full `ItemListParams` (not just `showArchived` boolean). Caller (`ItemsListPage`) assembles from `useItemsListQueryParams()`.
- Add `placeholderData: (prev) => prev` for smooth pagination (TanStack Query v5; see RESEARCH Pattern 4 + Assumption A5).
- Do NOT flatten `items` — return `query.data` as-is so caller can read `data.total`, `data.page`, `data.total_pages` for pagination.

```typescript
export function useItemsList(params: ItemListParams) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => itemsApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    placeholderData: (prev) => prev,
  });
}
```

---

### `frontend2/src/features/items/hooks/useItem.ts` (hook, request-response)

**Analog:** `frontend2/src/features/borrowers/hooks/useBorrower.ts`

**Full hook (16 lines)** — copy verbatim, swap `borrower` → `item`:

```typescript
export function useBorrower(id: string | undefined) {
  const { workspaceId } = useAuth();
  return useQuery<Borrower>({
    queryKey: borrowerKeys.detail(id ?? ""),
    queryFn: () => borrowersApi.get(workspaceId!, id!),
    enabled: !!workspaceId && !!id,
  });
}
```

---

### `frontend2/src/features/items/hooks/useItemMutations.ts` (hook, CRUD)

**Analog:** `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts`

**Five-hooks-per-file idiom.** Each hook reads `workspaceId` via `useAuth()`, gets `useQueryClient`, `useToast`, `useLingui`, invalidates `itemKeys.all` on success, toasts on success and error.

**useCreateBorrower** (lines 14-28):

```typescript
export function useCreateBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Borrower, unknown, CreateBorrowerInput>({
    mutationFn: (input) => borrowersApi.create(workspaceId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower created.`, "success");
    },
    onError: () => addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}
```

**useDeleteBorrower with 400 guard for `ErrHasActiveLoans`** (lines 83-106):

```typescript
export function useDeleteBorrower() {
  // ...
  return useMutation<void, unknown, string>({
    mutationFn: (id) => borrowersApi.remove(workspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: borrowerKeys.all });
      addToast(t`Borrower deleted.`, "success");
    },
    onError: (err) => {
      if (err instanceof HttpError && err.status === 400) {
        addToast(t`Cannot delete: this borrower has active loans.`, "error");
        return;
      }
      addToast(t`Connection lost. Your change was not saved.`, "error");
    },
  });
}
```

**Phase 60 deviation — useDeleteItem:**

1. DROP the `err.status === 400` active-loans branch (items have no such guard per D-04 / RESEARCH Open Question 1 pending; planner confirms).
2. ADD `qc.removeQueries({ queryKey: itemKeys.detail(id) })` in `onSuccess` BEFORE `invalidateQueries` to prevent the deleted-item flash on back-navigation (Pitfall 9).
3. Accept optional `{ onAfterDelete }` param so `ItemDetailPage` can navigate after delete (per RESEARCH Pattern 8).

```typescript
export function useDeleteItem(opts?: { onAfterDelete?: () => void }) {
  // ...
  return useMutation<void, unknown, string>({
    mutationFn: (id) => itemsApi.delete(workspaceId!, id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: itemKeys.detail(id) });
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item deleted.`, "success");
      opts?.onAfterDelete?.();
    },
    onError: () => addToast(t`Could not delete item. Try again.`, "error"),
  });
}
```

---

### `frontend2/src/features/items/hooks/useCategoryNameMap.ts` (hook, request-response) — partial analog

**Analog:** `frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts` (for `categoriesApi.list` + `useMemo` shape; no exact match)

**Pattern (per RESEARCH Pattern 5):**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { categoriesApi, categoryKeys } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";

export function useCategoryNameMap() {
  const { workspaceId } = useAuth();
  const params = { page: 1, limit: 100, archived: true } as const;
  const query = useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    staleTime: 60_000,  // avoid refetch storm
  });
  const map = useMemo(() => {
    const m = new Map<string, string>();
    (query.data?.items ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [query.data]);
  return { map, isPending: query.isPending, isError: query.isError };
}
```

**Critical (Pitfall 7):** resolver MUST pass `archived: true` so archived-category names still resolve for historical items. Distinct from the form's combobox (which excludes archived).

---

### `frontend2/src/features/items/filters/ItemsFilterBar.tsx` (component, event-driven) — role-match partial

**Analog:** the checkbox+heading row in `BorrowersListPage.tsx:156-171` (layout shell only; content is new)

**Layout pattern** (lines 156-163 of BorrowersListPage):

```typescript
<div className="flex items-center justify-between gap-md flex-wrap">
  <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-cream">
    {t`BORROWERS`}
  </h1>
  <RetroButton variant="primary" onClick={handleNew}>{t`+ NEW BORROWER`}</RetroButton>
</div>
<div className="flex items-center gap-md flex-wrap">
  <RetroCheckbox label={...} checked={...} onChange={...} />
</div>
```

**Phase 60 composition (new code, no exact analog):**

```typescript
<div className="flex items-center gap-md flex-wrap">
  <RetroInput
    type="search"
    placeholder={t`Search name, SKU, barcode…`}
    value={searchInput}
    onChange={(e) => setSearchInput(e.target.value)}
    // debounce via useEffect → updateUi({q: debounced})
  />
  <RetroCombobox options={categoryOptions} value={ui.category ?? ""} onChange={(id) => updateUi({category: id || null})} />
  <RetroSelect options={SORT_OPTIONS} value={`${ui.sort}:${ui.sortDir}`} onChange={(v) => {
    const [sort, dir] = v.split(":"); updateUi({sort, sortDir: dir as "asc"|"desc"});
  }} />
  <ShowArchivedChip active={ui.archived} count={archivedCount} onToggle={() => updateUi({archived: !ui.archived})} />
</div>
```

Debounce: 300ms via `useEffect` + `setTimeout` (RESEARCH Pattern 6 / Discretion item).

---

### `frontend2/src/features/items/filters/ShowArchivedChip.tsx` (component, leaf) — NO ANALOG

**Analog:** none — compose from `RetroButton`/`RetroBadge` token classes

**Pattern (per RESEARCH Pattern 7):**

```typescript
import { useLingui } from "@lingui/react/macro";

export function ShowArchivedChip({ active, count, onToggle }:
  { active: boolean; count: number; onToggle: () => void }) {
  const { t } = useLingui();
  const cls = active
    ? "border-retro-thick border-retro-amber text-retro-amber"
    : "border-retro-thick border-retro-ink text-retro-ink";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`min-h-[44px] lg:min-h-[32px] inline-flex items-center gap-xs px-sm font-sans text-[14px] font-semibold uppercase tracking-wider bg-retro-cream cursor-pointer outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber ${cls}`}
    >
      {active ? t`SHOWING ARCHIVED` : t`SHOW ARCHIVED`}
      <span className="font-mono text-retro-charcoal">·</span>
      <span className={`font-mono ${active ? "text-retro-amber" : "text-retro-charcoal"}`}>{count}</span>
    </button>
  );
}
```

Design tokens reuse: `border-retro-thick`, `border-retro-amber`, `border-retro-ink`, `bg-retro-cream`, `text-retro-charcoal`, `min-h-[44px] lg:min-h-[32px]` (touch target; RESEARCH Project Constraints).

---

### `frontend2/src/features/items/filters/useItemsListQueryParams.ts` (hook, transform) — NO ANALOG

**Analog:** none — built on `useSearchParams` from `react-router` v7

**Pattern (per RESEARCH Pattern 6):**

```typescript
import { useSearchParams } from "react-router";
import { useCallback } from "react";

export interface ItemsListUiState {
  q: string;
  category: string | null;
  sort: "name" | "sku" | "created_at" | "updated_at";
  sortDir: "asc" | "desc";
  archived: boolean;
  page: number;
}

export function useItemsListQueryParams(): [ItemsListUiState, (patch: Partial<ItemsListUiState>) => void, () => void] {
  const [sp, setSp] = useSearchParams();
  const state: ItemsListUiState = {
    q: sp.get("q") ?? "",
    category: sp.get("category"),
    sort: (sp.get("sort") as ItemsListUiState["sort"]) ?? "name",
    sortDir: (sp.get("dir") as "asc" | "desc") ?? "asc",
    archived: sp.get("archived") === "1",
    page: Math.max(1, Number(sp.get("page") ?? 1)),
  };
  const update = useCallback((patch: Partial<ItemsListUiState>) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      // … see RESEARCH Pattern 6 full body; resets page to 1 when any non-page filter changes (Pitfall 8)
      return next;
    });
  }, [setSp]);
  const clearFilters = useCallback(() => { /* … */ }, [setSp]);
  return [state, update, clearFilters];
}
```

**Critical:** when any of `{q, category, archived, sort, sortDir}` changes without an explicit `page`, delete the `page` URL key (Pitfall 8).

---

### `frontend2/src/features/items/icons.tsx` (utility)

**Analog:** `frontend2/src/features/borrowers/icons.tsx` (98 lines; exact shape)

**Base icon factory pattern** (lines 14-23):

```typescript
const base = (size = 16) => ({
  width: size, height: size, viewBox: "0 0 24 24",
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export function Pencil({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="..."/>
    </svg>
  );
}
```

Copy the whole file, same set of icons: `Pencil`, `Archive`, `Undo2`, `Trash2`, `ArrowLeft`, `Plus`, `ChevronRight`, `ChevronDown`. No new icons needed.

---

### `frontend2/src/lib/api/items.ts` (api-client, CRUD) — modified

**Analog:** `frontend2/src/lib/api/borrowers.ts`

**Already-established shape** (existing items.ts:83-100). Phase 60 updates:

1. **Import `del`** — currently only `get, post, patch`; Phase 59 borrowers.ts:1 shows pattern: `import { get, post, patch, del } from "@/lib/api";` (verified at `frontend2/src/lib/api.ts:130`).
2. **Update `ItemListParams`** to match D-02:
   ```typescript
   export interface ItemListParams {
     page?: number;
     limit?: number;
     search?: string;
     category_id?: string;
     archived?: boolean;
     sort?: "name" | "sku" | "created_at" | "updated_at";
     sort_dir?: "asc" | "desc";
   }
   ```
   Remove `needs_review`, `location_id`, generic `sort: string`.
3. **Add `delete` method** — mirror `borrowers.ts:58`:
   ```typescript
   delete: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),
   ```
   Use `delete` (not `remove`, per RESEARCH Pattern 1 — matches current itemsApi verb style). Existing borrower uses `remove` but items.ts is un-finalised so planner may choose either; `delete` is slightly clearer given no RHF/JS reserved-word collision in this context.
4. **itemKeys** — unchanged; already correct (items.ts:94-100).

**Full API object** (target shape):

```typescript
export const itemsApi = {
  list: (wsId, params = {}) => get<ItemListResponse>(`${base(wsId)}${toQuery(params)}`),
  get: (wsId, id) => get<Item>(`${base(wsId)}/${id}`),
  create: (wsId, body) => post<Item>(base(wsId), body),
  update: (wsId, id, body) => patch<Item>(`${base(wsId)}/${id}`, body),
  archive: (wsId, id) => post<void>(`${base(wsId)}/${id}/archive`),
  restore: (wsId, id) => post<void>(`${base(wsId)}/${id}/restore`),
  delete: (wsId, id) => del<void>(`${base(wsId)}/${id}`),  // ADD
};
```

---

### `frontend2/src/routes/index.tsx` (config, routes) — modified

**Analog:** same file, borrowers entries (lines 14-15 imports; lines 78-79 routes)

**Existing pattern:**

```tsx
import { BorrowersListPage } from "@/features/borrowers/BorrowersListPage";
import { BorrowerDetailPage } from "@/features/borrowers/BorrowerDetailPage";
// ...
<Route path="borrowers" element={<BorrowersListPage />} />
<Route path="borrowers/:id" element={<BorrowerDetailPage />} />
```

**Phase 60 edit:**

```tsx
// REPLACE line 9:
import { ItemsListPage } from "@/features/items/ItemsListPage";
import { ItemDetailPage } from "@/features/items/ItemDetailPage";
// REPLACE line 80:
<Route path="items" element={<ItemsListPage />} />
<Route path="items/:id" element={<ItemDetailPage />} />
```

Delete `frontend2/src/features/items/ItemsPage.tsx` (placeholder — per RESEARCH Assumption A12).

---

### `backend/internal/domain/warehouse/item/handler.go` (controller) — modified

**Analog:** `backend/internal/domain/warehouse/borrower/handler.go`

**DELETE handler pattern** (borrower/handler.go:144-174):

```go
huma.Delete(api, "/borrowers/{id}", func(ctx context.Context, input *DeleteBorrowerInput) (*struct{}, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }
    authUser, _ := appMiddleware.GetAuthUser(ctx)

    if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
        if errors.Is(err, ErrHasActiveLoans) {
            return nil, huma.Error400BadRequest("cannot delete borrower with active loans")
        }
        return nil, huma.Error400BadRequest(err.Error())
    }
    if broadcaster != nil && authUser != nil {
        userName := appMiddleware.GetUserDisplayName(ctx)
        broadcaster.Publish(workspaceID, events.Event{
            Type: "borrower.deleted", EntityID: input.ID.String(), EntityType: "borrower",
            UserID: authUser.ID, Data: map[string]any{"user_name": userName},
        })
    }
    return nil, nil
})
```

Phase 60: drop the `ErrHasActiveLoans` branch (items have no equivalent). Use existing `GetItemInput` (item/handler.go:459) — no need for a new `DeleteItemInput` type. Add `import "errors"` at top of handler.go.

**List-with-filter extension** (borrower/handler.go:19-39 + ListBorrowersInput:275-279):

```go
type ListBorrowersInput struct {
    Page     int  `query:"page" default:"1" minimum:"1"`
    Limit    int  `query:"limit" default:"50" minimum:"1" maximum:"100"`
    Archived bool `query:"archived" default:"false" doc:"..."`
}
```

The borrower handler shows the shape for a single `archived` boolean param. Phase 60 extends further (per RESEARCH Pattern 11):

```go
type ListItemsInput struct {
    Page       int    `query:"page" default:"1" minimum:"1"`
    Limit      int    `query:"limit" default:"25" minimum:"1" maximum:"100"`
    Search     string `query:"search,omitempty" doc:"FTS over name, SKU, barcode"`
    CategoryID string `query:"category_id,omitempty" doc:"Filter by category UUID"`
    Archived   bool   `query:"archived" default:"false" doc:"..."`
    Sort       string `query:"sort" default:"name" enum:"name,sku,created_at,updated_at"`
    SortDir    string `query:"sort_dir" default:"asc" enum:"asc,desc"`
}
```

NOTE: existing items handler default `Limit=50` (item/handler.go:435) must change to `25` (per ITEM-01 / D-02).

**Handler body rewrite** (per RESEARCH Pattern 11):

```go
huma.Get(api, "/items", func(ctx context.Context, input *ListItemsInput) (*ListItemsOutput, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }

    pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
    var categoryID *uuid.UUID
    if input.CategoryID != "" {
        if id, err := uuid.Parse(input.CategoryID); err == nil { categoryID = &id }
    }

    items, total, err := svc.ListFiltered(ctx, workspaceID, item.ListFilters{
        Search: input.Search, CategoryID: categoryID, IncludeArchived: input.Archived,
        Sort: input.Sort, SortDir: input.SortDir,
    }, pagination)
    if err != nil { return nil, huma.Error500InternalServerError("failed to list items") }

    responses := make([]ItemResponse, len(items))
    for i, it := range items { responses[i] = toItemResponse(it) }

    totalPages := 1
    if total > 0 { totalPages = (total + input.Limit - 1) / input.Limit }

    return &ListItemsOutput{
        Body: ItemListResponse{Items: responses, Total: total, Page: input.Page, TotalPages: totalPages},
    }, nil
})
```

Also normalize empty `Search` string per Pitfall 2 — treat `""` as "no search" in handler or in SQL.

---

### `backend/internal/domain/warehouse/item/service.go` (service, CRUD) — modified

**Analog:** `backend/internal/domain/warehouse/borrower/service.go`

**ServiceInterface Delete signature** (borrower/service.go:18):

```go
Delete(ctx context.Context, id, workspaceID uuid.UUID) error
```

**Service.Delete impl with workspace guard** (borrower/service.go:96-113):

```go
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
    _, err := s.GetByID(ctx, id, workspaceID)  // workspace ownership check
    if err != nil { return err }

    hasLoans, err := s.repo.HasActiveLoans(ctx, id)
    if err != nil { return err }
    if hasLoans { return ErrHasActiveLoans }

    return s.repo.Delete(ctx, id)
}
```

**Phase 60 deviation** (per D-04 / RESEARCH Pitfall 3-4 / Open Question 1):

```go
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
    _, err := s.GetByID(ctx, id, workspaceID)
    if err != nil { return err }
    return s.repo.Delete(ctx, id)  // no HasActiveLoans — items have no guard
}
```

**ListFiltered addition** — no direct analog; use borrower's List signature (service.go:115-117) as starting shape:

```go
func (s *Service) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination, includeArchived bool) ([]*Borrower, int, error) {
    return s.repo.FindByWorkspace(ctx, workspaceID, pagination, includeArchived)
}
```

Phase 60 signature (per RESEARCH Pattern 13):

```go
type ListFilters struct {
    Search          string
    CategoryID      *uuid.UUID
    IncludeArchived bool
    Sort            string
    SortDir         string
}

func (s *Service) ListFiltered(ctx context.Context, workspaceID uuid.UUID, filters ListFilters, p shared.Pagination) ([]*Item, int, error) {
    return s.repo.FindByWorkspaceFiltered(ctx, workspaceID, filters, p)
}
```

Add both to `ServiceInterface` (item/service.go:23-36). Existing `List` can stay or be renamed — planner decides.

---

### `backend/internal/domain/warehouse/item/repository.go` (repository interface) — modified

**Analog:** `backend/internal/domain/warehouse/borrower/repository.go`

**Interface signature** (borrower/repository.go:11-21):

```go
type Repository interface {
    FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination, includeArchived bool) ([]*Borrower, int, error)
    Delete(ctx context.Context, id uuid.UUID) error
    // ...
}
```

Phase 60: existing `Delete(ctx, id)` already present (item/repository.go:21). Add `FindByWorkspaceFiltered(ctx, workspaceID, filters, p) ([]*Item, int, error)` method for the filtered-list case. Keep existing `FindByWorkspace` (used by `Service.List`) or remove it if planner chooses to collapse — not required.

---

### `backend/internal/infra/postgres/item_repository.go` (repository impl, CRUD) — modified

**Analog:** `backend/internal/infra/postgres/borrower_repository.go`

**Hard-delete pattern** (borrower_repository.go:100-102):

```go
func (r *BorrowerRepository) Delete(ctx context.Context, id uuid.UUID) error {
    return r.queries.DeleteBorrower(ctx, id)
}
```

**Phase 60 critical fix** (Pitfall 3) — existing item_repository.go:246-248 wrongly calls `ArchiveItem`:

```go
// CURRENT (BUG):
func (r *ItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
    return r.queries.ArchiveItem(ctx, id)
}

// TARGET (after sqlc regen adds DeleteItem query):
func (r *ItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
    return r.queries.DeleteItem(ctx, id)
}
```

**List-with-nullable-archived pattern** (borrower_repository.go:66-87):

```go
func (r *BorrowerRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination, includeArchived bool) ([]*borrower.Borrower, int, error) {
    archivedParam := includeArchived
    rows, err := r.queries.ListBorrowers(ctx, queries.ListBorrowersParams{
        WorkspaceID: workspaceID,
        Archived:    &archivedParam,  // pointer to bool for sqlc.narg
        Limit:       int32(pagination.Limit()),
        Offset:      int32(pagination.Offset()),
    })
    // ...
}
```

Phase 60 `FindByWorkspaceFiltered` implementation: same pattern, pass nullable pointer params for `search`, `category_id`, `archived` (all `sqlc.narg`); plus `sort_field` and `sort_dir` as `sqlc.arg` string; pair with `CountItemsFiltered` call for true total (fixes Pitfall 1).

---

### `backend/db/queries/items.sql` (model/sqlc) — modified

**Analog:** `backend/db/queries/borrowers.sql`

**Archived-nullable filter pattern** (borrowers.sql:26-31):

```sql
-- name: ListBorrowers :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1
  AND (sqlc.narg('archived')::bool IS NULL OR sqlc.narg('archived')::bool = true OR is_archived = false)
ORDER BY name
LIMIT $2 OFFSET $3;
```

**Hard-delete pattern** (borrowers.sql:47-48):

```sql
-- name: DeleteBorrower :exec
DELETE FROM warehouse.borrowers WHERE id = $1;
```

**FTS search pattern** (borrowers.sql:39-45):

```sql
-- name: SearchBorrowers :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1
  AND is_archived = false
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT $3;
```

Items already have `search_vector` per items.sql:60-65. Phase 60 adds (per RESEARCH Pattern 12):

```sql
-- name: ListItemsFiltered :many
-- name: CountItemsFiltered :one
-- name: DeleteItem :exec  (DELETE FROM warehouse.items WHERE id = $1;)
```

ORDER BY uses the CASE-whitelist pattern for safe dynamic sort (sqlc parameterized).

---

### `backend/internal/domain/warehouse/item/handler_test.go` (test) — extended

**Analog:** `backend/internal/domain/warehouse/borrower/handler_test.go` (TestBorrowerHandler_Delete at 257, TestBorrowerHandler_List at 130, TestBorrowerHandler_List_Archived* at 360/374)

**DELETE test pattern** (borrower handler_test.go:257-290):

```go
func TestBorrowerHandler_Delete(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    borrower.RegisterRoutes(setup.API, mockSvc, nil)

    t.Run("deletes borrower successfully", func(t *testing.T) {
        borrowerID := uuid.New()
        mockSvc.On("Delete", mock.Anything, borrowerID, setup.WorkspaceID).Return(nil).Once()
        rec := setup.Delete(fmt.Sprintf("/borrowers/%s", borrowerID))
        testutil.AssertStatus(t, rec, http.StatusNoContent)
        mockSvc.AssertExpectations(t)
    })
    // ...
}
```

**Archived filter test pattern** (borrower handler_test.go:360-386):

```go
func TestBorrowerHandler_List_ArchivedFalse_ExcludesArchived(t *testing.T) {
    // ...
    mockSvc.On("List", mock.Anything, setup.WorkspaceID, mock.Anything, false).
        Return([]*borrower.Borrower{}, 0, nil).Once()
    rec := setup.Get("/borrowers")
    testutil.AssertStatus(t, rec, http.StatusOK)
    mockSvc.AssertExpectations(t)
}
```

**Event capture pattern** (borrower handler_test.go:461-490):

```go
capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
capture.Start(); defer capture.Stop()
// ...
assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")
event := capture.GetLastEvent()
assert.Equal(t, "borrower.deleted", event.Type)
```

Phase 60: drop `ErrHasActiveLoans` case; add filter-matrix tests per RESEARCH Validation table + Open Question 3 recommendation (4-6 representative combinations).

---

### Frontend `__tests__/fixtures.ts` (test util)

**Analog:** `frontend2/src/features/borrowers/__tests__/fixtures.tsx`

**Re-export shared test utilities** (lines 8-12):

```typescript
export {
  TestAuthContext,
  renderWithProviders,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";
```

**Entity factory** (lines 17-30):

```typescript
export function makeBorrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: overrides.id ?? "44444444-4444-4444-4444-444444444444",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    name: overrides.name ?? "Alice Example",
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    notes: overrides.notes ?? null,
    is_archived: overrides.is_archived ?? false,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
    ...overrides,
  };
}
```

Phase 60: `makeItem(overrides)` with item-shape defaults (sku, name, barcode, description, category_id, is_archived, created_at, updated_at; all other Item fields default to `null` / `0` / `""`).

---

### Frontend test files (`ItemForm.test.tsx`, `ItemPanel.test.tsx`, etc.)

**Analog:** matching `Borrower*.test.tsx` files in `frontend2/src/features/borrowers/__tests__/`

**Auth mock pattern** (BorrowerPanel.test.tsx:6-18):

```typescript
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    workspaceId: "00000000-0000-0000-0000-000000000001",
    isLoading: false, isAuthenticated: true, user: { id: "u1" },
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
  }),
}));
```

**API mock pattern** (BorrowerPanel.test.tsx:20-36):

```typescript
vi.mock("@/lib/api/borrowers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/borrowers")>();
  return {
    ...actual,
    borrowersApi: {
      ...actual.borrowersApi,
      list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(),
      archive: vi.fn(), restore: vi.fn(), remove: vi.fn(),
    },
  };
});
```

**Render helper pattern** (BorrowersListPage.test.tsx:48-57):

```typescript
function renderList() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/borrowers"]}>
      <Routes>
        <Route path="/borrowers" element={<BorrowersListPage />} />
        <Route path="/borrowers/:id" element={<div>DETAIL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}
```

**Setup each test** (BorrowersListPage.test.tsx:60-63):

```typescript
beforeEach(() => {
  setupDialogMocks();
  vi.clearAllMocks();
});
```

---

## Shared Patterns

### Authentication / Workspace Scoping (Frontend)

**Source:** `frontend2/src/features/auth/AuthContext.tsx` (existing; do not modify)

**Apply to:** All hooks and (some) components in `features/items/**`

```typescript
import { useAuth } from "@/features/auth/AuthContext";

const { workspaceId } = useAuth();  // in hooks
const { workspaceId, isLoading: authLoading } = useAuth();  // in page components
if (authLoading) return null;  // page-level gate
```

**Rule:** `workspaceId` MUST be read via `useAuth()` — NEVER passed as prop (Phase 58/59 idiom, verified across all mutation hooks).

### Authentication / Workspace Scoping (Backend)

**Source:** `appMiddleware.GetWorkspaceID` pattern — verified in every existing handler (e.g. `item/handler.go:26-29`, `borrower/handler.go:20-23`)

**Apply to:** Every `huma.*` handler in `item/handler.go`

```go
workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
if !ok {
    return nil, huma.Error401Unauthorized("workspace context required")
}
authUser, _ := appMiddleware.GetAuthUser(ctx)  // only if event broadcast needed
```

**Rule:** `workspaceID` comes from session middleware, NOT URL params (the URL wsId segment is decorative).

### Query Key Invalidation

**Source:** `frontend2/src/lib/api/items.ts:94-100` (`itemKeys.all`, `itemKeys.list`, `itemKeys.detail`)

**Apply to:** All mutation hooks in `useItemMutations.ts`

```typescript
qc.invalidateQueries({ queryKey: itemKeys.all });  // on success of create/update/archive/restore/delete
qc.removeQueries({ queryKey: itemKeys.detail(id) }); // BEFORE invalidate on delete (Pitfall 9)
```

### Toast Feedback

**Source:** `@/components/retro` (re-exports `useToast`); used in every borrower mutation hook

**Apply to:** All mutation hooks

```typescript
const { addToast } = useToast();
addToast(t`Item created.`, "success");   // or "error"
```

**Rule:** Every mutation emits exactly one toast on success and one on error (never `window.alert`, never silent).

### Error Mapping (Frontend HttpError)

**Source:** `frontend2/src/lib/api.ts:3-14` (HttpError class); pattern used in `useDeleteBorrower:94-103`

**Apply to:** Mutation hooks where specific status codes warrant specific messages (SKU collision per Pitfall 6)

```typescript
onError: (err) => {
  if (err instanceof HttpError && err.status === 400 && err.message.includes("SKU already")) {
    addToast(t`That SKU is already in use. Please regenerate or choose another.`, "error");
    return;
  }
  addToast(t`Could not save item. Try again.`, "error");
}
```

### Error Mapping (Backend errors.Is)

**Source:** `backend/internal/domain/warehouse/borrower/handler.go:152-157`

**Apply to:** New DELETE handler + extended list handler in item/handler.go

```go
import "errors"

if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
    if errors.Is(err, ErrItemNotFound) {
        return nil, huma.Error404NotFound("item not found")
    }
    return nil, huma.Error400BadRequest(err.Error())
}
```

### Validation (Frontend)

**Source:** zod schemas in `frontend2/src/features/borrowers/forms/schemas.ts` + `RetroFormField` Controller-for-all

**Apply to:** `ItemForm` (required `name`, `sku`; optional `barcode`, `description`, `category_id`)

- Empty string `""` coercion via resolver wrapper (borrower schemas.ts:18-28 pattern).
- `"" → undefined` before submit (borrower form submit handler:59-67 pattern).
- `RetroFormField name="..." control={control} label={t\`...\`}>` wraps each input.

### Validation (Backend)

**Source:** `CreateItemInput` struct-tag validators (item/handler.go:473-495); borrower `ListBorrowersInput` query-param validators (borrower/handler.go:275-279)

**Apply to:** Extended `ListItemsInput` (add `minLength`, `maxLength`, `enum` on new params)

- `Search string \`query:"search,omitempty" maxLength:"200"\`` (defense-in-depth per RESEARCH Security table)
- `Sort string \`query:"sort" default:"name" enum:"name,sku,created_at,updated_at"\``
- `SortDir string \`query:"sort_dir" default:"asc" enum:"asc,desc"\``
- `Archived bool \`query:"archived" default:"false"\``

### Typography / Font Rules

**Source:** Phase 57 D-03 lock; enforced in every page

**Apply to:** All render output in `features/items/**`

- `font-sans` → entity names, labels, human-readable text
- `font-mono` → SKU, barcode, short_code, IDs, timestamps, numbers, badges
- **CRITICAL:** `RetroTable` forces `font-mono` on all cells (RetroTable.tsx:40; Pitfall 5). Wrap Name + Category cell children in `<span className="font-sans">` or use `className="font-sans"` on the inner `<Link>` (see BorrowersListPage.tsx:74).

### Touch Targets

**Source:** v2.1 constraint; verified in BorrowersListPage.tsx row-action buttons (lines 112-114)

**Apply to:** All interactive elements (chips, row buttons, pagination buttons, form submit)

```typescript
className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] ..."
// Chip: min-h-[44px] lg:min-h-[32px]
```

### i18n (Lingui)

**Source:** `useLingui().t` macro; verified in every component

**Apply to:** Every user-visible string

```typescript
import { useLingui } from "@lingui/react/macro";
const { t } = useLingui();
// t`STATIC STRING` or t`String with ${variable}`
// NEVER t`Edit ${entityKind}` where entityKind is a runtime value — use entity-specific literal strings
```

**Rule:** Both `en` and `et` catalogs must compile (`bun run i18n:extract && bun run i18n:compile`).

### Event Broadcast (Backend)

**Source:** `backend/internal/domain/warehouse/borrower/handler.go:159-172` (Delete event) + `item/handler.go:294-305` (Archive→Delete event)

**Apply to:** New huma.Delete item handler

```go
if broadcaster != nil && authUser != nil {
    userName := appMiddleware.GetUserDisplayName(ctx)
    broadcaster.Publish(workspaceID, events.Event{
        Type:       "item.deleted",
        EntityID:   input.ID.String(),
        EntityType: "item",
        UserID:     authUser.ID,
        Data:       map[string]any{"user_name": userName},
    })
}
```

**Rule:** Event payload includes ONLY `user_name` and entity ID — never entity name/description (Security: event payload PII leak).

### SQL Parameterization

**Source:** `backend/db/queries/borrowers.sql:26-31` (`sqlc.narg` nullable filter); sqlc docs for CASE-whitelist sort

**Apply to:** New `ListItemsFiltered`, `CountItemsFiltered` queries

- `sqlc.narg('archived')::bool IS NULL OR sqlc.narg('archived')::bool = true OR is_archived = false` — nullable filter pattern
- `ORDER BY CASE WHEN sqlc.arg('sort_field') = 'name' AND sqlc.arg('sort_dir') = 'asc' THEN name END ASC NULLS LAST, …` — safe dynamic ORDER BY

## No Analog Found

Files with no close match in the codebase — planner uses RESEARCH.md patterns as the source of truth:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend2/src/features/items/filters/ShowArchivedChip.tsx` | component (leaf) | event-driven | No existing chip pattern. RetroCheckbox is not a chip. Compose from button + retro tokens per RESEARCH Pattern 7. |
| `frontend2/src/features/items/filters/useItemsListQueryParams.ts` | hook (URL state) | transform | No existing URL-state hook. Build on `useSearchParams` from react-router v7 per RESEARCH Pattern 6; follow Pitfall 8 rule (page reset on filter change). |
| `frontend2/src/features/items/__tests__/ItemsFilterBar.test.tsx` | test | — | Filter bar is new composition; no existing filter-bar test. Reuse auth+api mock pattern from BorrowerPanel.test.tsx; test debounce, combobox selection, sort dropdown, chip toggle. |
| `frontend2/src/features/items/__tests__/ShowArchivedChip.test.tsx` | test | — | New component. Test off/on visual state, aria-pressed, count display. |
| `frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts` | test | — | New hook. Test map-builder logic, `archived:true` passthrough, pending / error states. |
| `frontend2/src/features/items/__tests__/useItemsListQueryParams.test.ts` | test | — | New hook. Test URL state read, patch-write, `clearFilters`, page reset on filter change (Pitfall 8). |

For each of these, the planner should use the code samples embedded in `60-RESEARCH.md` (Patterns 6, 7; Pitfalls 7, 8) as the specification.

## Metadata

**Analog search scope:**

- `frontend2/src/features/borrowers/**` (Phase 59 — exact match source)
- `frontend2/src/features/taxonomy/**` (Phase 58 — slide-over panel, form resolver pattern, combobox form wiring)
- `frontend2/src/lib/api/**` (borrowers.ts + categories.ts — API client shape; items.ts — existing itemsApi + itemKeys)
- `frontend2/src/routes/index.tsx` (route registration)
- `backend/internal/domain/warehouse/borrower/**` (Phase 59 backend — DELETE handler, service.Delete, Repository.Delete)
- `backend/internal/domain/warehouse/item/**` (existing item handler/service/repository — extension targets)
- `backend/internal/infra/postgres/borrower_repository.go` + `item_repository.go` (DELETE fix + filter pattern)
- `backend/db/queries/borrowers.sql` + `items.sql` (sqlc query patterns)

**Files scanned:** ~22 source files + 4 test files + 2 SQL files = ~28 distinct files

**Pattern extraction date:** 2026-04-16
