# Roadmap

## Pre-Production Checklist

- [ ] Remove dev-only login defaults (seeder@test.local) from `frontend/features/auth/components/login-form.tsx`

## Phase 1

- [x] Workspaces for multi-user usage
- [x] Export/backup of data
  - Excel (.xlsx) with one sheet per entity, foreign keys resolved to names
  - JSON for migration/re-import
  - Endpoint: `GET /exports/workspace?format=xlsx|json`
  - Tracks exports in `auth.workspace_exports` for audit
- [~] Integration with Docspell (document management) — **SUPERSEDED by Paperless-ngx, see "DMS Migration" below**
  - Only the data model shipped: `warehouse.attachments.docspell_item_id` column + `auth.workspace_docspell_settings` table (generated model, no consuming service)
  - No client built: no REST calls, no fulltext search, no tag sync, no UI — the compose Docspell trio was never wired to the app
  - Homelab now runs Paperless-ngx (k3s), not Docspell → switching the integration target
- [x] Quick access features
  - Favorites: pin frequently accessed items/locations
  - Recently modified: quick view of recent changes
  - Location breadcrumbs: display "Garage → Shelf A → Box 3"
- [x] Bulk operations
  - CSV/Excel import for bulk adding items
  - Barcode lookup: scan product barcode → fetch info from Open Food Facts / UPC database
  - Item duplicate: "Add another like this"
- [x] SSO authentication
  - Google and GitHub OAuth providers (via litestar-oauth)
  - Link/unlink external accounts to existing users
- [x] Email notifications (Resend)
  - Password reset (multi-language: EN, ET, RU)
  - Loan reminders
  - Multi-language email templates
- [x] Obsidian integration
  - Link items to Obsidian notes (detailed descriptions, usage guides, project logs)
  - Store Obsidian vault path + note path in item metadata
  - Deep link to open note directly in Obsidian
- [x] User language preference
  - Language stored in database (profile page)
  - Emails sent in user's preferred language
  - Auto-redirect to user's language on login
- [x] Theme settings
  - Move from settings to profile page
  - Save theme preference to database
  - Retro theme needs redesign (awaiting brainstorming in Stitch)

## Phase 2

- [x] Real-time sync with SSE
  - [x] Backend broadcaster service (100% test coverage)
  - [x] SSE HTTP streaming endpoint (81% test coverage)
  - [x] Event publishing in all 11 CRUD handlers
  - [x] Frontend SSE integration in all 10 dashboard pages
  - [x] Multi-user workspace-scoped broadcasting
  - [ ] Complete test coverage for event publishing (currently 2/11 handlers tested)
    - Add MockBroadcaster tests to remaining 9 handlers
    - Verify created/updated/deleted events for: borrower, inventory, location, container, category, label, company, favorite, attachment
    - Estimated effort: 4-6 hours
- [x] Tracking & alerts (partial)
  - [x] Total value: sum of purchase_price per location/workspace
  - [x] Activity log: who changed what, when. So there is no need for soft delete
  - [x] Consumables list: items needing restocking (quantity = 0)
  - [x] Low stock alerts: notify when quantity < threshold
  - [x] Expiration alerts: items expiring soon (expiration_date field)
  - [x] Warranty expiring: reminder before warranty ends (warranty_expires field)
  - [x] Overdue loans: loans past due_date
- [x] Approval pipeline for member role
  - [x] Members' create/update/delete operations require owner/admin approval
  - [x] Pending changes table: entity type, action, JSON payload, requester, status
  - [x] Review queue UI for owner/admin to approve/reject
  - [x] Notifications when changes need review
  - [x] Members see "Pending approval" status instead of immediate success
  - [x] Backend middleware for role-based interception
  - [x] Domain service for approval operations (create, list, approve, reject)
  - [x] PostgreSQL repository with transaction support
  - [x] Frontend integration with usePendingChangeHandler hook
  - [x] Real-time SSE notifications for approvals/rejections
  - [x] "My Changes" page for members to track their submissions
  - [x] "Approvals" page for admins with pending count badge
  - [x] Comprehensive documentation (APPROVAL_PIPELINE.md)
  - [x] Integration tests covering all workflows
- [ ] TUI client (Go + Bubble Tea)
  - Terminal-based interface for quick inventory operations
  - Browse locations, containers, items
  - Add/move inventory without browser
- [x] Repair log
  - Track repair history per item
  - Log repair date, cost, description, who performed it
  - Total cost of ownership view
- [x] Declutter assistant
  - Surface items not accessed/moved in 12+ months
  - Suggest donate, sell, or dispose
  - Track declutter decisions and outcomes
- [x] Progressive Web App (PWA)
  - [x] Installable on iOS/Android without app store
  - [x] Offline support with service worker caching
  - [x] QR code scanning (camera API)
  - [x] Barcode scanning for item lookup
  - [x] Push notifications support
    - Backend: webpush.Sender, push subscription domain, VAPID config
    - Frontend: usePushNotifications hook, service worker handlers
    - Notifications for: approval workflow (approve/reject), loan reminders
    - Settings UI for enabling/disabling push notifications
    - Requires: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBSCRIBER env vars
  - [ ] Background sync for offline changes
  - [ ] Add PWA manifest screenshots
    - Create `frontend/public/screenshots/` directory
    - Capture `mobile-dashboard.png` (1080x1920) - mobile dashboard view
    - Capture `desktop-inventory.png` (1920x1080) - desktop inventory page
    - Screenshots are shown during PWA install prompt on supported browsers
    - Can use browser DevTools device emulation for consistent captures
- [x] Item photos
  - [x] Upload photos for items (drag-and-drop, multi-file)
  - [x] Multiple photos per item with ordering
  - [x] Automatic thumbnail generation (small: 150px, medium: 400px, large: 800px)
  - [x] Primary photo designation
  - [x] Photo captions and editing
  - [x] Photo viewer/lightbox with zoom and navigation
  - [x] Client-side compression before upload (>2MB auto-compressed)
  - [x] PWA caching for offline photo viewing and upload queuing
  - [x] Lazy loading with blur-up technique and intersection observer
  - [x] Integration tests, service tests, and documentation
  - [x] WebP format support (upload, decode, and thumbnail generation)
  - [x] Admin cleanup tools (orphaned files, regenerate thumbnails, storage reports)
  - [ ] Background thumbnail processing worker
  - [ ] Bulk photo operations (delete, caption edit)
- [x] Background import processing (Redis Queue + SSE)
  - [x] Backend infrastructure (Redis queue, worker process, CSV parser)
  - [x] Database schema (import_jobs, import_errors tables)
  - [x] SSE streaming endpoint (`GET /imports/jobs/{job_id}/stream`)
  - [x] Frontend UI (list, detail with real-time progress, upload)
  - [x] Worker systemd service configuration
  - [x] Integration tests
  - [x] Documentation (user guide, deployment guide)
  - [ ] Manual testing checklist
    - [ ] Upload valid CSV (10 rows) → verify all rows imported successfully
    - [ ] Upload CSV with validation errors → verify errors recorded with row details
    - [ ] Monitor progress via SSE → verify real-time updates display correctly
    - [ ] Upload large CSV (1000+ rows) → verify progress percentage accuracy
    - [ ] Test concurrent imports → verify both complete successfully
    - [ ] Restart worker mid-import → verify job resumes from checkpoint
    - [ ] Navigate away from detail page → verify SSE disconnects properly
    - [ ] Test invalid file format → verify error message shown
    - [ ] Test file size limit → verify 10MB limit enforced
    - [ ] Verify error list displays row number, field, and data correctly
- [x] Database seeder CLI
  - Generate test data for development
  - Seed types: expiring items, warranty alerts, low-stock, overdue loans, location hierarchy
  - Command: `mise run seed <type|all>`
- [x] Job scheduler (asynq + Redis)
  - Loan reminder notifications (daily at 9 AM) — email + push to workspace admins
  - Deleted records cleanup (weekly Sunday 3 AM)
  - Activity logs cleanup (weekly Sunday 4 AM)
  - Separate worker process: `mise run scheduler`
  - Health check endpoint on :8082

## Phase 3: UX & Accessibility

**See [UX_IMPROVEMENTS.md](UX_IMPROVEMENTS.md) for detailed analysis and implementation guide**

### Critical Priority
- [ ] **WCAG 2.1 AA Compliance** (Sprint 1: 1-2 weeks)
  - Accessibility audit with Lighthouse and axe DevTools
  - Fix keyboard navigation throughout application
  - Add comprehensive ARIA labels and landmarks
  - Implement focus management in modals and dialogs
  - Add skip-to-content link
  - Verify and fix color contrast ratios
- [ ] **Consistent Error Handling & Offline Support** (Sprint 2: 1-2 weeks)
  - Implement error boundaries for React errors
  - Add offline detection and offline banner
  - Retry mechanisms for failed API requests
  - Better error messages with actionable guidance
  - Consistent error states across all forms and lists

### High Priority
- [ ] **Loading State Standardization** (Sprint 3: 1-2 weeks)
  - Create comprehensive skeleton component library
  - Standardize loading button patterns
  - Implement optimistic updates for better UX
  - Add progress indicators for long operations
- [ ] **Mobile UX Optimization** (Sprint 3: 1-2 weeks)
  - Touch target audit (44x44px minimum)
  - Mobile navigation improvements with swipe gestures
  - Bottom sheets for mobile actions/filters
  - Mobile-optimized table alternative (card view)
- [ ] **Advanced Search & Filtering** (Sprint 4: 2-3 weeks)
  - Global command palette search (Ctrl+K)
  - Advanced filter builder with date ranges
  - Filter persistence in URL
  - Fuzzy search with suggestions
  - Search history and keyboard navigation

### Medium Priority
- [ ] **Data Visualization & Analytics** (Sprint 5: 2-3 weeks)
  - Integrate chart library (Recharts or Tremor)
  - Add charts to dashboard (value trends, category breakdown)
  - Create dedicated analytics page with drill-down
  - Export capabilities for charts and reports
- [ ] **Onboarding & Help System** (Sprint 6: 1-2 weeks)
  - Welcome screen for first-time users
  - Guided product tour with React Joyride
  - Help center with documentation and keyboard shortcuts
  - Contextual help tooltips
  - Enhanced empty states with clear actions

### Low Priority (Polish)
- [ ] **Animations & Micro-interactions** (Sprint 7: 1 week)
  - Page transitions with Framer Motion
  - Staggered list animations
  - Hover states and button lift effects
  - Success/error animations
- [ ] **Haptic Feedback for PWA** (Sprint 7)
  - Vibration on successful actions
  - Error vibration patterns
  - Barcode scan feedback

### Infrastructure
- [ ] **Kubernetes deployment configuration**
  - Create k8s manifests for main backend service (API server :8080)
  - Create k8s manifests for import worker (:8081)
  - Create k8s manifests for job scheduler (:8082)
  - ConfigMaps for environment variables
  - Secrets for sensitive data (JWT, VAPID keys, database credentials)
  - Deployment, Service, and Ingress resources
  - HPA (Horizontal Pod Autoscaler) for API server
  - PersistentVolumeClaim for upload storage
  - Health check endpoints integration (all three services)

## DMS Migration: Docspell → Paperless-ngx

Replace the (stub-only) Docspell integration with Paperless-ngx, the DMS actually
running in the homelab (k3s, CNPG-backed, behind Authelia). Docspell was never
wired to the app — only schema shipped — so this is a clean repoint, not a removal
of working code. Rationale: avoid running two DMSes; Paperless is lighter, actively
maintained, and has a simpler REST API (token auth, `/api/documents/`).

- [ ] **Schema migration** — rename the external-doc link
  - `warehouse.attachments.docspell_item_id` → `paperless_document_id` (or generic `external_doc_id` + `dms_type` if multi-DMS wanted later)
  - Update partial index `ix_attachments_docspell` accordingly
  - Keep the "either `file_id` or external doc id" constraint
- [ ] **Settings table reshape** — `auth.workspace_docspell_settings` → `auth.workspace_paperless_settings`
  - Paperless uses `base_url` + **API token** (no `collective_name` concept) — drop collective, store encrypted token (Fernet, same as before)
  - Keep `sync_tags_enabled`, `is_enabled`, per-workspace scoping
- [ ] **Paperless API client** (build fresh — none existed for Docspell either)
  - Read-only first: attach-by-id (resolve `paperless_document_id` → title/preview/download URL)
  - Then: fulltext search proxy from warehouse UI (`GET /api/documents/?query=`)
  - Then: tag sync (warehouse labels ↔ Paperless tags)
- [ ] **Decide ingest direction before building write path**
  - Paperless ingests via `consume/` folder + OCR; warehouse holds receipts/manuals
  - Option A: warehouse pushes receipt → Paperless, stores returned `document_id`
  - Option B: manual — paste an existing Paperless doc id into an attachment
- [ ] **Remove Docspell trio from `docker-compose.yml`** (restserver, joex, docspell-postgres) once the client lands
- [ ] **UI**: rename "Docspell" settings/labels → "Paperless"; point deep links at `paperless.k3s.lan`

## Expiry & Warranty Alerting

The data is already captured but nothing consumes it: `inventory.warranty_expires`
and `inventory.expiration_date` (DATE) are read/written by the inventory CRUD,
items carry `lifetime_warranty`/`warranty_details` — yet the reminder jobs cover
only loans and repairs. Food/medicine/batteries expire and warranties lapse
silently. Cheapest high-value win in the backlog: one more asynq job reusing the
existing reminder + notification + web-push infrastructure.

- [x] **Queries** — `ListInventoryExpiringSoon` / `ListWarrantiesExpiringSoon`
  (windows: 30/7/1 days; skip `lifetime_warranty = true`; workspace-scoped)
- [x] **Asynq job** — `expiry_reminders.go` following `internal/jobs/loan_reminders.go`
  pattern (scheduler entry, MaxRetry/Timeout, per-workspace iteration)
- [x] **Dedupe** — one notification per inventory row per window (job-state row or
  notification-exists check), same approach loan reminders use
- [x] **Notifications** — in-app + web push via existing senders; add
  `expiry_alerts` toggle to `users.notification_preferences` jsonb + settings UI
- [x] **Frontend** — "Expiring soon" dashboard widget + inventory filter
  (`expiring_within=30d`), badge on item detail; i18n keys (en/et/ru)
- [x] **Tests** — job unit tests with table-driven windows; integration test for the
  expiring-soon queries

## Recurring Maintenance Schedules

Repair logs are reactive only — nothing models "HVAC filter every 3 months,
smoke-detector batteries yearly". Add schedules that feed the existing reminder
pipeline and write back into repair logs when completed.

- [x] **Schema** (new migration) — `warehouse.maintenance_schedules`:
  `id uuidv7 PK`, `workspace_id`, `inventory_id` (composite FK per the 005 tenancy
  pattern), `title`, `notes`, `interval_days int CHECK (> 0)`, `next_due date`,
  `last_completed_at`, `is_active bool`; index `(workspace_id, next_due)`
- [x] **Domain** — `internal/domain/warehouse/maintenance` (entity/service/handler/repo,
  standard layout); CRUD endpoints on the workspace tree; approval-pipeline entity
  registration if mutating via members
- [x] **Complete action** — `POST .../maintenance/{id}/complete`: creates a
  `repair_logs` row (type maintenance), sets `last_completed_at`, advances
  `next_due += interval_days` — in one transaction (TxManager pattern from loans)
- [x] **Asynq job** — due/overdue reminders; share the dedupe + notification approach
  with expiry alerting above
- [x] **Frontend** — schedule list on item detail, "Due maintenance" dashboard
  widget, complete-with-note dialog; i18n keys
- [x] **Tests** — next_due advancement (incl. overdue catch-up semantics — decide:
  from due date or from completion date), tx rollback test

## Shortlink Registry (s.go hardening)

The resolver itself already shipped: `GET /r/{code}` (router.go:350) validates the
cookie, scans the user's workspaces, 302s to the entity page, falls back to the
claim wizard (`/dashboard/claim/{code}`) on miss/multi-match. Remaining work is the
storage model: codes live as `short_code` columns on three tables with per-workspace
uniqueness only, so resolution scans 3 tables × N workspaces and the same code can
exist in several workspaces (that's why the multi-match path exists at all).
A global registry makes resolve one PK lookup and collisions impossible
(audit `docs/audit/DATABASE-SCHEMA.md` § B5).

- [x] **Migration** — `warehouse.short_codes` registry:
  `code text PK CHECK (code ~ '^[A-Za-z0-9]{4,12}$')`, `workspace_id`,
  `entity_type`, `entity_id`, `UNIQUE (workspace_id, entity_type, entity_id)`;
  backfill from items/locations/containers `short_code` columns — **collision
  policy**: on duplicate code across workspaces, oldest row keeps it, newer rows
  get regenerated codes (log + `needs_review` flag where applicable)
- [x] **Write path** — entity create/update maintains the registry row (same tx);
  code generation checks the registry, not the per-table index
- [x] **Resolver** — point `shortlink.Resolver` at the registry (one lookup +
  membership check); multi-match branch becomes dead → remove after backfill
  verified
- [x] **Deprecate per-table columns** — keep `short_code` columns as denormalized
  display values initially; drop the 3 per-table unique constraints + global
  `ix_*_short_code` indexes once the registry is authoritative
- [x] **Tests** — backfill collision test, registry uniqueness, resolver redirect
  matrix (hit / miss→claim / foreign-workspace→claim)

## Wishlist / Purchase Planning

Favorites cover items you own; nothing models items you intend to acquire.
Lightweight new entity that converts into a real item on purchase (the item create
wizard already supports prefill via query params — quick task 260607-vdf).

- [x] **Schema** (new migration) — `warehouse.wishlist_items`:
  `id uuidv7 PK`, `workspace_id`, `name`, `notes`, `url`, `price_estimate int`
  (cents, `CHECK >= 0`), `currency_code CHECK ('^[A-Z]{3}$')`, `priority smallint`,
  `desired_category_id` (composite FK, SET NULL), `status CHECK (IN
  ('wanted','ordered','acquired'))`, `created_by → users SET NULL`, timestamps;
  index `(workspace_id, status, priority)` (migration 004)
- [x] **Domain** — `internal/domain/warehouse/wishlist` (standard layout), CRUD +
  status transitions; approval-pipeline registration
- [x] **Acquire flow** — "Mark acquired" → redirect to item create wizard prefilled
  (name, category, notes + url + price estimate into description); on item creation
  link back (`acquired_item_id` column) and close the wishlist row
- [x] **Frontend** — wishlist page (list + status filter + priority sort), nav entry,
  add-to-wishlist quick action; i18n keys (en/et/ru)
- [x] **Out of scope for v1** — price tracking/scraping, shared gift lists, per-user
  (vs per-workspace) wishlists

## Phase 4: AI & Advanced Features

- [ ] MCP server for AI integration
  - Expose HWS operations as MCP tools
  - Search items, manage inventory, check loans via natural language
  - Compatible with Claude Desktop, local AI clients (Ollama, LM Studio)
  - TUI evolves into conversational CLI (like Claude Code for HWS)
- [ ] Photo to item recognition
  - Take photo, AI identifies item and suggests category/metadata
  - Auto-fill brand, model from image
  - Extract text from labels/serial numbers
