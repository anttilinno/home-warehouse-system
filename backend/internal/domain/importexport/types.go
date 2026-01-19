package importexport

import (
	"time"

	"github.com/google/uuid"
)

// Format represents the import/export file format
type Format string

const (
	FormatCSV   Format = "csv"
	FormatJSON  Format = "json"
	FormatExcel Format = "xlsx"
)

// IsValid checks if the format is valid
func (f Format) IsValid() bool {
	switch f {
	case FormatCSV, FormatJSON, FormatExcel:
		return true
	}
	return false
}

// EntityType represents the type of entity being imported/exported
type EntityType string

const (
	EntityTypeItem      EntityType = "item"
	EntityTypeLocation  EntityType = "location"
	EntityTypeContainer EntityType = "container"
	EntityTypeCategory  EntityType = "category"
	EntityTypeLabel     EntityType = "label"
	EntityTypeCompany   EntityType = "company"
	EntityTypeBorrower  EntityType = "borrower"
)

// SupportedEntityTypes returns all supported entity types for import/export
func SupportedEntityTypes() []EntityType {
	return []EntityType{
		EntityTypeItem,
		EntityTypeLocation,
		EntityTypeContainer,
		EntityTypeCategory,
		EntityTypeLabel,
		EntityTypeCompany,
		EntityTypeBorrower,
	}
}

// IsValid checks if the entity type is valid
func (e EntityType) IsValid() bool {
	switch e {
	case EntityTypeItem, EntityTypeLocation, EntityTypeContainer,
		EntityTypeCategory, EntityTypeLabel, EntityTypeCompany, EntityTypeBorrower:
		return true
	}
	return false
}

// ImportError represents an error that occurred during import
type ImportError struct {
	Row     int    `json:"row"`
	Column  string `json:"column,omitempty"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// ImportResult represents the result of an import operation
type ImportResult struct {
	TotalRows int           `json:"total_rows"`
	Succeeded int           `json:"succeeded"`
	Failed    int           `json:"failed"`
	Errors    []ImportError `json:"errors,omitempty"`
}

// ExportOptions contains options for export operations
type ExportOptions struct {
	WorkspaceID     uuid.UUID
	EntityType      EntityType
	Format          Format
	IncludeArchived bool
}

// ItemExport represents an item for export
type ItemExport struct {
	ID            string `json:"id" csv:"id"`
	SKU           string `json:"sku" csv:"sku"`
	Name          string `json:"name" csv:"name"`
	Description   string `json:"description" csv:"description"`
	CategoryName  string `json:"category_name" csv:"category_name"`
	Brand         string `json:"brand" csv:"brand"`
	Model         string `json:"model" csv:"model"`
	Manufacturer  string `json:"manufacturer" csv:"manufacturer"`
	Barcode       string `json:"barcode" csv:"barcode"`
	ShortCode     string `json:"short_code" csv:"short_code"`
	MinStockLevel int32  `json:"min_stock_level" csv:"min_stock_level"`
	IsArchived    bool   `json:"is_archived" csv:"is_archived"`
	CreatedAt     string `json:"created_at" csv:"created_at"`
	UpdatedAt     string `json:"updated_at" csv:"updated_at"`
}

// ItemImport represents an item for import
type ItemImport struct {
	SKU           string `json:"sku" csv:"sku"`
	Name          string `json:"name" csv:"name"`
	Description   string `json:"description" csv:"description"`
	CategoryName  string `json:"category_name" csv:"category_name"`
	Brand         string `json:"brand" csv:"brand"`
	Model         string `json:"model" csv:"model"`
	Manufacturer  string `json:"manufacturer" csv:"manufacturer"`
	Barcode       string `json:"barcode" csv:"barcode"`
	MinStockLevel int32  `json:"min_stock_level" csv:"min_stock_level"`
}

// LocationExport represents a location for export
type LocationExport struct {
	ID             string `json:"id" csv:"id"`
	Name           string `json:"name" csv:"name"`
	ParentLocation string `json:"parent_location" csv:"parent_location"`
	Description    string `json:"description" csv:"description"`
	ShortCode      string `json:"short_code" csv:"short_code"`
	IsArchived     bool   `json:"is_archived" csv:"is_archived"`
	CreatedAt      string `json:"created_at" csv:"created_at"`
	UpdatedAt      string `json:"updated_at" csv:"updated_at"`
}

// LocationImport represents a location for import
type LocationImport struct {
	Name           string `json:"name" csv:"name"`
	ParentLocation string `json:"parent_location" csv:"parent_location"`
	Description    string `json:"description" csv:"description"`
}

// CategoryExport represents a category for export
type CategoryExport struct {
	ID             string `json:"id" csv:"id"`
	Name           string `json:"name" csv:"name"`
	ParentCategory string `json:"parent_category" csv:"parent_category"`
	Description    string `json:"description" csv:"description"`
	IsArchived     bool   `json:"is_archived" csv:"is_archived"`
	CreatedAt      string `json:"created_at" csv:"created_at"`
	UpdatedAt      string `json:"updated_at" csv:"updated_at"`
}

// CategoryImport represents a category for import
type CategoryImport struct {
	Name           string `json:"name" csv:"name"`
	ParentCategory string `json:"parent_category" csv:"parent_category"`
	Description    string `json:"description" csv:"description"`
}

// ContainerExport represents a container for export
type ContainerExport struct {
	ID           string `json:"id" csv:"id"`
	Name         string `json:"name" csv:"name"`
	LocationName string `json:"location_name" csv:"location_name"`
	Description  string `json:"description" csv:"description"`
	Capacity     string `json:"capacity" csv:"capacity"`
	ShortCode    string `json:"short_code" csv:"short_code"`
	IsArchived   bool   `json:"is_archived" csv:"is_archived"`
	CreatedAt    string `json:"created_at" csv:"created_at"`
	UpdatedAt    string `json:"updated_at" csv:"updated_at"`
}

// ContainerImport represents a container for import
type ContainerImport struct {
	Name         string `json:"name" csv:"name"`
	LocationName string `json:"location_name" csv:"location_name"`
	Description  string `json:"description" csv:"description"`
	Capacity     string `json:"capacity" csv:"capacity"`
}

// LabelExport represents a label for export
type LabelExport struct {
	ID          string `json:"id" csv:"id"`
	Name        string `json:"name" csv:"name"`
	Color       string `json:"color" csv:"color"`
	Description string `json:"description" csv:"description"`
	IsArchived  bool   `json:"is_archived" csv:"is_archived"`
	CreatedAt   string `json:"created_at" csv:"created_at"`
	UpdatedAt   string `json:"updated_at" csv:"updated_at"`
}

// LabelImport represents a label for import
type LabelImport struct {
	Name        string `json:"name" csv:"name"`
	Color       string `json:"color" csv:"color"`
	Description string `json:"description" csv:"description"`
}

// CompanyExport represents a company for export
type CompanyExport struct {
	ID         string `json:"id" csv:"id"`
	Name       string `json:"name" csv:"name"`
	Website    string `json:"website" csv:"website"`
	Notes      string `json:"notes" csv:"notes"`
	IsArchived bool   `json:"is_archived" csv:"is_archived"`
	CreatedAt  string `json:"created_at" csv:"created_at"`
	UpdatedAt  string `json:"updated_at" csv:"updated_at"`
}

// CompanyImport represents a company for import
type CompanyImport struct {
	Name    string `json:"name" csv:"name"`
	Website string `json:"website" csv:"website"`
	Notes   string `json:"notes" csv:"notes"`
}

// BorrowerExport represents a borrower for export
type BorrowerExport struct {
	ID         string `json:"id" csv:"id"`
	Name       string `json:"name" csv:"name"`
	Email      string `json:"email" csv:"email"`
	Phone      string `json:"phone" csv:"phone"`
	Notes      string `json:"notes" csv:"notes"`
	IsArchived bool   `json:"is_archived" csv:"is_archived"`
	CreatedAt  string `json:"created_at" csv:"created_at"`
	UpdatedAt  string `json:"updated_at" csv:"updated_at"`
}

// BorrowerImport represents a borrower for import
type BorrowerImport struct {
	Name  string `json:"name" csv:"name"`
	Email string `json:"email" csv:"email"`
	Phone string `json:"phone" csv:"phone"`
	Notes string `json:"notes" csv:"notes"`
}

// ExportMetadata contains metadata about an export
type ExportMetadata struct {
	EntityType   EntityType `json:"entity_type"`
	Format       Format     `json:"format"`
	TotalRecords int        `json:"total_records"`
	ExportedAt   time.Time  `json:"exported_at"`
	WorkspaceID  uuid.UUID  `json:"workspace_id"`
}

// WorkspaceBackupResult contains the result of a workspace backup export
type WorkspaceBackupResult struct {
	Data         []byte            `json:"-"`
	Filename     string            `json:"filename"`
	ContentType  string            `json:"content_type"`
	RecordCounts map[string]int    `json:"record_counts"`
	TotalRecords int               `json:"total_records"`
	ExportID     uuid.UUID         `json:"export_id"`
}

// WorkspaceRestoreRequest contains data for restoring a workspace
type WorkspaceRestoreRequest struct {
	Format Format `json:"format"`
	Data   string `json:"data"` // Base64 encoded
}
