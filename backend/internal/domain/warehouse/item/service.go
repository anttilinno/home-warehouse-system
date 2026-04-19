package item

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// generateShortCode generates a random 8-character alphanumeric code
func generateShortCode() string {
	b := make([]byte, 5) // 5 bytes = 40 bits, base32 encodes to 8 chars
	if _, err := rand.Read(b); err != nil {
		// crypto/rand.Read only fails if the OS PRNG is unavailable, which is
		// a catastrophic environment failure — panic is the correct response.
		panic("crypto/rand unavailable: " + err.Error())
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
}

// ServiceInterface defines the item service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Item, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error)
	List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error)
	ListFiltered(ctx context.Context, workspaceID uuid.UUID, filters ListFilters, pagination shared.Pagination) ([]*Item, int, error)
	ListNeedingReview(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Item, error)
	Archive(ctx context.Context, id, workspaceID uuid.UUID) error
	Restore(ctx context.Context, id, workspaceID uuid.UUID) error
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Item, error)
	ListByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*Item, error)
	LookupByBarcode(ctx context.Context, workspaceID uuid.UUID, code string) (*Item, error)
	AttachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error
	DetachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error
	GetItemLabels(ctx context.Context, itemID, workspaceID uuid.UUID) ([]uuid.UUID, error)
}

type Service struct {
	repo         Repository
	categoryRepo category.Repository
}

func NewService(repo Repository, categoryRepo category.Repository) *Service {
	return &Service{repo: repo, categoryRepo: categoryRepo}
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
	ShortCode         string // Optional - will be auto-generated if empty
	ObsidianVaultPath *string
	ObsidianNotePath  *string
	NeedsReview       *bool
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

	shortCode := input.ShortCode

	// Check short code uniqueness if provided, or auto-generate
	if shortCode != "" {
		exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, shortCode)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, ErrShortCodeTaken
		}
	} else {
		// Auto-generate short code if not provided
		const maxRetries = 5
		for i := 0; i < maxRetries; i++ {
			code := generateShortCode()
			exists, err := s.repo.ShortCodeExists(ctx, input.WorkspaceID, code)
			if err != nil {
				return nil, err
			}
			if !exists {
				shortCode = code
				break
			}
		}
		if shortCode == "" {
			return nil, ErrShortCodeTaken
		}
	}

	// Validate category belongs to the same workspace (if provided)
	if input.CategoryID != nil {
		if _, err := s.categoryRepo.FindByID(ctx, *input.CategoryID, input.WorkspaceID); err != nil {
			if shared.IsNotFound(err) {
				return nil, shared.NewFieldError(shared.ErrNotFound, "category_id", fmt.Sprintf("category %s not found in this workspace", *input.CategoryID))
			}
			return nil, err
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
	item.shortCode = shortCode
	item.obsidianVaultPath = input.ObsidianVaultPath
	item.obsidianNotePath = input.ObsidianNotePath
	if input.NeedsReview != nil && *input.NeedsReview {
		item.SetNeedsReview(true)
	}

	if err := s.repo.Save(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Item, error) {
	item, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		// Repository now returns shared.ErrNotFound instead of nil, nil
		return nil, err
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

// ListFiltered returns items matching the filter/sort/pagination params plus
// the true total count. Pass-through to Repository.FindByWorkspaceFiltered;
// the count is COUNT(*) not len(page).
func (s *Service) ListFiltered(ctx context.Context, workspaceID uuid.UUID, filters ListFilters, pagination shared.Pagination) ([]*Item, int, error) {
	return s.repo.FindByWorkspaceFiltered(ctx, workspaceID, filters, pagination)
}

// Delete hard-deletes an item after verifying workspace ownership.
// Returns ErrItemNotFound when the item does not belong to the workspace or
// does not exist. Unlike Borrower.Delete, items have no HasActiveLoans-style
// guard (D-04); FK cascades handle downstream rows.
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	if _, err := s.GetByID(ctx, id, workspaceID); err != nil {
		if errors.Is(err, shared.ErrNotFound) {
			return ErrItemNotFound
		}
		return err
	}
	return s.repo.Delete(ctx, id)
}

func (s *Service) ListNeedingReview(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Item, int, error) {
	return s.repo.FindNeedingReview(ctx, workspaceID, pagination)
}

func (s *Service) ListByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*Item, error) {
	return s.repo.FindByCategory(ctx, workspaceID, categoryID, pagination)
}

// LookupByBarcode returns the workspace item whose barcode column equals
// `code` exactly (case-sensitive via Postgres text equality; see G-65-01
// root cause — the FTS search_vector column does NOT cover barcode, so
// this path uses the dedicated FindByBarcode repo method which hits the
// ix_items_barcode btree index).
//
// Returns ErrItemNotFound when no row matches — the handler layer maps
// this sentinel to HTTP 404 (matches the GetByID convention). Normalises
// shared.ErrNotFound from the repo the same way Service.Delete does.
func (s *Service) LookupByBarcode(ctx context.Context, workspaceID uuid.UUID, code string) (*Item, error) {
	item, err := s.repo.FindByBarcode(ctx, workspaceID, code)
	if err != nil {
		if errors.Is(err, shared.ErrNotFound) {
			return nil, ErrItemNotFound
		}
		return nil, err
	}
	return item, nil
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
