## Phase 4: Loan Domain

### 4.1 Borrower Domain

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Borrower: id, workspaceID, name, email, phone, notes, isArchived |
| `errors.go` | ErrBorrowerNotFound, ErrHasActiveLoans |
| `repository.go` | Save, FindByID, List, Delete |
| `service.go` | Create, Update, Archive |
| `handler.go` | CRUD endpoints |

**Entity:**

```go
// internal/domain/warehouse/borrower/entity.go
type Borrower struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    name        string
    email       *string
    phone       *string
    notes       *string
    isArchived  bool
    createdAt   time.Time
    updatedAt   time.Time
}
```

**sqlc queries** (`db/queries/borrowers.sql`):

```sql
-- name: GetBorrower :one
SELECT * FROM warehouse.borrowers
WHERE id = $1 AND workspace_id = $2;

-- name: CreateBorrower :one
INSERT INTO warehouse.borrowers (id, workspace_id, name, email, phone, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateBorrower :one
UPDATE warehouse.borrowers
SET name = $2, email = $3, phone = $4, notes = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ArchiveBorrower :exec
UPDATE warehouse.borrowers
SET is_archived = true, updated_at = now()
WHERE id = $1;

-- name: RestoreBorrower :exec
UPDATE warehouse.borrowers
SET is_archived = false, updated_at = now()
WHERE id = $1;

-- name: ListBorrowers :many
SELECT * FROM warehouse.borrowers
WHERE workspace_id = $1 AND is_archived = false
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: HasActiveLoans :one
SELECT EXISTS(
    SELECT 1 FROM warehouse.loans
    WHERE borrower_id = $1 AND returned_at IS NULL
);
```

---

### 4.2 Loan Domain (Aggregate Root)

**Files:**

| File | Purpose |
|------|---------|
| `entity.go` | Loan entity |
| `aggregate.go` | LoanAggregate: encapsulates loan + inventory + borrower for complex operations |
| `errors.go` | ErrLoanNotFound, ErrAlreadyReturned, ErrQuantityExceedsAvailable, ErrInventoryOnLoan |
| `repository.go` | Save, FindByID, FindActiveByBorrower, FindActiveByInventory, FindOverdue, Delete |
| `service.go` | CreateLoan (with inventory validation), ReturnLoan (updates inventory status), ExtendDueDate, GetOverdueLoans |
| `service_test.go` | Critical tests: quantity validation, status updates, concurrent loans |
| `handler.go` | Create, Return, Extend, List endpoints |

**Entity:**

```go
// internal/domain/warehouse/loan/entity.go
type Loan struct {
    id          uuid.UUID
    workspaceID uuid.UUID
    inventoryID uuid.UUID
    borrowerID  uuid.UUID
    quantity    int
    loanedAt    time.Time
    dueDate     *time.Time
    returnedAt  *time.Time
    notes       *string
    createdAt   time.Time
    updatedAt   time.Time
}

func (l *Loan) IsActive() bool {
    return l.returnedAt == nil
}

func (l *Loan) IsOverdue() bool {
    if l.returnedAt != nil || l.dueDate == nil {
        return false
    }
    return time.Now().After(*l.dueDate)
}
```

**Aggregate:**

```go
// internal/domain/warehouse/loan/aggregate.go
type LoanAggregate struct {
    Loan      *Loan
    Inventory *inventory.Inventory
    Borrower  *borrower.Borrower
}

func (a *LoanAggregate) CanLoan(requestedQty int) error {
    if a.Inventory.Status() != inventory.StatusAvailable {
        return ErrInventoryNotAvailable
    }
    if requestedQty > a.Inventory.Quantity() {
        return ErrQuantityExceedsAvailable
    }
    return nil
}

func (a *LoanAggregate) Return() error {
    if a.Loan.returnedAt != nil {
        return ErrAlreadyReturned
    }
    now := time.Now()
    a.Loan.returnedAt = &now
    return nil
}
```

**sqlc queries** (`db/queries/loans.sql`):

```sql
-- name: GetLoan :one
SELECT * FROM warehouse.loans
WHERE id = $1 AND workspace_id = $2;

-- name: CreateLoan :one
INSERT INTO warehouse.loans (id, workspace_id, inventory_id, borrower_id, quantity, loaned_at, due_date, notes)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ReturnLoan :one
UPDATE warehouse.loans
SET returned_at = now(), updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ExtendLoanDueDate :one
UPDATE warehouse.loans
SET due_date = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ListLoansByWorkspace :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1
ORDER BY loaned_at DESC
LIMIT $2 OFFSET $3;

-- name: ListLoansByBorrower :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND borrower_id = $2
ORDER BY loaned_at DESC
LIMIT $3 OFFSET $4;

-- name: ListLoansByInventory :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND inventory_id = $2
ORDER BY loaned_at DESC;

-- name: ListActiveLoans :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND returned_at IS NULL
ORDER BY due_date ASC NULLS LAST;

-- name: ListOverdueLoans :many
SELECT * FROM warehouse.loans
WHERE workspace_id = $1 AND returned_at IS NULL AND due_date < now()
ORDER BY due_date ASC;

-- name: GetActiveLoanForInventory :one
SELECT * FROM warehouse.loans
WHERE inventory_id = $1 AND returned_at IS NULL;

-- name: GetLoanWithDetails :one
SELECT l.*,
       i.quantity as inventory_quantity, i.status as inventory_status,
       it.name as item_name, it.sku,
       b.name as borrower_name, b.email as borrower_email
FROM warehouse.loans l
JOIN warehouse.inventory i ON l.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.borrowers b ON l.borrower_id = b.id
WHERE l.id = $1 AND l.workspace_id = $2;

-- name: ListActiveLoansWithDetails :many
SELECT l.*,
       i.quantity as inventory_quantity,
       it.name as item_name, it.sku,
       b.name as borrower_name, b.email as borrower_email,
       loc.name as location_name
FROM warehouse.loans l
JOIN warehouse.inventory i ON l.inventory_id = i.id
JOIN warehouse.items it ON i.item_id = it.id
JOIN warehouse.borrowers b ON l.borrower_id = b.id
JOIN warehouse.locations loc ON i.location_id = loc.id
WHERE l.workspace_id = $1 AND l.returned_at IS NULL
ORDER BY l.due_date ASC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: GetTotalLoanedQuantity :one
SELECT COALESCE(SUM(quantity), 0)::int as total
FROM warehouse.loans
WHERE inventory_id = $1 AND returned_at IS NULL;
```

---

