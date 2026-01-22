# Testing Patterns

**Analysis Date:** 2026-01-22

## Test Framework

**Backend - Go:**
- **Runner:** Go built-in testing via `go test`
- **Assertion Library:** `github.com/stretchr/testify/assert` and `github.com/stretchr/testify/require`
- **Test Database:** PostgreSQL test database (GO_TEST_DATABASE_URL in `.mise.toml`)
- **Task Configuration:** `.mise.toml` lines 80-92

**Frontend - TypeScript:**
- **Runner:** Playwright Test
- **Config:** `frontend/playwright.config.ts`
- **Assertion Library:** Playwright's `expect()` assertions
- **Test Reports:** HTML (local), GitHub annotations (CI), JUnit XML format
- **Browser Support:** Chromium, Firefox, WebKit

**Run Commands:**

Backend:
```bash
mise run test           # Run all tests (unit + integration)
mise run test-unit      # Run unit tests only (./internal/domain/...)
mise run test-integration # Run integration tests (./tests/integration/...)
mise run test-cover     # Run with coverage report (generates coverage.html)
```

Frontend:
```bash
mise run fe-test       # Run Playwright tests
mise run fe-test-ui    # Run with interactive UI
mise run fe-test-headed # Run in headed mode (show browser)
mise run fe-test-debug  # Debug mode
```

## Test File Organization

**Backend Go:**
- **Location:** Test files in same package as code
  - Source: `backend/internal/domain/barcode/service.go`
  - Tests: `backend/internal/domain/barcode/service_test.go`
  - Integration tests: `backend/tests/integration/*.go`
- **Naming:** `*_test.go` pattern
- **Package:** Test code uses `package_test` suffix (e.g., `jobs_test` for testing `jobs` package)

**Frontend TypeScript:**
- **Location:** E2E tests in `frontend/e2e/` directory
- **Naming:** `*.spec.ts` pattern
- **Structure:**
  - `e2e/auth.setup.ts` - Authentication setup (runs once before authenticated tests)
  - `e2e/smoke.spec.ts` - Basic smoke tests
  - `e2e/marketing.spec.ts` - Marketing page tests
  - `e2e/features/*.spec.ts` - Feature-specific tests (theme, pwa, sse-status, etc.)
  - `e2e/accessibility/*.spec.ts` - A11y tests
  - `e2e/dashboard/*.spec.ts` - Dashboard tests
  - `e2e/auth/*.spec.ts` - Auth flow tests
  - `e2e/pages/` - Page object models
  - `e2e/helpers/` - Test helpers
  - `e2e/fixtures/` - Custom fixtures

**Directory Structure:**
```
backend/
├── internal/domain/
│   ├── barcode/
│   │   ├── service.go
│   │   ├── service_test.go      # Unit tests
│   │   ├── handler.go
│   │   └── handler_test.go
│   └── ...
└── tests/integration/           # Integration tests
    ├── auth_test.go
    ├── import_test.go
    ├── warehouse_test.go
    └── ...

frontend/
└── e2e/
    ├── auth.setup.ts
    ├── smoke.spec.ts
    ├── features/
    ├── accessibility/
    ├── fixtures/
    └── helpers/
```

## Test Structure

**Backend Go - Unit Tests:**

Table-driven test pattern from `backend/internal/jobs/scheduler_test.go`:
```go
func TestDefaultSchedulerConfig_DifferentRedisAddresses(t *testing.T) {
	tests := []struct {
		name      string
		redisAddr string
	}{
		{"localhost default port", "localhost:6379"},
		{"localhost custom port", "localhost:6380"},
		{"remote host", "redis.example.com:6379"},
		{"IP address", "192.168.1.100:6379"},
		{"with password in addr", "redis:6379"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := jobs.DefaultSchedulerConfig(tt.redisAddr)
			assert.Equal(t, tt.redisAddr, config.RedisAddr)
		})
	}
}
```

**Backend Go - Integration Tests:**

From `backend/tests/integration/import_test.go`:
```go
//go:build integration
// +build integration

package integration

func TestImportJobWorkflow(t *testing.T) {
	ts := NewTestServer(t)  // Test server with DB
	ctx := context.Background()

	repo := postgres.NewImportJobRepository(ts.Pool)

	// Create test workspace and user
	workspaceID := uuid.New()
	userID := uuid.New()

	t.Run("CreateImportJob", func(t *testing.T) {
		// Arrange
		job, err := importjob.NewImportJob(...)
		require.NoError(t, err)

		// Act
		err = repo.SaveJob(ctx, job)

		// Assert
		require.NoError(t, err)
		assert.Equal(t, importjob.StatusPending, job.Status())
	})

	t.Run("ProcessImportJob", func(t *testing.T) {
		// Subtests for related flows
	})
}
```

**Frontend TypeScript - Playwright Tests:**

From `frontend/e2e/smoke.spec.ts`:
```typescript
import { test, expect } from "./fixtures/test";

test.describe("Smoke tests", () => {
  test("home page loads successfully", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/Home Warehouse/);
  });

  test("home page contains main content", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();
  });
});
```

**Patterns:**
- Backend Go: Arrange-Act-Assert pattern (visible in integration tests)
- Backend Go: Section comments group related test functions
  ```go
  // =============================================================================
  // SchedulerConfig Tests
  // =============================================================================
  ```
- Frontend: `test.describe()` groups related tests
- Frontend: Custom fixtures for test setup/teardown

## Mocking

**Backend Go:**

Mock interfaces in tests - example from `backend/internal/jobs/scheduler_test.go`:
```go
type mockEmailSender struct {
	sentEmails []sentEmail
}

type sentEmail struct {
	to           string
	borrowerName string
	itemName     string
	dueDate      time.Time
	isOverdue    bool
}

func (m *mockEmailSender) SendLoanReminder(ctx context.Context, to, borrowerName, itemName string, dueDate time.Time, isOverdue bool) error {
	m.sentEmails = append(m.sentEmails, sentEmail{
		to:           to,
		borrowerName: borrowerName,
		itemName:     itemName,
		dueDate:      dueDate,
		isOverdue:    isOverdue,
	})
	return nil
}
```

Then use in test:
```go
func TestScheduler_RegisterHandlers_WithMockEmailSender(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	mockSender := &mockEmailSender{}
	cleanupConfig := jobs.DefaultCleanupConfig()
	mux := scheduler.RegisterHandlers(mockSender, nil, cleanupConfig)

	assert.NotNil(t, mux)
}
```

**Backend Go Approach:**
- Use interface-based mocking (no mocking libraries)
- Create concrete mock structs that implement the interface
- Track calls and arguments in mock struct fields
- Verify side effects by checking mock state

**Frontend TypeScript:**
- Uses Playwright's built-in stubbing/interception for network requests
- Custom fixtures for collecting page errors
- Storage state fixtures for authentication persistence across tests

From `frontend/e2e/fixtures/test.ts`:
```typescript
pageErrors: [async ({ page }, use) => {
  const errors: Error[] = [];

  page.on("pageerror", (error) => {
    errors.push(error);
  });

  await use(errors);

  // After test completes, fail if there were any JavaScript errors
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.name}: ${e.message}`).join("\n");
    throw new Error(`Page had ${errors.length} JavaScript error(s):\n${errorMessages}`);
  }
}, { auto: true }]
```

**What to Mock:**
- Backend: External services, email senders, Redis clients
- Frontend: Network requests to backend API (can use Playwright mock handlers)

**What NOT to Mock:**
- Backend: Core business logic, repositories, domain entities (test with real DB in integration tests)
- Frontend: Page navigation, DOM interactions (test actual browser behavior)

## Fixtures and Factories

**Backend Go Test Fixtures:**

From `backend/tests/integration/*.go`:
- `NewTestServer(t)` - Creates test server with database connection
- Provides `ts.Pool` for database access
- Provides HTTP helper methods:
  ```go
  func TestRegister_Success(t *testing.T) {
    ts := NewTestServer(t)

    resp := ts.Post("/auth/register", map[string]string{
      "email":     email,
      "full_name": "Test User",
      "password":  "password123",
    })

    RequireStatus(t, resp, http.StatusOK)
    result := ParseResponse[...](t, resp)
  }
  ```

**Location:** `backend/tests/integration/` (TBD: helpers and setup)

**Frontend TypeScript Fixtures:**

From `frontend/e2e/fixtures/test.ts`:
```typescript
export const test = base.extend<CustomFixtures>({
  locale: ["en", { option: true }],
  apiURL: [process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000", { option: true }],
  pageErrors: [async ({ page }, use) => { ... }, { auto: true }],
});
```

**Location:** `frontend/e2e/fixtures/test.ts`

**Test Data:**
- Backend: Create entities in test itself via domain constructors and repositories
- Frontend: Use authentication setup from `e2e/auth.setup.ts` to establish logged-in state

## Coverage

**Backend Go:**
- **Requirement:** Not enforced (no minimum coverage)
- **View Coverage:**
  ```bash
  mise run test-cover   # Generates coverage.html
  ```
- **Output:** `backend/coverage.out` and `backend/coverage.html`

**Frontend TypeScript:**
- **Requirement:** Not enforced
- **Focus:** E2E tests over unit tests
- **Coverage tool:** Playwright has built-in coverage but not actively used

## Test Types

**Backend Go:**

**Unit Tests:**
- Located: `backend/internal/domain/*_test.go`
- Scope: Test individual functions/methods in isolation
- No database dependencies
- Example: `TestDefaultSchedulerConfig()` - tests configuration creation
- Run: `mise run test-unit` (runs `./internal/domain/...`)

**Integration Tests:**
- Located: `backend/tests/integration/*_test.go`
- Scope: Test multiple components working together with database
- Build tag: `//go:build integration` and `// +build integration`
- Requires: Running PostgreSQL instance
- Examples: `TestImportJobWorkflow()`, `TestRegister_Success()`
- Run: `mise run test-integration` (requires `dc-up`)

**Frontend TypeScript:**

**E2E Tests:**
- Framework: Playwright
- Scope: Test complete user workflows in real browser
- Types:
  - **Smoke tests** (`smoke.spec.ts`): Basic sanity checks
  - **Feature tests** (`features/*.spec.ts`): Individual feature flows
  - **Auth tests** (`auth/*.spec.ts`): Authentication/authorization flows
  - **Accessibility tests** (`accessibility/a11y.spec.ts`): A11y compliance
  - **Marketing tests** (`marketing.spec.ts`): Public pages
  - **Responsive tests** (`responsive.spec.ts`): Multiple screen sizes
  - **PWA tests** (`pwa.spec.ts`): Progressive web app functionality

**No Unit Tests:** Frontend uses E2E testing strategy exclusively

## Common Patterns

**Backend Go - Async Testing:**

Not typically used; Go tests are synchronous. For concurrent testing, use goroutines:
```go
func TestScheduler_ConcurrentClientAccess(t *testing.T) {
	config := jobs.DefaultSchedulerConfig("localhost:6379")
	scheduler := jobs.NewScheduler(nil, config)

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			client := scheduler.Client()
			require.NotNil(t, client)
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}
```

**Backend Go - Error Testing:**

Test both success and error cases with table-driven approach:
```go
func TestRegister_InvalidEmail(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/register", map[string]string{
		"email":     "invalid-email",
		"full_name": "Test User",
		"password":  "password123",
	})

	RequireStatus(t, resp, http.StatusUnprocessableEntity)
	resp.Body.Close()
}

func TestRegister_DuplicateEmail(t *testing.T) {
	ts := NewTestServer(t)

	// First registration succeeds
	resp := ts.Post("/auth/register", ...)
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Duplicate registration fails
	resp = ts.Post("/auth/register", ...)
	RequireStatus(t, resp, http.StatusConflict)
	resp.Body.Close()
}
```

**Frontend TypeScript - Page Navigation:**

```typescript
test("home page loads successfully", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveTitle(/Home Warehouse/);
});
```

**Frontend TypeScript - Authentication:**

Auth is set up once via `auth.setup.ts` and reused across tests via storage state:
```
playwright.config.ts:
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ]
```

Then authenticated tests automatically have session state loaded.

## Test Configuration Details

**Playwright Config:** `frontend/playwright.config.ts`
- **Test directory:** `./e2e`
- **Timeout:** 30 seconds per test
- **Retries:** 2 in CI, 0 locally
- **Workers:** 1 in CI, unlimited locally
- **Base URL:** `http://localhost:3001`
- **Trace:** `on-first-retry` (records trace on retry)
- **Screenshot:** `only-on-failure`
- **Video:** `on-first-retry`
- **Web Server:** Starts Next.js dev server automatically
- **Reporters:** GitHub annotations + HTML report in CI; HTML report locally

**Go Test Build Tags:**
- Unit tests: No special tag
- Integration tests: `//go:build integration` + `// +build integration`
- Run integration tests separately to skip database dependency when not needed

---

*Testing analysis: 2026-01-22*
