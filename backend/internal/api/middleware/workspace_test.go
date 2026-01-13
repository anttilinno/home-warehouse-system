package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Mock Member Repository for Tests
// =============================================================================

type mockMemberRepo struct {
	members map[string]WorkspaceMember // key: "workspaceID:userID"
	err     error
}

func newMockMemberRepo() *mockMemberRepo {
	return &mockMemberRepo{
		members: make(map[string]WorkspaceMember),
	}
}

func (m *mockMemberRepo) addMember(workspaceID, userID uuid.UUID, role string) {
	key := workspaceID.String() + ":" + userID.String()
	m.members[key] = &roleMember{role: role}
}

func (m *mockMemberRepo) setError(err error) {
	m.err = err
}

func (m *mockMemberRepo) FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (WorkspaceMember, error) {
	if m.err != nil {
		return nil, m.err
	}
	key := workspaceID.String() + ":" + userID.String()
	member, ok := m.members[key]
	if !ok {
		return nil, nil
	}
	return member, nil
}

// =============================================================================
// Workspace Middleware Tests
// =============================================================================

func TestWorkspace_ValidWorkspaceID(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	// Create mock repository with user as member
	mockRepo := newMockMemberRepo()
	mockRepo.addMember(workspaceID, userID, "MEMBER")

	nextCalled := false
	var capturedWorkspaceID uuid.UUID

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		wsID, ok := GetWorkspaceID(r.Context())
		assert.True(t, ok)
		capturedWorkspaceID = wsID
		w.WriteHeader(http.StatusOK)
	})

	// Setup chi router with workspace_id parameter
	r := chi.NewRouter()
	r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				// Add authenticated user to context first
				user := &AuthUser{
					ID:          userID,
					Email:       "test@example.com",
					IsSuperuser: false,
				}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		r.Use(Workspace(mockRepo))
		r.Get("/test", handler)
	})

	req := httptest.NewRequest(http.MethodGet, "/workspaces/"+workspaceID.String()+"/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, nextCalled)
	assert.Equal(t, workspaceID, capturedWorkspaceID)
}

func TestWorkspace_InvalidWorkspaceID(t *testing.T) {
	userID := uuid.New()

	// Create mock repository
	mockRepo := newMockMemberRepo()

	tests := []struct {
		name        string
		workspaceID string
	}{
		{"invalid uuid", "not-a-uuid"},
		{"empty string", ""},
		{"partial uuid", "12345"},
		{"malformed", "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nextCalled := false
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				nextCalled = true
				w.WriteHeader(http.StatusOK)
			})

			// Setup chi router with workspace_id parameter
			r := chi.NewRouter()
			r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
				r.Use(func(next http.Handler) http.Handler {
					return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
						// Add authenticated user to context first
						user := &AuthUser{
							ID:          userID,
							Email:       "test@example.com",
							IsSuperuser: false,
						}
						ctx := context.WithValue(req.Context(), UserContextKey, user)
						next.ServeHTTP(w, req.WithContext(ctx))
					})
				})
				r.Use(Workspace(mockRepo))
				r.Get("/test", handler)
			})

			req := httptest.NewRequest(http.MethodGet, "/workspaces/"+tt.workspaceID+"/test", nil)
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			assert.Equal(t, http.StatusBadRequest, rec.Code)
			assert.False(t, nextCalled)
			assert.Contains(t, rec.Body.String(), "invalid workspace ID")
		})
	}
}

func TestWorkspace_NoAuthenticatedUser(t *testing.T) {
	workspaceID := uuid.New()

	// Create mock repository
	mockRepo := newMockMemberRepo()

	nextCalled := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	// Setup chi router WITHOUT authenticated user in context
	r := chi.NewRouter()
	r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
		r.Use(Workspace(mockRepo))
		r.Get("/test", handler)
	})

	req := httptest.NewRequest(http.MethodGet, "/workspaces/"+workspaceID.String()+"/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.False(t, nextCalled)
	assert.Contains(t, rec.Body.String(), "not authenticated")
}

func TestWorkspace_WorkspaceIDInContext(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	// Create mock repository with user as member
	mockRepo := newMockMemberRepo()
	mockRepo.addMember(workspaceID, userID, "MEMBER")

	var capturedContext context.Context

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedContext = r.Context()
		w.WriteHeader(http.StatusOK)
	})

	// Setup chi router with workspace_id parameter
	r := chi.NewRouter()
	r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				user := &AuthUser{
					ID:          userID,
					Email:       "test@example.com",
					IsSuperuser: false,
				}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		r.Use(Workspace(mockRepo))
		r.Get("/test", handler)
	})

	req := httptest.NewRequest(http.MethodGet, "/workspaces/"+workspaceID.String()+"/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.NotNil(t, capturedContext)

	// Verify workspace ID is in context using helper function
	wsID, ok := GetWorkspaceID(capturedContext)
	assert.True(t, ok)
	assert.Equal(t, workspaceID, wsID)

	// Verify direct context value access
	contextValue := capturedContext.Value(WorkspaceContextKey)
	assert.NotNil(t, contextValue)
	extractedID, ok := contextValue.(uuid.UUID)
	assert.True(t, ok)
	assert.Equal(t, workspaceID, extractedID)
}

func TestWorkspace_PreservesUserContext(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()
	email := "preserve-test@example.com"

	// Create mock repository with user as member
	mockRepo := newMockMemberRepo()
	mockRepo.addMember(workspaceID, userID, "OWNER")

	var capturedContext context.Context

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedContext = r.Context()
		w.WriteHeader(http.StatusOK)
	})

	// Setup chi router
	r := chi.NewRouter()
	r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				user := &AuthUser{
					ID:          userID,
					Email:       email,
					IsSuperuser: true,
				}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		r.Use(Workspace(mockRepo))
		r.Get("/test", handler)
	})

	req := httptest.NewRequest(http.MethodGet, "/workspaces/"+workspaceID.String()+"/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	// Verify both user and workspace are in context
	user, ok := GetAuthUser(capturedContext)
	assert.True(t, ok)
	assert.Equal(t, userID, user.ID)
	assert.Equal(t, email, user.Email)
	assert.True(t, user.IsSuperuser)

	wsID, ok := GetWorkspaceID(capturedContext)
	assert.True(t, ok)
	assert.Equal(t, workspaceID, wsID)

	// Verify role is in context
	role, ok := GetRole(capturedContext)
	assert.True(t, ok)
	assert.Equal(t, "OWNER", role)
}

func TestWorkspace_MultipleWorkspaces(t *testing.T) {
	userID := uuid.New()
	workspace1 := uuid.New()
	workspace2 := uuid.New()

	// Create mock repository with user as member of both workspaces
	mockRepo := newMockMemberRepo()
	mockRepo.addMember(workspace1, userID, "MEMBER")
	mockRepo.addMember(workspace2, userID, "ADMIN")

	// Test that different workspace IDs are correctly extracted
	workspaces := []uuid.UUID{workspace1, workspace2}

	for i, wsID := range workspaces {
		t.Run("workspace_"+string(rune(i+1)), func(t *testing.T) {
			var capturedWorkspaceID uuid.UUID

			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				id, ok := GetWorkspaceID(r.Context())
				assert.True(t, ok)
				capturedWorkspaceID = id
				w.WriteHeader(http.StatusOK)
			})

			r := chi.NewRouter()
			r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
				r.Use(func(next http.Handler) http.Handler {
					return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
						user := &AuthUser{ID: userID, Email: "test@example.com"}
						ctx := context.WithValue(req.Context(), UserContextKey, user)
						next.ServeHTTP(w, req.WithContext(ctx))
					})
				})
				r.Use(Workspace(mockRepo))
				r.Get("/test", handler)
			})

			req := httptest.NewRequest(http.MethodGet, "/workspaces/"+wsID.String()+"/test", nil)
			rec := httptest.NewRecorder()

			r.ServeHTTP(rec, req)

			assert.Equal(t, http.StatusOK, rec.Code)
			assert.Equal(t, wsID, capturedWorkspaceID)
		})
	}
}

func TestWorkspace_UserNotMemberOfWorkspace(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	// Create mock repository WITHOUT adding user as member
	mockRepo := newMockMemberRepo()

	nextCalled := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	r := chi.NewRouter()
	r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				user := &AuthUser{ID: userID, Email: "test@example.com"}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		r.Use(Workspace(mockRepo))
		r.Get("/test", handler)
	})

	req := httptest.NewRequest(http.MethodGet, "/workspaces/"+workspaceID.String()+"/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.False(t, nextCalled)
	assert.Contains(t, rec.Body.String(), "not a member")
}

func TestWorkspace_RepositoryError(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	// Create mock repository that returns error
	mockRepo := newMockMemberRepo()
	mockRepo.setError(errors.New("database error"))

	nextCalled := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	r := chi.NewRouter()
	r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				user := &AuthUser{ID: userID, Email: "test@example.com"}
				ctx := context.WithValue(req.Context(), UserContextKey, user)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		r.Use(Workspace(mockRepo))
		r.Get("/test", handler)
	})

	req := httptest.NewRequest(http.MethodGet, "/workspaces/"+workspaceID.String()+"/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.False(t, nextCalled)
	assert.Contains(t, rec.Body.String(), "access denied")
}
