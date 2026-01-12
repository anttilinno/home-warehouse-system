# Phase 3 Quick Start Guide

**Goal**: Add service error path tests to increase coverage from 78.9% → 86.9%

## Pre-Flight Checklist

Before starting Phase 3, verify:

- [ ] Phase 2 is complete: `bash docs/go-tests/scripts/validate-phase-2.sh`
- [ ] Overall coverage is ~79%: `go test ./... -short -cover | grep total`
- [ ] All Phase 2 tests pass: `go test ./... -short`

**Run pre-flight check:**
```bash
bash docs/go-tests/scripts/validate-phase-3.sh --pre-flight
```

## Overview

Phase 3 focuses on adding error scenario tests to existing service test files. We're NOT creating new files, but extending existing `*_service_test.go` files.

## Task 3.1: Service Error Path Tests (25-30 hours)

### Target Services

Add error tests to these services:
- activity (40.2% → 75%)
- movement (43.9% → 70%)
- loan (46.5% → 75%)
- company (47.3% → 70%)
- user (33.9% → 70%)
- notification (37.9% → 70%)
- workspace (42.2% → 70%)
- member (48.5% → 70%)

### Step-by-Step Process for Each Service

#### Step 1: Identify current service test file

```bash
# Example for loan service
ls -la internal/domain/warehouse/loan/service_test.go
```

#### Step 2: Add validation error tests

Open the service_test.go file and add these test patterns:

```go
func TestLoanService_Create_ValidationErrors(t *testing.T) {
	t.Run("returns error for invalid workspace", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)
		mockRepo.On("Save", mock.Anything, mock.Anything).
			Return(postgres.ErrForeignKeyViolation)

		svc := loan.NewService(mockRepo)
		_, err := svc.Create(ctx, uuid.Nil, loan.CreateInput{
			InventoryID: uuid.New(),
			BorrowerID:  uuid.New(),
		})

		assert.Error(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns error for invalid inventory", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)
		mockRepo.On("Save", mock.Anything, mock.Anything).
			Return(postgres.ErrForeignKeyViolation)

		svc := loan.NewService(mockRepo)
		_, err := svc.Create(ctx, workspaceID, loan.CreateInput{
			InventoryID: uuid.New(), // Non-existent
			BorrowerID:  uuid.New(),
		})

		assert.Error(t, err)
	})

	t.Run("returns error for inventory already on loan", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)
		mockRepo.On("Save", mock.Anything, mock.Anything).
			Return(loan.ErrInventoryOnLoan)

		svc := loan.NewService(mockRepo)
		_, err := svc.Create(ctx, workspaceID, loan.CreateInput{
			InventoryID: uuid.New(),
			BorrowerID:  uuid.New(),
		})

		assert.Equal(t, loan.ErrInventoryOnLoan, err)
	})

	t.Run("returns error for due date in past", func(t *testing.T) {
		pastDate := time.Now().Add(-24 * time.Hour)

		svc := loan.NewService(nil)
		_, err := svc.Create(ctx, workspaceID, loan.CreateInput{
			InventoryID: uuid.New(),
			BorrowerID:  uuid.New(),
			DueDate:     &pastDate,
		})

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "past")
	})
}
```

#### Step 3: Add not found error tests

```go
func TestLoanService_Update_NotFoundErrors(t *testing.T) {
	t.Run("returns ErrNotFound when loan doesn't exist", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)
		loanID := uuid.New()

		mockRepo.On("GetByID", mock.Anything, loanID, workspaceID).
			Return(nil, loan.ErrNotFound)

		svc := loan.NewService(mockRepo)
		_, err := svc.Update(ctx, loanID, workspaceID, loan.UpdateInput{})

		assert.Equal(t, loan.ErrNotFound, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns ErrNotFound when loan in different workspace", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)
		loanID := uuid.New()
		differentWorkspace := uuid.New()

		mockRepo.On("GetByID", mock.Anything, loanID, differentWorkspace).
			Return(nil, loan.ErrNotFound)

		svc := loan.NewService(mockRepo)
		_, err := svc.Update(ctx, loanID, differentWorkspace, loan.UpdateInput{})

		assert.Equal(t, loan.ErrNotFound, err)
	})
}
```

#### Step 4: Add pagination error tests

```go
func TestLoanService_List_PaginationEdgeCases(t *testing.T) {
	t.Run("handles negative offset", func(t *testing.T) {
		svc := loan.NewService(nil)
		_, _, err := svc.List(ctx, workspaceID, -1, 10)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "offset")
	})

	t.Run("handles negative limit", func(t *testing.T) {
		svc := loan.NewService(nil)
		_, _, err := svc.List(ctx, workspaceID, 0, -1)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "limit")
	})

	t.Run("handles offset beyond count", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)

		mockRepo.On("List", mock.Anything, workspaceID, 1000, 10).
			Return([]*loan.Loan{}, nil)
		mockRepo.On("Count", mock.Anything, workspaceID).
			Return(50, nil)

		svc := loan.NewService(mockRepo)
		loans, total, err := svc.List(ctx, workspaceID, 1000, 10)

		assert.NoError(t, err)
		assert.Empty(t, loans)
		assert.Equal(t, 50, total)
	})
}
```

#### Step 5: Add state transition error tests

```go
func TestLoanService_Return_StateErrors(t *testing.T) {
	t.Run("returns error when loan already returned", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)
		loanID := uuid.New()

		// Loan is already returned
		returnedLoan := &loan.Loan{
			ID:         loanID,
			ReturnedAt: timePtr(time.Now()),
		}

		mockRepo.On("GetByID", mock.Anything, loanID, workspaceID).
			Return(returnedLoan, nil)

		svc := loan.NewService(mockRepo)
		err := svc.Return(ctx, loanID, workspaceID)

		assert.Equal(t, loan.ErrAlreadyReturned, err)
	})
}

// Helper
func timePtr(t time.Time) *time.Time {
	return &t
}
```

#### Step 6: Add database error tests

```go
func TestLoanService_DatabaseErrors(t *testing.T) {
	t.Run("handles database connection timeout", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)

		mockRepo.On("List", mock.Anything, workspaceID, 0, 10).
			Return(nil, context.DeadlineExceeded)

		svc := loan.NewService(mockRepo)
		_, _, err := svc.List(ctx, workspaceID, 0, 10)

		assert.Error(t, err)
	})

	t.Run("handles transaction rollback", func(t *testing.T) {
		mockRepo := new(MockLoanRepository)
		loanID := uuid.New()

		testLoan := &loan.Loan{ID: loanID, WorkspaceID: workspaceID}
		mockRepo.On("GetByID", mock.Anything, loanID, workspaceID).
			Return(testLoan, nil)

		mockRepo.On("Delete", mock.Anything, loanID).
			Return(postgres.ErrForeignKeyViolation)

		svc := loan.NewService(mockRepo)
		err := svc.Delete(ctx, loanID, workspaceID)

		assert.Error(t, err)
	})
}
```

### Step 7: Test the additions

```bash
# Test specific service
go test ./internal/domain/warehouse/loan -v -cover

# Expected: Coverage increases from 46.5% to 75%+
```

### Step 8: Repeat for all target services

Apply the same patterns to:
- [ ] activity service
- [ ] movement service
- [ ] company service
- [ ] user service
- [ ] notification service
- [ ] workspace service
- [ ] member service

See `3.1-service-error-paths.md` for domain-specific error scenarios.

## Quick Checklist Template

For each service, ensure you've added tests for:

- [ ] Validation errors (required fields, format checks)
- [ ] Not found errors (invalid IDs, wrong workspace)
- [ ] Pagination edge cases (negative, zero, beyond max)
- [ ] Foreign key violations
- [ ] Unique constraint violations
- [ ] State transition errors (invalid state changes)
- [ ] Database connection errors
- [ ] Transaction rollback scenarios

## Validation

After adding error tests to each service:

```bash
# Check individual service coverage
go test ./internal/domain/warehouse/loan -cover
go test ./internal/domain/auth/user -cover

# Run full validation
bash docs/go-tests/scripts/validate-phase-3.sh
```

## Phase 3 Validation

Run the complete validation:

```bash
bash docs/go-tests/scripts/validate-phase-3.sh
```

**Expected output:**
```
✓ Activity service: 75%+
✓ Movement service: 70%+
✓ Loan service: 75%+
✓ Company service: 70%+
✓ User service: 70%+
✓ Notification service: 70%+
✓ Workspace service: 70%+
✓ Member service: 70%+
✓ Overall coverage: 86.9%+
✓ All tests passing

Phase 3 Complete! ✅
```

## Troubleshooting

### Tests pass but coverage doesn't increase

```bash
# Clear cache
go clean -testcache

# Run with count=1 to bypass cache
go test ./internal/domain/warehouse/loan -count=1 -cover
```

### Mock expectations fail

- Ensure you're using `.Once()` or `.Times(n)` on mock calls
- Check that all mock calls have corresponding `.On()` setups
- Verify mock arguments match exactly

### Hard to test certain error paths

- Use dependency injection for better testability
- Extract complex logic into smaller, testable functions
- Use table-driven tests for multiple error scenarios

## Next Steps

After Phase 3 completion:
1. Commit: `git add . && git commit -m "Complete Phase 3 service error paths"`
2. Proceed to [Phase 4 Quick Start](../phase-4/QUICKSTART.md)
