package importexport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xuri/excelize/v2"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// ImportWorkspace imports workspace data from Excel or JSON file
func (s *WorkspaceBackupService) ImportWorkspace(ctx context.Context, workspaceID uuid.UUID, format Format, data []byte) (*ImportResult, error) {
	// Parse file
	var workspaceData *WorkspaceData
	var err error

	switch format {
	case FormatExcel:
		workspaceData, err = s.parseExcel(data)
	case FormatJSON:
		err = json.Unmarshal(data, &workspaceData)
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to parse import file: %w", err)
	}

	// Import in dependency order
	result := &ImportResult{
		Errors: make([]ImportError, 0),
	}

	// Track name-to-ID mappings for resolving references
	categoryMapping := make(map[string]uuid.UUID)
	locationMapping := make(map[string]uuid.UUID)
	borrowerMapping := make(map[string]uuid.UUID)
	itemMapping := make(map[string]uuid.UUID)
	containerMapping := make(map[string]uuid.UUID)

	// Maps original (file-supplied) IDs to the newly created IDs in the
	// target workspace. References that don't resolve through these maps are
	// rejected — file-supplied IDs must NEVER be inserted verbatim, or a
	// crafted backup could point at another tenant's rows.
	locationIDMapping := make(map[string]uuid.UUID)
	itemIDMapping := make(map[string]uuid.UUID)
	borrowerIDMapping := make(map[string]uuid.UUID)
	containerIDMapping := make(map[string]uuid.UUID)
	inventoryIDMapping := make(map[string]uuid.UUID)

	// Import categories (handle parent references in two passes)
	catErrors := s.importCategories(ctx, workspaceID, workspaceData.Categories, categoryMapping)
	result.Errors = append(result.Errors, catErrors...)

	// Import labels
	labelErrors := s.importLabels(ctx, workspaceID, workspaceData.Labels)
	result.Errors = append(result.Errors, labelErrors...)

	// Import companies
	companyErrors := s.importCompanies(ctx, workspaceID, workspaceData.Companies)
	result.Errors = append(result.Errors, companyErrors...)

	// Import locations (handle parent references in two passes)
	locErrors := s.importLocations(ctx, workspaceID, workspaceData.Locations, locationMapping, locationIDMapping)
	result.Errors = append(result.Errors, locErrors...)

	// Import borrowers
	borrowerErrors := s.importBorrowers(ctx, workspaceID, workspaceData.Borrowers, borrowerMapping, borrowerIDMapping)
	result.Errors = append(result.Errors, borrowerErrors...)

	// Import items (needs category mapping)
	itemErrors := s.importItems(ctx, workspaceID, workspaceData.Items, categoryMapping, itemMapping, itemIDMapping)
	result.Errors = append(result.Errors, itemErrors...)

	// Import containers (needs location mapping)
	containerErrors := s.importContainers(ctx, workspaceID, workspaceData.Containers, locationIDMapping, containerMapping, containerIDMapping)
	result.Errors = append(result.Errors, containerErrors...)

	// Import inventory (needs item, location, container ID mappings)
	invErrors := s.importInventory(ctx, workspaceID, workspaceData.Inventory, itemIDMapping, locationIDMapping, containerIDMapping, inventoryIDMapping)
	result.Errors = append(result.Errors, invErrors...)

	// Import loans (needs inventory, borrower ID mappings)
	loanErrors := s.importLoans(ctx, workspaceID, workspaceData.Loans, inventoryIDMapping, borrowerIDMapping)
	result.Errors = append(result.Errors, loanErrors...)

	// Import attachments (needs item ID mapping)
	attErrors := s.importAttachments(ctx, workspaceID, workspaceData.Attachments, itemIDMapping)
	result.Errors = append(result.Errors, attErrors...)

	// Calculate totals
	result.TotalRows = len(workspaceData.Categories) + len(workspaceData.Labels) +
		len(workspaceData.Companies) + len(workspaceData.Locations) +
		len(workspaceData.Borrowers) + len(workspaceData.Items) +
		len(workspaceData.Containers) + len(workspaceData.Inventory) +
		len(workspaceData.Loans) + len(workspaceData.Attachments)
	result.Failed = len(result.Errors)
	result.Succeeded = result.TotalRows - result.Failed

	return result, nil
}

const (
	// maxUnzipSizeBytes caps the total decompressed size of an uploaded xlsx
	// (decompression-bomb guard).
	maxUnzipSizeBytes = 512 << 20 // 512MB
	// maxUnzipXMLSizeBytes caps the decompressed size of a single xlsx XML part.
	maxUnzipXMLSizeBytes = 128 << 20 // 128MB
	// maxRowsPerSheet caps the number of rows processed per sheet.
	maxRowsPerSheet = 100_000
)

// getSheetRows reads a sheet's rows and enforces the per-sheet row cap.
// A missing sheet is not an error (returns nil rows).
func getSheetRows(f *excelize.File, sheet string) ([][]string, error) {
	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, nil // sheet missing or unreadable - treat as absent
	}
	if len(rows) > maxRowsPerSheet {
		return nil, fmt.Errorf("sheet %q has %d rows, exceeding the maximum of %d", sheet, len(rows), maxRowsPerSheet)
	}
	return rows, nil
}

// parseExcel parses Excel file into workspace data
func (s *WorkspaceBackupService) parseExcel(data []byte) (*WorkspaceData, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data), excelize.Options{
		UnzipSizeLimit:    maxUnzipSizeBytes,
		UnzipXMLSizeLimit: maxUnzipXMLSizeBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	workspaceData := &WorkspaceData{}

	// Parse Categories sheet
	if rows, err := getSheetRows(f, "Categories"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Categories = s.parseCategoriesFromRows(rows[1:]) // Skip header
	}

	// Parse Labels sheet
	if rows, err := getSheetRows(f, "Labels"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Labels = s.parseLabelsFromRows(rows[1:])
	}

	// Parse Companies sheet
	if rows, err := getSheetRows(f, "Companies"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Companies = s.parseCompaniesFromRows(rows[1:])
	}

	// Parse Locations sheet
	if rows, err := getSheetRows(f, "Locations"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Locations = s.parseLocationsFromRows(rows[1:])
	}

	// Parse Borrowers sheet
	if rows, err := getSheetRows(f, "Borrowers"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Borrowers = s.parseBorrowersFromRows(rows[1:])
	}

	// Parse Items sheet
	if rows, err := getSheetRows(f, "Items"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Items = s.parseItemsFromRows(rows[1:])
	}

	// Parse Containers sheet
	if rows, err := getSheetRows(f, "Containers"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Containers = s.parseContainersFromRows(rows[1:])
	}

	// Parse Inventory sheet
	if rows, err := getSheetRows(f, "Inventory"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Inventory = s.parseInventoryFromRows(rows[1:])
	}

	// Parse Loans sheet
	if rows, err := getSheetRows(f, "Loans"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Loans = s.parseLoansFromRows(rows[1:])
	}

	// Parse Attachments sheet
	if rows, err := getSheetRows(f, "Attachments"); err != nil {
		return nil, err
	} else if len(rows) > 1 {
		workspaceData.Attachments = s.parseAttachmentsFromRows(rows[1:])
	}

	return workspaceData, nil
}

// Parse functions for each entity type
func (s *WorkspaceBackupService) parseCategoriesFromRows(rows [][]string) []queries.WarehouseCategory {
	categories := make([]queries.WarehouseCategory, 0, len(rows))
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		cat := queries.WarehouseCategory{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			cat.ID = id
		}
		cat.Name = getCellValue(row, 1)
		if parentID := getCellValue(row, 2); parentID != "" {
			if id, err := uuid.Parse(parentID); err == nil {
				cat.ParentCategoryID = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		cat.Description = stringToPtr(getCellValue(row, 3))
		cat.IsArchived = getCellValue(row, 4) == "true"
		categories = append(categories, cat)
	}
	return categories
}

func (s *WorkspaceBackupService) parseLabelsFromRows(rows [][]string) []queries.WarehouseLabel {
	labels := make([]queries.WarehouseLabel, 0, len(rows))
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		label := queries.WarehouseLabel{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			label.ID = id
		}
		label.Name = getCellValue(row, 1)
		label.Color = stringToPtr(getCellValue(row, 2))
		label.Description = stringToPtr(getCellValue(row, 3))
		label.IsArchived = getCellValue(row, 4) == "true"
		labels = append(labels, label)
	}
	return labels
}

func (s *WorkspaceBackupService) parseCompaniesFromRows(rows [][]string) []queries.WarehouseCompany {
	companies := make([]queries.WarehouseCompany, 0, len(rows))
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		company := queries.WarehouseCompany{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			company.ID = id
		}
		company.Name = getCellValue(row, 1)
		company.Website = stringToPtr(getCellValue(row, 2))
		company.Notes = stringToPtr(getCellValue(row, 3))
		company.IsArchived = getCellValue(row, 4) == "true"
		companies = append(companies, company)
	}
	return companies
}

func (s *WorkspaceBackupService) parseLocationsFromRows(rows [][]string) []queries.WarehouseLocation {
	locations := make([]queries.WarehouseLocation, 0, len(rows))
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		loc := queries.WarehouseLocation{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			loc.ID = id
		}
		loc.Name = getCellValue(row, 1)
		if parentID := getCellValue(row, 2); parentID != "" {
			if id, err := uuid.Parse(parentID); err == nil {
				loc.ParentLocation = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		loc.Description = stringToPtr(getCellValue(row, 3))
		loc.ShortCode = getCellValue(row, 4)
		loc.IsArchived = getCellValue(row, 5) == "true"
		locations = append(locations, loc)
	}
	return locations
}

func (s *WorkspaceBackupService) parseBorrowersFromRows(rows [][]string) []queries.WarehouseBorrower {
	borrowers := make([]queries.WarehouseBorrower, 0, len(rows))
	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		borrower := queries.WarehouseBorrower{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			borrower.ID = id
		}
		borrower.Name = getCellValue(row, 1)
		borrower.Email = stringToPtr(getCellValue(row, 2))
		borrower.Phone = stringToPtr(getCellValue(row, 3))
		borrower.Notes = stringToPtr(getCellValue(row, 4))
		borrower.IsArchived = getCellValue(row, 5) == "true"
		borrowers = append(borrowers, borrower)
	}
	return borrowers
}

func (s *WorkspaceBackupService) parseItemsFromRows(rows [][]string) []queries.WarehouseItem {
	items := make([]queries.WarehouseItem, 0, len(rows))
	for _, row := range rows {
		if len(row) < 3 {
			continue
		}
		item := queries.WarehouseItem{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			item.ID = id
		}
		item.Sku = getCellValue(row, 1)
		item.Name = getCellValue(row, 2)
		item.Description = stringToPtr(getCellValue(row, 3))
		if categoryID := getCellValue(row, 4); categoryID != "" {
			if id, err := uuid.Parse(categoryID); err == nil {
				item.CategoryID = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		item.Brand = stringToPtr(getCellValue(row, 5))
		item.Model = stringToPtr(getCellValue(row, 6))
		item.Manufacturer = stringToPtr(getCellValue(row, 7))
		item.Barcode = stringToPtr(getCellValue(row, 8))
		item.ShortCode = getCellValue(row, 9)
		// Min stock level is in column 10
		item.IsArchived = getCellValue(row, 11) == "true"
		items = append(items, item)
	}
	return items
}

func (s *WorkspaceBackupService) parseContainersFromRows(rows [][]string) []queries.WarehouseContainer {
	containers := make([]queries.WarehouseContainer, 0, len(rows))
	for _, row := range rows {
		if len(row) < 3 {
			continue
		}
		container := queries.WarehouseContainer{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			container.ID = id
		}
		container.Name = getCellValue(row, 1)
		if locationID := getCellValue(row, 2); locationID != "" {
			if id, err := uuid.Parse(locationID); err == nil {
				container.LocationID = id
			}
		}
		container.Description = stringToPtr(getCellValue(row, 3))
		container.Capacity = stringToPtr(getCellValue(row, 4))
		container.ShortCode = getCellValue(row, 5)
		container.IsArchived = getCellValue(row, 6) == "true"
		containers = append(containers, container)
	}
	return containers
}

// parseOptionalUUID parses a cell into a UUID, reporting ok=false when the cell
// is empty or not a valid UUID (so the caller leaves its field at the default).
func parseOptionalUUID(cell string) (uuid.UUID, bool) {
	if cell == "" {
		return uuid.UUID{}, false
	}
	id, err := uuid.Parse(cell)
	if err != nil {
		return uuid.UUID{}, false
	}
	return id, true
}

func (s *WorkspaceBackupService) parseInventoryFromRows(rows [][]string) []queries.WarehouseInventory {
	inventory := make([]queries.WarehouseInventory, 0, len(rows))
	for _, row := range rows {
		if len(row) < 5 {
			continue
		}
		inv := queries.WarehouseInventory{}
		if id, ok := parseOptionalUUID(getCellValue(row, 0)); ok {
			inv.ID = id
		}
		if id, ok := parseOptionalUUID(getCellValue(row, 1)); ok {
			inv.ItemID = id
		}
		if id, ok := parseOptionalUUID(getCellValue(row, 2)); ok {
			inv.LocationID = id
		}
		if id, ok := parseOptionalUUID(getCellValue(row, 3)); ok {
			inv.ContainerID = pgtype.UUID{Bytes: id, Valid: true}
		}
		if qty, err := strconv.Atoi(getCellValue(row, 4)); err == nil {
			inv.Quantity = int32(qty)
		}
		if condition := getCellValue(row, 5); condition != "" {
			inv.Condition = queries.NullWarehouseItemConditionEnum{
				WarehouseItemConditionEnum: queries.WarehouseItemConditionEnum(condition),
				Valid:                      true,
			}
		}
		if status := getCellValue(row, 6); status != "" {
			inv.Status = queries.NullWarehouseItemStatusEnum{
				WarehouseItemStatusEnum: queries.WarehouseItemStatusEnum(status),
				Valid:                   true,
			}
		}
		inv.Notes = stringToPtr(getCellValue(row, 7))
		inventory = append(inventory, inv)
	}
	return inventory
}

func (s *WorkspaceBackupService) parseLoansFromRows(rows [][]string) []queries.WarehouseLoan {
	loans := make([]queries.WarehouseLoan, 0, len(rows))
	for _, row := range rows {
		if len(row) < 4 {
			continue
		}
		loan := queries.WarehouseLoan{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			loan.ID = id
		}
		if borrowerID := getCellValue(row, 1); borrowerID != "" {
			if id, err := uuid.Parse(borrowerID); err == nil {
				loan.BorrowerID = id
			}
		}
		if inventoryID := getCellValue(row, 2); inventoryID != "" {
			if id, err := uuid.Parse(inventoryID); err == nil {
				loan.InventoryID = id
			}
		}
		if qty, err := strconv.Atoi(getCellValue(row, 3)); err == nil {
			loan.Quantity = int32(qty)
		}
		loan.LoanedAt = parseTimestampCell(getCellValue(row, 4))
		loan.DueDate = parseDateCell(getCellValue(row, 5))
		loan.ReturnedAt = parseTimestampCell(getCellValue(row, 6))
		loan.Notes = stringToPtr(getCellValue(row, 7))
		loans = append(loans, loan)
	}
	return loans
}

func (s *WorkspaceBackupService) parseAttachmentsFromRows(rows [][]string) []queries.WarehouseAttachment {
	attachments := make([]queries.WarehouseAttachment, 0, len(rows))
	for _, row := range rows {
		if len(row) < 3 {
			continue
		}
		att := queries.WarehouseAttachment{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			att.ID = id
		}
		if itemID := getCellValue(row, 1); itemID != "" {
			if id, err := uuid.Parse(itemID); err == nil {
				att.ItemID = id
			}
		}
		if fileID := getCellValue(row, 2); fileID != "" {
			if id, err := uuid.Parse(fileID); err == nil {
				att.FileID = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		att.AttachmentType = queries.WarehouseAttachmentTypeEnum(getCellValue(row, 3))
		att.Title = stringToPtr(getCellValue(row, 4))
		isPrimary := getCellValue(row, 5) == "true"
		att.IsPrimary = &isPrimary
		att.ExternalDocID = stringToPtr(getCellValue(row, 6))
		attachments = append(attachments, att)
	}
	return attachments
}

// Helper function to safely get cell value
func getCellValue(row []string, index int) string {
	if index < len(row) {
		return row[index]
	}
	return ""
}

// parseTimestampCell parses an RFC3339 cell value (the counterpart of
// formatTimestamp on the export side). Empty or malformed values yield an
// invalid (NULL) timestamp.
func parseTimestampCell(value string) pgtype.Timestamptz {
	if value == "" {
		return pgtype.Timestamptz{}
	}
	ts, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: ts, Valid: true}
}

// parseDateCell parses a "2006-01-02" cell value (the counterpart of
// formatDate on the export side). Empty or malformed values yield an invalid
// (NULL) date.
func parseDateCell(value string) pgtype.Date {
	if value == "" {
		return pgtype.Date{}
	}
	d, err := time.Parse("2006-01-02", value)
	if err != nil {
		return pgtype.Date{}
	}
	return pgtype.Date{Time: d, Valid: true}
}

// importCategories imports categories with parent resolution
func (s *WorkspaceBackupService) importCategories(ctx context.Context, workspaceID uuid.UUID, categories []queries.WarehouseCategory, mapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	// Build name-to-original-ID mapping
	originalIDToName := make(map[string]string)
	for _, cat := range categories {
		originalIDToName[cat.ID.String()] = cat.Name
	}

	// Two-pass import: first without parents, then with parents
	// Pass 1: Import categories without parents
	for _, cat := range categories {
		if cat.ParentCategoryID.Valid {
			continue // Skip categories with parents in first pass
		}

		newID := uuid.New()
		_, err := s.queries.CreateCategory(ctx, queries.CreateCategoryParams{
			ID:          newID,
			WorkspaceID: workspaceID,
			Name:        cat.Name,
			Description: cat.Description,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0, // NOTE: per-row numbers not tracked here; restore is keyed by name, not source row
				Message: fmt.Sprintf("failed to import category '%s': %v", cat.Name, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			mapping[cat.Name] = newID
		}
	}

	// Pass 2: Import categories with parents
	for _, cat := range categories {
		if !cat.ParentCategoryID.Valid {
			continue // Skip categories without parents
		}

		parentName := originalIDToName[uuid.UUID(cat.ParentCategoryID.Bytes).String()]
		parentID, exists := mapping[parentName]
		if !exists {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("parent category '%s' not found for category '%s'", parentName, cat.Name),
				Code:    "PARENT_NOT_FOUND",
			})
			continue
		}

		newID := uuid.New()
		_, err := s.queries.CreateCategory(ctx, queries.CreateCategoryParams{
			ID:               newID,
			WorkspaceID:      workspaceID,
			Name:             cat.Name,
			ParentCategoryID: pgtype.UUID{Bytes: parentID, Valid: true},
			Description:      cat.Description,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import category '%s': %v", cat.Name, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			mapping[cat.Name] = newID
		}
	}

	return errors
}

// importLabels imports labels
func (s *WorkspaceBackupService) importLabels(ctx context.Context, workspaceID uuid.UUID, labels []queries.WarehouseLabel) []ImportError {
	errors := make([]ImportError, 0)

	for _, label := range labels {
		newID := uuid.New()
		_, err := s.queries.CreateLabel(ctx, queries.CreateLabelParams{
			ID:          newID,
			WorkspaceID: workspaceID,
			Name:        label.Name,
			Color:       label.Color,
			Description: label.Description,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import label '%s': %v", label.Name, err),
				Code:    "CREATE_FAILED",
			})
		}
	}

	return errors
}

// importCompanies imports companies
func (s *WorkspaceBackupService) importCompanies(ctx context.Context, workspaceID uuid.UUID, companies []queries.WarehouseCompany) []ImportError {
	errors := make([]ImportError, 0)

	for _, company := range companies {
		newID := uuid.New()
		_, err := s.queries.CreateCompany(ctx, queries.CreateCompanyParams{
			ID:          newID,
			WorkspaceID: workspaceID,
			Name:        company.Name,
			Website:     company.Website,
			Notes:       company.Notes,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import company '%s': %v", company.Name, err),
				Code:    "CREATE_FAILED",
			})
		}
	}

	return errors
}

// importLocations imports locations with parent resolution.
// idMapping records original-file-ID -> newly-created-ID so later entities
// (containers) can resolve their location references within this workspace.
func (s *WorkspaceBackupService) importLocations(ctx context.Context, workspaceID uuid.UUID, locations []queries.WarehouseLocation, mapping map[string]uuid.UUID, idMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	// Build name-to-original-ID mapping
	originalIDToName := make(map[string]string)
	for _, loc := range locations {
		originalIDToName[loc.ID.String()] = loc.Name
	}

	// Two-pass import: first without parents, then with parents
	// Pass 1: Import locations without parents
	for _, loc := range locations {
		if loc.ParentLocation.Valid {
			continue
		}

		newID := uuid.New()
		_, err := s.queries.CreateLocation(ctx, queries.CreateLocationParams{
			ID:          newID,
			WorkspaceID: workspaceID,
			Name:        loc.Name,
			Description: loc.Description,
			ShortCode:   loc.ShortCode,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import location '%s': %v", loc.Name, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			mapping[loc.Name] = newID
			idMapping[loc.ID.String()] = newID
		}
	}

	// Pass 2: Import locations with parents
	for _, loc := range locations {
		if !loc.ParentLocation.Valid {
			continue
		}

		parentName := originalIDToName[uuid.UUID(loc.ParentLocation.Bytes).String()]
		parentID, exists := mapping[parentName]
		if !exists {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("parent location '%s' not found for location '%s'", parentName, loc.Name),
				Code:    "PARENT_NOT_FOUND",
			})
			continue
		}

		newID := uuid.New()
		_, err := s.queries.CreateLocation(ctx, queries.CreateLocationParams{
			ID:             newID,
			WorkspaceID:    workspaceID,
			Name:           loc.Name,
			ParentLocation: pgtype.UUID{Bytes: parentID, Valid: true},
			Description:    loc.Description,
			ShortCode:      loc.ShortCode,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import location '%s': %v", loc.Name, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			mapping[loc.Name] = newID
			idMapping[loc.ID.String()] = newID
		}
	}

	return errors
}

// importBorrowers imports borrowers.
// idMapping records original-file-ID -> newly-created-ID so loans can resolve
// their borrower references within this workspace.
func (s *WorkspaceBackupService) importBorrowers(ctx context.Context, workspaceID uuid.UUID, borrowers []queries.WarehouseBorrower, mapping map[string]uuid.UUID, idMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	for _, borrower := range borrowers {
		newID := uuid.New()
		_, err := s.queries.CreateBorrower(ctx, queries.CreateBorrowerParams{
			ID:          newID,
			WorkspaceID: workspaceID,
			Name:        borrower.Name,
			Email:       borrower.Email,
			Phone:       borrower.Phone,
			Notes:       borrower.Notes,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import borrower '%s': %v", borrower.Name, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			mapping[borrower.Name] = newID
			idMapping[borrower.ID.String()] = newID
		}
	}

	return errors
}

// importItems imports items with category references.
// itemIDMapping records original-file-ID -> newly-created-ID so inventory and
// attachments can resolve their item references within this workspace.
func (s *WorkspaceBackupService) importItems(ctx context.Context, workspaceID uuid.UUID, items []queries.WarehouseItem, categoryMapping map[string]uuid.UUID, itemMapping map[string]uuid.UUID, itemIDMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	// Build category ID to name mapping (reverse lookup)
	categoryIDToName := make(map[string]string)
	for name, id := range categoryMapping {
		categoryIDToName[id.String()] = name
	}

	for _, item := range items {
		newID := uuid.New()

		var categoryID pgtype.UUID
		if item.CategoryID.Valid {
			// NOTE: original category ID is intentionally dropped here; proper
			// category remapping across workspaces is deferred. Items restore
			// uncategorized rather than pointing at a stale/foreign category.
			categoryID = pgtype.UUID{Valid: false}
		}

		_, err := s.queries.CreateItem(ctx, queries.CreateItemParams{
			ID:            newID,
			WorkspaceID:   workspaceID,
			Sku:           item.Sku,
			Name:          item.Name,
			Description:   item.Description,
			CategoryID:    categoryID,
			Brand:         item.Brand,
			Model:         item.Model,
			Manufacturer:  item.Manufacturer,
			Barcode:       item.Barcode,
			ShortCode:     item.ShortCode,
			MinStockLevel: item.MinStockLevel,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import item '%s': %v", item.Name, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			itemMapping[item.Name] = newID
			itemIDMapping[item.ID.String()] = newID
		}
	}

	return errors
}

// importContainers imports containers with location references.
// locationIDMapping maps original (file-supplied) location IDs to the IDs
// created in the target workspace by importLocations. The file-supplied
// location_id is NEVER inserted verbatim: an unresolvable reference (e.g. a
// crafted backup pointing at another tenant's location) is rejected with a
// clean ImportError instead of relying on the composite-FK constraint to 500.
// containerIDMapping records original-file-ID -> newly-created-ID so inventory
// can resolve its container references within this workspace.
func (s *WorkspaceBackupService) importContainers(ctx context.Context, workspaceID uuid.UUID, containers []queries.WarehouseContainer, locationIDMapping map[string]uuid.UUID, containerMapping map[string]uuid.UUID, containerIDMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	for _, container := range containers {
		locationID, ok := locationIDMapping[container.LocationID.String()]
		if !ok {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("container '%s' references location %s that is not part of this backup; skipped", container.Name, container.LocationID),
				Code:    "LOCATION_NOT_FOUND",
			})
			continue
		}

		newID := uuid.New()
		_, err := s.queries.CreateContainer(ctx, queries.CreateContainerParams{
			ID:          newID,
			WorkspaceID: workspaceID,
			Name:        container.Name,
			LocationID:  locationID,
			Description: container.Description,
			Capacity:    container.Capacity,
			ShortCode:   container.ShortCode,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import container '%s': %v", container.Name, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			containerMapping[container.Name] = newID
			containerIDMapping[container.ID.String()] = newID
		}
	}

	return errors
}

// importInventory imports inventory records with item/location/container
// references. All references are resolved through the original-ID -> new-ID
// mappings recorded by importItems/importLocations/importContainers. The
// file-supplied IDs are NEVER inserted verbatim: an unresolvable reference
// (e.g. a crafted backup pointing at another tenant's rows) is rejected with
// a clean ImportError instead of relying on the composite-FK constraint.
// inventoryIDMapping records original-file-ID -> newly-created-ID so loans
// can resolve their inventory references.
func (s *WorkspaceBackupService) importInventory(ctx context.Context, workspaceID uuid.UUID, inventory []queries.WarehouseInventory, itemIDMapping, locationIDMapping, containerIDMapping map[string]uuid.UUID, inventoryIDMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	for _, inv := range inventory {
		itemID, ok := itemIDMapping[inv.ItemID.String()]
		if !ok {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("inventory %s references item %s that is not part of this backup; skipped", inv.ID, inv.ItemID),
				Code:    "ITEM_NOT_FOUND",
			})
			continue
		}

		locationID, ok := locationIDMapping[inv.LocationID.String()]
		if !ok {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("inventory %s references location %s that is not part of this backup; skipped", inv.ID, inv.LocationID),
				Code:    "LOCATION_NOT_FOUND",
			})
			continue
		}

		// Container is optional: resolve when present, NULL when absent.
		containerID := pgtype.UUID{Valid: false}
		if inv.ContainerID.Valid {
			originalContainerID := uuid.UUID(inv.ContainerID.Bytes)
			newContainerID, ok := containerIDMapping[originalContainerID.String()]
			if !ok {
				errors = append(errors, ImportError{
					Row:     0,
					Message: fmt.Sprintf("inventory %s references container %s that is not part of this backup; skipped", inv.ID, originalContainerID),
					Code:    "CONTAINER_NOT_FOUND",
				})
				continue
			}
			containerID = pgtype.UUID{Bytes: newContainerID, Valid: true}
		}

		newID := uuid.New()
		_, err := s.queries.CreateInventory(ctx, queries.CreateInventoryParams{
			ID:              newID,
			WorkspaceID:     workspaceID,
			ItemID:          itemID,
			LocationID:      locationID,
			ContainerID:     containerID,
			Quantity:        inv.Quantity,
			Condition:       inv.Condition,
			Status:          inv.Status,
			DateAcquired:    inv.DateAcquired,
			PurchasePrice:   inv.PurchasePrice,
			CurrencyCode:    inv.CurrencyCode,
			WarrantyExpires: inv.WarrantyExpires,
			ExpirationDate:  inv.ExpirationDate,
			Notes:           inv.Notes,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import inventory %s: %v", inv.ID, err),
				Code:    "CREATE_FAILED",
			})
		} else {
			inventoryIDMapping[inv.ID.String()] = newID
		}
	}

	return errors
}

// importLoans imports loan records with inventory/borrower references
// resolved through the original-ID -> new-ID mappings (never inserted
// verbatim — see importInventory for the tenant-safety rationale).
// Note: CreateLoan cannot set returned_at (and ReturnLoan stamps now()), so
// already-returned loans are restored without their returned_at timestamp.
func (s *WorkspaceBackupService) importLoans(ctx context.Context, workspaceID uuid.UUID, loans []queries.WarehouseLoan, inventoryIDMapping, borrowerIDMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	for _, loan := range loans {
		inventoryID, ok := inventoryIDMapping[loan.InventoryID.String()]
		if !ok {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("loan %s references inventory %s that is not part of this backup; skipped", loan.ID, loan.InventoryID),
				Code:    "INVENTORY_NOT_FOUND",
			})
			continue
		}

		borrowerID, ok := borrowerIDMapping[loan.BorrowerID.String()]
		if !ok {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("loan %s references borrower %s that is not part of this backup; skipped", loan.ID, loan.BorrowerID),
				Code:    "BORROWER_NOT_FOUND",
			})
			continue
		}

		newID := uuid.New()
		_, err := s.queries.CreateLoan(ctx, queries.CreateLoanParams{
			ID:          newID,
			WorkspaceID: workspaceID,
			InventoryID: inventoryID,
			BorrowerID:  borrowerID,
			Quantity:    loan.Quantity,
			LoanedAt:    loan.LoanedAt,
			DueDate:     loan.DueDate,
			Notes:       loan.Notes,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import loan %s: %v", loan.ID, err),
				Code:    "CREATE_FAILED",
			})
		}
	}

	return errors
}

// importAttachments imports attachment records with item references resolved
// through the original-ID -> new-ID mapping (never inserted verbatim — see
// importInventory for the tenant-safety rationale).
// file_id is always restored as NULL: warehouse.files rows (the binary
// payloads) are not part of the backup, so the file-supplied file_id can
// never resolve here. Inserting it verbatim could attach another tenant's
// file via the file_id FK to warehouse.files.
func (s *WorkspaceBackupService) importAttachments(ctx context.Context, workspaceID uuid.UUID, attachments []queries.WarehouseAttachment, itemIDMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	for _, att := range attachments {
		itemID, ok := itemIDMapping[att.ItemID.String()]
		if !ok {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("attachment %s references item %s that is not part of this backup; skipped", att.ID, att.ItemID),
				Code:    "ITEM_NOT_FOUND",
			})
			continue
		}

		// attachment_type is a NOT NULL enum; default rows with a missing
		// type to OTHER instead of failing the insert.
		attachmentType := att.AttachmentType
		if attachmentType == "" {
			attachmentType = queries.WarehouseAttachmentTypeEnumOTHER
		}

		newID := uuid.New()
		// external_doc_id and dms_type are NULL-paired in the schema; restored
		// external references are Paperless documents (the only supported DMS).
		var dmsType *string
		if att.ExternalDocID != nil {
			t := "paperless"
			dmsType = &t
		}
		_, err := s.queries.CreateAttachment(ctx, queries.CreateAttachmentParams{
			ID:             newID,
			WorkspaceID:    workspaceID,
			ItemID:         itemID,
			FileID:         pgtype.UUID{Valid: false},
			AttachmentType: attachmentType,
			Title:          att.Title,
			IsPrimary:      att.IsPrimary,
			ExternalDocID:  att.ExternalDocID,
			DmsType:        dmsType,
		})

		if err != nil {
			errors = append(errors, ImportError{
				Row:     0,
				Message: fmt.Sprintf("failed to import attachment %s: %v", att.ID, err),
				Code:    "CREATE_FAILED",
			})
		}
	}

	return errors
}
