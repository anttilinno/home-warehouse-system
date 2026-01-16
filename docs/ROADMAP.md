# Roadmap

## Phase 1

- [x] Workspaces for multi-user usage
- [x] Export/backup of data
  - Excel (.xlsx) with one sheet per entity, foreign keys resolved to names
  - JSON for migration/re-import
  - Endpoint: `GET /exports/workspace?format=xlsx|json`
  - Tracks exports in `auth.workspace_exports` for audit
- [x] Integration with Docspell (document management)
  - Link items to Docspell documents (receipts, manuals, warranties)
  - Store Docspell document ID in `warehouse.attachments`
  - Search Docspell from warehouse UI via REST API (fulltext search)
  - Sync tags between warehouse labels and Docspell tags
  - Per-workspace configuration with encrypted credentials
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
- [ ] Approval pipeline for member role
  - Members' create/update/delete operations require owner/admin approval
  - Pending changes table: entity type, action, JSON payload, requester, status
  - Review queue UI for owner/admin to approve/reject
  - Notifications when changes need review
  - Members see "Pending approval" status instead of immediate success
- [ ] TUI client (Go + Bubble Tea)
  - Terminal-based interface for quick inventory operations
  - Browse locations, containers, items
  - Add/move inventory without browser
- [ ] Repair log
  - Track repair history per item
  - Log repair date, cost, description, who performed it
  - Total cost of ownership view
- [ ] Declutter assistant
  - Surface items not accessed/moved in 12+ months
  - Suggest donate, sell, or dispose
  - Track declutter decisions and outcomes
- [x] Progressive Web App (PWA) (partial)
  - [x] Installable on iOS/Android without app store
  - [x] Offline support with service worker caching
  - [x] QR code scanning (camera API)
  - [x] Barcode scanning for item lookup
  - [ ] Background sync for offline changes
  - [ ] Push notifications support
- [ ] Item photos
  - Upload photos for items
  - Multiple photos per item
  - Thumbnail generation
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
- [ ] Kubernetes deployment configuration
  - Create k8s manifests for main backend service
  - Create k8s manifests for background worker
  - ConfigMaps for environment variables
  - Secrets for sensitive data (JWT, database credentials)
  - Deployment, Service, and Ingress resources
  - HPA (Horizontal Pod Autoscaler) for both services
  - PersistentVolumeClaim for upload storage
  - Health check endpoints integration

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
