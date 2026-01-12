# Go Backend - Unimplemented Features

This document tracks features and improvements that are not yet implemented in the Go backend.

**Last Updated**: 2026-01-12

## Overview

The Go backend is largely complete with 173+ files, 32 test files, and coverage of all core domains. The following items remain unimplemented or incomplete.

---

## High Priority

### Email Service Integration
- **Status**: Not implemented
- **Description**: Job framework for loan reminders exists and is tested, but actual email sending is not wired up
- **Required**: SMTP configuration or email service provider integration (SendGrid, SES, etc.)
- **Files**: `go-backend/internal/jobs/loan_reminder.go`

### File Storage Integration
- **Status**: Not implemented
- **Description**: Attachment domain is scaffolded but actual file upload/download infrastructure is missing
- **Required**: S3, MinIO, or local filesystem integration
- **Files**: `go-backend/internal/domain/warehouse/attachment/`

### Full Integration Tests
- **Status**: Partial
- **Description**: Only basic auth/workspace integration tests exist
- **Missing**:
  - Item creation workflows
  - Inventory tracking workflows
  - Loan lifecycle workflows (create → return)
  - Cross-domain workflows
- **Files**: `go-backend/internal/api/integration_test.go`

---

## Medium Priority

### Delta Sync Completion
- **Status**: Partial
- **Description**: Sync handlers exist but `ListModifiedSince` methods may not be fully implemented in all repositories
- **Required**: Verify and implement missing repository methods for PWA offline sync
- **Files**: `go-backend/internal/domain/warehouse/sync/`

### Caching Layer
- **Status**: Not implemented
- **Description**: Redis is available (used for background jobs) but no query caching is implemented
- **Required**: Add Redis caching for frequently accessed data (categories, locations, user preferences)

### Full-text Search Optimization
- **Status**: Basic implementation only
- **Description**: Search works but indexes need tuning for performance
- **Required**:
  - Analyze query patterns
  - Add appropriate indexes
  - Consider Elasticsearch for advanced search features

### Barcode/QR Image Generation
- **Status**: Partial
- **Description**: Code generation and lookup works, but image rendering is not wired
- **Required**: Image generation library integration for printable QR codes

---

## Low Priority

### Metrics and Monitoring
- **Status**: Not implemented
- **Description**: No Prometheus metrics or structured logging
- **Required**:
  - Prometheus metrics endpoint
  - Structured JSON logging
  - Request duration histograms
  - Error rate tracking

### Health Check Improvements
- **Status**: Basic only
- **Description**: Basic `/health` endpoint exists
- **Required**:
  - Kubernetes readiness probe (`/ready`)
  - Kubernetes liveness probe (`/live`)
  - Database connectivity check
  - Redis connectivity check

### Query Performance Tuning
- **Status**: Not implemented
- **Description**: No pagination limits or query optimization
- **Required**:
  - Maximum page size limits
  - Query timeout configuration
  - Slow query logging
  - Bulk operation optimization

### Analytics Enhancement
- **Status**: Basic implementation
- **Description**: Analytics service exists but may lack comprehensive queries
- **Required**: Dashboard-ready aggregation queries and reports

---

## Documentation

### Operational Runbooks
- **Status**: Not created
- **Description**: No documentation for production operations
- **Required**:
  - Deployment procedures
  - Rollback procedures
  - Incident response
  - Database maintenance

### Enhanced API Documentation
- **Status**: Auto-generated only
- **Description**: OpenAPI spec is auto-generated via Huma
- **Required**: Endpoint-specific documentation with examples and use cases

---

## Completed Phases Reference

For context on what has been implemented, see:
- `docs/GO_BACKEND_IMPLEMENTATION_PLAN.md`
- `docs/go-implementation/phase-*.md` (phases 0-9)
- `docs/PHASE_8_TESTING_SUMMARY.md`
- `docs/PHASE_9_ADVANCED_PATTERNS_PROGRESS.md`
