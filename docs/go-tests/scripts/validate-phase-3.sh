#!/bin/bash

# Phase 3 Validation Script

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
    echo "Phase 3 Pre-Flight Checks"
    echo "================================"
    echo ""

    if bash docs/go-tests/scripts/validate-phase-2.sh &> /dev/null; then
        pass "Phase 2 is complete"
    else
        fail "Phase 2 must be completed first"
        exit 1
    fi

    go test ./... -short -coverprofile=pre-phase3.out -covermode=atomic &> /dev/null
    CURRENT_COVERAGE=$(go tool cover -func=pre-phase3.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')
    rm -f pre-phase3.out

    if [ ! -z "$CURRENT_COVERAGE" ]; then
        if (( $(echo "$CURRENT_COVERAGE >= 75.0" | bc -l) )); then
            pass "Current coverage: ${CURRENT_COVERAGE}% (ready for Phase 3)"
        else
            warn "Current coverage: ${CURRENT_COVERAGE}% (expected ~79% after Phase 2)"
        fi
    fi

    echo ""
    pass "Pre-flight checks complete!"
    exit 0
fi

# Main validation
echo "================================"
echo "Phase 3 Validation"
echo "================================"
echo ""

echo "Service Error Path Coverage"
echo "---------------------------"

# Check service coverage for target packages
declare -A SERVICE_TARGETS
SERVICE_TARGETS["internal/domain/warehouse/activity"]=75
SERVICE_TARGETS["internal/domain/warehouse/movement"]=70
SERVICE_TARGETS["internal/domain/warehouse/loan"]=75
SERVICE_TARGETS["internal/domain/warehouse/company"]=70
SERVICE_TARGETS["internal/domain/auth/user"]=70
SERVICE_TARGETS["internal/domain/auth/notification"]=70
SERVICE_TARGETS["internal/domain/auth/workspace"]=70
SERVICE_TARGETS["internal/domain/auth/member"]=70

for pkg in "${!SERVICE_TARGETS[@]}"; do
    target=${SERVICE_TARGETS[$pkg]}
    coverage=$(go test ./$pkg -cover 2>/dev/null | grep coverage | awk '{print $5}' | sed 's/%//')

    if [ ! -z "$coverage" ]; then
        if (( $(echo "$coverage >= $target" | bc -l) )); then
            pass "$(basename $pkg): ${coverage}% (target: ${target}%)"
        else
            fail "$(basename $pkg): ${coverage}% (target: ${target}%)"
        fi
    else
        warn "$(basename $pkg): Could not determine coverage"
    fi
done

echo ""

# Overall validation
echo "Overall Phase 3 Status"
echo "----------------------"

info "Running all tests..."
if go test ./... -short -timeout 3m &> /dev/null; then
    pass "All tests pass"
else
    fail "Some tests fail"
fi

info "Calculating overall coverage..."
go test ./... -short -coverprofile=coverage-phase3.out -covermode=atomic &> /dev/null
OVERALL_COVERAGE=$(go tool cover -func=coverage-phase3.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')

if [ ! -z "$OVERALL_COVERAGE" ]; then
    if (( $(echo "$OVERALL_COVERAGE >= 85.0" | bc -l) )); then
        pass "Overall coverage: ${OVERALL_COVERAGE}% (target: 86.9%)"
    else
        warn "Overall coverage: ${OVERALL_COVERAGE}% (target: 86.9%)"
    fi
fi

rm -f coverage-phase3.out

echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Phase 3 Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit: git add . && git commit -m 'Complete Phase 3 service error paths'"
    echo "2. Proceed to Phase 4: docs/go-tests/phase-4/QUICKSTART.md"
    exit 0
else
    echo -e "${RED}✗ Phase 3 Incomplete${NC}"
    exit 1
fi
