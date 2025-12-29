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
- [ ] Companion app for bar codes, QR codes. Adding and identifying container, items
- [ ] Item photos
  - Upload photos for items
  - Multiple photos per item
  - Thumbnail generation
- [ ] Theme settings
  - Move from settings to profile page
  - Save theme preference to database
  - Retro theme needs redesign (awaiting brainstorming in Stitch)

## Phase 2

- [x] Tracking & alerts (partial)
  - [x] Total value: sum of purchase_price per location/workspace
  - [ ] Activity log: who changed what, when. So there is no need for soft delete
  - [ ] Consumables list: items needing restocking (quantity = 0)
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

## Phase 3

- [ ] MCP server for AI integration
  - Expose HWS operations as MCP tools
  - Search items, manage inventory, check loans via natural language
  - Compatible with Claude Desktop, local AI clients (Ollama, LM Studio)
  - TUI evolves into conversational CLI (like Claude Code for HWS)
- [ ] Photo to item recognition
  - Take photo, AI identifies item and suggests category/metadata
  - Auto-fill brand, model from image
  - Extract text from labels/serial numbers
