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
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Mock repositories
type MockPendingChangeRepository struct {
	mock.Mock
}

func (m *MockPendingChangeRepository) Save(ctx context.Context, change *PendingChange) error {
	args := m.Called(ctx, change)
	return args.Error(0)
}

func (m *MockPendingChangeRepository) FindByID(ctx context.Context, id uuid.UUID) (*PendingChange, error) {
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

func (m *MockPendingChangeRepository) FindByEntity(ctx context.Context, entityType string, entityID uuid.UUID) ([]*PendingChange, error) {
	args := m.Called(ctx, entityType, entityID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*PendingChange), args.Error(1)
}

func (m *MockPendingChangeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

type MockMemberRepository struct {
	mock.Mock
}

func (m *MockMemberRepository) Save(ctx context.Context, member *member.Member) error {
	args := m.Called(ctx, member)
	return args.Error(0)
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
	args := m.Called(ctx, workspaceID, userID)
	return args.Error(0)
}

func (m *MockMemberRepository) CountOwners(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockMemberRepository) Exists(ctx context.Context, workspaceID, userID uuid.UUID) (bool, error) {
	args := m.Called(ctx, workspaceID, userID)
	return args.Get(0).(bool), args.Error(1)
}

type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Save(ctx context.Context, u *user.User) error {
	args := m.Called(ctx, u)
	return args.Error(0)
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
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	args := m.Called(ctx, email)
	return args.Bool(0), args.Error(1)
}

type MockItemRepository struct {
	mock.Mock
}

func (m *MockItemRepository) Save(ctx context.Context, item *item.Item) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockItemRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockItemRepository) FindBySKU(ctx context.Context, workspaceID uuid.UUID, sku string) (*item.Item, error) {
	return nil, nil
}

func (m *MockItemRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*item.Item, error) {
	return nil, nil
}

func (m *MockItemRepository) FindByBarcode(ctx context.Context, workspaceID uuid.UUID, barcode string) (*item.Item, error) {
	return nil, nil
}

func (m *MockItemRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	return nil, 0, nil
}

func (m *MockItemRepository) FindByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*item.Item, error) {
	return nil, nil
}

func (m *MockItemRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*item.Item, error) {
	return nil, nil
}

func (m *MockItemRepository) SKUExists(ctx context.Context, workspaceID uuid.UUID, sku string) (bool, error) {
	return false, nil
}

func (m *MockItemRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	return false, nil
}

func (m *MockItemRepository) AttachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	return nil
}

func (m *MockItemRepository) DetachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	return nil
}

func (m *MockItemRepository) GetItemLabels(ctx context.Context, itemID uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}

// TestCreatePendingChange tests the CreatePendingChange method
func TestCreatePendingChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()

	t.Run("successfully creates pending change for valid item", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		service := &Service{
			repo: mockRepo,
		}

		payload := json.RawMessage(`{"name": "Test Item", "sku": "TEST-001", "min_stock_level": 5}`)

		mockRepo.On("Save", ctx, mock.MatchedBy(func(pc *PendingChange) bool {
			return pc.WorkspaceID() == workspaceID &&
				pc.RequesterID() == requesterID &&
				pc.EntityType() == "item" &&
				pc.Action() == ActionCreate &&
				pc.Status() == StatusPending
		})).Return(nil)

		change, err := service.CreatePendingChange(ctx, workspaceID, requesterID, "item", nil, ActionCreate, payload)

		assert.NoError(t, err)
		assert.NotNil(t, change)
		assert.Equal(t, workspaceID, change.WorkspaceID())
		assert.Equal(t, requesterID, change.RequesterID())
		assert.Equal(t, "item", change.EntityType())
		assert.Equal(t, ActionCreate, change.Action())
		assert.Equal(t, StatusPending, change.Status())
		mockRepo.AssertExpectations(t)
	})

	t.Run("fails for invalid entity type", func(t *testing.T) {
		service := &Service{
			repo: new(MockPendingChangeRepository),
		}

		payload := json.RawMessage(`{"name": "Test"}`)

		change, err := service.CreatePendingChange(ctx, workspaceID, requesterID, "invalid_type", nil, ActionCreate, payload)

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Equal(t, ErrInvalidEntityType, err)
	})

	t.Run("fails when repository returns error", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		service := &Service{
			repo: mockRepo,
		}

		payload := json.RawMessage(`{"name": "Test Item", "sku": "TEST-001", "min_stock_level": 5}`)
		repoError := errors.New("database error")

		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(repoError)

		change, err := service.CreatePendingChange(ctx, workspaceID, requesterID, "item", nil, ActionCreate, payload)

		assert.Error(t, err)
		assert.Nil(t, change)
		assert.Contains(t, err.Error(), "failed to save pending change")
		mockRepo.AssertExpectations(t)
	})
}

// TestApproveChange tests the ApproveChange method
func TestApproveChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("successfully approves change with owner role", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)
		mockItemRepo := new(MockItemRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
			userRepo:   mockUserRepo,
			itemRepo:   mockItemRepo,
		}

		payload := json.RawMessage(`{"name": "Test Item", "sku": "TEST-001", "min_stock_level": 5}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			ActionCreate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		// Mock member with owner role
		ownerMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleOwner,
			nil,
			time.Now(),
			time.Now(),
		)

		// Mock users for SSE event
		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
		mockRepo.On("Save", ctx, mock.MatchedBy(func(pc *PendingChange) bool {
			return pc.Status() == StatusApproved && pc.ReviewedBy() != nil
		})).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
		mockUserRepo.AssertExpectations(t)
		mockItemRepo.AssertExpectations(t)
	})

	t.Run("successfully approves change with admin role", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)
		mockItemRepo := new(MockItemRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
			userRepo:   mockUserRepo,
			itemRepo:   mockItemRepo,
		}

		payload := json.RawMessage(`{"name": "Test Item", "sku": "TEST-001", "min_stock_level": 5}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			ActionCreate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		// Mock member with admin role
		adminMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleAdmin,
			nil,
			time.Now(),
			time.Now(),
		)

		// Mock users for SSE event
		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(adminMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
		mockRepo.On("Save", ctx, mock.MatchedBy(func(pc *PendingChange) bool {
			return pc.Status() == StatusApproved
		})).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
		mockUserRepo.AssertExpectations(t)
		mockItemRepo.AssertExpectations(t)
	})

	t.Run("fails when reviewer is not owner or admin", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
		}

		payload := json.RawMessage(`{"name": "Test Item"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			ActionCreate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		// Mock member with member role (not owner/admin)
		regularMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleMember,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(regularMember, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Equal(t, ErrUnauthorized, err)
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
	})

	t.Run("fails when pending change not found", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)

		service := &Service{
			repo: mockRepo,
		}

		mockRepo.On("FindByID", ctx, changeID).Return(nil, ErrPendingChangeNotFound)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to fetch pending change")
		mockRepo.AssertExpectations(t)
	})
}

// TestRejectChange tests the RejectChange method
func TestRejectChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("successfully rejects change with owner role", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
			userRepo:   mockUserRepo,
		}

		payload := json.RawMessage(`{"name": "Test Item"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			ActionCreate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		ownerMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleOwner,
			nil,
			time.Now(),
			time.Now(),
		)

		// Mock users for SSE event
		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockRepo.On("Save", ctx, mock.MatchedBy(func(pc *PendingChange) bool {
			return pc.Status() == StatusRejected &&
				pc.ReviewedBy() != nil &&
				pc.RejectionReason() != nil
		})).Return(nil)

		err := service.RejectChange(ctx, changeID, reviewerID, "Not needed")

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
		mockUserRepo.AssertExpectations(t)
	})

	t.Run("fails when reviewer is not owner or admin", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
		}

		payload := json.RawMessage(`{"name": "Test Item"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			ActionCreate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		viewerMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleViewer,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(viewerMember, nil)

		err := service.RejectChange(ctx, changeID, reviewerID, "Not authorized")

		assert.Error(t, err)
		assert.Equal(t, ErrUnauthorized, err)
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
	})
}

// TestListPendingForWorkspace tests the ListPendingForWorkspace method
func TestListPendingForWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	t.Run("successfully lists pending changes", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)

		service := &Service{
			repo: mockRepo,
		}

		expectedChanges := []*PendingChange{
			Reconstruct(
				uuid.New(),
				workspaceID,
				uuid.New(),
				"item",
				nil,
				ActionCreate,
				json.RawMessage(`{"name": "Item 1"}`),
				StatusPending,
				nil,
				nil,
				nil,
				time.Now(),
				time.Now(),
			),
			Reconstruct(
				uuid.New(),
				workspaceID,
				uuid.New(),
				"category",
				nil,
				ActionCreate,
				json.RawMessage(`{"name": "Category 1"}`),
				StatusPending,
				nil,
				nil,
				nil,
				time.Now(),
				time.Now(),
			),
		}

		status := StatusPending
		mockRepo.On("FindByWorkspace", ctx, workspaceID, &status).Return(expectedChanges, nil)

		changes, err := service.ListPendingForWorkspace(ctx, workspaceID)

		assert.NoError(t, err)
		assert.Len(t, changes, 2)
		mockRepo.AssertExpectations(t)
	})

	t.Run("returns empty list when no pending changes", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)

		service := &Service{
			repo: mockRepo,
		}

		status := StatusPending
		mockRepo.On("FindByWorkspace", ctx, workspaceID, &status).Return([]*PendingChange{}, nil)

		changes, err := service.ListPendingForWorkspace(ctx, workspaceID)

		assert.NoError(t, err)
		assert.Empty(t, changes)
		mockRepo.AssertExpectations(t)
	})
}
