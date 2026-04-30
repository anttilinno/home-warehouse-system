# Phase 58: Taxonomy — Categories, Locations, Containers — Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 27 (new files) + 2 (modified)
**Analogs found:** 25 / 27 new (2 greenfield with no direct analog — slide-over panel, tree builder)

## File Classification

### New files

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend2/src/features/taxonomy/TaxonomyPage.tsx` | page/route | request-response + UI state | `frontend2/src/pages/ApiDemoPage.tsx` | role + data-flow match |
| `frontend2/src/features/taxonomy/hooks/useHashTab.ts` | hook | UI state (browser) | none (novel) — small inline pattern per RESEARCH §Pattern 4 | no-analog |
| `frontend2/src/features/taxonomy/hooks/useCategoriesTree.ts` | hook | request-response (read) | `frontend2/src/pages/ApiDemoPage.tsx` (useQuery wiring) | role + data-flow match |
| `frontend2/src/features/taxonomy/hooks/useLocationsTree.ts` | hook | request-response (read) | `frontend2/src/pages/ApiDemoPage.tsx` | role + data-flow match |
| `frontend2/src/features/taxonomy/hooks/useContainersByLocation.ts` | hook | request-response (read) | `frontend2/src/pages/ApiDemoPage.tsx` | role + data-flow match |
| `frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts` | hook | CRUD (mutate + invalidate) | no in-repo mutation hook yet — use RESEARCH §Pattern 3 as blueprint | no-analog (new pattern for codebase) |
| `frontend2/src/features/taxonomy/hooks/useLocationMutations.ts` | hook | CRUD | same as above | no-analog |
| `frontend2/src/features/taxonomy/hooks/useContainerMutations.ts` | hook | CRUD | same as above | no-analog |
| `frontend2/src/features/taxonomy/tree/buildTree.ts` | utility (pure fn) | transform | none (novel) — spec'd in RESEARCH §Pattern 1 | no-analog |
| `frontend2/src/features/taxonomy/tree/TreeNode.tsx` | component (recursive row) | UI state | `frontend2/src/components/retro/RetroTabs.tsx` (simple button-row component using retro classes) | partial (style only) |
| `frontend2/src/features/taxonomy/tree/TaxonomyTree.tsx` | component (tree wrapper) | UI state | `frontend2/src/components/retro/RetroTable.tsx` | partial (structural row list) |
| `frontend2/src/features/taxonomy/tabs/CategoriesTab.tsx` | component (tab body) | request-response | `frontend2/src/pages/ApiDemoPage.tsx` (loading / error / empty / success states) | role + data-flow match |
| `frontend2/src/features/taxonomy/tabs/LocationsTab.tsx` | component (tab body) | request-response | `frontend2/src/pages/ApiDemoPage.tsx` | role + data-flow match |
| `frontend2/src/features/taxonomy/tabs/ContainersTab.tsx` | component (tab body, grouped list) | request-response | `frontend2/src/pages/ApiDemoPage.tsx` | role + data-flow match |
| `frontend2/src/features/taxonomy/forms/schemas.ts` | zod schemas | validation | none in repo yet — standard zod shape per RESEARCH §Ex 2 | no-analog |
| `frontend2/src/features/taxonomy/forms/CategoryForm.tsx` | form | request-response | `frontend2/src/features/auth/LoginForm.tsx` (form submit + error handling) + RetroFormField contract | role match; upgraded to RHF per Phase 57 |
| `frontend2/src/features/taxonomy/forms/LocationForm.tsx` | form | request-response | `frontend2/src/features/auth/LoginForm.tsx` | role match |
| `frontend2/src/features/taxonomy/forms/ContainerForm.tsx` | form | request-response | `frontend2/src/features/auth/LoginForm.tsx` | role match |
| `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` | component (overlay) | UI state | `frontend2/src/components/retro/RetroDialog.tsx` + RetroConfirmDialog (imperative handle pattern) | partial — new right-docked pattern per RESEARCH §Pattern 5 |
| `frontend2/src/features/taxonomy/panel/EntityPanel.tsx` | component (composer) | UI state | `frontend2/src/components/retro/RetroConfirmDialog.tsx` (imperative handle wrapper) | partial |
| `frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx` | component (flow) | CRUD orchestration | `frontend2/src/components/retro/RetroConfirmDialog.tsx` (forwardRef + imperative open/close) | role match |
| `frontend2/src/features/taxonomy/actions/shortCode.ts` | utility | transform | none (novel) — spec'd in RESEARCH §Ex 4 | no-analog |
| `frontend2/src/features/taxonomy/__tests__/buildTree.test.ts` | unit test | pure | `frontend2/src/lib/api/__tests__/queryKeys.test.ts` | role match |
| `frontend2/src/features/taxonomy/__tests__/shortCode.test.ts` | unit test | pure | `frontend2/src/lib/api/__tests__/queryKeys.test.ts` | role match |
| `frontend2/src/features/taxonomy/__tests__/ArchiveDeleteFlow.test.tsx` | integration test | React + mock mutations | `frontend2/src/components/retro/__tests__/RetroConfirmDialog.test.tsx` | exact (same primitive) |
| `frontend2/src/features/taxonomy/__tests__/CategoryForm.test.tsx` | integration test | RHF + zod | `frontend2/src/components/retro/__tests__/RetroConfirmDialog.test.tsx` (I18nProvider wrapper) | partial |
| `frontend2/src/features/taxonomy/__tests__/LocationForm.test.tsx` | integration test | RHF + zod | same | partial |
| `frontend2/src/features/taxonomy/__tests__/ContainerForm.test.tsx` | integration test | RHF + zod | same | partial |
| `frontend2/src/features/taxonomy/__tests__/ContainersTab.test.tsx` | integration test | RQ + render | same + ApiDemoPage wiring | partial |
| `frontend2/src/features/taxonomy/__tests__/TaxonomyPage.test.tsx` | integration test | hash sync + tabs | same | partial |
| `frontend2/src/features/taxonomy/__tests__/fixtures.ts` | test fixtures | data | none (novel) | no-analog |

### Modified files

| File | Change | Reference |
|------|--------|-----------|
| `frontend2/src/routes/index.tsx` | Add `/taxonomy` authed route | See Shared Patterns §Route Registration |
| `frontend2/src/lib/api/__tests__/queryKeys.test.ts` | (no change required — already covers `categoryKeys`, `locationKeys`, `containerKeys`) | Verified at lines 1–8 |

## Pattern Assignments

### `TaxonomyPage.tsx` (page/route, request-response + UI state)

**Analog:** `frontend2/src/pages/ApiDemoPage.tsx`

**Imports pattern** (ApiDemoPage.tsx:1–5):
```tsx
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { itemsApi, itemKeys, type ItemListParams } from "@/lib/api/items";
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";
```
Mirror this for taxonomy: `useLingui` + `useAuth` + retro-barrel imports + API-barrel imports. All retro imports MUST come from `@/components/retro` barrel (verified at `index.ts:1–33`).

**Auth pattern** (ApiDemoPage.tsx:9, 18):
```tsx
const { workspaceId, isLoading: authLoading } = useAuth();
// ...
if (authLoading) return null;
```
Apply verbatim. Guard every query with `enabled: !!workspaceId`.

**Tab switcher wire-up** (new, combine RetroTabs.tsx + RESEARCH §Pattern 4):
```tsx
const [tab, setTab] = useHashTab("categories", ["categories", "locations", "containers"]);
<RetroTabs
  tabs={[
    { key: "categories", label: t`CATEGORIES` },
    { key: "locations", label: t`LOCATIONS` },
    { key: "containers", label: t`CONTAINERS` },
  ]}
  activeTab={tab}
  onTabChange={setTab}
/>
```
`RetroTabs` props verified at `RetroTabs.tsx:1–6`.

---

### `hooks/useCategoriesTree.ts` (hook, read)

**Analog:** `ApiDemoPage.tsx:11–16`

**Core pattern** (ApiDemoPage.tsx:11–16):
```tsx
const params: ItemListParams = { page: 1, limit: 10 };
const query = useQuery({
  queryKey: itemKeys.list(params),
  queryFn: () => itemsApi.list(workspaceId!, params),
  enabled: !!workspaceId,
});
```
For categories, use `categoryKeys.list({ archived: false })` + `categoriesApi.list(wsId, { archived: false })` (verified at `categories.ts:46–67`). Wrap output with `useMemo(() => buildTree(...), [query.data])`. For locations use `{ limit: 1000, archived: false }` per Pitfall 1.

---

### `hooks/useCategoryMutations.ts` (hook, CRUD + invalidate)

**Analog:** None in-repo yet (ApiDemoPage only reads). Use RESEARCH §Pattern 3 blueprint, modeled on the `HttpError` class at `lib/api.ts:5–13`.

**Error-check pattern** (verified import shape — `categories.ts:1` `import { get, post, patch, del } from "@/lib/api"`; `HttpError` at `lib/api.ts:5`):
```tsx
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
        return;
      }
      addToast(t`Connection lost. Your change was not saved.`, "error");
    },
  });
}
```
`useToast` is exported from the retro barrel (verified `components/retro/index.ts:32`). `categoryKeys.all` verified at `categories.ts:62`.

---

### `tabs/CategoriesTab.tsx`, `LocationsTab.tsx`, `ContainersTab.tsx` (tab bodies, request-response)

**Analog:** `frontend2/src/pages/ApiDemoPage.tsx` (lines 38–88 show the exact loading / error / empty / success state cascade to replicate)

**State cascade pattern** (ApiDemoPage.tsx:38–68):
```tsx
{workspaceId && query.isPending && (
  <RetroPanel><p className="font-mono text-retro-charcoal">{t`Loading…`}</p></RetroPanel>
)}
{workspaceId && query.isError && (
  <RetroPanel style={{ borderColor: "var(--color-retro-red)" }}>
    <HazardStripe className="mb-md" />
    <p className="text-retro-red mb-md">{t`Could not reach the API…`}</p>
    <RetroButton variant="primary" onClick={() => query.refetch()}>{t`Retry fetch`}</RetroButton>
  </RetroPanel>
)}
{workspaceId && query.isSuccess && query.data.items.length === 0 && (
  // empty state — swap in RetroEmptyState per CONTEXT canonical_refs
)}
{workspaceId && query.isSuccess && query.data.items.length > 0 && (
  // tree / grouped list
)}
```
For the empty state, prefer `RetroEmptyState` from the retro barrel (canonical ref in 58-CONTEXT.md).

---

### `forms/CategoryForm.tsx`, `LocationForm.tsx`, `ContainerForm.tsx` (forms, request-response)

**Analog:** `frontend2/src/features/auth/LoginForm.tsx` (form submit wiring pattern) — but upgraded to RHF + zod + `RetroFormField` per Phase 57 D-03.

**Form submit pattern** (LoginForm.tsx:56–88) — error-branch structure to mirror for mutation failure handling:
```tsx
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setError("");
  setIsSubmitting(true);
  try {
    await login(email, password);
    // success path
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("401") || message.includes("invalid")) { /* ... */ }
    // ...
  } finally {
    setIsSubmitting(false);
  }
};
```
In Phase 58 forms, replace this manual state with RHF `handleSubmit` + mutation `onError`. Reuse the LoginForm error-classification idea (match `HttpError.status` rather than string matching).

**RetroFormField contract** (`components/retro/RetroFormField.tsx:9–46`):
```tsx
<Controller name="..." control={control} render={({ field, fieldState }) => ...} />
// wraps children by cloneElement: id, name, value, onChange, onBlur, ref, error
```
Every form field in Phase 58 MUST go through `RetroFormField`. The child (`RetroInput`, `RetroTextarea`, `RetroCombobox`) receives `value`/`onChange`/`error` via cloneElement automatically.

**Zod schema** (RESEARCH §Ex 2):
```ts
export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120),
  parent_category_id: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});
```
Per Pitfall 3: use `z.string().uuid().optional()` for `parent_category_id` / `parent_location` — submit `undefined`, never `""`.

---

### `panel/SlideOverPanel.tsx` (overlay, UI state)

**Analog:** `frontend2/src/components/retro/RetroDialog.tsx` (imperative handle shape + FloatingPortal pattern). The slide-over is a NEW pattern — native `<dialog>` centers, so we build a right-docked `<aside>` per RESEARCH §Pattern 5 but REUSE the imperative-handle shape.

**Imperative handle pattern** (`RetroConfirmDialog.tsx:23–44`):
```tsx
interface RetroConfirmDialogHandle {
  open: () => void;
  close: () => void;
}
const RetroConfirmDialog = forwardRef<RetroConfirmDialogHandle, Props>(({ ... }, ref) => {
  const innerRef = useRef<RetroDialogHandle>(null);
  useImperativeHandle(ref, () => ({
    open: () => innerRef.current?.open(),
    close: () => innerRef.current?.close(),
  }));
  // ...
});
```
Apply the same `forwardRef` + `useImperativeHandle` shape to `SlideOverPanel` so parents open/close it via refs (matches the confirm-dialog ergonomics used throughout the retro library).

**Pending state** (`RetroConfirmDialog.tsx:46–54`):
```tsx
const [pending, setPending] = useState(false);
const handleConfirm = async () => {
  setPending(true);
  try { await onConfirm(); innerRef.current?.close(); }
  finally { setPending(false); }
};
```
Mirror in the panel's save handler — disable Save button while `pending`.

---

### `actions/ArchiveDeleteFlow.tsx` (CRUD orchestration)

**Analog:** `frontend2/src/components/retro/RetroConfirmDialog.tsx` (composition of two confirm dialogs via refs)

**Composition pattern** — two `RetroConfirmDialog` instances, each with a ref:
```tsx
const archiveRef = useRef<RetroConfirmDialogHandle>(null);
const deleteRef = useRef<RetroConfirmDialogHandle>(null);
// archive dialog: variant="soft", amber
// delete dialog: variant="destructive", red + HazardStripe (automatic when variant==="destructive", see RetroConfirmDialog.tsx:67 `hideHazardStripe={variant !== "destructive"}`)
```

**409 short-circuit** — in the mutation `onError` (see `useCategoryMutations` pattern above) branch on `err instanceof HttpError && err.status === 409`; the surrounding dialog must be closed imperatively AND success toast suppressed. Do NOT handle 409 in the dialog's `onConfirm`; it's centralized in the mutation hook.

---

### `tree/buildTree.ts` + `actions/shortCode.ts` (pure utilities)

**Analog:** None — spec'd verbatim in RESEARCH §Pattern 1 and §Ex 4. Implement as pure functions, no React imports. Unit-testable with plain Vitest (see test analog below).

---

### `__tests__/*.test.ts(x)` (tests)

**Pure unit test analog:** `frontend2/src/lib/api/__tests__/queryKeys.test.ts:1–30`
```ts
import { describe, it, expect } from "vitest";
import { itemKeys } from "../items";
describe("itemKeys factory", () => {
  it("all equals ['items']", () => { expect(itemKeys.all).toEqual(["items"]); });
});
```
Apply same style for `buildTree.test.ts` and `shortCode.test.ts`.

**React + i18n integration test analog:** `frontend2/src/components/retro/__tests__/RetroConfirmDialog.test.tsx:1–48`
```tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
i18n.load("en", {});
i18n.activate("en");

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}
```
Reuse verbatim for every Phase 58 test that renders RetroConfirmDialog or slide-over. For tests that use `useQuery`/`useMutation`, additionally wrap with `QueryClientProvider` (new `QueryClient()` per test to isolate cache). For tests that use `useToast`, wrap with `ToastProvider` (exported from `@/components/retro`). For tests that use `useAuth`, create a fixture `AuthContext.Provider` with a seeded `workspaceId`. Consolidate into `fixtures.ts` `renderWithProviders()` helper.

## Shared Patterns

### Authentication / Workspace Threading
**Source:** `frontend2/src/features/auth/AuthContext.tsx` via `useAuth()`
**Apply to:** every hook (`useCategoriesTree`, `useLocationsTree`, `useContainersByLocation`, all mutation hooks) and `TaxonomyPage.tsx`
```tsx
const { workspaceId, isLoading: authLoading } = useAuth();
// guard: useQuery({ ..., enabled: !!workspaceId })
// API calls: categoriesApi.list(workspaceId!, ...)
```
Never pass `workspaceId` as a prop. Pattern verified in `ApiDemoPage.tsx:9,14–16` and codified in Phase 56 CONTEXT D-01.

### Error Handling (HTTP → UX)
**Source:** `frontend2/src/lib/api.ts:5–13` (`HttpError`)
**Apply to:** every mutation hook's `onError`
```tsx
import { HttpError } from "@/lib/api";
if (err instanceof HttpError && err.status === 409) { /* specific toast */ return; }
addToast(t`Connection lost. Your change was not saved.`, "error");
```
Prefer `HttpError.status` over string matching in error.message (which LoginForm.tsx does — we're upgrading that pattern).

### i18n (Lingui t-macro)
**Source:** used throughout; e.g. `ApiDemoPage.tsx:8`, `LoginForm.tsx:46`, `RetroConfirmDialog.tsx:36`
**Apply to:** every user-visible string in Phase 58
```tsx
import { useLingui } from "@lingui/react/macro";
const { t } = useLingui();
return <p>{t`Loading data…`}</p>;
```
MANDATORY per project constraints. No hard-coded UI strings.

### Retro barrel imports
**Source:** `frontend2/src/components/retro/index.ts:1–33`
**Apply to:** every file importing retro primitives
```tsx
import { RetroPanel, RetroButton, RetroTabs, RetroFormField, RetroCombobox,
         RetroConfirmDialog, RetroEmptyState, useToast } from "@/components/retro";
```
Never import from individual retro files directly.

### Query-key factory usage
**Source:** `frontend2/src/lib/api/categories.ts:61–67`, `locations.ts:67–73`, `containers.ts` (same shape)
**Apply to:** every `useQuery` and every `queryClient.invalidateQueries`
```tsx
useQuery({ queryKey: categoryKeys.list({ archived: false }), ... });
qc.invalidateQueries({ queryKey: categoryKeys.all });
```
Already exported by Phase 56. Do NOT construct ad-hoc string arrays.

### Imperative-handle dialogs
**Source:** `frontend2/src/components/retro/RetroConfirmDialog.tsx:23–44`
**Apply to:** `SlideOverPanel`, `ArchiveDeleteFlow` triggers
```tsx
const ref = useRef<RetroConfirmDialogHandle>(null);
// trigger:
<RetroButton onClick={() => ref.current?.open()}>...</RetroButton>
```

### Form contract (RHF + zod + RetroFormField)
**Source:** `frontend2/src/components/retro/RetroFormField.tsx:9–46` + RESEARCH §Ex 2
**Apply to:** `CategoryForm`, `LocationForm`, `ContainerForm`
```tsx
const { control, handleSubmit, formState } = useForm<Values>({
  resolver: zodResolver(schema),
  defaultValues,
  mode: "onBlur",
});
<RetroFormField name="name" control={control} label={t`NAME`}>
  <RetroInput />
</RetroFormField>
```
Phase 57 D-03 — "Controller-for-all" pattern is mandatory.

### Route Registration
**Source:** `frontend2/src/routes/index.tsx:66–86`
**Apply to:** add `/taxonomy` route inside authed `AppShell` block
```tsx
<Route element={<RequireAuth><AppShell /></RequireAuth>} errorElement={<ErrorBoundaryPage />}>
  <Route index element={<DashboardPage />} />
  <Route path="items" element={<ItemsPage />} />
  {/* add: */}
  <Route path="taxonomy" element={<TaxonomyPage />} />
  {/* ... */}
</Route>
```
Place alongside `items`/`loans`. Do NOT create a separate `RequireAuth` wrapper — the nested route inherits.

### Toast feedback
**Source:** `frontend2/src/components/retro/RetroToast.tsx:27–64` (`ToastProvider`, `useToast().addToast(msg, variant)`)
**Apply to:** every mutation hook's `onSuccess` and `onError`
```tsx
const { addToast } = useToast();
addToast(t`Category created.`, "success");
addToast(t`Move or delete child nodes first.`, "error");
```
Variants: `"success" | "error" | "info"` (verified `RetroToast.tsx:9–13`).

## No Analog Found

| File | Role | Data Flow | Reason | Fallback |
|------|------|-----------|--------|----------|
| `hooks/useHashTab.ts` | hook | UI state | No existing URL-hash-sync hook in codebase | Use RESEARCH §Pattern 4 verbatim |
| `tree/buildTree.ts` | utility | transform | First tree-builder in project | Use RESEARCH §Pattern 1 verbatim |
| `actions/shortCode.ts` | utility | transform | Novel to Phase 58 | Use RESEARCH §Ex 4 verbatim |
| `forms/schemas.ts` | zod schemas | validation | No prior zod schemas in `features/` | Use RESEARCH §Ex 2 as template |
| `panel/SlideOverPanel.tsx` | overlay component | UI state | Native `<dialog>` centers; right-docked overlay is new | RESEARCH §Pattern 5 + borrow imperative-handle shape from `RetroConfirmDialog.tsx:23–44` |
| `hooks/use*Mutations.ts` | mutation hooks | CRUD | Codebase currently only uses `useQuery`; mutations are inline or absent | Use RESEARCH §Pattern 3 blueprint + `HttpError` + `useToast` + `categoryKeys.all` |
| `__tests__/fixtures.ts` | test seed data | data | Novel | Build per RESEARCH §Validation Architecture "Shared test fixture" note |

## Metadata

**Analog search scope:** `frontend2/src/{features,pages,components/retro,lib/api,routes}/**`
**Files scanned:** ~35
**Pattern extraction date:** 2026-04-16
**Key insight:** The phase is ~80% composition of already-verified retro primitives + API modules. Only four genuinely new patterns need to be established: (1) the flat→tree builder, (2) the URL-hash tab sync, (3) the right-docked slide-over panel, and (4) the mutation-hook shape with `HttpError` branching. Every other file has a strong in-repo analog.
