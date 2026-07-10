package session

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// MockServiceInterface is a mock implementation of ServiceInterface.
type MockServiceInterface struct {
	mock.Mock
}

func (m *MockServiceInterface) Create(ctx context.Context, userID uuid.UUID, refreshToken, userAgent, ipAddress string) (*Session, error) {
	args := m.Called(ctx, userID, refreshToken, userAgent, ipAddress)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Session), args.Error(1)
}

func (m *MockServiceInterface) FindByTokenHash(ctx context.Context, tokenHash string) (*Session, error) {
	args := m.Called(ctx, tokenHash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Session), args.Error(1)
}

func (m *MockServiceInterface) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Session), args.Error(1)
}

func (m *MockServiceInterface) UpdateActivity(ctx context.Context, sessionID uuid.UUID, newRefreshToken string) error {
	args := m.Called(ctx, sessionID, newRefreshToken)
	return args.Error(0)
}

func (m *MockServiceInterface) Revoke(ctx context.Context, userID, sessionID uuid.UUID) error {
	args := m.Called(ctx, userID, sessionID)
	return args.Error(0)
}

func (m *MockServiceInterface) RevokeAllExcept(ctx context.Context, userID, currentSessionID uuid.UUID) error {
	args := m.Called(ctx, userID, currentSessionID)
	return args.Error(0)
}

func (m *MockServiceInterface) RevokeAll(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func authedContext(userID uuid.UUID) context.Context {
	ctx := context.WithValue(context.Background(), appMiddleware.UserContextKey, &appMiddleware.AuthUser{ID: userID})
	return ctx
}

func statusOf(t *testing.T, err error) int {
	t.Helper()
	var statusErr huma.StatusError
	require.ErrorAs(t, err, &statusErr)
	return statusErr.GetStatus()
}

// --- listSessions ---

func TestHandler_ListSessions_MarksCurrentSessionAndOmitsAuthDetails(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID := uuid.New()
	currentID, otherID := uuid.New(), uuid.New()
	ctx := appMiddleware.WithCurrentSessionID(authedContext(userID), currentID)

	now := time.Now()
	sessions := []*Session{
		Reconstitute(currentID, userID, "hash1", "Chrome on macOS", "1.2.3.4", "ua1", now, now.Add(time.Hour), now),
		Reconstitute(otherID, userID, "hash2", "Safari on iPhone", "5.6.7.8", "ua2", now, now.Add(time.Hour), now),
	}
	svc.On("FindByUserID", mock.Anything, userID).Return(sessions, nil)

	out, err := h.listSessions(ctx, &struct{}{})

	require.NoError(t, err)
	require.Len(t, out.Body, 2)
	assert.True(t, out.Body[0].IsCurrent)
	assert.False(t, out.Body[1].IsCurrent)
	assert.Equal(t, "Chrome on macOS", out.Body[0].DeviceInfo)
}

func TestHandler_ListSessions_NotAuthenticated(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)

	out, err := h.listSessions(context.Background(), &struct{}{})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusUnauthorized, statusOf(t, err))
}

func TestHandler_ListSessions_ServiceErrorMapsTo500(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID := uuid.New()
	svc.On("FindByUserID", mock.Anything, userID).Return(nil, assert.AnError)

	out, err := h.listSessions(authedContext(userID), &struct{}{})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusInternalServerError, statusOf(t, err))
}

// --- revokeSession ---

func TestHandler_RevokeSession_Success(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID := uuid.New()
	currentID, targetID := uuid.New(), uuid.New()
	ctx := appMiddleware.WithCurrentSessionID(authedContext(userID), currentID)
	svc.On("Revoke", mock.Anything, userID, targetID).Return(nil)

	out, err := h.revokeSession(ctx, &RevokeSessionInput{ID: targetID})

	require.NoError(t, err)
	assert.Nil(t, out)
	svc.AssertExpectations(t)
}

func TestHandler_RevokeSession_NotAuthenticated(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)

	out, err := h.revokeSession(context.Background(), &RevokeSessionInput{ID: uuid.New()})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusUnauthorized, statusOf(t, err))
}

func TestHandler_RevokeSession_CannotRevokeCurrentSession(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID, currentID := uuid.New(), uuid.New()
	ctx := appMiddleware.WithCurrentSessionID(authedContext(userID), currentID)

	out, err := h.revokeSession(ctx, &RevokeSessionInput{ID: currentID})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusBadRequest, statusOf(t, err))
	svc.AssertNotCalled(t, "Revoke", mock.Anything, mock.Anything, mock.Anything)
}

func TestHandler_RevokeSession_ServiceErrorMapsTo500(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID, targetID := uuid.New(), uuid.New()
	svc.On("Revoke", mock.Anything, userID, targetID).Return(assert.AnError)

	out, err := h.revokeSession(authedContext(userID), &RevokeSessionInput{ID: targetID})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusInternalServerError, statusOf(t, err))
}

// --- revokeAllOtherSessions ---

func TestHandler_RevokeAllOtherSessions_Success(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID, currentID := uuid.New(), uuid.New()
	ctx := appMiddleware.WithCurrentSessionID(authedContext(userID), currentID)
	svc.On("RevokeAllExcept", mock.Anything, userID, currentID).Return(nil)

	out, err := h.revokeAllOtherSessions(ctx, &struct{}{})

	require.NoError(t, err)
	assert.Nil(t, out)
	svc.AssertExpectations(t)
}

func TestHandler_RevokeAllOtherSessions_NotAuthenticated(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)

	out, err := h.revokeAllOtherSessions(context.Background(), &struct{}{})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusUnauthorized, statusOf(t, err))
}

func TestHandler_RevokeAllOtherSessions_NoCurrentSessionInContext(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID := uuid.New()

	out, err := h.revokeAllOtherSessions(authedContext(userID), &struct{}{})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusBadRequest, statusOf(t, err))
	svc.AssertNotCalled(t, "RevokeAllExcept", mock.Anything, mock.Anything, mock.Anything)
}

func TestHandler_RevokeAllOtherSessions_ServiceErrorMapsTo500(t *testing.T) {
	svc := new(MockServiceInterface)
	h := NewHandler(svc)
	userID, currentID := uuid.New(), uuid.New()
	ctx := appMiddleware.WithCurrentSessionID(authedContext(userID), currentID)
	svc.On("RevokeAllExcept", mock.Anything, userID, currentID).Return(assert.AnError)

	out, err := h.revokeAllOtherSessions(ctx, &struct{}{})

	require.Error(t, err)
	assert.Nil(t, out)
	assert.Equal(t, http.StatusInternalServerError, statusOf(t, err))
}
