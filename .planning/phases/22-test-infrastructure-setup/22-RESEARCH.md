# Phase 22: Test Infrastructure Setup - Research

**Researched:** 2026-01-31
**Domain:** Testing infrastructure (Go factories, Vitest coverage, CI parallelization)
**Confidence:** HIGH

## Summary

This phase establishes testing foundations across three areas: Go test factories for backend, frontend coverage with mock utilities, and CI parallelization with coverage reporting. The project already has substantial test infrastructure in place (testutil package, integration test helpers, unit tests with Vitest), so this phase builds on existing patterns rather than starting from scratch.

The Go backend uses testify/mock for service tests and a TestServer setup for integration tests. The frontend uses Vitest with jsdom but lacks coverage reporting (@vitest/coverage-v8 not installed). The CI currently runs only E2E tests via Playwright with no parallelization for unit tests or Go tests.

**Primary recommendation:** Use the builder pattern with functional options for Go factories (matching existing codebase style), install @vitest/coverage-v8 for frontend coverage, and implement GitHub Actions matrix strategy for CI parallelization.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @vitest/coverage-v8 | ^4.0.17 | Frontend coverage provider | Native V8 coverage, faster than Istanbul, ships with Vitest |
| gofakeit | ^7.x | Go fake data generation | Most popular Go faker, struct tags support, deterministic seeding |
| testify | (existing) | Go test assertions and mocking | Already in use, standard for Go testing |
| msw | ^2.x | Mock Service Worker for API mocking | Industry standard for network mocking, works with Vitest |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | ^16.3.2 | React component testing | Already installed, for unit testing components |
| jsdom | ^27.4.0 | DOM environment for Vitest | Already installed, provides browser APIs |
| codecov-action | ^5 | Upload coverage to Codecov | For coverage badges and PR comments |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul is more accurate but slower; V8 now has AST-based remapping making it equally accurate since Vitest 3.2+ |
| gofakeit | go-testfixtures | go-testfixtures is YAML-based database fixtures; gofakeit is for programmatic test data generation. Both useful for different purposes |
| Codecov | Coveralls | Both work; Codecov has better monorepo support and GitHub integration |

**Installation:**
```bash
# Frontend
cd frontend && bun add -D @vitest/coverage-v8 msw

# Go (already has testify, add gofakeit)
cd backend && go get github.com/brianvoe/gofakeit/v7
```

## Architecture Patterns

### Recommended Go Factory Structure
```
backend/
├── internal/
│   └── testutil/
│       ├── handler.go           # Existing handler test setup
│       ├── event_capture.go     # Existing event capture
│       └── factory/             # NEW: test factories
│           ├── factory.go       # Factory struct with build methods
│           ├── item.go          # Item factory
│           ├── location.go      # Location factory
│           ├── container.go     # Container factory
│           ├── inventory.go     # Inventory factory
│           ├── user.go          # User factory
│           └── workspace.go     # Workspace factory
└── tests/
    ├── testdb/                  # Existing DB setup
    └── integration/
        └── setup.go             # Existing TestServer
```

### Recommended Frontend Test Structure
```
frontend/
├── lib/
│   ├── test-utils/              # NEW: shared test utilities
│   │   ├── index.ts             # Re-export all utilities
│   │   ├── factories.ts         # Entity factories (items, locations, etc.)
│   │   ├── offline-mock.ts      # IndexedDB/offline state mocking
│   │   ├── sync-mock.ts         # Sync manager mocking utilities
│   │   └── render.tsx           # Custom render with providers
│   └── [domain]/
│       └── __tests__/           # Existing pattern
└── vitest.config.ts             # Updated with coverage
```

### Pattern 1: Go Factory with Builder Pattern
**What:** Fluent API for building test entities with sensible defaults
**When to use:** Creating test data for service and handler tests
**Example:**
```go
// Source: Inspired by existing testutil patterns in codebase
package factory

type Factory struct {
    workspaceID uuid.UUID
    userID      uuid.UUID
}

func New() *Factory {
    return &Factory{
        workspaceID: uuid.MustParse("00000000-0000-0000-0000-000000000001"),
        userID:      uuid.MustParse("00000000-0000-0000-0000-000000000002"),
    }
}

func (f *Factory) WithWorkspace(id uuid.UUID) *Factory {
    f.workspaceID = id
    return f
}

type ItemOpt func(*item.Item)

func (f *Factory) Item(opts ...ItemOpt) *item.Item {
    i, _ := item.NewItem(f.workspaceID, gofakeit.ProductName(), gofakeit.LetterN(8), 0)
    for _, opt := range opts {
        opt(i)
    }
    return i
}

func WithName(name string) ItemOpt {
    return func(i *item.Item) {
        i.Update(item.UpdateInput{Name: name, MinStockLevel: i.MinStockLevel()})
    }
}

func WithCategory(catID uuid.UUID) ItemOpt {
    return func(i *item.Item) {
        i.Update(item.UpdateInput{Name: i.Name(), CategoryID: &catID, MinStockLevel: i.MinStockLevel()})
    }
}

// Usage:
// f := factory.New()
// testItem := f.Item(factory.WithName("Power Drill"))
```

### Pattern 2: Frontend Factory Functions
**What:** Simple factory functions matching existing test patterns
**When to use:** Creating test data for Vitest unit tests
**Example:**
```typescript
// Source: Pattern from existing frontend/lib/search/__tests__/offline-search.test.ts
// frontend/lib/test-utils/factories.ts
import type { Item } from "@/lib/types/items";

export function createItem(partial: Partial<Item> = {}): Item {
  return {
    id: partial.id ?? `item-${Date.now()}`,
    workspace_id: "ws-1",
    sku: partial.sku ?? `SKU-${Date.now()}`,
    name: partial.name ?? "Test Item",
    min_stock_level: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

// Similar for createLocation, createContainer, createBorrower, etc.
```

### Pattern 3: Offline State Mock Utilities
**What:** Utilities to mock IndexedDB and network state for offline testing
**When to use:** Testing offline-first functionality
**Example:**
```typescript
// frontend/lib/test-utils/offline-mock.ts
import { vi } from "vitest";
import * as offlineDb from "@/lib/db/offline-db";
import * as mutationQueue from "@/lib/sync/mutation-queue";

export function mockOfflineState(data: {
  items?: Item[];
  locations?: Location[];
  containers?: Container[];
}) {
  vi.mocked(offlineDb.getAll).mockImplementation(async (store) => {
    switch (store) {
      case "items": return data.items ?? [];
      case "locations": return data.locations ?? [];
      case "containers": return data.containers ?? [];
      default: return [];
    }
  });
}

export function mockOnlineState() {
  vi.mocked(navigator, 'onLine', { get: () => true });
}

export function mockOffline() {
  vi.mocked(navigator, 'onLine', { get: () => false });
}

export function mockPendingMutations(mutations: MutationQueueEntry[]) {
  vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue(mutations);
}
```

### Anti-Patterns to Avoid
- **Manual entity construction in every test:** Use factories instead to ensure consistent defaults and reduce boilerplate
- **Testing against real databases without isolation:** Each test should have isolated data (existing setup.go handles this)
- **Hardcoded UUIDs scattered across tests:** Use factory defaults or generate deterministically with gofakeit.Seed()

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fake data generation | Custom random generators | gofakeit | Handles edge cases, localization, deterministic seeding |
| API mocking in tests | vi.fn() for each fetch call | MSW handlers | Intercepts at network level, reusable across tests |
| Coverage thresholds | Manual validation scripts | Vitest coverage thresholds | Fails CI automatically, per-file thresholds supported |
| Coverage badges | Custom badge generation | Codecov GitHub Action | Automatic badges, PR comments, historical tracking |
| Test parallelization | Manual job splitting | GitHub Actions matrix | Automatic distribution, easy scaling |

**Key insight:** The existing codebase already has good patterns (testutil package, TestServer, factory functions in tests) - this phase standardizes and extracts them into reusable utilities rather than reinventing approaches.

## Common Pitfalls

### Pitfall 1: Test Parallelization with Shared State
**What goes wrong:** Tests interfere with each other when running in parallel
**Why it happens:** Shared database state, global variables, or sequential assumptions
**How to avoid:**
- Go: Use unique workspace IDs per test (existing pattern with `uuid.New().String()[:8]`)
- Frontend: Mock all external dependencies, don't share state between tests
- Database: Current testdb.CleanupTestDB() runs after each test
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 2: Coverage Including Generated Code
**What goes wrong:** Coverage reports include sqlc-generated code, skewing metrics
**Why it happens:** Default include patterns capture all .go files
**How to avoid:** Configure exclude patterns for generated code
```typescript
// vitest.config.ts
coverage: {
  exclude: ['**/node_modules/**', '**/dist/**', '**/*.d.ts']
}
```
```yaml
# Go: Use build tags or exclude paths
go test -coverprofile=coverage.out ./internal/... -covermode=atomic
```
**Warning signs:** Coverage percentages seem artificially high or low

### Pitfall 3: Flaky Offline Tests
**What goes wrong:** Tests pass locally but fail in CI due to timing issues
**Why it happens:** IndexedDB operations are async, mocks may not be ready
**How to avoid:** Always await operations, use proper mock setup in beforeEach
**Warning signs:** Intermittent test failures, "timeout" errors

### Pitfall 4: CI Timeout Due to Sequential Tests
**What goes wrong:** CI takes too long, times out at 30 minutes
**Why it happens:** Running all tests sequentially instead of in parallel
**How to avoid:**
- Use GitHub Actions matrix for parallelization
- Set appropriate workers in Playwright config (currently `workers: 1` in CI)
- Split Go tests: unit vs integration
**Warning signs:** CI time > 10 minutes for test phase

### Pitfall 5: go-testfixtures Parallel Execution
**What goes wrong:** Random test failures with database fixtures
**Why it happens:** go-testfixtures doesn't support parallel execution
**How to avoid:** Use `go test -p 1 ./...` for fixture-based tests, or use factories instead
**Warning signs:** Tests fail randomly when run with `go test ./...`

## Code Examples

Verified patterns from official sources and existing codebase:

### Vitest Coverage Configuration
```typescript
// Source: https://vitest.dev/config/coverage
// frontend/vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["lib/**/__tests__/**/*.test.ts", "components/**/__tests__/**/*.test.tsx"],
    exclude: ["node_modules", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      reportsDirectory: "./coverage",
      include: ["lib/**/*.ts", "lib/**/*.tsx", "components/**/*.tsx"],
      exclude: [
        "**/*.d.ts",
        "**/types/**",
        "**/__tests__/**",
        "**/node_modules/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

### GitHub Actions Matrix for Test Parallelization
```yaml
# Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  go-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-type: [unit, integration]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.25'

      - name: Run unit tests
        if: matrix.test-type == 'unit'
        run: |
          cd backend
          go test -v -race -coverprofile=coverage-unit.out ./internal/...

      - name: Run integration tests
        if: matrix.test-type == 'integration'
        run: |
          cd backend
          go test -v -tags=integration -coverprofile=coverage-int.out ./tests/integration/...

  frontend-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-type: [unit, e2e]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: cd frontend && bun install

      - name: Run unit tests with coverage
        if: matrix.test-type == 'unit'
        run: cd frontend && bun run test:unit --coverage

      - name: Run E2E tests
        if: matrix.test-type == 'e2e'
        run: cd frontend && bun run test

  coverage:
    needs: [go-tests, frontend-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: codecov/codecov-action@v5
        with:
          files: ./backend/coverage-unit.out,./backend/coverage-int.out,./frontend/coverage/lcov.info
```

### MSW Setup for Vitest
```typescript
// Source: https://mswjs.io/docs/integrations/node
// frontend/lib/test-utils/msw-server.ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/workspaces/:id/items", () => {
    return HttpResponse.json({ items: [], total: 0 });
  }),
  // Add more handlers as needed
];

export const server = setupServer(...handlers);

// In vitest.setup.ts
import { beforeAll, afterAll, afterEach } from "vitest";
import { server } from "./lib/test-utils/msw-server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Go Factory with gofakeit
```go
// Source: https://github.com/brianvoe/gofakeit
// backend/internal/testutil/factory/item.go
package factory

import (
    "github.com/brianvoe/gofakeit/v7"
    "github.com/google/uuid"

    "github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
)

func init() {
    // Set seed for reproducible tests when needed
    // gofakeit.Seed(0) // Uncomment for deterministic output
}

func (f *Factory) Item(opts ...ItemOpt) *item.Item {
    sku := gofakeit.LetterN(3) + "-" + gofakeit.DigitN(5)
    name := gofakeit.ProductName()

    i, err := item.NewItem(f.workspaceID, name, sku, 0)
    if err != nil {
        panic(err) // Factory should never fail with defaults
    }

    for _, opt := range opts {
        opt(i)
    }
    return i
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Istanbul coverage | V8 coverage with AST remapping | Vitest 3.2+ (2025) | Same accuracy, faster execution |
| Manual test data | Factory pattern with gofakeit | Go 1.18+ generics | Type-safe, composable factories |
| Jest for React | Vitest | 2023-2024 | Faster, ESM native, better Vite integration |
| Manual CI parallelization | GitHub Actions matrix | 2020+ | Declarative, auto-scaling |

**Deprecated/outdated:**
- Istanbul coverage provider: Still works but V8 is now preferred for speed
- @testing-library/react-hooks: Merged into @testing-library/react in v14+

## Open Questions

Things that couldn't be fully resolved:

1. **Exact coverage threshold per package**
   - What we know: 80% is the milestone target
   - What's unclear: Should some packages (handlers vs domain logic) have different thresholds?
   - Recommendation: Start with 80% global, adjust per-package after initial measurement

2. **E2E test parallelization worker count**
   - What we know: Currently `workers: 1` in CI for stability
   - What's unclear: How many parallel workers can CI handle without flakiness?
   - Recommendation: Test with workers: 2, then 4, measure stability before increasing

3. **Shared Go test database instance**
   - What we know: Current setup creates pool per test, truncates after
   - What's unclear: Would a single shared pool with per-test transactions be faster?
   - Recommendation: Keep current approach for reliability, optimize later if needed

## Sources

### Primary (HIGH confidence)
- [Vitest Coverage Configuration](https://vitest.dev/config/coverage) - Coverage options, thresholds, reporters
- [Next.js Vitest Guide](https://nextjs.org/docs/app/guides/testing/vitest) - Next.js specific setup
- [gofakeit GitHub](https://github.com/brianvoe/gofakeit) - Go fake data generation
- Existing codebase patterns: `backend/internal/testutil/`, `frontend/lib/search/__tests__/`

### Secondary (MEDIUM confidence)
- [GitHub Actions Matrix Strategy](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix) - CI parallelization
- [MSW Documentation](https://mswjs.io/) - API mocking for tests
- [Shields.io Codecov Badge](https://shields.io/badges/codecov) - Coverage badge integration

### Tertiary (LOW confidence)
- [Factory pattern for Go tests](https://www.stormkit.io/blog/factory-pattern-for-go-tests) - Community pattern guidance
- [go-testfixtures](https://github.com/go-testfixtures/testfixtures) - Alternative fixture approach (not recommended due to parallel execution issues)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified via official documentation and NPM/Go packages
- Architecture: HIGH - Based on existing codebase patterns and official guides
- Pitfalls: MEDIUM - Gathered from community sources and experience, some specifics may vary

**Research date:** 2026-01-31
**Valid until:** 60 days (testing libraries are stable, CI patterns don't change frequently)
