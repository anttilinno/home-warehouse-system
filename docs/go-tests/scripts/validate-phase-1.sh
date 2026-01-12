#!/bin/bash

# Phase 1 Validation Script
# Validates that Phase 1 tasks are completed correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo -e "${NC}ℹ${NC} $1"
}

# Check if running pre-flight checks
if [ "$1" == "--pre-flight" ]; then
    echo "================================"
    echo "Phase 1 Pre-Flight Checks"
    echo "================================"
    echo ""

    # Check Go version
    if command -v go &> /dev/null; then
        GO_VERSION=$(go version | awk '{print $3}')
        pass "Go installed: $GO_VERSION"
    else
        fail "Go is not installed"
    fi

    # Check if in project root
    if [ -f "go.mod" ]; then
        pass "In project root directory"
    else
        fail "Not in project root (go.mod not found)"
    fi

    # Check if dependencies are downloaded
    if go list -m all &> /dev/null; then
        pass "Dependencies are available"
    else
        fail "Dependencies not downloaded. Run: go mod download"
    fi

    # Check if tests currently pass
    info "Running existing tests..."
    if go test ./... -short -timeout 30s &> /dev/null; then
        pass "Existing tests pass"
    else
        warn "Some existing tests fail (this is OK if known)"
    fi

    # Check for postgres
    if docker ps | grep -q postgres; then
        pass "PostgreSQL container is running"
    else
        warn "PostgreSQL container not detected (needed for integration tests)"
    fi

    echo ""
    if [ $FAILED -eq 0 ]; then
        pass "Pre-flight checks complete!"
        echo ""
        echo "Ready to start Phase 1"
    else
        fail "Pre-flight checks failed. Fix issues above before proceeding."
        exit 1
    fi
    exit 0
fi

# Main validation
echo "================================"
echo "Phase 1 Validation"
echo "================================"
echo ""

# Task 1.1: Middleware Testing
echo "Task 1.1: Middleware Testing"
echo "----------------------------"

# Check if middleware test files exist
if [ -f "internal/api/middleware/auth_test.go" ]; then
    pass "auth_test.go exists"
else
    fail "auth_test.go not found"
fi

if [ -f "internal/api/middleware/workspace_test.go" ]; then
    pass "workspace_test.go exists"
else
    fail "workspace_test.go not found"
fi

if [ -f "internal/api/middleware/errors_test.go" ]; then
    pass "errors_test.go exists"
else
    fail "errors_test.go not found"
fi

# Run middleware tests
info "Running middleware tests..."
if go test ./internal/api/middleware -timeout 30s &> /dev/null; then
    pass "Middleware tests pass"
else
    fail "Middleware tests fail"
fi

# Check middleware coverage
MIDDLEWARE_COVERAGE=$(go test ./internal/api/middleware -cover 2>/dev/null | grep coverage | awk '{print $5}' | sed 's/%//')
if [ ! -z "$MIDDLEWARE_COVERAGE" ]; then
    if (( $(echo "$MIDDLEWARE_COVERAGE >= 95.0" | bc -l) )); then
        pass "Middleware coverage: ${MIDDLEWARE_COVERAGE}% (target: 95%)"
    else
        fail "Middleware coverage: ${MIDDLEWARE_COVERAGE}% (target: 95%)"
    fi
else
    warn "Could not determine middleware coverage"
fi

echo ""

# Task 1.2: Entity Validation Tests
echo "Task 1.2: Entity Validation Tests"
echo "----------------------------------"

# Check if entity test files exist
ENTITY_FILES=(
    "internal/domain/warehouse/item/entity_test.go"
    "internal/domain/warehouse/location/entity_test.go"
    "internal/domain/warehouse/container/entity_test.go"
    "internal/domain/warehouse/inventory/entity_test.go"
    "internal/domain/warehouse/loan/entity_test.go"
    "internal/domain/warehouse/borrower/entity_test.go"
    "internal/domain/auth/user/entity_test.go"
    "internal/domain/auth/workspace/entity_test.go"
    "internal/domain/auth/member/entity_test.go"
)

ENTITY_COUNT=0
for file in "${ENTITY_FILES[@]}"; do
    if [ -f "$file" ]; then
        ((ENTITY_COUNT++))
    fi
done

if [ $ENTITY_COUNT -eq ${#ENTITY_FILES[@]} ]; then
    pass "All entity test files exist (${ENTITY_COUNT}/${#ENTITY_FILES[@]})"
else
    fail "Entity test files: ${ENTITY_COUNT}/${#ENTITY_FILES[@]} found"
fi

# Test a few key entity packages
info "Testing item entities..."
if go test ./internal/domain/warehouse/item -run TestNew -timeout 30s &> /dev/null; then
    pass "Item entity tests pass"
else
    fail "Item entity tests fail"
fi

info "Testing user entities..."
if go test ./internal/domain/auth/user -run TestNew -timeout 30s &> /dev/null; then
    pass "User entity tests pass"
else
    fail "User entity tests fail"
fi

echo ""

# Task 1.3: Job Testing
echo "Task 1.3: Job Testing"
echo "---------------------"

# Check if job test files exist
if [ -f "internal/jobs/scheduler_test.go" ] || grep -q "TestScheduler" internal/jobs/*_test.go 2>/dev/null; then
    pass "Scheduler tests exist"
else
    fail "Scheduler tests not found"
fi

# Run job tests (short mode, no Redis needed)
info "Running job tests..."
if go test ./internal/jobs -short -timeout 30s &> /dev/null; then
    pass "Job tests pass"
else
    fail "Job tests fail"
fi

# Check job coverage
JOB_COVERAGE=$(go test ./internal/jobs -short -cover 2>/dev/null | grep coverage | awk '{print $5}' | sed 's/%//')
if [ ! -z "$JOB_COVERAGE" ]; then
    if (( $(echo "$JOB_COVERAGE >= 40.0" | bc -l) )); then
        pass "Job coverage: ${JOB_COVERAGE}% (target: 40%)"
    else
        fail "Job coverage: ${JOB_COVERAGE}% (target: 40%)"
    fi
else
    warn "Could not determine job coverage"
fi

echo ""

# Overall Phase 1 Validation
echo "Overall Phase 1 Status"
echo "----------------------"

# Run all tests
info "Running all tests..."
if go test ./... -short -timeout 2m &> /dev/null; then
    pass "All tests pass"
else
    fail "Some tests fail"
fi

# Calculate overall coverage
info "Calculating overall coverage..."
go test ./... -short -coverprofile=coverage-phase1.out -covermode=atomic &> /dev/null
OVERALL_COVERAGE=$(go tool cover -func=coverage-phase1.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')

if [ ! -z "$OVERALL_COVERAGE" ]; then
    if (( $(echo "$OVERALL_COVERAGE >= 53.0" | bc -l) )); then
        pass "Overall coverage: ${OVERALL_COVERAGE}% (target: 53.9%)"
    else
        warn "Overall coverage: ${OVERALL_COVERAGE}% (target: 53.9%)"
    fi
else
    warn "Could not determine overall coverage"
fi

# Clean up
rm -f coverage-phase1.out

echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Phase 1 Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit your changes: git add . && git commit -m 'Complete Phase 1 test coverage'"
    echo "2. Proceed to Phase 2: docs/go-tests/phase-2/QUICKSTART.md"
    exit 0
else
    echo -e "${RED}✗ Phase 1 Incomplete${NC}"
    echo ""
    echo "Fix the failed checks above and run this script again."
    exit 1
fi
