# Progress Tracking

How to track and verify test coverage progress throughout the implementation.

## Running Coverage Analysis

### Generate Coverage Report

```bash
# Run all tests with coverage
go test ./... -coverprofile=coverage.out -covermode=atomic

# View overall coverage
go tool cover -func=coverage.out | grep total

# Expected output:
# total:  (statements)  XX.X%
```

### Generate HTML Report

```bash
# Generate HTML coverage visualization
go tool cover -html=coverage.out -o coverage.html

# Open in browser
open coverage.html  # macOS
xdg-open coverage.html  # Linux
start coverage.html  # Windows
```

### Package-Level Coverage

```bash
# Show coverage by package
go tool cover -func=coverage.out | grep -v "100.0%" | sort -k3 -n

# Test specific package
go test ./internal/domain/warehouse/item -cover

# Expected output:
# ok      github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item    0.015s  coverage: 85.2% of statements
```

## Tracking Progress by Phase

### Phase 1: Foundation & Quick Wins

**Target**: 38.9% → 53.9% (+15%)

```bash
# Before starting Phase 1
go test ./... -coverprofile=phase1-before.out
go tool cover -func=phase1-before.out | grep total

# After completing Phase 1
go test ./... -coverprofile=phase1-after.out
go tool cover -func=phase1-after.out | grep total

# Compare
echo "Before: $(go tool cover -func=phase1-before.out | grep total | awk '{print $3}')"
echo "After: $(go tool cover -func=phase1-after.out | grep total | awk '{print $3}')"
```

**Checklist**:
- [ ] Middleware coverage: 49.3% → 95%
  ```bash
  go test ./internal/api/middleware -cover
  ```
- [ ] Entity coverage: 4% → 90%
  ```bash
  go test ./internal/domain/.../entity_test.go -cover
  ```
- [ ] Jobs coverage: 15.4% → 40%
  ```bash
  go test ./internal/jobs -cover -short
  ```

### Phase 2: Handler Test Suite

**Target**: 53.9% → 78.9% (+25%)

**Warehouse Handlers**:
```bash
# Track each handler package
for pkg in item location container inventory loan borrower label company activity attachment deleted favorite movement; do
    echo "Testing $pkg handler..."
    go test ./internal/domain/warehouse/$pkg -run TestHandler -cover
done
```

**Auth Handlers**:
```bash
for pkg in user workspace member notification; do
    echo "Testing $pkg handler..."
    go test ./internal/domain/auth/$pkg -run TestHandler -cover
done
```

**Checklist**:
- [ ] Warehouse handlers: 13/13 completed
- [ ] Auth handlers: 4/4 completed
- [ ] Top-level handlers: 5/5 completed

### Phase 3: Service Error Path Coverage

**Target**: 78.9% → 86.9% (+8%)

```bash
# Check service coverage for packages needing improvement
packages=(
    "internal/domain/warehouse/activity"
    "internal/domain/warehouse/movement"
    "internal/domain/warehouse/loan"
    "internal/domain/warehouse/company"
    "internal/domain/auth/user"
    "internal/domain/auth/notification"
    "internal/domain/auth/workspace"
    "internal/domain/auth/member"
)

for pkg in "${packages[@]}"; do
    coverage=$(go test ./$pkg -cover | grep coverage | awk '{print $5}')
    echo "$pkg: $coverage"
done
```

**Checklist**:
- [ ] activity: 40.2% → 75%
- [ ] movement: 43.9% → 70%
- [ ] loan: 46.5% → 75%
- [ ] company: 47.3% → 70%
- [ ] user: 33.9% → 70%
- [ ] notification: 37.9% → 70%
- [ ] workspace: 42.2% → 70%
- [ ] member: 48.5% → 70%

### Phase 4: Integration Test Expansion

**Target**: 86.9% → 91.9% (+5%)

```bash
# Run integration tests
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
go test ./tests/integration -v -tags=integration -coverprofile=integration-coverage.out

go tool cover -func=integration-coverage.out | grep total
```

**Checklist**:
- [ ] E2E integration tests: 10 new test files
- [ ] Negative integration tests: 4 test categories
- [ ] All tests pass consistently
- [ ] No flaky tests

### Phase 5: Remaining Gaps & Polish

**Target**: 91.9% → 95%+ (+3.1%)

```bash
# Identify remaining gaps
go test ./... -coverprofile=phase5-gaps.out
go tool cover -func=phase5-gaps.out | grep -v "100.0%" | sort -k3 -n | head -20
```

**Checklist**:
- [ ] Router tests complete: `internal/api/router_test.go`
- [ ] Documentation tests complete: `internal/api/docs_test.go`
- [ ] Batch operations complete: `internal/domain/batch/service_test.go`
- [ ] All gaps < 95% filled

## Progress Dashboard

Track your progress with this template:

```markdown
# Test Coverage Progress

**Goal**: 38.9% → 95%

## Current Status

Overall Coverage: XX.X%
Tests Passing: XXX
Tests Added: XXX

## Phase Progress

- [x] Phase 1: Foundation & Quick Wins (✓ 53.9%)
- [x] Phase 2: Handler Test Suite (✓ 78.9%)
- [ ] Phase 3: Service Error Paths (Target: 86.9%)
- [ ] Phase 4: Integration Tests (Target: 91.9%)
- [ ] Phase 5: Gaps & Polish (Target: 95%+)

## Coverage by Domain

### Warehouse Domain
- item: XX.X%
- location: XX.X%
- container: XX.X%
- inventory: XX.X%
- loan: XX.X%
- borrower: XX.X%

### Auth Domain
- user: XX.X%
- workspace: XX.X%
- member: XX.X%

## Recent Improvements

- YYYY-MM-DD: Added entity validation tests (+5.2%)
- YYYY-MM-DD: Completed item handler tests (+3.1%)
```

## Verification Commands

### After Each Task

```bash
# Run affected tests
go test ./path/to/package -v -cover

# Verify no regressions
go test ./... -short

# Update overall coverage
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out | grep total
```

### Before Committing

```bash
# Full test suite
go test ./... -v

# Full coverage report
go test ./... -coverprofile=coverage.out -covermode=atomic

# Check coverage threshold
coverage=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
echo "Current coverage: $coverage%"

if (( $(echo "$coverage >= 95.0" | bc -l) )); then
    echo "✓ Coverage target met!"
else
    echo "✗ Coverage below 95% target"
fi
```

### After Each Phase

```bash
# Generate comprehensive report
go test ./... -coverprofile=phase-N-complete.out -covermode=atomic

# Create HTML report
go tool cover -html=phase-N-complete.out -o reports/phase-N-coverage.html

# Extract summary
go tool cover -func=phase-N-complete.out > reports/phase-N-summary.txt

# Compare with previous phase
diff reports/phase-$((N-1))-summary.txt reports/phase-N-summary.txt
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: wh
          POSTGRES_PASSWORD: wh
          POSTGRES_DB: warehouse_test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Run tests with coverage
        env:
          TEST_DATABASE_URL: postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable
        run: |
          go test ./... -coverprofile=coverage.out -covermode=atomic -tags=integration

      - name: Check coverage threshold
        run: |
          coverage=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
          echo "Coverage: $coverage%"
          if (( $(echo "$coverage < 95.0" | bc -l) )); then
            echo "❌ Coverage $coverage% is below 95% threshold"
            exit 1
          fi
          echo "✅ Coverage target met!"

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.out
```

## Troubleshooting Coverage Issues

### Coverage Not Increasing

**Check**:
1. Are tests actually running?
   ```bash
   go test ./package -v
   ```

2. Are test files named correctly?
   - Must end in `_test.go`
   - Must be in same package or `package_test`

3. Is build tag missing?
   ```bash
   go test ./... -tags=integration  # Don't forget tags
   ```

### Coverage Decreased

**Investigate**:
```bash
# Compare coverage reports
go tool cover -func=before.out > before.txt
go tool cover -func=after.out > after.txt
diff before.txt after.txt
```

### Package Coverage Not Updating

**Solutions**:
- Clear test cache: `go clean -testcache`
- Run with `-count=1`: `go test ./... -count=1 -cover`
- Check for build constraints
- Verify test files are in correct directory

## Reporting

### Generate Coverage Badge

```bash
# Get coverage percentage
COVERAGE=$(go tool cover -func=coverage.out | grep total | awk '{print $3}')

# Generate badge URL
echo "https://img.shields.io/badge/coverage-${COVERAGE}-brightgreen"
```

### Weekly Progress Report Template

```markdown
# Weekly Test Coverage Report

**Week of**: YYYY-MM-DD

## Overall Progress

- Starting Coverage: XX.X%
- Ending Coverage: XX.X%
- Change: +X.X%

## Tests Added This Week

- Total Tests Added: XX
- Packages Updated: X

## Phase Status

Current Phase: Phase N - [Phase Name]
- Target: XX.X%
- Current: XX.X%
- On Track: ✓/✗

## Next Week Goals

1. Complete [specific task]
2. Increase [package] coverage to XX%
3. Add [test type] tests

## Blockers

- None / [List any blockers]
```

## Milestones

Track these key milestones:

- [ ] **50% Coverage** - Foundation established
- [ ] **60% Coverage** - Basic handler tests complete
- [ ] **70% Coverage** - Most handlers covered
- [ ] **80% Coverage** - Service error paths complete
- [ ] **90% Coverage** - Integration tests added
- [ ] **95% Coverage** - Target achieved! 🎉

## Success Metrics

Beyond just coverage percentage, track:

- **Test Count**: Growing number of tests
- **Test Speed**: Keep <2 min for unit tests
- **Flaky Tests**: Should be 0
- **Skipped Tests**: Minimize or eliminate
- **Coverage Trend**: Should be steadily increasing
- **Package Coverage**: No package <90%

## Final Verification

Before declaring "complete":

```bash
# 1. Run full test suite
go test ./... -v -tags=integration

# 2. Generate final coverage report
go test ./... -coverprofile=final.out -covermode=atomic -tags=integration

# 3. Verify overall coverage
COVERAGE=$(go tool cover -func=final.out | grep total | awk '{print $3}')
echo "Final Coverage: $COVERAGE"

# 4. Check all packages
go tool cover -func=final.out | grep -v "100.0%" | sort -k3 -n

# 5. Generate HTML for manual review
go tool cover -html=final.out -o final-coverage.html

# 6. Review HTML report manually
open final-coverage.html
```

✅ If overall >= 95% and all packages >= 90%, you're done!
