#!/bin/bash

# Phase 5 Validation Script - Final Coverage Check

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASSED++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAILED++)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }

# Pre-flight checks
if [ "$1" == "--pre-flight" ]; then
    echo "================================"
    echo "Phase 5 Pre-Flight Checks"
    echo "================================"
    echo ""

    if bash docs/go-tests/scripts/validate-phase-4.sh &> /dev/null; then
        pass "Phase 4 is complete"
    else
        fail "Phase 4 must be completed first"
        exit 1
    fi

    go test ./... -coverprofile=pre-phase5.out -covermode=atomic &> /dev/null
    CURRENT_COVERAGE=$(go tool cover -func=pre-phase5.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')
    rm -f pre-phase5.out

    if [ ! -z "$CURRENT_COVERAGE" ]; then
        if (( $(echo "$CURRENT_COVERAGE >= 90.0" | bc -l) )); then
            pass "Current coverage: ${CURRENT_COVERAGE}% (ready for Phase 5)"
        else
            warn "Current coverage: ${CURRENT_COVERAGE}% (expected ~92% after Phase 4)"
        fi
    fi

    echo ""
    pass "Pre-flight checks complete!"
    exit 0
fi

# Main validation
echo "========================================"
echo "Phase 5 Final Validation"
echo "========================================"
echo ""

# Task 5.1: Router and API Setup
echo "Task 5.1: Router and API Setup"
echo "-------------------------------"

if [ -f "internal/api/router_test.go" ]; then
    pass "router_test.go exists"
else
    warn "router_test.go not found"
fi

info "Testing router..."
if go test ./internal/api -run TestNewRouter -timeout 30s &> /dev/null; then
    pass "Router tests pass"
else
    warn "Router tests fail or not implemented"
fi

echo ""

# Task 5.2: Documentation Routes
echo "Task 5.2: Documentation Routes"
echo "-------------------------------"

if [ -f "internal/api/docs_test.go" ] || grep -q "TestOpenAPI\|TestDocs" internal/api/*_test.go 2>/dev/null; then
    pass "Documentation tests exist"
else
    warn "Documentation tests not found"
fi

echo ""

# Task 5.3: Batch Operations
echo "Task 5.3: Batch Operations"
echo "--------------------------"

if [ -f "internal/domain/batch/service_test.go" ]; then
    pass "Batch service tests exist"

    BATCH_COVERAGE=$(go test ./internal/domain/batch -cover 2>/dev/null | grep coverage | awk '{print $5}' | sed 's/%//')
    if [ ! -z "$BATCH_COVERAGE" ]; then
        if (( $(echo "$BATCH_COVERAGE >= 70.0" | bc -l) )); then
            pass "Batch coverage: ${BATCH_COVERAGE}%"
        else
            warn "Batch coverage: ${BATCH_COVERAGE}% (target: 75%)"
        fi
    fi
else
    warn "Batch service tests not found"
fi

echo ""

# Overall Final Validation
echo "========================================"
echo "Final Coverage Analysis"
echo "========================================"
echo ""

info "Running complete test suite..."
if go test ./... -timeout 5m &> /dev/null; then
    pass "All tests pass"
else
    fail "Some tests fail"
fi

echo ""
info "Calculating final coverage..."
go test ./... -coverprofile=coverage-final.out -covermode=atomic -timeout 5m &> /dev/null

# Overall coverage
OVERALL_COVERAGE=$(go tool cover -func=coverage-final.out 2>/dev/null | grep total | awk '{print $3}' | sed 's/%//')

if [ ! -z "$OVERALL_COVERAGE" ]; then
    echo ""
    if (( $(echo "$OVERALL_COVERAGE >= 95.0" | bc -l) )); then
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        echo -e "${GREEN}   🎉  COVERAGE TARGET ACHIEVED!  🎉${NC}"
        echo -e "${GREEN}════════════════════════════════════════${NC}"
        echo ""
        echo -e "Final Coverage: ${GREEN}${OVERALL_COVERAGE}%${NC}"
        echo ""
        ((PASSED++))
    else
        echo -e "${YELLOW}════════════════════════════════════════${NC}"
        echo -e "${YELLOW}   Almost there!${NC}"
        echo -e "${YELLOW}════════════════════════════════════════${NC}"
        echo ""
        echo -e "Current Coverage: ${YELLOW}${OVERALL_COVERAGE}%${NC}"
        echo -e "Target: ${GREEN}95.0%${NC}"
        echo -e "Gap: ${YELLOW}$(echo "95.0 - $OVERALL_COVERAGE" | bc)%${NC}"
        echo ""
        warn "Coverage below 95% target"
    fi
else
    fail "Could not determine coverage"
fi

# Package-level coverage check
echo ""
info "Checking package-level coverage..."
PACKAGES_BELOW_90=$(go tool cover -func=coverage-final.out 2>/dev/null | \
    awk '/\.go:/ {pkg=$1; sub(/\/[^/]+\.go:.*/, "", pkg); coverage[pkg]+=$3; count[pkg]++} \
    END {for (p in coverage) {avg=coverage[p]/count[p]; if (avg < 90.0) print p, avg}}' | \
    wc -l)

if [ "$PACKAGES_BELOW_90" -eq "0" ]; then
    pass "All packages >= 90%"
else
    warn "$PACKAGES_BELOW_90 package(s) below 90%"
    echo ""
    echo "Packages below 90%:"
    go tool cover -func=coverage-final.out 2>/dev/null | \
        awk '/\.go:/ {pkg=$1; sub(/\/[^/]+\.go:.*/, "", pkg); coverage[pkg]+=$3; count[pkg]++} \
        END {for (p in coverage) {avg=coverage[p]/count[p]; if (avg < 90.0) printf "  - %s: %.1f%%\n", p, avg}}'
fi

# Generate HTML report
echo ""
info "Generating HTML coverage report..."
go tool cover -html=coverage-final.out -o final-coverage.html 2>/dev/null
if [ -f "final-coverage.html" ]; then
    pass "HTML report generated: final-coverage.html"
    echo ""
    echo "  To view: open final-coverage.html"
fi

# Keep coverage file for reference
mv coverage-final.out coverage-phase5-final.out 2>/dev/null || true

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ] && (( $(echo "$OVERALL_COVERAGE >= 95.0" | bc -l) )); then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║   🏆  PHASE 5 COMPLETE!  🏆            ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║   Test Coverage: ${OVERALL_COVERAGE}%                 ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Final steps:"
    echo "1. Review coverage report: open final-coverage.html"
    echo "2. Commit: git add . && git commit -m 'Achieve 95% test coverage'"
    echo "3. Celebrate! 🎉"
    echo ""
    echo "To maintain coverage:"
    echo "- Run tests in CI/CD"
    echo "- Require tests for new code"
    echo "- Review coverage reports regularly"
    exit 0
else
    echo -e "${YELLOW}Phase 5 In Progress${NC}"
    echo ""
    if [ ! -z "$OVERALL_COVERAGE" ] && (( $(echo "$OVERALL_COVERAGE < 95.0" | bc -l) )); then
        GAP=$(echo "95.0 - $OVERALL_COVERAGE" | bc)
        echo "Coverage gap: ${GAP}%"
        echo ""
        echo "Next steps:"
        echo "1. Review HTML report: open final-coverage.html"
        echo "2. Identify uncovered code (red sections)"
        echo "3. Add targeted tests for those sections"
        echo "4. Run this script again"
    else
        echo "Fix the failed checks above and run this script again."
    fi
    exit 1
fi
