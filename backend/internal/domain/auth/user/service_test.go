package user

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, user *User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id uuid.UUID) (*User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

func (m *MockRepository) FindByEmail(ctx context.Context, email string) (*User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

func (m *MockRepository) List(ctx context.Context, pagination shared.Pagination) ([]*User, int, error) {
	args := m.Called(ctx, pagination)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*User), args.Int(1), args.Error(2)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	args := m.Called(ctx, email)
	return args.Bool(0), args.Error(1)
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNewUser(t *testing.T) {
	tests := []struct {
		name        string
		email       string
		fullName    string
		password    string
		expectError bool
		errorField  string
	}{
		{
			name:        "valid user",
			email:       "test@example.com",
			fullName:    "Test User",
			password:    "password123",
			expectError: false,
		},
		{
			name:        "empty email",
			email:       "",
			fullName:    "Test User",
			password:    "password123",
			expectError: true,
			errorField:  "email",
		},
		{
			name:        "empty full name",
			email:       "test@example.com",
			fullName:    "",
			password:    "password123",
			expectError: true,
			errorField:  "full_name",
		},
		{
			name:        "short password",
			email:       "test@example.com",
			fullName:    "Test User",
			password:    "short",
			expectError: true,
			errorField:  "password",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := NewUser(tt.email, tt.fullName, tt.password)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, user)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.email, user.Email())
				assert.Equal(t, tt.fullName, user.FullName())
				assert.True(t, user.IsActive())
				assert.False(t, user.IsSuperuser())
				assert.NotEmpty(t, user.ID())
				assert.NotEmpty(t, user.PasswordHash())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	now := time.Now()

	user := Reconstruct(
		id,
		"test@example.com",
		"Test User",
		"hashed_password",
		true,
		false,
		"YYYY-MM-DD",
		"en",
		"system",
		now,
		now,
	)

	assert.Equal(t, id, user.ID())
	assert.Equal(t, "test@example.com", user.Email())
	assert.Equal(t, "Test User", user.FullName())
	assert.Equal(t, "hashed_password", user.PasswordHash())
	assert.True(t, user.IsActive())
	assert.False(t, user.IsSuperuser())
	assert.Equal(t, "YYYY-MM-DD", user.DateFormat())
	assert.Equal(t, "en", user.Language())
	assert.Equal(t, "system", user.Theme())
	assert.Equal(t, now, user.CreatedAt())
	assert.Equal(t, now, user.UpdatedAt())
}

func TestUser_CheckPassword(t *testing.T) {
	user, err := NewUser("test@example.com", "Test User", "password123")
	assert.NoError(t, err)

	assert.True(t, user.CheckPassword("password123"))
	assert.False(t, user.CheckPassword("wrongpassword"))
	assert.False(t, user.CheckPassword(""))
}

func TestUser_UpdateProfile(t *testing.T) {
	user, err := NewUser("test@example.com", "Test User", "password123")
	assert.NoError(t, err)

	originalUpdatedAt := user.UpdatedAt()

	// Update with valid name
	err = user.UpdateProfile("Updated Name")
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", user.FullName())
	assert.True(t, user.UpdatedAt().After(originalUpdatedAt))

	// Update with empty name
	err = user.UpdateProfile("")
	assert.Error(t, err)
	assert.Equal(t, "Updated Name", user.FullName()) // Should not change
}

func TestUser_UpdatePassword(t *testing.T) {
	user, err := NewUser("test@example.com", "Test User", "password123")
	assert.NoError(t, err)

	originalHash := user.PasswordHash()
	originalUpdatedAt := user.UpdatedAt()

	// Update with valid password
	err = user.UpdatePassword("newpassword456")
	assert.NoError(t, err)
	assert.NotEqual(t, originalHash, user.PasswordHash())
	assert.True(t, user.UpdatedAt().After(originalUpdatedAt))
	assert.True(t, user.CheckPassword("newpassword456"))
	assert.False(t, user.CheckPassword("password123"))

	// Update with short password
	err = user.UpdatePassword("short")
	assert.Error(t, err)
}

func TestUser_UpdatePreferences(t *testing.T) {
	user, err := NewUser("test@example.com", "Test User", "password123")
	assert.NoError(t, err)

	originalUpdatedAt := user.UpdatedAt()

	user.UpdatePreferences("MM/DD/YYYY", "es", "dark")

	assert.Equal(t, "MM/DD/YYYY", user.DateFormat())
	assert.Equal(t, "es", user.Language())
	assert.Equal(t, "dark", user.Theme())
	assert.True(t, user.UpdatedAt().After(originalUpdatedAt))
}

func TestUser_Deactivate(t *testing.T) {
	user, err := NewUser("test@example.com", "Test User", "password123")
	assert.NoError(t, err)

	originalUpdatedAt := user.UpdatedAt()

	user.Deactivate()

	assert.False(t, user.IsActive())
	assert.True(t, user.UpdatedAt().After(originalUpdatedAt))
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name        string
		input       CreateUserInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name: "successful creation",
			input: CreateUserInput{
				Email:    "new@example.com",
				FullName: "New User",
				Password: "password123",
			},
			setupMock: func(m *MockRepository) {
				m.On("ExistsByEmail", ctx, "new@example.com").Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*user.User")).Return(nil)
			},
			expectError: false,
		},
		{
			name: "email already taken",
			input: CreateUserInput{
				Email:    "taken@example.com",
				FullName: "Taken User",
				Password: "password123",
			},
			setupMock: func(m *MockRepository) {
				m.On("ExistsByEmail", ctx, "taken@example.com").Return(true, nil)
			},
			expectError: true,
			errorType:   ErrEmailTaken,
		},
		{
			name: "invalid input",
			input: CreateUserInput{
				Email:    "",
				FullName: "Invalid User",
				Password: "password123",
			},
			setupMock: func(m *MockRepository) {
				// ExistsByEmail is called before NewUser validation, but since NewUser fails
				// we need to mock it anyway to avoid the panic
				m.On("ExistsByEmail", ctx, "").Return(false, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			user, err := svc.Create(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, user)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.input.Email, user.Email())
				assert.Equal(t, tt.input.FullName, user.FullName())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	tests := []struct {
		name        string
		userID      uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name:   "user found",
			userID: userID,
			setupMock: func(m *MockRepository) {
				user := &User{id: userID, email: "test@example.com"}
				m.On("FindByID", ctx, userID).Return(user, nil)
			},
			expectError: false,
		},
		{
			name:   "user not found",
			userID: userID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, userID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrUserNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			user, err := svc.GetByID(ctx, tt.userID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, user)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.userID, user.ID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetByEmail(t *testing.T) {
	ctx := context.Background()
	email := "test@example.com"

	tests := []struct {
		name        string
		email       string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name:  "user found",
			email: email,
			setupMock: func(m *MockRepository) {
				user := &User{id: uuid.New(), email: email}
				m.On("FindByEmail", ctx, email).Return(user, nil)
			},
			expectError: false,
		},
		{
			name:  "user not found",
			email: email,
			setupMock: func(m *MockRepository) {
				m.On("FindByEmail", ctx, email).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrUserNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			user, err := svc.GetByEmail(ctx, tt.email)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, user)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.email, user.Email())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Authenticate(t *testing.T) {
	ctx := context.Background()
	email := "test@example.com"
	password := "password123"

	tests := []struct {
		name        string
		email       string
		password    string
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name:     "successful authentication",
			email:    email,
			password: password,
			setupMock: func(m *MockRepository) {
				user, _ := NewUser(email, "Test User", password)
				m.On("FindByEmail", ctx, email).Return(user, nil)
			},
			expectError: false,
		},
		{
			name:     "user not found",
			email:    "notfound@example.com",
			password: password,
			setupMock: func(m *MockRepository) {
				m.On("FindByEmail", ctx, "notfound@example.com").Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrInvalidPassword,
		},
		{
			name:     "inactive user",
			email:    email,
			password: password,
			setupMock: func(m *MockRepository) {
				user, _ := NewUser(email, "Test User", password)
				user.Deactivate()
				m.On("FindByEmail", ctx, email).Return(user, nil)
			},
			expectError: true,
			errorType:   ErrInactiveUser,
		},
		{
			name:     "wrong password",
			email:    email,
			password: "wrongpassword",
			setupMock: func(m *MockRepository) {
				user, _ := NewUser(email, "Test User", password)
				m.On("FindByEmail", ctx, email).Return(user, nil)
			},
			expectError: true,
			errorType:   ErrInvalidPassword,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			user, err := svc.Authenticate(ctx, tt.email, tt.password)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, user)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.email, user.Email())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_UpdateProfile(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	user, _ := NewUser("test@example.com", "Test User", "password123")

	tests := []struct {
		name        string
		userID      uuid.UUID
		input       UpdateProfileInput
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			name:   "successful update",
			userID: userID,
			input: UpdateProfileInput{
				FullName: "Updated Name",
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, userID).Return(user, nil)
				m.On("Save", ctx, mock.MatchedBy(func(u *User) bool {
					return u.FullName() == "Updated Name"
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name:   "user not found",
			userID: uuid.New(),
			input: UpdateProfileInput{
				FullName: "Updated Name",
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			updatedUser, err := svc.UpdateProfile(ctx, tt.userID, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, updatedUser)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, updatedUser)
				assert.Equal(t, tt.input.FullName, updatedUser.FullName())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_UpdatePassword(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	user, _ := NewUser("test@example.com", "Test User", "password123")

	tests := []struct {
		name            string
		userID          uuid.UUID
		currentPassword string
		newPassword     string
		setupMock       func(*MockRepository)
		expectError     bool
	}{
		{
			name:            "successful password update",
			userID:          userID,
			currentPassword: "password123",
			newPassword:     "newpassword456",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, userID).Return(user, nil)
				m.On("Save", ctx, mock.Anything).Return(nil)
			},
			expectError: false,
		},
		{
			name:            "wrong current password",
			userID:          userID,
			currentPassword: "wrongpassword",
			newPassword:     "newpassword456",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, userID).Return(user, nil)
			},
			expectError: true,
		},
		{
			name:            "user not found",
			userID:          uuid.New(),
			currentPassword: "password123",
			newPassword:     "newpassword456",
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.UpdatePassword(ctx, tt.userID, tt.currentPassword, tt.newPassword)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_UpdatePreferences(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	user, _ := NewUser("test@example.com", "Test User", "password123")

	input := UpdatePreferencesInput{
		DateFormat: "MM/DD/YYYY",
		Language:   "es",
		Theme:      "dark",
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByID", ctx, userID).Return(user, nil)
	mockRepo.On("Save", ctx, mock.Anything).Return(nil)

	updatedUser, err := svc.UpdatePreferences(ctx, userID, input)

	assert.NoError(t, err)
	assert.NotNil(t, updatedUser)
	assert.Equal(t, input.DateFormat, updatedUser.DateFormat())
	assert.Equal(t, input.Language, updatedUser.Language())
	assert.Equal(t, input.Theme, updatedUser.Theme())

	mockRepo.AssertExpectations(t)
}

func TestService_List(t *testing.T) {
	ctx := context.Background()
	pagination := shared.Pagination{Page: 1, PageSize: 10}

	users := []*User{
		{id: uuid.New(), email: "user1@example.com"},
		{id: uuid.New(), email: "user2@example.com"},
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("List", ctx, pagination).Return(users, 2, nil)

	result, err := svc.List(ctx, pagination)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Items, 2)
	assert.Equal(t, 2, result.Total)
	assert.Equal(t, 1, result.Page)
	assert.Equal(t, 1, result.TotalPages)

	mockRepo.AssertExpectations(t)
}

func TestService_Deactivate(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	user, _ := NewUser("test@example.com", "Test User", "password123")

	tests := []struct {
		name        string
		userID      uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			name:   "successful deactivation",
			userID: userID,
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, userID).Return(user, nil)
				m.On("Save", ctx, mock.Anything).Return(nil)
			},
			expectError: false,
		},
		{
			name:   "user not found",
			userID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Deactivate(ctx, tt.userID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_Activate(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	tests := []struct {
		name        string
		userID      uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
	}{
		{
			name:   "successful activation",
			userID: userID,
			setupMock: func(m *MockRepository) {
				user, _ := NewUser("test@example.com", "Test User", "password123")
				user.Deactivate() // Start as deactivated
				m.On("FindByID", ctx, userID).Return(user, nil)
				m.On("Save", ctx, mock.MatchedBy(func(u *User) bool {
					return u.IsActive() // Should be active after Activate
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name:   "user not found",
			userID: uuid.New(),
			setupMock: func(m *MockRepository) {
				m.On("FindByID", ctx, mock.Anything).Return(nil, nil)
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.Activate(ctx, tt.userID)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestUser_Activate(t *testing.T) {
	user, err := NewUser("test@example.com", "Test User", "password123")
	assert.NoError(t, err)

	// First deactivate
	user.Deactivate()
	assert.False(t, user.IsActive())

	originalUpdatedAt := user.UpdatedAt()

	// Now activate
	user.Activate()

	assert.True(t, user.IsActive())
	assert.True(t, user.UpdatedAt().After(originalUpdatedAt))
}

func TestService_Create_RepoError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Test error from ExistsByEmail
	mockRepo.On("ExistsByEmail", ctx, "test@example.com").Return(false, assert.AnError)

	user, err := svc.Create(ctx, CreateUserInput{
		Email:    "test@example.com",
		FullName: "Test User",
		Password: "password123",
	})

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_Create_SaveError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ExistsByEmail", ctx, "test@example.com").Return(false, nil)
	mockRepo.On("Save", ctx, mock.AnythingOfType("*user.User")).Return(assert.AnError)

	user, err := svc.Create(ctx, CreateUserInput{
		Email:    "test@example.com",
		FullName: "Test User",
		Password: "password123",
	})

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_GetByID_RepoError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	userID := uuid.New()
	mockRepo.On("FindByID", ctx, userID).Return(nil, assert.AnError)

	user, err := svc.GetByID(ctx, userID)

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_GetByEmail_RepoError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByEmail", ctx, "test@example.com").Return(nil, assert.AnError)

	user, err := svc.GetByEmail(ctx, "test@example.com")

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_Authenticate_RepoError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByEmail", ctx, "test@example.com").Return(nil, assert.AnError)

	user, err := svc.Authenticate(ctx, "test@example.com", "password123")

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_UpdateProfile_SaveError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	userID := uuid.New()
	existingUser, _ := NewUser("test@example.com", "Test User", "password123")
	mockRepo.On("FindByID", ctx, userID).Return(existingUser, nil)
	mockRepo.On("Save", ctx, mock.Anything).Return(assert.AnError)

	user, err := svc.UpdateProfile(ctx, userID, UpdateProfileInput{
		FullName: "Updated Name",
	})

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_UpdateProfile_InvalidName(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	userID := uuid.New()
	existingUser, _ := NewUser("test@example.com", "Test User", "password123")
	mockRepo.On("FindByID", ctx, userID).Return(existingUser, nil)

	user, err := svc.UpdateProfile(ctx, userID, UpdateProfileInput{
		FullName: "", // Empty name is invalid
	})

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_UpdatePassword_InvalidNewPassword(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	userID := uuid.New()
	existingUser, _ := NewUser("test@example.com", "Test User", "password123")
	mockRepo.On("FindByID", ctx, userID).Return(existingUser, nil)

	err := svc.UpdatePassword(ctx, userID, "password123", "short") // Short password

	assert.Error(t, err)
	mockRepo.AssertExpectations(t)
}

func TestService_UpdatePreferences_SaveError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	userID := uuid.New()
	existingUser, _ := NewUser("test@example.com", "Test User", "password123")
	mockRepo.On("FindByID", ctx, userID).Return(existingUser, nil)
	mockRepo.On("Save", ctx, mock.Anything).Return(assert.AnError)

	user, err := svc.UpdatePreferences(ctx, userID, UpdatePreferencesInput{
		DateFormat: "YYYY-MM-DD",
		Language:   "en",
		Theme:      "dark",
	})

	assert.Error(t, err)
	assert.Nil(t, user)
	mockRepo.AssertExpectations(t)
}

func TestService_List_RepoError(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	pagination := shared.Pagination{Page: 1, PageSize: 10}
	mockRepo.On("List", ctx, pagination).Return(nil, 0, assert.AnError)

	result, err := svc.List(ctx, pagination)

	assert.Error(t, err)
	assert.Nil(t, result)
	mockRepo.AssertExpectations(t)
}
