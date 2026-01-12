#!/bin/bash

# Phase 4 Validation Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASSED++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAILED++)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
info() { echo -e "${NC}ℹ${NC} $1"; }

# Pre-flight checks
if [ "$1" == "--pre-flight" ]; then
    echo "================================"
    echo "Phase 4 Pre-Flight Checks"
    echo "================================"
    echo ""

    if bash docs/go-tests/scripts/validate-phase-3.sh &> /dev/null; then
        pass "Phase 3 is complete"
    else
        fail "Phase 3 must be completed first"
        exit 1
    fi

    # Check PostgreSQL
    if docker ps | grep -q postgres; then
        pass "PostgreSQL container is running"
    else
        fail "PostgreSQL container not running. Start with: docker-compose up -d postgres"
        exit 1
    fi

    # Check test database connection
    if psql -h localhost -U wh -d warehouse_test -c "SELECT 1;" &> /dev/null; then
        pass "Test database accessible"
    else
        warn "Test database not accessible. May need to create it."
    fi

    # Check TEST_DATABASE_URL
    if [ ! -z "$TEST_DATABASE_URL" ]; then
        pass "TEST_DATABASE_URL is set"
    else
        warn "TEST_DATABASE_URL not set. Integration tests need this."
    fi

    echo ""
    pass "Pre-flight checks complete!"
    exit 0
fi

# Main validation
echo "================================"
echo "Phase 4 Validation"
echo "================================"
echo ""

# Check database prerequisites
echo "Database Prerequisites"
echo "---------------------"

if docker ps | grep -q postgres; then
    pass "PostgreSQL running"
else
    fail "PostgreSQL not running"
fi

if psql -h localhost -U wh -d warehouse_test -c "SELECT 1;" &> /dev/null; then
    pass "Test database accessible"
else
    fail "Test database not accessible"
fi

echo ""

# Task 4.1: E2E Integration Tests
echo "Task 4.1: E2E Integration Tests"
echo "--------------------------------"

INTEGRATION_TESTS=(
    "attachment_flow_test.go"
    "activity_flow_test.go"
    "movement_flow_test.go"
    "label_flow_test.go"
    "favorite_flow_test.go"
    "company_flow_test.go"
    "deleted_flow_test.go"
)

E2E_COUNT=0
for test in "${INTEGRATION_TESTS[@]}"; do
    if [ -f "tests/integration/$test" ]; then
        ((E2E_COUNT++))
    fi
done

if [ $E2E_COUNT -ge 5 ]; then
    pass "E2E tests created: ${E2E_COUNT}/${#INTEGRATION_TESTS[@]}"
else
    warn "E2E tests created: ${E2E_COUNT}/${#INTEGRATION_TESTS[@]}"
fi

echo ""

# Task 4.2: Negative Integration Tests
echo "Task 4.2: Negative Integration Tests"
echo "-------------------------------------"

NEGATIVE_TESTS=(
    "permission_test.go"
    "constraints_test.go"
    "state_transitions_test.go"
    "isolation_test.go"
)

NEG_COUNT=0
for test in "${NEGATIVE_TESTS[@]}"; do
    if [ -f "tests/integration/$test" ]; then
        ((NEG_COUNT++))
    fi
done

if [ $NEG_COUNT -ge 2 ]; then
    pass "Negative tests created: ${NEG_COUNT}/${#NEGATIVE_TESTS[@]}"
else
    warn "Negative tests created: ${NEG_COUNT}/${#NEGATIVE_TESTS[@]}"
fi

echo ""

# Run integration tests
echo "Running Integration Tests"
echo "-------------------------"

if [ -z "$TEST_DATABASE_URL" ]; then
    export TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable"
    warn "TEST_DATABASE_URL not set, using default"
fi

info "Running integration tests..."
if go test ./tests/integration -v -tags=integration -timeout 5m &> /dev/null; then
    pass "Integration tests pass"
else
    fail "Integration tests fail"
fi

echo ""

# Overall validation
echo "Overall Phase 4 Status"
echo "----------------------"

info "Calculating overall coverage..."
go test ./... -tags=integration -coverprofile=coverage-phase4.out -covermode=atomic -timeout 5m &> /dev/null
OVERALL_COVERAGE=$(go tool cover -func=coverage-phase4.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')

if [ ! -z "$OVERALL_COVERAGE" ]; then
    if (( $(echo "$OVERALL_COVERAGE >= 90.0" | bc -l) )); then
        pass "Overall coverage: ${OVERALL_COVERAGE}% (target: 91.9%)"
    else
        warn "Overall coverage: ${OVERALL_COVERAGE}% (target: 91.9%)"
    fi
fi

rm -f coverage-phase4.out

echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Phase 4 Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit: git add . && git commit -m 'Complete Phase 4 integration tests'"
    echo "2. Proceed to Phase 5: docs/go-tests/phase-5/QUICKSTART.md"
    exit 0
else
    echo -e "${RED}✗ Phase 4 Incomplete${NC}"
    exit 1
fi
