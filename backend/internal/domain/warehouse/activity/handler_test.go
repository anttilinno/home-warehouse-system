package activity_test

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements activity.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Log(ctx context.Context, input activity.LogInput) error {
	args := m.Called(ctx, input)
	return args.Error(0)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*activity.ActivityLog, error) {
	args := m.Called(ctx, workspaceID, pagination)
	return args.Get(0).([]*activity.ActivityLog), args.Error(1)
}

func (m *MockService) ListByEntity(ctx context.Context, workspaceID uuid.UUID, entityType activity.EntityType, entityID uuid.UUID, pagination shared.Pagination) ([]*activity.ActivityLog, error) {
	args := m.Called(ctx, workspaceID, entityType, entityID, pagination)
	return args.Get(0).([]*activity.ActivityLog), args.Error(1)
}

func (m *MockService) ListByUser(ctx context.Context, workspaceID, userID uuid.UUID, pagination shared.Pagination) ([]*activity.ActivityLog, error) {
	args := m.Called(ctx, workspaceID, userID, pagination)
	return args.Get(0).([]*activity.ActivityLog), args.Error(1)
}

func (m *MockService) GetRecentActivity(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*activity.ActivityLog, error) {
	args := m.Called(ctx, workspaceID, since)
	return args.Get(0).([]*activity.ActivityLog), args.Error(1)
}

// Tests

func TestActivityHandler_ListByWorkspace(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	activity.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists workspace activity successfully", func(t *testing.T) {
		entityID := uuid.New()
		userID := uuid.New()
		log1, _ := activity.NewActivityLog(
			setup.WorkspaceID,
			&userID,
			activity.ActionCreate,
			activity.EntityItem,
			entityID,
			"Test Item",
			nil,
			nil,
		)
		logs := []*activity.ActivityLog{log1}

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(logs, nil).Once()

		rec := setup.Get("/activity")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return([]*activity.ActivityLog{}, nil).Once()

		rec := setup.Get("/activity?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no activity", func(t *testing.T) {
		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*activity.ActivityLog{}, nil).Once()

		rec := setup.Get("/activity")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestActivityHandler_ListByUser(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	activity.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists activity by user successfully", func(t *testing.T) {
		userID := uuid.New()
		entityID := uuid.New()
		log1, _ := activity.NewActivityLog(
			setup.WorkspaceID,
			&userID,
			activity.ActionUpdate,
			activity.EntityItem,
			entityID,
			"Test Item",
			nil,
			nil,
		)
		logs := []*activity.ActivityLog{log1}

		mockSvc.On("ListByUser", mock.Anything, setup.WorkspaceID, userID, mock.Anything).
			Return(logs, nil).Once()

		rec := setup.Get(fmt.Sprintf("/activity?user_id=%s", userID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid user_id format", func(t *testing.T) {
		rec := setup.Get("/activity?user_id=invalid")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})
}

func TestActivityHandler_ListByEntity(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	activity.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists activity by entity successfully", func(t *testing.T) {
		entityID := uuid.New()
		userID := uuid.New()
		log1, _ := activity.NewActivityLog(
			setup.WorkspaceID,
			&userID,
			activity.ActionUpdate,
			activity.EntityItem,
			entityID,
			"Test Item",
			nil,
			nil,
		)
		logs := []*activity.ActivityLog{log1}

		mockSvc.On("ListByEntity", mock.Anything, setup.WorkspaceID, activity.EntityItem, entityID, mock.Anything).
			Return(logs, nil).Once()

		rec := setup.Get(fmt.Sprintf("/activity/ITEM/%s", entityID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid entity type", func(t *testing.T) {
		entityID := uuid.New()

		rec := setup.Get(fmt.Sprintf("/activity/invalid_type/%s", entityID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("handles pagination for entity activity", func(t *testing.T) {
		entityID := uuid.New()

		mockSvc.On("ListByEntity", mock.Anything, setup.WorkspaceID, activity.EntityLocation, entityID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 20
		})).Return([]*activity.ActivityLog{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/activity/LOCATION/%s?page=2&limit=20", entityID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestActivityHandler_GetRecentActivity(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	activity.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets recent activity with default timeframe", func(t *testing.T) {
		entityID := uuid.New()
		userID := uuid.New()
		log1, _ := activity.NewActivityLog(
			setup.WorkspaceID,
			&userID,
			activity.ActionCreate,
			activity.EntityItem,
			entityID,
			"Test Item",
			nil,
			nil,
		)
		logs := []*activity.ActivityLog{log1}

		mockSvc.On("GetRecentActivity", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(t time.Time) bool {
			// Should be approximately 24 hours ago
			return time.Since(t) >= 23*time.Hour && time.Since(t) <= 25*time.Hour
		})).Return(logs, nil).Once()

		rec := setup.Get("/activity/recent")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("gets recent activity with custom since parameter", func(t *testing.T) {
		since := time.Now().Add(-2 * time.Hour).UTC()
		sinceStr := since.Format(time.RFC3339)

		mockSvc.On("GetRecentActivity", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(t time.Time) bool {
			// Should match the provided timestamp (within 1 second tolerance)
			return t.Sub(since).Abs() < time.Second
		})).Return([]*activity.ActivityLog{}, nil).Once()

		rec := setup.Get(fmt.Sprintf("/activity/recent?since=%s", url.QueryEscape(sinceStr)))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid since format", func(t *testing.T) {
		rec := setup.Get("/activity/recent?since=invalid")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns empty list when no recent activity", func(t *testing.T) {
		mockSvc.On("GetRecentActivity", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*activity.ActivityLog{}, nil).Once()

		rec := setup.Get("/activity/recent")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}
