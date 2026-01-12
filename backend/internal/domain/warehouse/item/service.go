package item

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	WorkspaceID       uuid.UUID
	SKU               string
	Name              string
	Description       *string
	CategoryID        *uuid.UUID
	Brand             *string
	Model             *string
	ImageURL          *string
	SerialNumber      *string
	Manufacturer      *string
	Barcode           *string
	IsInsured         *bool
	LifetimeWarranty  *bool
	WarrantyDetails   *string
	PurchasedFrom     *uuid.UUID
	MinStockLevel     int
	ShortCode         *string
	ObsidianVaultPath *string
	ObsidianNotePath  *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Item, error) {
	// Check SKU uniqueness
	exists, err := s.repo.SKUExists(ctx, input.WorkspaceID, input.SKU)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrSKUTaken
	}

	// Check short code uniqueness if provided
	if input.ShortCode != nil && *input.ShortCode != "" {
		exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, *input.ShortCode)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrShortCodeTaken
		}
	}

	item, err := NewItem(input.WorkspaceID, input.Name, input.SKU, input.MinStockLevel)
	if err != nil {
		return nil, err
	}

	// Set optional fields
	item.description = input.Description
	item.categoryID = input.CategoryID
	item.brand = input.Brand
	item.model = input.Model
	item.imageURL = input.ImageURL
	item.serialNumber = input.SerialNumber
	item.manufacturer = input.Manufacturer
	item.barcode = input.Barcode
	item.isInsured = input.IsInsured
	item.lifetimeWarranty = input.LifetimeWarranty
	item.warrantyDetails = input.WarrantyDetails
	item.purchasedFrom = input.PurchasedFrom
	item.shortCode = input.ShortCode
	item.obsidianVaultPath = input.ObsidianVaultPath
	item.obsidianNotePath = input.ObsidianNotePath

	if err := s.repo.Save(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error) {
	item, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, ErrItemNotFound
	}
	return item, nil
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Item, error) {
	item, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := item.Update(input); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	item, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	item.Archive()
	return s.repo.Save(ctx, item)
}

func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	item, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	item.Restore()
	return s.repo.Save(ctx, item)
}

func (s *Service) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Item, error) {
	if limit <= 0 {
		limit = 50 // Default limit
	}
	return s.repo.Search(ctx, workspaceID, query, limit)
}

func (s *Service) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, pagination)
}

func (s *Service) ListByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*Item, error) {
	return s.repo.FindByCategory(ctx, workspaceID, categoryID, pagination)
}

// AttachLabel attaches a label to an item.
func (s *Service) AttachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error {
	// Verify item exists
	_, err := s.GetByID(ctx, itemID, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.AttachLabel(ctx, itemID, labelID)
}

// DetachLabel removes a label from an item.
func (s *Service) DetachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error {
	// Verify item exists
	_, err := s.GetByID(ctx, itemID, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.DetachLabel(ctx, itemID, labelID)
}

// GetItemLabels returns the label IDs associated with an item.
func (s *Service) GetItemLabels(ctx context.Context, itemID, workspaceID uuid.UUID) ([]uuid.UUID, error) {
	// Verify item exists
	_, err := s.GetByID(ctx, itemID, workspaceID)
	if err != nil {
		return nil, err
	}

	return s.repo.GetItemLabels(ctx, itemID)
}
