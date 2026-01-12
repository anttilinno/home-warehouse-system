# Phase 5 Quick Start Guide

**Goal**: Fill remaining gaps to reach 95%+ coverage

## Pre-Flight Checklist

- [ ] Phase 4 is complete: `bash docs/go-tests/scripts/validate-phase-4.sh`
- [ ] Overall coverage is ~92%: `go test ./... -cover | grep total`

**Run pre-flight check:**
```bash
bash docs/go-tests/scripts/validate-phase-5.sh --pre-flight
```

## Overview

Phase 5 is about filling the final gaps to reach 95% coverage. This involves:
1. Testing router and API setup
2. Testing documentation routes
3. Completing batch operation tests
4. Systematic gap filling

## Task 5.1: Router and API Setup (3-4 hours)

### Step 1: Create router test

Create `internal/api/router_test.go`:

```go
package api_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/api"
	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

func TestNewRouter(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	cfg := &config.Config{
		JWTSecret:          "test-secret",
		JWTExpirationHours: 24,
		Debug:              true,
	}

	router := api.NewRouter(pool, cfg)

	assert.NotNil(t, router)

	t.Run("health endpoint is registered", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/health", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("CORS middleware is applied", func(t *testing.T) {
		req := httptest.NewRequest("OPTIONS", "/health", nil)
		req.Header.Set("Origin", "http://localhost:3000")
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.NotEmpty(t, rec.Header().Get("Access-Control-Allow-Origin"))
	})
}
```

### Step 2: Run router tests

```bash
go test ./internal/api -v -run TestNewRouter
```

## Task 5.2: Documentation Routes (2 hours)

### Step 1: Create or extend docs test

Create `internal/api/docs_test.go`:

```go
package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/api"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

func TestOpenAPISpec(t *testing.T) {
	pool := testutil.SetupTestDB(t)
	cfg := testutil.DefaultTestConfig()
	router := api.NewRouter(pool, cfg)

	t.Run("serves OpenAPI spec", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/openapi.json", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var spec map[string]interface{}
		err := json.Unmarshal(rec.Body.Bytes(), &spec)
		assert.NoError(t, err)
		assert.Equal(t, "3.0.0", spec["openapi"])
	})
}
```

### Step 2: Run docs tests

```bash
go test ./internal/api -v -run TestOpenAPI
```

## Task 5.3: Batch Operation Tests (5-6 hours)

Extend `internal/domain/batch/service_test.go` with comprehensive batch tests (see 5.3-batch-operations.md for complete templates).

Key tests to add:
- Multiple entity types in one batch
- Partial batch failures
- Validation errors
- Size limit enforcement

## Task 5.4: Gap Filling (8-10 hours)

### Step 1: Generate coverage report

```bash
go test ./... -coverprofile=gaps.out -covermode=atomic
go tool cover -html=gaps.out -o gaps.html
```

### Step 2: Open HTML report

```bash
open gaps.html  # or xdg-open gaps.html
```

### Step 3: Identify uncovered lines

Look for red (uncovered) code in the HTML report. Common gaps:
- Error handling branches
- Edge case validations
- Rarely used enum values
- Initialization code

### Step 4: Add targeted tests for gaps

For each uncovered section, add a specific test:

```go
// Example: testing uncovered error branch
func TestFunction_EdgeCase(t *testing.T) {
	// Setup that triggers the uncovered path
	result, err := Function(edgeCaseInput)

	assert.Error(t, err)
	// ... assertions
}
```

### Step 5: Iterate until 95%+

```bash
# After adding tests, check coverage again
go test ./... -coverprofile=gaps2.out -covermode=atomic
go tool cover -func=gaps2.out | grep total

# Expected: 95%+
```

### Quick Gap-Filling Strategy

1. **Focus on low-hanging fruit first** - simple error branches
2. **Use coverage diff** to see what changed:
   ```bash
   go tool cover -func=gaps.out | grep -v "100.0%" | sort -k3 -n > before.txt
   # ... add tests ...
   go tool cover -func=gaps2.out | grep -v "100.0%" | sort -k3 -n > after.txt
   diff before.txt after.txt
   ```
3. **Target packages <95%** until all reach threshold

## Phase 5 Validation

```bash
bash docs/go-tests/scripts/validate-phase-5.sh
```

**Expected output:**
```
✓ Router tests complete
✓ Documentation tests complete
✓ Batch tests complete
✓ All packages >= 90%
✓ Overall coverage: 95%+
✓ All tests passing

Phase 5 Complete! 🎉
You've achieved 95% test coverage!
```

## Final Checks

### Run complete test suite

```bash
# All tests with coverage
go test ./... -coverprofile=final.out -covermode=atomic -tags=integration

# View overall coverage
go tool cover -func=final.out | grep total

# Expected: total: (statements) 95.X%
```

### Generate final report

```bash
go tool cover -html=final.out -o final-coverage.html
open final-coverage.html
```

### Verify per-package coverage

```bash
# No package should be <90%
go tool cover -func=final.out | grep -v "100.0%" | sort -k3 -n | tail -20
```

## Success! 🎉

If all checks pass:
1. **Commit final changes**
   ```bash
   git add .
   git commit -m "Achieve 95% test coverage - Complete Phase 5"
   ```

2. **Create coverage badge**
   ```bash
   COVERAGE=$(go tool cover -func=final.out | grep total | awk '{print $3}')
   echo "Coverage: $COVERAGE"
   ```

3. **Document achievement**
   - Update README with coverage badge
   - Document test command in contributing guide
   - Set up CI to enforce 95% threshold

## Troubleshooting

### Stuck at 93-94%

- Review HTML report carefully
- Check for untested init() functions
- Look for unreachable code (can be removed)
- Check test build tags (`//go:build`)

### Some packages refuse to increase

- May have integration-only code
- Check if mocking is possible
- Consider refactoring for testability

### Tests slow down significantly

```bash
# Run unit tests only
go test ./... -short

# Profile slow tests
go test ./... -run TestSlowTest -cpuprofile=cpu.prof
go tool pprof cpu.prof
```

## Next Steps

**Congratulations!** You've completed the test coverage improvement plan and achieved 95% coverage!

Maintain this coverage by:
1. Running tests in CI/CD
2. Requiring tests for all new code
3. Reviewing coverage reports regularly
4. Keeping test execution fast (<5 min total)
