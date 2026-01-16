package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Simple test implementation without external dependencies
type testPendingChangeCreator struct {
	createCalled      bool
	createdWorkspaceID uuid.UUID
	createdRequesterID uuid.UUID
	createdEntityType string
	createdEntityID   *uuid.UUID
	createdAction     string
	createdPayload    json.RawMessage
	returnChangeID    uuid.UUID
	returnError       error
}

func (m *testPendingChangeCreator) CreatePendingChange(
	ctx context.Context,
	workspaceID uuid.UUID,
	requesterID uuid.UUID,
	entityType string,
	entityID *uuid.UUID,
	action string,
	payload json.RawMessage,
) (changeID uuid.UUID, err error) {
	m.createCalled = true
	m.createdWorkspaceID = workspaceID
	m.createdRequesterID = requesterID
	m.createdEntityType = entityType
	m.createdEntityID = entityID
	m.createdAction = action
	m.createdPayload = payload
	return m.returnChangeID, m.returnError
}

func TestApprovalMiddleware_Integration(t *testing.T) {
	t.Run("member creates item - creates pending change", func(t *testing.T) {
		changeID := uuid.New()
		mock := &testPendingChangeCreator{
			returnChangeID: changeID,
		}

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be called - request should be intercepted")
			w.WriteHeader(http.StatusOK)
		})

		mw := ApprovalMiddleware(mock)

		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				workspaceID := uuid.New()
				userID := uuid.New()

				authUser := &AuthUser{
					ID:       userID,
					Email:    "member@example.com",
					FullName: "Member User",
				}

				ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
				ctx = context.WithValue(ctx, UserContextKey, authUser)
				ctx = context.WithValue(ctx, RoleContextKey, "member")

				next.ServeHTTP(w, r.WithContext(ctx))
			})
		})
		r.Use(mw)
		r.Post("/workspaces/{workspace_id}/items", testHandler)

		body := `{"name":"Test Item","sku":"TST-001"}`
		req := httptest.NewRequest(http.MethodPost, "/workspaces/550e8400-e29b-41d4-a716-446655440000/items", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusAccepted, rr.Code)
		assert.True(t, mock.createCalled)
		assert.Equal(t, "create", mock.createdAction)
		assert.Equal(t, "item", mock.createdEntityType)

		var response map[string]interface{}
		err := json.NewDecoder(rr.Body).Decode(&response)
		require.NoError(t, err)
		assert.Equal(t, "pending_approval", response["status"])
		assert.Equal(t, changeID.String(), response["pending_change_id"])
	})

	t.Run("owner creates item - bypasses approval", func(t *testing.T) {
		mock := &testPendingChangeCreator{}

		handlerCalled := false
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"id":"123","name":"Test Item"}`))
		})

		mw := ApprovalMiddleware(mock)

		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				workspaceID := uuid.New()
				userID := uuid.New()

				authUser := &AuthUser{
					ID:       userID,
					Email:    "owner@example.com",
					FullName: "Owner User",
				}

				ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
				ctx = context.WithValue(ctx, UserContextKey, authUser)
				ctx = context.WithValue(ctx, RoleContextKey, "owner")

				next.ServeHTTP(w, r.WithContext(ctx))
			})
		})
		r.Use(mw)
		r.Post("/workspaces/{workspace_id}/items", testHandler)

		body := `{"name":"Test Item","sku":"TST-001"}`
		req := httptest.NewRequest(http.MethodPost, "/workspaces/550e8400-e29b-41d4-a716-446655440000/items", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusCreated, rr.Code)
		assert.False(t, mock.createCalled)
		assert.True(t, handlerCalled)
	})

	t.Run("admin updates category - bypasses approval", func(t *testing.T) {
		mock := &testPendingChangeCreator{}

		handlerCalled := false
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			w.WriteHeader(http.StatusOK)
		})

		mw := ApprovalMiddleware(mock)

		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				workspaceID := uuid.New()
				userID := uuid.New()

				authUser := &AuthUser{
					ID:       userID,
					Email:    "admin@example.com",
					FullName: "Admin User",
				}

				ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
				ctx = context.WithValue(ctx, UserContextKey, authUser)
				ctx = context.WithValue(ctx, RoleContextKey, "admin")

				next.ServeHTTP(w, r.WithContext(ctx))
			})
		})
		r.Use(mw)
		r.Route("/workspaces/{workspace_id}/categories/{id}", func(r chi.Router) {
			r.Put("/", testHandler)
		})

		body := `{"name":"Updated Category"}`
		categoryID := uuid.New()
		req := httptest.NewRequest(
			http.MethodPut,
			"/workspaces/550e8400-e29b-41d4-a716-446655440000/categories/"+categoryID.String(),
			bytes.NewBufferString(body),
		)
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.False(t, mock.createCalled)
		assert.True(t, handlerCalled)
	})

	t.Run("member GET request - not intercepted", func(t *testing.T) {
		mock := &testPendingChangeCreator{}

		handlerCalled := false
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			handlerCalled = true
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"items":[]}`))
		})

		mw := ApprovalMiddleware(mock)

		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				workspaceID := uuid.New()
				userID := uuid.New()

				authUser := &AuthUser{
					ID:       userID,
					Email:    "member@example.com",
					FullName: "Member User",
				}

				ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
				ctx = context.WithValue(ctx, UserContextKey, authUser)
				ctx = context.WithValue(ctx, RoleContextKey, "member")

				next.ServeHTTP(w, r.WithContext(ctx))
			})
		})
		r.Use(mw)
		r.Get("/workspaces/{workspace_id}/items", testHandler)

		req := httptest.NewRequest(http.MethodGet, "/workspaces/550e8400-e29b-41d4-a716-446655440000/items", nil)

		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.False(t, mock.createCalled)
		assert.True(t, handlerCalled)
	})

	t.Run("member deletes location - creates pending change", func(t *testing.T) {
		changeID := uuid.New()
		mock := &testPendingChangeCreator{
			returnChangeID: changeID,
		}

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Error("handler should not be called - request should be intercepted")
			w.WriteHeader(http.StatusOK)
		})

		mw := ApprovalMiddleware(mock)

		r := chi.NewRouter()
		r.Route("/workspaces/{workspace_id}/locations/{id}", func(r chi.Router) {
			r.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					workspaceID := uuid.New()
					userID := uuid.New()

					authUser := &AuthUser{
						ID:       userID,
						Email:    "member@example.com",
						FullName: "Member User",
					}

					ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
					ctx = context.WithValue(ctx, UserContextKey, authUser)
					ctx = context.WithValue(ctx, RoleContextKey, "member")

					next.ServeHTTP(w, r.WithContext(ctx))
				})
			})
			r.Use(mw)
			r.Delete("/", testHandler)
		})

		locationID := uuid.New()
		req := httptest.NewRequest(
			http.MethodDelete,
			"/workspaces/550e8400-e29b-41d4-a716-446655440000/locations/"+locationID.String(),
			nil,
		)

		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusAccepted, rr.Code)
		assert.True(t, mock.createCalled)
		assert.Equal(t, "delete", mock.createdAction)
		assert.Equal(t, "location", mock.createdEntityType)
		require.NotNil(t, mock.createdEntityID)
		assert.Equal(t, locationID, *mock.createdEntityID)
	})
}

func TestExtractEntityType(t *testing.T) {
	tests := []struct {
		path           string
		expectedEntity string
		shouldIntercept bool
	}{
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/items", "item", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/categories", "category", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/locations", "location", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/containers", "container", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/inventory", "inventory", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/borrowers", "borrower", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/loans", "loan", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/labels", "label", true},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/unknown", "", false},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000/members", "", false},
		{"/workspaces/550e8400-e29b-41d4-a716-446655440000", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			changeID := uuid.New()
			mock := &testPendingChangeCreator{
				returnChangeID: changeID,
			}

			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})

			mw := ApprovalMiddleware(mock)

			r := chi.NewRouter()
			r.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					workspaceID := uuid.New()
					userID := uuid.New()

					authUser := &AuthUser{
						ID:       userID,
						Email:    "member@example.com",
						FullName: "Member User",
					}

					ctx := context.WithValue(r.Context(), WorkspaceContextKey, workspaceID)
					ctx = context.WithValue(ctx, UserContextKey, authUser)
					ctx = context.WithValue(ctx, RoleContextKey, "member")

					next.ServeHTTP(w, r.WithContext(ctx))
				})
			})
			r.Use(mw)
			r.Mount("/", testHandler)

			req := httptest.NewRequest(http.MethodPost, tt.path, bytes.NewBufferString(`{"test":"data"}`))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)

			if tt.shouldIntercept {
				assert.True(t, mock.createCalled, "expected interception for entity type: "+tt.expectedEntity)
				assert.Equal(t, tt.expectedEntity, mock.createdEntityType)
				assert.Equal(t, http.StatusAccepted, rr.Code)
			} else {
				assert.False(t, mock.createCalled, "expected no interception for path: "+tt.path)
				assert.Equal(t, http.StatusOK, rr.Code)
			}
		})
	}
}
