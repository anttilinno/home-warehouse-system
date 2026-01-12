package item_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
)

func TestNewItem(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		name          string
		workspaceID   uuid.UUID
		itemName      string
		sku           string
		minStockLevel int
		wantErr       bool
		errMsg        string
	}{
		{
			name:          "valid item with all required fields",
			workspaceID:   workspaceID,
			itemName:      "Laptop",
			sku:           "LAP-001",
			minStockLevel: 5,
			wantErr:       false,
		},
		{
			name:          "valid item with zero min stock",
			workspaceID:   workspaceID,
			itemName:      "Mouse",
			sku:           "MSE-001",
			minStockLevel: 0,
			wantErr:       false,
		},
		{
			name:          "missing item name",
			workspaceID:   workspaceID,
			itemName:      "",
			sku:           "LAP-001",
			minStockLevel: 0,
			wantErr:       true,
			errMsg:        "name",
		},
		{
			name:          "missing SKU",
			workspaceID:   workspaceID,
			itemName:      "Laptop",
			sku:           "",
			minStockLevel: 0,
			wantErr:       true,
			errMsg:        "sku",
		},
		{
			name:          "negative min stock level",
			workspaceID:   workspaceID,
			itemName:      "Laptop",
			sku:           "LAP-001",
			minStockLevel: -1,
			wantErr:       true,
			errMsg:        "minimum stock level",
		},
		{
			name:          "nil workspace ID",
			workspaceID:   uuid.Nil,
			itemName:      "Laptop",
			sku:           "LAP-001",
			minStockLevel: 0,
			wantErr:       true,
			errMsg:        "workspace_id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item, err := item.NewItem(tt.workspaceID, tt.itemName, tt.sku, tt.minStockLevel)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, item)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, item)
				assert.Equal(t, tt.workspaceID, item.WorkspaceID())
				assert.Equal(t, tt.itemName, item.Name())
				assert.Equal(t, tt.sku, item.SKU())
				assert.Equal(t, tt.minStockLevel, item.MinStockLevel())
				assert.NotEqual(t, uuid.Nil, item.ID())
				assert.NotZero(t, item.CreatedAt())
				assert.NotZero(t, item.UpdatedAt())
				// Verify default boolean values
				assert.NotNil(t, item.IsInsured())
				assert.False(t, *item.IsInsured())
				assert.NotNil(t, item.IsArchived())
				assert.False(t, *item.IsArchived())
				assert.NotNil(t, item.LifetimeWarranty())
				assert.False(t, *item.LifetimeWarranty())
			}
		})
	}
}

func TestItem_Update(t *testing.T) {
	workspaceID := uuid.New()

	tests := []struct {
		name    string
		update  item.UpdateInput
		wantErr bool
		errMsg  string
	}{
		{
			name: "update name",
			update: item.UpdateInput{
				Name:          "Updated Name",
				MinStockLevel: 5,
			},
			wantErr: false,
		},
		{
			name: "update description",
			update: item.UpdateInput{
				Name:          "Item Name",
				Description:   strPtr("New description"),
				MinStockLevel: 5,
			},
			wantErr: false,
		},
		{
			name: "update brand and model",
			update: item.UpdateInput{
				Name:          "Item Name",
				Brand:         strPtr("Apple"),
				Model:         strPtr("MacBook Pro 16"),
				MinStockLevel: 5,
			},
			wantErr: false,
		},
		{
			name: "update min stock level",
			update: item.UpdateInput{
				Name:          "Item Name",
				MinStockLevel: 10,
			},
			wantErr: false,
		},
		{
			name: "update to empty name",
			update: item.UpdateInput{
				Name:          "",
				MinStockLevel: 5,
			},
			wantErr: true,
			errMsg:  "name",
		},
		{
			name: "negative min stock level",
			update: item.UpdateInput{
				Name:          "Item Name",
				MinStockLevel: -1,
			},
			wantErr: true,
			errMsg:  "minimum stock level",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh item for each test
			item, _ := item.NewItem(workspaceID, "Original Name", "ORIG-001", 5)
			originalUpdatedAt := item.UpdatedAt()

			err := item.Update(tt.update)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.update.Name, item.Name())
				if tt.update.Description != nil {
					assert.Equal(t, tt.update.Description, item.Description())
				}
				if tt.update.Brand != nil {
					assert.Equal(t, tt.update.Brand, item.Brand())
				}
				if tt.update.Model != nil {
					assert.Equal(t, tt.update.Model, item.Model())
				}
				assert.Equal(t, tt.update.MinStockLevel, item.MinStockLevel())
				// Verify updated_at was changed
				assert.True(t, item.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestItem_SetSKU(t *testing.T) {
	workspaceID := uuid.New()
	testItem, err := item.NewItem(workspaceID, "Test Item", "ORIG-001", 0)
	assert.NoError(t, err)

	originalUpdatedAt := testItem.UpdatedAt()
	newSKU := "NEW-001"

	testItem.SetSKU(newSKU)

	assert.Equal(t, newSKU, testItem.SKU())
	assert.True(t, testItem.UpdatedAt().After(originalUpdatedAt))
}

func TestItem_SetShortCode(t *testing.T) {
	workspaceID := uuid.New()
	testItem, err := item.NewItem(workspaceID, "Test Item", "TEST-001", 0)
	assert.NoError(t, err)

	assert.Nil(t, testItem.ShortCode())

	shortCode := "ABC123"
	testItem.SetShortCode(shortCode)

	assert.NotNil(t, testItem.ShortCode())
	assert.Equal(t, shortCode, *testItem.ShortCode())
}

func TestItem_Archive(t *testing.T) {
	workspaceID := uuid.New()
	testItem, err := item.NewItem(workspaceID, "Test Item", "TEST-001", 0)
	assert.NoError(t, err)

	// Initially not archived
	assert.False(t, *testItem.IsArchived())

	originalUpdatedAt := testItem.UpdatedAt()
	testItem.Archive()

	assert.NotNil(t, testItem.IsArchived())
	assert.True(t, *testItem.IsArchived())
	assert.True(t, testItem.UpdatedAt().After(originalUpdatedAt))
}

func TestItem_Restore(t *testing.T) {
	workspaceID := uuid.New()
	testItem, err := item.NewItem(workspaceID, "Test Item", "TEST-001", 0)
	assert.NoError(t, err)

	// Archive first
	testItem.Archive()
	assert.True(t, *testItem.IsArchived())

	originalUpdatedAt := testItem.UpdatedAt()
	testItem.Restore()

	assert.NotNil(t, testItem.IsArchived())
	assert.False(t, *testItem.IsArchived())
	assert.True(t, testItem.UpdatedAt().After(originalUpdatedAt))
}

func TestItem_ObsidianURI(t *testing.T) {
	workspaceID := uuid.New()
	testItem, err := item.NewItem(workspaceID, "Test Item", "TEST-001", 0)
	assert.NoError(t, err)

	t.Run("no vault or note path set", func(t *testing.T) {
		uri := testItem.ObsidianURI()
		assert.Nil(t, uri)
	})

	t.Run("only vault path set", func(t *testing.T) {
		vaultPath := "MyVault"
		err := testItem.Update(item.UpdateInput{
			Name:              "Test Item",
			ObsidianVaultPath: &vaultPath,
			MinStockLevel:     0,
		})
		assert.NoError(t, err)

		uri := testItem.ObsidianURI()
		assert.Nil(t, uri)
	})

	t.Run("both vault and note path set", func(t *testing.T) {
		vaultPath := "MyVault"
		notePath := "items/test-item.md"
		err := testItem.Update(item.UpdateInput{
			Name:              "Test Item",
			ObsidianVaultPath: &vaultPath,
			ObsidianNotePath:  &notePath,
			MinStockLevel:     0,
		})
		assert.NoError(t, err)

		uri := testItem.ObsidianURI()
		assert.NotNil(t, uri)
		assert.Contains(t, *uri, "obsidian://open")
		assert.Contains(t, *uri, "vault=MyVault")
		assert.Contains(t, *uri, "file=items%2Ftest-item.md")
	})

	t.Run("paths with special characters", func(t *testing.T) {
		vaultPath := "My Vault"
		notePath := "items/test item.md"
		err := testItem.Update(item.UpdateInput{
			Name:              "Test Item",
			ObsidianVaultPath: &vaultPath,
			ObsidianNotePath:  &notePath,
			MinStockLevel:     0,
		})
		assert.NoError(t, err)

		uri := testItem.ObsidianURI()
		assert.NotNil(t, uri)
		assert.Contains(t, *uri, "My%20Vault")
		assert.Contains(t, *uri, "test%20item.md")
	})

	t.Run("empty strings", func(t *testing.T) {
		emptyVault := ""
		emptyNote := ""
		err := testItem.Update(item.UpdateInput{
			Name:              "Test Item",
			ObsidianVaultPath: &emptyVault,
			ObsidianNotePath:  &emptyNote,
			MinStockLevel:     0,
		})
		assert.NoError(t, err)

		uri := testItem.ObsidianURI()
		assert.Nil(t, uri)
	})
}

func TestItem_Getters(t *testing.T) {
	workspaceID := uuid.New()
	categoryID := uuid.New()
	description := "Test description"
	brand := "Apple"
	model := "MacBook Pro"
	imageURL := "https://example.com/image.jpg"
	serialNumber := "SN123456"
	manufacturer := "Apple Inc."
	barcode := "1234567890"
	trueVal := true
	warrantyDetails := "5 year warranty"
	shortCode := "ABC123"
	vaultPath := "MyVault"
	notePath := "items/test.md"

	testItem, err := item.NewItem(workspaceID, "Test Item", "TEST-001", 5)
	assert.NoError(t, err)

	// Update with optional fields
	err = testItem.Update(item.UpdateInput{
		Name:             "Test Item",
		Description:      &description,
		CategoryID:       &categoryID,
		Brand:            &brand,
		Model:            &model,
		ImageURL:         &imageURL,
		SerialNumber:     &serialNumber,
		Manufacturer:     &manufacturer,
		Barcode:          &barcode,
		IsInsured:        &trueVal,
		LifetimeWarranty: &trueVal,
		WarrantyDetails:  &warrantyDetails,
		MinStockLevel:    5,
		ObsidianVaultPath: &vaultPath,
		ObsidianNotePath:  &notePath,
	})
	assert.NoError(t, err)
	testItem.SetShortCode(shortCode)

	// Test all getters
	assert.Equal(t, workspaceID, testItem.WorkspaceID())
	assert.Equal(t, "TEST-001", testItem.SKU())
	assert.Equal(t, "Test Item", testItem.Name())
	assert.Equal(t, &description, testItem.Description())
	assert.Equal(t, &categoryID, testItem.CategoryID())
	assert.Equal(t, &brand, testItem.Brand())
	assert.Equal(t, &model, testItem.Model())
	assert.Equal(t, &imageURL, testItem.ImageURL())
	assert.Equal(t, &serialNumber, testItem.SerialNumber())
	assert.Equal(t, &manufacturer, testItem.Manufacturer())
	assert.Equal(t, &barcode, testItem.Barcode())
	assert.Equal(t, &trueVal, testItem.IsInsured())
	assert.Equal(t, &trueVal, testItem.LifetimeWarranty())
	assert.Equal(t, &warrantyDetails, testItem.WarrantyDetails())
	assert.Equal(t, 5, testItem.MinStockLevel())
	assert.Equal(t, &shortCode, testItem.ShortCode())
	assert.Equal(t, &vaultPath, testItem.ObsidianVaultPath())
	assert.Equal(t, &notePath, testItem.ObsidianNotePath())
	assert.NotZero(t, testItem.CreatedAt())
	assert.NotZero(t, testItem.UpdatedAt())
}

func TestItem_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	categoryID := uuid.New()
	description := "Test description"
	brand := "Apple"
	model := "MacBook Pro"
	imageURL := "https://example.com/image.jpg"
	serialNumber := "SN123456"
	manufacturer := "Apple Inc."
	barcode := "1234567890"
	trueVal := true
	falseVal := false
	warrantyDetails := "5 year warranty"
	purchasedFrom := uuid.New()
	shortCode := "ABC123"
	vaultPath := "MyVault"
	notePath := "items/test.md"

	now := time.Now()
	reconstructed := item.Reconstruct(
		id,
		workspaceID,
		"TEST-001",
		"Test Item",
		&description,
		&categoryID,
		&brand,
		&model,
		&imageURL,
		&serialNumber,
		&manufacturer,
		&barcode,
		&trueVal,
		&falseVal,
		&trueVal,
		&warrantyDetails,
		&purchasedFrom,
		5,
		&shortCode,
		&vaultPath,
		&notePath,
		now,
		now,
	)

	assert.NotNil(t, reconstructed)
	assert.Equal(t, id, reconstructed.ID())
	assert.Equal(t, workspaceID, reconstructed.WorkspaceID())
	assert.Equal(t, "TEST-001", reconstructed.SKU())
	assert.Equal(t, "Test Item", reconstructed.Name())
	assert.Equal(t, &description, reconstructed.Description())
	assert.Equal(t, &categoryID, reconstructed.CategoryID())
	assert.Equal(t, &brand, reconstructed.Brand())
	assert.Equal(t, &model, reconstructed.Model())
	assert.Equal(t, &imageURL, reconstructed.ImageURL())
	assert.Equal(t, &serialNumber, reconstructed.SerialNumber())
	assert.Equal(t, &manufacturer, reconstructed.Manufacturer())
	assert.Equal(t, &barcode, reconstructed.Barcode())
	assert.Equal(t, &trueVal, reconstructed.IsInsured())
	assert.Equal(t, &falseVal, reconstructed.IsArchived())
	assert.Equal(t, &trueVal, reconstructed.LifetimeWarranty())
	assert.Equal(t, &warrantyDetails, reconstructed.WarrantyDetails())
	assert.Equal(t, &purchasedFrom, reconstructed.PurchasedFrom())
	assert.Equal(t, 5, reconstructed.MinStockLevel())
	assert.Equal(t, &shortCode, reconstructed.ShortCode())
	assert.Equal(t, &vaultPath, reconstructed.ObsidianVaultPath())
	assert.Equal(t, &notePath, reconstructed.ObsidianNotePath())
}

// Helper function
func strPtr(s string) *string {
	return &s
}
