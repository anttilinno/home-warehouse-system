package deleted_test

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
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/deleted"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements deleted.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) RecordDeletion(ctx context.Context, workspaceID uuid.UUID, entityType activity.EntityType, entityID uuid.UUID, deletedBy *uuid.UUID) error {
	args := m.Called(ctx, workspaceID, entityType, entityID, deletedBy)
	return args.Error(0)
}

func (m *MockService) GetDeletedSince(ctx context.Context, workspaceID uuid.UUID, since time.Time) ([]*deleted.DeletedRecord, error) {
	args := m.Called(ctx, workspaceID, since)
	return args.Get(0).([]*deleted.DeletedRecord), args.Error(1)
}

func (m *MockService) CleanupOld(ctx context.Context, before time.Time) error {
	args := m.Called(ctx, before)
	return args.Error(0)
}

// Tests

func TestDeletedHandler_GetDeletedSince(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	deleted.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets deleted records with default timeframe", func(t *testing.T) {
		entityID := uuid.New()
		record1, _ := deleted.NewDeletedRecord(setup.WorkspaceID, activity.EntityItem, entityID, &setup.UserID)
		records := []*deleted.DeletedRecord{record1}

		mockSvc.On("GetDeletedSince", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(t time.Time) bool {
			// Should be approximately 7 days ago (default)
			since := time.Since(t)
			return since >= 6*24*time.Hour && since <= 8*24*time.Hour
		})).Return(records, nil).Once()

		rec := setup.Get("/sync/deleted")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("gets deleted records with custom since parameter", func(t *testing.T) {
		since := time.Now().Add(-48 * time.Hour).UTC()
		sinceStr := since.Format(time.RFC3339)

		entityID := uuid.New()
		record1, _ := deleted.NewDeletedRecord(setup.WorkspaceID, activity.EntityLocation, entityID, nil)
		records := []*deleted.DeletedRecord{record1}

		mockSvc.On("GetDeletedSince", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(t time.Time) bool {
			// Should match the provided timestamp (within 1 second tolerance)
			return t.Sub(since).Abs() < time.Second
		})).Return(records, nil).Once()

		rec := setup.Get(fmt.Sprintf("/sync/deleted?since=%s", url.QueryEscape(sinceStr)))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid since format", func(t *testing.T) {
		rec := setup.Get("/sync/deleted?since=invalid")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("returns empty list when no deleted records", func(t *testing.T) {
		mockSvc.On("GetDeletedSince", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return([]*deleted.DeletedRecord{}, nil).Once()

		rec := setup.Get("/sync/deleted")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns deleted records of different entity types", func(t *testing.T) {
		itemID := uuid.New()
		locationID := uuid.New()
		containerID := uuid.New()

		record1, _ := deleted.NewDeletedRecord(setup.WorkspaceID, activity.EntityItem, itemID, &setup.UserID)
		record2, _ := deleted.NewDeletedRecord(setup.WorkspaceID, activity.EntityLocation, locationID, nil)
		record3, _ := deleted.NewDeletedRecord(setup.WorkspaceID, activity.EntityContainer, containerID, &setup.UserID)
		records := []*deleted.DeletedRecord{record1, record2, record3}

		mockSvc.On("GetDeletedSince", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return(records, nil).Once()

		rec := setup.Get("/sync/deleted")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}
