# Requirements: Home Warehouse System

**Defined:** 2026-01-31
**Core Value:** Reliable inventory access anywhere — online or offline — with seamless sync

## v1.4 Requirements

Requirements for test overhaul milestone. Target: 80% minimum coverage standard.

### Backend Business Logic

- [ ] **BE-01**: Import/export package reaches 80%+ test coverage (currently 31%)
- [ ] **BE-02**: Pending changes package reaches 80%+ test coverage (currently 29%)
- [ ] **BE-03**: Import job package reaches 80%+ test coverage (currently 38%)
- [ ] **BE-04**: Jobs package reaches 80%+ test coverage (currently 17%)
- [ ] **BE-05**: Item photo package reaches 80%+ test coverage (currently 40%)
- [ ] **BE-06**: Repair log package reaches 80%+ test coverage (currently 36%)

### Backend API Testing

- [ ] **API-01**: Handler unit tests with mocked dependencies for all domain handlers
- [ ] **API-02**: Integration tests for critical API flows with test database
- [ ] **API-03**: Request/response validation tests for all endpoints

### Frontend Unit Testing

- [ ] **FE-01**: useOfflineMutation hook has comprehensive test coverage
- [ ] **FE-02**: SyncManager has comprehensive test coverage (beyond ordering)
- [ ] **FE-03**: Form hooks (useMultiStepForm, validation) have test coverage
- [ ] **FE-04**: BarcodeScanner component has unit tests
- [ ] **FE-05**: FloatingActionButton/radial menu has unit tests

### E2E Testing

- [ ] **E2E-01**: Auth setup timing issues resolved — tests no longer flaky due to auth
- [ ] **E2E-02**: Flaky tests identified and stabilized
- [ ] **E2E-03**: Missing user flow tests added (identify gaps and fill)

### Test Infrastructure

- [x] **INFRA-01**: CI runs tests in parallel for faster feedback
- [x] **INFRA-02**: @vitest/coverage-v8 installed and configured
- [x] **INFRA-03**: Coverage reporting in CI with badges
- [x] **INFRA-04**: Go test factories/fixtures for common entities
- [x] **INFRA-05**: Frontend mock utilities for offline/sync testing

## Future Requirements

Deferred to later milestones:

### iOS/Safari Testing
- **IOS-01**: iOS PWA flow E2E tests
- **IOS-02**: Safari-specific behavior tests
- **IOS-03**: Touch interaction tests for mobile

### Performance Testing
- **PERF-01**: Load testing for API endpoints
- **PERF-02**: Sync performance benchmarks
- **PERF-03**: IndexedDB operation benchmarks

## Out of Scope

| Feature | Reason |
|---------|--------|
| 100% coverage | Diminishing returns, 80% captures critical paths |
| Mutation testing | Complexity vs value for current project stage |
| Visual regression testing | Snapshot testing adds maintenance burden |
| Contract testing | No external API consumers yet |
| Jobs/worker testing to 80% | Background jobs less critical than business logic |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 22 | ✅ Complete |
| INFRA-02 | Phase 22 | ✅ Complete |
| INFRA-03 | Phase 22 | ✅ Complete |
| INFRA-04 | Phase 22 | ✅ Complete |
| INFRA-05 | Phase 22 | ✅ Complete |
| BE-01 | Phase 23 | Pending |
| BE-02 | Phase 23 | Pending |
| BE-03 | Phase 23 | Pending |
| BE-04 | Phase 23 | Pending |
| BE-05 | Phase 23 | Pending |
| BE-06 | Phase 23 | Pending |
| API-01 | Phase 24 | Pending |
| API-02 | Phase 24 | Pending |
| API-03 | Phase 24 | Pending |
| FE-01 | Phase 25 | Pending |
| FE-02 | Phase 25 | Pending |
| FE-03 | Phase 25 | Pending |
| FE-04 | Phase 25 | Pending |
| FE-05 | Phase 25 | Pending |
| E2E-01 | Phase 26 | Pending |
| E2E-02 | Phase 26 | Pending |
| E2E-03 | Phase 26 | Pending |

**Coverage:**
- v1.4 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 after Phase 22 complete*
