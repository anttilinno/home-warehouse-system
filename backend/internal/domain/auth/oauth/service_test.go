package oauth

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

// MockRepository is a mock implementation of the Repository interface.
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) FindByProviderAndID(ctx context.Context, provider, providerUserID string) (*OAuthAccount, error) {
	args := m.Called(ctx, provider, providerUserID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*OAuthAccount), args.Error(1)
}

func (m *MockRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*OAuthAccount, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*OAuthAccount), args.Error(1)
}

func (m *MockRepository) Create(ctx context.Context, userID uuid.UUID, profile OAuthProfile) (*OAuthAccount, error) {
	args := m.Called(ctx, userID, profile)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*OAuthAccount), args.Error(1)
}

func (m *MockRepository) DeleteByProvider(ctx context.Context, userID uuid.UUID, provider string) error {
	args := m.Called(ctx, userID, provider)
	return args.Error(0)
}

func (m *MockRepository) CountByUserID(ctx context.Context, userID uuid.UUID) (int, error) {
	args := m.Called(ctx, userID)
	return args.Int(0), args.Error(1)
}

// MockUserService is a mock implementation of the UserService interface.
type MockUserService struct {
	mock.Mock
}

func (m *MockUserService) GetByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserService) GetByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserService) CreateOAuthUser(ctx context.Context, input user.CreateOAuthUserInput) (*user.User, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

// MockWorkspaceCreator is a mock implementation of the WorkspaceCreator interface.
type MockWorkspaceCreator struct {
	mock.Mock
}

func (m *MockWorkspaceCreator) CreatePersonalWorkspace(ctx context.Context, userID uuid.UUID, fullName string) error {
	args := m.Called(ctx, userID, fullName)
	return args.Error(0)
}

func newTestUser(t *testing.T, email string) *user.User {
	t.Helper()
	u, err := user.NewUser(email, "Test User", "password123")
	assert.NoError(t, err)
	return u
}

func TestService_FindOrCreateUser_ExistingLink(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "existing@example.com", EmailVerified: true}

	linkedUserID := uuid.New()
	linkedUser := newTestUser(t, profile.Email)
	account := Reconstruct(uuid.New(), linkedUserID, profile.Provider, profile.ProviderUserID, profile.Email, "", "", linkedUser.CreatedAt(), linkedUser.CreatedAt())

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(account, nil)
	userSvc.On("GetByID", ctx, linkedUserID).Return(linkedUser, nil)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.NoError(t, err)
	assert.False(t, isNew)
	assert.Equal(t, linkedUser, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
	wsCreator.AssertExpectations(t)
}

func TestService_FindOrCreateUser_FindLinkError(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "existing@example.com", EmailVerified: true}

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, assert.AnError)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.Error(t, err)
	assert.False(t, isNew)
	assert.Nil(t, u)
	repo.AssertExpectations(t)
}

func TestService_FindOrCreateUser_ExistingLinkGetUserError(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "existing@example.com", EmailVerified: true}
	linkedUserID := uuid.New()
	now := newTestUser(t, profile.Email).CreatedAt()
	account := Reconstruct(uuid.New(), linkedUserID, profile.Provider, profile.ProviderUserID, profile.Email, "", "", now, now)

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(account, nil)
	userSvc.On("GetByID", ctx, linkedUserID).Return(nil, assert.AnError)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.Error(t, err)
	assert.False(t, isNew)
	assert.Nil(t, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
}

func TestService_FindOrCreateUser_UnverifiedEmailRejected(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "unverified@example.com", EmailVerified: false}

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, nil)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.ErrorIs(t, err, ErrEmailNotVerified)
	assert.False(t, isNew)
	assert.Nil(t, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
	wsCreator.AssertExpectations(t)
}

func TestService_FindOrCreateUser_AutoLinkExistingUser(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "existing@example.com", EmailVerified: true, FullName: "Existing User"}
	existingUser := newTestUser(t, profile.Email)

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, nil)
	userSvc.On("GetByEmail", ctx, profile.Email).Return(existingUser, nil)
	repo.On("Create", ctx, existingUser.ID(), profile).Return(&OAuthAccount{}, nil)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.NoError(t, err)
	assert.False(t, isNew)
	assert.Equal(t, existingUser, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
	wsCreator.AssertExpectations(t)
}

func TestService_FindOrCreateUser_AutoLinkCreateError(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "existing@example.com", EmailVerified: true}
	existingUser := newTestUser(t, profile.Email)

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, nil)
	userSvc.On("GetByEmail", ctx, profile.Email).Return(existingUser, nil)
	repo.On("Create", ctx, existingUser.ID(), profile).Return(nil, assert.AnError)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.Error(t, err)
	assert.False(t, isNew)
	assert.Nil(t, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
}

func TestService_FindOrCreateUser_CreatesNewUser(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "new@example.com", EmailVerified: true, FullName: "New User"}
	newUser := newTestUser(t, profile.Email)

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, nil)
	userSvc.On("GetByEmail", ctx, profile.Email).Return(nil, assert.AnError)
	userSvc.On("CreateOAuthUser", ctx, user.CreateOAuthUserInput{Email: profile.Email, FullName: profile.FullName}).Return(newUser, nil)
	wsCreator.On("CreatePersonalWorkspace", ctx, newUser.ID(), profile.FullName).Return(nil)
	repo.On("Create", ctx, newUser.ID(), profile).Return(&OAuthAccount{}, nil)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.NoError(t, err)
	assert.True(t, isNew)
	assert.Equal(t, newUser, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
	wsCreator.AssertExpectations(t)
}

func TestService_FindOrCreateUser_CreateOAuthUserError(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "new@example.com", EmailVerified: true, FullName: "New User"}

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, nil)
	userSvc.On("GetByEmail", ctx, profile.Email).Return(nil, assert.AnError)
	userSvc.On("CreateOAuthUser", ctx, user.CreateOAuthUserInput{Email: profile.Email, FullName: profile.FullName}).Return(nil, assert.AnError)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.Error(t, err)
	assert.False(t, isNew)
	assert.Nil(t, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
	wsCreator.AssertExpectations(t)
}

func TestService_FindOrCreateUser_CreateWorkspaceError(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "new@example.com", EmailVerified: true, FullName: "New User"}
	newUser := newTestUser(t, profile.Email)

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, nil)
	userSvc.On("GetByEmail", ctx, profile.Email).Return(nil, assert.AnError)
	userSvc.On("CreateOAuthUser", ctx, user.CreateOAuthUserInput{Email: profile.Email, FullName: profile.FullName}).Return(newUser, nil)
	wsCreator.On("CreatePersonalWorkspace", ctx, newUser.ID(), profile.FullName).Return(assert.AnError)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.Error(t, err)
	assert.False(t, isNew)
	assert.Nil(t, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
	wsCreator.AssertExpectations(t)
}

func TestService_FindOrCreateUser_FinalLinkCreateError(t *testing.T) {
	ctx := context.Background()
	profile := OAuthProfile{Provider: "google", ProviderUserID: "12345", Email: "new@example.com", EmailVerified: true, FullName: "New User"}
	newUser := newTestUser(t, profile.Email)

	repo := new(MockRepository)
	userSvc := new(MockUserService)
	wsCreator := new(MockWorkspaceCreator)
	svc := NewService(repo, userSvc, wsCreator)

	repo.On("FindByProviderAndID", ctx, profile.Provider, profile.ProviderUserID).Return(nil, nil)
	userSvc.On("GetByEmail", ctx, profile.Email).Return(nil, assert.AnError)
	userSvc.On("CreateOAuthUser", ctx, user.CreateOAuthUserInput{Email: profile.Email, FullName: profile.FullName}).Return(newUser, nil)
	wsCreator.On("CreatePersonalWorkspace", ctx, newUser.ID(), profile.FullName).Return(nil)
	repo.On("Create", ctx, newUser.ID(), profile).Return(nil, assert.AnError)

	u, isNew, err := svc.FindOrCreateUser(ctx, profile)

	assert.Error(t, err)
	assert.False(t, isNew)
	assert.Nil(t, u)
	repo.AssertExpectations(t)
	userSvc.AssertExpectations(t)
	wsCreator.AssertExpectations(t)
}

func TestService_ListAccounts(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	accounts := []*OAuthAccount{{}, {}}

	repo := new(MockRepository)
	svc := NewService(repo, new(MockUserService), new(MockWorkspaceCreator))

	repo.On("ListByUserID", ctx, userID).Return(accounts, nil)

	result, err := svc.ListAccounts(ctx, userID)

	assert.NoError(t, err)
	assert.Equal(t, accounts, result)
	repo.AssertExpectations(t)
}

func TestService_ListAccounts_Error(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	repo := new(MockRepository)
	svc := NewService(repo, new(MockUserService), new(MockWorkspaceCreator))

	repo.On("ListByUserID", ctx, userID).Return(nil, assert.AnError)

	result, err := svc.ListAccounts(ctx, userID)

	assert.Error(t, err)
	assert.Nil(t, result)
	repo.AssertExpectations(t)
}

func TestService_UnlinkAccount(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	tests := []struct {
		name        string
		count       int
		hasPassword bool
		setupMock   func(*MockRepository)
		expectError error
	}{
		{
			name:        "last auth method without password rejected",
			count:       1,
			hasPassword: false,
			setupMock: func(m *MockRepository) {
				m.On("CountByUserID", ctx, userID).Return(1, nil)
			},
			expectError: ErrCannotUnlinkLastAuth,
		},
		{
			name:        "last auth method with password allowed",
			count:       1,
			hasPassword: true,
			setupMock: func(m *MockRepository) {
				m.On("CountByUserID", ctx, userID).Return(1, nil)
				m.On("DeleteByProvider", ctx, userID, "google").Return(nil)
			},
		},
		{
			name:        "not the last auth method",
			count:       2,
			hasPassword: false,
			setupMock: func(m *MockRepository) {
				m.On("CountByUserID", ctx, userID).Return(2, nil)
				m.On("DeleteByProvider", ctx, userID, "google").Return(nil)
			},
		},
		{
			name:        "count error propagates",
			hasPassword: false,
			setupMock: func(m *MockRepository) {
				m.On("CountByUserID", ctx, userID).Return(0, assert.AnError)
			},
			expectError: assert.AnError,
		},
		{
			name:        "delete error propagates",
			count:       2,
			hasPassword: false,
			setupMock: func(m *MockRepository) {
				m.On("CountByUserID", ctx, userID).Return(2, nil)
				m.On("DeleteByProvider", ctx, userID, "google").Return(assert.AnError)
			},
			expectError: assert.AnError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := new(MockRepository)
			svc := NewService(repo, new(MockUserService), new(MockWorkspaceCreator))
			tt.setupMock(repo)

			err := svc.UnlinkAccount(ctx, userID, "google", tt.hasPassword)

			if tt.expectError != nil {
				assert.ErrorIs(t, err, tt.expectError)
			} else {
				assert.NoError(t, err)
			}
			repo.AssertExpectations(t)
		})
	}
}

func TestGetProviderConfig(t *testing.T) {
	cfg := &config.Config{
		GoogleClientID:     "google-id",
		GoogleClientSecret: "google-secret",
		GitHubClientID:     "github-id",
		GitHubClientSecret: "github-secret",
		BackendURL:         "https://example.com",
	}

	tests := []struct {
		name        string
		provider    string
		expectError error
	}{
		{name: "google", provider: "google"},
		{name: "github", provider: "github"},
		{name: "unsupported provider", provider: "facebook", expectError: ErrProviderNotSupported},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			oauthCfg, err := GetProviderConfig(tt.provider, cfg)

			if tt.expectError != nil {
				assert.Nil(t, oauthCfg)
				assert.ErrorIs(t, err, tt.expectError)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, oauthCfg)
			}
		})
	}
}
