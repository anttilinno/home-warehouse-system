package importexport

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// Repository defines the interface for import/export data access
type Repository interface {
	// Items
	ListAllItems(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseItem, error)
	CreateItem(ctx context.Context, params queries.CreateItemParams) (queries.WarehouseItem, error)
	GetCategoryByName(ctx context.Context, workspaceID uuid.UUID, name string) (*queries.WarehouseCategory, error)

	// Locations
	ListAllLocations(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseLocation, error)
	CreateLocation(ctx context.Context, params queries.CreateLocationParams) (queries.WarehouseLocation, error)
	GetLocationByName(ctx context.Context, workspaceID uuid.UUID, name string) (*queries.WarehouseLocation, error)

	// Categories
	ListAllCategories(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseCategory, error)
	CreateCategory(ctx context.Context, params queries.CreateCategoryParams) (queries.WarehouseCategory, error)

	// Containers
	ListAllContainers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseContainer, error)
	CreateContainer(ctx context.Context, params queries.CreateContainerParams) (queries.WarehouseContainer, error)

	// Labels
	ListAllLabels(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseLabel, error)
	CreateLabel(ctx context.Context, params queries.CreateLabelParams) (queries.WarehouseLabel, error)

	// Companies
	ListAllCompanies(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseCompany, error)
	CreateCompany(ctx context.Context, params queries.CreateCompanyParams) (queries.WarehouseCompany, error)

	// Borrowers
	ListAllBorrowers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseBorrower, error)
	CreateBorrower(ctx context.Context, params queries.CreateBorrowerParams) (queries.WarehouseBorrower, error)
}

// Service handles import/export operations
type Service struct {
	repo Repository
}

// NewService creates a new import/export service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Export exports entities to the specified format
func (s *Service) Export(ctx context.Context, opts ExportOptions) ([]byte, *ExportMetadata, error) {
	var data interface{}
	var count int
	var err error

	switch opts.EntityType {
	case EntityTypeItem:
		data, count, err = s.exportItems(ctx, opts.WorkspaceID, opts.IncludeArchived)
	case EntityTypeLocation:
		data, count, err = s.exportLocations(ctx, opts.WorkspaceID, opts.IncludeArchived)
	case EntityTypeCategory:
		data, count, err = s.exportCategories(ctx, opts.WorkspaceID, opts.IncludeArchived)
	case EntityTypeContainer:
		data, count, err = s.exportContainers(ctx, opts.WorkspaceID, opts.IncludeArchived)
	case EntityTypeLabel:
		data, count, err = s.exportLabels(ctx, opts.WorkspaceID, opts.IncludeArchived)
	case EntityTypeCompany:
		data, count, err = s.exportCompanies(ctx, opts.WorkspaceID, opts.IncludeArchived)
	case EntityTypeBorrower:
		data, count, err = s.exportBorrowers(ctx, opts.WorkspaceID, opts.IncludeArchived)
	default:
		return nil, nil, fmt.Errorf("unsupported entity type: %s", opts.EntityType)
	}

	if err != nil {
		return nil, nil, err
	}

	var content []byte
	switch opts.Format {
	case FormatJSON:
		content, err = json.MarshalIndent(data, "", "  ")
	case FormatCSV:
		content, err = s.toCSV(data, opts.EntityType)
	default:
		return nil, nil, fmt.Errorf("unsupported format: %s", opts.Format)
	}

	if err != nil {
		return nil, nil, err
	}

	metadata := &ExportMetadata{
		EntityType:   opts.EntityType,
		Format:       opts.Format,
		TotalRecords: count,
		ExportedAt:   time.Now().UTC(),
		WorkspaceID:  opts.WorkspaceID,
	}

	return content, metadata, nil
}

// Import imports entities from the provided data
func (s *Service) Import(ctx context.Context, workspaceID uuid.UUID, entityType EntityType, format Format, data []byte) (*ImportResult, error) {
	result := &ImportResult{
		Errors: make([]ImportError, 0),
	}

	var rows []map[string]string
	var err error

	switch format {
	case FormatJSON:
		rows, err = s.parseJSON(data)
	case FormatCSV:
		rows, err = s.parseCSV(data)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to parse data: %w", err)
	}

	result.TotalRows = len(rows)

	for i, row := range rows {
		rowNum := i + 1 // 1-based row numbers
		if err := s.importRow(ctx, workspaceID, entityType, row, rowNum); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Row:     rowNum,
				Message: err.Error(),
				Code:    "IMPORT_ERROR",
			})
		} else {
			result.Succeeded++
		}
	}

	return result, nil
}

// Export helper methods

func (s *Service) exportItems(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]ItemExport, int, error) {
	items, err := s.repo.ListAllItems(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, 0, err
	}

	result := make([]ItemExport, len(items))
	for i, item := range items {
		result[i] = ItemExport{
			ID:            item.ID.String(),
			SKU:           item.Sku,
			Name:          item.Name,
			Description:   ptrToString(item.Description),
			Brand:         ptrToString(item.Brand),
			Model:         ptrToString(item.Model),
			Manufacturer:  ptrToString(item.Manufacturer),
			Barcode:       ptrToString(item.Barcode),
			ShortCode:     ptrToString(item.ShortCode),
			MinStockLevel: item.MinStockLevel,
			IsArchived:    ptrToBool(item.IsArchived),
			CreatedAt:     pgtimeToString(item.CreatedAt),
			UpdatedAt:     pgtimeToString(item.UpdatedAt),
		}
	}
	return result, len(items), nil
}

func (s *Service) exportLocations(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]LocationExport, int, error) {
	locations, err := s.repo.ListAllLocations(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, 0, err
	}

	result := make([]LocationExport, len(locations))
	for i, loc := range locations {
		result[i] = LocationExport{
			ID:          loc.ID.String(),
			Name:        loc.Name,
			Zone:        ptrToString(loc.Zone),
			Shelf:       ptrToString(loc.Shelf),
			Bin:         ptrToString(loc.Bin),
			Description: ptrToString(loc.Description),
			ShortCode:   ptrToString(loc.ShortCode),
			IsArchived:  loc.IsArchived,
			CreatedAt:   pgtimeToString(loc.CreatedAt),
			UpdatedAt:   pgtimeToString(loc.UpdatedAt),
		}
	}
	return result, len(locations), nil
}

func (s *Service) exportCategories(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]CategoryExport, int, error) {
	categories, err := s.repo.ListAllCategories(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, 0, err
	}

	result := make([]CategoryExport, len(categories))
	for i, cat := range categories {
		result[i] = CategoryExport{
			ID:          cat.ID.String(),
			Name:        cat.Name,
			Description: ptrToString(cat.Description),
			IsArchived:  cat.IsArchived,
			CreatedAt:   pgtimeToString(cat.CreatedAt),
			UpdatedAt:   pgtimeToString(cat.UpdatedAt),
		}
	}
	return result, len(categories), nil
}

func (s *Service) exportContainers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]ContainerExport, int, error) {
	containers, err := s.repo.ListAllContainers(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, 0, err
	}

	result := make([]ContainerExport, len(containers))
	for i, c := range containers {
		result[i] = ContainerExport{
			ID:          c.ID.String(),
			Name:        c.Name,
			Description: ptrToString(c.Description),
			Capacity:    ptrToString(c.Capacity),
			ShortCode:   ptrToString(c.ShortCode),
			IsArchived:  c.IsArchived,
			CreatedAt:   pgtimeToString(c.CreatedAt),
			UpdatedAt:   pgtimeToString(c.UpdatedAt),
		}
	}
	return result, len(containers), nil
}

func (s *Service) exportLabels(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]LabelExport, int, error) {
	labels, err := s.repo.ListAllLabels(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, 0, err
	}

	result := make([]LabelExport, len(labels))
	for i, l := range labels {
		result[i] = LabelExport{
			ID:          l.ID.String(),
			Name:        l.Name,
			Color:       ptrToString(l.Color),
			Description: ptrToString(l.Description),
			IsArchived:  l.IsArchived,
			CreatedAt:   pgtimeToString(l.CreatedAt),
			UpdatedAt:   pgtimeToString(l.UpdatedAt),
		}
	}
	return result, len(labels), nil
}

func (s *Service) exportCompanies(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]CompanyExport, int, error) {
	companies, err := s.repo.ListAllCompanies(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, 0, err
	}

	result := make([]CompanyExport, len(companies))
	for i, c := range companies {
		result[i] = CompanyExport{
			ID:         c.ID.String(),
			Name:       c.Name,
			Website:    ptrToString(c.Website),
			Notes:      ptrToString(c.Notes),
			IsArchived: c.IsArchived,
			CreatedAt:  pgtimeToString(c.CreatedAt),
			UpdatedAt:  pgtimeToString(c.UpdatedAt),
		}
	}
	return result, len(companies), nil
}

func (s *Service) exportBorrowers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]BorrowerExport, int, error) {
	borrowers, err := s.repo.ListAllBorrowers(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, 0, err
	}

	result := make([]BorrowerExport, len(borrowers))
	for i, b := range borrowers {
		result[i] = BorrowerExport{
			ID:         b.ID.String(),
			Name:       b.Name,
			Email:      ptrToString(b.Email),
			Phone:      ptrToString(b.Phone),
			Notes:      ptrToString(b.Notes),
			IsArchived: b.IsArchived,
			CreatedAt:  pgtimeToString(b.CreatedAt),
			UpdatedAt:  pgtimeToString(b.UpdatedAt),
		}
	}
	return result, len(borrowers), nil
}

// CSV/JSON parsing methods

func (s *Service) parseCSV(data []byte) ([]map[string]string, error) {
	reader := csv.NewReader(bytes.NewReader(data))

	// Read header
	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV header: %w", err)
	}

	// Normalize header names
	for i, h := range header {
		header[i] = strings.ToLower(strings.TrimSpace(h))
	}

	var rows []map[string]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read CSV row: %w", err)
		}

		row := make(map[string]string)
		for i, value := range record {
			if i < len(header) {
				row[header[i]] = strings.TrimSpace(value)
			}
		}
		rows = append(rows, row)
	}

	return rows, nil
}

func (s *Service) parseJSON(data []byte) ([]map[string]string, error) {
	var rawRows []map[string]interface{}
	if err := json.Unmarshal(data, &rawRows); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	rows := make([]map[string]string, len(rawRows))
	for i, raw := range rawRows {
		row := make(map[string]string)
		for k, v := range raw {
			key := strings.ToLower(k)
			switch val := v.(type) {
			case string:
				row[key] = val
			case float64:
				row[key] = fmt.Sprintf("%.0f", val)
			case bool:
				if val {
					row[key] = "true"
				} else {
					row[key] = "false"
				}
			case nil:
				row[key] = ""
			default:
				row[key] = fmt.Sprintf("%v", val)
			}
		}
		rows[i] = row
	}

	return rows, nil
}

func (s *Service) toCSV(data interface{}, entityType EntityType) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	switch entityType {
	case EntityTypeItem:
		items := data.([]ItemExport)
		// Write header
		if err := writer.Write([]string{"id", "sku", "name", "description", "category_name", "brand", "model", "manufacturer", "barcode", "short_code", "min_stock_level", "is_archived", "created_at", "updated_at"}); err != nil {
			return nil, err
		}
		for _, item := range items {
			if err := writer.Write([]string{
				item.ID, item.SKU, item.Name, item.Description, item.CategoryName,
				item.Brand, item.Model, item.Manufacturer, item.Barcode, item.ShortCode,
				fmt.Sprintf("%d", item.MinStockLevel), fmt.Sprintf("%t", item.IsArchived),
				item.CreatedAt, item.UpdatedAt,
			}); err != nil {
				return nil, err
			}
		}

	case EntityTypeLocation:
		locations := data.([]LocationExport)
		if err := writer.Write([]string{"id", "name", "parent_location", "zone", "shelf", "bin", "description", "short_code", "is_archived", "created_at", "updated_at"}); err != nil {
			return nil, err
		}
		for _, loc := range locations {
			if err := writer.Write([]string{
				loc.ID, loc.Name, loc.ParentLocation, loc.Zone, loc.Shelf, loc.Bin,
				loc.Description, loc.ShortCode, fmt.Sprintf("%t", loc.IsArchived),
				loc.CreatedAt, loc.UpdatedAt,
			}); err != nil {
				return nil, err
			}
		}

	case EntityTypeCategory:
		categories := data.([]CategoryExport)
		if err := writer.Write([]string{"id", "name", "parent_category", "description", "is_archived", "created_at", "updated_at"}); err != nil {
			return nil, err
		}
		for _, cat := range categories {
			if err := writer.Write([]string{
				cat.ID, cat.Name, cat.ParentCategory, cat.Description,
				fmt.Sprintf("%t", cat.IsArchived), cat.CreatedAt, cat.UpdatedAt,
			}); err != nil {
				return nil, err
			}
		}

	case EntityTypeContainer:
		containers := data.([]ContainerExport)
		if err := writer.Write([]string{"id", "name", "location_name", "description", "capacity", "short_code", "is_archived", "created_at", "updated_at"}); err != nil {
			return nil, err
		}
		for _, c := range containers {
			if err := writer.Write([]string{
				c.ID, c.Name, c.LocationName, c.Description, c.Capacity, c.ShortCode,
				fmt.Sprintf("%t", c.IsArchived), c.CreatedAt, c.UpdatedAt,
			}); err != nil {
				return nil, err
			}
		}

	case EntityTypeLabel:
		labels := data.([]LabelExport)
		if err := writer.Write([]string{"id", "name", "color", "description", "is_archived", "created_at", "updated_at"}); err != nil {
			return nil, err
		}
		for _, l := range labels {
			if err := writer.Write([]string{
				l.ID, l.Name, l.Color, l.Description,
				fmt.Sprintf("%t", l.IsArchived), l.CreatedAt, l.UpdatedAt,
			}); err != nil {
				return nil, err
			}
		}

	case EntityTypeCompany:
		companies := data.([]CompanyExport)
		if err := writer.Write([]string{"id", "name", "website", "notes", "is_archived", "created_at", "updated_at"}); err != nil {
			return nil, err
		}
		for _, c := range companies {
			if err := writer.Write([]string{
				c.ID, c.Name, c.Website, c.Notes,
				fmt.Sprintf("%t", c.IsArchived), c.CreatedAt, c.UpdatedAt,
			}); err != nil {
				return nil, err
			}
		}

	case EntityTypeBorrower:
		borrowers := data.([]BorrowerExport)
		if err := writer.Write([]string{"id", "name", "email", "phone", "notes", "is_archived", "created_at", "updated_at"}); err != nil {
			return nil, err
		}
		for _, b := range borrowers {
			if err := writer.Write([]string{
				b.ID, b.Name, b.Email, b.Phone, b.Notes,
				fmt.Sprintf("%t", b.IsArchived), b.CreatedAt, b.UpdatedAt,
			}); err != nil {
				return nil, err
			}
		}

	default:
		return nil, fmt.Errorf("unsupported entity type for CSV: %s", entityType)
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// Import row handler
func (s *Service) importRow(ctx context.Context, workspaceID uuid.UUID, entityType EntityType, row map[string]string, rowNum int) error {
	switch entityType {
	case EntityTypeCategory:
		return s.importCategory(ctx, workspaceID, row)
	case EntityTypeLabel:
		return s.importLabel(ctx, workspaceID, row)
	case EntityTypeCompany:
		return s.importCompany(ctx, workspaceID, row)
	case EntityTypeBorrower:
		return s.importBorrower(ctx, workspaceID, row)
	case EntityTypeLocation:
		return s.importLocation(ctx, workspaceID, row)
	case EntityTypeItem:
		return s.importItem(ctx, workspaceID, row)
	case EntityTypeContainer:
		return s.importContainer(ctx, workspaceID, row)
	default:
		return fmt.Errorf("unsupported entity type for import: %s", entityType)
	}
}

func (s *Service) importCategory(ctx context.Context, workspaceID uuid.UUID, row map[string]string) error {
	name := row["name"]
	if name == "" {
		return fmt.Errorf("name is required")
	}

	var parentID pgtype.UUID
	if parentName := row["parent_category"]; parentName != "" {
		parent, err := s.repo.GetCategoryByName(ctx, workspaceID, parentName)
		if err != nil {
			return fmt.Errorf("failed to find parent category '%s': %w", parentName, err)
		}
		if parent != nil {
			parentID = pgtype.UUID{Bytes: parent.ID, Valid: true}
		}
	}

	_, err := s.repo.CreateCategory(ctx, queries.CreateCategoryParams{
		ID:               uuid.New(),
		WorkspaceID:      workspaceID,
		Name:             name,
		ParentCategoryID: parentID,
		Description:      stringToPtr(row["description"]),
	})
	return err
}

func (s *Service) importLabel(ctx context.Context, workspaceID uuid.UUID, row map[string]string) error {
	name := row["name"]
	if name == "" {
		return fmt.Errorf("name is required")
	}

	color := row["color"]
	if color == "" {
		color = "#808080" // Default gray
	}

	_, err := s.repo.CreateLabel(ctx, queries.CreateLabelParams{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Color:       stringToPtr(color),
		Description: stringToPtr(row["description"]),
	})
	return err
}

func (s *Service) importCompany(ctx context.Context, workspaceID uuid.UUID, row map[string]string) error {
	name := row["name"]
	if name == "" {
		return fmt.Errorf("name is required")
	}

	_, err := s.repo.CreateCompany(ctx, queries.CreateCompanyParams{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Website:     stringToPtr(row["website"]),
		Notes:       stringToPtr(row["notes"]),
	})
	return err
}

func (s *Service) importBorrower(ctx context.Context, workspaceID uuid.UUID, row map[string]string) error {
	name := row["name"]
	if name == "" {
		return fmt.Errorf("name is required")
	}

	_, err := s.repo.CreateBorrower(ctx, queries.CreateBorrowerParams{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Email:       stringToPtr(row["email"]),
		Phone:       stringToPtr(row["phone"]),
		Notes:       stringToPtr(row["notes"]),
	})
	return err
}

func (s *Service) importLocation(ctx context.Context, workspaceID uuid.UUID, row map[string]string) error {
	name := row["name"]
	if name == "" {
		return fmt.Errorf("name is required")
	}

	var parentID pgtype.UUID
	if parentName := row["parent_location"]; parentName != "" {
		parent, err := s.repo.GetLocationByName(ctx, workspaceID, parentName)
		if err != nil {
			return fmt.Errorf("failed to find parent location '%s': %w", parentName, err)
		}
		if parent != nil {
			parentID = pgtype.UUID{Bytes: parent.ID, Valid: true}
		}
	}

	_, err := s.repo.CreateLocation(ctx, queries.CreateLocationParams{
		ID:             uuid.New(),
		WorkspaceID:    workspaceID,
		Name:           name,
		ParentLocation: parentID,
		Zone:           stringToPtr(row["zone"]),
		Shelf:          stringToPtr(row["shelf"]),
		Bin:            stringToPtr(row["bin"]),
		Description:    stringToPtr(row["description"]),
		ShortCode:      stringToPtr(row["short_code"]),
	})
	return err
}

func (s *Service) importItem(ctx context.Context, workspaceID uuid.UUID, row map[string]string) error {
	name := row["name"]
	if name == "" {
		return fmt.Errorf("name is required")
	}

	var categoryID pgtype.UUID
	if catName := row["category_name"]; catName != "" {
		cat, err := s.repo.GetCategoryByName(ctx, workspaceID, catName)
		if err != nil {
			return fmt.Errorf("failed to find category '%s': %w", catName, err)
		}
		if cat != nil {
			categoryID = pgtype.UUID{Bytes: cat.ID, Valid: true}
		}
	}

	sku := row["sku"]
	if sku == "" {
		sku = fmt.Sprintf("SKU-%s", uuid.New().String()[:8])
	}

	_, err := s.repo.CreateItem(ctx, queries.CreateItemParams{
		ID:           uuid.New(),
		WorkspaceID:  workspaceID,
		Sku:          sku,
		Name:         name,
		Description:  stringToPtr(row["description"]),
		CategoryID:   categoryID,
		Brand:        stringToPtr(row["brand"]),
		Model:        stringToPtr(row["model"]),
		Manufacturer: stringToPtr(row["manufacturer"]),
		Barcode:      stringToPtr(row["barcode"]),
		ShortCode:    stringToPtr(row["short_code"]),
	})
	return err
}

func (s *Service) importContainer(ctx context.Context, workspaceID uuid.UUID, row map[string]string) error {
	name := row["name"]
	if name == "" {
		return fmt.Errorf("name is required")
	}

	locationName := row["location_name"]
	if locationName == "" {
		return fmt.Errorf("location_name is required")
	}

	location, err := s.repo.GetLocationByName(ctx, workspaceID, locationName)
	if err != nil {
		return fmt.Errorf("failed to find location '%s': %w", locationName, err)
	}
	if location == nil {
		return fmt.Errorf("location '%s' not found", locationName)
	}

	_, err = s.repo.CreateContainer(ctx, queries.CreateContainerParams{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		LocationID:  location.ID,
		Description: stringToPtr(row["description"]),
		Capacity:    stringToPtr(row["capacity"]),
		ShortCode:   stringToPtr(row["short_code"]),
	})
	return err
}

// Helper functions

func ptrToString(s *string) string {
	if s != nil {
		return *s
	}
	return ""
}

func ptrToBool(b *bool) bool {
	if b != nil {
		return *b
	}
	return false
}

func pgtimeToString(pt pgtype.Timestamptz) string {
	if pt.Valid {
		return pt.Time.Format(time.RFC3339)
	}
	return ""
}

func stringToPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
