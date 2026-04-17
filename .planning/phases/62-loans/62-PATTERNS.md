# Phase 62: Loans — Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 32 (5 backend extensions, 9 hooks, 5 forms/schemas/panels/forms, 7 table + action + page components, 4 detail-page panels, 1 fixtures file, test files × 11)
**Analogs found:** 32 / 32 (100%)

All new files have a strong precedent in Phases 58 (taxonomy), 59 (borrowers CRUD), 60 (items CRUD), and 61 (item photos). Phase 62 is a composition phase — there are **no files with no analog**.

## File Classification

### Backend (plan 62-01)

| File (new or modified) | Role | Data Flow | Closest Analog | Match Quality |
|------------------------|------|-----------|----------------|---------------|
| `backend/internal/domain/warehouse/loan/handler.go` (modify) | controller (huma handler) | request-response | `backend/internal/domain/warehouse/loan/handler.go` (existing `PATCH /loans/{id}/extend` at lines 197–237) | exact |
| `backend/internal/domain/warehouse/loan/service.go` (modify) | service | CRUD | `backend/internal/domain/warehouse/loan/service.go` (existing `ExtendDueDate` lines 145–160) | exact |
| `backend/internal/domain/warehouse/loan/repository.go` (modify) | repository (interface) | CRUD | `backend/internal/domain/warehouse/loan/repository.go` (existing interface lines 11–22) | exact |
| `backend/internal/infra/postgres/loan_repository.go` (modify) | repository (impl) | CRUD | `backend/internal/infra/postgres/loan_repository.go` (existing `Save` lines 30–82) | exact |
| `backend/db/queries/loans.sql` (modify) | data-access (sqlc) | CRUD | same file (existing `ExtendLoanDueDate` lines 16–20, `ListActiveLoansWithDetails` lines 64–77) | exact |
| `backend/internal/domain/warehouse/loan/handler_test.go` (modify) | test | request-response | `backend/internal/domain/warehouse/loan/handler_test.go` (existing `TestLoanHandler_Create`) + `backend/internal/domain/warehouse/item/handler_test.go` (primary-photo decoration tests) | exact |
| `backend/internal/domain/warehouse/loan/service_test.go` (modify) | test | CRUD | `backend/internal/domain/warehouse/loan/service_test.go` (existing `Service_ExtendDueDate_*` tests) | exact |

### Frontend API + Hooks (plan 62-02)

| File (new or modified) | Role | Data Flow | Closest Analog | Match Quality |
|------------------------|------|-----------|----------------|---------------|
| `frontend2/src/lib/api/loans.ts` (modify) | api-client | request-response | `frontend2/src/lib/api/loans.ts` (existing `loansApi` object lines 54–66) + `frontend2/src/lib/api/items.ts` (embedded `primary_photo_thumbnail_url` lines 27–30, 74 for `UpdateItemInput = Partial<...>`) | exact |
| `frontend2/src/features/loans/hooks/useLoansActive.ts` | hook (query) | request-response | `frontend2/src/features/borrowers/hooks/useBorrowersList.ts` + `frontend2/src/features/items/hooks/useItemsList.ts` | role-match |
| `frontend2/src/features/loans/hooks/useLoansOverdue.ts` | hook (query) | request-response | `frontend2/src/features/borrowers/hooks/useBorrowersList.ts` | role-match |
| `frontend2/src/features/loans/hooks/useLoansHistory.ts` | hook (query) | request-response | `frontend2/src/features/items/hooks/useItemsList.ts` (paginated, uses `placeholderData`) | exact |
| `frontend2/src/features/loans/hooks/useLoansForItem.ts` | hook (query) | request-response | `frontend2/src/features/borrowers/hooks/useBorrower.ts` (single-scope GET) | role-match |
| `frontend2/src/features/loans/hooks/useLoansForBorrower.ts` | hook (query) | request-response | `frontend2/src/features/borrowers/hooks/useBorrower.ts` | role-match |
| `frontend2/src/features/loans/hooks/useLoanMutations.ts` | hook (mutations) | request-response | `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` + `frontend2/src/features/items/hooks/useItemMutations.ts` (for `HttpError` branching) | exact |
| `frontend2/src/features/loans/hooks/useLoansTabs.ts` *(optional — wraps taxonomy `useHashTab`)* | hook (state) | event-driven | `frontend2/src/features/taxonomy/hooks/useHashTab.ts` + direct import in `frontend2/src/features/taxonomy/TaxonomyPage.tsx` lines 8–13 | exact |
| `frontend2/src/features/loans/__tests__/useLoanMutations.test.ts` | test | request-response | `frontend2/src/features/items/__tests__/useItemMutations.test.ts` | exact |

### Frontend List Page + Panels + Forms (plan 62-03)

| File (new) | Role | Data Flow | Closest Analog | Match Quality |
|------------|------|-----------|----------------|---------------|
| `frontend2/src/features/loans/LoansListPage.tsx` | component (page) | request-response | `frontend2/src/features/items/ItemsListPage.tsx` (table + filter + pagination + panel) + `frontend2/src/features/taxonomy/TaxonomyPage.tsx` (tabs + `useHashTab`) | exact (composite) |
| `frontend2/src/features/loans/forms/schemas.ts` | utility (zod schemas) | transform | `frontend2/src/features/items/forms/schemas.ts` + `frontend2/src/features/borrowers/forms/schemas.ts` | exact |
| `frontend2/src/features/loans/forms/LoanForm.tsx` | component (form) | request-response | `frontend2/src/features/borrowers/forms/BorrowerForm.tsx` (empty-string coercion, `onDirtyChange`, mode) + `frontend2/src/features/items/forms/ItemForm.tsx` (combobox async search) | exact |
| `frontend2/src/features/loans/panel/LoanPanel.tsx` | component (slide-over) | request-response | `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx` | exact |
| `frontend2/src/features/loans/table/LoansTable.tsx` | component (table) | request-response | `frontend2/src/features/items/ItemsListPage.tsx` columns + rows construction (lines 115–211) | role-match (tab-configurable columns is a new twist) |
| `frontend2/src/features/loans/table/LoanRow.tsx` | component (row cells) | request-response | `frontend2/src/features/items/ItemsListPage.tsx` row cells (lines 127–211) | role-match |
| `frontend2/src/features/loans/table/LoanRowActions.tsx` | component (action cluster) | request-response | `frontend2/src/features/items/ItemsListPage.tsx` action buttons (lines 164–210) | role-match |
| `frontend2/src/features/loans/actions/LoanReturnFlow.tsx` | component (confirm dialog) | request-response | `frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx` (simplify to single-step `variant="soft"`) | role-match |
| `frontend2/src/features/loans/icons.tsx` | utility (icon re-exports) | n/a | `frontend2/src/features/items/icons.tsx` | exact |
| `frontend2/src/features/loans/filters/useLoansListQueryParams.ts` *(optional for `?page=N`)* | hook (URL state) | event-driven | `frontend2/src/features/items/filters/useItemsListQueryParams.ts` | role-match (simpler — only `page`) |
| `frontend2/src/features/loans/__tests__/fixtures.ts` | test utility | n/a | `frontend2/src/features/items/__tests__/fixtures.ts` + `frontend2/src/features/borrowers/__tests__/fixtures.tsx` | exact |
| `frontend2/src/features/loans/__tests__/LoansListPage.test.tsx` | test | request-response | `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx` | exact |
| `frontend2/src/features/loans/__tests__/LoanForm.test.tsx` | test | request-response | `frontend2/src/features/items/__tests__/ItemForm.test.tsx` | exact |
| `frontend2/src/features/loans/__tests__/LoanPanel.test.tsx` | test | request-response | `frontend2/src/features/items/__tests__/ItemPanel.test.tsx` | exact |
| `frontend2/src/features/loans/__tests__/LoanReturnFlow.test.tsx` | test | request-response | `frontend2/src/features/items/__tests__/ItemArchiveDeleteFlow.test.tsx` | exact |
| `frontend2/src/features/loans/LoansPage.tsx` (delete/replace) | component (stub) | n/a | N/A — removing placeholder; `LoansListPage.tsx` replaces it in the route table | n/a |

### Detail-Page Panels (plan 62-04)

| File (new or modified) | Role | Data Flow | Closest Analog | Match Quality |
|------------------------|------|-----------|----------------|---------------|
| `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` | component (panel) | request-response | `frontend2/src/features/items/ItemDetailPage.tsx` PHOTOS section (lines 235–247) + UI-SPEC decorative panel spec | role-match |
| `frontend2/src/features/loans/panels/ItemLoanHistoryPanel.tsx` | component (panel) | request-response | `frontend2/src/features/items/ItemDetailPage.tsx` LOANS placeholder (lines 249–260) | role-match |
| `frontend2/src/features/loans/panels/BorrowerActiveLoansPanel.tsx` | component (panel) | request-response | `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` lines 101–112 (existing placeholder section) | role-match |
| `frontend2/src/features/loans/panels/BorrowerLoanHistoryPanel.tsx` | component (panel) | request-response | `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` lines 114–125 | role-match |
| `frontend2/src/features/items/ItemDetailPage.tsx` (modify) | component (detail page — seam) | request-response | itself (replace placeholder `RetroEmptyState` with panel composition) | exact |
| `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` (modify) | component (detail page — seam) | request-response | itself (replace two placeholders) | exact |
| `frontend2/src/features/loans/__tests__/ItemActiveLoanPanel.test.tsx` | test | request-response | `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` | role-match |
| `frontend2/src/features/loans/__tests__/ItemLoanHistoryPanel.test.tsx` | test | request-response | same | role-match |
| `frontend2/src/features/loans/__tests__/BorrowerActiveLoansPanel.test.tsx` | test | request-response | `frontend2/src/features/borrowers/__tests__/BorrowerDetailPage.test.tsx` | role-match |
| `frontend2/src/features/loans/__tests__/BorrowerLoanHistoryPanel.test.tsx` | test | request-response | same | role-match |

---

## Pattern Assignments

### Backend

#### `backend/internal/domain/warehouse/loan/handler.go` (controller, request-response)

**Analog:** itself — existing `PATCH /loans/{id}/extend` handler (lines 197–237) and `toLoanResponse` helper (lines 285–301).

**Imports pattern** (lines 1–13):
```go
package loan

import (
    "context"
    "time"

    "github.com/danielgtaylor/huma/v2"
    "github.com/google/uuid"

    appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
    "github.com/antti/home-warehouse/go-backend/internal/infra/events"
    "github.com/antti/home-warehouse/go-backend/internal/shared"
)
```

**Auth/workspace-guard pattern** (lines 197–201 — COPY TO EVERY NEW HANDLER):
```go
workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
if !ok {
    return nil, huma.Error401Unauthorized("workspace context required")
}
```

**Core PATCH pattern** (lines 197–237 — the direct template for `PATCH /loans/{id}`):
```go
// Extend due date
huma.Patch(api, "/loans/{id}/extend", func(ctx context.Context, input *ExtendLoanInput) (*ExtendLoanOutput, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok {
        return nil, huma.Error401Unauthorized("workspace context required")
    }

    loan, err := svc.ExtendDueDate(ctx, input.ID, workspaceID, input.Body.NewDueDate)
    if err != nil {
        if err == ErrLoanNotFound {
            return nil, huma.Error404NotFound("loan not found")
        }
        if err == ErrAlreadyReturned {
            return nil, huma.Error400BadRequest("cannot extend due date for returned loan")
        }
        if err == ErrInvalidDueDate {
            return nil, huma.Error400BadRequest("new due date must be after loaned date")
        }
        return nil, huma.Error400BadRequest(err.Error())
    }

    // Publish SSE event
    authUser, _ := appMiddleware.GetAuthUser(ctx)
    if broadcaster != nil && authUser != nil {
        userName := appMiddleware.GetUserDisplayName(ctx)
        broadcaster.Publish(workspaceID, events.Event{
            Type:       "loan.updated",
            EntityID:   loan.ID().String(),
            EntityType: "loan",
            UserID:     authUser.ID,
            Data: map[string]any{
                "id":       loan.ID(),
                "due_date": loan.DueDate(),
                "user_name": userName,
            },
        })
    }

    return &ExtendLoanOutput{Body: toLoanResponse(loan)}, nil
})
```

**Input/Output type pattern** (lines 349–358):
```go
type ExtendLoanInput struct {
    ID   uuid.UUID `path:"id"`
    Body struct {
        NewDueDate time.Time `json:"new_due_date" doc:"New due date for the loan"`
    }
}

type ExtendLoanOutput struct {
    Body LoanResponse
}
```

**Notes-length cap pattern** (adapt from `CreateLoanInput`, lines 326–335):
```go
// Current — MISSING maxLength for Notes. Plan 62-01 MUST add maxLength:"1000".
type CreateLoanInput struct {
    Body struct {
        InventoryID uuid.UUID  `json:"inventory_id" doc:"..."`
        ...
        Notes       *string    `json:"notes,omitempty"`  // <-- add maxLength:"1000"
    }
}
```

**`toLoanResponse` extension pattern** (lines 285–301 — extend with `Item` and `Borrower` embedded structs per D-03/D-04):
```go
// Current shape:
func toLoanResponse(l *Loan) LoanResponse {
    return LoanResponse{
        ID:          l.ID(),
        WorkspaceID: l.WorkspaceID(),
        InventoryID: l.InventoryID(),
        BorrowerID:  l.BorrowerID(),
        Quantity:    l.Quantity(),
        LoanedAt:    l.LoanedAt(),
        DueDate:     l.DueDate(),
        ReturnedAt:  l.ReturnedAt(),
        Notes:       l.Notes(),
        IsActive:    l.IsActive(),
        IsOverdue:   l.IsOverdue(),
        CreatedAt:   l.CreatedAt(),
        UpdatedAt:   l.UpdatedAt(),
    }
}
```
**Follow Phase 61's `toItemResponse(i, primary, photoURLGen)` signature** (`backend/internal/domain/warehouse/item/handler.go` lines 539–576) — extend `toLoanResponse` to accept decoration arguments and set `resp.Item = LoanEmbeddedItem{...}` + `resp.Borrower = LoanEmbeddedBorrower{...}`.

#### `backend/internal/domain/warehouse/loan/service.go` (service, CRUD)

**Analog:** itself — existing `ExtendDueDate` (lines 145–160) is the direct template for `Update`.

**Core pattern** (lines 145–160):
```go
func (s *Service) ExtendDueDate(ctx context.Context, id, workspaceID uuid.UUID, newDueDate time.Time) (*Loan, error) {
    loan, err := s.GetByID(ctx, id, workspaceID)
    if err != nil {
        return nil, err
    }

    if err := loan.ExtendDueDate(newDueDate); err != nil {
        return nil, err
    }

    if err := s.repo.Save(ctx, loan); err != nil {
        return nil, err
    }

    return loan, nil
}
```

**Interface extension** (lines 14–24 — add `Update` method signature):
```go
type ServiceInterface interface {
    Create(ctx context.Context, input CreateInput) (*Loan, error)
    GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error)
    Return(ctx context.Context, id, workspaceID uuid.UUID) (*Loan, error)
    ExtendDueDate(ctx context.Context, id, workspaceID uuid.UUID, newDueDate time.Time) (*Loan, error)
    // NEW (plan 62-01):
    // Update(ctx context.Context, id, workspaceID uuid.UUID, dueDate *time.Time, notes *string) (*Loan, error)
    ...
}
```

#### `backend/internal/domain/warehouse/loan/repository.go` + `backend/internal/infra/postgres/loan_repository.go`

**Analog:** the existing `Save` method in `loan_repository.go` (lines 30–82) already has update-path branches (return, extend). Plan 62-01 can either extend `Save`'s branch detection (check both due_date diff AND notes diff) OR add a dedicated `UpdateLoan` sqlc query and a typed `Update` repo method.

**sqlc query pattern** (`backend/db/queries/loans.sql` lines 16–20 — existing `ExtendLoanDueDate`):
```sql
-- name: ExtendLoanDueDate :one
UPDATE warehouse.loans
SET due_date = $2, updated_at = now()
WHERE id = $1
RETURNING *;
```

**NEW template** (plan 62-01):
```sql
-- name: UpdateLoan :one
UPDATE warehouse.loans
SET due_date = $2, notes = $3, updated_at = now()
WHERE id = $1 AND workspace_id = $4
RETURNING *;
```

#### `backend/internal/domain/warehouse/loan/handler_test.go` (test)

**Analog:** existing `TestLoanHandler_Create` (from `handler_test.go`) and `MockService` setup (lines 19–79).

**Mock setup pattern** (lines 20–22, 24–30):
```go
type MockService struct {
    mock.Mock
}

func (m *MockService) Create(ctx context.Context, input loan.CreateInput) (*loan.Loan, error) {
    args := m.Called(ctx, input)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*loan.Loan), args.Error(1)
}
```

Plan 62-01 adds a `MockService.Update(ctx, id, wsID, dueDate, notes)` method to the same mock.

---

### Frontend

#### `frontend2/src/lib/api/loans.ts` (api-client, request-response)

**Analog:** itself (existing `loansApi` at lines 54–66) + `frontend2/src/lib/api/items.ts` (for the `primary_photo_thumbnail_url` embed pattern and the `UpdateItemInput = Partial<CreateItemInput>` idiom).

**Existing `loansApi` pattern** (lines 54–66):
```typescript
const base = (wsId: string) => `/workspaces/${wsId}/loans`;

export const loansApi = {
  list: (wsId: string, params: LoanListParams = {}) =>
    get<LoanListResponse>(`${base(wsId)}${toQuery(params as Record<string, unknown>)}`),
  listActive: (wsId: string) => get<LoanListResponse>(`${base(wsId)}/active`),
  listOverdue: (wsId: string) => get<LoanListResponse>(`${base(wsId)}/overdue`),
  listForBorrower: (wsId: string, borrowerId: string) =>
    get<LoanListResponse>(`/workspaces/${wsId}/borrowers/${borrowerId}/loans`),
  get: (wsId: string, id: string) => get<Loan>(`${base(wsId)}/${id}`),
  create: (wsId: string, body: CreateLoanInput) => post<Loan>(base(wsId), body),
  extend: (wsId: string, id: string, body: ExtendLoanInput) =>
    patch<Loan>(`${base(wsId)}/${id}/extend`, body),
  return: (wsId: string, id: string) => post<void>(`${base(wsId)}/${id}/return`),
};
```

**Additions (plan 62-02):**
```typescript
// D-02: new method
update: (wsId: string, id: string, body: UpdateLoanInput) =>
  patch<Loan>(`${base(wsId)}/${id}`, body),

// D-05: new method — inventory path uses snake_case segment, matches existing listForBorrower
listForItem: (wsId: string, inventoryId: string) =>
  get<LoanListResponse>(`/workspaces/${wsId}/inventory/${inventoryId}/loans`),
```

**Interface extension pattern** (D-04, inspired by `items.ts` lines 27–30):
```typescript
// Phase 61 precedent — items.ts lines 27–30:
//   primary_photo_thumbnail_url?: string | null;
//   primary_photo_url?: string | null;

export interface LoanEmbeddedItem {
  id: string;
  name: string;
  primary_photo_thumbnail_url?: string | null;
}
export interface LoanEmbeddedBorrower {
  id: string;
  name: string;
}
export interface Loan {
  // ...existing fields unchanged...
  item: LoanEmbeddedItem;
  borrower: LoanEmbeddedBorrower;
}

export interface UpdateLoanInput {
  due_date?: string;
  notes?: string;
}
```

**`loanKeys` extension pattern** (D-06 — copy existing factory shape from lines 68–74):
```typescript
export const loanKeys = {
  all: ["loans"] as const,
  lists: () => [...loanKeys.all, "list"] as const,
  list: (params: LoanListParams) => [...loanKeys.lists(), params] as const,
  details: () => [...loanKeys.all, "detail"] as const,
  detail: (id: string) => [...loanKeys.details(), id] as const,
  // NEW:
  forItem: (inventoryId: string) => [...loanKeys.all, "forItem", inventoryId] as const,
  forBorrower: (borrowerId: string) => [...loanKeys.all, "forBorrower", borrowerId] as const,
};
```

#### `frontend2/src/features/loans/hooks/useLoansActive.ts` (hook, request-response)

**Analog:** `frontend2/src/features/borrowers/hooks/useBorrowersList.ts` (single-page fetch, returns items shortcut).

**Imports pattern** (lines 1–8):
```typescript
import { useQuery } from "@tanstack/react-query";
import {
  borrowersApi,
  borrowerKeys,
  type Borrower,
  type BorrowerListParams,
} from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";
```

**Core query pattern** (lines 19–33):
```typescript
export function useBorrowersList(showArchived: boolean) {
  const { workspaceId } = useAuth();
  const params: BorrowerListParams = {
    page: 1,
    limit: 100,
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

#### `frontend2/src/features/loans/hooks/useLoansHistory.ts` (hook, paginated)

**Analog:** `frontend2/src/features/items/hooks/useItemsList.ts` — uses v5 `placeholderData: (prev) => prev`.

**Full pattern** (lines 17–25):
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

**Pitfall 6 anchor:** Do NOT use `keepPreviousData: true` (TanStack Query v4 idiom) — use `placeholderData: (prev) => prev`.

#### `frontend2/src/features/loans/hooks/useLoanMutations.ts` (hook, mutations)

**Analog:** `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` for the base, plus `frontend2/src/features/items/hooks/useItemMutations.ts` for `HttpError` status branching.

**Imports pattern** (`useBorrowerMutations.ts` lines 1–12):
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

**Create mutation pattern** (`useBorrowerMutations.ts` lines 14–28):
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

**Multi-key invalidation pattern** — for `useCreateLoan` and `useReturnLoan`, cross-feature invalidation mirrors `itemKeys.detail(id)` + `borrowerKeys.detail(id)` per UI-SPEC invalidation table:
```typescript
// Plan 62-02 extension (NEW — per UI-SPEC Interaction Contracts):
onSuccess: (loan) => {
  qc.invalidateQueries({ queryKey: loanKeys.all });
  qc.invalidateQueries({ queryKey: itemKeys.detail(loan.inventory_id) });
  qc.invalidateQueries({ queryKey: borrowerKeys.detail(loan.borrower_id) });
  qc.invalidateQueries({ queryKey: itemKeys.lists() });
  qc.invalidateQueries({ queryKey: borrowerKeys.lists() });
  addToast(t`Loan created.`, "success");
},
```

**`HttpError` branching pattern** (`useItemMutations.ts` lines 25–30, 43–52):
```typescript
function isSkuCollision(err: unknown): boolean {
  if (!(err instanceof HttpError)) return false;
  if (err.status !== 400) return false;
  return err.message.toLowerCase().includes("sku");
}

// in onError:
onError: (err) => {
  if (isSkuCollision(err)) {
    addToast(t`That SKU is already in use. ...`, "error");
    return;
  }
  addToast(t`Could not save item. Check your connection and try again.`, "error");
},
```
For loans, the 400 branch matters for inventory already-on-loan / inventory-not-available errors at create time.

#### `frontend2/src/features/loans/hooks/useLoansTabs.ts` (hook, event-driven — OPTIONAL wrapper)

**Analog:** `frontend2/src/features/taxonomy/hooks/useHashTab.ts` — directly importable.

**Full pattern** (lines 13–41):
```typescript
export function useHashTab<T extends string>(
  defaultTab: T,
  valid: readonly T[],
): [T, (k: T) => void] {
  const read = useCallback((): T => {
    if (typeof window === "undefined") return defaultTab;
    const h = window.location.hash.slice(1) as T;
    return (valid as readonly string[]).includes(h) ? h : defaultTab;
  }, [defaultTab, valid]);

  const [tab, setTab] = useState<T>(read);

  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [read]);

  const change = useCallback(
    (k: T) => {
      if (!(valid as readonly string[]).includes(k)) return;
      window.history.replaceState(null, "", `#${k}`);
      setTab(k);
    },
    [valid],
  );

  return [tab, change];
}
```

**Recommendation (per RESEARCH §Pattern 3):** Import directly from `@/features/taxonomy/hooks/useHashTab` — no wrapper needed. Only wrap if a Phase 62-specific concern emerges (e.g., tab-aware page reset — but that's orthogonal URL state, not hash state).

#### `frontend2/src/features/loans/LoansListPage.tsx` (component, composite)

**Analogs (dual template):**
- `frontend2/src/features/taxonomy/TaxonomyPage.tsx` — tabs + `useHashTab` skeleton
- `frontend2/src/features/items/ItemsListPage.tsx` — page chrome (header + new button + loading + error + empty + table + pagination + panel + confirm flow)

**Tabs skeleton pattern** (`TaxonomyPage.tsx` full file):
```tsx
import { useLingui } from "@lingui/react/macro";
import { RetroTabs } from "@/components/retro";
import { useHashTab } from "./hooks/useHashTab";

const TAB_KEYS = ["categories", "locations", "containers"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function TaxonomyPage() {
  const { t } = useLingui();
  const [tab, setTab] = useHashTab<TabKey>("categories", TAB_KEYS);

  return (
    <div className="flex flex-col gap-lg p-lg">
      <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-ink">
        {t`TAXONOMY`}
      </h1>
      <RetroTabs
        tabs={[
          { key: "categories", label: t`CATEGORIES` },
          { key: "locations", label: t`LOCATIONS` },
          { key: "containers", label: t`CONTAINERS` },
        ]}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
      />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "categories" && <CategoriesTab />}
        {tab === "locations" && <LocationsTab />}
        {tab === "containers" && <ContainersTab />}
      </div>
    </div>
  );
}
```

**Page chrome pattern** (`ItemsListPage.tsx` lines 213–333):
```tsx
return (
  <div className="flex flex-col gap-lg p-lg min-w-0">
    <div className="flex items-center justify-between gap-md flex-wrap">
      <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-cream">
        {t`ITEMS`}
      </h1>
      <RetroButton variant="primary" onClick={handleNew}>
        {t`+ NEW ITEM`}
      </RetroButton>
    </div>

    <ItemsFilterBar ... />

    {workspaceId && itemsQuery.isPending && (
      <RetroPanel>
        <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
      </RetroPanel>
    )}

    {workspaceId && itemsQuery.isError && (
      <RetroPanel>
        <HazardStripe className="mb-md" />
        <h2>{t`COULD NOT LOAD ITEMS`}</h2>
        <p>{t`Check your connection and try again.`}</p>
        <RetroButton variant="primary" onClick={() => itemsQuery.refetch()}>
          {t`RETRY`}
        </RetroButton>
      </RetroPanel>
    )}

    {workspaceId && itemsQuery.isSuccess && total === 0 && (
      <RetroEmptyState title={...} body={...} action={...} />
    )}

    {workspaceId && itemsQuery.isSuccess && items.length > 0 && (
      <>
        <RetroPanel>
          <RetroTable columns={columns} data={rows} />
        </RetroPanel>
        <RetroPagination
          page={ui.page}
          pageSize={PAGE_SIZE}
          totalCount={total}
          onChange={(p) => updateUi({ page: p })}
        />
      </>
    )}

    <ItemPanel ref={panelRef} />
    <ItemArchiveDeleteFlow ref={archiveFlowRef} ... />
  </div>
);
```

**Tab-label-with-count pattern** (UI-SPEC D-07 — Phase 62 new):
```tsx
const label = (base: string, n: number | undefined) =>
  n === undefined ? `${base} · …` : `${base} · ${n}`;
// ...
tabs={[
  { key: "active", label: label(t`ACTIVE`, activeQuery.data?.items.length) },
  { key: "overdue", label: label(t`OVERDUE`, overdueQuery.data?.items.length) },
  { key: "history", label: label(t`HISTORY`, historyQuery.data?.items.length) },
]}
```

#### `frontend2/src/features/loans/forms/schemas.ts` (utility, transform)

**Analog:** `frontend2/src/features/items/forms/schemas.ts` + `frontend2/src/features/borrowers/forms/schemas.ts`.

**Required + optional pattern** (`items/forms/schemas.ts` lines 21–47):
```typescript
export const itemCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(200, "Must be 200 characters or fewer."),
  sku: z.string().min(1, "SKU is required.").max(64, "..."),
  barcode: z
    .string()
    .max(64, "...")
    .regex(/^[A-Za-z0-9]+$/, "...")
    .optional()
    .or(z.literal("")),
  description: z.string().max(2000, "...").optional().or(z.literal("")),
  category_id: z.string().uuid("Pick a category from the list.").optional().or(z.literal("")),
});
```

**Loan-specific extension:**
```typescript
export const loanCreateSchema = z.object({
  inventory_id: z.string().uuid("Pick an item."),
  borrower_id: z.string().uuid("Pick a borrower."),
  quantity: z.coerce.number().int("Whole units only.").min(1).max(999),
  loaned_at: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000, "...").optional().or(z.literal("")),
});

export const loanEditSchema = z.object({
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000, "...").optional().or(z.literal("")),
});
```

#### `frontend2/src/features/loans/forms/LoanForm.tsx` (component, form)

**Analog:** `frontend2/src/features/borrowers/forms/BorrowerForm.tsx` (empty-string coercion, `onDirtyChange`, `mode: "onSubmit"`).

**Empty-string coercion resolver** (lines 17–28):
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

**Dirty-state bubbling pattern** (lines 55–57):
```typescript
useEffect(() => {
  onDirtyChange?.(formState.isDirty);
}, [formState.isDirty, onDirtyChange]);
```

**Form layout pattern** (lines 69–87):
```tsx
return (
  <form id={formId} onSubmit={submit} className="flex flex-col gap-md">
    <RetroFormField name="name" control={control} label={t`NAME`}>
      <RetroInput autoFocus placeholder={t`e.g. Alice Smith`} />
    </RetroFormField>
    <RetroFormField name="notes" control={control} label={t`NOTES`}>
      <RetroTextarea rows={4} placeholder={t`...`} />
    </RetroFormField>
  </form>
);
```

**Submit coercion pattern** (lines 59–67):
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

**Create-vs-edit mode branch** — for `LoanForm`, follow `ItemPanel.tsx` lines 84–95 (render different `defaultValues` structure per mode). Use `mode: "create" | "edit"` prop to gate the locked-details block in edit mode.

#### `frontend2/src/features/loans/panel/LoanPanel.tsx` (component, slide-over)

**Analog:** `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx` — direct template (81 lines, near-identical in shape).

**Full pattern** (`BorrowerPanel.tsx` lines 1–123):
```tsx
import {
  forwardRef,
  useCallback,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroButton } from "@/components/retro";
import {
  SlideOverPanel,
  type SlideOverPanelHandle,
} from "@/features/taxonomy/panel/SlideOverPanel";
import { BorrowerForm } from "../forms/BorrowerForm";
import { useCreateBorrower, useUpdateBorrower } from "../hooks/useBorrowerMutations";
import type { BorrowerCreateValues } from "../forms/schemas";
import type { Borrower } from "@/lib/api/borrowers";

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

    const closePanel = useCallback(() => {
      panelRef.current?.closeImmediate();
    }, []);

    const isPending = createMutation.isPending || updateMutation.isPending;
    const title = mode === "create" ? t`NEW BORROWER` : t`EDIT BORROWER`;
    const submitLabel = isPending
      ? t`WORKING…`
      : mode === "create"
        ? t`CREATE BORROWER`
        : t`SAVE BORROWER`;

    const onSubmit = async (values: BorrowerCreateValues) => {
      if (mode === "create") {
        await createMutation.mutateAsync(values);
      } else if (borrower) {
        await updateMutation.mutateAsync({ id: borrower.id, input: values });
      }
      closePanel();
    };

    const defaultValues: Partial<BorrowerCreateValues> | undefined =
      mode === "edit" && borrower
        ? { name: borrower.name, email: borrower.email ?? "", ... }
        : undefined;

    return (
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
    );
  },
);
```

**Note:** For LoanPanel, plan 62-03 must guard against edit-mode losing data on submit error (`ItemPanel.tsx` lines 70–82 show the try/catch-swallow pattern):
```tsx
const onSubmit = async (values) => {
  try {
    if (mode === "create") await createMutation.mutateAsync(values);
    else if (item) await updateMutation.mutateAsync({ id: item.id, input: values });
    closePanel();
  } catch {
    // Keep panel open on error — toast fires from mutation hook
  }
};
```

#### `frontend2/src/features/loans/table/LoansTable.tsx` (component, table)

**Analog:** `frontend2/src/features/items/ItemsListPage.tsx` lines 115–212 — tab-configurable columns is a new twist.

**Column/row-construction pattern** (`ItemsListPage.tsx` lines 115–211):
```tsx
const columns = [
  {
    key: "thumb",
    header: <span className="sr-only">{t`Thumbnail`}</span>,
    className: "w-14",
  },
  { key: "name", header: t`NAME` },
  { key: "sku", header: t`SKU` },
  { key: "category", header: t`CATEGORY` },
  { key: "actions", header: t`ACTIONS`, className: "text-right" },
];

const rows = items.map((item) => ({
  thumb: <ItemThumbnailCell thumbnailUrl={item.primary_photo_thumbnail_url} dimmed={item.is_archived ?? false} />,
  name: <Link to={`/items/${item.id}`} ...>{item.name}</Link>,
  sku: item.sku,
  category: ...,
  actions: (<div className="flex items-center gap-xs justify-end">...</div>),
}));
```

**Tab-variant column configuration** (Pitfall 7 — per UI-SPEC: drop `ACTIONS` column from `columns` on History tab; swap `DUE` for `RETURNED`):
```tsx
const columns = tab === "history"
  ? [{ key: "thumb", ... }, { key: "item" }, { key: "borrower" }, { key: "qty" }, { key: "loaned" }, { key: "returned" }]
  : [{ key: "thumb", ... }, { key: "item" }, { key: "borrower" }, { key: "qty" }, { key: "loaned" }, { key: "due" }, { key: "actions" }];
```

**Thumbnail cell import:**
```typescript
import { ItemThumbnailCell } from "@/features/items/photos/ItemThumbnailCell";
```
Full component already exists (`frontend2/src/features/items/photos/ItemThumbnailCell.tsx`) — pass `loan.item.primary_photo_thumbnail_url` as `thumbnailUrl`.

#### `frontend2/src/features/loans/actions/LoanReturnFlow.tsx` (component, confirm dialog)

**Analog:** `frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx` — simplify to single-step.

**`forwardRef` + imperative handle** (lines 32–46):
```tsx
export const ItemArchiveDeleteFlow = forwardRef<
  ItemArchiveDeleteFlowHandle,
  ItemArchiveDeleteFlowProps
>(function ItemArchiveDeleteFlow({ nodeName, onArchive, onDelete }, ref) {
  const { t } = useLingui();
  const archiveRef = useRef<RetroConfirmDialogHandle>(null);
  ...
  useImperativeHandle(ref, () => ({
    open: () => archiveRef.current?.open(),
    close: () => archiveRef.current?.close(),
  }));
  ...
});
```

**Confirm handler pattern** (lines 48–55):
```tsx
const handleArchive = async () => {
  try {
    await onArchive();
    archiveRef.current?.close();
  } catch {
    // mutation hook already emits a toast; keep dialog open for retry
  }
};
```

**`RetroConfirmDialog` soft variant** (lines 78–91 — single dialog, amber):
```tsx
<RetroConfirmDialog
  ref={archiveRef}
  variant="soft"                      // amber, no hazard stripe
  title={t`ARCHIVE ITEM`}              // → t`CONFIRM RETURN`
  body={t`This will hide ${nodeName}...`}
  headerBadge={t`HIDES FROM DEFAULT VIEW`}  // → omit for return flow
  escapeLabel={t`← BACK`}
  destructiveLabel={t`ARCHIVE ITEM`}   // → t`MARK RETURNED`
  onConfirm={handleArchive}
/>
```

**No second dialog, no `switchToDelete` helper** — `LoanReturnFlow` is single-step (per CONTEXT.md spec).

#### `frontend2/src/features/loans/__tests__/fixtures.ts` (test utility)

**Analog:** `frontend2/src/features/items/__tests__/fixtures.ts` + `frontend2/src/features/borrowers/__tests__/fixtures.tsx`.

**Re-export pattern** (`items/__tests__/fixtures.ts` lines 9–13):
```typescript
export {
  TestAuthContext,
  renderWithProviders,
  setupDialogMocks,
} from "@/features/taxonomy/__tests__/fixtures";
```

**Factory pattern** (`items/__tests__/fixtures.ts` lines 25–54):
```typescript
export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: overrides.id ?? "55555555-5555-5555-5555-555555555555",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    sku: overrides.sku ?? "ITEM-TEST-0001",
    name: overrides.name ?? "Test Item",
    ...
    ...overrides,
  };
}
```

**`makeLoan` factory template** (plan 62-03 new):
```typescript
export function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: overrides.id ?? "66666666-6666-6666-6666-666666666666",
    workspace_id: overrides.workspace_id ?? DEFAULT_WORKSPACE_ID,
    inventory_id: "11111111-...",
    borrower_id: "44444444-...",
    quantity: 1,
    loaned_at: NOW,
    due_date: null,
    returned_at: null,
    notes: null,
    is_active: true,
    is_overdue: false,
    created_at: NOW,
    updated_at: NOW,
    item: { id: "11111111-...", name: "Test Item", primary_photo_thumbnail_url: null },
    borrower: { id: "44444444-...", name: "Alice Example" },
    ...overrides,
  };
}
```

---

### Detail-page panels (plan 62-04)

#### `frontend2/src/features/loans/panels/ItemActiveLoanPanel.tsx` / `ItemLoanHistoryPanel.tsx`

**Seam analog:** `frontend2/src/features/items/ItemDetailPage.tsx` lines 249–260 (current placeholder):
```tsx
<section aria-labelledby="loans-h2">
  <h2 id="loans-h2" className="text-[20px] font-bold uppercase text-retro-ink mb-md">
    {t`LOANS`}
  </h2>
  <RetroEmptyState
    title={t`NO LOANS`}
    body={t`Loan history will appear here once loans are wired.`}
  />
</section>
```

**Replacement pattern (plan 62-04):**
```tsx
<section aria-labelledby="loans-h2">
  <h2 id="loans-h2" className="text-[20px] font-bold uppercase text-retro-ink mb-md">
    {t`LOANS`}
  </h2>
  <ItemActiveLoanPanel itemId={item.id} />
  <ItemLoanHistoryPanel itemId={item.id} />
</section>
```

**Content pattern:** Panels use `useLoansForItem(item.id)` and partition the result client-side (per CONTEXT.md D-05):
```tsx
export function ItemActiveLoanPanel({ itemId }: { itemId: string }) {
  const { data, isPending, isError } = useLoansForItem(itemId);
  const activeLoan = data?.items.find((l) => l.is_active) ?? null;
  // render RetroPanel with loan details OR RetroEmptyState
}
```

Loading/error pattern follows `BorrowerDetailPage.tsx` lines 17–44 (`RetroPanel` with `{t`Loading…`}` + HazardStripe on error).

#### `frontend2/src/features/loans/panels/BorrowerActiveLoansPanel.tsx` / `BorrowerLoanHistoryPanel.tsx`

**Seam analog:** `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` lines 101–125 — two placeholder sections already in place:
```tsx
<section aria-labelledby="active-loans-h2">
  <h2 id="active-loans-h2" ...>{t`ACTIVE LOANS`}</h2>
  <RetroEmptyState title={t`NO ACTIVE LOANS`} body={t`Loan data will be available soon.`} />
</section>

<section aria-labelledby="loan-history-h2">
  <h2 id="loan-history-h2" ...>{t`LOAN HISTORY`}</h2>
  <RetroEmptyState title={t`NO LOAN HISTORY`} body={t`Loan history will appear here once loans are wired.`} />
</section>
```

**Replacement:** Substitute `RetroEmptyState` blocks with `<BorrowerActiveLoansPanel borrowerId={b.id} />` and `<BorrowerLoanHistoryPanel borrowerId={b.id} />`. Both hook into `useLoansForBorrower(borrowerId)` (plan 62-02) and partition by `is_active`.

---

## Shared Patterns

### Authentication / Workspace Scoping (backend)

**Source:** `backend/internal/domain/warehouse/loan/handler.go` lines 19–22, 44–47, 66–69, 86–89, 103–106, 160–163, 198–201, 241–244, 264–267 — **every handler starts with this guard**.

**Apply to:** all new handlers in plan 62-01 (`PATCH /loans/{id}`).
```go
workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
if !ok {
    return nil, huma.Error401Unauthorized("workspace context required")
}
```

### Authentication / Workspace Scoping (frontend)

**Source:** Every existing hook (e.g., `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` line 15).

**Apply to:** every new hook in plan 62-02.
```typescript
const { workspaceId } = useAuth();
// Use workspaceId! (with the non-null assertion) guarded by `enabled: !!workspaceId` on queries
// or directly as an argument to api methods in mutationFn.
```
**Never pass `workspaceId` as a prop.**

### Error Handling (backend handler → specific Huma error)

**Source:** `backend/internal/domain/warehouse/loan/handler.go` lines 204–214 (existing `ExtendDueDate` handler).

**Apply to:** the new `PATCH /loans/{id}` handler. Map domain errors to Huma errors:
```go
if err == ErrLoanNotFound {
    return nil, huma.Error404NotFound("loan not found")
}
if err == ErrAlreadyReturned {
    return nil, huma.Error400BadRequest("cannot edit returned loan")
}
if err == ErrInvalidDueDate {
    return nil, huma.Error400BadRequest("due date must be after loaned date")
}
return nil, huma.Error400BadRequest(err.Error())
```

### Error Handling (frontend mutations)

**Source:** `frontend2/src/features/items/hooks/useItemMutations.ts` lines 25–30 + `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` lines 94–104.

**Apply to:** `useCreateLoan`, `useUpdateLoan`, `useReturnLoan` in plan 62-02. Branch on `err instanceof HttpError && err.status === 400` for specific 400 sub-cases (e.g., inventory-not-available on create, return-of-already-returned on return).

### Validation (zod schema + empty-string coercion)

**Source:** `frontend2/src/features/borrowers/forms/BorrowerForm.tsx` lines 18–28 + `frontend2/src/features/items/forms/ItemForm.tsx` lines 27–37.

**Apply to:** `LoanForm` in plan 62-03. The resolver wrapper pattern + the submit-time coercion both fire — belt-and-suspenders ensures zero empty-string values in the API payload.

### SSE Event Publishing (backend)

**Source:** `backend/internal/domain/warehouse/loan/handler.go` lines 135–151 (create), 176–189 (return), 217–232 (extend).

**Apply to:** the new `PATCH /loans/{id}` handler. Publish a `"loan.updated"` event with `id`, `due_date`, `notes`, and `user_name` in the `Data` map:
```go
authUser, _ := appMiddleware.GetAuthUser(ctx)
if broadcaster != nil && authUser != nil {
    userName := appMiddleware.GetUserDisplayName(ctx)
    broadcaster.Publish(workspaceID, events.Event{
        Type:       "loan.updated",
        EntityID:   loan.ID().String(),
        EntityType: "loan",
        UserID:     authUser.ID,
        Data: map[string]any{
            "id":        loan.ID(),
            "due_date":  loan.DueDate(),
            "notes":     loan.Notes(),
            "user_name": userName,
        },
    })
}
```

### Query-Key Factory

**Source:** `frontend2/src/lib/api/borrowers.ts` lines 61–67 + `frontend2/src/lib/api/loans.ts` lines 68–74.

**Apply to:** the `loanKeys` extension in plan 62-02 (adding `forItem` and `forBorrower`). Factory shape is `all → lists() → list(params) / details() → detail(id)`.

### Toast + Lingui

**Source:** every mutation hook in `useBorrowerMutations.ts` / `useItemMutations.ts`.

**Apply to:** all mutations in plan 62-02.
```typescript
const { addToast } = useToast();
const { t } = useLingui();
// ...
addToast(t`Loan created.`, "success");
addToast(t`Could not create loan. Check your connection and try again.`, "error");
```

### Route Registration

**Source:** `frontend2/src/routes/index.tsx` lines 10, 84 (existing `LoansPage` route).

**Apply to:** plan 62-03 — replace `LoansPage` import with `LoansListPage` and keep the same route path:
```tsx
import { LoansListPage } from "@/features/loans/LoansListPage";
// ...
<Route path="loans" element={<LoansListPage />} />
```

---

## No Analog Found

**None.** Every file in Phase 62 has a clear, verified precedent in Phase 58/59/60/61.

The only "new-shaped" things are:
1. **Tab-configurable column arrays** in `LoansTable` — but the column/row construction itself is directly from `ItemsListPage.tsx` lines 115–211; only the tab-switch wrapping is new.
2. **Cross-feature cache invalidation** (`loanKeys.all` + `itemKeys.detail` + `borrowerKeys.detail`) — but the mutation-hook shell is from `useBorrowerMutations.ts`; only the invalidation set is expanded per UI-SPEC.
3. **Embedded-decoration response** (`item` + `borrower` on `LoanResponse`) — but Phase 61 (`ItemResponse.PrimaryPhotoThumbnailURL`, `lookupPrimaryPhotos`, `toItemResponse(i, primary, photoURLGen)`) is the exact precedent.

No pattern is being invented in Phase 62.

---

## Metadata

**Analog search scope:**
- `backend/internal/domain/warehouse/loan/` (handler, service, repository, entity, errors, tests)
- `backend/internal/domain/warehouse/item/` (handler lines 46–180, 520–576 — Phase 61 decoration pattern)
- `backend/internal/infra/postgres/loan_repository.go`
- `backend/db/queries/loans.sql`
- `backend/internal/api/router.go` (registration wiring)
- `frontend2/src/lib/api/loans.ts`, `items.ts`, `borrowers.ts`
- `frontend2/src/features/loans/` (existing `LoansPage` placeholder)
- `frontend2/src/features/borrowers/` (all 15 files — direct template)
- `frontend2/src/features/items/` (all 40 files — direct template)
- `frontend2/src/features/taxonomy/` (panel/SlideOverPanel, hooks/useHashTab, TaxonomyPage)
- `frontend2/src/routes/index.tsx` (route registration)

**Files scanned:** 32 source files + 12 test files + 4 schema/query files + 1 route file = 49 files read or searched.

**Pattern extraction date:** 2026-04-17

**Validity:** 30 days (pattern freshness aligns with RESEARCH.md's Phase 58–61 references).
