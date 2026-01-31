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
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
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

	t.Run("returns error when repository fails", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)

		service := &Service{
			repo: mockRepo,
		}

		status := StatusPending
		repoError := errors.New("database connection failed")
		mockRepo.On("FindByWorkspace", ctx, workspaceID, &status).Return(nil, repoError)

		changes, err := service.ListPendingForWorkspace(ctx, workspaceID)

		assert.Error(t, err)
		assert.Nil(t, changes)
		assert.Contains(t, err.Error(), "failed to list pending changes")
		mockRepo.AssertExpectations(t)
	})
}

// TestCreatePendingChangeValidation tests CreatePendingChange validation
func TestCreatePendingChangeValidation(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()

	t.Run("validates all supported entity types", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		service := &Service{
			repo: mockRepo,
		}

		validTypes := []string{"item", "category", "location", "container", "inventory", "borrower", "loan", "label"}
		payload := json.RawMessage(`{"name": "Test"}`)

		for _, entityType := range validTypes {
			mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil).Once()

			change, err := service.CreatePendingChange(ctx, workspaceID, requesterID, entityType, nil, ActionCreate, payload)

			assert.NoError(t, err, "expected no error for entity type: %s", entityType)
			assert.NotNil(t, change, "expected change to be created for entity type: %s", entityType)
			assert.Equal(t, entityType, change.EntityType())
		}

		mockRepo.AssertExpectations(t)
	})

	t.Run("creates pending change with entity ID for update action", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		service := &Service{
			repo: mockRepo,
		}

		entityID := uuid.New()
		payload := json.RawMessage(`{"name": "Updated Item"}`)

		mockRepo.On("Save", ctx, mock.MatchedBy(func(pc *PendingChange) bool {
			return pc.EntityID() != nil &&
				*pc.EntityID() == entityID &&
				pc.Action() == ActionUpdate
		})).Return(nil)

		change, err := service.CreatePendingChange(ctx, workspaceID, requesterID, "item", &entityID, ActionUpdate, payload)

		assert.NoError(t, err)
		assert.NotNil(t, change)
		assert.NotNil(t, change.EntityID())
		assert.Equal(t, entityID, *change.EntityID())
		mockRepo.AssertExpectations(t)
	})

	t.Run("creates pending change for delete action", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		service := &Service{
			repo: mockRepo,
		}

		entityID := uuid.New()
		payload := json.RawMessage(`{"id": "` + entityID.String() + `"}`)

		mockRepo.On("Save", ctx, mock.MatchedBy(func(pc *PendingChange) bool {
			return pc.Action() == ActionDelete
		})).Return(nil)

		change, err := service.CreatePendingChange(ctx, workspaceID, requesterID, "item", &entityID, ActionDelete, payload)

		assert.NoError(t, err)
		assert.NotNil(t, change)
		assert.Equal(t, ActionDelete, change.Action())
		mockRepo.AssertExpectations(t)
	})
}

// TestApproveChangeEdgeCases tests additional ApproveChange edge cases
func TestApproveChangeEdgeCases(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("fails when change is already approved", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
			userRepo:   mockUserRepo,
		}

		reviewedAt := time.Now()
		payload := json.RawMessage(`{"name": "Test Item"}`)
		alreadyApprovedChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			ActionCreate,
			payload,
			StatusApproved, // Already approved
			&reviewerID,
			&reviewedAt,
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(alreadyApprovedChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to approve change")
		mockRepo.AssertExpectations(t)
	})

	t.Run("fails when member repository returns error", func(t *testing.T) {
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(nil, errors.New("member not found"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check reviewer permissions")
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
	})

	t.Run("fails when applying change fails", func(t *testing.T) {
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

		ownerMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleOwner,
			nil,
			time.Now(),
			time.Now(),
		)

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(errors.New("database error"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
		mockItemRepo.AssertExpectations(t)
	})

	t.Run("fails when final save fails", func(t *testing.T) {
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

		ownerMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleOwner,
			nil,
			time.Now(),
			time.Now(),
		)

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(errors.New("save failed"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to save approved change")
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
		mockItemRepo.AssertExpectations(t)
	})
}

// TestRejectChangeEdgeCases tests additional RejectChange edge cases
func TestRejectChangeEdgeCases(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("fails when change not found", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)

		service := &Service{
			repo: mockRepo,
		}

		mockRepo.On("FindByID", ctx, changeID).Return(nil, ErrPendingChangeNotFound)

		err := service.RejectChange(ctx, changeID, reviewerID, "Not needed")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to fetch pending change")
		mockRepo.AssertExpectations(t)
	})

	t.Run("fails when change is already rejected", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
			userRepo:   mockUserRepo,
		}

		reviewedAt := time.Now()
		reason := "First rejection"
		payload := json.RawMessage(`{"name": "Test Item"}`)
		alreadyRejectedChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			ActionCreate,
			payload,
			StatusRejected, // Already rejected
			&reviewerID,
			&reviewedAt,
			&reason,
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(alreadyRejectedChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.RejectChange(ctx, changeID, reviewerID, "Second rejection")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to reject change")
		mockRepo.AssertExpectations(t)
	})

	t.Run("fails with empty rejection reason", func(t *testing.T) {
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.RejectChange(ctx, changeID, reviewerID, "")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to reject change")
		mockRepo.AssertExpectations(t)
	})

	t.Run("fails when save fails", func(t *testing.T) {
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(errors.New("save failed"))

		err := service.RejectChange(ctx, changeID, reviewerID, "Not needed")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to save rejected change")
		mockRepo.AssertExpectations(t)
	})

	t.Run("fails when member repository returns error", func(t *testing.T) {
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(nil, errors.New("member not found"))

		err := service.RejectChange(ctx, changeID, reviewerID, "Not needed")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to check reviewer permissions")
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
	})

	t.Run("successfully rejects change with admin role", func(t *testing.T) {
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

		adminMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleAdmin,
			nil,
			time.Now(),
			time.Now(),
		)

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(adminMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockRepo.On("Save", ctx, mock.MatchedBy(func(pc *PendingChange) bool {
			return pc.Status() == StatusRejected
		})).Return(nil)

		err := service.RejectChange(ctx, changeID, reviewerID, "Duplicate item")

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockMemberRepo.AssertExpectations(t)
		mockUserRepo.AssertExpectations(t)
	})
}

// TestNewService tests the NewService constructor
func TestNewService(t *testing.T) {
	t.Run("creates service with all dependencies", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)
		mockItemRepo := new(MockItemRepository)

		service := NewService(
			mockRepo,
			mockMemberRepo,
			mockUserRepo,
			mockItemRepo,
			nil, // categoryRepo
			nil, // locationRepo
			nil, // containerRepo
			nil, // inventoryRepo
			nil, // borrowerRepo
			nil, // loanRepo
			nil, // labelRepo
			nil, // broadcaster
		)

		assert.NotNil(t, service)
		assert.Equal(t, mockRepo, service.repo)
		assert.Equal(t, mockMemberRepo, service.memberRepo)
		assert.Equal(t, mockUserRepo, service.userRepo)
		assert.Equal(t, mockItemRepo, service.itemRepo)
	})
}

// TestIsValidEntityType tests the isValidEntityType helper
func TestServiceIsValidEntityType(t *testing.T) {
	service := &Service{}

	t.Run("returns true for valid entity types", func(t *testing.T) {
		validTypes := []string{"item", "category", "location", "container", "inventory", "borrower", "loan", "label"}
		for _, entityType := range validTypes {
			assert.True(t, service.isValidEntityType(entityType), "expected true for entity type: %s", entityType)
		}
	})

	t.Run("returns false for invalid entity types", func(t *testing.T) {
		invalidTypes := []string{"invalid", "user", "workspace", "member", "", "ITEM", "Item"}
		for _, entityType := range invalidTypes {
			assert.False(t, service.isValidEntityType(entityType), "expected false for entity type: %s", entityType)
		}
	})
}

// TestApplyItemChangeUpdate tests item update change application
func TestApplyItemChangeUpdate(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()
	itemID := uuid.New()

	t.Run("successfully applies item update change", func(t *testing.T) {
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

		payload := json.RawMessage(`{"name": "Updated Item Name"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			&itemID,
			ActionUpdate,
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		existingItem, _ := item.NewItem(workspaceID, "Original Item", "SKU-001", 5)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
		mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockItemRepo.AssertExpectations(t)
	})

	t.Run("fails item update when item not found", func(t *testing.T) {
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

		payload := json.RawMessage(`{"name": "Updated Item"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			&itemID,
			ActionUpdate,
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, errors.New("item not found"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockRepo.AssertExpectations(t)
		mockItemRepo.AssertExpectations(t)
	})
}

// TestApplyItemChangeDelete tests item delete change application
func TestApplyItemChangeDelete(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()
	itemID := uuid.New()

	t.Run("successfully applies item delete change", func(t *testing.T) {
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

		payload := json.RawMessage(`{"id": "` + itemID.String() + `"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			&itemID,
			ActionDelete,
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockItemRepo.On("Delete", ctx, itemID).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockItemRepo.AssertExpectations(t)
	})

	t.Run("fails item delete when entity ID is missing", func(t *testing.T) {
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

		payload := json.RawMessage(`{}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil, // No entity ID
			ActionDelete,
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockRepo.AssertExpectations(t)
	})
}

// TestApplyItemChangeInvalidPayload tests item change with invalid payload
func TestApplyItemChangeInvalidPayload(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("fails with invalid JSON payload for create", func(t *testing.T) {
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

		// Invalid JSON that won't parse correctly
		payload := json.RawMessage(`{invalid json}`)
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockRepo.AssertExpectations(t)
	})
}

// TestApplyUnsupportedAction tests handling of unsupported actions
func TestApplyUnsupportedAction(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("fails with unsupported action", func(t *testing.T) {
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

		payload := json.RawMessage(`{"name": "Test"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"item",
			nil,
			Action("unsupported"),
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockRepo.AssertExpectations(t)
	})
}

// TestApplyUnsupportedEntityType tests handling of unsupported entity types during apply
func TestApplyUnsupportedEntityType(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	t.Run("fails when applying change for unsupported entity type", func(t *testing.T) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)

		service := &Service{
			repo:       mockRepo,
			memberRepo: mockMemberRepo,
			userRepo:   mockUserRepo,
		}

		payload := json.RawMessage(`{"name": "Test"}`)
		// Create a pending change with an unsupported entity type using Reconstruct
		// (bypassing the entity type validation in NewPendingChange)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"unsupported_entity",
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

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockRepo.AssertExpectations(t)
	})
}

// MockCategoryRepository is a mock for category.Repository
type MockCategoryRepository struct {
	mock.Mock
}

func (m *MockCategoryRepository) Save(ctx context.Context, cat *category.Category) error {
	args := m.Called(ctx, cat)
	return args.Error(0)
}

func (m *MockCategoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*category.Category, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCategoryRepository) HasChildren(ctx context.Context, id uuid.UUID) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

// MockLocationRepository is a mock for location.Repository
type MockLocationRepository struct {
	mock.Mock
}

func (m *MockLocationRepository) Save(ctx context.Context, loc *location.Location) error {
	args := m.Called(ctx, loc)
	return args.Error(0)
}

func (m *MockLocationRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*location.Location, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}

func (m *MockLocationRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*location.Location, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}

func (m *MockLocationRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*location.Location, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*location.Location), args.Int(1), args.Error(2)
}

func (m *MockLocationRepository) FindRootLocations(ctx context.Context, workspaceID uuid.UUID) ([]*location.Location, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*location.Location), args.Error(1)
}

func (m *MockLocationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockLocationRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	return args.Bool(0), args.Error(1)
}

func (m *MockLocationRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*location.Location, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*location.Location), args.Error(1)
}

// TestApplyCategoryChange tests category change application through approval pipeline
func TestApplyCategoryChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	// Helper to create base mocks and owner member
	setupMocks := func() (*MockPendingChangeRepository, *MockMemberRepository, *MockUserRepository, *MockCategoryRepository, *member.Member, *user.User, *user.User) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)
		mockCategoryRepo := new(MockCategoryRepository)

		ownerMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleOwner,
			nil,
			time.Now(),
			time.Now(),
		)

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		return mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser
	}

	t.Run("create category successfully", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		payload := json.RawMessage(`{"name": "Electronics", "description": "Electronic items"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockCategoryRepo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockCategoryRepo.AssertExpectations(t)
	})

	t.Run("create category with parent", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		parentID := uuid.New()
		payload := json.RawMessage(`{"name": "Laptops", "parent_category_id": "` + parentID.String() + `"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockCategoryRepo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockCategoryRepo.AssertExpectations(t)
	})

	t.Run("update category successfully", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		categoryID := uuid.New()
		payload := json.RawMessage(`{"name": "Updated Electronics"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
			&categoryID,
			ActionUpdate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		existingCategory := category.Reconstruct(
			categoryID,
			workspaceID,
			"Electronics",
			nil,
			nil,
			false,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockCategoryRepo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCategory, nil)
		mockCategoryRepo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockCategoryRepo.AssertExpectations(t)
	})

	t.Run("delete category successfully", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		categoryID := uuid.New()
		payload := json.RawMessage(`{}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
			&categoryID,
			ActionDelete,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockCategoryRepo.On("Delete", ctx, categoryID).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockCategoryRepo.AssertExpectations(t)
	})

	t.Run("create category fails on save error", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		payload := json.RawMessage(`{"name": "Electronics"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockCategoryRepo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(errors.New("database error"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockCategoryRepo.AssertExpectations(t)
	})

	t.Run("update category fails when not found", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		categoryID := uuid.New()
		payload := json.RawMessage(`{"name": "Updated"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
			&categoryID,
			ActionUpdate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockCategoryRepo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, errors.New("category not found"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockCategoryRepo.AssertExpectations(t)
	})

	t.Run("delete category fails when entity ID missing", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		payload := json.RawMessage(`{}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
			nil, // No entity ID for delete
			ActionDelete,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
	})

	t.Run("create category fails with invalid payload", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockCategoryRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			categoryRepo: mockCategoryRepo,
		}

		payload := json.RawMessage(`{invalid json}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"category",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
	})
}

// TestApplyLocationChange tests location change application through approval pipeline
func TestApplyLocationChange(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	requesterID := uuid.New()
	reviewerID := uuid.New()
	changeID := uuid.New()

	// Helper to create base mocks and owner member
	setupMocks := func() (*MockPendingChangeRepository, *MockMemberRepository, *MockUserRepository, *MockLocationRepository, *member.Member, *user.User, *user.User) {
		mockRepo := new(MockPendingChangeRepository)
		mockMemberRepo := new(MockMemberRepository)
		mockUserRepo := new(MockUserRepository)
		mockLocationRepo := new(MockLocationRepository)

		ownerMember := member.Reconstruct(
			uuid.New(),
			workspaceID,
			reviewerID,
			member.RoleOwner,
			nil,
			time.Now(),
			time.Now(),
		)

		requesterUser, _ := user.NewUser("requester@test.com", "Requester User", "password123")
		reviewerUser, _ := user.NewUser("reviewer@test.com", "Reviewer User", "password123")

		return mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser
	}

	t.Run("create location successfully", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		payload := json.RawMessage(`{"name": "Warehouse A", "short_code": "WH-A"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockLocationRepo.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("create location with parent (hierarchical)", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		parentID := uuid.New()
		payload := json.RawMessage(`{"name": "Shelf B1", "short_code": "SH-B1", "parent_location": "` + parentID.String() + `"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockLocationRepo.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("update location successfully", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		locationID := uuid.New()
		payload := json.RawMessage(`{"name": "Warehouse A Updated", "description": "Main warehouse"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
			&locationID,
			ActionUpdate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		existingLocation := location.Reconstruct(
			locationID,
			workspaceID,
			"Warehouse A",
			nil,
			nil,
			"WH-A",
			false,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(existingLocation, nil)
		mockLocationRepo.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("delete location successfully", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		locationID := uuid.New()
		payload := json.RawMessage(`{}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
			&locationID,
			ActionDelete,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockLocationRepo.On("Delete", ctx, locationID).Return(nil)
		mockRepo.On("Save", ctx, mock.AnythingOfType("*pendingchange.PendingChange")).Return(nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.NoError(t, err)
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("create location fails on save error", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		payload := json.RawMessage(`{"name": "Warehouse A", "short_code": "WH-A"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockLocationRepo.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(errors.New("database error"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("update location fails when not found", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		locationID := uuid.New()
		payload := json.RawMessage(`{"name": "Updated"}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
			&locationID,
			ActionUpdate,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)
		mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(nil, errors.New("location not found"))

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
		mockLocationRepo.AssertExpectations(t)
	})

	t.Run("delete location fails when entity ID missing", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		payload := json.RawMessage(`{}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
			nil, // No entity ID for delete
			ActionDelete,
			payload,
			StatusPending,
			nil,
			nil,
			nil,
			time.Now(),
			time.Now(),
		)

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
	})

	t.Run("create location fails with invalid payload", func(t *testing.T) {
		mockRepo, mockMemberRepo, mockUserRepo, mockLocationRepo, ownerMember, requesterUser, reviewerUser := setupMocks()

		service := &Service{
			repo:         mockRepo,
			memberRepo:   mockMemberRepo,
			userRepo:     mockUserRepo,
			locationRepo: mockLocationRepo,
		}

		payload := json.RawMessage(`{invalid json}`)
		pendingChange := Reconstruct(
			changeID,
			workspaceID,
			requesterID,
			"location",
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

		mockRepo.On("FindByID", ctx, changeID).Return(pendingChange, nil)
		mockMemberRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, reviewerID).Return(ownerMember, nil)
		mockUserRepo.On("FindByID", ctx, requesterID).Return(requesterUser, nil)
		mockUserRepo.On("FindByID", ctx, reviewerID).Return(reviewerUser, nil)

		err := service.ApproveChange(ctx, changeID, reviewerID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to apply change")
	})
}
