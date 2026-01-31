---
phase: 22-test-infrastructure-setup
plan: 03
status: complete
commits:
  - hash: 70a23e1
    message: "feat(22-03): add CI workflow with parallel tests and Codecov integration"
---

## Summary

Created CI workflow with parallel test execution for Go and frontend, coverage reporting via Codecov, and coverage badges in README.

## Artifacts Created

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI workflow with matrix strategy for parallel tests |
| `README.md` | Updated with Codecov and CI status badges |

## Key Implementation Details

### CI Workflow Structure
- **go-tests** job with matrix strategy (`unit` and `integration` run in parallel)
- **frontend-unit-tests** job runs Vitest with coverage
- **coverage** job aggregates all coverage and uploads to Codecov

### Go Test Configuration
- Unit tests: `go test -v -race -coverprofile=coverage-unit.out ./internal/...`
- Integration tests: `go test -v -tags=integration -coverprofile=coverage-int.out ./tests/integration/...`
- Services: PostgreSQL 16 and Redis 7 for integration tests
- Dbmate for migrations

### Coverage Reporting
- Uses `codecov/codecov-action@v5`
- Collects coverage from:
  - `coverage-unit.out` (Go unit tests)
  - `coverage-int.out` (Go integration tests)
  - `lcov.info` (Frontend Vitest)
- Badges added to README for visibility

### Estimated CI Time
- Go unit tests: ~1-2 min
- Go integration tests: ~2-3 min (parallel with unit tests)
- Frontend unit tests: ~1-2 min (parallel with Go tests)
- Coverage upload: ~30 sec
- **Total with parallelization: ~3-4 min** (meets <5 min target)

## Verification

- [x] YAML syntax validates with `yaml.safe_load()`
- [x] Matrix strategy present in workflow
- [x] Codecov action configured
- [x] README contains coverage badge
- [x] All referenced file paths exist (`backend/go.sum`, `frontend/package.json`)

## User Setup Required

Before CI workflow can upload coverage:
1. Enable repository in Codecov at codecov.io
2. Add `CODECOV_TOKEN` secret to GitHub repository settings (may not be needed for public repos)
