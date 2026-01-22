# Codebase Concerns

**Analysis Date:** 2026-01-22

## Tech Debt

**Incomplete Workspace Import/Export (Critical)**
- Issue: Workspace restore functionality has multiple TODO markers for incomplete implementations
- Files: `backend/internal/domain/importexport/workspace_restore.go:452`, `:676`, `:722`, `:752`, `:759`, `:765`
- Impact: CSV import feature cannot reliably restore full workspace state; items lose category associations, containers lose location references, inventory/loans/attachments are completely skipped
- Fix approach: Implement category mapping (track original→new ID mappings), location resolution for containers, and complete inventory/loan/attachment import logic. All currently returning empty error slices.

**Row-Level Error Tracking Not Implemented (Medium)**
- Issue: Import errors hardcoded to row 0 instead of actual row numbers
- Files: `backend/internal/domain/importexport/workspace_restore.go:452`, `:471`, `:490`, `:517`
- Impact: Users cannot identify which CSV rows failed during bulk import
- Fix approach: Thread row number through import functions and populate ImportError.Row field

**Item Photo Thumbnail Format Limitation (Low)**
- Issue: Only JPEG thumbnails generated; WebP support needs database schema changes
- Files: `backend/internal/domain/warehouse/itemphoto/service.go:150`
- Impact: Missing modern image format support, database migration required to store multiple thumbnail paths
- Fix approach: Add `thumbnail_webp_path` column to item_photos table, generate both JPEG and WebP in CreatePhoto

**Unimplemented Email Integration (High)**
- Issue: Loan reminder job framework exists but email sending is not wired to actual service
- Files: `backend/internal/jobs/loan_reminder.go`
- Impact: Loan reminders cannot notify users; SMTP configuration or email service provider (Resend, SendGrid, SES) not integrated
- Fix approach: Wire Resend API key (exists in config) to actual email sending, implement email templates

**Missing Inventory Movement Audit Trail (Medium)**
- Issue: Movement history records operations but doesn't capture `MovedBy` user ID
- Files: `backend/internal/domain/warehouse/inventory/service.go:176`
- Impact: Cannot track which user made inventory movements; audit trail incomplete
- Fix approach: Extract authenticated user ID from context, pass through service layer, populate MovedBy field

**Activity Logging Not Fully Wired (Medium)**
- Issue: Activity service exists but not integrated into all operations (e.g., item archival doesn't create audit records)
- Files: `backend/tests/integration/workflow_test.go:510`
- Impact: Deleted/archived items don't generate audit trail entries; compliance and debugging harder
- Fix approach: Audit all CRUD handlers to ensure activity logging calls for create/update/delete operations

**Approval Pipeline Middleware Not Integrated (High)**
- Issue: Approval middleware works in isolation but doesn't intercept actual Huma routes; skipped test
- Files: `backend/tests/integration/approval_pipeline_test.go:46`
- Impact: Member approval pipeline doesn't actually enforce 202 Accepted responses; members can bypass approval workflow
- Fix approach: Integrate approval middleware into Chi/Huma router to intercept CRUD operations by member role

---

## Known Bugs

**Item Photos Test Skipped (Medium)**
- Symptoms: Item photo upload/download functionality cannot be verified via integration tests
- Files: `backend/tests/integration/item_photos_test.go:28`
- Trigger: Run integration test suite
- Workaround: Manual testing only; test needs rewrite to use NewTestServer pattern
- Root cause: Test environment not properly set up; old test harness incompatible with current router

**Approval Pipeline Complete Workflow Not Tested (Medium)**
- Symptoms: Middleware unit tests pass but full request/response cycle untested
- Files: `backend/tests/integration/approval_pipeline_test.go:45`
- Trigger: t.Skip() called unconditionally
- Workaround: Manual test approval flow; handler integration tests work but route interception not verified
- Root cause: Middleware integration with Huma routing incomplete; awaiting architectural fix

---

## Security Considerations

**JWT Secret Default in Non-Debug Mode (Medium Risk)**
- Risk: Default JWT secret "change-me-in-production" not enforced in production if validation bypassed
- Files: `backend/internal/config/config.go:61`, `:95`
- Current mitigation: Config.Validate() checks and rejects default secret outside debug mode; validation called on startup
- Recommendations:
  - Add environment variable validation in docker-compose/k8s manifests
  - Log warning when default secret detected
  - Consider making JWT_SECRET required (no default) in production builds

**Hardcoded Secrets in Config Tests (Low Risk)**
- Risk: Test secrets visible in source code (test_key, google_secret, github_secret)
- Files: `backend/internal/config/config_test.go:39`, `:49`, `:51`
- Current mitigation: Test credentials only, not production secrets
- Recommendations: Use environment setup fixtures instead of hardcoded strings in test assertions

**OAuth Secrets Not Validated (Medium Risk)**
- Risk: GoogleClientSecret, GitHubClientSecret can be empty strings (defaults to "")
- Files: `backend/internal/config/config.go:76-79`
- Current mitigation: No validation for OAuth credentials; not enforced at startup
- Recommendations: Validate required OAuth secrets when OAuth routes registered; fail fast if missing

**No Sensitive Data Sanitization in Logs (Medium Risk)**
- Risk: Log output may contain passwords, tokens, or error messages with sensitive data
- Files: `backend/internal/api/middleware/` (logging middleware exists but no field sanitization)
- Current mitigation: DEBUG mode produces human-readable logs; production uses JSON (less exposure)
- Recommendations: Implement log field redaction for password_hash, tokens, email addresses

**Password Hashing Not Visible (Cannot Assess)**
- Risk: Password hashing algorithm not visible in code review; using default bcrypt
- Files: `backend/internal/domain/auth/user/` (likely uses bcrypt)
- Current mitigation: Assumed bcrypt with default cost
- Recommendations: Document password hashing algorithm (bcrypt cost factor, salt rounds)

---

## Performance Bottlenecks

**No Query Pagination Limits (High Impact)**
- Problem: List endpoints can return unbounded result sets; full-text search not indexed
- Files: `backend/internal/infra/queries/inventory.sql.go`, `item.sql.go` (likely generated from sqlc)
- Cause: sqlc generates simple queries without LIMIT enforcement; no pagination parameters enforced
- Improvement path: Add MAX_PAGE_SIZE constant (e.g., 1000), enforce in handlers, add OFFSET/LIMIT to SQL queries

**No Redis Caching Layer (Medium Impact)**
- Problem: Redis available (used for background jobs) but no query caching for frequently accessed data (categories, locations, user prefs)
- Files: `backend/internal/infra/redis/` (only used by import_worker)
- Cause: Cache layer never implemented in architecture phase
- Improvement path: Add caching decorator to common queries, cache categories/locations/labels with TTL, invalidate on writes

**Full-Text Search Not Optimized (Medium Impact)**
- Problem: Search works but indexes may not be tuned for performance; could be slow on large inventories
- Files: Database schema uses `search_vector tsvector` but index strategy unclear
- Cause: Initial implementation uses PostgreSQL full-text search without analysis of query patterns
- Improvement path: Run EXPLAIN ANALYZE on common queries, add GIN/GIST indexes, monitor slow query logs

**No Query Timeout Configuration (Medium Impact)**
- Problem: Long-running queries can hang requests indefinitely
- Files: `backend/internal/config/config.go:68` (ServerTimeout set but database timeout not configured)
- Cause: Database queries inherit context timeout from HTTP request, but connection pool not configured with statement timeout
- Improvement path: Add DATABASE_STATEMENT_TIMEOUT env var, set pgx statement timeout in pool config, log slow queries

**Image Processing Not Optimized (Low Impact)**
- Problem: Photo thumbnail generation synchronous on upload; large files block upload handler
- Files: `backend/internal/domain/warehouse/itemphoto/service.go:140-160`
- Cause: Thumbnail generation in request path instead of async queue
- Improvement path: Queue thumbnail generation to background worker, return 202 Accepted, notify client when ready

---

## Fragile Areas

**Workspace Import/Export Service (High Fragility)**
- Files: `backend/internal/domain/importexport/workspace_restore.go` (767 lines)
- Why fragile: Multiple incomplete implementations (4 TODO functions returning empty slices), no error propagation from mapping failures, circular dependency handling unclear (categories with parents)
- Safe modification: Add comprehensive tests for each import type separately before enabling; mock database calls to verify error handling
- Test coverage: Missing integration tests for actual CSV workflows; only seed/export has test coverage

**Pending Change Service (High Fragility)**
- Files: `backend/internal/domain/warehouse/pendingchange/service.go` (1014 lines)
- Why fragile: Complex approval pipeline with 11+ entity type handlers, JSON deserialization of arbitrary payloads, state transitions (pending→approved→applied)
- Safe modification: All handlers must deserialize to specific types before applying changes; cannot modify until approval middleware integration tested
- Test coverage: Handler integration tests exist but full workflow skipped (approval_pipeline_test.go:45)

**Import Worker (Medium Fragility)**
- Files: `backend/internal/worker/import_worker.go` (792 lines)
- Why fragile: Processes long-running CSV imports with partial failure handling; error tracking not row-level; job retry logic may lose context
- Safe modification: Extract CSV parsing into separate tested function; add circuit breaker for database failures; log job progress
- Test coverage: E2E tests for import queueing exist but error recovery not tested

**Rate Limiter (Low Fragility)**
- Files: `backend/internal/api/middleware/ratelimit.go`, `ratelimit_test.go`
- Why fragile: IP detection relies on X-Forwarded-For header (can be spoofed); in-memory storage (not shared across instances)
- Safe modification: Validate X-Forwarded-For for trusted proxies only; consider Redis-backed limiter for multi-instance deployments
- Test coverage: Unit tests exist for basic cases

---

## Scaling Limits

**In-Memory Rate Limiter Not Distributed (High Impact)**
- Current capacity: Single instance; 100 concurrent connections typical
- Limit: Breaks at multi-instance deployment (each instance has independent rate limit state)
- Scaling path: Replace in-memory RateLimiter (mutex+map) with Redis-backed counter; allows shared state across instances

**No Connection Pooling Configuration (Medium Impact)**
- Current capacity: DatabaseMaxConn=25, DatabaseMinConn=5 (hardcoded; may be insufficient)
- Limit: 25 concurrent database connections; high concurrency requests queue and timeout
- Scaling path: Make pool sizes configurable, add metrics for pool utilization, tune based on load tests

**Background Job Worker Single-Threaded (Low Impact)**
- Current capacity: One worker process handling import jobs sequentially
- Limit: Long CSV imports block other jobs; job queue grows under load
- Scaling path: Horizontal scaling (multiple worker instances) already supported via Redis; document worker scaling strategy

**No Load Shedding for List Endpoints (Medium Impact)**
- Current capacity: Unbounded queries can consume full server resources
- Limit: Large inventories (10k+ items) may timeout or exhaust memory
- Scaling path: Add mandatory pagination, cache aggregations, archive old data, implement read replicas for reporting

---

## Dependencies at Risk

**OpenFoodFacts & OpenProductsDB External Dependencies (Low Risk)**
- Risk: Barcode lookup depends on external APIs (food/product databases); no fallback if services down
- Impact: Barcode feature silently fails; returns "not found" gracefully
- Migration plan: Add optional caching layer; implement local fallback database; document SLA expectation

**Resend Email Service (Medium Risk)**
- Risk: Email sending depends on Resend SaaS; rate limits and uptime not under control
- Impact: Password resets, invitations, notifications fail if Resend down
- Migration plan: Implement email service abstraction (interface pattern exists); allow SMTP fallback; queue emails for retry

**SQLc Code Generation (Low Risk)**
- Risk: sqlc generates Go code from SQL; hand-edits lost on regeneration
- Impact: Custom SQL queries must stay in .sql files; DO NOT edit generated .go files
- Migration plan: Document sqlc workflow; add pre-commit hook to verify no .go edits

---

## Missing Critical Features

**No File Upload/Download for Attachments (High Impact)**
- Problem: Attachment domain scaffolded but actual S3/filesystem integration missing
- Blocks: Cannot store receipts, warranties, manuals, or photos; only metadata stored
- Current state: Handlers exist, database tables exist, no actual file storage backend
- Fix approach: Implement storage interface for S3/MinIO/local filesystem; integrate photo uploads first (already partially done)

**No Email Notifications (High Impact)**
- Problem: Loan reminder jobs framework exists but email sending not implemented
- Blocks: Users don't receive reminders; invitations require manual communication
- Current state: Job scheduling works; email templates and delivery missing
- Fix approach: Wire Resend API (key exists in config); implement email templates; test delivery

**No Metrics/Monitoring (Medium Impact)**
- Problem: No Prometheus metrics or structured logging
- Blocks: Cannot monitor request rates, error rates, query performance, resource usage
- Current state: Basic logging exists; no instrumentation
- Fix approach: Add Prometheus endpoint, implement metrics for handlers/services, structured JSON logging

**No Database Query Optimization (Medium Impact)**
- Problem: No slow query logging, query timeouts, or statement caching
- Blocks: Long-running queries cause cascading failures; no visibility into performance
- Current state: Queries execute but no monitoring
- Fix approach: Enable PostgreSQL log_min_duration_statement, add query timeout env var, implement explain analyze in tests

---

## Test Coverage Gaps

**Item Photo Integration Tests Disabled (Medium Risk)**
- What's not tested: Photo upload, download, thumbnail generation, photo ordering
- Files: `backend/tests/integration/item_photos_test.go:28`
- Risk: Photo feature regression undetected; users cannot verify uploads work
- Coverage target: Full lifecycle test (upload, fetch, delete) using NewTestServer pattern

**Approval Pipeline Complete Workflow Not Tested (Medium Risk)**
- What's not tested: Full member create→pending→admin approve→applied workflow via HTTP
- Files: `backend/tests/integration/approval_pipeline_test.go:45`
- Risk: Approval middleware may not intercept all request types; members may bypass approval
- Coverage target: Test all CRUD operations (create/update/delete) for member role; verify 202 Accepted responses

**Concurrent User Access (Low Risk)**
- What's not tested: Multiple users accessing same workspace simultaneously; workspace isolation under load
- Files: `backend/tests/integration/workflow_test.go:529` (mentioned but unclear if full coverage)
- Risk: Race conditions in shared resource access (inventory modifications by concurrent users)
- Coverage target: Concurrent item modifications, concurrent loan returns, verify isolation

**Import Error Recovery (Medium Risk)**
- What's not tested: Partial import failures, row-level error handling, retry mechanisms
- Files: `backend/internal/domain/importexport/` (no error scenario tests)
- Risk: Silent failures in CSV imports; incomplete data in database
- Coverage target: Test with malformed CSV, missing required fields, duplicate entries

**Rate Limiter Multi-Instance (Medium Risk)**
- What's not tested: Rate limit state consistency across multiple server instances
- Files: `backend/internal/api/middleware/ratelimit_test.go` (only single-instance tests)
- Risk: Rate limiting ineffective in load-balanced deployments
- Coverage target: Redis-backed limiter (after implementation)

---

## Architecture & Code Organization Issues

**Complex Pending Change Service (High Complexity)**
- File: `backend/internal/domain/warehouse/pendingchange/service.go` (1014 lines)
- Issue: Single service handles approval/rejection for all entity types; JSON deserialization of arbitrary payloads; 11+ EntityApplier implementations
- Symptom: Changes to one entity type approval logic requires modifying core service; hard to reason about complete flow
- Refactor approach: Split EntityApplier implementations into separate files; create entity-specific approval handlers; consolidate common approval logic

**Workspace Restore Design Flaw (Design Issue)**
- File: `backend/internal/domain/importexport/workspace_restore.go` (767 lines)
- Issue: Import functions return empty error arrays on incomplete implementations; no row tracking; mapping state hard to maintain across function calls
- Symptom: Users think import succeeded when critical pieces unimplemented (inventory, loans, attachments)
- Design fix: Return error early if unsupported entity type; implement complete import in single pass; track all mappings in context struct

**AI Code Smell: Inconsistent Patterns (Medium)**
- Issue: Codebase is AI-generated; pattern inconsistency likely (multiple error handling styles, nil checks, response formats)
- Files: See docs/CODEBASE-HEALTH.md for detection methods
- Impact: Hard to maintain; harder to onboard new developers; cognitive load higher
- Remedy: Run regular linting; enforce consistent error handling; periodic refactoring sweeps

---

## Summary: Priority Fixes

| Priority | Area | Impact | Effort |
|----------|------|--------|--------|
| CRITICAL | Approval middleware integration | Members bypass approval | High |
| HIGH | Email service wiring | Users don't get notified | Medium |
| HIGH | Workspace import completion | Data loss on restore | High |
| HIGH | File attachment storage | Cannot store documents | Medium |
| MEDIUM | Row-level error tracking | Users can't debug imports | Low |
| MEDIUM | Activity logging completion | Audit trail incomplete | Medium |
| MEDIUM | Inventory audit trail | Who made changes? | Low |
| MEDIUM | Query pagination limits | Unbounded queries possible | Medium |
| LOW | Photo thumbnail WebP support | Modern format missing | Low |
| LOW | Redis caching layer | Performance optimization | Medium |

---

*Concerns analysis: 2026-01-22*
