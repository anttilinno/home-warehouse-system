#!/bin/bash

# Phase 2 Validation Script
# Validates that Phase 2 tasks are completed correctly

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
    echo "Phase 2 Pre-Flight Checks"
    echo "================================"
    echo ""

    # Check Phase 1 completion
    info "Checking Phase 1 completion..."
    if bash docs/go-tests/scripts/validate-phase-1.sh &> /dev/null; then
        pass "Phase 1 is complete"
    else
        fail "Phase 1 must be completed first"
        exit 1
    fi

    # Check current coverage
    go test ./... -short -coverprofile=pre-phase2.out -covermode=atomic &> /dev/null
    CURRENT_COVERAGE=$(go tool cover -func=pre-phase2.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')
    rm -f pre-phase2.out

    if [ ! -z "$CURRENT_COVERAGE" ]; then
        if (( $(echo "$CURRENT_COVERAGE >= 50.0" | bc -l) )); then
            pass "Current coverage: ${CURRENT_COVERAGE}% (ready for Phase 2)"
        else
            warn "Current coverage: ${CURRENT_COVERAGE}% (expected ~54% after Phase 1)"
        fi
    fi

    echo ""
    pass "Pre-flight checks complete!"
    echo ""
    echo "Ready to start Phase 2"
    exit 0
fi

# Main validation
echo "================================"
echo "Phase 2 Validation"
echo "================================"
echo ""

# Task 2.1: Handler Test Infrastructure
echo "Task 2.1: Handler Test Infrastructure"
echo "-------------------------------------"

if [ -f "internal/testutil/handler.go" ]; then
    pass "handler.go exists"
else
    fail "handler.go not found"
fi

if [ -f "internal/testutil/handler_test.go" ]; then
    pass "handler_test.go exists"
else
    warn "handler_test.go not found (optional)"
fi

info "Testing handler infrastructure..."
if go test ./internal/testutil -timeout 30s &> /dev/null; then
    pass "Handler infrastructure tests pass"
else
    fail "Handler infrastructure tests fail"
fi

echo ""

# Task 2.2: Warehouse Handler Tests
echo "Task 2.2: Warehouse Handler Tests"
echo "----------------------------------"

WAREHOUSE_HANDLERS=(
    "item"
    "location"
    "container"
    "inventory"
    "loan"
    "borrower"
    "label"
    "company"
    "activity"
    "attachment"
    "deleted"
    "favorite"
    "movement"
)

WH_HANDLER_COUNT=0
for handler in "${WAREHOUSE_HANDLERS[@]}"; do
    if [ -f "internal/domain/warehouse/$handler/handler_test.go" ]; then
        ((WH_HANDLER_COUNT++))
    fi
done

if [ $WH_HANDLER_COUNT -eq ${#WAREHOUSE_HANDLERS[@]} ]; then
    pass "Warehouse handlers: ${WH_HANDLER_COUNT}/${#WAREHOUSE_HANDLERS[@]}"
else
    fail "Warehouse handlers: ${WH_HANDLER_COUNT}/${#WAREHOUSE_HANDLERS[@]}"
fi

# Test a few key warehouse handlers
info "Testing item handler..."
if go test ./internal/domain/warehouse/item -run TestItemHandler -timeout 30s &> /dev/null; then
    pass "Item handler tests pass"
else
    fail "Item handler tests fail"
fi

info "Testing location handler..."
if go test ./internal/domain/warehouse/location -run TestLocationHandler -timeout 30s &> /dev/null; then
    pass "Location handler tests pass"
else
    warn "Location handler tests fail or not implemented"
fi

echo ""

# Task 2.3: Auth Handler Tests
echo "Task 2.3: Auth Handler Tests"
echo "----------------------------"

AUTH_HANDLERS=(
    "user"
    "workspace"
    "member"
    "notification"
)

AUTH_HANDLER_COUNT=0
for handler in "${AUTH_HANDLERS[@]}"; do
    if [ -f "internal/domain/auth/$handler/handler_test.go" ]; then
        ((AUTH_HANDLER_COUNT++))
    fi
done

if [ $AUTH_HANDLER_COUNT -eq ${#AUTH_HANDLERS[@]} ]; then
    pass "Auth handlers: ${AUTH_HANDLER_COUNT}/${#AUTH_HANDLERS[@]}"
else
    fail "Auth handlers: ${AUTH_HANDLER_COUNT}/${#AUTH_HANDLERS[@]}"
fi

# Test user handler (most critical)
info "Testing user handler..."
if go test ./internal/domain/auth/user -run TestUserHandler -timeout 30s &> /dev/null; then
    pass "User handler tests pass"
else
    warn "User handler tests fail or not implemented"
fi

echo ""

# Task 2.4: Top-Level Handler Tests
echo "Task 2.4: Top-Level Handler Tests"
echo "----------------------------------"

TOPLEVEL_HANDLERS=(
    "analytics"
    "barcode"
    "batch"
    "importexport"
    "sync"
)

TOPLEVEL_HANDLER_COUNT=0
for handler in "${TOPLEVEL_HANDLERS[@]}"; do
    if [ -f "internal/domain/$handler/handler_test.go" ]; then
        ((TOPLEVEL_HANDLER_COUNT++))
    fi
done

if [ $TOPLEVEL_HANDLER_COUNT -eq ${#TOPLEVEL_HANDLERS[@]} ]; then
    pass "Top-level handlers: ${TOPLEVEL_HANDLER_COUNT}/${#TOPLEVEL_HANDLERS[@]}"
else
    fail "Top-level handlers: ${TOPLEVEL_HANDLER_COUNT}/${#TOPLEVEL_HANDLERS[@]}"
fi

echo ""

# Overall Phase 2 Validation
echo "Overall Phase 2 Status"
echo "----------------------"

# Run all tests
info "Running all tests..."
if go test ./... -short -timeout 3m &> /dev/null; then
    pass "All tests pass"
else
    fail "Some tests fail"
fi

# Calculate overall coverage
info "Calculating overall coverage..."
go test ./... -short -coverprofile=coverage-phase2.out -covermode=atomic &> /dev/null
OVERALL_COVERAGE=$(go tool cover -func=coverage-phase2.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')

if [ ! -z "$OVERALL_COVERAGE" ]; then
    if (( $(echo "$OVERALL_COVERAGE >= 75.0" | bc -l) )); then
        pass "Overall coverage: ${OVERALL_COVERAGE}% (target: 78.9%)"
    else
        warn "Overall coverage: ${OVERALL_COVERAGE}% (target: 78.9%)"
    fi
else
    warn "Could not determine overall coverage"
fi

# Check handler-specific coverage
info "Checking handler coverage..."
HANDLER_COVERAGE=$(go test ./internal/domain/warehouse/item -cover 2>/dev/null | grep coverage | awk '{print $5}' | sed 's/%//')
if [ ! -z "$HANDLER_COVERAGE" ]; then
    if (( $(echo "$HANDLER_COVERAGE >= 80.0" | bc -l) )); then
        pass "Item handler coverage: ${HANDLER_COVERAGE}%"
    else
        warn "Item handler coverage: ${HANDLER_COVERAGE}% (target: 85%)"
    fi
fi

# Clean up
rm -f coverage-phase2.out

echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Phase 2 Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit your changes: git add . && git commit -m 'Complete Phase 2 handler tests'"
    echo "2. Proceed to Phase 3: docs/go-tests/phase-3/QUICKSTART.md"
    exit 0
else
    echo -e "${RED}✗ Phase 2 Incomplete${NC}"
    echo ""
    echo "Fix the failed checks above and run this script again."
    exit 1
fi
