## Phase 8: Testing Strategy

### Test Levels

| Level | What | Coverage Target | Tools |
|-------|------|-----------------|-------|
| **Unit** | Entity invariants, Service logic | 90%+ | testify, mock repos |
| **Integration** | Repository + Database | 80%+ | testcontainers, real DB |
| **E2E** | Full HTTP flow | Key paths | httptest, test DB |

### Test Database Setup

```go
// tests/testdb/testdb.go
package testdb

import (
    "context"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
)

func SetupTestDB(t *testing.T) *pgxpool.Pool {
    t.Helper()

    ctx := context.Background()

    // Use test database URL
    pool, err := pgxpool.New(ctx, os.Getenv("TEST_DATABASE_URL"))
    if err != nil {
        t.Fatalf("failed to connect to test database: %v", err)
    }

    // Run migrations
    // ...

    t.Cleanup(func() {
        // Truncate all tables
        pool.Exec(ctx, `
            TRUNCATE warehouse.activity_log, warehouse.loans, warehouse.inventory,
            warehouse.items, warehouse.containers, warehouse.locations,
            warehouse.categories, warehouse.borrowers, warehouse.companies,
            warehouse.labels, auth.workspace_members, auth.workspaces, auth.users
            CASCADE
        `)
        pool.Close()
    })

    return pool
}
```

### Test Pyramid

```
        /\
       /  \      E2E Tests (few - critical paths)
      /----\
     /      \    Integration Tests (some - repository layer)
    /--------\
   /          \  Unit Tests (many - domain logic)
  --------------
```

### Example Unit Test (TDD)

```go
// internal/domain/warehouse/loan/service_test.go
func TestCreateLoan_Success(t *testing.T) {
    // Arrange
    inventoryRepo := newMockInventoryRepo()
    borrowerRepo := newMockBorrowerRepo()
    loanRepo := newMockLoanRepo()
    svc := loan.NewService(loanRepo, inventoryRepo, borrowerRepo)

    workspaceID := uuid.New()
    inventory := createTestInventory(workspaceID, 5, inventory.StatusAvailable)
    borrower := createTestBorrower(workspaceID)

    inventoryRepo.items[inventory.ID()] = inventory
    borrowerRepo.items[borrower.ID()] = borrower

    // Act
    created, err := svc.CreateLoan(context.Background(), loan.CreateLoanCommand{
        WorkspaceID: workspaceID,
        InventoryID: inventory.ID(),
        BorrowerID:  borrower.ID(),
        Quantity:    2,
    })

    // Assert
    require.NoError(t, err)
    assert.Equal(t, 2, created.Quantity())
    assert.True(t, created.IsActive())
}

func TestCreateLoan_ExceedsQuantity_Fails(t *testing.T) {
    // Arrange
    inventoryRepo := newMockInventoryRepo()
    borrowerRepo := newMockBorrowerRepo()
    loanRepo := newMockLoanRepo()
    svc := loan.NewService(loanRepo, inventoryRepo, borrowerRepo)

    workspaceID := uuid.New()
    inventory := createTestInventory(workspaceID, 5, inventory.StatusAvailable)
    borrower := createTestBorrower(workspaceID)

    inventoryRepo.items[inventory.ID()] = inventory
    borrowerRepo.items[borrower.ID()] = borrower

    // Act
    _, err := svc.CreateLoan(context.Background(), loan.CreateLoanCommand{
        WorkspaceID: workspaceID,
        InventoryID: inventory.ID(),
        BorrowerID:  borrower.ID(),
        Quantity:    10, // Exceeds available quantity of 5
    })

    // Assert
    assert.ErrorIs(t, err, loan.ErrQuantityExceedsAvailable)
}
```

---

