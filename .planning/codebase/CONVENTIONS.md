# Coding Conventions

**Analysis Date:** 2026-01-22

## Naming Patterns

**Files:**
- Backend Go files: `lowercase_with_underscores.go` - e.g., `service.go`, `handler.go`, `repository.go`
- Test files: `*_test.go` - e.g., `scheduler_test.go`, `service_test.go`
- Frontend components: `PascalCase.tsx` - e.g., `Button.tsx`, `Card.tsx`, `InlineEditCell.tsx`
- Frontend utilities: `camelCase.ts` - e.g., `utils.ts`, `hooks.ts`

**Functions/Methods:**
- Backend Go: `PascalCase` for public functions/methods (exported), `camelCase` for private (unexported)
  - Example: `NewService()`, `Lookup()` (public), `lookupOpenFoodFacts()` (private)
- Frontend React: `PascalCase` for component functions, `camelCase` for utility functions
  - Example: `Button`, `InlineEditCell` (components), `handleSave()`, `cn()` (utilities)

**Variables:**
- Backend Go: `camelCase` for local variables and struct fields, `UPPERCASE` for constants
  - Example: `httpClient`, `openFoodFactsURL`, `ErrNotFound`
- Frontend TypeScript: `camelCase` for variables and function parameters
  - Example: `isEditing`, `editValue`, `isSaving`

**Types:**
- Backend Go: `PascalCase` for struct names, `lowerCase` for private unexported types
  - Example: `Service`, `Product`, `DomainError`
  - Private types: `openFoodFactsResponse`, `sentEmail`
- Frontend TypeScript: `PascalCase` for interfaces, types, and classes
  - Example: `InlineEditCellProps`, `CustomFixtures`, `Props`
- ENUMs in database: `UPPERCASE_WITH_UNDERSCORES` - e.g., `workspace_role_enum`, `item_status_enum`

## Code Style

**Formatting:**
- Backend Go: Uses `go fmt` (standard Go formatter)
- Frontend TypeScript: Uses ESLint configuration from `eslint.config.mjs`
- TypeScript target: ES2017 with strict mode enabled (tsconfig.json)

**Linting:**
- Backend Go: golangci-lint - run via `mise run lint`
- Frontend: ESLint with Next.js core web vitals config and TypeScript config
  - ESLint configuration: `frontend/eslint.config.mjs` extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`

## Import Organization

**Backend Go:**
1. Standard library imports (e.g., `context`, `encoding/json`, `fmt`)
2. Third-party imports (e.g., `github.com/stretchr/testify`, `github.com/google/uuid`)
3. Internal project imports (e.g., `github.com/antti/home-warehouse/...`)

Example from `backend/internal/domain/pendingchange/service.go`:
```go
import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	// ... more internal imports
)
```

**Frontend TypeScript:**
1. React and Next.js imports
2. Third-party UI libraries (e.g., `@radix-ui`, `lucide-react`)
3. Internal absolute imports using `@/` alias (configured in tsconfig.json)
4. Relative imports where necessary

Example from `frontend/app/[locale]/(auth)/login/page.tsx`:
```typescript
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
```

**Path Aliases:**
- Frontend: `@/*` maps to project root (configured in `frontend/tsconfig.json`)

## Error Handling

**Backend Go:**
- Uses error interface pattern with custom `DomainError` type
- Common sentinel errors defined in `backend/internal/shared/errors.go`:
  - `ErrNotFound`
  - `ErrAlreadyExists`
  - `ErrInvalidInput`
  - `ErrUnauthorized`
  - `ErrForbidden`
  - `ErrConflict`
  - `ErrInternal`
- Helper functions to check errors: `IsNotFound()`, `IsAlreadyExists()`, `IsInvalidInput()`
- Field-specific errors created with `NewFieldError(err, field, message)`
- Huma framework error handling: `huma.Error500InternalServerError()`, `huma.Error404NotFound()`, etc.

Example from `backend/internal/domain/barcode/handler.go`:
```go
product, err := svc.Lookup(ctx, input.Barcode)
if err != nil {
	return nil, huma.Error500InternalServerError("failed to lookup barcode")
}
```

**Frontend TypeScript:**
- Error handling in async operations with try-catch or .catch()
- State management for error messages in component hooks
- Page errors collected via Playwright fixture for test failure detection

Example from `frontend/components/ui/inline-edit-cell.tsx`:
```typescript
const [error, setError] = useState<string | null>(null);

const handleSave = async () => {
  try {
    setIsSaving(true);
    await onSave(editValue);
    // success handling
  } catch (err) {
    setError(err instanceof Error ? err.message : "An error occurred");
  }
};
```

## Logging

**Backend Go:**
- Uses standard `log` package
- Imported and used minimally for critical operations
- Example from `backend/internal/domain/warehouse/pendingchange/service.go`:
  ```go
  import "log"
  ```
- Actual logging patterns: TBD in implementation

**Frontend TypeScript:**
- Console logging for development/debugging
- No structured logging framework required in frontend

## Comments

**When to Comment:**
- Public functions/types: Always include comment documentation
- Complex logic: Comment non-obvious algorithm steps
- Workarounds/temporary fixes: Explain why the workaround exists
- Cross-cutting concerns: Note when code affects multiple areas

**Format:**
- Backend Go: Comments start with function/type name: `// FunctionName does X.`
  - Example: `// NewService creates a new barcode service.`
  - Example: `// Lookup looks up a barcode in external databases.`
- Frontend TypeScript: Comments explain logic or intent
  - Example: `// Collect page errors and fail test if any occur`

**Section Comments:**
- Backend Go uses section separators with comments for organizing test groups
  - Example in `backend/internal/jobs/scheduler_test.go`:
  ```go
  // =============================================================================
  // SchedulerConfig Tests
  // =============================================================================
  ```

**JSDoc/TSDoc:**
- Not extensively used in current codebase
- When needed, follow TypeScript conventions for type descriptions
- Component props documented via TypeScript interfaces/types

Example from `frontend/components/ui/inline-edit-cell.tsx`:
```typescript
interface InlineEditCellProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number";
  disabled?: boolean;
}
```

## Function Design

**Size:**
- Aim for functions under 50 lines in Go; break complex logic into smaller functions
- Example: `Lookup()` in barcode service (66 lines) with helper methods `lookupOpenFoodFacts()`, `lookupOpenProductsDB()`
- Frontend components: Keep render logic concise; extract complex logic into hooks or utilities

**Parameters:**
- Backend Go: Pass context as first parameter in functions that need it
  - Example: `func (s *Service) Lookup(ctx context.Context, barcode string) (*Product, error)`
- Backend Go: Use struct receivers for methods: `func (s *Service) Method() {}`
- Frontend TypeScript: Accept props as single object parameter
  - Example: `export function InlineEditCell({ value, onSave, className, ...props }: InlineEditCellProps)`

**Return Values:**
- Backend Go: Return (value, error) tuple for operations that can fail
  - Example: `func (s *Service) Lookup(ctx context.Context, barcode string) (*Product, error)`
- Backend Go: Return IDs and errors for create operations
  - Example: `func (s *Service) ApplyCreate(ctx context.Context, workspaceID uuid.UUID, payload json.RawMessage) (uuid.UUID, error)`
- Frontend TypeScript: Return values or promises as appropriate
  - Example: `const handleSave = async () => { ... }` returns Promise<void>

## Module Design

**Exports:**
- Backend Go: Use capitalized names for exported functions/types
  - Private/internal use lowercase names
  - Follow Go convention: public at package level
- Frontend TypeScript: Named exports preferred; default exports for page components
  - Example from `frontend/components/ui/button.tsx`:
  ```typescript
  export { Button, buttonVariants };
  ```

**Barrel Files:**
- Not commonly used in current codebase
- When used, follow pattern of re-exporting from index files

**Package Organization (Backend Go):**
- Clear domain/feature packages under `internal/`
- Separate concerns: `domain/` (business logic), `infra/` (infrastructure), `handlers/` (HTTP handlers)
- Example structure: `backend/internal/domain/warehouse/item/service.go`, `handler.go`, `repository.go`

## Testing Convention Details

**Table-Driven Tests (Backend Go):**
- Use struct slices with named test cases
- Example from `backend/internal/jobs/scheduler_test.go`:
```go
tests := []struct {
	name      string
	redisAddr string
}{
	{"localhost default port", "localhost:6379"},
	{"localhost custom port", "localhost:6380"},
	{"remote host", "redis.example.com:6379"},
}

for _, tt := range tests {
	t.Run(tt.name, func(t *testing.T) {
		config := jobs.DefaultSchedulerConfig(tt.redisAddr)
		assert.Equal(t, tt.redisAddr, config.RedisAddr)
	})
}
```

**Assertion Patterns (Backend Go):**
- Use `stretchr/testify/assert` for assertions
- Use `stretchr/testify/require` for assertions that should fail the test immediately
- Example: `require.NoError(t, err)` vs `assert.NoError(t, err)`

**Build Tags (Backend Go):**
- Integration tests use `//go:build integration` and `// +build integration` tags
- Example from `backend/tests/integration/import_test.go`:
```go
//go:build integration
// +build integration

package integration
```

---

*Convention analysis: 2026-01-22*
