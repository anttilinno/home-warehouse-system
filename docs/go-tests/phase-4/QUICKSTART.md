# Phase 4 Quick Start Guide

**Goal**: Add integration tests to increase coverage from 86.9% → 91.9%

## Pre-Flight Checklist

- [ ] Phase 3 is complete: `bash docs/go-tests/scripts/validate-phase-3.sh`
- [ ] PostgreSQL is running: `docker ps | grep postgres`
- [ ] Test database exists: `psql -h localhost -U wh -d warehouse_test -c '\dt'`

**Run pre-flight check:**
```bash
bash docs/go-tests/scripts/validate-phase-4.sh --pre-flight
```

## Overview

Phase 4 adds E2E integration tests that use a real database. These tests verify that multiple components work together correctly.

## Database Setup

### Step 1: Ensure test database exists

```bash
# If using docker-compose
docker-compose up -d postgres

# Create test database if needed
psql -h localhost -U wh -c "CREATE DATABASE warehouse_test;" || true

# Run migrations on test database
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
dbmate up
```

## Task 4.1: E2E Integration Tests (15-20 hours)

### Step 1: Create integration test directory (if not exists)

```bash
mkdir -p tests/integration
```

### Step 2: Create attachment flow test

Create `tests/integration/attachment_flow_test.go`:

```go
//go:build integration
// +build integration

package integration_test

import (
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

func TestAttachmentUploadDownload(t *testing.T) {
	ts := testutil.NewTestServer(t)
	defer ts.Cleanup()

	token := ts.CreateUserAndLogin(t, "attach@example.com", "SecurePass123!")
	ts.SetToken(token)

	wsID := ts.CreateWorkspace(t, "Attachment Test WS")

	itemID := ts.CreateItem(t, wsID, testutil.ItemInput{
		Name: "Test Item",
		SKU:  "TEST-001",
	})

	t.Run("upload and download file", func(t *testing.T) {
		fileContent := []byte("test file content")
		resp := ts.UploadAttachment(
			fmt.Sprintf("/workspaces/%s/items/%s/attachments", wsID, itemID),
			"test.pdf",
			fileContent,
		)
		require.Equal(t, http.StatusCreated, resp.StatusCode)

		var attachment testutil.AttachmentResponse
		ts.ParseResponse(resp, &attachment)

		assert.Equal(t, "test.pdf", attachment.Filename)
		assert.Greater(t, attachment.FileSize, int64(0))

		downloadResp := ts.Get(fmt.Sprintf("/workspaces/%s/attachments/%s/download",
			wsID, attachment.ID))
		require.Equal(t, http.StatusOK, downloadResp.StatusCode)

		body, _ := io.ReadAll(downloadResp.Body)
		assert.Equal(t, fileContent, body)
	})

	t.Run("list attachments for item", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("/workspaces/%s/items/%s/attachments", wsID, itemID))
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var attachments []testutil.AttachmentResponse
		ts.ParseResponse(resp, &attachments)
		assert.Greater(t, len(attachments), 0)
	})
}
```

### Step 3: Run integration test

```bash
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
go test ./tests/integration -v -tags=integration -run TestAttachment
```

### Step 4: Create remaining E2E tests

Create these integration test files (see 4.1-e2e-integration-tests.md for templates):

- [ ] `activity_flow_test.go` - Activity tracking
- [ ] `movement_flow_test.go` - Inventory movement tracking
- [ ] `label_flow_test.go` - Label management
- [ ] `favorite_flow_test.go` - Favorite operations
- [ ] `company_flow_test.go` - Company CRUD
- [ ] `deleted_flow_test.go` - Soft delete/restore

## Task 4.2: Negative Integration Tests (10-12 hours)

### Step 1: Create permission test

Create `tests/integration/permission_test.go`:

```go
//go:build integration
// +build integration

package integration_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

func TestPermissionDenied(t *testing.T) {
	ts := testutil.NewTestServer(t)
	defer ts.Cleanup()

	// User 1 creates workspace
	user1Token := ts.CreateUserAndLogin(t, "user1@example.com", "Pass123!")
	ts.SetToken(user1Token)
	wsID := ts.CreateWorkspace(t, "User 1 Workspace")
	itemID := ts.CreateItem(t, wsID, testutil.ItemInput{Name: "User 1 Item"})

	// User 2 tries to access User 1's workspace
	user2Token := ts.CreateUserAndLogin(t, "user2@example.com", "Pass123!")
	ts.SetToken(user2Token)

	t.Run("cannot list items in other user's workspace", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("/workspaces/%s/items", wsID))
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("cannot get item from other user's workspace", func(t *testing.T) {
		resp := ts.Get(fmt.Sprintf("/workspaces/%s/items/%s", wsID, itemID))
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("cannot create item in other user's workspace", func(t *testing.T) {
		resp := ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID),
			`{"name":"Unauthorized Item"}`)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}
```

### Step 2: Create constraint violation test

Create `tests/integration/constraints_test.go`:

```go
//go:build integration
// +build integration

package integration_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

func TestConstraintViolations(t *testing.T) {
	ts := testutil.NewTestServer(t)
	defer ts.Cleanup()

	token := ts.CreateUserAndLogin(t, "constraint@example.com", "Pass123!")
	ts.SetToken(token)
	wsID := ts.CreateWorkspace(t, "Constraint Test WS")

	t.Run("cannot create item with duplicate SKU", func(t *testing.T) {
		ts.CreateItem(t, wsID, testutil.ItemInput{
			Name: "Item 1",
			SKU:  "DUPLICATE-SKU",
		})

		resp := ts.Post(fmt.Sprintf("/workspaces/%s/items", wsID),
			`{"name":"Item 2","sku":"DUPLICATE-SKU"}`)
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
	})

	t.Run("cannot delete category with items", func(t *testing.T) {
		catID := ts.CreateCategory(t, wsID, testutil.CategoryInput{Name: "Protected"})
		ts.CreateItem(t, wsID, testutil.ItemInput{
			Name:       "Item",
			CategoryID: &catID,
		})

		resp := ts.Delete(fmt.Sprintf("/workspaces/%s/categories/%s", wsID, catID))
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
	})
}
```

### Step 3: Run negative integration tests

```bash
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
go test ./tests/integration -v -tags=integration -run TestPermission

TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
go test ./tests/integration -v -tags=integration -run TestConstraint
```

### Step 4: Create remaining negative tests

See 4.2-negative-integration-tests.md for templates:

- [ ] `state_transitions_test.go` - Invalid state changes
- [ ] `isolation_test.go` - Cross-workspace isolation

## Running All Integration Tests

```bash
# Set environment variable
export TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable"

# Run all integration tests
go test ./tests/integration -v -tags=integration

# With coverage
go test ./tests/integration -v -tags=integration -coverprofile=integration-coverage.out
```

## Phase 4 Validation

```bash
bash docs/go-tests/scripts/validate-phase-4.sh
```

**Expected output:**
```
✓ PostgreSQL running
✓ Test database accessible
✓ Integration tests created: 10/10
✓ All integration tests pass
✓ Overall coverage: 91.9%+

Phase 4 Complete! ✅
```

## Troubleshooting

### Database connection fails

```bash
# Check postgres is running
docker ps | grep postgres

# Test connection
psql -h localhost -U wh -d warehouse_test -c "SELECT 1;"

# Check environment variable
echo $TEST_DATABASE_URL
```

### Integration tests timeout

```bash
# Increase timeout
go test ./tests/integration -v -tags=integration -timeout 5m
```

### Tests fail due to dirty database

```bash
# Reset test database
dropdb -h localhost -U wh warehouse_test
createdb -h localhost -U wh warehouse_test
dbmate -d db/migrations -e TEST_DATABASE_URL up
```

## Next Steps

After Phase 4:
1. Commit: `git add . && git commit -m "Complete Phase 4 integration tests"`
2. Proceed to [Phase 5 Quick Start](../phase-5/QUICKSTART.md)
