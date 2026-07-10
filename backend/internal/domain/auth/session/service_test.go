package session

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockRepository is a mock implementation of the Repository interface.
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, session *Session) error {
	args := m.Called(ctx, session)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id uuid.UUID) (*Session, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Session), args.Error(1)
}

func (m *MockRepository) FindByTokenHash(ctx context.Context, hash string) (*Session, error) {
	args := m.Called(ctx, hash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Session), args.Error(1)
}

func (m *MockRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*Session, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Session), args.Error(1)
}

func (m *MockRepository) UpdateActivity(ctx context.Context, id uuid.UUID, newTokenHash string) error {
	args := m.Called(ctx, id, newTokenHash)
	return args.Error(0)
}

func (m *MockRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *MockRepository) DeleteAllExcept(ctx context.Context, userID, exceptID uuid.UUID) error {
	args := m.Called(ctx, userID, exceptID)
	return args.Error(0)
}

func (m *MockRepository) DeleteAllForUser(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

// --- Create ---

func TestService_Create_SavesAndReturnsSessionWithSevenDayExpiry(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	userID := uuid.New()

	var saved *Session
	repo.On("Save", mock.Anything, mock.AnythingOfType("*session.Session")).
		Run(func(args mock.Arguments) { saved = args.Get(1).(*Session) }).
		Return(nil)

	before := time.Now()
	got, err := svc.Create(context.Background(), userID, "refresh-tok", "ua", "1.2.3.4")
	after := time.Now()

	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Same(t, saved, got)
	assert.Equal(t, userID, got.UserID())
	assert.Equal(t, HashToken("refresh-tok"), got.TokenHash())

	// expiresAt must land ~7 days out (refreshDuration), bracketed by
	// calls made immediately before/after Create.
	assert.True(t, !got.ExpiresAt().Before(before.Add(7*24*time.Hour)))
	assert.True(t, !got.ExpiresAt().After(after.Add(7*24*time.Hour)))
	repo.AssertExpectations(t)
}

func TestService_Create_RepoErrorPropagates(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	repo.On("Save", mock.Anything, mock.Anything).Return(assert.AnError)

	got, err := svc.Create(context.Background(), uuid.New(), "tok", "ua", "1.2.3.4")

	require.Error(t, err)
	assert.Nil(t, got)
}

// --- FindByTokenHash (resolve) ---

func TestService_FindByTokenHash_Found(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	want := NewSession(uuid.New(), "tok", "ua", "1.2.3.4", time.Now().Add(time.Hour))
	repo.On("FindByTokenHash", mock.Anything, "hash123").Return(want, nil)

	got, err := svc.FindByTokenHash(context.Background(), "hash123")

	require.NoError(t, err)
	assert.Same(t, want, got)
}

func TestService_FindByTokenHash_NotFound(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	repo.On("FindByTokenHash", mock.Anything, "missing").Return(nil, nil)

	got, err := svc.FindByTokenHash(context.Background(), "missing")

	require.ErrorIs(t, err, ErrSessionNotFound)
	assert.Nil(t, got)
}

func TestService_FindByTokenHash_RepoErrorPropagates(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	repo.On("FindByTokenHash", mock.Anything, "hash").Return(nil, assert.AnError)

	got, err := svc.FindByTokenHash(context.Background(), "hash")

	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrSessionNotFound)
	assert.Nil(t, got)
}

// --- FindByUserID ---

func TestService_FindByUserID_Passthrough(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	userID := uuid.New()
	want := []*Session{NewSession(userID, "tok", "ua", "1.2.3.4", time.Now().Add(time.Hour))}
	repo.On("FindByUserID", mock.Anything, userID).Return(want, nil)

	got, err := svc.FindByUserID(context.Background(), userID)

	require.NoError(t, err)
	assert.Equal(t, want, got)
}

// --- UpdateActivity ---

func TestService_UpdateActivity_HashesNewTokenBeforeStoring(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	sessionID := uuid.New()
	repo.On("UpdateActivity", mock.Anything, sessionID, HashToken("new-refresh-tok")).Return(nil)

	err := svc.UpdateActivity(context.Background(), sessionID, "new-refresh-tok")

	require.NoError(t, err)
	repo.AssertExpectations(t)
}

// --- Revoke ---

func TestService_Revoke_DeletesByIDAndUser(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	userID, sessionID := uuid.New(), uuid.New()
	repo.On("Delete", mock.Anything, sessionID, userID).Return(nil)

	err := svc.Revoke(context.Background(), userID, sessionID)

	require.NoError(t, err)
	repo.AssertExpectations(t)
}

func TestService_Revoke_RepoErrorPropagates(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	repo.On("Delete", mock.Anything, mock.Anything, mock.Anything).Return(assert.AnError)

	err := svc.Revoke(context.Background(), uuid.New(), uuid.New())

	require.Error(t, err)
}

// --- RevokeAllExcept ---

func TestService_RevokeAllExcept_DeletesAllButCurrent(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	userID, currentID := uuid.New(), uuid.New()
	repo.On("DeleteAllExcept", mock.Anything, userID, currentID).Return(nil)

	err := svc.RevokeAllExcept(context.Background(), userID, currentID)

	require.NoError(t, err)
	repo.AssertExpectations(t)
}

// --- RevokeAll ---

func TestService_RevokeAll_DeletesEveryUserSession(t *testing.T) {
	repo := new(MockRepository)
	svc := NewService(repo)
	userID := uuid.New()
	repo.On("DeleteAllForUser", mock.Anything, userID).Return(nil)

	err := svc.RevokeAll(context.Background(), userID)

	require.NoError(t, err)
	repo.AssertExpectations(t)
}
