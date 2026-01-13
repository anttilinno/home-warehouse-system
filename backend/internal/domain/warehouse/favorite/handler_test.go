package favorite_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/favorite"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements favorite.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) AddFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType favorite.FavoriteType, targetID uuid.UUID) (*favorite.Favorite, error) {
	args := m.Called(ctx, userID, workspaceID, favoriteType, targetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*favorite.Favorite), args.Error(1)
}

func (m *MockService) RemoveFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType favorite.FavoriteType, targetID uuid.UUID) error {
	args := m.Called(ctx, userID, workspaceID, favoriteType, targetID)
	return args.Error(0)
}

func (m *MockService) ToggleFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType favorite.FavoriteType, targetID uuid.UUID) (bool, error) {
	args := m.Called(ctx, userID, workspaceID, favoriteType, targetID)
	return args.Bool(0), args.Error(1)
}

func (m *MockService) ListFavorites(ctx context.Context, userID, workspaceID uuid.UUID) ([]*favorite.Favorite, error) {
	args := m.Called(ctx, userID, workspaceID)
	return args.Get(0).([]*favorite.Favorite), args.Error(1)
}

func (m *MockService) IsFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType favorite.FavoriteType, targetID uuid.UUID) (bool, error) {
	args := m.Called(ctx, userID, workspaceID, favoriteType, targetID)
	return args.Bool(0), args.Error(1)
}

// Tests

func TestFavoriteHandler_ListFavorites(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	favorite.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists user favorites successfully", func(t *testing.T) {
		itemID := uuid.New()
		fav1, _ := favorite.NewFavorite(setup.UserID, setup.WorkspaceID, favorite.TypeItem, itemID)
		favorites := []*favorite.Favorite{fav1}

		mockSvc.On("ListFavorites", mock.Anything, setup.UserID, setup.WorkspaceID).
			Return(favorites, nil).Once()

		rec := setup.Get("/favorites")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no favorites", func(t *testing.T) {
		mockSvc.On("ListFavorites", mock.Anything, setup.UserID, setup.WorkspaceID).
			Return([]*favorite.Favorite{}, nil).Once()

		rec := setup.Get("/favorites")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestFavoriteHandler_ToggleFavorite(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	favorite.RegisterRoutes(setup.API, mockSvc)

	t.Run("adds favorite successfully", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("ToggleFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeItem, itemID).
			Return(true, nil).Once()

		body := fmt.Sprintf(`{"favorite_type":"ITEM","target_id":"%s"}`, itemID)
		rec := setup.Post("/favorites", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("removes favorite successfully", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("ToggleFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeItem, itemID).
			Return(false, nil).Once()

		body := fmt.Sprintf(`{"favorite_type":"ITEM","target_id":"%s"}`, itemID)
		rec := setup.Post("/favorites", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for invalid favorite type", func(t *testing.T) {
		itemID := uuid.New()

		body := fmt.Sprintf(`{"favorite_type":"INVALID","target_id":"%s"}`, itemID)
		rec := setup.Post("/favorites", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})

	t.Run("toggles location favorite", func(t *testing.T) {
		locationID := uuid.New()

		mockSvc.On("ToggleFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeLocation, locationID).
			Return(true, nil).Once()

		body := fmt.Sprintf(`{"favorite_type":"LOCATION","target_id":"%s"}`, locationID)
		rec := setup.Post("/favorites", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("toggles container favorite", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("ToggleFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeContainer, containerID).
			Return(true, nil).Once()

		body := fmt.Sprintf(`{"favorite_type":"CONTAINER","target_id":"%s"}`, containerID)
		rec := setup.Post("/favorites", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestFavoriteHandler_CheckFavorite(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	favorite.RegisterRoutes(setup.API, mockSvc)

	t.Run("checks favorite status - is favorite", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("IsFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeItem, itemID).
			Return(true, nil).Once()

		rec := setup.Get(fmt.Sprintf("/favorites/check/ITEM/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("checks favorite status - not favorite", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("IsFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeItem, itemID).
			Return(false, nil).Once()

		rec := setup.Get(fmt.Sprintf("/favorites/check/ITEM/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid favorite type", func(t *testing.T) {
		itemID := uuid.New()

		rec := setup.Get(fmt.Sprintf("/favorites/check/INVALID/%s", itemID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
	})

	t.Run("checks location favorite status", func(t *testing.T) {
		locationID := uuid.New()

		mockSvc.On("IsFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeLocation, locationID).
			Return(false, nil).Once()

		rec := setup.Get(fmt.Sprintf("/favorites/check/LOCATION/%s", locationID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("checks container favorite status", func(t *testing.T) {
		containerID := uuid.New()

		mockSvc.On("IsFavorite", mock.Anything, setup.UserID, setup.WorkspaceID, favorite.TypeContainer, containerID).
			Return(true, nil).Once()

		rec := setup.Get(fmt.Sprintf("/favorites/check/CONTAINER/%s", containerID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}
