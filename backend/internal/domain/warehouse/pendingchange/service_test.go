package pendingchange

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ---------------------------------------------------------------------------
// Mocks: pending-change repository, member/user repositories
// ---------------------------------------------------------------------------

type MockPendingChangeRepository struct{ mock.Mock }

func (m *MockPendingChangeRepository) Save(ctx context.Context, change *PendingChange) error {
	return m.Called(ctx, change).Error(0)
}

func (m *MockPendingChangeRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*PendingChange, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*PendingChange), args.Error(1)
}

func (m *MockPendingChangeRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, status *Status) ([]*PendingChange, error) {
	args := m.Called(ctx, workspaceID, status)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*PendingChange), args.Error(1)
}

func (m *MockPendingChangeRepository) FindByRequester(ctx context.Context, requesterID uuid.UUID, status *Status) ([]*PendingChange, error) {
	args := m.Called(ctx, requesterID, status)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*PendingChange), args.Error(1)
}

func (m *MockPendingChangeRepository) FindByEntity(ctx context.Context, workspaceID uuid.UUID, entityType string, entityID uuid.UUID) ([]*PendingChange, error) {
	args := m.Called(ctx, entityType, entityID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*PendingChange), args.Error(1)
}

func (m *MockPendingChangeRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id).Error(0)
}

type MockMemberRepository struct{ mock.Mock }

func (m *MockMemberRepository) Save(ctx context.Context, mem *member.Member) error {
	return m.Called(ctx, mem).Error(0)
}

func (m *MockMemberRepository) FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (*member.Member, error) {
	args := m.Called(ctx, workspaceID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*member.Member), args.Error(1)
}

func (m *MockMemberRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*member.Member, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*member.Member), args.Error(1)
}

func (m *MockMemberRepository) Delete(ctx context.Context, workspaceID, userID uuid.UUID) error {
	return m.Called(ctx, workspaceID, userID).Error(0)
}

func (m *MockMemberRepository) CountOwners(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockMemberRepository) Exists(ctx context.Context, workspaceID, userID uuid.UUID) (bool, error) {
	args := m.Called(ctx, workspaceID, userID)
	return args.Bool(0), args.Error(1)
}

type MockUserRepository struct{ mock.Mock }

func (m *MockUserRepository) Save(ctx context.Context, u *user.User) error {
	return m.Called(ctx, u).Error(0)
}

func (m *MockUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepository) List(ctx context.Context, pagination shared.Pagination) ([]*user.User, int, error) {
	args := m.Called(ctx, pagination)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*user.User), args.Int(1), args.Error(2)
}

func (m *MockUserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return m.Called(ctx, id).Error(0)
}

func (m *MockUserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	args := m.Called(ctx, email)
	return args.Bool(0), args.Error(1)
}

func (m *MockUserRepository) UpdateAvatar(ctx context.Context, id uuid.UUID, path *string) (*user.User, error) {
	args := m.Called(ctx, id, path)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepository) UpdateEmail(ctx context.Context, id uuid.UUID, email string) (*user.User, error) {
	args := m.Called(ctx, id, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepository) GetSoleOwnerWorkspaces(ctx context.Context, userID uuid.UUID) ([]user.BlockingWorkspace, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]user.BlockingWorkspace), args.Error(1)
}

// ---------------------------------------------------------------------------
// Mocks: per-entity domain service interfaces
//
// Only the methods used by the approval pipeline (Create / Update / Delete)
// carry mock.Called bodies; the remaining interface methods are stubs so the
// mocks satisfy the full ServiceInterface.
// ---------------------------------------------------------------------------

type MockItemService struct{ mock.Mock }

func (m *MockItemService) Create(ctx context.Context, input item.CreateInput) (*item.Item, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}
func (m *MockItemService) Update(ctx context.Context, id, workspaceID uuid.UUID, input item.UpdateInput) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}
func (m *MockItemService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id, workspaceID).Error(0)
}
func (m *MockItemService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
	return nil, nil
}
func (m *MockItemService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	return nil, 0, nil
}
func (m *MockItemService) ListFiltered(ctx context.Context, workspaceID uuid.UUID, filters item.ListFilters, pagination shared.Pagination) ([]*item.Item, int, error) {
	return nil, 0, nil
}
func (m *MockItemService) ListNeedingReview(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	return nil, 0, nil
}
func (m *MockItemService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error { return nil }
func (m *MockItemService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error { return nil }
func (m *MockItemService) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*item.Item, error) {
	return nil, nil
}
func (m *MockItemService) ListByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*item.Item, error) {
	return nil, nil
}
func (m *MockItemService) LookupByBarcode(ctx context.Context, workspaceID uuid.UUID, code string) (*item.Item, error) {
	return nil, nil
}
func (m *MockItemService) AttachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockItemService) DetachLabel(ctx context.Context, itemID, labelID, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockItemService) GetItemLabels(ctx context.Context, itemID, workspaceID uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}

type MockCategoryService struct{ mock.Mock }

func (m *MockCategoryService) Create(ctx context.Context, input category.CreateInput) (*category.Category, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*category.Category), args.Error(1)
}
func (m *MockCategoryService) Update(ctx context.Context, id, workspaceID uuid.UUID, input category.UpdateInput) (*category.Category, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*category.Category), args.Error(1)
}
func (m *MockCategoryService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id, workspaceID).Error(0)
}
func (m *MockCategoryService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*category.Category, error) {
	return nil, nil
}
func (m *MockCategoryService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockCategoryService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockCategoryService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	return nil, nil
}
func (m *MockCategoryService) ListByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*category.Category, error) {
	return nil, nil
}
func (m *MockCategoryService) ListRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	return nil, nil
}
func (m *MockCategoryService) GetBreadcrumb(ctx context.Context, categoryID, workspaceID uuid.UUID) ([]category.BreadcrumbItem, error) {
	return nil, nil
}

type MockLocationService struct{ mock.Mock }

func (m *MockLocationService) Create(ctx context.Context, input location.CreateInput) (*location.Location, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}
func (m *MockLocationService) Update(ctx context.Context, id, workspaceID uuid.UUID, input location.UpdateInput) (*location.Location, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}
func (m *MockLocationService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id, workspaceID).Error(0)
}
func (m *MockLocationService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*location.Location, error) {
	return nil, nil
}
func (m *MockLocationService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*location.Location], error) {
	return nil, nil
}
func (m *MockLocationService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockLocationService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockLocationService) GetBreadcrumb(ctx context.Context, locationID, workspaceID uuid.UUID) ([]location.BreadcrumbItem, error) {
	return nil, nil
}
func (m *MockLocationService) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*location.Location, error) {
	return nil, nil
}

type MockContainerService struct{ mock.Mock }

func (m *MockContainerService) Create(ctx context.Context, input container.CreateInput) (*container.Container, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*container.Container), args.Error(1)
}
func (m *MockContainerService) Update(ctx context.Context, id, workspaceID uuid.UUID, input container.UpdateInput) (*container.Container, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*container.Container), args.Error(1)
}
func (m *MockContainerService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id, workspaceID).Error(0)
}
func (m *MockContainerService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*container.Container, error) {
	return nil, nil
}
func (m *MockContainerService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*container.Container], error) {
	return nil, nil
}
func (m *MockContainerService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockContainerService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockContainerService) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*container.Container, error) {
	return nil, nil
}

type MockInventoryService struct{ mock.Mock }

func (m *MockInventoryService) Create(ctx context.Context, input inventory.CreateInput) (*inventory.Inventory, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}
func (m *MockInventoryService) Update(ctx context.Context, id, workspaceID uuid.UUID, input inventory.UpdateInput) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}
func (m *MockInventoryService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) UpdateStatus(ctx context.Context, id, workspaceID uuid.UUID, status inventory.Status) (*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) UpdateQuantity(ctx context.Context, id, workspaceID uuid.UUID, quantity int) (*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) Move(ctx context.Context, id, workspaceID, locationID uuid.UUID, containerID *uuid.UUID) (*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockInventoryService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockInventoryService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*inventory.Inventory, int, error) {
	return nil, 0, nil
}
func (m *MockInventoryService) ListByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) ListByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) ListByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) GetAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryService) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	return 0, nil
}
func (m *MockInventoryService) ListExpiring(ctx context.Context, workspaceID uuid.UUID, withinDays int) ([]inventory.ExpiringInventory, error) {
	return nil, nil
}

type MockBorrowerService struct{ mock.Mock }

func (m *MockBorrowerService) Create(ctx context.Context, input borrower.CreateInput) (*borrower.Borrower, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*borrower.Borrower), args.Error(1)
}
func (m *MockBorrowerService) Update(ctx context.Context, id, workspaceID uuid.UUID, input borrower.UpdateInput) (*borrower.Borrower, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*borrower.Borrower), args.Error(1)
}
func (m *MockBorrowerService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id, workspaceID).Error(0)
}
func (m *MockBorrowerService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*borrower.Borrower, error) {
	return nil, nil
}
func (m *MockBorrowerService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockBorrowerService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	return nil
}
func (m *MockBorrowerService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination, includeArchived bool) ([]*borrower.Borrower, int, error) {
	return nil, 0, nil
}
func (m *MockBorrowerService) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*borrower.Borrower, error) {
	return nil, nil
}

type MockLoanService struct{ mock.Mock }

func (m *MockLoanService) Create(ctx context.Context, input loan.CreateInput) (*loan.Loan, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}
func (m *MockLoanService) Update(ctx context.Context, id, workspaceID uuid.UUID, dueDate *time.Time, notes *string) (*loan.Loan, error) {
	args := m.Called(ctx, id, workspaceID, dueDate, notes)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}
func (m *MockLoanService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanService) Return(ctx context.Context, id, workspaceID uuid.UUID) (*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanService) ExtendDueDate(ctx context.Context, id, workspaceID uuid.UUID, newDueDate time.Time) (*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanService) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, int, error) {
	return nil, 0, nil
}
func (m *MockLoanService) ListByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanService) ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanService) ListByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanService) GetActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanService) GetOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}

type MockLabelService struct{ mock.Mock }

func (m *MockLabelService) Create(ctx context.Context, input label.CreateInput) (*label.Label, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*label.Label), args.Error(1)
}
func (m *MockLabelService) Update(ctx context.Context, id, workspaceID uuid.UUID, input label.UpdateInput) (*label.Label, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*label.Label), args.Error(1)
}
func (m *MockLabelService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id, workspaceID).Error(0)
}
func (m *MockLabelService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*label.Label, error) {
	return nil, nil
}
func (m *MockLabelService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*label.Label, error) {
	return nil, nil
}
func (m *MockLabelService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error { return nil }
func (m *MockLabelService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error { return nil }

// Repository mocks used only for the inventory/loan delete paths.

type MockInventoryRepository struct{ mock.Mock }

func (m *MockInventoryRepository) Save(ctx context.Context, inv *inventory.Inventory) error {
	return m.Called(ctx, inv).Error(0)
}
func (m *MockInventoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*inventory.Inventory, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*inventory.Inventory), args.Error(1)
}
func (m *MockInventoryRepository) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*inventory.Inventory, int, error) {
	return nil, 0, nil
}
func (m *MockInventoryRepository) FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryRepository) FindByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryRepository) FindAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	return nil, nil
}
func (m *MockInventoryRepository) FindExpiring(ctx context.Context, workspaceID uuid.UUID, withinDays int) ([]inventory.ExpiringInventory, error) {
	return nil, nil
}
func (m *MockInventoryRepository) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	return 0, nil
}
func (m *MockInventoryRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return m.Called(ctx, id).Error(0)
}

type MockLoanRepository struct{ mock.Mock }

func (m *MockLoanRepository) Save(ctx context.Context, l *loan.Loan) error {
	return m.Called(ctx, l).Error(0)
}
func (m *MockLoanRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*loan.Loan, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*loan.Loan), args.Error(1)
}
func (m *MockLoanRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, int, error) {
	return nil, 0, nil
}
func (m *MockLoanRepository) FindByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanRepository) FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanRepository) FindActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanRepository) FindOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanRepository) FindActiveLoanForInventory(ctx context.Context, inventoryID uuid.UUID) (*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanRepository) GetTotalLoanedQuantity(ctx context.Context, inventoryID uuid.UUID) (int, error) {
	return 0, nil
}
func (m *MockLoanRepository) FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanRepository) Update(ctx context.Context, loanID, workspaceID uuid.UUID, setDueDate bool, dueDate *time.Time, setNotes bool, notes *string) (*loan.Loan, error) {
	return nil, nil
}
func (m *MockLoanRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return m.Called(ctx, id).Error(0)
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

type testMocks struct {
	repo          *MockPendingChangeRepository
	memberRepo    *MockMemberRepository
	userRepo      *MockUserRepository
	itemSvc       *MockItemService
	categorySvc   *MockCategoryService
	locationSvc   *MockLocationService
	containerSvc  *MockContainerService
	inventorySvc  *MockInventoryService
	inventoryRepo *MockInventoryRepository
	borrowerSvc   *MockBorrowerService
	loanSvc       *MockLoanService
	loanRepo      *MockLoanRepository
	labelSvc      *MockLabelService
}

func newMocks() *testMocks {
	return &testMocks{
		repo:          new(MockPendingChangeRepository),
		memberRepo:    new(MockMemberRepository),
		userRepo:      new(MockUserRepository),
		itemSvc:       new(MockItemService),
		categorySvc:   new(MockCategoryService),
		locationSvc:   new(MockLocationService),
		containerSvc:  new(MockContainerService),
		inventorySvc:  new(MockInventoryService),
		inventoryRepo: new(MockInventoryRepository),
		borrowerSvc:   new(MockBorrowerService),
		loanSvc:       new(MockLoanService),
		loanRepo:      new(MockLoanRepository),
		labelSvc:      new(MockLabelService),
	}
}

func (tm *testMocks) service() *Service {
	return NewService(
		tm.repo,
		tm.memberRepo,
		tm.userRepo,
		tm.itemSvc,
		tm.categorySvc,
		tm.locationSvc,
		tm.containerSvc,
		tm.inventorySvc,
		tm.inventoryRepo,
		tm.borrowerSvc,
		tm.loanSvc,
		tm.loanRepo,
		tm.labelSvc,
		nil, // Transactor: nil -> noopTransactor (synchronous, no real tx in unit tests)
		nil, // broadcaster
	)
}

func ownerMember(workspaceID, userID uuid.UUID) *member.Member {
	return member.Reconstruct(uuid.New(), workspaceID, userID, member.RoleOwner, nil, time.Now(), time.Now())
}

func adminMember(workspaceID, userID uuid.UUID) *member.Member {
	return member.Reconstruct(uuid.New(), workspaceID, userID, member.RoleAdmin, nil, time.Now(), time.Now())
}

func memberMember(workspaceID, userID uuid.UUID) *member.Member {
	return member.Reconstruct(uuid.New(), workspaceID, userID, member.RoleMember, nil, time.Now(), time.Now())
}

func pendingChange(id, workspaceID, requesterID uuid.UUID, entityType string, entityID *uuid.UUID, action Action, payload string) *PendingChange {
	return Reconstruct(id, workspaceID, requesterID, entityType, entityID, action, json.RawMessage(payload), StatusPending, nil, nil, nil, time.Now(), time.Now())
}

// stubReviewerLookups wires the SSE user lookups used after a successful approval.
func stubReviewerLookups(tm *testMocks, ctx context.Context, requesterID, reviewerID uuid.UUID) {
	requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
	reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")
	tm.userRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil).Maybe()
	tm.userRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil).Maybe()
}

// ---------------------------------------------------------------------------
// CreatePendingChange
// ---------------------------------------------------------------------------

func TestCreatePendingChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()

	t.Run("creates and saves a pending change", func(t *testing.T) {
		tm := newMocks()
		tm.repo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		change, err := tm.service().CreatePendingChange(ctx, workspaceID, requesterID, "item", nil, ActionCreate, json.RawMessage(`{"name":"x"}`))

		assert.NoError(t, err)
		assert.NotNil(t, change)
		assert.Equal(t, StatusPending, change.Status())
		tm.repo.AssertExpectations(t)
	})

	t.Run("rejects unsupported entity type", func(t *testing.T) {
		tm := newMocks()
		_, err := tm.service().CreatePendingChange(ctx, workspaceID, requesterID, "photo", nil, ActionCreate, json.RawMessage(`{}`))
		assert.ErrorIs(t, err, ErrInvalidEntityType)
	})

	t.Run("propagates repository save error", func(t *testing.T) {
		tm := newMocks()
		tm.repo.On("Save", ctx, mock.Anything).Return(errors.New("db down"))
		_, err := tm.service().CreatePendingChange(ctx, workspaceID, requesterID, "item", nil, ActionCreate, json.RawMessage(`{"name":"x"}`))
		assert.Error(t, err)
	})
}

// ---------------------------------------------------------------------------
// ApproveChange
// ---------------------------------------------------------------------------

func TestApproveChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	approveExpectSave := func(tm *testMocks, pc *PendingChange) {
		// FindByID is called once outside the tx (permission check) and once inside.
		tm.repo.On("FindByID", ctx, changeID).Return(pc, nil)
		tm.repo.On("Save", ctx, mock.MatchedBy(func(c *PendingChange) bool {
			return c.Status() == StatusApproved && c.ReviewedBy() != nil
		})).Return(nil)
	}

	t.Run("approves item-create with owner role and applies via service", func(t *testing.T) {
		tm := newMocks()
		pc := pendingChange(changeID, workspaceID, requesterID, "item", nil, ActionCreate, `{"name":"Test Item","sku":"TEST-001","min_stock_level":5}`)
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember(workspaceID, reviewerID), nil)
		stubReviewerLookups(tm, ctx, requesterID, reviewerID)
		approveExpectSave(tm, pc)
		createdItem, _ := item.NewItem(workspaceID, "Test Item", "TEST-001", 5)
		tm.itemSvc.On("Create", ctx, mock.MatchedBy(func(in item.CreateInput) bool {
			return in.Name == "Test Item" && in.SKU == "TEST-001" && in.MinStockLevel == 5 && in.WorkspaceID == workspaceID
		})).Return(createdItem, nil)

		err := tm.service().ApproveChange(ctx, changeID, workspaceID, reviewerID)
		assert.NoError(t, err)
		tm.itemSvc.AssertExpectations(t)
		tm.repo.AssertExpectations(t)
	})

	t.Run("approves with admin role", func(t *testing.T) {
		tm := newMocks()
		pc := pendingChange(changeID, workspaceID, requesterID, "label", nil, ActionCreate, `{"name":"Fragile"}`)
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(adminMember(workspaceID, reviewerID), nil)
		stubReviewerLookups(tm, ctx, requesterID, reviewerID)
		approveExpectSave(tm, pc)
		tm.labelSvc.On("Create", ctx, mock.Anything).Return(&label.Label{}, nil)

		err := tm.service().ApproveChange(ctx, changeID, workspaceID, reviewerID)
		assert.NoError(t, err)
		tm.labelSvc.AssertExpectations(t)
	})

	t.Run("rejects non-reviewer (member role)", func(t *testing.T) {
		tm := newMocks()
		pc := pendingChange(changeID, workspaceID, requesterID, "item", nil, ActionCreate, `{"name":"x","sku":"s","min_stock_level":0}`)
		tm.repo.On("FindByID", ctx, changeID).Return(pc, nil)
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(memberMember(workspaceID, reviewerID), nil)

		err := tm.service().ApproveChange(ctx, changeID, workspaceID, reviewerID)
		assert.ErrorIs(t, err, ErrUnauthorized)
		tm.itemSvc.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
	})

	t.Run("returns error when change not found", func(t *testing.T) {
		tm := newMocks()
		tm.repo.On("FindByID", ctx, changeID).Return(nil, errors.New("not found"))
		err := tm.service().ApproveChange(ctx, changeID, workspaceID, reviewerID)
		assert.Error(t, err)
	})

	t.Run("idempotent: already-approved change is a no-op (no re-apply)", func(t *testing.T) {
		tm := newMocks()
		// First fetch (permission check) sees pending; in-tx re-fetch sees approved.
		pendingPC := pendingChange(changeID, workspaceID, requesterID, "item", nil, ActionCreate, `{"name":"x","sku":"s","min_stock_level":0}`)
		reviewed := uuid.New()
		now := time.Now()
		approvedPC := Reconstruct(changeID, workspaceID, requesterID, "item", nil, ActionCreate, json.RawMessage(`{"name":"x"}`), StatusApproved, &reviewed, &now, nil, now, now)

		tm.repo.On("FindByID", ctx, changeID).Return(pendingPC, nil).Once()
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember(workspaceID, reviewerID), nil)
		tm.repo.On("FindByID", ctx, changeID).Return(approvedPC, nil).Once()

		err := tm.service().ApproveChange(ctx, changeID, workspaceID, reviewerID)
		assert.NoError(t, err)
		// Idempotency: no apply, no Save, no SSE side effects.
		tm.itemSvc.AssertNotCalled(t, "Create", mock.Anything, mock.Anything)
		tm.repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
	})

	t.Run("apply failure rolls back (Save not reached)", func(t *testing.T) {
		tm := newMocks()
		pc := pendingChange(changeID, workspaceID, requesterID, "item", nil, ActionCreate, `{"name":"Bad","sku":"S","min_stock_level":0}`)
		tm.repo.On("FindByID", ctx, changeID).Return(pc, nil)
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember(workspaceID, reviewerID), nil)
		tm.itemSvc.On("Create", ctx, mock.Anything).Return(nil, errors.New("validation failed"))

		err := tm.service().ApproveChange(ctx, changeID, workspaceID, reviewerID)
		assert.Error(t, err)
		// Because apply failed inside the tx, the approved change is never persisted.
		tm.repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
	})
}

// ---------------------------------------------------------------------------
// RejectChange
// ---------------------------------------------------------------------------

func TestRejectChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("rejects with reason", func(t *testing.T) {
		tm := newMocks()
		pc := pendingChange(changeID, workspaceID, requesterID, "item", nil, ActionCreate, `{"name":"x"}`)
		tm.repo.On("FindByID", ctx, changeID).Return(pc, nil)
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember(workspaceID, reviewerID), nil)
		stubReviewerLookups(tm, ctx, requesterID, reviewerID)
		tm.repo.On("Save", ctx, mock.MatchedBy(func(c *PendingChange) bool {
			return c.Status() == StatusRejected
		})).Return(nil)

		err := tm.service().RejectChange(ctx, changeID, workspaceID, reviewerID, "duplicate")
		assert.NoError(t, err)
		tm.repo.AssertExpectations(t)
	})

	t.Run("requires a non-empty reason", func(t *testing.T) {
		tm := newMocks()
		pc := pendingChange(changeID, workspaceID, requesterID, "item", nil, ActionCreate, `{"name":"x"}`)
		tm.repo.On("FindByID", ctx, changeID).Return(pc, nil)
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember(workspaceID, reviewerID), nil)
		stubReviewerLookups(tm, ctx, requesterID, reviewerID)

		err := tm.service().RejectChange(ctx, changeID, workspaceID, reviewerID, "")
		assert.Error(t, err)
	})

	t.Run("rejects non-reviewer", func(t *testing.T) {
		tm := newMocks()
		pc := pendingChange(changeID, workspaceID, requesterID, "item", nil, ActionCreate, `{"name":"x"}`)
		tm.repo.On("FindByID", ctx, changeID).Return(pc, nil)
		tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(memberMember(workspaceID, reviewerID), nil)

		err := tm.service().RejectChange(ctx, changeID, workspaceID, reviewerID, "no")
		assert.ErrorIs(t, err, ErrUnauthorized)
	})
}

// ---------------------------------------------------------------------------
// ListPendingForWorkspace
// ---------------------------------------------------------------------------

func TestListPendingForWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("lists pending changes", func(t *testing.T) {
		tm := newMocks()
		status := StatusPending
		tm.repo.On("FindByWorkspace", ctx, workspaceID, &status).Return([]*PendingChange{}, nil)
		out, err := tm.service().ListPendingForWorkspace(ctx, workspaceID)
		assert.NoError(t, err)
		assert.NotNil(t, out)
	})

	t.Run("propagates error", func(t *testing.T) {
		tm := newMocks()
		status := StatusPending
		tm.repo.On("FindByWorkspace", ctx, workspaceID, &status).Return(nil, errors.New("boom"))
		_, err := tm.service().ListPendingForWorkspace(ctx, workspaceID)
		assert.Error(t, err)
	})
}

// ---------------------------------------------------------------------------
// NewService / isValidEntityType
// ---------------------------------------------------------------------------

func TestNewService(t *testing.T) {
	tm := newMocks()
	svc := tm.service()
	assert.NotNil(t, svc)
	assert.NotNil(t, svc.tx, "tx defaults to noopTransactor when nil is passed")
}

func TestServiceIsValidEntityType(t *testing.T) {
	svc := &Service{}
	for _, et := range []string{"item", "category", "location", "container", "inventory", "borrower", "loan", "label"} {
		assert.True(t, svc.isValidEntityType(et), et)
	}
	for _, et := range []string{"invalid", "user", "workspace", "member", "", "ITEM", "photo", "attachment"} {
		assert.False(t, svc.isValidEntityType(et), et)
	}
}

// ---------------------------------------------------------------------------
// apply* handlers — exercised through ApproveChange so the full transactional
// path is covered. Each verifies the correct domain service method is invoked
// with the workspace-scoped arguments.
// ---------------------------------------------------------------------------

type applyCase struct {
	name       string
	entityType string
	action     Action
	withEntity bool
	payload    string
	// expect wires the service-method expectation and returns the mock to assert.
	expect func(tm *testMocks, ctx context.Context, workspaceID, entityID uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool }
}

func runApply(t *testing.T, c applyCase) {
	t.Helper()
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()
	entityID := uuid.New()

	tm := newMocks()
	var eid *uuid.UUID
	if c.withEntity {
		eid = &entityID
	}
	pc := pendingChange(changeID, workspaceID, requesterID, c.entityType, eid, c.action, c.payload)

	tm.repo.On("FindByID", ctx, changeID).Return(pc, nil)
	tm.memberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember(workspaceID, reviewerID), nil)
	stubReviewerLookups(tm, ctx, requesterID, reviewerID)
	tm.repo.On("Save", ctx, mock.Anything).Return(nil)

	asserter := c.expect(tm, ctx, workspaceID, entityID)

	err := tm.service().ApproveChange(ctx, changeID, workspaceID, reviewerID)
	assert.NoError(t, err)
	asserter.AssertExpectations(t)
}

func TestApplyItemChange(t *testing.T) {
	created, _ := item.NewItem(uuid.New(), "n", "s", 0)
	runApply(t, applyCase{
		name: "create", entityType: "item", action: ActionCreate,
		payload: `{"name":"Widget","sku":"W1","min_stock_level":2,"description":"d","barcode":"b"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.itemSvc.On("Create", ctx, mock.MatchedBy(func(in item.CreateInput) bool {
				return in.WorkspaceID == ws && in.Name == "Widget" && in.SKU == "W1" &&
					in.Description != nil && *in.Description == "d" &&
					in.Barcode != nil && *in.Barcode == "b"
			})).Return(created, nil)
			return tm.itemSvc
		},
	})
	runApply(t, applyCase{
		name: "update", entityType: "item", action: ActionUpdate, withEntity: true,
		payload: `{"name":"New Name"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.itemSvc.On("Update", ctx, eid, ws, mock.AnythingOfType("item.UpdateInput")).Return(created, nil)
			return tm.itemSvc
		},
	})
	runApply(t, applyCase{
		name: "delete", entityType: "item", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.itemSvc.On("Delete", ctx, eid, ws).Return(nil)
			return tm.itemSvc
		},
	})
}

func TestApplyCategoryChange(t *testing.T) {
	runApply(t, applyCase{
		entityType: "category", action: ActionCreate, payload: `{"name":"Tools"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.categorySvc.On("Create", ctx, mock.MatchedBy(func(in category.CreateInput) bool {
				return in.WorkspaceID == ws && in.Name == "Tools"
			})).Return(&category.Category{}, nil)
			return tm.categorySvc
		},
	})
	runApply(t, applyCase{
		entityType: "category", action: ActionUpdate, withEntity: true, payload: `{"name":"Renamed"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.categorySvc.On("Update", ctx, eid, ws, mock.AnythingOfType("category.UpdateInput")).Return(&category.Category{}, nil)
			return tm.categorySvc
		},
	})
	runApply(t, applyCase{
		entityType: "category", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.categorySvc.On("Delete", ctx, eid, ws).Return(nil)
			return tm.categorySvc
		},
	})
}

func TestApplyLocationChange(t *testing.T) {
	runApply(t, applyCase{
		entityType: "location", action: ActionCreate, payload: `{"name":"Garage","short_code":"GAR"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.locationSvc.On("Create", ctx, mock.MatchedBy(func(in location.CreateInput) bool {
				return in.WorkspaceID == ws && in.Name == "Garage" && in.ShortCode == "GAR"
			})).Return(&location.Location{}, nil)
			return tm.locationSvc
		},
	})
	runApply(t, applyCase{
		entityType: "location", action: ActionUpdate, withEntity: true, payload: `{"name":"Renamed"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.locationSvc.On("Update", ctx, eid, ws, mock.AnythingOfType("location.UpdateInput")).Return(&location.Location{}, nil)
			return tm.locationSvc
		},
	})
	runApply(t, applyCase{
		entityType: "location", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.locationSvc.On("Delete", ctx, eid, ws).Return(nil)
			return tm.locationSvc
		},
	})
}

func TestApplyContainerChange(t *testing.T) {
	locID := uuid.New()
	runApply(t, applyCase{
		entityType: "container", action: ActionCreate, payload: `{"location_id":"` + locID.String() + `","name":"Box A"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.containerSvc.On("Create", ctx, mock.MatchedBy(func(in container.CreateInput) bool {
				return in.WorkspaceID == ws && in.Name == "Box A" && in.LocationID == locID
			})).Return(&container.Container{}, nil)
			return tm.containerSvc
		},
	})
	runApply(t, applyCase{
		entityType: "container", action: ActionUpdate, withEntity: true, payload: `{"name":"Box B","location_id":"` + locID.String() + `"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.containerSvc.On("Update", ctx, eid, ws, mock.AnythingOfType("container.UpdateInput")).Return(&container.Container{}, nil)
			return tm.containerSvc
		},
	})
	runApply(t, applyCase{
		entityType: "container", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.containerSvc.On("Delete", ctx, eid, ws).Return(nil)
			return tm.containerSvc
		},
	})
}

func TestApplyInventoryChange(t *testing.T) {
	itemID := uuid.New()
	locID := uuid.New()
	runApply(t, applyCase{
		entityType: "inventory", action: ActionCreate,
		payload: `{"item_id":"` + itemID.String() + `","location_id":"` + locID.String() + `","quantity":3,"condition":"NEW","status":"AVAILABLE"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.inventorySvc.On("Create", ctx, mock.MatchedBy(func(in inventory.CreateInput) bool {
				return in.WorkspaceID == ws && in.ItemID == itemID && in.LocationID == locID && in.Quantity == 3
			})).Return(&inventory.Inventory{}, nil)
			return tm.inventorySvc
		},
	})
	runApply(t, applyCase{
		entityType: "inventory", action: ActionUpdate, withEntity: true,
		payload: `{"location_id":"` + locID.String() + `","quantity":7,"condition":"GOOD"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.inventorySvc.On("Update", ctx, eid, ws, mock.AnythingOfType("inventory.UpdateInput")).Return(&inventory.Inventory{}, nil)
			return tm.inventorySvc
		},
	})
	// inventory delete goes through the repository (no service-level Delete).
	runApply(t, applyCase{
		entityType: "inventory", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.inventoryRepo.On("Delete", ctx, eid).Return(nil)
			return tm.inventoryRepo
		},
	})
}

func TestApplyBorrowerChange(t *testing.T) {
	runApply(t, applyCase{
		entityType: "borrower", action: ActionCreate, payload: `{"name":"Alice"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.borrowerSvc.On("Create", ctx, mock.MatchedBy(func(in borrower.CreateInput) bool {
				return in.WorkspaceID == ws && in.Name == "Alice"
			})).Return(&borrower.Borrower{}, nil)
			return tm.borrowerSvc
		},
	})
	runApply(t, applyCase{
		entityType: "borrower", action: ActionUpdate, withEntity: true, payload: `{"name":"Bob"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.borrowerSvc.On("Update", ctx, eid, ws, mock.AnythingOfType("borrower.UpdateInput")).Return(&borrower.Borrower{}, nil)
			return tm.borrowerSvc
		},
	})
	runApply(t, applyCase{
		entityType: "borrower", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.borrowerSvc.On("Delete", ctx, eid, ws).Return(nil)
			return tm.borrowerSvc
		},
	})
}

func TestApplyLoanChange(t *testing.T) {
	invID := uuid.New()
	borID := uuid.New()
	loanedAt := time.Now().UTC().Format(time.RFC3339)
	runApply(t, applyCase{
		entityType: "loan", action: ActionCreate,
		payload: `{"inventory_id":"` + invID.String() + `","borrower_id":"` + borID.String() + `","quantity":1,"loaned_at":"` + loanedAt + `"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.loanSvc.On("Create", ctx, mock.MatchedBy(func(in loan.CreateInput) bool {
				return in.WorkspaceID == ws && in.InventoryID == invID && in.BorrowerID == borID && in.Quantity == 1
			})).Return(&loan.Loan{}, nil)
			return tm.loanSvc
		},
	})
	runApply(t, applyCase{
		entityType: "loan", action: ActionUpdate, withEntity: true, payload: `{"notes":"extended"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.loanSvc.On("Update", ctx, eid, ws, mock.Anything, mock.Anything).Return(&loan.Loan{}, nil)
			return tm.loanSvc
		},
	})
	// loan delete goes through the repository (no service-level Delete).
	runApply(t, applyCase{
		entityType: "loan", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.loanRepo.On("Delete", ctx, eid).Return(nil)
			return tm.loanRepo
		},
	})
}

func TestApplyLabelChange(t *testing.T) {
	runApply(t, applyCase{
		entityType: "label", action: ActionCreate, payload: `{"name":"Urgent","color":"#f00"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, _ uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.labelSvc.On("Create", ctx, mock.MatchedBy(func(in label.CreateInput) bool {
				return in.WorkspaceID == ws && in.Name == "Urgent" && in.Color != nil && *in.Color == "#f00"
			})).Return(&label.Label{}, nil)
			return tm.labelSvc
		},
	})
	runApply(t, applyCase{
		entityType: "label", action: ActionUpdate, withEntity: true, payload: `{"name":"Renamed"}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.labelSvc.On("Update", ctx, eid, ws, mock.AnythingOfType("label.UpdateInput")).Return(&label.Label{}, nil)
			return tm.labelSvc
		},
	})
	runApply(t, applyCase{
		entityType: "label", action: ActionDelete, withEntity: true, payload: `{}`,
		expect: func(tm *testMocks, ctx context.Context, ws, eid uuid.UUID) interface{ AssertExpectations(mock.TestingT) bool } {
			tm.labelSvc.On("Delete", ctx, eid, ws).Return(nil)
			return tm.labelSvc
		},
	})
}
