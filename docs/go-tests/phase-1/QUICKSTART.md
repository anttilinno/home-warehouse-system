# Phase 1 Quick Start Guide

**Goal**: Add middleware, entity, and job tests to increase coverage from 38.9% → 53.9%

## Pre-Flight Checklist

Before starting Phase 1, verify:

- [ ] Go 1.21+ installed: `go version`
- [ ] Project dependencies installed: `go mod download`
- [ ] Tests currently pass: `go test ./... -short`
- [ ] You're in project root: `pwd` should end with `/home-warehouse-system`
- [ ] Git working tree is clean: `git status`
- [ ] Database is running (for integration tests): `docker ps | grep postgres`

**Run pre-flight check:**
```bash
bash docs/go-tests/scripts/validate-phase-1.sh --pre-flight
```

## Task 1.1: Middleware Testing (3-4 hours)

### Step 1: Create auth middleware test file

```bash
# Create the test file
touch internal/api/middleware/auth_test.go
```

### Step 2: Add test code

Copy this complete template into `internal/api/middleware/auth_test.go`:

```go
package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/pkg/jwt"
)

// MockJWTService for testing
type MockJWTService struct {
	mock.Mock
}

func (m *MockJWTService) ValidateToken(token string) (*jwt.Claims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*jwt.Claims), args.Error(1)
}

func (m *MockJWTService) GenerateToken(userID uuid.UUID, email string) (string, error) {
	args := m.Called(userID, email)
	return args.String(0), args.Error(1)
}

// Test helper: create a simple handler that returns 200 OK
func testHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
}

func TestJWTAuth_ValidToken(t *testing.T) {
	mockJWT := new(MockJWTService)
	userID := uuid.New()

	mockJWT.On("ValidateToken", "valid-token").Return(&jwt.Claims{
		UserID: userID,
		Email:  "test@example.com",
	}, nil)

	handler := middleware.JWTAuth(mockJWT)(testHandler())
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	mockJWT.AssertExpectations(t)
}

func TestJWTAuth_MissingToken(t *testing.T) {
	mockJWT := new(MockJWTService)

	handler := middleware.JWTAuth(mockJWT)(testHandler())
	req := httptest.NewRequest("GET", "/", nil)
	// No Authorization header
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestJWTAuth_InvalidTokenFormat(t *testing.T) {
	mockJWT := new(MockJWTService)

	handler := middleware.JWTAuth(mockJWT)(testHandler())
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "InvalidFormat token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestJWTAuth_ExpiredToken(t *testing.T) {
	mockJWT := new(MockJWTService)

	mockJWT.On("ValidateToken", "expired-token").Return(nil, jwt.ErrExpiredToken)

	handler := middleware.JWTAuth(mockJWT)(testHandler())
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer expired-token")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	mockJWT.AssertExpectations(t)
}

func TestJWTAuth_InvalidSignature(t *testing.T) {
	mockJWT := new(MockJWTService)

	mockJWT.On("ValidateToken", "bad-signature").Return(nil, jwt.ErrInvalidSignature)

	handler := middleware.JWTAuth(mockJWT)(testHandler())
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer bad-signature")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	mockJWT.AssertExpectations(t)
}
```

### Step 3: Run the tests

```bash
go test ./internal/api/middleware -v -run TestJWTAuth
```

**Expected output:**
```
=== RUN   TestJWTAuth_ValidToken
--- PASS: TestJWTAuth_ValidToken (0.00s)
=== RUN   TestJWTAuth_MissingToken
--- PASS: TestJWTAuth_MissingToken (0.00s)
=== RUN   TestJWTAuth_InvalidTokenFormat
--- PASS: TestJWTAuth_InvalidTokenFormat (0.00s)
=== RUN   TestJWTAuth_ExpiredToken
--- PASS: TestJWTAuth_ExpiredToken (0.00s)
=== RUN   TestJWTAuth_InvalidSignature
--- PASS: TestJWTAuth_InvalidSignature (0.00s)
PASS
ok      github.com/antti/home-warehouse/go-backend/internal/api/middleware
```

### Step 4: Create workspace middleware test

Create `internal/api/middleware/workspace_test.go` with similar structure (follow pattern in 1.1-middleware-testing.md)

### Step 5: Create error transformer test

Create `internal/api/middleware/errors_test.go` (follow pattern in 1.1-middleware-testing.md)

### Step 6: Verify middleware coverage

```bash
go test ./internal/api/middleware -cover
```

**Expected:** Coverage >= 95%

### Troubleshooting Task 1.1

**Problem: Import errors**
```bash
# Fix imports
go mod tidy
```

**Problem: Mock interface doesn't match**
- Check `internal/pkg/jwt` interface definition
- Ensure mock methods match exactly

**Problem: Tests fail with "context key not found"**
- Verify middleware is setting context correctly
- Check context key constants

---

## Task 1.2: Entity Validation Tests (8-10 hours)

### Step 1: Start with Item entity tests

```bash
# Create the test file
touch internal/domain/warehouse/item/entity_test.go
```

### Step 2: Add item entity test template

Copy this into `internal/domain/warehouse/item/entity_test.go`:

```go
package item_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
)

func TestNewItem(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		name    string
		input   item.CreateInput
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid item with all fields",
			input: item.CreateInput{
				Name:        "Laptop",
				SKU:         "LAP-001",
				Description: "MacBook Pro 16-inch",
				Brand:       "Apple",
				Model:       "MacBook Pro 16",
			},
			wantErr: false,
		},
		{
			name: "valid item with minimal fields",
			input: item.CreateInput{
				Name: "Laptop",
			},
			wantErr: false,
		},
		{
			name: "missing required name",
			input: item.CreateInput{
				SKU: "LAP-001",
			},
			wantErr: true,
			errMsg:  "name is required",
		},
		{
			name: "empty name",
			input: item.CreateInput{
				Name: "",
			},
			wantErr: true,
			errMsg:  "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item, err := item.NewItem(workspaceID, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, item)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, item)
				assert.Equal(t, workspaceID, item.WorkspaceID)
				assert.Equal(t, tt.input.Name, item.Name)
				assert.NotEqual(t, uuid.Nil, item.ID)
				assert.NotEmpty(t, item.ShortCode)
			}
		})
	}
}

func TestItem_Update(t *testing.T) {
	workspaceID := uuid.New()
	testItem, _ := item.NewItem(workspaceID, item.CreateInput{
		Name: "Original Name",
		SKU:  "ORIG-001",
	})

	tests := []struct {
		name    string
		update  item.UpdateInput
		wantErr bool
		errMsg  string
	}{
		{
			name: "update name",
			update: item.UpdateInput{
				Name: strPtr("Updated Name"),
			},
			wantErr: false,
		},
		{
			name: "update SKU",
			update: item.UpdateInput{
				SKU: strPtr("UPD-001"),
			},
			wantErr: false,
		},
		{
			name: "update to empty name",
			update: item.UpdateInput{
				Name: strPtr(""),
			},
			wantErr: true,
			errMsg:  "name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh item for each test
			item, _ := item.NewItem(workspaceID, item.CreateInput{
				Name: "Original Name",
				SKU:  "ORIG-001",
			})

			err := item.Update(tt.update)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				if tt.update.Name != nil {
					assert.Equal(t, *tt.update.Name, item.Name)
				}
			}
		})
	}
}

// Helper function
func strPtr(s string) *string {
	return &s
}
```

### Step 3: Run item entity tests

```bash
go test ./internal/domain/warehouse/item -v -run TestNewItem
go test ./internal/domain/warehouse/item -v -run TestItem_Update
```

### Step 4: Repeat for all entities

Create entity tests for:
- [ ] `location/entity_test.go`
- [ ] `container/entity_test.go`
- [ ] `inventory/entity_test.go`
- [ ] `loan/entity_test.go`
- [ ] `borrower/entity_test.go`
- [ ] `auth/user/entity_test.go`
- [ ] `auth/workspace/entity_test.go`
- [ ] `auth/member/entity_test.go`

Follow the same pattern as item entity tests (see 1.2-entity-validation.md for details)

### Step 5: Verify entity coverage

```bash
# Test all entity files
go test ./internal/domain/warehouse/item -cover
go test ./internal/domain/warehouse/location -cover
go test ./internal/domain/auth/user -cover
```

**Expected:** Each entity package >= 90% coverage

---

## Task 1.3: Job Testing (3-4 hours)

### Step 1: Create scheduler test file

```bash
touch internal/jobs/scheduler_test.go
```

### Step 2: Add scheduler tests

Copy this into `internal/jobs/scheduler_test.go`:

```go
package jobs_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/jobs"
)

func TestDefaultSchedulerConfig(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")

	assert.NotNil(t, config)
	assert.Equal(t, "localhost:6379", config.RedisAddr)
	assert.Greater(t, config.Concurrency, 0)
	assert.NotEmpty(t, config.Queues)
}

func TestSchedulerConfig_Validation(t *testing.T) {
	tests := []struct {
		name    string
		config  jobs.SchedulerConfig
		wantErr bool
	}{
		{
			name: "valid config",
			config: jobs.SchedulerConfig{
				RedisAddr:   "localhost:6379",
				Concurrency: 10,
				Queues: map[string]int{
					"critical": 6,
					"default":  3,
					"low":      1,
				},
			},
			wantErr: false,
		},
		{
			name: "missing redis address",
			config: jobs.SchedulerConfig{
				RedisAddr:   "",
				Concurrency: 10,
			},
			wantErr: true,
		},
		{
			name: "invalid concurrency",
			config: jobs.SchedulerConfig{
				RedisAddr:   "localhost:6379",
				Concurrency: 0,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
```

### Step 3: Add loan reminder tests

Create `internal/jobs/loan_reminders_test.go` (see 1.3-job-testing.md for template)

### Step 4: Add cleanup tests

Create `internal/jobs/cleanup_test.go` (see 1.3-job-testing.md for template)

### Step 5: Run job tests

```bash
go test ./internal/jobs -v -short
```

### Step 6: Verify job coverage

```bash
go test ./internal/jobs -cover -short
```

**Expected:** Coverage >= 40%

---

## Phase 1 Validation

After completing all tasks, run the validation script:

```bash
bash docs/go-tests/scripts/validate-phase-1.sh
```

**Expected output:**
```
✓ Middleware coverage: 95%+
✓ Entity tests created: 9/9
✓ Entity coverage: 90%+
✓ Job tests coverage: 40%+
✓ Overall coverage: 53.9%+
✓ All tests passing

Phase 1 Complete! ✅
```

## Troubleshooting

### All tests fail with import errors
```bash
go mod tidy
go mod download
```

### Coverage not increasing
```bash
# Clear test cache
go clean -testcache

# Re-run with fresh cache
go test ./... -count=1 -cover
```

### Specific package tests fail
```bash
# Run with verbose output
go test ./path/to/package -v

# Run specific test
go test ./path/to/package -v -run TestName
```

## Next Steps

After Phase 1 completion:
1. Commit your changes: `git add . && git commit -m "Complete Phase 1 test coverage"`
2. Proceed to [Phase 2 Quick Start](../phase-2/QUICKSTART.md)
