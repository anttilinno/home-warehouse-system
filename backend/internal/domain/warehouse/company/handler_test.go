package company_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/company"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements company.Service interface methods
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input company.CreateInput) (*company.Company, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*company.Company), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*company.Company, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*company.Company), args.Error(1)
}

func (m *MockService) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*company.Company], error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*shared.PagedResult[*company.Company]), args.Error(1)
}

func (m *MockService) Update(ctx context.Context, id, workspaceID uuid.UUID, input company.UpdateInput) (*company.Company, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*company.Company), args.Error(1)
}

func (m *MockService) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

// Tests

func TestCompanyHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	company.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("creates company successfully", func(t *testing.T) {
		website := "https://example.com"
		testCompany, _ := company.NewCompany(setup.WorkspaceID, "Acme Corp", &website, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input company.CreateInput) bool {
			return input.Name == "Acme Corp" && input.Website != nil && *input.Website == "https://example.com"
		})).Return(testCompany, nil).Once()

		body := `{"name":"Acme Corp","website":"https://example.com"}`
		rec := setup.Post("/companies", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("creates company without optional fields", func(t *testing.T) {
		testCompany, _ := company.NewCompany(setup.WorkspaceID, "Basic Corp", nil, nil)

		mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input company.CreateInput) bool {
			return input.Name == "Basic Corp" && input.Website == nil && input.Notes == nil
		})).Return(testCompany, nil).Once()

		body := `{"name":"Basic Corp"}`
		rec := setup.Post("/companies", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for duplicate name", func(t *testing.T) {
		mockSvc.On("Create", mock.Anything, mock.Anything).
			Return(nil, company.ErrNameTaken).Once()

		body := `{"name":"Duplicate"}`
		rec := setup.Post("/companies", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty name", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		body := `{"name":""}`
		rec := setup.Post("/companies", body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestCompanyHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	company.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("lists companies successfully", func(t *testing.T) {
		comp1, _ := company.NewCompany(setup.WorkspaceID, "Company 1", nil, nil)
		comp2, _ := company.NewCompany(setup.WorkspaceID, "Company 2", nil, nil)
		companies := []*company.Company{comp1, comp2}

		pagination := shared.Pagination{Page: 1, PageSize: 50}
		result := shared.NewPagedResult(companies, 2, pagination)

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(&result, nil).Once()

		rec := setup.Get("/companies")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		pagination := shared.Pagination{Page: 2, PageSize: 10}
		result := shared.NewPagedResult([]*company.Company{}, 50, pagination)

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return(&result, nil).Once()

		rec := setup.Get("/companies?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no companies", func(t *testing.T) {
		pagination := shared.Pagination{Page: 1, PageSize: 50}
		result := shared.NewPagedResult([]*company.Company{}, 0, pagination)

		mockSvc.On("ListByWorkspace", mock.Anything, setup.WorkspaceID, mock.Anything).
			Return(&result, nil).Once()

		rec := setup.Get("/companies")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestCompanyHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	company.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("gets company by ID", func(t *testing.T) {
		testCompany, _ := company.NewCompany(setup.WorkspaceID, "Test Corp", nil, nil)
		companyID := testCompany.ID()

		mockSvc.On("GetByID", mock.Anything, companyID, setup.WorkspaceID).
			Return(testCompany, nil).Once()

		rec := setup.Get(fmt.Sprintf("/companies/%s", companyID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when company not found", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, companyID, setup.WorkspaceID).
			Return(nil, company.ErrCompanyNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/companies/%s", companyID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestCompanyHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	company.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("updates company successfully", func(t *testing.T) {
		website := "https://updated.com"
		testCompany, _ := company.NewCompany(setup.WorkspaceID, "Updated Corp", &website, nil)
		companyID := testCompany.ID()

		// Mock GetByID first (handler calls it to get current company)
		currentCompany, _ := company.NewCompany(setup.WorkspaceID, "Original Corp", nil, nil)
		mockSvc.On("GetByID", mock.Anything, companyID, setup.WorkspaceID).
			Return(currentCompany, nil).Once()

		mockSvc.On("Update", mock.Anything, companyID, setup.WorkspaceID, mock.Anything).
			Return(testCompany, nil).Once()

		body := `{"name":"Updated Corp","website":"https://updated.com"}`
		rec := setup.Patch(fmt.Sprintf("/companies/%s", companyID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when company not found", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, companyID, setup.WorkspaceID).
			Return(nil, company.ErrCompanyNotFound).Once()

		body := `{"name":"Updated"}`
		rec := setup.Patch(fmt.Sprintf("/companies/%s", companyID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 422 for empty name", func(t *testing.T) {
		// Validation happens at HTTP layer, so service is never called
		companyID := uuid.New()

		body := `{"name":""}`
		rec := setup.Patch(fmt.Sprintf("/companies/%s", companyID), body)

		testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
	})
}

func TestCompanyHandler_Archive(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	company.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("archives company successfully", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("Archive", mock.Anything, companyID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/companies/%s/archive", companyID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when company not found", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("Archive", mock.Anything, companyID, setup.WorkspaceID).
			Return(company.ErrCompanyNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/companies/%s/archive", companyID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestCompanyHandler_Restore(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	company.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("restores company successfully", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("Restore", mock.Anything, companyID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/companies/%s/restore", companyID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when company not found", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("Restore", mock.Anything, companyID, setup.WorkspaceID).
			Return(company.ErrCompanyNotFound).Once()

		rec := setup.Post(fmt.Sprintf("/companies/%s/restore", companyID), "")

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestCompanyHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	company.RegisterRoutes(setup.API, mockSvc, nil)

	t.Run("deletes company successfully", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("Delete", mock.Anything, companyID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/companies/%s", companyID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when company not found", func(t *testing.T) {
		companyID := uuid.New()

		mockSvc.On("Delete", mock.Anything, companyID, setup.WorkspaceID).
			Return(company.ErrCompanyNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/companies/%s", companyID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

// Event Publishing Tests

func TestCompanyHandler_Create_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	company.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	website := "https://example.com"
	testCompany, _ := company.NewCompany(setup.WorkspaceID, "Acme Corp", &website, nil)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input company.CreateInput) bool {
		return input.Name == "Acme Corp"
	})).Return(testCompany, nil).Once()

	body := `{"name":"Acme Corp","website":"https://example.com"}`
	rec := setup.Post("/companies", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "company.created", event.Type)
	assert.Equal(t, "company", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, testCompany.ID().String(), event.EntityID)
	assert.NotNil(t, event.Data)
	assert.Equal(t, testCompany.ID(), event.Data["id"])
	assert.Equal(t, testCompany.Name(), event.Data["name"])
}

func TestCompanyHandler_Update_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	company.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	website := "https://updated.com"
	testCompany, _ := company.NewCompany(setup.WorkspaceID, "Updated Corp", &website, nil)
	companyID := testCompany.ID()

	// Mock GetByID first (handler calls it to get current company)
	currentCompany, _ := company.NewCompany(setup.WorkspaceID, "Original Corp", nil, nil)
	mockSvc.On("GetByID", mock.Anything, companyID, setup.WorkspaceID).
		Return(currentCompany, nil).Once()

	mockSvc.On("Update", mock.Anything, companyID, setup.WorkspaceID, mock.Anything).
		Return(testCompany, nil).Once()

	body := `{"name":"Updated Corp","website":"https://updated.com"}`
	rec := setup.Patch(fmt.Sprintf("/companies/%s", companyID), body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)

	// Wait for event
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "company.updated", event.Type)
	assert.Equal(t, "company", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, companyID.String(), event.EntityID)
}

func TestCompanyHandler_Archive_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	company.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	companyID := uuid.New()

	mockSvc.On("Archive", mock.Anything, companyID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/companies/%s/archive", companyID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event (archive emits deleted event)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "company.deleted", event.Type)
	assert.Equal(t, "company", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, companyID.String(), event.EntityID)
}

func TestCompanyHandler_Restore_PublishesEvent(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
	capture.Start()
	defer capture.Stop()

	company.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

	companyID := uuid.New()

	mockSvc.On("Restore", mock.Anything, companyID, setup.WorkspaceID).
		Return(nil).Once()

	rec := setup.Post(fmt.Sprintf("/companies/%s/restore", companyID), "")

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSvc.AssertExpectations(t)

	// Wait for event (restore emits created event)
	assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

	event := capture.GetLastEvent()
	assert.NotNil(t, event)
	assert.Equal(t, "company.created", event.Type)
	assert.Equal(t, "company", event.EntityType)
	assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
	assert.Equal(t, setup.UserID, event.UserID)
	assert.Equal(t, companyID.String(), event.EntityID)
}

func TestCompanyHandler_Create_NilBroadcaster_NoError(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	// Register with nil broadcaster
	company.RegisterRoutes(setup.API, mockSvc, nil)

	website := "https://example.com"
	testCompany, _ := company.NewCompany(setup.WorkspaceID, "Acme Corp", &website, nil)

	mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input company.CreateInput) bool {
		return input.Name == "Acme Corp"
	})).Return(testCompany, nil).Once()

	body := `{"name":"Acme Corp","website":"https://example.com"}`
	rec := setup.Post("/companies", body)

	// Should not panic and should succeed
	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSvc.AssertExpectations(t)
}
