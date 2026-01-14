# Repository Error Handling

All repositories follow a standardized error handling pattern for consistent behavior across the application.

## StandardError Pattern

### Not Found Errors

When an entity is not found, repositories return `shared.ErrNotFound` instead of `(nil, nil)`.

```go
func (r *ItemRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
    row, err := r.queries.GetItem(ctx, queries.GetItemParams{
        ID:          id,
        WorkspaceID: workspaceID,
    })
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, shared.ErrNotFound  // Standardized error
        }
        return nil, err
    }

    return r.rowToItem(row), nil
}
```

### Why This Matters

**Before standardization:**
```go
// Inconsistent - some repositories returned nil, nil
item, err := repo.FindByID(ctx, id, workspaceID)
if err != nil {
    return err
}
if item == nil {  // Had to check both error AND nil
    return ErrItemNotFound
}
```

**After standardization:**
```go
// Consistent - just check the error
item, err := repo.FindByID(ctx, id, workspaceID)
if err != nil {
    if shared.IsNotFound(err) {
        return ErrItemNotFound  // Or handle not found case
    }
    return err
}
// item is guaranteed to be non-nil here
```

## Helper Functions

### HandleNotFound

Converts `pgx.ErrNoRows` to `shared.ErrNotFound`:

```go
err := postgres.HandleNotFound(err)
if shared.IsNotFound(err) {
    // Handle not found case
}
```

### WrapNotFound

Generic helper that combines entity retrieval and error conversion:

```go
return postgres.WrapNotFound(r.scanEntity(row))
```

## Service Layer Changes

Services no longer need to check for nil after error handling:

**Before:**
```go
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Entity, error) {
    entity, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err
    }
    if entity == nil {  // Redundant check
        return nil, ErrEntityNotFound
    }
    return entity, nil
}
```

**After:**
```go
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Entity, error) {
    entity, err := s.repo.FindByID(ctx, id)
    if err != nil {
        // Repository returns shared.ErrNotFound, no nil check needed
        return nil, err
    }
    return entity, nil
}
```

## Error Checking Patterns

### Pattern 1: Direct Error Check

```go
entity, err := repo.FindByID(ctx, id, workspaceID)
if err != nil {
    if shared.IsNotFound(err) {
        // Handle not found specifically
        return nil, ErrEntityNotFound
    }
    // Handle other errors
    return nil, err
}
// entity is guaranteed non-nil here
```

### Pattern 2: Propagate Error

```go
entity, err := repo.FindByID(ctx, id, workspaceID)
if err != nil {
    // Let caller handle the error
    return nil, err
}
return entity, nil
```

### Pattern 3: Custom Not Found Error

```go
entity, err := repo.FindByID(ctx, id, workspaceID)
if err != nil {
    if shared.IsNotFound(err) {
        return nil, shared.NewFieldError(shared.ErrNotFound, "entity_id", "entity not found")
    }
    return nil, err
}
```

## Testing

Tests now expect `shared.ErrNotFound` for not found cases:

**Before:**
```go
entity, err := repo.FindByID(ctx, nonExistentID, workspaceID)
require.NoError(t, err)
assert.Nil(t, entity)
```

**After:**
```go
entity, err := repo.FindByID(ctx, nonExistentID, workspaceID)
require.Error(t, err)
assert.True(t, shared.IsNotFound(err))
assert.Nil(t, entity)
```

## Benefits

1. **Consistency**: All repositories behave the same way
2. **Type Safety**: No need to check both error and nil
3. **Clearer Intent**: Errors explicitly indicate what went wrong
4. **Better Semantics**: `ErrNotFound` is semantically clearer than `nil`
5. **Simplified Services**: Services don't need redundant nil checks
6. **Error Wrapping**: Can use `errors.Is()` for wrapped errors

## Migration Checklist

When adding a new repository:

- [x] Import `github.com/antti/home-warehouse/go-backend/internal/shared`
- [x] Return `shared.ErrNotFound` for `pgx.ErrNoRows`
- [x] Test not found cases with `shared.IsNotFound(err)`
- [x] Don't check for nil after error handling in services

## Files Changed

### Core Implementation
- `internal/infra/postgres/errors.go` - Helper functions
- `internal/infra/postgres/errors_test.go` - Helper tests

### Updated Repositories (15 files)
- `attachment_repository.go`
- `borrower_repository.go`
- `category_repository.go`
- `company_repository.go`
- `container_repository.go`
- `importexport_repository.go`
- `inventory_repository.go`
- `item_repository.go`
- `label_repository.go`
- `loan_repository.go`
- `location_repository.go`
- `member_repository.go`
- `notification_repository.go`
- `user_repository.go`
- `workspace_repository.go`

### Updated Tests (15 files)
- All `*_repository_test.go` files updated to expect `shared.ErrNotFound`

### Updated Services (3 files)
- `internal/domain/warehouse/item/service.go`
- `internal/domain/warehouse/inventory/service.go`
- `internal/domain/warehouse/loan/service.go`

## See Also

- `internal/shared/errors.go` - Error definitions and helpers
- `BACKEND_ARCHITECTURE_IMPROVEMENTS.md` - Architecture documentation
