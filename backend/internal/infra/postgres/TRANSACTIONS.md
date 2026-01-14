# Transaction Manager

The transaction manager provides a clean API for managing database transactions across multiple repository operations.

## Overview

The transaction manager ensures **atomic operations** across multiple database entities. If any operation fails, all changes are rolled back.

### Key Features

- **Automatic commit/rollback**: Transactions commit on success, rollback on error
- **Panic recovery**: Transactions are safely rolled back on panics
- **Nested transaction support**: Inner transactions reuse the outer transaction
- **Context-based**: Transactions are passed through `context.Context`
- **sqlc compatible**: Works seamlessly with sqlc-generated code

## Basic Usage

### 1. Create Transaction Manager

```go
pool, err := postgres.NewPool(ctx, databaseURL)
if err != nil {
    return err
}

txManager := postgres.NewTxManager(pool)
```

### 2. Execute Operations in a Transaction

```go
err := txManager.WithTx(ctx, func(txCtx context.Context) error {
    // All operations use txCtx which contains the transaction

    inv, err := inventoryRepo.Save(txCtx, inventory)
    if err != nil {
        return err // Automatic rollback
    }

    err = movementRepo.Save(txCtx, movement)
    if err != nil {
        return err // Automatic rollback
    }

    return nil // Automatic commit
})
```

## Repository Integration

### Option 1: Use GetDBTX Helper (Recommended)

Repositories can support both transactional and non-transactional operations:

```go
type InventoryRepository struct {
    pool *pgxpool.Pool
}

func (r *InventoryRepository) Save(ctx context.Context, inv *inventory.Inventory) error {
    // GetDBTX returns transaction if present, otherwise returns pool
    db := postgres.GetDBTX(ctx, r.pool)
    queries := queries.New(db)

    _, err := queries.CreateInventory(ctx, queries.CreateInventoryParams{
        // ... parameters
    })
    return err
}
```

### Option 2: Check for Transaction Explicitly

```go
func (r *InventoryRepository) Save(ctx context.Context, inv *inventory.Inventory) error {
    var queries *queries.Queries

    if tx := postgres.GetTx(ctx); tx != nil {
        // Use transaction
        queries = queries.New(tx)
    } else {
        // Use pool
        queries = queries.New(r.pool)
    }

    // ... perform operations
}
```

## Service Layer Usage

### Example: Inventory Movement

When moving inventory, we need to update both the inventory record and create a movement log atomically:

```go
type InventoryService struct {
    inventoryRepo *postgres.InventoryRepository
    movementRepo  *postgres.MovementRepository
    txManager     *postgres.TxManager
}

func (s *InventoryService) Move(ctx context.Context, input MoveInput) error {
    return s.txManager.WithTx(ctx, func(txCtx context.Context) error {
        // Update inventory location
        inv, err := s.inventoryRepo.FindByID(txCtx, input.InventoryID, input.WorkspaceID)
        if err != nil {
            return err
        }

        err = inv.Move(input.ToLocationID, input.ToContainerID)
        if err != nil {
            return err
        }

        err = s.inventoryRepo.Save(txCtx, inv)
        if err != nil {
            return err
        }

        // Create movement record
        movement := movement.NewInventoryMovement(
            uuid.New(),
            input.WorkspaceID,
            input.InventoryID,
            inv.LocationID(),
            input.ToLocationID,
            input.Quantity,
            input.UserID,
            input.Reason,
        )

        return s.movementRepo.Save(txCtx, movement)
    })
}
```

### Example: Batch Operations

```go
func (s *ItemService) BulkArchive(ctx context.Context, itemIDs []uuid.UUID, workspaceID uuid.UUID) error {
    return s.txManager.WithTx(ctx, func(txCtx context.Context) error {
        for _, itemID := range itemIDs {
            item, err := s.repo.FindByID(txCtx, itemID, workspaceID)
            if err != nil {
                return err
            }

            item.Archive()

            err = s.repo.Save(txCtx, item)
            if err != nil {
                return err // Rolls back all previous saves
            }
        }
        return nil
    })
}
```

## Advanced Patterns

### Nested Transactions

Nested WithTx calls automatically reuse the parent transaction:

```go
err := txManager.WithTx(ctx, func(outerCtx context.Context) error {
    // Outer operation
    err := itemRepo.Save(outerCtx, item)
    if err != nil {
        return err
    }

    // Inner "transaction" (actually reuses outer)
    return txManager.WithTx(outerCtx, func(innerCtx context.Context) error {
        return inventoryRepo.Save(innerCtx, inventory)
    })
})
```

This prevents PostgreSQL "nested transaction" errors and ensures all operations use the same transaction.

### Error Handling

The transaction manager preserves the original error:

```go
err := txManager.WithTx(ctx, func(txCtx context.Context) error {
    return apierror.NotFoundError("item not found")
})

// err is still the original apierror, not wrapped
if apierror.IsNotFound(err) {
    // Handle not found
}
```

### Context Cancellation

Transactions respect context cancellation:

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

err := txManager.WithTx(ctx, func(txCtx context.Context) error {
    // Long-running operation
    // Will fail if context is cancelled
})
```

## Testing

### Unit Tests

Repositories that use `GetDBTX` can be tested without transactions:

```go
func TestInventoryRepository_Save(t *testing.T) {
    pool := testdb.SetupTestDB(t)
    defer pool.Close()

    repo := postgres.NewInventoryRepository(pool)
    ctx := context.Background()

    // Save works without transaction
    err := repo.Save(ctx, inventory)
    require.NoError(t, err)
}
```

### Integration Tests with Transactions

```go
func TestInventoryService_Move_Atomic(t *testing.T) {
    pool := testdb.SetupTestDB(t)
    defer pool.Close()

    txMgr := postgres.NewTxManager(pool)
    repo := postgres.NewInventoryRepository(pool)
    movementRepo := postgres.NewMovementRepository(pool)

    // Test that failure rolls back both operations
    err := txMgr.WithTx(context.Background(), func(ctx context.Context) error {
        err := repo.Save(ctx, inventory)
        if err != nil {
            return err
        }

        // Simulate failure
        return errors.New("simulated failure")
    })

    require.Error(t, err)

    // Verify rollback - inventory should not exist
    _, err = repo.FindByID(context.Background(), inventory.ID(), workspaceID)
    assert.Error(t, err) // Should be not found
}
```

## Migration Guide

### Before (No Transactions)

```go
func (s *InventoryService) Move(ctx context.Context, input MoveInput) error {
    // Problem: If movement.Save fails, inventory is already updated
    inv, _ := s.inventoryRepo.FindByID(ctx, input.InventoryID, input.WorkspaceID)
    inv.Move(input.ToLocationID, input.ToContainerID)
    s.inventoryRepo.Save(ctx, inv)

    movement := movement.NewInventoryMovement(...)
    return s.movementRepo.Save(ctx, movement) // If this fails, data is inconsistent!
}
```

### After (With Transactions)

```go
func (s *InventoryService) Move(ctx context.Context, input MoveInput) error {
    return s.txManager.WithTx(ctx, func(txCtx context.Context) error {
        inv, err := s.inventoryRepo.FindByID(txCtx, input.InventoryID, input.WorkspaceID)
        if err != nil {
            return err
        }

        err = inv.Move(input.ToLocationID, input.ToContainerID)
        if err != nil {
            return err
        }

        err = s.inventoryRepo.Save(txCtx, inv)
        if err != nil {
            return err
        }

        movement := movement.NewInventoryMovement(...)
        return s.movementRepo.Save(txCtx, movement) // Atomic with inventory update!
    })
}
```

## Best Practices

1. **Keep transactions short**: Only wrap operations that need atomicity
2. **Pass txCtx down**: Always pass the transaction context to repositories
3. **Don't mix contexts**: Use `txCtx` for all operations in the transaction
4. **Error propagation**: Return errors immediately - don't log and continue
5. **Avoid long operations**: Don't do HTTP calls or heavy computations in transactions
6. **Test rollback scenarios**: Verify that partial failures don't corrupt data

## Performance Considerations

- Transactions add ~100-200μs overhead per operation
- Batch multiple operations together when possible
- Avoid holding transactions during external API calls
- Use connection pooling (already configured in `pool.go`)

## Troubleshooting

### "transaction is already closed"

You're trying to use a transaction after WithTx has returned. Make sure all operations happen inside the closure.

### "nested transactions not supported"

Don't start a new transaction inside an existing one. Use the context-aware pattern - `WithTx` automatically detects and reuses existing transactions.

### "context canceled"

Your operation took too long. Check context timeout settings or optimize the query.

## See Also

- `tx.go` - Transaction manager implementation
- `tx_test.go` - Integration tests with real database
- `tx_unit_test.go` - Unit tests without database
- [sqlc documentation](https://docs.sqlc.dev/en/latest/howto/transactions.html)
