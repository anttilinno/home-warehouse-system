package user_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockSessionService implements session.ServiceInterface
type MockSessionService struct {
	mock.Mock
}

func (m *MockSessionService) Create(ctx context.Context, userID uuid.UUID, refreshToken, userAgent, ipAddress string) (*session.Session, error) {
	args := m.Called(ctx, userID, refreshToken, userAgent, ipAddress)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*session.Session), args.Error(1)
}

func (m *MockSessionService) FindByTokenHash(ctx context.Context, tokenHash string) (*session.Session, error) {
	args := m.Called(ctx, tokenHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*session.Session), args.Error(1)
}

func (m *MockSessionService) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*session.Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*session.Session), args.Error(1)
}

func (m *MockSessionService) UpdateActivity(ctx context.Context, sessionID uuid.UUID, newRefreshToken string) error {
	args := m.Called(ctx, sessionID, newRefreshToken)
	return args.Error(0)
}

func (m *MockSessionService) Revoke(ctx context.Context, userID, sessionID uuid.UUID) error {
	args := m.Called(ctx, userID, sessionID)
	return args.Error(0)
}

func (m *MockSessionService) RevokeAllExcept(ctx context.Context, userID, currentSessionID uuid.UUID) error {
	args := m.Called(ctx, userID, currentSessionID)
	return args.Error(0)
}

func (m *MockSessionService) RevokeAll(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

// postWithCookie posts to the test router with a cookie attached.
func postWithCookie(setup *testutil.HandlerTestSetup, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	setup.Router.ServeHTTP(rec, req)
	return rec
}

// F2: logout must revoke the server-side session for the refresh token.
func TestUserHandler_Logout_RevokesSession(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockSessionSvc := new(MockSessionService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.SetSessionService(mockSessionSvc)
	handler.RegisterPublicRoutes(setup.API)

	userID := uuid.New()
	refreshToken, _ := jwtSvc.GenerateRefreshToken(userID)
	sess := session.NewSession(userID, refreshToken, "test-agent", "127.0.0.1", time.Now().Add(time.Hour))

	mockSessionSvc.On("FindByTokenHash", mock.Anything, session.HashToken(refreshToken)).
		Return(sess, nil).Once()
	mockSessionSvc.On("Revoke", mock.Anything, userID, sess.ID()).
		Return(nil).Once()

	rec := postWithCookie(setup, "/auth/logout", "", &http.Cookie{Name: "refresh_token", Value: refreshToken})

	testutil.AssertStatus(t, rec, http.StatusNoContent)
	mockSessionSvc.AssertExpectations(t)

	// Cookies must still be cleared
	accessCookie := getCookie(rec, "access_token")
	if accessCookie == nil || accessCookie.MaxAge >= 0 {
		t.Error("access_token cookie should be cleared")
	}
}

// F2: logout with a missing/unknown token must still clear cookies (graceful).
func TestUserHandler_Logout_GracefulWithoutSession(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockSessionSvc := new(MockSessionService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.SetSessionService(mockSessionSvc)
	handler.RegisterPublicRoutes(setup.API)

	t.Run("no cookie at all", func(t *testing.T) {
		rec := postWithCookie(setup, "/auth/logout", "", nil)
		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSessionSvc.AssertNotCalled(t, "FindByTokenHash", mock.Anything, mock.Anything)
	})

	t.Run("unknown token", func(t *testing.T) {
		mockSessionSvc.On("FindByTokenHash", mock.Anything, mock.Anything).
			Return(nil, session.ErrSessionNotFound).Once()

		rec := postWithCookie(setup, "/auth/logout", "", &http.Cookie{Name: "refresh_token", Value: "bogus"})

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSessionSvc.AssertNotCalled(t, "Revoke", mock.Anything, mock.Anything, mock.Anything)
	})
}

// F3: a refresh token whose session was revoked must be rejected with 401 —
// no "legacy token" session re-creation.
func TestUserHandler_RefreshToken_RevokedSessionRejected(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockSessionSvc := new(MockSessionService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.SetSessionService(mockSessionSvc)
	handler.RegisterPublicRoutes(setup.API)

	userID := uuid.New()
	refreshToken, _ := jwtSvc.GenerateRefreshToken(userID)

	// Session not found = revoked (or never tracked) -> must 401
	mockSessionSvc.On("FindByTokenHash", mock.Anything, session.HashToken(refreshToken)).
		Return(nil, session.ErrSessionNotFound).Once()

	body := fmt.Sprintf(`{"refresh_token":"%s"}`, refreshToken)
	rec := setup.Post("/auth/refresh", body)

	testutil.AssertStatus(t, rec, http.StatusUnauthorized)
	// The revoked token must NOT mint a fresh session
	mockSessionSvc.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	mockSessionSvc.AssertExpectations(t)
}

// F3: a valid (tracked) session refreshes normally and rotates the hash.
func TestUserHandler_RefreshToken_ValidSessionRotates(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	mockSessionSvc := new(MockSessionService)
	jwtSvc := jwt.NewService("test-secret", 24)
	handler := user.NewHandler(mockSvc, jwtSvc, nil)
	handler.SetSessionService(mockSessionSvc)
	handler.RegisterPublicRoutes(setup.API)

	testUser, _ := user.NewUser("test@example.com", "Test User", "password123")
	userID := testUser.ID()
	refreshToken, _ := jwtSvc.GenerateRefreshToken(userID)
	sess := session.NewSession(userID, refreshToken, "test-agent", "127.0.0.1", time.Now().Add(time.Hour))

	mockSessionSvc.On("FindByTokenHash", mock.Anything, session.HashToken(refreshToken)).
		Return(sess, nil).Once()
	mockSvc.On("GetByID", mock.Anything, userID).Return(testUser, nil).Once()
	mockSessionSvc.On("UpdateActivity", mock.Anything, sess.ID(), mock.Anything).
		Return(nil).Once()

	body := fmt.Sprintf(`{"refresh_token":"%s"}`, refreshToken)
	rec := setup.Post("/auth/refresh", body)

	testutil.AssertStatus(t, rec, http.StatusOK)
	mockSessionSvc.AssertExpectations(t)
	mockSvc.AssertExpectations(t)
}
