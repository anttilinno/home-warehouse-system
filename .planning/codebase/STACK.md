# Technology Stack

**Analysis Date:** 2026-01-22

## Languages

**Primary:**
- Go 1.25 - Backend API server and worker processes
- TypeScript 5 - Frontend application code and type safety
- JavaScript - Build configuration and utilities

**Secondary:**
- SQL - Database queries (sqlc-generated type-safe SQL)
- CSS/Tailwind - Styling (Tailwind CSS 4)

## Runtime

**Environment:**
- Go 1.25 (defined in `.mise.toml`)
- Node.js/Bun (latest, via Bun package manager)

**Package Manager:**
- bun (latest) - JavaScript/TypeScript package management
- go mod - Go dependency management
- dbmate - Database migration tool

**Lockfile:**
- package-lock.json (present)
- go.mod/go.sum (present)

## Frameworks

**Core Backend:**
- Chi v5.2.3 - HTTP router and middleware
- Huma v2.34.1 - REST API framework with OpenAPI documentation (via `adapters/humachi`)

**Frontend:**
- Next.js 16.1.1 - React framework with SSR/SSG
- React 19.2.3 - UI library
- React Hook Form 7.70.0 - Form state management
- Zod 4.3.5 - Runtime schema validation and type-safe forms

**UI Components:**
- shadcn/ui (via Radix UI components) - Accessible component primitives:
  - @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-select, @radix-ui/react-tooltip, etc.
- Lucide React 0.562.0 - Icon library

**Database:**
- sqlc (code generation) - Type-safe SQL generation from SQL files
- pgx/v5 (jackc/pgx) - PostgreSQL driver
- dbmate - Schema migration and version control

**Testing:**
- Go: testify/assert v1.11.1
- Playwright v1.57.0 - End-to-end testing framework
- @playwright/test - Playwright test runner

**Build/Dev:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss - PostCSS plugin for Tailwind
- Esbuild (via Next.js) - JavaScript bundler and minifier
- air (Go) - Hot reload for development
- golangci-lint - Go linter

**Background Jobs:**
- asynq v0.25.1 - Task queue system for Redis-backed job processing

**Internationalization:**
- next-intl 4.7.0 - Translation and i18n support

**PWA & Service Worker:**
- Serwist 9.5.0 - Service Worker library
- @serwist/next - Next.js integration for Serwist

**Image Processing:**
- disintegration/imaging v1.6.2 - Pure Go image library
- kolesa-team/go-webp - WebP image encoding
- golang.org/x/image - Standard library image utilities
- sharp (trusted dependency for image optimization)

**Data Handling:**
- xuri/excelize/v2 - Excel file reading/writing for CSV imports
- papaparse 5.5.3 - CSV parsing in frontend

**Push Notifications:**
- SherClockHolmes/webpush-go v1.3.0 - Web Push Protocol implementation

**Utilities:**
- google/uuid v1.6.0 - UUID v7 generation
- golang-jwt/jwt/v5 v5.3.0 - JWT token handling
- robfig/cron/v3 - Cron job scheduling
- redis/go-redis/v9 v9.7.3 - Redis client
- go-deepcopy - Deep copy utility
- class-variance-authority - CSS variant composition
- clsx - Conditional className utility
- tailwind-merge - Resolve Tailwind CSS conflicts
- date-fns 4.1.0 - Date manipulation library
- recharts 3.6.0 - React charting library
- sonner 2.0.7 - Toast notifications
- next-themes 0.4.6 - Theme management
- next-nprogress-bar 2.4.7 - Progress bar
- @hookform/resolvers 5.2.2 - Form validation resolvers
- @tanstack/react-virtual 3.13.18 - Virtual scrolling
- @dnd-kit (core, sortable, utilities) - Drag and drop
- cmdk 1.1.1 - Command menu component

**Crypto:**
- golang.org/x/crypto v0.46.0 - Password hashing and encryption

## Configuration

**Environment Variables:**

Backend (`.mise.toml` defaults):
- `GO_DATABASE_URL` - PostgreSQL connection (default: `postgresql://wh:wh@localhost:5432/warehouse_dev`)
- `GO_TEST_DATABASE_URL` - Test database (default: `postgresql://wh:wh@localhost:5432/warehouse_test`)
- `DBMATE_DATABASE_URL` - Migration database (default: `postgresql://wh:wh@localhost:5432/warehouse_dev`)
- `REDIS_URL` - Redis connection (default: `redis://localhost:6379/0`)
- `JWT_SECRET` - Token signing key (default: `change-me-in-production`)
- `JWT_ALGORITHM` - Token algorithm (default: `HS256`)
- `JWT_EXPIRATION_HOURS` - Token lifetime (default: `24`)
- `RESEND_API_KEY` - Email service API key (optional)
- `EMAIL_FROM_ADDRESS` - Sender email (default: `noreply@example.com`)
- `EMAIL_FROM_NAME` - Sender name (default: `Home Warehouse`)
- `GOOGLE_CLIENT_ID` - OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET` - OAuth client secret (optional)
- `GITHUB_CLIENT_ID` - OAuth client ID (optional)
- `GITHUB_CLIENT_SECRET` - OAuth client secret (optional)
- `APP_URL` - Frontend URL (default: `http://localhost:3000`)
- `BACKEND_URL` - Backend URL (default: `http://localhost:8080`)
- `DEBUG` - Debug mode flag (default: `false`)
- `PORT` - Server port (default: `8080`)
- `SERVER_HOST` - Bind address (default: `0.0.0.0`)

Frontend (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: `http://localhost:8080`)

**Build Configuration:**
- `backend/.air.toml` - Hot reload configuration for development
- `frontend/next.config.ts` - Next.js configuration with Serwist PWA and next-intl plugins
- `frontend/tsconfig.json` - TypeScript configuration
- `frontend/tailwind.config.js` - Tailwind CSS theming

## Platform Requirements

**Development:**
- Go 1.25
- Node.js/Bun (latest)
- PostgreSQL 18 (via Docker)
- Redis (via Docker)
- Docker & Docker Compose
- mise for tool management

**Production:**
- PostgreSQL 18+ for data persistence
- Redis for queue and caching
- Docspell (optional) - Document management system with separate PostgreSQL (services defined in docker-compose)
- Go runtime for backend API
- Node.js or static asset serving for frontend

**Containerization:**
- Docker images referenced in `docker-compose.yml`:
  - `postgres:18` - Main data warehouse
  - `redis:latest` - Task queue and caching
  - `docspell/restserver:latest` - Document management API
  - `docspell/joex:latest` - Document processing jobs

---

*Stack analysis: 2026-01-22*
