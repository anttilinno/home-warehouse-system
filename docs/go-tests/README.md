# Go Backend Test Coverage Improvement Plan

**Goal**: Increase test coverage from 38.9% to 95%

**Current State**: 38.9% overall coverage (786 tests passing)

## Executive Summary

The Go backend has excellent test infrastructure and service-layer coverage, but suffers from three critical gaps:
1. **Handler tests missing** (95% of HTTP handlers untested)
2. **Entity validation tests missing** (96% of domain entities untested)
3. **Service error paths incomplete** (40-60% coverage in many services)

This plan provides a systematic, phase-by-phase approach to achieve 95% coverage while maintaining test quality and execution speed.

## Structure

This documentation is organized into 5 phases, each with detailed action items:

### Phase 1: Foundation & Quick Wins (Target: +15% → 53.9%)
Complete partially tested packages and add missing unit tests for middleware and utilities.

- [1.1 Complete Middleware Testing](phase-1/1.1-middleware-testing.md) (Target: 49.3% → 95%)
- [1.2 Add Entity Validation Tests](phase-1/1.2-entity-validation.md) (Target: 4% → 90%)
- [1.3 Complete Job Testing](phase-1/1.3-job-testing.md) (Target: 15.4% → 40%)

**Estimated effort**: 14-18 hours | **Tests to add**: 135-200

### Phase 2: Handler Test Suite (Target: +25% → 78.9%)
Add comprehensive HTTP handler tests for all 22 missing handlers.

- [2.1 Create Handler Test Infrastructure](phase-2/2.1-handler-test-infrastructure.md)
- [2.2 Warehouse Domain Handlers](phase-2/2.2-warehouse-handlers.md) (13 handlers)
- [2.3 Auth Domain Handlers](phase-2/2.3-auth-handlers.md) (4 handlers)
- [2.4 Top-Level Domain Handlers](phase-2/2.4-toplevel-handlers.md) (5 handlers)

**Estimated effort**: 80-100 hours | **Tests to add**: 315-392

### Phase 3: Service Error Path Coverage (Target: +8% → 86.9%)
Improve service layer coverage by adding comprehensive error scenario testing.

- [3.1 Add Service Error Path Tests](phase-3/3.1-service-error-paths.md)

**Estimated effort**: 25-30 hours | **Tests to add**: 150-200

### Phase 4: Integration Test Expansion (Target: +5% → 91.9%)
Add comprehensive integration tests for complex workflows and error scenarios.

- [4.1 Expand E2E Integration Tests](phase-4/4.1-e2e-integration-tests.md)
- [4.2 Add Negative Integration Tests](phase-4/4.2-negative-integration-tests.md)

**Estimated effort**: 25-32 hours | **Tests to add**: 80-110

### Phase 5: Remaining Gaps & Polish (Target: +3.1% → 95%)
Fill remaining coverage gaps and polish test suite.

- [5.1 Test Router and API Setup](phase-5/5.1-router-api-setup.md)
- [5.2 Test Documentation Routes](phase-5/5.2-documentation-routes.md)
- [5.3 Add Batch Operation Tests](phase-5/5.3-batch-operations.md)
- [5.4 Test Coverage Analysis & Gap Filling](phase-5/5.4-coverage-gap-filling.md)

**Estimated effort**: 18-22 hours | **Tests to add**: 80-113

## Shared Resources

- [Implementation Guidelines](shared/implementation-guidelines.md) - Testing standards and best practices
- [Progress Tracking](shared/progress-tracking.md) - How to track and verify progress

## Total Effort Summary

| Phase | Tests to Add | Estimated Time |
|-------|--------------|----------------|
| Phase 1 | 135-200 | 14-18 hours |
| Phase 2 | 315-392 | 80-100 hours |
| Phase 3 | 150-200 | 25-30 hours |
| Phase 4 | 80-110 | 25-32 hours |
| Phase 5 | 80-113 | 18-22 hours |
| **TOTAL** | **760-1,015** | **162-202 hours** |

**Realistic timeline**: 4-6 weeks (1 developer, full-time focus on testing)

## Success Criteria

✅ **Coverage Targets Met**:
- Overall: 95%+
- Handlers: 85%+ (up from ~4%)
- Services: 80%+ (up from ~50% average)
- Entities: 90%+ (up from 4%)
- Middleware: 95%+ (up from 49.3%)
- Integration: Comprehensive E2E coverage

✅ **Test Quality**:
- All tests pass consistently
- No flaky tests
- Fast execution (<2 min for unit tests, <5 min total)
- Clear test names and documentation

✅ **Maintainability**:
- Consistent patterns across all tests
- Shared test utilities for common operations
- Easy to add new tests following existing patterns
- Clear separation: unit tests (mocked) vs integration tests (real DB)

## Getting Started

**→ [Start Here: Getting Started Guide](GETTING_STARTED.md)** ← Recommended entry point

### Quick Links

- **Step-by-Step Execution**: [Phase 1 Quick Start](phase-1/QUICKSTART.md)
- **Implementation Standards**: [Implementation Guidelines](shared/implementation-guidelines.md)
- **Progress Monitoring**: [Progress Tracking](shared/progress-tracking.md)
- **Validation Scripts**: [scripts/](scripts/)

### Execution Paths

1. **Guided Execution** (Recommended for smaller models): Follow [Quick Start guides](GETTING_STARTED.md#phase-by-phase-execution)
2. **Detailed Planning**: Read phase documentation, then implement
3. **Autonomous**: Review guidelines and implement independently

## Notes

- Integration tests with `//go:build integration` tag don't count toward standard coverage but provide critical E2E validation
- Focus on meaningful tests over coverage numbers - don't test getters/setters excessively
- Mock external dependencies (JWT, database, Redis) in unit tests
- Keep integration tests in separate suite for CI/CD optimization
- All new tests should follow existing patterns from high-coverage packages (category, importexport)
