# Phase 59: Borrowers CRUD — Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 20 (17 frontend / 3 backend) + 2 test fixtures
**Analogs found:** 20 / 20 (all files have strong in-repo parallels from Phase 58)

## File Classification

### Frontend — `frontend2/src/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/api/borrowers.ts` (MODIFY) | api-client | CRUD + request-response | `lib/api/categories.ts` | exact |
| `features/borrowers/forms/schemas.ts` | schema | validation / transform | `features/taxonomy/forms/schemas.ts` | exact |
| `features/borrowers/forms/BorrowerForm.tsx` | component (form) | request-response | `features/taxonomy/forms/CategoryForm.tsx` | exact |
| `features/borrowers/panel/BorrowerPanel.tsx` | component (slide-over) | request-response | `features/taxonomy/panel/EntityPanel.tsx` | exact (simplified — single kind) |
| `features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx` | component (dialog flow) | request-response | `features/taxonomy/actions/ArchiveDeleteFlow.tsx` | exact (400 vs 409) |
| `features/borrowers/hooks/useBorrowersList.ts` | hook (query) | request-response | `features/taxonomy/hooks/useCategoriesTree.ts` | role-match (flat vs tree) |
| `features/borrowers/hooks/useBorrower.ts` | hook (query) | request-response | inline query in `useCategoriesTree.ts` | role-match (new: single-entity detail) |
| `features/borrowers/hooks/useBorrowerMutations.ts` | hook (mutation) | request-response | `features/taxonomy/hooks/useContainerMutations.ts` + `useCategoryMutations.ts` | exact (5-hook shape + HttpError.status=400 branch) |
| `features/borrowers/BorrowersListPage.tsx` | component (page) | request-response | `features/taxonomy/tabs/ContainersTab.tsx` (row+action layout) + `features/taxonomy/TaxonomyPage.tsx` (page wrapper) | role-match (flat list — uses RetroTable rather than RetroPanel list) |
| `features/borrowers/BorrowerDetailPage.tsx` | component (page) | request-response | `features/taxonomy/TaxonomyPage.tsx` (page wrapper) | role-match (new shape — detail page) |
| `features/borrowers/icons.tsx` | utility (icon re-export) | static | `features/taxonomy/icons.tsx` | exact |
| `features/borrowers/__tests__/fixtures.ts` | test utility | test | `features/taxonomy/__tests__/fixtures.tsx` | exact |
| `features/borrowers/__tests__/BorrowerForm.test.tsx` | test | test | `features/taxonomy/__tests__/CategoryForm.test.tsx` | exact |
| `features/borrowers/__tests__/BorrowerPanel.test.tsx` | test | test | (no direct analog — adapt from ContainersTab.test + CategoryForm.test) | role-match |
| `features/borrowers/__tests__/BorrowerArchiveDeleteFlow.test.tsx` | test | test | `features/taxonomy/__tests__/ArchiveDeleteFlow.test.tsx` | exact |
| `features/borrowers/__tests__/BorrowersListPage.test.tsx` | test | test | `features/taxonomy/__tests__/ContainersTab.test.tsx` | exact |
| `features/borrowers/__tests__/BorrowerDetailPage.test.tsx` | test | test | (no direct analog — new shape) | partial (combine fixtures + detail query pattern) |
| `routes/index.tsx` (MODIFY) | route-registration | config | `routes/index.tsx` itself (`taxonomy` route) | exact |

### Backend — `backend/internal/`

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `domain/warehouse/borrower/handler.go` (MODIFY) | handler (HTTP) | request-response | `domain/warehouse/category/handler.go` | exact |
| `domain/warehouse/borrower/repository.go` (MODIFY) | interface | — | `domain/warehouse/category/repository.go` (Archive/Delete split) | exact |
| `infra/postgres/borrower_repository.go` (MODIFY) | repository (PG) | data access | `infra/postgres/category_repository.go` | exact |
| `db/queries/borrowers.sql` (MODIFY) | sql query | data access | `db/queries/categories.sql` | exact |

---

## Pattern Assignments

### `lib/api/borrowers.ts` (api-client, CRUD)

**Analog:** `frontend2/src/lib/api/categories.ts` — mirror precisely; borrower already has CRUD wired; three additions + one list-param addition.

**Imports + base pattern** (existing at `borrowers.ts:1,46`, keep):
```typescript
import { get, post, patch, del } from "@/lib/api";
const base = (wsId: string) => `/workspaces/${wsId}/borrowers`;
```

**List param extension pattern** (copy from `categories.ts:18-22`):
```typescript
export interface BorrowerListParams {
  page?: number;
  limit?: number;
  archived?: boolean;   // NEW — Phase 59 addition (requires backend support)
}
```

**Archive/Restore API additions** (copy from `categories.ts:56-58`):
```typescript
archive: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/archive`),
restore: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/restore`),
remove: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),  // already present; ensure hard-delete semantic
```

**Query key factory** (already exists at `borrowers.ts:58-64`, no change needed):
```typescript
export const borrowerKeys = {
  all: ["borrowers"] as const,
  lists: () => [...borrowerKeys.all, "list"] as const,
  list: (params: BorrowerListParams) => [...borrowerKeys.lists(), params] as const,
  details: () => [...borrowerKeys.all, "detail"] as const,
  detail: (id: string) => [...borrowerKeys.details(), id] as const,
};
```

---

### `features/borrowers/forms/schemas.ts` (schema, validation)

**Analog:** `frontend2/src/features/taxonomy/forms/schemas.ts`

**Import pattern** (lines 1):
```typescript
import { z } from "zod";
```

**Create schema pattern** (copy shape from `schemas.ts:11-21` — adjust fields; name + email + phone + notes):
```typescript
export const borrowerCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(255, "Must be 255 characters or fewer."),
  email: z
    .string()
    .email("Enter a valid email.")
    .max(255)
    .optional()
    .or(z.literal("")),  // allow empty → coerced to undefined in form submit
  phone: z.string().max(64).optional(),
  notes: z.string().max(1000).optional(),
});
export const borrowerUpdateSchema = borrowerCreateSchema.partial();

export type BorrowerCreateValues = z.infer<typeof borrowerCreateSchema>;
export type BorrowerUpdateValues = z.infer<typeof borrowerUpdateSchema>;
```

Backend authoritative caps (from `handler.go:240,254`): `name` minLength 1 / maxLength 255, `email` format:"email", `phone` / `notes` unbounded today. Zod bounds on phone/notes are UX-level.

---

### `features/borrowers/forms/BorrowerForm.tsx` (component, request-response)

**Analog:** `frontend2/src/features/taxonomy/forms/CategoryForm.tsx`

**Import pattern** (lines 1-15 of `CategoryForm.tsx`):
```typescript
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLingui } from "@lingui/react/macro";
import {
  RetroFormField,
  RetroInput,
  RetroTextarea,
} from "@/components/retro";
import {
  borrowerCreateSchema,
  type BorrowerCreateValues,
} from "./schemas";
```

**Empty-string→undefined resolver wrapper pattern** (copy from `CategoryForm.tsx:17-30`):
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

**useForm + defaults + onDirtyChange pattern** (copy from `CategoryForm.tsx:40-69`):
```typescript
const { control, handleSubmit, formState } = useForm<BorrowerCreateValues>({
  resolver,
  defaultValues: {
    name: defaultValues?.name ?? "",
    email: defaultValues?.email ?? "",
    phone: defaultValues?.phone ?? "",
    notes: defaultValues?.notes ?? "",
  } as BorrowerCreateValues,
  mode: "onBlur",
});

useEffect(() => {
  onDirtyChange?.(formState.isDirty);
}, [formState.isDirty, onDirtyChange]);

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

**Form JSX pattern** (copy from `CategoryForm.tsx:71-94` — adjust fields):
```tsx
<form id={formId} onSubmit={submit} className="flex flex-col gap-md">
  <RetroFormField name="name" control={control} label={t`NAME`}>
    <RetroInput autoFocus />
  </RetroFormField>
  <RetroFormField name="email" control={control} label={t`EMAIL`}>
    <RetroInput type="email" />
  </RetroFormField>
  <RetroFormField name="phone" control={control} label={t`PHONE`}>
    <RetroInput type="tel" />
  </RetroFormField>
  <RetroFormField name="notes" control={control} label={t`NOTES`}>
    <RetroTextarea rows={3} />
  </RetroFormField>
</form>
```

---

### `features/borrowers/panel/BorrowerPanel.tsx` (component, request-response)

**Analog:** `frontend2/src/features/taxonomy/panel/EntityPanel.tsx` — simplified to single entity kind.

**forwardRef + imperative handle pattern** (copy from `EntityPanel.tsx:52-80`):
```tsx
export interface BorrowerPanelHandle {
  open: (mode: "create" | "edit", borrower?: Borrower) => void;
  close: () => void;
}

const BorrowerPanel = forwardRef<BorrowerPanelHandle, {}>(
  function BorrowerPanel(_, ref) {
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
  },
);
```

**Title / submit-label discriminated-literal pattern** (copy from `EntityPanel.tsx:86-108`):
```tsx
const title = mode === "create" ? t`NEW BORROWER` : t`EDIT BORROWER`;
const submitLabel = isPending
  ? t`WORKING…`
  : mode === "create" ? t`CREATE BORROWER` : t`SAVE BORROWER`;
```

**Submit delegate pattern** (copy from `EntityPanel.tsx:110-117`):
```tsx
const onSubmit = async (values: BorrowerCreateValues) => {
  if (mode === "create") {
    await createMutation.mutateAsync(values);
  } else if (borrower) {
    await updateMutation.mutateAsync({ id: borrower.id, input: values });
  }
  panelRef.current?.closeImmediate();
};
```

**SlideOverPanel footer wiring pattern** (copy from `EntityPanel.tsx:174-206`):
```tsx
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
  <BorrowerForm
    formId={formId}
    onSubmit={onSubmit}
    onDirtyChange={setIsDirty}
    defaultValues={
      mode === "edit" && borrower
        ? {
            name: borrower.name,
            email: borrower.email ?? "",
            phone: borrower.phone ?? "",
            notes: borrower.notes ?? "",
          }
        : undefined
    }
  />
</SlideOverPanel>
```

`SlideOverPanel` itself is imported directly — do NOT re-implement. Read `features/taxonomy/panel/SlideOverPanel.tsx:36-143` for the focus/dirty-guard contract.

---

### `features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx` (component, request-response)

**Analog:** `frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx` — parallel structure; two semantic diffs: (1) 400 short-circuit (not 409); (2) no `entityKind` discriminator (always "BORROWER").

**Import + handle pattern** (copy from `ArchiveDeleteFlow.tsx:1-40`):
```tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { HttpError } from "@/lib/api";

export interface BorrowerArchiveDeleteFlowProps {
  nodeName: string;
  onArchive: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}
export interface BorrowerArchiveDeleteFlowHandle {
  open: () => void;
  close: () => void;
}
```

**Two-stage dialog + 400 short-circuit pattern** (copy from `ArchiveDeleteFlow.tsx:58-85`, swap 409 → 400):
```tsx
const handleArchive = async () => {
  try {
    await onArchive();
    archiveRef.current?.close();
  } catch { /* toast from mutation hook; keep dialog open for retry */ }
};

const handleDelete = async () => {
  try {
    await onDelete();
    deleteRef.current?.close();
  } catch (err) {
    // 400 = active loans; close both; toast already emitted by useDeleteBorrower
    if (err instanceof HttpError && err.status === 400) {
      deleteRef.current?.close();
      archiveRef.current?.close();
      return;
    }
    // other errors: leave dialog open for retry
  }
};

const switchToDelete = () => {
  archiveRef.current?.close();
  setTimeout(() => deleteRef.current?.open(), 0);   // handoff timing
};
```

**Static-label pattern** (note: no `entityKind` discriminator needed — only BORROWER):
```tsx
// NOT interpolated — must be static literal for Lingui CLI extraction
const archiveLabel = t`ARCHIVE BORROWER`;
const deleteLabel = t`DELETE BORROWER`;
```

**Two RetroConfirmDialog instances pattern** (copy from `ArchiveDeleteFlow.tsx:87-114` — adjust copy per CONTEXT specifics):
```tsx
<>
  <RetroConfirmDialog
    ref={archiveRef}
    variant="soft"
    title={t`CONFIRM ARCHIVE`}
    body={t`This will hide '${nodeName}' from loan pickers. You can restore them later.`}
    headerBadge={t`HIDES FROM PICKERS`}
    escapeLabel={t`← BACK`}
    destructiveLabel={archiveLabel}
    onConfirm={handleArchive}
    secondaryLink={{ label: t`delete permanently`, onClick: switchToDelete }}
  />
  <RetroConfirmDialog
    ref={deleteRef}
    variant="destructive"
    title={t`CONFIRM DELETE`}
    body={t`Permanently delete '${nodeName}'? This cannot be undone.`}
    escapeLabel={t`← BACK`}
    destructiveLabel={deleteLabel}
    onConfirm={handleDelete}
  />
</>
```

---

### `features/borrowers/hooks/useBorrowerMutations.ts` (hook, mutation)

**Analog (structure):** `frontend2/src/features/taxonomy/hooks/useContainerMutations.ts` — 5-hook shape (create/update/archive/restore/remove).
**Analog (HttpError branch):** `frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts:94-101` — exact pattern for the `useDeleteBorrower` 400 branch.

**Import block pattern** (copy from `useCategoryMutations.ts:1-12`):
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HttpError } from "@/lib/api";
import {
  borrowersApi,
  borrowerKeys,
  type Borrower,
  type CreateBorrowerInput,
  type UpdateBorrowerInput,
} from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { useLingui } from "@lingui/react/macro";
```

**Create mutation pattern** (copy from `useContainerMutations.ts:13-27` — rename Container→Borrower):
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
    onError: () =>
      addToast(t`Connection lost. Your change was not saved.`, "error"),
  });
}
```

Apply the same shape to `useUpdateBorrower`, `useArchiveBorrower`, `useRestoreBorrower` (copy from `useContainerMutations.ts:29-80`).

**Delete mutation with 400-branch pattern** (copy from `useCategoryMutations.ts:83-102`, swap 409 → 400, update copy):
```typescript
export function useDeleteBorrower() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
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

---

### `features/borrowers/hooks/useBorrowersList.ts` (hook, query)

**Analog:** `frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts` — role-match (same useQuery shape, no tree build step).

**Full hook pattern** (copy from `useCategoriesTree.ts:1-25`, strip tree step):
```typescript
import { useQuery } from "@tanstack/react-query";
import {
  borrowersApi,
  borrowerKeys,
  type Borrower,
  type BorrowerListParams,
} from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";

export function useBorrowersList(showArchived: boolean) {
  const { workspaceId } = useAuth();
  const params: BorrowerListParams = {
    page: 1,
    limit: 100,
    // boolean undef|true per Research A7 — omit means default (active only)
    archived: showArchived ? true : undefined,
  };
  const query = useQuery({
    queryKey: borrowerKeys.list(params),
    queryFn: () => borrowersApi.list(workspaceId!, params),
    enabled: !!workspaceId,
  });
  const items: Borrower[] = query.data?.items ?? [];
  return { ...query, items };
}
```

Note: fetch-all-pages pattern from `useContainersByLocation.ts:22-36` is NOT needed for v1 per RESEARCH.A2 (limit=100 single page).

---

### `features/borrowers/hooks/useBorrower.ts` (hook, query)

**Analog:** new shape — single-entity detail; no direct codebase parallel (taxonomy is tree-only). Follow query-factory + useAuth + enabled-gate pattern universal across phases 56-58.

**Full hook pattern** (standard TanStack detail-query shape):
```typescript
import { useQuery } from "@tanstack/react-query";
import { borrowersApi, borrowerKeys, type Borrower } from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";

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

### `features/borrowers/BorrowersListPage.tsx` (component, page)

**Analog:** `frontend2/src/features/taxonomy/tabs/ContainersTab.tsx` — exact pattern for row+actions+archived-toggle+archive-flow wiring.
**Analog (page wrapper):** `frontend2/src/features/taxonomy/TaxonomyPage.tsx` — exact pattern for `p-lg`/heading/layout.

**Import + state pattern** (copy from `ContainersTab.tsx:1-46`):
```tsx
import { useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Plus, Pencil, Archive, Undo2 } from "./icons";
import {
  RetroPanel, RetroButton, RetroEmptyState, RetroCheckbox,
  RetroBadge, RetroTable, HazardStripe,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { useBorrowersList } from "./hooks/useBorrowersList";
import {
  useArchiveBorrower, useDeleteBorrower, useRestoreBorrower,
} from "./hooks/useBorrowerMutations";
import {
  BorrowerPanel, type BorrowerPanelHandle,
} from "./panel/BorrowerPanel";
import {
  BorrowerArchiveDeleteFlow, type BorrowerArchiveDeleteFlowHandle,
} from "./actions/BorrowerArchiveDeleteFlow";
import type { Borrower } from "@/lib/api/borrowers";
```

**Archived-toggle + handlers pattern** (copy from `ContainersTab.tsx:35-104`):
```tsx
const [showArchived, setShowArchived] = useState(false);
const [archiveTarget, setArchiveTarget] = useState<Borrower | null>(null);
const panelRef = useRef<BorrowerPanelHandle>(null);
const archiveFlowRef = useRef<BorrowerArchiveDeleteFlowHandle>(null);

const borrowersQuery = useBorrowersList(showArchived);
const archiveMutation = useArchiveBorrower();
const restoreMutation = useRestoreBorrower();
const deleteMutation = useDeleteBorrower();

const handleEdit = (b: Borrower) => panelRef.current?.open("edit", b);
const handleArchive = (b: Borrower) => {
  setArchiveTarget(b);
  archiveFlowRef.current?.open();
};
const handleRestore = (b: Borrower) => restoreMutation.mutate(b.id);
```

**Loading / error / empty states pattern** (copy from `ContainersTab.tsx:144-179`):
```tsx
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
    body={t`Add someone you lend items to — just name + contact info.`}
    action={<RetroButton variant="primary" onClick={handleNew}>{t`+ NEW BORROWER`}</RetroButton>}
  />
)}
```

**Row rendering** — use `RetroTable` (per CONTEXT Discretion); wrap cell children in `<span className="font-sans">` to override default `font-mono` (Pitfall 5 — RetroTable.tsx:40). Row action button pattern (Edit / Archive / Restore) from `ContainersTab.tsx:217-247`:
```tsx
<button
  type="button"
  aria-label={t`Edit ${b.name}`}
  onClick={() => handleEdit(b)}
  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
>
  <Pencil size={14} aria-hidden="true" />
  <span className="hidden lg:inline">{t`EDIT`}</span>
</button>
```

**ARCHIVED badge + muted text pattern** (copy from `ContainersTab.tsx:196-216`):
```tsx
className={archived ? "line-through text-retro-gray" : "text-retro-ink"}
{archived && (
  <RetroBadge variant="neutral" className="font-mono">{t`ARCHIVED`}</RetroBadge>
)}
```

**Panel + archive-flow mount pattern** (copy from `ContainersTab.tsx:260-279`):
```tsx
<BorrowerPanel ref={panelRef} />
<BorrowerArchiveDeleteFlow
  ref={archiveFlowRef}
  nodeName={archiveTarget?.name ?? ""}
  onArchive={() =>
    archiveTarget ? archiveMutation.mutateAsync(archiveTarget.id) : Promise.resolve()
  }
  onDelete={() =>
    archiveTarget ? deleteMutation.mutateAsync(archiveTarget.id) : Promise.resolve()
  }
/>
```

**Page wrapper layout** (copy from `TaxonomyPage.tsx:16-18`):
```tsx
<div className="flex flex-col gap-lg p-lg">
  <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-ink">
    {t`BORROWERS`}
  </h1>
  {/* controls + table/empty */}
</div>
```

---

### `features/borrowers/BorrowerDetailPage.tsx` (component, page)

**Analog (shape):** New — no direct in-repo detail-page parallel yet.
**Analog (idioms):** RESEARCH §Example 4 (copied here); `TaxonomyPage.tsx` for the outer `div` layout; `ContainersTab.tsx:144-163` for loading/error panels; `RetroEmptyState` barrel import.

**Full skeleton** (from RESEARCH Example 4 — already internally consistent with the code idioms):
```tsx
import { useParams, Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useBorrower } from "./hooks/useBorrower";
import { RetroPanel, RetroEmptyState, HazardStripe } from "@/components/retro";

export function BorrowerDetailPage() {
  const { t } = useLingui();
  const { id } = useParams<{ id: string }>();
  const borrowerQuery = useBorrower(id);

  if (borrowerQuery.isPending) {
    return <RetroPanel><p className="font-mono">{t`Loading…`}</p></RetroPanel>;
  }
  if (borrowerQuery.isError || !borrowerQuery.data) {
    return (
      <RetroPanel>
        <HazardStripe className="mb-md" />
        <p className="text-retro-red">{t`Borrower not found.`}</p>
        <Link to="/borrowers">{t`← BACK TO BORROWERS`}</Link>
      </RetroPanel>
    );
  }
  const b = borrowerQuery.data;
  return (
    <div className="flex flex-col gap-lg p-lg">
      <Link to="/borrowers" className="font-mono text-[14px] text-retro-ink">
        {t`← BORROWERS`}
      </Link>
      <h1 className="text-[24px] font-bold uppercase text-retro-ink">{b.name}</h1>
      {/* metadata grid: email / phone / notes */}
      <section aria-labelledby="active-loans-h2">
        <h2 id="active-loans-h2" className="text-[20px] font-bold uppercase">
          {t`ACTIVE LOANS`}
        </h2>
        <RetroEmptyState
          title={t`NO ACTIVE LOANS`}
          body={t`Loan data will be available soon.`}
        />
      </section>
      <section aria-labelledby="history-h2">
        <h2 id="history-h2" className="text-[20px] font-bold uppercase">
          {t`LOAN HISTORY`}
        </h2>
        <RetroEmptyState
          title={t`NO LOAN HISTORY`}
          body={t`Loan history will appear here once loans are wired.`}
        />
      </section>
    </div>
  );
}
```

**Do NOT import from `@/lib/api/loans`** in this file — CONTEXT D-04 defers loans-wiring to Phase 62.

---

### `features/borrowers/icons.tsx` (utility, static)

**Analog:** `frontend2/src/features/taxonomy/icons.tsx` — direct copy; reuse the same SVG inline definitions. Icons needed in Phase 59: `Pencil`, `Archive`, `Undo2` (restore), `Plus` (new button). Add `ArrowLeft` if detail page wants icon instead of `← BORROWERS` text link.

**Import guardrail:** Do NOT add `lucide-react`; it is not a dependency, and inline SVG is the project pattern (see `icons.tsx:1-24` comment block — forbidding new runtime deps).

---

### `routes/index.tsx` (MODIFY — route registration)

**Analog:** the existing `routes/index.tsx` itself (`taxonomy` line).

**Pattern** (copy from `routes/index.tsx:77`, insert before `items` or after `taxonomy` — order doesn't matter for v7 rank-based matching, but declare list route before dynamic per Pitfall 6):
```tsx
import { BorrowersListPage } from "@/features/borrowers/BorrowersListPage";
import { BorrowerDetailPage } from "@/features/borrowers/BorrowerDetailPage";
// ...inside authenticated <Route element={<AppShell />}>
<Route path="borrowers" element={<BorrowersListPage />} />
<Route path="borrowers/:id" element={<BorrowerDetailPage />} />
```

---

### Test files — all `features/borrowers/__tests__/*`

**Fixture pattern** — copy `features/taxonomy/__tests__/fixtures.tsx` verbatim; add a `makeBorrower` factory mirroring `makeContainer` (lines 114-128):
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

Keep `setupDialogMocks()` utility from `fixtures.tsx:72-79` — needed by ArchiveDeleteFlow + BorrowerPanel tests.

**Form test pattern:** exact copy of `CategoryForm.test.tsx` — 3 cases: (a) valid submit, (b) required-field error, (c) `onDirtyChange(true)` after typing. Adapt field labels to borrower fields (name/email/phone/notes).

**Archive-delete flow test pattern:** exact copy of `ArchiveDeleteFlow.test.tsx` — 5 cases; swap `HttpError(409)` → `HttpError(400)`; swap `delete category` → `delete borrower`.

**List page test pattern:** copy `ContainersTab.test.tsx` structure — `vi.mock("@/lib/api/borrowers")`; `listMock.mockResolvedValue(...)`; render and assert rows / archived badge / empty state / + NEW CONTAINER → + NEW BORROWER.

**Panel test pattern:** combination of `ContainersTab.test.tsx` (open panel) + `CategoryForm.test.tsx` (fill + submit); assert create and edit modes both work; assert dirty-guard opens DISCARD CHANGES dialog.

**Detail page test pattern:** new — mock `borrowersApi.get`; assert loading / error / populated-with-two-empty-loan-sections.

---

### Backend — `domain/warehouse/borrower/handler.go` (MODIFY)

**Analog:** `backend/internal/domain/warehouse/category/handler.go` — canonical 3-endpoint pattern for archive / restore / hard-delete; already verified.

**List filter param addition** (pattern — handler.go:217-220 → extend):
```go
type ListBorrowersInput struct {
    Page     int  `query:"page" default:"1" minimum:"1"`
    Limit    int  `query:"limit" default:"50" minimum:"1" maximum:"100"`
    Archived *bool `query:"archived"`   // nil = default (active only); true = include archived
}
```
And thread through `svc.List(ctx, workspaceID, pagination, input.Archived)` — extend service+repo+SQL accordingly.

**Archive endpoint pattern** (copy from `category/handler.go:187-215` — change entity names and event type):
```go
huma.Post(api, "/borrowers/{id}/archive", func(ctx context.Context, input *GetBorrowerInput) (*struct{}, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok {
        return nil, huma.Error401Unauthorized("workspace context required")
    }
    authUser, _ := appMiddleware.GetAuthUser(ctx)
    if err := svc.Archive(ctx, input.ID, workspaceID); err != nil {
        return nil, huma.Error400BadRequest(err.Error())
    }
    if broadcaster != nil && authUser != nil {
        userName := appMiddleware.GetUserDisplayName(ctx)
        broadcaster.Publish(workspaceID, events.Event{
            Type:       "borrower.archived",
            EntityID:   input.ID.String(),
            EntityType: "borrower",
            UserID:     authUser.ID,
            Data:       map[string]any{"user_name": userName},
        })
    }
    return nil, nil
})
```

**Restore endpoint pattern** (copy from `category/handler.go:217-246`):
```go
huma.Post(api, "/borrowers/{id}/restore", func(ctx context.Context, input *GetBorrowerInput) (*struct{}, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }
    authUser, _ := appMiddleware.GetAuthUser(ctx)
    if err := svc.Restore(ctx, input.ID, workspaceID); err != nil {
        return nil, huma.Error400BadRequest(err.Error())
    }
    if broadcaster != nil && authUser != nil {
        userName := appMiddleware.GetUserDisplayName(ctx)
        broadcaster.Publish(workspaceID, events.Event{
            Type:       "borrower.restored",
            EntityID:   input.ID.String(),
            EntityType: "borrower",
            UserID:     authUser.ID,
            Data:       map[string]any{"user_name": userName},
        })
    }
    return nil, nil
})
```

**Hard-delete rewire pattern** (replace `handler.go:142-174` — currently calls `svc.Archive`; rewire to `svc.Delete`; keep the 400 branch which is now LIVE because `svc.Delete` returns `ErrHasActiveLoans`):
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
            Type:       "borrower.deleted",
            EntityID:   input.ID.String(),
            EntityType: "borrower",
            UserID:     authUser.ID,
            Data:       map[string]any{"user_name": userName},
        })
    }
    return nil, nil
})
```

Use `errors.Is(err, ErrHasActiveLoans)` (stdlib `errors` import) instead of the existing `err == ErrHasActiveLoans` equality check — safer under error wrapping.

---

### Backend — `infra/postgres/borrower_repository.go` (MODIFY)

**Analog:** `backend/internal/infra/postgres/category_repository.go:134-142` — `Delete` is a true hard-delete (`r.queries.DeleteCategory(ctx, id)`) and a separate archive mechanism exists.

**Current gap** (`borrower_repository.go:73-75` — Pitfall 3): `Delete` currently calls `ArchiveBorrower` SQL — soft-archive. Must rewire to a new `DeleteBorrower` query.

**Pattern — split Archive and Delete**:
```go
// Add separate repo methods
func (r *BorrowerRepository) Archive(ctx context.Context, id uuid.UUID) error {
    return r.queries.ArchiveBorrower(ctx, id)
}
func (r *BorrowerRepository) Restore(ctx context.Context, id uuid.UUID) error {
    return r.queries.RestoreBorrower(ctx, id)   // SQL already exists at borrowers.sql:21-24
}
func (r *BorrowerRepository) Delete(ctx context.Context, id uuid.UUID) error {
    return r.queries.DeleteBorrower(ctx, id)    // NEW SQL — must be added
}
```

Update `domain/warehouse/borrower/repository.go:11-18` interface to add `Archive` + `Restore` methods; update `service.go:80-88,90-98` to call `repo.Archive`/`repo.Restore` instead of going through `Save` + entity state change (optional refactor — current entity-centric approach also works, but category pattern is repo-centric). Minimal change: keep service.go as-is; only fix `repo.Delete` to run DELETE SQL.

---

### Backend — `db/queries/borrowers.sql` (MODIFY)

**Analog:** `backend/db/queries/categories.sql:47-48` — the `DeleteCategory` hard-delete query.

**Add `DeleteBorrower` pattern** (copy from `categories.sql:47-48`):
```sql
-- name: DeleteBorrower :exec
DELETE FROM warehouse.borrowers WHERE id = $1;
```

**Extend `ListBorrowers` for archived filter** (currently `borrowers.sql:26-30` hard-codes `AND is_archived = false`). Pattern options:
- Simplest: add a separate query `ListBorrowersIncludingArchived` and branch at Go layer.
- Cleaner: use a sqlc-friendly `CASE` or `COALESCE` on a nullable param:
```sql
-- name: ListBorrowers :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1
  AND (sqlc.narg('archived')::bool IS NULL OR is_archived = sqlc.narg('archived')::bool)
  -- OR: if archived param absent → include all; present+false → active only; present+true → archived only
ORDER BY name
LIMIT $2 OFFSET $3;
```
Regenerate `infra/queries/borrowers.sql.go` via sqlc after editing.

---

## Shared Patterns

### workspaceId from useAuth
**Source:** `frontend2/src/features/auth/AuthContext.tsx` (re-export)
**Apply to:** Every frontend hook (`useBorrower*`, mutations)
```typescript
const { workspaceId } = useAuth();
// never pass as prop — always read from context
// always gate enabled: enabled: !!workspaceId
```
**Verified use:** `useCategoryMutations.ts:15`, `useContainerMutations.ts:14`, `useCategoriesTree.ts:12`.

### Toast on mutate
**Source:** `frontend2/src/components/retro/RetroToast.tsx` via `useToast()`
**Apply to:** Every mutation hook `onSuccess`/`onError`
```typescript
const { addToast } = useToast();
addToast(t`Borrower created.`, "success");
addToast(t`Connection lost. Your change was not saved.`, "error");
```
**Verified use:** `useContainerMutations.ts:16-17,20-25`.

### HttpError branch discrimination
**Source:** `frontend2/src/lib/api.ts` (`HttpError` class)
**Apply to:** `useDeleteBorrower` (400 → active-loans toast); `BorrowerArchiveDeleteFlow.handleDelete` (400 → close both dialogs without fallthrough)
```typescript
if (err instanceof HttpError && err.status === 400) {
  addToast(t`Cannot delete: this borrower has active loans.`, "error");
  return;
}
```
**Verified use:** `useCategoryMutations.ts:94-100` (status 409 branch — swap to 400 for borrower).

### Cache invalidation via `*Keys.all`
**Apply to:** Every borrower mutation `onSuccess`
```typescript
qc.invalidateQueries({ queryKey: borrowerKeys.all });
```
**Verified use:** all 5 hooks in `useContainerMutations.ts`; all 5 in `useCategoryMutations.ts`.

### Lingui `t` macro — static label extraction
**Source:** `frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx:42-56`
**Apply to:** Every user-visible string. Avoid `t`${variable}`` template interpolation over non-static parts; use discriminated literals.
```typescript
// Good: static literal
const archiveLabel = t`ARCHIVE BORROWER`;

// Bad: dynamic interpolation breaks CLI extraction
const archiveLabel = t`ARCHIVE ${entityKind.toUpperCase()}`;

// Acceptable: interpolation of runtime values inside otherwise-static template
t`This will hide '${nodeName}' from loan pickers.`;  // OK
```

### Retro barrel — import discipline
**Source:** `frontend2/src/components/retro/index.ts`
**Apply to:** Every component import
```typescript
// CORRECT
import { RetroButton, RetroEmptyState, useToast } from "@/components/retro";

// FORBIDDEN — blocks via bun run lint:imports
import { RetroButton } from "@/components/retro/RetroButton";
```
**Verified exports:** all retro primitives Phase 59 needs — `RetroButton`, `RetroPanel`, `RetroInput`, `RetroTextarea`, `RetroCheckbox`, `RetroFormField`, `RetroEmptyState`, `RetroTable`, `RetroBadge`, `RetroConfirmDialog`, `HazardStripe`, `ToastProvider`, `useToast`. See `index.ts:1-32`.

### Min 44px touch target
**Source:** `frontend2/src/features/taxonomy/tabs/ContainersTab.tsx:199,222`
**Apply to:** Every interactive button/control row
```tsx
className="min-h-[44px] lg:min-h-[36px]"   // responsive for denser desktop
// or for icon-only buttons:
className="min-h-[36px] min-w-[36px]"      // 36px acceptable at lg+, 44px target on mobile via wrapping row
```

### Empty-string → undefined submit coercion
**Source:** `frontend2/src/features/taxonomy/forms/CategoryForm.tsx:20-30,62-68`
**Apply to:** `BorrowerForm.tsx` — every optional text field

### Backend auth/workspace handshake
**Source:** `backend/internal/domain/warehouse/category/handler.go:17-22` (every endpoint)
**Apply to:** Every new backend endpoint
```go
workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
if !ok {
    return nil, huma.Error401Unauthorized("workspace context required")
}
authUser, _ := appMiddleware.GetAuthUser(ctx)  // for event publish
```

### Backend event broadcast
**Source:** `backend/internal/domain/warehouse/category/handler.go:200-213`
**Apply to:** New archive/restore endpoints (publish `borrower.archived` / `borrower.restored`). Keep existing `borrower.deleted` on hard-delete.

---

## No Analog Found

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `features/borrowers/hooks/useBorrower.ts` | hook | request-response | Taxonomy feature is tree-only; no existing detail-query hook in warehouse features | Use RESEARCH §Example 1 (universal TanStack query shape — enabled gate + queryKey factory + workspaceId guard); idiom matches Phase 56 foundation conventions. |
| `features/borrowers/BorrowerDetailPage.tsx` | component (page) | request-response | First detail page in the codebase | Use RESEARCH §Example 4 (fully-specified skeleton); layout idioms borrowed from `TaxonomyPage.tsx`; section/empty-state idioms from `RetroEmptyState` + `ContainersTab.tsx` loading/error panels |
| `features/borrowers/__tests__/BorrowerDetailPage.test.tsx` | test | test | No detail-page test exists in `taxonomy/__tests__` | Adapt `ContainersTab.test.tsx` mocking approach (vi.mock `@/lib/api/borrowers`) + react-router `MemoryRouter`/`<Routes>` wrapping |

---

## Metadata

**Analog search scope:**
- `frontend2/src/features/taxonomy/` (hooks, forms, panel, actions, tabs, `__tests__/fixtures.tsx`)
- `frontend2/src/lib/api/` (`borrowers.ts`, `categories.ts`)
- `frontend2/src/components/retro/` (barrel + `RetroTable.tsx`)
- `frontend2/src/routes/index.tsx`
- `backend/internal/domain/warehouse/borrower/` (handler, service, repository, errors)
- `backend/internal/domain/warehouse/category/` (handler — canonical archive/restore/delete pattern)
- `backend/internal/infra/postgres/` (borrower_repository.go, category_repository.go)
- `backend/db/queries/` (borrowers.sql, categories.sql)

**Files scanned:** ~22 source files + 4 test files
**Pattern extraction date:** 2026-04-16
**Confidence:** HIGH — Phase 58 shipped with verified parallel code; taxonomy (category/location/container) is a near-perfect sibling for borrower CRUD; one semantic diff (400 instead of 409 on guarded hard-delete) is explicitly documented.
