# Go Backend Test Coverage Plan

**Goal**: Achieve 95% test coverage across all domain packages

**Current Date**: 2026-01-13

## Current Coverage Summary

| Package | Coverage | Gap to 95% | Priority |
|---------|----------|------------|----------|
| internal/jobs | 27.9% (85.6% w/ Redis) | 9.4% | MEDIUM |
| internal/domain/batch | 44.5% | 50.5% | HIGH |
| internal/domain/auth/user | 73.5% | 21.5% | MEDIUM |
| internal/domain/warehouse/inventory | 79.3% | 15.7% | MEDIUM |
| internal/domain/importexport | 79.7% | 15.3% | MEDIUM |
| internal/shared/jwt | 80.6% | 14.4% | MEDIUM |
| internal/domain/auth/workspace | 83.6% | 11.4% | LOW |
| internal/domain/auth/member | 86.2% | 8.8% | LOW |
| internal/domain/warehouse/category | 87.3% | 7.7% | LOW |
| internal/domain/auth/notification | 87.4% | 7.6% | LOW |
| internal/domain/warehouse/attachment | 88.1% | 6.9% | LOW |
| internal/domain/warehouse/loan | 89.8% | 5.2% | LOW |
| internal/domain/warehouse/item | 89.9% | 5.1% | LOW |
| internal/domain/warehouse/company | 90.0% | 5.0% | LOW |
| internal/domain/warehouse/favorite | 90.2% | 4.8% | LOW |
| internal/domain/warehouse/movement | 90.9% | 4.1% | LOW |
| internal/domain/analytics | 92.6% | 2.4% | LOW |
| internal/domain/warehouse/container | 92.6% | 2.4% | LOW |
| internal/domain/warehouse/activity | 93.1% | 1.9% | LOW |
| internal/domain/warehouse/label | 93.2% | 1.8% | LOW |
| internal/domain/warehouse/location | 93.6% | 1.4% | LOW |
| internal/domain/warehouse/borrower | 94.1% | 0.9% | LOW |
| internal/domain/warehouse/deleted | 94.9% | 0.1% | DONE |

**Already at 95%+**:
- barcode (95.9%), shared (97.1%), sync (98.2%), middleware (100%), config (100%), apierror (100%)

**Excluded** (infrastructure/test utilities):
- internal/infra/postgres (0.0%) - DB layer, tested via integration
- internal/testutil (72.7%) - Test helpers, not production code

---

## Phase 1: HIGH Priority (27.9% - 44.5%)

### 1.1 Jobs Package (27.9% -> 95%)

**Current State**: Redis integration tests exist, coverage at 85.6% with integration tests

**Run with Redis**:
```bash
docker compose up -d redis postgres
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
TEST_REDIS_ADDR="localhost:6379" \
mise exec -- go test ./internal/jobs -tags=integration -cover
```

**Remaining Gaps (85.6% -> 95%)**:
| Function | Current | Gap |
|----------|---------|-----|
| `ProcessDeletedRecordsCleanup` | 87.5% | Error path when cleanup fails |
| `ProcessActivityCleanup` | 88.9% | Error path when cleanup fails |
| `ProcessTask` | 88.9% | Email sender error handling |
| `ScheduleReminders` | 78.6% | Marshal error, enqueue error paths |
| `NewScheduler` | 83.3% | Already good |
| `RegisterScheduledTasks` | 76.9% | Error paths for each registration |
| `Start` | 71.4% | Scheduler/server start errors |

**Tasks**:
1. Add test for `ProcessTask` with email sender that returns error
2. Add test for `ProcessDeletedRecordsCleanup` with DB error (mock or bad query)
3. Add test for `ScheduleReminders` with JSON marshal error (unlikely but possible)
4. Add test for `RegisterScheduledTasks` second/third registration failures
5. Add test for `Start` when scheduler fails to start

### 1.2 Batch Package (44.5% -> 95%)

**Current State**: Validation paths tested, but entity operations need mocks

**Uncovered Code** (from `go tool cover -func`):
- `processItemOperation` (26.1%) - GetByID, Update, Archive calls
- `processLocationOperation` (26.1%)
- `processContainerOperation` (26.1%)
- `processCategoryOperation` (26.1%)
- `processLabelOperation` (26.1%)
- `processCompanyOperation` (26.1%)

**Strategy**: Create mock services or use integration tests

**Option A - Mock Services** (Recommended for unit tests):
```go
type mockItemService struct {
    getByIDFunc func(ctx context.Context, id, wsID uuid.UUID) (*item.Item, error)
    updateFunc  func(ctx context.Context, id, wsID uuid.UUID, input item.UpdateInput) (*item.Item, error)
    archiveFunc func(ctx context.Context, id, wsID uuid.UUID) error
}
```

**Option B - Integration Tests**:
Add batch operations to `tests/integration/` that create real entities and batch update/delete them.

**Tasks**:
1. Create `service_mock_test.go` with mock service implementations
2. Add tests for successful update operations (all 6 entity types)
3. Add tests for successful delete operations (all 6 entity types)
4. Add tests for conflict detection (server data newer than client)
5. Add tests for invalid JSON data handling
6. Add tests for service errors (GetByID fails, Update fails, Archive fails)

---

## Phase 2: MEDIUM Priority (73.5% - 80.6%)

### 2.1 User Package (73.5% -> 95%)

**Uncovered Functions**:
| Function | Current | Notes |
|----------|---------|-------|
| `register` | 62.5% | Service error paths |
| `login` | 80.0% | Close to target |
| `refreshToken` | 76.5% | Token validation errors |
| `updateMe` | 71.4% | Service error paths |
| `updatePreferences` | 71.4% | Service error paths |
| `listUsers` | 76.5% | Pagination edge cases |
| `deactivateUser` | 76.9% | Error scenarios |
| `activateUser` | 72.7% | Error scenarios |
| `RegisterPublicRoutes` | 0.0% | Skip - tested implicitly |
| `RegisterProtectedRoutes` | 0.0% | Skip - tested implicitly |

**Tasks**:
1. Add handler test for `register` when service returns error
2. Add handler test for `refreshToken` with invalid/expired token
3. Add handler test for `updateMe` when service returns error
4. Add handler test for `updatePreferences` when service returns error
5. Add handler test for `listUsers` with invalid pagination params
6. Add handler test for `deactivateUser` when user not found
7. Add handler test for `activateUser` when user not found or already active

**Note**: Route registration (0%) is acceptable - these are tested via handler tests

### 2.2 Inventory Package (79.3% -> 95%)

**Uncovered Code**:
- `handler.go:14` RegisterRoutes (58.0%)

**Analysis**: Only route registration is below 95%. All service/entity code is well covered.

**Tasks**:
1. Route registration tests are implicit - **ACCEPTABLE GAP**
2. This package is effectively at target for meaningful code

### 2.3 ImportExport Package (79.7% -> 95%)

**Uncovered Functions**:
| Function | Current | Notes |
|----------|---------|-------|
| `toCSV` | 20.0% | CSV generation - needs tests |
| `ptrToBool` | 66.7% | Nil handling |
| `pgtimeToString` | 66.7% | Nil handling |
| `importCompany` | 80.0% | Error paths |
| `importBorrower` | 80.0% | Error paths |
| `importLocation` | 83.3% | Error paths |
| `importContainer` | 84.6% | Error paths |
| `exportLocations` | 85.7% | Error paths |
| `exportCategories` | 85.7% | Error paths |
| Various others | 85-95% | Small gaps |

**Tasks**:
1. Add tests for `toCSV` function (biggest gap at 20%)
2. Add tests for `ptrToBool` and `pgtimeToString` nil cases
3. Add tests for import error scenarios (invalid data, DB errors)
4. Add tests for export with empty data scenarios

### 2.4 JWT Package (80.6% -> 95%)

**Uncovered Functions**:
| Function | Current | Notes |
|----------|---------|-------|
| `ValidateToken` | 75.0% | Invalid token scenarios |
| `ValidateRefreshToken` | 73.3% | Invalid refresh token scenarios |

**Tasks**:
1. Add test for `ValidateToken` with malformed token
2. Add test for `ValidateToken` with expired token
3. Add test for `ValidateToken` with wrong signing method
4. Add test for `ValidateRefreshToken` with invalid token
5. Add test for `ValidateRefreshToken` with wrong token type

---

## Phase 3: LOW Priority (83.6% - 94.1%)

These packages are close to 95%. For each:

1. Run `go tool cover -func` to identify specific uncovered lines
2. Add targeted tests for those specific functions
3. Focus on error paths and edge cases

### Quick Wins (2-5% gap):
- analytics (92.6%)
- container (92.6%)
- activity (93.1%)
- label (93.2%)
- location (93.6%)
- borrower (94.1%)

### Moderate Effort (5-12% gap):
- workspace (83.6%)
- member (86.2%)
- category (87.3%)
- notification (87.4%)
- attachment (88.1%)
- loan (89.8%)
- item (89.9%)
- company (90.0%)
- favorite (90.2%)
- movement (90.9%)

---

## Commands Reference

### Check Overall Coverage
```bash
cd backend && mise exec -- go test ./... -short -cover | sort -t: -k2 -n
```

### Check Specific Package Coverage
```bash
mise exec -- go test ./internal/domain/batch -cover -coverprofile=/tmp/cov.out
mise exec -- go tool cover -func=/tmp/cov.out | grep -v "100.0%"
```

### Run Integration Tests
```bash
docker compose up -d postgres redis
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
TEST_REDIS_ADDR="localhost:6379" \
mise exec -- go test ./... -tags=integration -cover
```

### View Coverage in Browser
```bash
mise exec -- go test ./internal/domain/batch -coverprofile=/tmp/cov.out
mise exec -- go tool cover -html=/tmp/cov.out
```

---

## Estimated Effort

| Phase | Packages | Est. Time | Coverage Impact |
|-------|----------|-----------|-----------------|
| 1.1 | jobs | 1-2 hours | 85.6% -> 95% (with Redis) |
| 1.2 | batch | 3-4 hours | 44.5% -> 95% (needs mocks) |
| 2.1 | user | 2-3 hours | 73.5% -> 95% |
| 2.2 | inventory | DONE | 79.3% (only route reg uncovered) |
| 2.3 | importexport | 2-3 hours | 79.7% -> 95% |
| 2.4 | jwt | 1 hour | 80.6% -> 95% |
| 3.x | All LOW priority | 3-4 hours | 83-94% -> 95%+ |

**Total**: ~12-17 hours to reach 95% across all domain packages

### Priority Order (by impact/effort ratio):
1. **jwt** - Quick win, 1 hour for 14.4% improvement
2. **jobs** - Already at 85.6%, just needs error path tests
3. **importexport** - `toCSV` is biggest gap, straightforward
4. **user** - Handler error paths
5. **batch** - Requires mock services (most effort)

---

## Success Criteria

- [ ] All domain packages at 95%+ coverage
- [ ] All unit tests pass: `go test ./... -short`
- [ ] All integration tests pass: `go test ./... -tags=integration`
- [ ] No skipped tests without documented reason
