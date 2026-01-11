## Phase 0: Project Setup

### 0.1 Initialize Go Module & Install Dependencies

```bash
mkdir go-backend && cd go-backend
go mod init github.com/antti/home-warehouse-system/go-backend

# Install dependencies
go get github.com/go-chi/chi/v5
go get github.com/danielgtaylor/huma/v2
go get github.com/jackc/pgx/v5
go get github.com/google/uuid
go get github.com/joho/godotenv
go get github.com/stretchr/testify
```

### 0.2 Project Structure

```
go-backend/
├── cmd/
│   └── server/main.go
├── internal/
│   ├── domain/
│   │   ├── auth/
│   │   │   ├── user/
│   │   │   ├── workspace/
│   │   │   ├── member/
│   │   │   └── notification/
│   │   └── warehouse/
│   │       ├── item/
│   │       ├── category/
│   │       ├── location/
│   │       ├── container/
│   │       ├── inventory/
│   │       ├── loan/
│   │       ├── borrower/
│   │       ├── company/
│   │       ├── label/
│   │       ├── attachment/
│   │       ├── movement/
│   │       ├── favorite/
│   │       └── activity/
│   ├── shared/
│   │   ├── apierror/
│   │   │   ├── codes.go      # All error codes (frontend translation keys)
│   │   │   └── error.go      # APIError struct and constructors
│   │   ├── pagination.go
│   │   └── uuid.go
│   ├── infra/
│   │   ├── postgres/
│   │   └── queries/          # sqlc generated (don't edit)
│   └── api/
│       ├── router.go
│       └── middleware/
├── db/
│   ├── migrations/           # dbmate (copy from existing)
│   └── queries/              # sqlc query files
├── tests/
│   └── integration/
├── sqlc.yaml
├── .air.toml
├── Dockerfile
└── go.mod
```

### 0.3 Configure sqlc

```yaml
# sqlc.yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "db/queries/"
    schema: "db/migrations/"
    gen:
      go:
        package: "queries"
        out: "internal/infra/queries"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_empty_slices: true
        emit_pointers_for_null_types: true
        overrides:
          - db_type: "uuid"
            go_type: "github.com/google/uuid.UUID"
          - db_type: "timestamptz"
            go_type: "time.Time"
```

### 0.4 Mise Configuration

Add the following to the root `.mise.toml` to add Go backend tasks (prefix with `go-` to distinguish from Python backend):

**Tools section update:**

```toml
[tools]
python = "3.14"
uv = "latest"
bun = "latest"
dbmate = "latest"
go = "1.23"           # Add Go
sqlc = "latest"       # Add sqlc
```

**Environment variables:**

```toml
[env]
# Existing variables...

# Go backend specific
GO_DATABASE_URL = "postgresql://wh:wh@localhost:5432/warehouse_dev?sslmode=disable"
GO_TEST_DATABASE_URL = "postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable"
```

**Go backend tasks:**

```toml
# Go Backend Tasks
# ================

[tasks.go-dev]
description = "Run Go backend dev server with hot reload"
depends = ["dc-up"]
run = "cd go-backend && air"

[tasks.go-run]
description = "Run Go backend server (no hot reload)"
depends = ["dc-up"]
run = "cd go-backend && go run cmd/server/main.go"

[tasks.go-build]
description = "Build Go backend binary"
run = "cd go-backend && CGO_ENABLED=0 go build -o bin/server cmd/server/main.go"

[tasks.go-test]
description = "Run Go backend tests"
run = "cd go-backend && go test -v ./..."

[tasks.go-test-cover]
description = "Run Go backend tests with coverage"
run = "cd go-backend && go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html"

[tasks.go-test-unit]
description = "Run Go backend unit tests only"
run = "cd go-backend && go test -v ./internal/domain/..."

[tasks.go-test-integration]
description = "Run Go backend integration tests"
depends = ["dc-up"]
run = "cd go-backend && go test -v ./tests/integration/..."

[tasks.go-lint]
description = "Run Go backend linter"
run = "cd go-backend && golangci-lint run"

[tasks.go-fmt]
description = "Format Go backend code"
run = "cd go-backend && go fmt ./..."

[tasks.go-sqlc]
description = "Generate sqlc code from queries"
run = "cd go-backend && sqlc generate"

[tasks.go-sqlc-vet]
description = "Verify sqlc queries are valid"
run = "cd go-backend && sqlc vet"

[tasks.go-generate]
description = "Run migrations and generate sqlc code"
depends = ["migrate", "go-sqlc"]

[tasks.go-migrate]
description = "Run database migrations for Go backend"
depends = ["dc-up"]
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations up"

[tasks.go-migrate-new]
description = "Create new Go backend migration"
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations new"

[tasks.go-migrate-down]
description = "Rollback last Go backend migration"
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations down"

[tasks.go-migrate-status]
description = "Check Go backend migration status"
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations status"

[tasks.go-db-reset]
description = "Reset Go backend database"
depends = ["dc-up"]
run = "DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations drop && DATABASE_URL=$GO_DATABASE_URL dbmate -d go-backend/db/migrations up"

[tasks.go-mod-tidy]
description = "Tidy Go backend dependencies"
run = "cd go-backend && go mod tidy"

[tasks.go-mod-download]
description = "Download Go backend dependencies"
run = "cd go-backend && go mod download"

# Combined start task (optional - run both backends)
[tasks.start-all]
description = "Start all services (containers, Python backend, Go backend, frontend)"
depends = ["dc-up", "migrate"]
run = "mise run dev & mise run go-dev & mise run fe-dev"
```

### 0.5 Quick Reference: Mise Commands

| Command | Purpose |
|---------|---------|
| `mise run go-dev` | Start Go backend with hot reload |
| `mise run go-run` | Start Go backend (no hot reload) |
| `mise run go-build` | Build production binary |
| `mise run go-test` | Run all tests |
| `mise run go-test-cover` | Run tests with coverage report |
| `mise run go-test-unit` | Run unit tests only |
| `mise run go-lint` | Run linter (golangci-lint) |
| `mise run go-fmt` | Format code |
| `mise run go-sqlc` | Generate sqlc code |
| `mise run go-sqlc-vet` | Verify sqlc queries |
| `mise run go-generate` | Migrate + sqlc generate |
| `mise run go-migrate` | Apply migrations |
| `mise run go-migrate-new` | Create new migration |
| `mise run go-migrate-down` | Rollback last migration |
| `mise run go-db-reset` | Drop and recreate database |
| `mise run go-mod-tidy` | Tidy Go dependencies |

### 0.6 API Error Codes (Frontend Translation Support)

Create a centralized error code system that enables frontend i18n:

**Error Code Registry** (`internal/shared/apierror/codes.go`):

```go
package apierror

// ErrorCode is a machine-readable error identifier for frontend translation
type ErrorCode string

// Auth errors (1xxx)
const (
    ErrCodeUnauthorized       ErrorCode = "AUTH_UNAUTHORIZED"        // 1001
    ErrCodeInvalidToken       ErrorCode = "AUTH_INVALID_TOKEN"       // 1002
    ErrCodeTokenExpired       ErrorCode = "AUTH_TOKEN_EXPIRED"       // 1003
    ErrCodeInvalidCredentials ErrorCode = "AUTH_INVALID_CREDENTIALS" // 1004
    ErrCodeSessionExpired     ErrorCode = "AUTH_SESSION_EXPIRED"     // 1005
)

// User errors (2xxx)
const (
    ErrCodeUserNotFound     ErrorCode = "USER_NOT_FOUND"      // 2001
    ErrCodeEmailRequired    ErrorCode = "USER_EMAIL_REQUIRED" // 2002
    ErrCodeEmailInvalid     ErrorCode = "USER_EMAIL_INVALID"  // 2003
    ErrCodeEmailTaken       ErrorCode = "USER_EMAIL_TAKEN"    // 2004
    ErrCodePasswordInvalid  ErrorCode = "USER_PASSWORD_INVALID" // 2005
    ErrCodePasswordTooWeak  ErrorCode = "USER_PASSWORD_TOO_WEAK" // 2006
)

// Workspace errors (3xxx)
const (
    ErrCodeWorkspaceNotFound      ErrorCode = "WORKSPACE_NOT_FOUND"       // 3001
    ErrCodeWorkspaceSlugTaken     ErrorCode = "WORKSPACE_SLUG_TAKEN"      // 3002
    ErrCodeWorkspaceAccessDenied  ErrorCode = "WORKSPACE_ACCESS_DENIED"   // 3003
    ErrCodeCannotDeletePersonal   ErrorCode = "WORKSPACE_CANNOT_DELETE_PERSONAL" // 3004
)

// Member/Role errors (4xxx)
const (
    ErrCodeMemberNotFound      ErrorCode = "MEMBER_NOT_FOUND"       // 4001
    ErrCodeAlreadyMember       ErrorCode = "MEMBER_ALREADY_EXISTS"  // 4002
    ErrCodeCannotRemoveOwner   ErrorCode = "MEMBER_CANNOT_REMOVE_OWNER" // 4003
    ErrCodeInsufficientRole    ErrorCode = "MEMBER_INSUFFICIENT_ROLE" // 4004
    ErrCodeCannotChangeOwnRole ErrorCode = "MEMBER_CANNOT_CHANGE_OWN_ROLE" // 4005
)

// Category errors (5xxx)
const (
    ErrCodeCategoryNotFound  ErrorCode = "CATEGORY_NOT_FOUND"   // 5001
    ErrCodeCategoryCyclic    ErrorCode = "CATEGORY_CYCLIC_REF"  // 5002
    ErrCodeCategoryHasChildren ErrorCode = "CATEGORY_HAS_CHILDREN" // 5003
    ErrCodeCategoryHasItems  ErrorCode = "CATEGORY_HAS_ITEMS"   // 5004
)

// Location errors (6xxx)
const (
    ErrCodeLocationNotFound    ErrorCode = "LOCATION_NOT_FOUND"     // 6001
    ErrCodeLocationShortCodeTaken ErrorCode = "LOCATION_SHORT_CODE_TAKEN" // 6002
    ErrCodeLocationCyclic      ErrorCode = "LOCATION_CYCLIC_REF"    // 6003
    ErrCodeLocationHasContainers ErrorCode = "LOCATION_HAS_CONTAINERS" // 6004
    ErrCodeLocationHasInventory ErrorCode = "LOCATION_HAS_INVENTORY" // 6005
)

// Container errors (7xxx)
const (
    ErrCodeContainerNotFound     ErrorCode = "CONTAINER_NOT_FOUND"      // 7001
    ErrCodeContainerShortCodeTaken ErrorCode = "CONTAINER_SHORT_CODE_TAKEN" // 7002
    ErrCodeContainerHasInventory ErrorCode = "CONTAINER_HAS_INVENTORY"  // 7003
)

// Item errors (8xxx)
const (
    ErrCodeItemNotFound       ErrorCode = "ITEM_NOT_FOUND"        // 8001
    ErrCodeItemSKUTaken       ErrorCode = "ITEM_SKU_TAKEN"        // 8002
    ErrCodeItemShortCodeTaken ErrorCode = "ITEM_SHORT_CODE_TAKEN" // 8003
    ErrCodeItemBarcodeTaken   ErrorCode = "ITEM_BARCODE_TAKEN"    // 8004
    ErrCodeItemHasInventory   ErrorCode = "ITEM_HAS_INVENTORY"    // 8005
)

// Inventory errors (9xxx)
const (
    ErrCodeInventoryNotFound       ErrorCode = "INVENTORY_NOT_FOUND"        // 9001
    ErrCodeInventoryInsufficientQty ErrorCode = "INVENTORY_INSUFFICIENT_QTY" // 9002
    ErrCodeInventoryInvalidCondition ErrorCode = "INVENTORY_INVALID_CONDITION" // 9003
    ErrCodeInventoryInvalidStatus  ErrorCode = "INVENTORY_INVALID_STATUS"   // 9004
    ErrCodeInventoryOnLoan         ErrorCode = "INVENTORY_ON_LOAN"          // 9005
    ErrCodeInventoryNotAvailable   ErrorCode = "INVENTORY_NOT_AVAILABLE"    // 9006
)

// Loan errors (10xxx)
const (
    ErrCodeLoanNotFound           ErrorCode = "LOAN_NOT_FOUND"            // 10001
    ErrCodeLoanAlreadyReturned    ErrorCode = "LOAN_ALREADY_RETURNED"     // 10002
    ErrCodeLoanQuantityExceeds    ErrorCode = "LOAN_QUANTITY_EXCEEDS"     // 10003
    ErrCodeLoanCannotExtend       ErrorCode = "LOAN_CANNOT_EXTEND"        // 10004
)

// Borrower errors (11xxx)
const (
    ErrCodeBorrowerNotFound    ErrorCode = "BORROWER_NOT_FOUND"     // 11001
    ErrCodeBorrowerHasLoans    ErrorCode = "BORROWER_HAS_ACTIVE_LOANS" // 11002
)

// Company errors (12xxx)
const (
    ErrCodeCompanyNotFound  ErrorCode = "COMPANY_NOT_FOUND"   // 12001
    ErrCodeCompanyNameTaken ErrorCode = "COMPANY_NAME_TAKEN"  // 12002
)

// Label errors (13xxx)
const (
    ErrCodeLabelNotFound   ErrorCode = "LABEL_NOT_FOUND"    // 13001
    ErrCodeLabelNameTaken  ErrorCode = "LABEL_NAME_TAKEN"   // 13002
    ErrCodeLabelInvalidColor ErrorCode = "LABEL_INVALID_COLOR" // 13003
)

// Validation errors (90xxx)
const (
    ErrCodeValidationFailed  ErrorCode = "VALIDATION_FAILED"   // 90001
    ErrCodeInvalidUUID       ErrorCode = "VALIDATION_INVALID_UUID" // 90002
    ErrCodeRequiredField     ErrorCode = "VALIDATION_REQUIRED_FIELD" // 90003
    ErrCodeInvalidFormat     ErrorCode = "VALIDATION_INVALID_FORMAT" // 90004
)

// System errors (99xxx)
const (
    ErrCodeInternalError  ErrorCode = "SYSTEM_INTERNAL_ERROR"  // 99001
    ErrCodeDatabaseError  ErrorCode = "SYSTEM_DATABASE_ERROR"  // 99002
    ErrCodeServiceUnavailable ErrorCode = "SYSTEM_SERVICE_UNAVAILABLE" // 99003
)
```

**API Error Response** (`internal/shared/apierror/error.go`):

```go
package apierror

import (
    "fmt"
    "net/http"
)

// APIError represents a structured API error response
type APIError struct {
    Code       ErrorCode         `json:"code"`
    Message    string            `json:"message"`
    Details    map[string]any    `json:"details,omitempty"`
    Field      string            `json:"field,omitempty"`      // For validation errors
    HTTPStatus int               `json:"-"`                    // Not serialized
}

func (e *APIError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Common constructors
func NewAPIError(code ErrorCode, message string, status int) *APIError {
    return &APIError{
        Code:       code,
        Message:    message,
        HTTPStatus: status,
    }
}

func NotFound(code ErrorCode, entity string) *APIError {
    return &APIError{
        Code:       code,
        Message:    fmt.Sprintf("%s not found", entity),
        HTTPStatus: http.StatusNotFound,
    }
}

func Conflict(code ErrorCode, message string) *APIError {
    return &APIError{
        Code:       code,
        Message:    message,
        HTTPStatus: http.StatusConflict,
    }
}

func ValidationError(code ErrorCode, field, message string) *APIError {
    return &APIError{
        Code:       code,
        Message:    message,
        Field:      field,
        HTTPStatus: http.StatusBadRequest,
    }
}

func Forbidden(code ErrorCode, message string) *APIError {
    return &APIError{
        Code:       code,
        Message:    message,
        HTTPStatus: http.StatusForbidden,
    }
}

func (e *APIError) WithDetails(details map[string]any) *APIError {
    e.Details = details
    return e
}
```

**Huma Error Transformer** (`internal/api/middleware/errors.go`):

```go
package middleware

import (
    "context"
    "errors"

    "github.com/danielgtaylor/huma/v2"
    "github.com/your/project/internal/shared/apierror"
)

// ErrorTransformer converts domain errors to API errors for Huma
func ErrorTransformer(ctx context.Context, err error) error {
    var apiErr *apierror.APIError
    if errors.As(err, &apiErr) {
        return huma.NewError(apiErr.HTTPStatus, apiErr.Message, &huma.ErrorDetail{
            Message: string(apiErr.Code),
            Location: apiErr.Field,
            Value:    apiErr.Details,
        })
    }

    // Fallback for unknown errors
    return huma.NewError(500, "Internal server error", &huma.ErrorDetail{
        Message: string(apierror.ErrCodeInternalError),
    })
}
```

**Frontend Error Codes Export** (`/api/error-codes` endpoint):

```go
// GET /api/error-codes - Returns all error codes for frontend i18n tooling
func (h *Handler) GetErrorCodes(ctx context.Context, input *struct{}) (*ErrorCodesResponse, error) {
    return &ErrorCodesResponse{
        Body: AllErrorCodes, // Generated list of all codes
    }, nil
}
```

**Frontend Usage Example** (`frontend/lib/api/errors.ts`):

```typescript
// Auto-generated or manually maintained error code types
export type ErrorCode =
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_INVALID_TOKEN'
  | 'USER_NOT_FOUND'
  | 'USER_EMAIL_TAKEN'
  | 'INVENTORY_INSUFFICIENT_QTY'
  | 'LOAN_ALREADY_RETURNED'
  // ... all codes

// i18n mapping (e.g., using next-intl)
export const errorMessages: Record<ErrorCode, string> = {
  'AUTH_UNAUTHORIZED': 'errors.auth.unauthorized',
  'AUTH_INVALID_TOKEN': 'errors.auth.invalidToken',
  'USER_NOT_FOUND': 'errors.user.notFound',
  'USER_EMAIL_TAKEN': 'errors.user.emailTaken',
  'INVENTORY_INSUFFICIENT_QTY': 'errors.inventory.insufficientQuantity',
  'LOAN_ALREADY_RETURNED': 'errors.loan.alreadyReturned',
  // ...
};

// Usage in components
function handleAPIError(error: APIErrorResponse) {
  const messageKey = errorMessages[error.code] || 'errors.generic';
  toast.error(t(messageKey, error.details));
}
```

**Translation File Example** (`frontend/messages/en.json`):

```json
{
  "errors": {
    "auth": {
      "unauthorized": "You must be logged in to perform this action",
      "invalidToken": "Your session is invalid. Please log in again",
      "invalidCredentials": "Invalid email or password"
    },
    "user": {
      "notFound": "User not found",
      "emailTaken": "This email address is already in use"
    },
    "inventory": {
      "insufficientQuantity": "Not enough items available (requested: {requested}, available: {available})",
      "onLoan": "This item is currently on loan and cannot be modified"
    },
    "loan": {
      "alreadyReturned": "This loan has already been returned",
      "quantityExceeds": "Cannot loan more items than available"
    },
    "generic": "An unexpected error occurred"
  }
}
```

---

### 0.7 Air Configuration (Hot Reload)

```toml
# go-backend/.air.toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/main ./cmd/server"
  bin = "./tmp/main"
  delay = 1000
  exclude_dir = ["tmp", "vendor", "node_modules", "tests"]
  exclude_regex = ["_test.go"]
  include_ext = ["go", "sql"]
  kill_delay = "0s"
  stop_on_error = true

[log]
  time = false

[color]
  main = "magenta"
  watcher = "cyan"
  build = "yellow"
  runner = "green"

[misc]
  clean_on_exit = true
```

---

