# External Integrations

**Analysis Date:** 2026-01-22

## APIs & External Services

**Email Delivery:**
- Resend - Transactional email service (optional, configured via `RESEND_API_KEY`)
  - SDK/Client: Built-in via configuration
  - Auth: Environment variable `RESEND_API_KEY`
  - Fields in config: `ResendAPIKey`, `EmailFromAddress`, `EmailFromName`

**OAuth Authentication:**
- Google OAuth 2.0 - Third-party user authentication
  - SDK/Client: Configured in `backend/internal/config/config.go`
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

- GitHub OAuth 2.0 - Third-party user authentication
  - SDK/Client: Configured in `backend/internal/config/config.go`
  - Auth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

**Document Management (Optional):**
- Docspell REST API - Document scanning and classification
  - URL: `http://docspell-restserver:7880` (local network)
  - Purpose: Optional document attachment processing and OCR
  - Storage: Separate PostgreSQL database (docspell-postgres) and volume mount
  - Components: REST server (`docspell/restserver`) + Job executor (`docspell/joex`)
  - Status: Available in docker-compose but not integrated in core codebase (references in tests only)

## Data Storage

**Databases:**
- PostgreSQL 18
  - Primary: `warehouse_dev` database (host: `localhost:5432` in dev)
  - User: `wh`
  - Password: `wh`
  - Connection: `GO_DATABASE_URL` environment variable
  - Client: `jackc/pgx/v5` driver with connection pooling
  - ORM: sqlc (type-safe SQL code generation)
  - Schemas: `auth` (users, workspaces, roles), `warehouse` (inventory data)
  - Migrations: dbmate-managed SQL files in `backend/db/migrations/`

**Test Database:**
- PostgreSQL (separate test instance)
  - Database: `warehouse_test`
  - Connection: `GO_TEST_DATABASE_URL`
  - Purpose: Integration test isolation

**Redis (Cache & Queues):**
- Redis (latest)
  - Host: `localhost:6379` in dev
  - Connection: `REDIS_URL` environment variable
  - Client: `redis/go-redis/v9`
  - Purpose: Task queue, caching, real-time features
  - Queue prefix: `queue:` (e.g., `queue:imports` for import jobs)
  - Job storage prefix: `job:` (e.g., `job:imports:job-id`)

**File Storage:**
- Local filesystem only
  - Image storage: `.data/` directory (mounted volumes in Docker)
  - Photos: Processed and cached locally
  - Uploads: Server-side file storage
  - No S3 or cloud storage integration currently

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication with OAuth support
  - Implementation: `backend/internal/domain/auth/` directory
  - JWT handling: `golang-jwt/jwt/v5` library
  - Token signing: `JWT_SECRET` environment variable
  - Algorithm: HS256 (configurable via `JWT_ALGORITHM`)
  - Expiration: 24 hours (configurable via `JWT_EXPIRATION_HOURS`)
  - OAuth flows: Google and GitHub configured in `backend/internal/config/config.go`

**User Management:**
- Handler: `backend/internal/domain/auth/user/handler.go`
- Service: `backend/internal/domain/auth/user/service.go`
- Repository: `backend/internal/infra/postgres/user_repository.go`

**Workspace/Tenant Management:**
- Handler: `backend/internal/domain/auth/workspace/handler.go`
- Service: `backend/internal/domain/auth/workspace/service.go`
- Repository: `backend/internal/infra/postgres/workspace_repository.go`
- Multi-tenant via `workspace_id` foreign key in all warehouse schema tables

**Role-Based Access Control:**
- Roles: owner, admin, member, viewer
- Middleware: `backend/internal/api/middleware/auth.go`
- Approval pipeline: `backend/internal/domain/warehouse/pendingchange/` - member changes require admin approval

## Monitoring & Observability

**Error Tracking:**
- Not detected - no external error tracking service integrated

**Logs:**
- Standard output logging via Go `log` package
- Worker health check: `backend/cmd/worker/main.go` exposes `/health` on port 8081
- API health endpoint: `backend/internal/api/health/` for database connectivity checks

## CI/CD & Deployment

**Hosting:**
- Docker & Docker Compose (local development)
- No cloud platform integration detected (no AWS, GCP, Heroku config)

**CI Pipeline:**
- Not detected - no GitHub Actions, GitLab CI, or other CI/CD service integrated

**Background Worker:**
- Dedicated Go worker process: `backend/cmd/worker/main.go`
- Entry point: `main()` in worker/main.go
- Components:
  - Database: pgxpool for connections
  - Redis: go-redis client for job queue
  - Queue: `backend/internal/infra/queue/redis_queue.go` (custom Redis-backed queue)
  - Import job processing: `backend/internal/worker/` directory
  - Health server: Runs on port 8081 for monitoring

## Environment Configuration

**Required env vars for production:**
- `GO_DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Must be changed from default (validation in `backend/internal/config/config.go`)

**Optional integrations:**
- `RESEND_API_KEY` - For transactional email
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - For Google OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - For GitHub OAuth
- `NEXT_PUBLIC_API_URL` - Frontend API URL

**Secrets location:**
- Environment variables (recommended for production)
- `.env` file for local development (not committed)
- `.env.local` for frontend

## Real-Time Features

**Push Notifications (Web Push Protocol):**
- Library: `SherClockHolmes/webpush-go`
- Sender: `backend/internal/infra/webpush/sender.go`
- Implementation:
  - VAPID keys required: `vapidPublicKey`, `vapidPrivateKey`
  - Storage: User push subscriptions in PostgreSQL
  - Repository: `backend/internal/infra/postgres/pushsubscription_repository.go`
  - Used for: Approval notifications, status updates
  - Enablement check: `sender.IsEnabled()` method checks if VAPID keys are configured

**Event Broadcasting:**
- Event system: `backend/internal/infra/events/broadcaster.go`
- Purpose: Real-time event distribution within application
- Used by: Approval pipeline, import jobs for status updates

**Server-Sent Events (SSE):**
- Handler: `backend/internal/domain/events/handler.go`
- Purpose: Real-time browser notifications
- Used for: Approval decision notifications, job status updates

## Job Queue

**Background Job Processing:**
- Queue implementation: `backend/internal/infra/queue/redis_queue.go`
- Backing store: Redis
- Job types: `imports` (CSV import jobs)
- Max retries: 3 per job
- TTL: 24 hours per job
- Worker startup: `backend/cmd/worker/main.go`
- Import job repository: `backend/internal/infra/postgres/import_job_repository.go`

## Image Processing

**Server-side:**
- Image library: `disintegration/imaging` (pure Go image manipulation)
- WebP encoding: `kolesa-team/go-webp`
- Standard library: `golang.org/x/image`
- Processor: `backend/internal/infra/imageprocessor/processor.go`
- Functionality: Photo upload, thumbnail generation, format conversion

**Frontend:**
- sharp (trusted dependency) - Image optimization
- Built-in Image component for optimization

## Data Import/Export

**CSV Import:**
- Format parser: `xuri/excelize/v2` (backend Go), `papaparse` (frontend)
- Job tracking: `backend/internal/domain/warehouse/importjob/`
- Error logging: `import_errors` table for per-row failures
- Batch processing: `backend/internal/domain/batch/service.go`
- Import types: items, inventory, locations, containers, categories, borrowers

**Workspace Backup/Restore:**
- Handlers: `backend/internal/domain/importexport/`
- Functionality: Full workspace export and restoration

## Frontend Services

**API Communication:**
- Base URL: `NEXT_PUBLIC_API_URL` (default: `http://localhost:8080`)
- Proxy configuration: `frontend/proxy.ts` for development API routing
- Request handling: Built-in fetch API (no external HTTP client library)

**Service Worker & PWA:**
- Framework: Serwist 9.5.0
- Config: `frontend/app/sw.ts`
- Next.js integration: `@serwist/next`
- Features: Offline support, cache on navigation, reload on online
- Build config: `frontend/next.config.ts` disables in development

**Internationalization:**
- Framework: next-intl 4.7.0
- Config: `frontend/i18n/request.ts`
- Purpose: Multi-language support

---

*Integration audit: 2026-01-22*
