## Phase 9: Advanced Patterns (from Python Backend)

These patterns are proven in the existing Python/Litestar backend and should be ported to Go.

### 9.1 Delta Sync API for PWA Offline Support

**Sync Controller** (`internal/domain/sync/handler.go`):

```go
// GET /workspaces/{workspace_id}/sync/delta
type DeltaSyncRequest struct {
    ModifiedSince *time.Time `query:"modified_since"` // ISO 8601 timestamp
    EntityTypes   string     `query:"entity_types"`   // Comma-separated: "item,location,inventory"
    Limit         int        `query:"limit" default:"500" minimum:"1" maximum:"1000"`
}

type DeltaSyncResponse struct {
    Body struct {
        Items       []ItemResponse       `json:"items,omitempty"`
        Locations   []LocationResponse   `json:"locations,omitempty"`
        Containers  []ContainerResponse  `json:"containers,omitempty"`
        Inventory   []InventoryResponse  `json:"inventory,omitempty"`
        Categories  []CategoryResponse   `json:"categories,omitempty"`
        Labels      []LabelResponse      `json:"labels,omitempty"`
        Deleted     []DeletedRecord      `json:"deleted"`
        SyncedAt    time.Time            `json:"synced_at"`
        HasMore     bool                 `json:"has_more"`
    }
}

func (h *SyncHandler) GetDelta(ctx context.Context, input *DeltaSyncRequest) (*DeltaSyncResponse, error) {
    workspace := GetWorkspaceContext(ctx)

    // Parse entity types
    var entityTypes []string
    if input.EntityTypes != "" {
        entityTypes = strings.Split(input.EntityTypes, ",")
    }

    return h.syncService.GetDelta(ctx, workspace.WorkspaceID, input.ModifiedSince, entityTypes, input.Limit)
}
```

**Sync Service** (`internal/domain/sync/service.go`):

```go
type SyncService struct {
    itemRepo      *item.Repository
    locationRepo  *location.Repository
    inventoryRepo *inventory.Repository
    deletedRepo   *deleted.Repository
    // ... other repos
}

func (s *SyncService) GetDelta(
    ctx context.Context,
    workspaceID uuid.UUID,
    modifiedSince *time.Time,
    entityTypes []string,
    limit int,
) (*DeltaSyncResponse, error) {
    response := &DeltaSyncResponse{}
    response.Body.SyncedAt = time.Now()

    // If no entity types specified, sync all
    if len(entityTypes) == 0 {
        entityTypes = []string{"item", "location", "container", "inventory", "category", "label"}
    }

    for _, entityType := range entityTypes {
        switch entityType {
        case "item":
            items, err := s.itemRepo.ListModifiedSince(ctx, workspaceID, modifiedSince, limit)
            if err != nil {
                return nil, err
            }
            response.Body.Items = toItemResponses(items)
            response.Body.HasMore = response.Body.HasMore || len(items) == limit

        case "location":
            locations, err := s.locationRepo.ListModifiedSince(ctx, workspaceID, modifiedSince, limit)
            if err != nil {
                return nil, err
            }
            response.Body.Locations = toLocationResponses(locations)
            response.Body.HasMore = response.Body.HasMore || len(locations) == limit

        // ... other entity types
        }
    }

    // Always include deleted records for tombstone sync
    deleted, err := s.deletedRepo.ListSince(ctx, workspaceID, modifiedSince)
    if err != nil {
        return nil, err
    }
    response.Body.Deleted = deleted

    return response, nil
}
```

---

### 9.2 Optimistic Locking for Conflict Detection

**Repository Pattern with Conflict Detection**:

```go
// internal/shared/repository.go
type ConflictResult[T any] struct {
    Entity      *T
    HasConflict bool
}

// GetForUpdate retrieves entity and checks for update conflicts
func (r *BaseRepository[T]) GetForUpdate(
    ctx context.Context,
    id uuid.UUID,
    workspaceID uuid.UUID,
    expectedUpdatedAt *time.Time,
) (*ConflictResult[T], error) {
    entity, err := r.GetByID(ctx, id, workspaceID)
    if err != nil {
        return nil, err
    }
    if entity == nil {
        return &ConflictResult[T]{Entity: nil, HasConflict: false}, nil
    }

    // Check for conflict if expected timestamp provided
    hasConflict := false
    if expectedUpdatedAt != nil {
        entityUpdatedAt := (*entity).GetUpdatedAt()
        if entityUpdatedAt.After(*expectedUpdatedAt) {
            hasConflict = true
        }
    }

    return &ConflictResult[T]{Entity: entity, HasConflict: hasConflict}, nil
}
```

**Usage in Batch Operations**:

```go
// POST /workspaces/{workspace_id}/sync/batch
type BatchOperation struct {
    Operation   string          `json:"operation"` // "create", "update", "delete"
    EntityType  string          `json:"entity_type"`
    EntityID    *uuid.UUID      `json:"entity_id,omitempty"`
    Data        json.RawMessage `json:"data,omitempty"`
    UpdatedAt   *time.Time      `json:"updated_at,omitempty"` // For conflict detection
}

type BatchRequest struct {
    Operations []BatchOperation `json:"operations"`
}

type BatchResultItem struct {
    Index       int        `json:"index"`
    Success     bool       `json:"success"`
    EntityID    *uuid.UUID `json:"entity_id,omitempty"`
    Error       *string    `json:"error,omitempty"`
    ErrorCode   *ErrorCode `json:"error_code,omitempty"`
    HasConflict bool       `json:"has_conflict,omitempty"`
    ServerData  any        `json:"server_data,omitempty"` // Current server state on conflict
}

type BatchResponse struct {
    Results   []BatchResultItem `json:"results"`
    Succeeded int               `json:"succeeded"`
    Failed    int               `json:"failed"`
    Conflicts int               `json:"conflicts"`
}
```

---

### 9.3 Breadcrumb/Hierarchical Navigation

**Location Breadcrumb Service**:

```go
// internal/domain/warehouse/location/service.go
type BreadcrumbItem struct {
    ID        uuid.UUID `json:"id"`
    Name      string    `json:"name"`
    ShortCode *string   `json:"short_code,omitempty"`
}

func (s *LocationService) GetBreadcrumb(
    ctx context.Context,
    locationID uuid.UUID,
    workspaceID uuid.UUID,
) ([]BreadcrumbItem, error) {
    breadcrumb := make([]BreadcrumbItem, 0)
    visited := make(map[uuid.UUID]bool) // Prevent infinite loops from bad data
    currentID := &locationID

    for currentID != nil && !visited[*currentID] {
        visited[*currentID] = true

        location, err := s.repo.GetByID(ctx, *currentID, workspaceID)
        if err != nil || location == nil {
            break
        }

        // Prepend to build root-to-current path
        breadcrumb = append([]BreadcrumbItem{{
            ID:        location.ID(),
            Name:      location.Name(),
            ShortCode: location.ShortCode(),
        }}, breadcrumb...)

        currentID = location.ParentLocationID()
    }

    return breadcrumb, nil
}
```

**sqlc Query for Recursive Breadcrumb** (`db/queries/locations.sql`):

```sql
-- name: GetLocationBreadcrumb :many
WITH RECURSIVE breadcrumb AS (
    -- Start from target location
    SELECT id, workspace_id, name, parent_location, short_code, 0 as depth
    FROM warehouse.locations
    WHERE id = $1 AND workspace_id = $2

    UNION ALL

    -- Walk up the tree
    SELECT l.id, l.workspace_id, l.name, l.parent_location, l.short_code, b.depth + 1
    FROM warehouse.locations l
    JOIN breadcrumb b ON l.id = b.parent_location
    WHERE b.depth < 20  -- Safety limit
)
SELECT id, name, short_code
FROM breadcrumb
ORDER BY depth DESC;  -- Root first
```

---

### 9.4 Background Jobs with Redis Queue

**Job Definitions** (`internal/jobs/loan_reminders.go`):

```go
package jobs

import (
    "context"
    "time"

    "github.com/hibiken/asynq"
)

const (
    TypeLoanReminders = "loan:reminders"
    TypeCleanupDeleted = "cleanup:deleted_records"
)

type LoanRemindersPayload struct {
    ReminderDays int `json:"reminder_days"`
}

func NewLoanRemindersTask(reminderDays int) (*asynq.Task, error) {
    payload, err := json.Marshal(LoanRemindersPayload{ReminderDays: reminderDays})
    if err != nil {
        return nil, err
    }
    return asynq.NewTask(TypeLoanReminders, payload), nil
}

func HandleLoanReminders(ctx context.Context, t *asynq.Task) error {
    var payload LoanRemindersPayload
    if err := json.Unmarshal(t.Payload(), &payload); err != nil {
        return err
    }

    // Get database connection
    db := GetDBFromContext(ctx)
    emailSvc := GetEmailServiceFromContext(ctx)

    reminderDate := time.Now().AddDate(0, 0, payload.ReminderDays)

    // Query overdue and due-soon loans
    loans, err := queries.ListLoansNeedingReminder(ctx, db, reminderDate)
    if err != nil {
        return err
    }

    for _, loan := range loans {
        isOverdue := loan.DueDate.Before(time.Now())

        if err := emailSvc.SendLoanReminder(ctx, &LoanReminderEmail{
            To:           loan.BorrowerEmail,
            BorrowerName: loan.BorrowerName,
            ItemName:     loan.ItemName,
            DueDate:      loan.DueDate,
            IsOverdue:    isOverdue,
        }); err != nil {
            log.Printf("Failed to send reminder for loan %s: %v", loan.ID, err)
            continue
        }
    }

    return nil
}
```

**Job Scheduler** (`cmd/server/main.go`):

```go
// Setup Asynq scheduler for periodic jobs
scheduler := asynq.NewScheduler(
    asynq.RedisClientOpt{Addr: cfg.RedisURL},
    &asynq.SchedulerOpts{},
)

// Run loan reminders daily at 9 AM
task, _ := jobs.NewLoanRemindersTask(3) // 3 days before due
scheduler.Register("0 9 * * *", task)

// Cleanup old deleted records weekly
cleanupTask, _ := jobs.NewCleanupDeletedTask(30) // Keep 30 days
scheduler.Register("0 2 * * 0", cleanupTask) // Sunday 2 AM

go scheduler.Run()
```

**sqlc Query for Loan Reminders** (`db/queries/loans.sql`):

```sql
-- name: ListLoansNeedingReminder :many
SELECT
    l.id,
    l.due_date,
    l.loaned_at,
    b.name as borrower_name,
    b.email as borrower_email,
    i.name as item_name,
    w.name as workspace_name
FROM warehouse.loans l
JOIN warehouse.borrowers b ON l.borrower_id = b.id
JOIN warehouse.inventory inv ON l.inventory_id = inv.id
JOIN warehouse.items i ON inv.item_id = i.id
JOIN auth.workspaces w ON l.workspace_id = w.id
WHERE l.returned_at IS NULL
  AND l.due_date IS NOT NULL
  AND l.due_date <= $1
  AND b.email IS NOT NULL
  AND b.email != ''
ORDER BY l.due_date ASC;
```

---

### 9.5 Analytics & Dashboard Queries

**Analytics Service** (`internal/domain/analytics/service.go`):

```go
type DashboardStats struct {
    TotalItems      int            `json:"total_items"`
    TotalInventory  int            `json:"total_inventory"`
    TotalLocations  int            `json:"total_locations"`
    TotalContainers int            `json:"total_containers"`
    ActiveLoans     int            `json:"active_loans"`
    OverdueLoans    int            `json:"overdue_loans"`
    LowStockItems   int            `json:"low_stock_items"`
    RecentActivity  []ActivityItem `json:"recent_activity"`
}

type CategoryStats struct {
    ID             uuid.UUID `json:"id"`
    Name           string    `json:"name"`
    ItemCount      int       `json:"item_count"`
    InventoryCount int       `json:"inventory_count"`
    TotalValue     int       `json:"total_value"` // cents
}

type LoanStats struct {
    TotalLoans    int `json:"total_loans"`
    ActiveLoans   int `json:"active_loans"`
    ReturnedLoans int `json:"returned_loans"`
    OverdueLoans  int `json:"overdue_loans"`
}
```

**sqlc Queries** (`db/queries/analytics.sql`):

```sql
-- name: GetDashboardStats :one
SELECT
    (SELECT COUNT(*) FROM warehouse.items WHERE workspace_id = $1 AND is_archived = false) as total_items,
    (SELECT COUNT(*) FROM warehouse.inventory WHERE workspace_id = $1 AND is_archived = false) as total_inventory,
    (SELECT COUNT(*) FROM warehouse.locations WHERE workspace_id = $1 AND is_archived = false) as total_locations,
    (SELECT COUNT(*) FROM warehouse.containers WHERE workspace_id = $1 AND is_archived = false) as total_containers,
    (SELECT COUNT(*) FROM warehouse.loans WHERE workspace_id = $1 AND returned_at IS NULL) as active_loans,
    (SELECT COUNT(*) FROM warehouse.loans WHERE workspace_id = $1 AND returned_at IS NULL AND due_date < NOW()) as overdue_loans,
    (SELECT COUNT(*) FROM (
        SELECT i.id
        FROM warehouse.items i
        LEFT JOIN warehouse.inventory inv ON i.id = inv.item_id AND inv.is_archived = false
        WHERE i.workspace_id = $1 AND i.is_archived = false AND i.min_stock_level > 0
        GROUP BY i.id, i.min_stock_level
        HAVING COALESCE(SUM(inv.quantity), 0) < i.min_stock_level
    ) low_stock) as low_stock_items;

-- name: GetCategoryStats :many
SELECT
    c.id,
    c.name,
    COUNT(DISTINCT i.id)::int as item_count,
    COUNT(inv.id)::int as inventory_count,
    COALESCE(SUM(inv.purchase_price), 0)::int as total_value
FROM warehouse.categories c
LEFT JOIN warehouse.items i ON i.category_id = c.id AND i.is_archived = false
LEFT JOIN warehouse.inventory inv ON inv.item_id = i.id AND inv.is_archived = false
WHERE c.workspace_id = $1 AND c.is_archived = false
GROUP BY c.id, c.name
ORDER BY item_count DESC
LIMIT 10;

-- name: GetLoanStats :one
SELECT
    COUNT(*)::int as total_loans,
    COUNT(*) FILTER (WHERE returned_at IS NULL)::int as active_loans,
    COUNT(*) FILTER (WHERE returned_at IS NOT NULL)::int as returned_loans,
    COUNT(*) FILTER (WHERE returned_at IS NULL AND due_date < NOW())::int as overdue_loans
FROM warehouse.loans
WHERE workspace_id = $1;

-- name: GetInventoryValueByLocation :many
SELECT
    l.id,
    l.name,
    COUNT(inv.id)::int as item_count,
    COALESCE(SUM(inv.quantity), 0)::int as total_quantity,
    COALESCE(SUM(inv.purchase_price * inv.quantity), 0)::int as total_value
FROM warehouse.locations l
LEFT JOIN warehouse.inventory inv ON inv.location_id = l.id AND inv.is_archived = false
WHERE l.workspace_id = $1 AND l.is_archived = false
GROUP BY l.id, l.name
ORDER BY total_value DESC
LIMIT 10;
```

---

### 9.6 Import/Export System

**Import Handler** (`internal/domain/import/handler.go`):

```go
type ImportRequest struct {
    EntityType string `json:"entity_type"` // "item", "location", "inventory", etc.
    Format     string `json:"format"`      // "csv", "json"
    Data       string `json:"data"`        // Base64 encoded file content
}

type ImportResult struct {
    TotalRows   int           `json:"total_rows"`
    Succeeded   int           `json:"succeeded"`
    Failed      int           `json:"failed"`
    Errors      []ImportError `json:"errors,omitempty"`
}

type ImportError struct {
    Row     int    `json:"row"`
    Column  string `json:"column,omitempty"`
    Message string `json:"message"`
    Code    string `json:"code"`
}

func (h *ImportHandler) Import(ctx context.Context, input *ImportRequest) (*ImportResult, error) {
    workspace := GetWorkspaceContext(ctx)

    // Decode file content
    data, err := base64.StdEncoding.DecodeString(input.Data)
    if err != nil {
        return nil, apierror.ValidationError(ErrCodeInvalidFormat, "data", "Invalid base64 encoding")
    }

    // Parse based on format
    var rows []map[string]string
    switch input.Format {
    case "csv":
        rows, err = parseCSV(data)
    case "json":
        rows, err = parseJSON(data)
    default:
        return nil, apierror.ValidationError(ErrCodeInvalidFormat, "format", "Unsupported format")
    }
    if err != nil {
        return nil, err
    }

    // Process rows
    result := &ImportResult{TotalRows: len(rows)}

    for i, row := range rows {
        if err := h.importService.ImportRow(ctx, workspace.WorkspaceID, input.EntityType, row); err != nil {
            result.Failed++
            var appErr *apierror.APIError
            if errors.As(err, &appErr) {
                result.Errors = append(result.Errors, ImportError{
                    Row:     i + 1,
                    Message: appErr.Message,
                    Code:    string(appErr.Code),
                })
            }
        } else {
            result.Succeeded++
        }
    }

    return result, nil
}
```

**Export Handler**:

```go
// GET /workspaces/{workspace_id}/export/{entity_type}
type ExportRequest struct {
    EntityType string `path:"entity_type"`
    Format     string `query:"format" default:"csv"` // "csv", "json"
}

func (h *ExportHandler) Export(ctx context.Context, input *ExportRequest) (*huma.StreamResponse, error) {
    workspace := GetWorkspaceContext(ctx)

    // Get entities based on type
    var data any
    switch input.EntityType {
    case "items":
        items, _ := h.itemRepo.List(ctx, workspace.WorkspaceID)
        data = items
    case "locations":
        locations, _ := h.locationRepo.List(ctx, workspace.WorkspaceID)
        data = locations
    // ... other types
    }

    // Convert to requested format
    var content []byte
    var contentType string
    switch input.Format {
    case "csv":
        content, _ = toCSV(data)
        contentType = "text/csv"
    case "json":
        content, _ = json.Marshal(data)
        contentType = "application/json"
    }

    return &huma.StreamResponse{
        Body: bytes.NewReader(content),
        Headers: map[string]string{
            "Content-Type": contentType,
            "Content-Disposition": fmt.Sprintf("attachment; filename=%s.%s", input.EntityType, input.Format),
        },
    }, nil
}
```

---

### 9.7 Configuration Management

**Configuration Structure** (`internal/config/config.go`):

```go
package config

import (
    "os"
    "strconv"
    "time"
)

type Config struct {
    // Database
    DatabaseURL     string
    DatabaseMaxConn int
    DatabaseMinConn int

    // Redis
    RedisURL string

    // JWT
    JWTSecret          string
    JWTAlgorithm       string
    JWTExpirationHours int

    // Server
    ServerHost    string
    ServerPort    int
    ServerTimeout time.Duration

    // Email (Resend)
    ResendAPIKey     string
    EmailFromAddress string
    EmailFromName    string

    // OAuth
    GoogleClientID     string
    GoogleClientSecret string
    GitHubClientID     string
    GitHubClientSecret string

    // URLs
    AppURL     string // Frontend URL
    BackendURL string

    // Feature Flags
    DebugMode bool
}

func Load() *Config {
    return &Config{
        // Database
        DatabaseURL:     getEnv("DATABASE_URL", "postgresql://wh:wh@localhost:5432/warehouse_dev"),
        DatabaseMaxConn: getEnvInt("DATABASE_MAX_CONN", 25),
        DatabaseMinConn: getEnvInt("DATABASE_MIN_CONN", 5),

        // Redis
        RedisURL: getEnv("REDIS_URL", "redis://localhost:6379/0"),

        // JWT
        JWTSecret:          getEnv("JWT_SECRET", "change-me-in-production"),
        JWTAlgorithm:       getEnv("JWT_ALGORITHM", "HS256"),
        JWTExpirationHours: getEnvInt("JWT_EXPIRATION_HOURS", 24),

        // Server
        ServerHost:    getEnv("SERVER_HOST", "0.0.0.0"),
        ServerPort:    getEnvInt("SERVER_PORT", 8080),
        ServerTimeout: time.Duration(getEnvInt("SERVER_TIMEOUT_SECONDS", 60)) * time.Second,

        // Email
        ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
        EmailFromAddress: getEnv("EMAIL_FROM_ADDRESS", "noreply@example.com"),
        EmailFromName:    getEnv("EMAIL_FROM_NAME", "Home Warehouse"),

        // OAuth
        GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
        GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
        GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
        GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),

        // URLs
        AppURL:     getEnv("APP_URL", "http://localhost:3000"),
        BackendURL: getEnv("BACKEND_URL", "http://localhost:8080"),

        // Feature Flags
        DebugMode: getEnvBool("DEBUG", false),
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
    if value := os.Getenv(key); value != "" {
        if i, err := strconv.Atoi(value); err == nil {
            return i
        }
    }
    return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
    if value := os.Getenv(key); value != "" {
        if b, err := strconv.ParseBool(value); err == nil {
            return b
        }
    }
    return defaultValue
}

// Validation
func (c *Config) Validate() error {
    if c.DatabaseURL == "" {
        return errors.New("DATABASE_URL is required")
    }
    if c.JWTSecret == "change-me-in-production" && !c.DebugMode {
        return errors.New("JWT_SECRET must be changed in production")
    }
    return nil
}
```

---

### 9.8 Barcode Lookup Integration

**Barcode Service** (`internal/domain/import/barcode.go`):

```go
type BarcodeProduct struct {
    Barcode  string  `json:"barcode"`
    Name     string  `json:"name"`
    Brand    *string `json:"brand,omitempty"`
    Category *string `json:"category,omitempty"`
    ImageURL *string `json:"image_url,omitempty"`
    Found    bool    `json:"found"`
}

type BarcodeService struct {
    httpClient *http.Client
}

func NewBarcodeService() *BarcodeService {
    return &BarcodeService{
        httpClient: &http.Client{Timeout: 10 * time.Second},
    }
}

func (s *BarcodeService) Lookup(ctx context.Context, barcode string) (*BarcodeProduct, error) {
    // Try Open Food Facts first (for food items)
    if product, err := s.lookupOpenFoodFacts(ctx, barcode); err == nil && product.Found {
        return product, nil
    }

    // Try UPC Database as fallback
    if product, err := s.lookupUPCDatabase(ctx, barcode); err == nil && product.Found {
        return product, nil
    }

    return &BarcodeProduct{Barcode: barcode, Found: false}, nil
}

func (s *BarcodeService) lookupOpenFoodFacts(ctx context.Context, barcode string) (*BarcodeProduct, error) {
    url := fmt.Sprintf("https://world.openfoodfacts.org/api/v0/product/%s.json", barcode)

    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    req.Header.Set("User-Agent", "HomeWarehouse/1.0")

    resp, err := s.httpClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        Status  int `json:"status"`
        Product struct {
            ProductName string `json:"product_name"`
            Brands      string `json:"brands"`
            Categories  string `json:"categories"`
            ImageURL    string `json:"image_url"`
        } `json:"product"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    if result.Status != 1 {
        return &BarcodeProduct{Barcode: barcode, Found: false}, nil
    }

    return &BarcodeProduct{
        Barcode:  barcode,
        Name:     result.Product.ProductName,
        Brand:    stringPtr(result.Product.Brands),
        Category: stringPtr(result.Product.Categories),
        ImageURL: stringPtr(result.Product.ImageURL),
        Found:    true,
    }, nil
}
```

**Handler**:

```go
// GET /api/barcode/{barcode}
func (h *ImportHandler) LookupBarcode(ctx context.Context, input *struct {
    Barcode string `path:"barcode"`
}) (*BarcodeProduct, error) {
    return h.barcodeService.Lookup(ctx, input.Barcode)
}
```

---

### 9.9 Obsidian Deep Links

**Item Entity Extension**:

```go
// internal/domain/warehouse/item/entity.go
type Item struct {
    // ... existing fields
    obsidianVaultPath *string
    obsidianNotePath  *string
}

// Generate Obsidian URI for deep linking
func (i *Item) ObsidianURI() *string {
    if i.obsidianVaultPath == nil || i.obsidianNotePath == nil {
        return nil
    }

    // Format: obsidian://open?vault=VaultName&file=path/to/note
    uri := fmt.Sprintf(
        "obsidian://open?vault=%s&file=%s",
        url.PathEscape(*i.obsidianVaultPath),
        url.PathEscape(*i.obsidianNotePath),
    )
    return &uri
}
```

**Response with Obsidian Link**:

```go
type ItemResponse struct {
    // ... existing fields
    ObsidianVaultPath *string `json:"obsidian_vault_path,omitempty"`
    ObsidianNotePath  *string `json:"obsidian_note_path,omitempty"`
    ObsidianURI       *string `json:"obsidian_uri,omitempty"` // Generated link
}

func toItemResponse(item *Item) ItemResponse {
    return ItemResponse{
        // ... existing fields
        ObsidianVaultPath: item.ObsidianVaultPath(),
        ObsidianNotePath:  item.ObsidianNotePath(),
        ObsidianURI:       item.ObsidianURI(),
    }
}
```

---

## Summary

This plan provides a complete roadmap for implementing the Go backend:

- **19 domains** organized following DDD principles
- **~90+ sqlc queries** covering all database operations
- **3-layer testing strategy** (unit → integration → E2E)
- **Clear implementation order** respecting domain dependencies
- **Centralized error codes** for frontend i18n support
- **Advanced patterns** ported from proven Python backend

### Key Architectural Decisions

1. **Loan as Aggregate Root** - Encapsulates inventory validation logic
2. **Activity Log as Cross-Cutting** - Called by other services on mutations
3. **Deleted Records** - Enables PWA offline sync via tombstone pattern
4. **Multi-Tenant Isolation** - All warehouse domains enforce `workspace_id`
5. **Repository Interface in Domain** - Implementations in infra layer for testability
6. **Centralized Error Codes** - Machine-readable codes for frontend translation
7. **Delta Sync API** - Efficient offline-first PWA synchronization
8. **Optimistic Locking** - Conflict detection for concurrent updates
9. **Background Jobs** - Redis queue for async tasks (loan reminders, cleanup)
10. **Import/Export** - Bulk operations with row-level error tracking
