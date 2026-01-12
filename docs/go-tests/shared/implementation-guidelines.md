# Implementation Guidelines

Standard practices and patterns for writing tests across the Go backend.

## Testing Standards

### 1. Test Naming Convention

Follow the pattern: `Test<Type>_<Method>_<Scenario>`

```go
// Good examples
func TestItemService_Create_ReturnsDuplicateError(t *testing.T)
func TestUserHandler_Login_InvalidCredentials(t *testing.T)
func TestInventory_StateTransition_ValidChange(t *testing.T)

// Bad examples
func TestCreate(t *testing.T)  // Too generic
func TestError(t *testing.T)   // Not descriptive
func Test1(t *testing.T)       // Meaningless
```

### 2. Table-Driven Tests

Use table-driven tests for testing multiple scenarios:

```go
func TestValidation(t *testing.T) {
    tests := []struct {
        name    string
        input   Input
        wantErr bool
        errMsg  string
    }{
        {
            name:    "valid input",
            input:   ValidInput,
            wantErr: false,
        },
        {
            name:    "missing required field",
            input:   InvalidInput,
            wantErr: true,
            errMsg:  "field is required",
        },
        {
            name:    "invalid format",
            input:   MalformedInput,
            wantErr: true,
            errMsg:  "invalid format",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := Validate(tt.input)

            if tt.wantErr {
                assert.Error(t, err)
                if tt.errMsg != "" {
                    assert.Contains(t, err.Error(), tt.errMsg)
                }
            } else {
                assert.NoError(t, err)
                assert.NotNil(t, result)
            }
        })
    }
}
```

### 3. Mock Expectations

Always assert that mock methods were called as expected:

```go
func TestService_Create(t *testing.T) {
    mockRepo := new(MockRepository)

    // Set up expectation
    mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

    svc := NewService(mockRepo)
    _, err := svc.Create(ctx, input)

    assert.NoError(t, err)

    // IMPORTANT: Verify mocks were called
    mockRepo.AssertExpectations(t)
}
```

Use `mock.MatchedBy` for complex argument matching:

```go
mockRepo.On("Save", mock.Anything, mock.MatchedBy(func(item *Item) bool {
    return item.Name == "Expected Name" && item.SKU == "SKU-001"
})).Return(nil)
```

### 4. Test Isolation

Use `t.Cleanup()` for resource cleanup:

```go
func TestIntegration(t *testing.T) {
    pool := testdb.SetupTestDB(t)
    // t.Cleanup is called automatically by SetupTestDB

    // Or manual cleanup
    tempFile := createTempFile()
    t.Cleanup(func() {
        os.Remove(tempFile)
    })

    // ... test code
}
```

### 5. Error Assertions

Use specific error comparisons, not just generic error checks:

```go
// Good - specific error
assert.Equal(t, ErrDuplicateSKU, err)
assert.ErrorIs(t, err, ErrNotFound)

// Bad - too generic
assert.Error(t, err)  // Any error passes
```

### 6. Subtests for Organization

Group related tests using `t.Run`:

```go
func TestItemHandler(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()

    t.Run("Create", func(t *testing.T) {
        t.Run("succeeds with valid input", func(t *testing.T) {
            // ...
        })

        t.Run("fails with invalid input", func(t *testing.T) {
            // ...
        })
    })

    t.Run("Update", func(t *testing.T) {
        // ...
    })
}
```

## Test Organization

### File Structure

```
internal/domain/warehouse/item/
├── entity.go
├── entity_test.go          # Entity validation tests
├── service.go
├── service_test.go         # Service unit tests (mocked repo)
├── handler.go
├── handler_test.go         # Handler HTTP tests (mocked service)
├── repository.go
└── repository_test.go      # Integration tests (real DB)
```

### Test Types

1. **Unit Tests** (No external dependencies)
   - Entity validation
   - Service logic with mocked repositories
   - Handler logic with mocked services
   - Pure functions

2. **Integration Tests** (Real database)
   - Repository tests
   - End-to-end workflows
   - Use `//go:build integration` tag

3. **Examples**

```go
// Unit test - mocked dependencies
func TestItemService_Create(t *testing.T) {
    mockRepo := new(MockItemRepository)
    mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

    svc := item.NewService(mockRepo)
    _, err := svc.Create(ctx, input)

    assert.NoError(t, err)
}

// Integration test - real database
//go:build integration
// +build integration

func TestItemRepository_Create(t *testing.T) {
    pool := testdb.SetupTestDB(t)
    repo := item.NewRepository(pool)

    item, err := repo.Save(ctx, testItem)

    assert.NoError(t, err)
    assert.NotEqual(t, uuid.Nil, item.ID)
}
```

## Running Tests

### Development Workflow

```bash
# Run unit tests only (fast, no DB required)
go test ./internal/... -short

# Run all tests including repository tests (requires DB)
go test ./internal/...

# Run integration tests (requires DB and tags)
go test ./... -tags=integration

# Run specific package
go test ./internal/domain/warehouse/item -v

# Run specific test
go test ./internal/domain/warehouse/item -run TestItemService_Create

# Run with coverage
go test ./internal/... -cover

# Generate coverage profile
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### CI/CD Commands

```bash
# Full test suite with coverage
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
go test ./... -coverprofile=coverage.out -covermode=atomic -tags=integration

# Coverage threshold check
coverage=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
if (( $(echo "$coverage < 95.0" | bc -l) )); then
    echo "Coverage $coverage% is below 95% threshold"
    exit 1
fi
```

## Best Practices

### DO ✅

- **Write tests first** or immediately after implementation
- **Test error paths** as thoroughly as success paths
- **Use descriptive test names** that explain what's being tested
- **Keep tests simple** and focused on one thing
- **Use table-driven tests** for multiple similar scenarios
- **Mock external dependencies** in unit tests
- **Assert mock expectations** to ensure behavior
- **Test edge cases** (empty, nil, boundary values)
- **Use setup helpers** to reduce boilerplate
- **Clean up resources** with t.Cleanup()

### DON'T ❌

- **Don't test implementation details** - test behavior
- **Don't write flaky tests** - ensure deterministic results
- **Don't skip error assertions** - always check errors
- **Don't use sleep()** in tests - use proper synchronization
- **Don't share state** between tests
- **Don't test third-party code** - mock it
- **Don't ignore test failures** in CI
- **Don't write tests that depend on external services** (in unit tests)

## Common Patterns

### Testing Context Cancellation

```go
func TestService_WithCancelledContext(t *testing.T) {
    ctx, cancel := context.WithCancel(context.Background())
    cancel()

    _, err := svc.Operation(ctx)

    assert.ErrorIs(t, err, context.Canceled)
}
```

### Testing Pagination

```go
func TestService_List_Pagination(t *testing.T) {
    tests := []struct {
        name   string
        offset int
        limit  int
        wantErr bool
    }{
        {"valid", 0, 20, false},
        {"negative offset", -1, 20, true},
        {"negative limit", 0, -1, true},
        {"zero limit", 0, 0, true},
        {"beyond total", 1000, 20, false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, _, err := svc.List(ctx, tt.offset, tt.limit)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

### Testing HTTP Handlers

```go
func TestHandler_Create(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)

    t.Run("creates successfully", func(t *testing.T) {
        mockSvc.On("Create", mock.Anything, mock.Anything).
            Return(testEntity, nil)

        body := `{"name":"Test"}`
        rec := setup.Post("/path", body)

        testutil.AssertStatus(t, rec, http.StatusCreated)
        mockSvc.AssertExpectations(t)
    })

    t.Run("returns 400 for invalid input", func(t *testing.T) {
        body := `{"name":""}`
        rec := setup.Post("/path", body)

        testutil.AssertErrorResponse(t, rec, http.StatusBadRequest, "name")
    })
}
```

## Troubleshooting

### Flaky Tests

**Problem**: Tests pass sometimes, fail other times

**Solutions**:
- Remove `time.Sleep()` - use channels or synchronization primitives
- Ensure proper cleanup with `t.Cleanup()`
- Don't rely on timing - use deterministic conditions
- Check for race conditions with `go test -race`

### Slow Tests

**Problem**: Test suite takes too long

**Solutions**:
- Use `t.Parallel()` for independent tests
- Mock expensive operations (DB, external APIs)
- Use `-short` flag to skip slow tests during development
- Profile tests: `go test -cpuprofile=cpu.prof`

### Mock Not Called

**Problem**: `AssertExpectations` fails

**Solutions**:
- Verify method signature matches exactly
- Check argument matchers (`mock.Anything`, `mock.MatchedBy`)
- Ensure code path actually calls the method
- Use `.Once()` or `.Times(n)` to be explicit

## Resources

- [Go Testing Package Docs](https://pkg.go.dev/testing)
- [Testify Documentation](https://github.com/stretchr/testify)
- [Go Test Comments](https://go.dev/blog/subtests)
- [Table Driven Tests](https://dave.cheney.net/2019/05/07/prefer-table-driven-tests)
