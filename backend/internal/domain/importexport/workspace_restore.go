package importexport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

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
	inventoryMapping := make(map[string]uuid.UUID)

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
	locErrors := s.importLocations(ctx, workspaceID, workspaceData.Locations, locationMapping)
	result.Errors = append(result.Errors, locErrors...)

	// Import borrowers
	borrowerErrors := s.importBorrowers(ctx, workspaceID, workspaceData.Borrowers, borrowerMapping)
	result.Errors = append(result.Errors, borrowerErrors...)

	// Import items (needs category mapping)
	itemErrors := s.importItems(ctx, workspaceID, workspaceData.Items, categoryMapping, itemMapping)
	result.Errors = append(result.Errors, itemErrors...)

	// Import containers (needs location mapping)
	containerErrors := s.importContainers(ctx, workspaceID, workspaceData.Containers, locationMapping, containerMapping)
	result.Errors = append(result.Errors, containerErrors...)

	// Import inventory (needs item, location, container mappings)
	invErrors := s.importInventory(ctx, workspaceID, workspaceData.Inventory, itemMapping, locationMapping, containerMapping, inventoryMapping)
	result.Errors = append(result.Errors, invErrors...)

	// Import loans (needs inventory, borrower mappings)
	loanErrors := s.importLoans(ctx, workspaceID, workspaceData.Loans, inventoryMapping, borrowerMapping)
	result.Errors = append(result.Errors, loanErrors...)

	// Import attachments (needs item mapping)
	attErrors := s.importAttachments(ctx, workspaceID, workspaceData.Attachments, itemMapping)
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

// parseExcel parses Excel file into workspace data
func (s *WorkspaceBackupService) parseExcel(data []byte) (*WorkspaceData, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	workspaceData := &WorkspaceData{}

	// Parse Categories sheet
	if rows, err := f.GetRows("Categories"); err == nil && len(rows) > 1 {
		workspaceData.Categories = s.parseCategoriesFromRows(rows[1:]) // Skip header
	}

	// Parse Labels sheet
	if rows, err := f.GetRows("Labels"); err == nil && len(rows) > 1 {
		workspaceData.Labels = s.parseLabelsFromRows(rows[1:])
	}

	// Parse Companies sheet
	if rows, err := f.GetRows("Companies"); err == nil && len(rows) > 1 {
		workspaceData.Companies = s.parseCompaniesFromRows(rows[1:])
	}

	// Parse Locations sheet
	if rows, err := f.GetRows("Locations"); err == nil && len(rows) > 1 {
		workspaceData.Locations = s.parseLocationsFromRows(rows[1:])
	}

	// Parse Borrowers sheet
	if rows, err := f.GetRows("Borrowers"); err == nil && len(rows) > 1 {
		workspaceData.Borrowers = s.parseBorrowersFromRows(rows[1:])
	}

	// Parse Items sheet
	if rows, err := f.GetRows("Items"); err == nil && len(rows) > 1 {
		workspaceData.Items = s.parseItemsFromRows(rows[1:])
	}

	// Parse Containers sheet
	if rows, err := f.GetRows("Containers"); err == nil && len(rows) > 1 {
		workspaceData.Containers = s.parseContainersFromRows(rows[1:])
	}

	// Parse Inventory sheet
	if rows, err := f.GetRows("Inventory"); err == nil && len(rows) > 1 {
		workspaceData.Inventory = s.parseInventoryFromRows(rows[1:])
	}

	// Parse Loans sheet
	if rows, err := f.GetRows("Loans"); err == nil && len(rows) > 1 {
		workspaceData.Loans = s.parseLoansFromRows(rows[1:])
	}

	// Parse Attachments sheet
	if rows, err := f.GetRows("Attachments"); err == nil && len(rows) > 1 {
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
		loc.Zone = stringToPtr(getCellValue(row, 3))
		loc.Shelf = stringToPtr(getCellValue(row, 4))
		loc.Bin = stringToPtr(getCellValue(row, 5))
		loc.Description = stringToPtr(getCellValue(row, 6))
		loc.ShortCode = stringToPtr(getCellValue(row, 7))
		loc.IsArchived = getCellValue(row, 8) == "true"
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
		item.ShortCode = stringToPtr(getCellValue(row, 9))
		// Min stock level is in column 10
		isArchived := getCellValue(row, 11) == "true"
		item.IsArchived = &isArchived
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
		container.ShortCode = stringToPtr(getCellValue(row, 5))
		container.IsArchived = getCellValue(row, 6) == "true"
		containers = append(containers, container)
	}
	return containers
}

func (s *WorkspaceBackupService) parseInventoryFromRows(rows [][]string) []queries.WarehouseInventory {
	inventory := make([]queries.WarehouseInventory, 0, len(rows))
	for _, row := range rows {
		if len(row) < 5 {
			continue
		}
		inv := queries.WarehouseInventory{}
		if id, err := uuid.Parse(getCellValue(row, 0)); err == nil {
			inv.ID = id
		}
		if itemID := getCellValue(row, 1); itemID != "" {
			if id, err := uuid.Parse(itemID); err == nil {
				inv.ItemID = id
			}
		}
		if locationID := getCellValue(row, 2); locationID != "" {
			if id, err := uuid.Parse(locationID); err == nil {
				inv.LocationID = id
			}
		}
		if containerID := getCellValue(row, 3); containerID != "" {
			if id, err := uuid.Parse(containerID); err == nil {
				inv.ContainerID = pgtype.UUID{Bytes: id, Valid: true}
			}
		}
		// Quantity in column 4
		// Condition in column 5
		// Status in column 6
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
		// Quantity in column 3
		// Dates in columns 4-6
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
		// Type in column 3
		att.Title = stringToPtr(getCellValue(row, 4))
		isPrimary := getCellValue(row, 5) == "true"
		att.IsPrimary = &isPrimary
		att.DocspellItemID = stringToPtr(getCellValue(row, 6))
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
				Row:     0, // TODO: track row numbers
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

// importLocations imports locations with parent resolution
func (s *WorkspaceBackupService) importLocations(ctx context.Context, workspaceID uuid.UUID, locations []queries.WarehouseLocation, mapping map[string]uuid.UUID) []ImportError {
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
			Zone:        loc.Zone,
			Shelf:       loc.Shelf,
			Bin:         loc.Bin,
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
			Zone:           loc.Zone,
			Shelf:          loc.Shelf,
			Bin:            loc.Bin,
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
		}
	}

	return errors
}

// importBorrowers imports borrowers
func (s *WorkspaceBackupService) importBorrowers(ctx context.Context, workspaceID uuid.UUID, borrowers []queries.WarehouseBorrower, mapping map[string]uuid.UUID) []ImportError {
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
		}
	}

	return errors
}

// importItems imports items with category references
func (s *WorkspaceBackupService) importItems(ctx context.Context, workspaceID uuid.UUID, items []queries.WarehouseItem, categoryMapping map[string]uuid.UUID, itemMapping map[string]uuid.UUID) []ImportError {
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
			// The original category ID is stored, we need to skip for now
			// TODO: Implement proper category mapping
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
		}
	}

	return errors
}

// importContainers imports containers with location references
func (s *WorkspaceBackupService) importContainers(ctx context.Context, workspaceID uuid.UUID, containers []queries.WarehouseContainer, locationMapping map[string]uuid.UUID, containerMapping map[string]uuid.UUID) []ImportError {
	errors := make([]ImportError, 0)

	// Build location ID to name mapping (reverse lookup)
	locationIDToName := make(map[string]string)
	for name, id := range locationMapping {
		locationIDToName[id.String()] = name
	}

	for _, container := range containers {
		// The location ID in the export is the original ID
		// We need to find it in the mapping, but we don't have direct access
		// For now, skip location resolution - TODO: fix this
		locationID := container.LocationID

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
		}
	}

	return errors
}

// importInventory imports inventory records
func (s *WorkspaceBackupService) importInventory(ctx context.Context, workspaceID uuid.UUID, inventory []queries.WarehouseInventory, itemMapping, locationMapping, containerMapping map[string]uuid.UUID, inventoryMapping map[string]uuid.UUID) []ImportError {
	// TODO: Implement inventory import
	// This is complex because we need to resolve item, location, and container references
	return []ImportError{}
}

// importLoans imports loan records
func (s *WorkspaceBackupService) importLoans(ctx context.Context, workspaceID uuid.UUID, loans []queries.WarehouseLoan, inventoryMapping, borrowerMapping map[string]uuid.UUID) []ImportError {
	// TODO: Implement loan import
	return []ImportError{}
}

// importAttachments imports attachment records
func (s *WorkspaceBackupService) importAttachments(ctx context.Context, workspaceID uuid.UUID, attachments []queries.WarehouseAttachment, itemMapping map[string]uuid.UUID) []ImportError {
	// TODO: Implement attachment import
	return []ImportError{}
}
