Backend Testing Guide
=====================

Coverage snapshot
-----------------
- Latest run: `mise exec uv -- uv run --extra dev pytest --cov=src/warehouse --cov-report=term`
- Overall coverage: **99%** (controllers still have a few uncovered lines).

Test suites
-----------
- Unit: Domain services, repositories, schemas, controllers under `src/warehouse/domain/**/tests/`.
- Core/helpers: `src/warehouse/tests/` (app/config) and `src/warehouse/lib/tests/` (base repo).
- E2E flows: `e2e/` exercises API endpoints (requires Postgres per `.mise.toml` tasks).

How to run
----------
- All tests: `mise exec uv -- uv run --extra dev pytest`
- With coverage: `mise exec uv -- uv run --extra dev pytest --cov=src/warehouse --cov-report=term`
- Lint: `mise exec uv -- uv run ruff check .`

Notes
-----
- Controllers are tested by invoking handler functions directly with mocked services (no ASGI client required).
- Unit tests mock database access; E2E tests expect the configured Postgres (`mise task db-up`).
- Python/uv are managed via `mise`; ensure `mise` is installed or use the provided tasks.*** End Patch
