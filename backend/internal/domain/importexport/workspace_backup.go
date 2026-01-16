package importexport

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/xuri/excelize/v2"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// WorkspaceBackupService handles full workspace backup and restore operations
type WorkspaceBackupService struct {
	queries *queries.Queries
}

// NewWorkspaceBackupService creates a new workspace backup service
func NewWorkspaceBackupService(q *queries.Queries) *WorkspaceBackupService {
	return &WorkspaceBackupService{queries: q}
}

// WorkspaceData contains all exportable workspace data
type WorkspaceData struct {
	Categories  []queries.WarehouseCategory  `json:"categories"`
	Labels      []queries.WarehouseLabel     `json:"labels"`
	Companies   []queries.WarehouseCompany   `json:"companies"`
	Locations   []queries.WarehouseLocation  `json:"locations"`
	Borrowers   []queries.WarehouseBorrower  `json:"borrowers"`
	Items       []queries.WarehouseItem      `json:"items"`
	Containers  []queries.WarehouseContainer `json:"containers"`
	Inventory   []queries.WarehouseInventory `json:"inventory"`
	Loans       []queries.WarehouseLoan      `json:"loans"`
	Attachments []queries.WarehouseAttachment `json:"attachments"`
}

// ExportWorkspace exports the entire workspace to Excel or JSON
func (s *WorkspaceBackupService) ExportWorkspace(ctx context.Context, workspaceID uuid.UUID, format Format, includeArchived bool, exportedBy uuid.UUID) (*WorkspaceBackupResult, error) {
	// Fetch all data
	data, err := s.fetchAllData(ctx, workspaceID, includeArchived)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch workspace data: %w", err)
	}

	// Generate file
	var fileData []byte
	var contentType string
	var filename string

	timestamp := time.Now().Format("2006-01-02_15-04-05")

	switch format {
	case FormatExcel:
		fileData, err = s.generateExcel(data)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Excel: %w", err)
		}
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		filename = fmt.Sprintf("workspace_backup_%s.xlsx", timestamp)

	case FormatJSON:
		fileData, err = json.MarshalIndent(data, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("failed to generate JSON: %w", err)
		}
		contentType = "application/json"
		filename = fmt.Sprintf("workspace_backup_%s.json", timestamp)

	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	// Calculate record counts
	recordCounts := map[string]int{
		"categories":  len(data.Categories),
		"labels":      len(data.Labels),
		"companies":   len(data.Companies),
		"locations":   len(data.Locations),
		"borrowers":   len(data.Borrowers),
		"items":       len(data.Items),
		"containers":  len(data.Containers),
		"inventory":   len(data.Inventory),
		"loans":       len(data.Loans),
		"attachments": len(data.Attachments),
	}

	totalRecords := 0
	for _, count := range recordCounts {
		totalRecords += count
	}

	// Create audit record
	exportID := uuid.New()
	recordCountsJSON, _ := json.Marshal(recordCounts)

	fileSizeBytes := int64(len(fileData))
	err = s.queries.CreateWorkspaceExport(ctx, queries.CreateWorkspaceExportParams{
		ID:           exportID,
		WorkspaceID:  workspaceID,
		ExportedBy:   pgtype.UUID{Bytes: exportedBy, Valid: true},
		Format:       string(format),
		RecordCounts: recordCountsJSON,
		FileSizeBytes: &fileSizeBytes,
	})
	if err != nil {
		// Log but don't fail
		fmt.Printf("Warning: failed to create audit record: %v\n", err)
	}

	return &WorkspaceBackupResult{
		Data:         fileData,
		Filename:     filename,
		ContentType:  contentType,
		RecordCounts: recordCounts,
		TotalRecords: totalRecords,
		ExportID:     exportID,
	}, nil
}

// fetchAllData retrieves all entities from the workspace
func (s *WorkspaceBackupService) fetchAllData(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) (*WorkspaceData, error) {
	data := &WorkspaceData{}
	var err error

	// Fetch all entity types
	data.Categories, err = s.queries.ListAllCategories(ctx, queries.ListAllCategoriesParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch categories: %w", err)
	}

	data.Labels, err = s.queries.ListAllLabels(ctx, queries.ListAllLabelsParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch labels: %w", err)
	}

	data.Companies, err = s.queries.ListAllCompanies(ctx, queries.ListAllCompaniesParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch companies: %w", err)
	}

	data.Locations, err = s.queries.ListAllLocations(ctx, queries.ListAllLocationsParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch locations: %w", err)
	}

	data.Borrowers, err = s.queries.ListAllBorrowers(ctx, queries.ListAllBorrowersParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch borrowers: %w", err)
	}

	data.Items, err = s.queries.ListAllItems(ctx, queries.ListAllItemsParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch items: %w", err)
	}

	data.Containers, err = s.queries.ListAllContainers(ctx, queries.ListAllContainersParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch containers: %w", err)
	}

	data.Inventory, err = s.queries.ListAllInventory(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch inventory: %w", err)
	}

	data.Loans, err = s.queries.ListAllLoans(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch loans: %w", err)
	}

	data.Attachments, err = s.queries.ListAllAttachments(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch attachments: %w", err)
	}

	return data, nil
}

// generateExcel creates an Excel file with multiple sheets
func (s *WorkspaceBackupService) generateExcel(data *WorkspaceData) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	// Delete default Sheet1
	f.DeleteSheet("Sheet1")

	// Create header style
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#D3D3D3"},
			Pattern: 1,
		},
		Border: []excelize.Border{
			{Type: "left", Color: "000000", Style: 1},
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create header style: %w", err)
	}

	// Create sheets for each entity type
	if err := s.createCategoriesSheet(f, data.Categories, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createLabelsSheet(f, data.Labels, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createCompaniesSheet(f, data.Companies, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createLocationsSheet(f, data.Locations, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createBorrowersSheet(f, data.Borrowers, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createItemsSheet(f, data.Items, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createContainersSheet(f, data.Containers, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createInventorySheet(f, data.Inventory, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createLoansSheet(f, data.Loans, headerStyle); err != nil {
		return nil, err
	}
	if err := s.createAttachmentsSheet(f, data.Attachments, headerStyle); err != nil {
		return nil, err
	}

	// Set first sheet as active
	f.SetActiveSheet(0)

	// Save to buffer
	buffer, err := f.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("failed to write Excel file: %w", err)
	}

	return buffer.Bytes(), nil
}

// formatTimestamp formats a timestamptz to RFC3339 string
func formatTimestamp(ts pgtype.Timestamptz) string {
	if ts.Valid {
		return ts.Time.Format(time.RFC3339)
	}
	return ""
}

// formatDate formats a date to RFC3339 string
func formatDate(d pgtype.Date) string {
	if d.Valid {
		return d.Time.Format("2006-01-02")
	}
	return ""
}

// createCategoriesSheet creates the Categories sheet
func (s *WorkspaceBackupService) createCategoriesSheet(f *excelize.File, categories []queries.WarehouseCategory, headerStyle int) error {
	sheetName := "Categories"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}
	if index == 0 {
		f.SetActiveSheet(index)
	}

	// Headers
	headers := []string{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	// Data
	for i, cat := range categories {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), cat.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), cat.Name)
		if cat.ParentCategoryID.Valid {
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), uuid.UUID(cat.ParentCategoryID.Bytes).String())
		}
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ptrToString(cat.Description))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), cat.IsArchived)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), formatTimestamp(cat.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), formatTimestamp(cat.UpdatedAt))
	}

	// Freeze first row
	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createLabelsSheet creates the Labels sheet
func (s *WorkspaceBackupService) createLabelsSheet(f *excelize.File, labels []queries.WarehouseLabel, headerStyle int) error {
	sheetName := "Labels"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Name", "Color", "Description", "Archived", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, label := range labels {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), label.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), label.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), ptrToString(label.Color))
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ptrToString(label.Description))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), label.IsArchived)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), formatTimestamp(label.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), formatTimestamp(label.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createCompaniesSheet creates the Companies sheet
func (s *WorkspaceBackupService) createCompaniesSheet(f *excelize.File, companies []queries.WarehouseCompany, headerStyle int) error {
	sheetName := "Companies"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Name", "Website", "Notes", "Archived", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, company := range companies {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), company.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), company.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), ptrToString(company.Website))
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ptrToString(company.Notes))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), company.IsArchived)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), formatTimestamp(company.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), formatTimestamp(company.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createLocationsSheet creates the Locations sheet
func (s *WorkspaceBackupService) createLocationsSheet(f *excelize.File, locations []queries.WarehouseLocation, headerStyle int) error {
	sheetName := "Locations"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Name", "Parent Location ID", "Zone", "Shelf", "Bin", "Description", "Short Code", "Archived", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, loc := range locations {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), loc.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), loc.Name)
		if loc.ParentLocation.Valid {
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), uuid.UUID(loc.ParentLocation.Bytes).String())
		}
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ptrToString(loc.Zone))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), ptrToString(loc.Shelf))
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), ptrToString(loc.Bin))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), ptrToString(loc.Description))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), ptrToString(loc.ShortCode))
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), loc.IsArchived)
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), formatTimestamp(loc.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), formatTimestamp(loc.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createBorrowersSheet creates the Borrowers sheet
func (s *WorkspaceBackupService) createBorrowersSheet(f *excelize.File, borrowers []queries.WarehouseBorrower, headerStyle int) error {
	sheetName := "Borrowers"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Name", "Email", "Phone", "Notes", "Archived", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, borrower := range borrowers {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), borrower.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), borrower.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), ptrToString(borrower.Email))
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ptrToString(borrower.Phone))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), ptrToString(borrower.Notes))
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), borrower.IsArchived)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), formatTimestamp(borrower.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), formatTimestamp(borrower.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createItemsSheet creates the Items sheet
func (s *WorkspaceBackupService) createItemsSheet(f *excelize.File, items []queries.WarehouseItem, headerStyle int) error {
	sheetName := "Items"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "SKU", "Name", "Description", "Category ID", "Brand", "Model", "Manufacturer", "Barcode", "Short Code", "Min Stock", "Archived", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, item := range items {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), item.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), item.Sku)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), item.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ptrToString(item.Description))
		if item.CategoryID.Valid {
			f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), uuid.UUID(item.CategoryID.Bytes).String())
		}
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), ptrToString(item.Brand))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), ptrToString(item.Model))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), ptrToString(item.Manufacturer))
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), ptrToString(item.Barcode))
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), ptrToString(item.ShortCode))
		f.SetCellValue(sheetName, fmt.Sprintf("K%d", row), item.MinStockLevel)
		f.SetCellValue(sheetName, fmt.Sprintf("L%d", row), ptrToBool(item.IsArchived))
		f.SetCellValue(sheetName, fmt.Sprintf("M%d", row), formatTimestamp(item.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("N%d", row), formatTimestamp(item.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createContainersSheet creates the Containers sheet
func (s *WorkspaceBackupService) createContainersSheet(f *excelize.File, containers []queries.WarehouseContainer, headerStyle int) error {
	sheetName := "Containers"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Name", "Location ID", "Description", "Capacity", "Short Code", "Archived", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, container := range containers {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), container.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), container.Name)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), container.LocationID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), ptrToString(container.Description))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), ptrToString(container.Capacity))
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), ptrToString(container.ShortCode))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), container.IsArchived)
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), formatTimestamp(container.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), formatTimestamp(container.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createInventorySheet creates the Inventory sheet
func (s *WorkspaceBackupService) createInventorySheet(f *excelize.File, inventory []queries.WarehouseInventory, headerStyle int) error {
	sheetName := "Inventory"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Item ID", "Location ID", "Container ID", "Quantity", "Condition", "Status", "Notes", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, inv := range inventory {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), inv.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), inv.ItemID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), inv.LocationID.String())
		if inv.ContainerID.Valid {
			f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), uuid.UUID(inv.ContainerID.Bytes).String())
		}
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), inv.Quantity)
		if inv.Condition.Valid {
			f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), string(inv.Condition.WarehouseItemConditionEnum))
		}
		if inv.Status.Valid {
			f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), string(inv.Status.WarehouseItemStatusEnum))
		}
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), ptrToString(inv.Notes))
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), formatTimestamp(inv.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), formatTimestamp(inv.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createLoansSheet creates the Loans sheet
func (s *WorkspaceBackupService) createLoansSheet(f *excelize.File, loans []queries.WarehouseLoan, headerStyle int) error {
	sheetName := "Loans"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Borrower ID", "Inventory ID", "Quantity", "Loaned At", "Due Date", "Returned At", "Notes", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, loan := range loans {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), loan.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), loan.BorrowerID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), loan.InventoryID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), loan.Quantity)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), formatTimestamp(loan.LoanedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), formatDate(loan.DueDate))
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), formatTimestamp(loan.ReturnedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), ptrToString(loan.Notes))
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), formatTimestamp(loan.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("J%d", row), formatTimestamp(loan.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createAttachmentsSheet creates the Attachments sheet
func (s *WorkspaceBackupService) createAttachmentsSheet(f *excelize.File, attachments []queries.WarehouseAttachment, headerStyle int) error {
	sheetName := "Attachments"
	_, err := f.NewSheet(sheetName)
	if err != nil {
		return err
	}

	headers := []string{"ID", "Item ID", "File ID", "Type", "Title", "Is Primary", "Docspell Item ID", "Created At", "Updated At"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, att := range attachments {
		row := i + 2
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), att.ID.String())
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), att.ItemID.String())
		if att.FileID.Valid {
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), uuid.UUID(att.FileID.Bytes).String())
		}
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), string(att.AttachmentType))
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), ptrToString(att.Title))
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), att.IsPrimary)
		f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), ptrToString(att.DocspellItemID))
		f.SetCellValue(sheetName, fmt.Sprintf("H%d", row), formatTimestamp(att.CreatedAt))
		f.SetCellValue(sheetName, fmt.Sprintf("I%d", row), formatTimestamp(att.UpdatedAt))
	}

	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})

	return nil
}
