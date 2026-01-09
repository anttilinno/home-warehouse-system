# Domain-Driven Design + Test-Driven Development
## Go REST API with Huma + Chi + sqlc

This document describes how to combine DDD (organize by business domain) with TDD (tests first, code second) for building REST APIs.

---

## Core Principles

### DDD: Organize by Domain, Not Layer

**Traditional (layer-first):**
```
internal/
├── handlers/      # All handlers
├── services/      # All services
├── repositories/  # All repositories
└── models/        # All models
```

**DDD (domain-first):**
```
internal/
├── domain/
│   ├── item/          # Everything about items
│   ├── inventory/     # Everything about inventory
│   ├── loan/          # Everything about loans
│   └── location/      # Everything about locations
└── shared/            # Cross-cutting concerns
```

### TDD: Red → Green → Refactor

```
1. RED:      Write a failing test for desired behavior
2. GREEN:    Write minimal code to make it pass
3. REFACTOR: Clean up while keeping tests green
```

---

## Project Structure (DDD)

```
myapp/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── domain/
│   │   ├── item/
│   │   │   ├── entity.go          # Item entity + value objects
│   │   │   ├── repository.go      # Repository interface
│   │   │   ├── service.go         # Domain/business logic
│   │   │   ├── service_test.go    # Service tests (TDD)
│   │   │   ├── handler.go         # HTTP handlers
│   │   │   ├── handler_test.go    # Handler tests (TDD)
│   │   │   └── errors.go          # Domain-specific errors
│   │   │
│   │   ├── inventory/
│   │   │   ├── entity.go
│   │   │   ├── repository.go
│   │   │   ├── service.go
│   │   │   ├── service_test.go
│   │   │   ├── handler.go
│   │   │   └── handler_test.go
│   │   │
│   │   ├── loan/
│   │   │   ├── entity.go
│   │   │   ├── aggregate.go       # Loan aggregate root
│   │   │   ├── repository.go
│   │   │   ├── service.go
│   │   │   ├── service_test.go
│   │   │   ├── handler.go
│   │   │   └── handler_test.go
│   │   │
│   │   └── location/
│   │       └── ...
│   │
│   ├── shared/
│   │   ├── uuid.go                # Shared value objects
│   │   ├── pagination.go
│   │   └── errors.go
│   │
│   ├── infra/
│   │   ├── postgres/
│   │   │   ├── item_repo.go       # Repository implementations
│   │   │   ├── inventory_repo.go
│   │   │   └── loan_repo.go
│   │   └── queries/               # sqlc generated (don't edit)
│   │
│   └── api/
│       ├── router.go              # Wires everything together
│       └── middleware/
│
├── db/
│   ├── migrations/
│   └── queries/
│
└── tests/
    └── integration/               # Full integration tests
```

---

## Domain Layer

### Entity

```go
// internal/domain/item/entity.go
package item

import (
    "time"
    "github.com/google/uuid"
)

// Entity - has identity, mutable
type Item struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    name        string
    description *string
    categoryID  *uuid.UUID
    isArchived  bool
    createdAt   time.Time
    updatedAt   time.Time
}

// Constructor - enforces invariants
func NewItem(workspaceID uuid.UUID, name string) (*Item, error) {
    if name == "" {
        return nil, ErrNameRequired
    }
    if len(name) > 200 {
        return nil, ErrNameTooLong
    }
    
    now := time.Now()
    return &Item{
        id:          uuid.New(),
        workspaceID: workspaceID,
        name:        name,
        isArchived:  false,
        createdAt:   now,
        updatedAt:   now,
    }, nil
}

// Reconstitute from database (no validation, trusted source)
func Reconstitute(
    id, workspaceID uuid.UUID,
    name string,
    description *string,
    categoryID *uuid.UUID,
    isArchived bool,
    createdAt, updatedAt time.Time,
) *Item {
    return &Item{
        id:          id,
        workspaceID: workspaceID,
        name:        name,
        description: description,
        categoryID:  categoryID,
        isArchived:  isArchived,
        createdAt:   createdAt,
        updatedAt:   updatedAt,
    }
}

// Getters (immutable access)
func (i *Item) ID() uuid.UUID          { return i.id }
func (i *Item) WorkspaceID() uuid.UUID { return i.workspaceID }
func (i *Item) Name() string           { return i.name }
func (i *Item) Description() *string   { return i.description }
func (i *Item) IsArchived() bool       { return i.isArchived }

// Behavior methods (domain logic lives here)
func (i *Item) Rename(name string) error {
    if name == "" {
        return ErrNameRequired
    }
    if len(name) > 200 {
        return ErrNameTooLong
    }
    i.name = name
    i.updatedAt = time.Now()
    return nil
}

func (i *Item) SetDescription(desc *string) {
    i.description = desc
    i.updatedAt = time.Now()
}

func (i *Item) Archive() {
    i.isArchived = true
    i.updatedAt = time.Now()
}

func (i *Item) Restore() {
    i.isArchived = false
    i.updatedAt = time.Now()
}
```

### Domain Errors

```go
// internal/domain/item/errors.go
package item

import "errors"

var (
    ErrNameRequired = errors.New("item name is required")
    ErrNameTooLong  = errors.New("item name exceeds 200 characters")
    ErrNotFound     = errors.New("item not found")
    ErrArchived     = errors.New("item is archived")
)
```

### Repository Interface

```go
// internal/domain/item/repository.go
package item

import (
    "context"
    "github.com/google/uuid"
)

// Repository - interface defined in domain, implemented in infra
type Repository interface {
    Save(ctx context.Context, item *Item) error
    FindByID(ctx context.Context, workspaceID, id uuid.UUID) (*Item, error)
    FindAll(ctx context.Context, workspaceID uuid.UUID, opts FindOptions) ([]*Item, error)
    Delete(ctx context.Context, workspaceID, id uuid.UUID) error
}

type FindOptions struct {
    IncludeArchived bool
    Limit           int
    Offset          int
    Search          *string
}
```

### Service (Application Layer)

```go
// internal/domain/item/service.go
package item

import (
    "context"
    "github.com/google/uuid"
)

type Service struct {
    repo Repository
}

func NewService(repo Repository) *Service {
    return &Service{repo: repo}
}

// Commands (write operations)

type CreateItemCommand struct {
    WorkspaceID uuid.UUID
    Name        string
    Description *string
}

func (s *Service) Create(ctx context.Context, cmd CreateItemCommand) (*Item, error) {
    item, err := NewItem(cmd.WorkspaceID, cmd.Name)
    if err != nil {
        return nil, err
    }
    
    if cmd.Description != nil {
        item.SetDescription(cmd.Description)
    }
    
    if err := s.repo.Save(ctx, item); err != nil {
        return nil, err
    }
    
    return item, nil
}

type RenameItemCommand struct {
    WorkspaceID uuid.UUID
    ItemID      uuid.UUID
    Name        string
}

func (s *Service) Rename(ctx context.Context, cmd RenameItemCommand) (*Item, error) {
    item, err := s.repo.FindByID(ctx, cmd.WorkspaceID, cmd.ItemID)
    if err != nil {
        return nil, err
    }
    if item == nil {
        return nil, ErrNotFound
    }
    if item.IsArchived() {
        return nil, ErrArchived
    }
    
    if err := item.Rename(cmd.Name); err != nil {
        return nil, err
    }
    
    if err := s.repo.Save(ctx, item); err != nil {
        return nil, err
    }
    
    return item, nil
}

func (s *Service) Archive(ctx context.Context, workspaceID, itemID uuid.UUID) error {
    item, err := s.repo.FindByID(ctx, workspaceID, itemID)
    if err != nil {
        return err
    }
    if item == nil {
        return ErrNotFound
    }
    
    item.Archive()
    return s.repo.Save(ctx, item)
}

// Queries (read operations)

func (s *Service) GetByID(ctx context.Context, workspaceID, itemID uuid.UUID) (*Item, error) {
    item, err := s.repo.FindByID(ctx, workspaceID, itemID)
    if err != nil {
        return nil, err
    }
    if item == nil {
        return nil, ErrNotFound
    }
    return item, nil
}

func (s *Service) List(ctx context.Context, workspaceID uuid.UUID, opts FindOptions) ([]*Item, error) {
    return s.repo.FindAll(ctx, workspaceID, opts)
}
```

---

## TDD Workflow

### Step 1: Write Failing Test First

```go
// internal/domain/item/service_test.go
package item_test

import (
    "context"
    "testing"
    
    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/yourusername/myapp/internal/domain/item"
)

// Mock repository for unit tests
type mockRepo struct {
    items map[uuid.UUID]*item.Item
}

func newMockRepo() *mockRepo {
    return &mockRepo{items: make(map[uuid.UUID]*item.Item)}
}

func (m *mockRepo) Save(ctx context.Context, i *item.Item) error {
    m.items[i.ID()] = i
    return nil
}

func (m *mockRepo) FindByID(ctx context.Context, workspaceID, id uuid.UUID) (*item.Item, error) {
    i, ok := m.items[id]
    if !ok || i.WorkspaceID() != workspaceID {
        return nil, nil
    }
    return i, nil
}

func (m *mockRepo) FindAll(ctx context.Context, workspaceID uuid.UUID, opts item.FindOptions) ([]*item.Item, error) {
    var result []*item.Item
    for _, i := range m.items {
        if i.WorkspaceID() == workspaceID {
            if !opts.IncludeArchived && i.IsArchived() {
                continue
            }
            result = append(result, i)
        }
    }
    return result, nil
}

func (m *mockRepo) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
    delete(m.items, id)
    return nil
}

// Tests written FIRST (TDD)

func TestCreateItem_Success(t *testing.T) {
    // Arrange
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    workspaceID := uuid.New()
    
    // Act
    created, err := svc.Create(ctx, item.CreateItemCommand{
        WorkspaceID: workspaceID,
        Name:        "Hammer",
    })
    
    // Assert
    require.NoError(t, err)
    assert.Equal(t, "Hammer", created.Name())
    assert.Equal(t, workspaceID, created.WorkspaceID())
    assert.False(t, created.IsArchived())
}

func TestCreateItem_EmptyName_Fails(t *testing.T) {
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    
    _, err := svc.Create(ctx, item.CreateItemCommand{
        WorkspaceID: uuid.New(),
        Name:        "",
    })
    
    assert.ErrorIs(t, err, item.ErrNameRequired)
}

func TestCreateItem_NameTooLong_Fails(t *testing.T) {
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    
    longName := string(make([]byte, 201))
    
    _, err := svc.Create(ctx, item.CreateItemCommand{
        WorkspaceID: uuid.New(),
        Name:        longName,
    })
    
    assert.ErrorIs(t, err, item.ErrNameTooLong)
}

func TestRenameItem_Success(t *testing.T) {
    // Arrange
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    workspaceID := uuid.New()
    
    created, _ := svc.Create(ctx, item.CreateItemCommand{
        WorkspaceID: workspaceID,
        Name:        "Old Name",
    })
    
    // Act
    renamed, err := svc.Rename(ctx, item.RenameItemCommand{
        WorkspaceID: workspaceID,
        ItemID:      created.ID(),
        Name:        "New Name",
    })
    
    // Assert
    require.NoError(t, err)
    assert.Equal(t, "New Name", renamed.Name())
}

func TestRenameItem_NotFound_Fails(t *testing.T) {
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    
    _, err := svc.Rename(ctx, item.RenameItemCommand{
        WorkspaceID: uuid.New(),
        ItemID:      uuid.New(),
        Name:        "Whatever",
    })
    
    assert.ErrorIs(t, err, item.ErrNotFound)
}

func TestRenameItem_Archived_Fails(t *testing.T) {
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    workspaceID := uuid.New()
    
    created, _ := svc.Create(ctx, item.CreateItemCommand{
        WorkspaceID: workspaceID,
        Name:        "To Archive",
    })
    
    _ = svc.Archive(ctx, workspaceID, created.ID())
    
    _, err := svc.Rename(ctx, item.RenameItemCommand{
        WorkspaceID: workspaceID,
        ItemID:      created.ID(),
        Name:        "New Name",
    })
    
    assert.ErrorIs(t, err, item.ErrArchived)
}

func TestArchiveItem_Success(t *testing.T) {
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    workspaceID := uuid.New()
    
    created, _ := svc.Create(ctx, item.CreateItemCommand{
        WorkspaceID: workspaceID,
        Name:        "To Archive",
    })
    
    err := svc.Archive(ctx, workspaceID, created.ID())
    require.NoError(t, err)
    
    // Verify it's archived
    fetched, _ := svc.GetByID(ctx, workspaceID, created.ID())
    assert.True(t, fetched.IsArchived())
}

func TestListItems_ExcludesArchived(t *testing.T) {
    repo := newMockRepo()
    svc := item.NewService(repo)
    ctx := context.Background()
    workspaceID := uuid.New()
    
    // Create two items
    item1, _ := svc.Create(ctx, item.CreateItemCommand{WorkspaceID: workspaceID, Name: "Active"})
    item2, _ := svc.Create(ctx, item.CreateItemCommand{WorkspaceID: workspaceID, Name: "To Archive"})
    
    // Archive one
    _ = svc.Archive(ctx, workspaceID, item2.ID())
    
    // List without archived
    items, err := svc.List(ctx, workspaceID, item.FindOptions{IncludeArchived: false})
    require.NoError(t, err)
    
    assert.Len(t, items, 1)
    assert.Equal(t, item1.ID(), items[0].ID())
}
```

### Step 2: Run Tests (They Fail - RED)

```bash
go test ./internal/domain/item/...
# FAIL - code doesn't exist yet
```

### Step 3: Write Minimal Code (GREEN)

Implement entity.go, errors.go, repository.go, service.go until tests pass.

### Step 4: Refactor

Clean up code while keeping tests green.

---

## Handler Layer (with TDD)

### Handler Tests First

```go
// internal/domain/item/handler_test.go
package item_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    
    "github.com/go-chi/chi/v5"
    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "github.com/yourusername/myapp/internal/domain/item"
)

func setupTestRouter() (chi.Router, *item.Service) {
    repo := newMockRepo()
    svc := item.NewService(repo)
    handler := item.NewHandler(svc)
    
    r := chi.NewRouter()
    handler.RegisterRoutes(r)
    
    return r, svc
}

func TestHandler_CreateItem_Success(t *testing.T) {
    router, _ := setupTestRouter()
    workspaceID := uuid.New()
    
    body := map[string]string{"name": "New Item"}
    jsonBody, _ := json.Marshal(body)
    
    req := httptest.NewRequest(
        http.MethodPost,
        "/workspaces/"+workspaceID.String()+"/items",
        bytes.NewReader(jsonBody),
    )
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()
    
    router.ServeHTTP(rec, req)
    
    assert.Equal(t, http.StatusCreated, rec.Code)
    
    var response map[string]interface{}
    json.Unmarshal(rec.Body.Bytes(), &response)
    assert.Equal(t, "New Item", response["name"])
}

func TestHandler_CreateItem_EmptyName_Returns400(t *testing.T) {
    router, _ := setupTestRouter()
    workspaceID := uuid.New()
    
    body := map[string]string{"name": ""}
    jsonBody, _ := json.Marshal(body)
    
    req := httptest.NewRequest(
        http.MethodPost,
        "/workspaces/"+workspaceID.String()+"/items",
        bytes.NewReader(jsonBody),
    )
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()
    
    router.ServeHTTP(rec, req)
    
    assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestHandler_GetItem_NotFound_Returns404(t *testing.T) {
    router, _ := setupTestRouter()
    workspaceID := uuid.New()
    itemID := uuid.New()
    
    req := httptest.NewRequest(
        http.MethodGet,
        "/workspaces/"+workspaceID.String()+"/items/"+itemID.String(),
        nil,
    )
    rec := httptest.NewRecorder()
    
    router.ServeHTTP(rec, req)
    
    assert.Equal(t, http.StatusNotFound, rec.Code)
}
```

### Handler Implementation

```go
// internal/domain/item/handler.go
package item

import (
    "context"
    "errors"
    "net/http"
    
    "github.com/danielgtaylor/huma/v2"
    "github.com/google/uuid"
)

type Handler struct {
    svc *Service
}

func NewHandler(svc *Service) *Handler {
    return &Handler{svc: svc}
}

// DTOs (Data Transfer Objects)

type CreateItemRequest struct {
    WorkspaceID uuid.UUID `path:"workspace_id"`
    Body struct {
        Name        string  `json:"name" minLength:"1" maxLength:"200"`
        Description *string `json:"description,omitempty"`
    }
}

type CreateItemResponse struct {
    Body ItemDTO
}

type GetItemRequest struct {
    WorkspaceID uuid.UUID `path:"workspace_id"`
    ItemID      uuid.UUID `path:"item_id"`
}

type GetItemResponse struct {
    Body ItemDTO
}

type ItemDTO struct {
    ID          uuid.UUID  `json:"id"`
    WorkspaceID uuid.UUID  `json:"workspace_id"`
    Name        string     `json:"name"`
    Description *string    `json:"description,omitempty"`
    IsArchived  bool       `json:"is_archived"`
}

// Route registration

func (h *Handler) RegisterRoutes(api huma.API) {
    huma.Register(api, huma.Operation{
        OperationID:   "create-item",
        Method:        http.MethodPost,
        Path:          "/workspaces/{workspace_id}/items",
        Summary:       "Create item",
        Tags:          []string{"Items"},
        DefaultStatus: http.StatusCreated,
    }, h.Create)
    
    huma.Register(api, huma.Operation{
        OperationID: "get-item",
        Method:      http.MethodGet,
        Path:        "/workspaces/{workspace_id}/items/{item_id}",
        Summary:     "Get item by ID",
        Tags:        []string{"Items"},
    }, h.GetByID)
}

// Handlers

func (h *Handler) Create(ctx context.Context, req *CreateItemRequest) (*CreateItemResponse, error) {
    item, err := h.svc.Create(ctx, CreateItemCommand{
        WorkspaceID: req.WorkspaceID,
        Name:        req.Body.Name,
        Description: req.Body.Description,
    })
    if err != nil {
        return nil, h.mapError(err)
    }
    
    return &CreateItemResponse{Body: toDTO(item)}, nil
}

func (h *Handler) GetByID(ctx context.Context, req *GetItemRequest) (*GetItemResponse, error) {
    item, err := h.svc.GetByID(ctx, req.WorkspaceID, req.ItemID)
    if err != nil {
        return nil, h.mapError(err)
    }
    
    return &GetItemResponse{Body: toDTO(item)}, nil
}

// Error mapping (domain errors → HTTP errors)

func (h *Handler) mapError(err error) error {
    switch {
    case errors.Is(err, ErrNotFound):
        return huma.Error404NotFound("item not found")
    case errors.Is(err, ErrNameRequired):
        return huma.Error400BadRequest("name is required")
    case errors.Is(err, ErrNameTooLong):
        return huma.Error400BadRequest("name exceeds maximum length")
    case errors.Is(err, ErrArchived):
        return huma.Error400BadRequest("cannot modify archived item")
    default:
        return huma.Error500InternalServerError("internal error")
    }
}

// Mapping

func toDTO(i *Item) ItemDTO {
    return ItemDTO{
        ID:          i.ID(),
        WorkspaceID: i.WorkspaceID(),
        Name:        i.Name(),
        Description: i.Description(),
        IsArchived:  i.IsArchived(),
    }
}
```

---

## Infrastructure Layer

### Repository Implementation

```go
// internal/infra/postgres/item_repo.go
package postgres

import (
    "context"
    
    "github.com/google/uuid"
    "github.com/yourusername/myapp/internal/domain/item"
    "github.com/yourusername/myapp/internal/infra/queries"
)

type ItemRepository struct {
    q *queries.Queries
}

func NewItemRepository(q *queries.Queries) *ItemRepository {
    return &ItemRepository{q: q}
}

func (r *ItemRepository) Save(ctx context.Context, i *item.Item) error {
    return r.q.UpsertItem(ctx, queries.UpsertItemParams{
        ID:          i.ID(),
        WorkspaceID: i.WorkspaceID(),
        Name:        i.Name(),
        Description: i.Description(),
        IsArchived:  i.IsArchived(),
    })
}

func (r *ItemRepository) FindByID(ctx context.Context, workspaceID, id uuid.UUID) (*item.Item, error) {
    row, err := r.q.GetItem(ctx, queries.GetItemParams{
        ID:          id,
        WorkspaceID: workspaceID,
    })
    if err != nil {
        return nil, nil // Not found
    }
    
    return item.Reconstitute(
        row.ID,
        row.WorkspaceID,
        row.Name,
        row.Description,
        row.CategoryID,
        row.IsArchived,
        row.CreatedAt,
        row.UpdatedAt,
    ), nil
}

func (r *ItemRepository) FindAll(ctx context.Context, workspaceID uuid.UUID, opts item.FindOptions) ([]*item.Item, error) {
    rows, err := r.q.ListItems(ctx, queries.ListItemsParams{
        WorkspaceID:     workspaceID,
        IncludeArchived: opts.IncludeArchived,
        Limit:           int32(opts.Limit),
        Offset:          int32(opts.Offset),
    })
    if err != nil {
        return nil, err
    }
    
    items := make([]*item.Item, len(rows))
    for i, row := range rows {
        items[i] = item.Reconstitute(
            row.ID,
            row.WorkspaceID,
            row.Name,
            row.Description,
            row.CategoryID,
            row.IsArchived,
            row.CreatedAt,
            row.UpdatedAt,
        )
    }
    return items, nil
}

func (r *ItemRepository) Delete(ctx context.Context, workspaceID, id uuid.UUID) error {
    return r.q.DeleteItem(ctx, queries.DeleteItemParams{
        ID:          id,
        WorkspaceID: workspaceID,
    })
}
```

### sqlc Queries

```sql
-- db/queries/items.sql

-- name: GetItem :one
SELECT * FROM warehouse.items
WHERE id = $1 AND workspace_id = $2;

-- name: ListItems :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1
  AND (sqlc.arg(include_archived)::boolean OR is_archived = false)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpsertItem :exec
INSERT INTO warehouse.items (id, workspace_id, name, description, is_archived, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, now(), now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_archived = EXCLUDED.is_archived,
    updated_at = now();

-- name: DeleteItem :exec
DELETE FROM warehouse.items
WHERE id = $1 AND workspace_id = $2;
```

---

## Wiring It Together

```go
// internal/api/router.go
package api

import (
    "github.com/danielgtaylor/huma/v2"
    "github.com/danielgtaylor/huma/v2/adapters/humachi"
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
    
    "github.com/yourusername/myapp/internal/domain/item"
    "github.com/yourusername/myapp/internal/domain/inventory"
    "github.com/yourusername/myapp/internal/domain/loan"
    "github.com/yourusername/myapp/internal/infra/postgres"
    "github.com/yourusername/myapp/internal/infra/queries"
)

func NewRouter(q *queries.Queries) chi.Router {
    r := chi.NewRouter()
    
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RequestID)
    
    api := humachi.New(r, huma.DefaultConfig("Home Warehouse API", "1.0.0"))
    
    // Wire up Item domain
    itemRepo := postgres.NewItemRepository(q)
    itemSvc := item.NewService(itemRepo)
    itemHandler := item.NewHandler(itemSvc)
    itemHandler.RegisterRoutes(api)
    
    // Wire up Inventory domain
    inventoryRepo := postgres.NewInventoryRepository(q)
    inventorySvc := inventory.NewService(inventoryRepo, itemRepo)
    inventoryHandler := inventory.NewHandler(inventorySvc)
    inventoryHandler.RegisterRoutes(api)
    
    // Wire up Loan domain
    loanRepo := postgres.NewLoanRepository(q)
    loanSvc := loan.NewService(loanRepo, inventoryRepo)
    loanHandler := loan.NewHandler(loanSvc)
    loanHandler.RegisterRoutes(api)
    
    return r
}
```

---

## TDD Workflow Summary

### For Each New Feature

```
1. Write domain test     → what should the business logic do?
2. Run test (RED)        → it fails
3. Write entity/service  → minimal code to pass
4. Run test (GREEN)      → it passes
5. Refactor              → clean up
6. Write handler test    → what HTTP behavior?
7. Run test (RED)
8. Write handler         → minimal code
9. Run test (GREEN)
10. Write sqlc query     → if new DB access needed
11. Write repo impl      → implement interface
12. Integration test     → full stack test
```

### Test Pyramid

```
        /\
       /  \      E2E Tests (few)
      /----\     
     /      \    Integration Tests (some)
    /--------\   
   /          \  Unit Tests (many)
  --------------
```

| Level | What | How |
|-------|------|-----|
| Unit | Service + Entity logic | Mock repository |
| Integration | Repository + Database | Test database |
| E2E | Full HTTP flow | httptest + test database |

---

## Benefits of This Approach

### DDD Benefits

- **Clear boundaries** — each domain is self-contained
- **Business logic isolation** — service layer has no HTTP/DB knowledge
- **Easy to test** — mock at repository boundary
- **Easy to refactor** — change infrastructure without touching domain
- **Readable** — code organized by what it does, not technical layer

### TDD Benefits

- **Confidence** — tests prove code works
- **Design feedback** — hard to test = bad design
- **Documentation** — tests show how code should behave
- **Refactoring safety** — change code, tests catch regressions
- **Focus** — write only what's needed to pass tests

### Combined Benefits

- **Domain tests drive domain design** — behavior emerges from tests
- **Handler tests verify API contract** — HTTP interface is tested
- **Repository interface enables mocking** — fast unit tests
- **Clear separation** — each layer tested appropriately
