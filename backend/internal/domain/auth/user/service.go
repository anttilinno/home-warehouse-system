package user

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the user service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateUserInput) (*User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	Authenticate(ctx context.Context, email, password string) (*User, error)
	UpdateProfile(ctx context.Context, id uuid.UUID, input UpdateProfileInput) (*User, error)
	UpdatePassword(ctx context.Context, id uuid.UUID, currentPassword, newPassword string) error
	UpdatePreferences(ctx context.Context, id uuid.UUID, input UpdatePreferencesInput) (*User, error)
	List(ctx context.Context, pagination shared.Pagination) (*shared.PagedResult[*User], error)
	Deactivate(ctx context.Context, id uuid.UUID) error
	Activate(ctx context.Context, id uuid.UUID) error
}

// Service handles user business logic.
type Service struct {
	repo Repository
}

// NewService creates a new user service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreateUserInput holds the input for creating a user.
type CreateUserInput struct {
	Email    string
	FullName string
	Password string
}

// Create creates a new user.
func (s *Service) Create(ctx context.Context, input CreateUserInput) (*User, error) {
	// Check if email is already taken
	exists, err := s.repo.ExistsByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrEmailTaken
	}

	// Create user entity
	user, err := NewUser(input.Email, input.FullName, input.Password)
	if err != nil {
		return nil, err
	}

	// Persist user
	if err := s.repo.Save(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// GetByID retrieves a user by ID.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*User, error) {
	user, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// GetByEmail retrieves a user by email.
func (s *Service) GetByEmail(ctx context.Context, email string) (*User, error) {
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// Authenticate verifies credentials and returns the user.
func (s *Service) Authenticate(ctx context.Context, email, password string) (*User, error) {
	user, err := s.repo.FindByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrInvalidPassword
	}

	if !user.IsActive() {
		return nil, ErrInactiveUser
	}

	if !user.CheckPassword(password) {
		return nil, ErrInvalidPassword
	}

	return user, nil
}

// UpdateProfileInput holds the input for updating a user's profile.
type UpdateProfileInput struct {
	FullName string
}

// UpdateProfile updates a user's profile.
func (s *Service) UpdateProfile(ctx context.Context, id uuid.UUID, input UpdateProfileInput) (*User, error) {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if err := user.UpdateProfile(input.FullName); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// UpdatePassword changes a user's password.
func (s *Service) UpdatePassword(ctx context.Context, id uuid.UUID, currentPassword, newPassword string) error {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if !user.CheckPassword(currentPassword) {
		return ErrInvalidPassword
	}

	if err := user.UpdatePassword(newPassword); err != nil {
		return err
	}

	return s.repo.Save(ctx, user)
}

// UpdatePreferencesInput holds the input for updating user preferences.
type UpdatePreferencesInput struct {
	DateFormat string
	Language   string
	Theme      string
}

// UpdatePreferences updates a user's preferences.
func (s *Service) UpdatePreferences(ctx context.Context, id uuid.UUID, input UpdatePreferencesInput) (*User, error) {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	user.UpdatePreferences(input.DateFormat, input.Language, input.Theme)

	if err := s.repo.Save(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// List retrieves users with pagination.
func (s *Service) List(ctx context.Context, pagination shared.Pagination) (*shared.PagedResult[*User], error) {
	users, total, err := s.repo.List(ctx, pagination)
	if err != nil {
		return nil, err
	}

	result := shared.NewPagedResult(users, total, pagination)
	return &result, nil
}

// Deactivate deactivates a user account.
func (s *Service) Deactivate(ctx context.Context, id uuid.UUID) error {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	user.Deactivate()

	return s.repo.Save(ctx, user)
}

// Activate activates a user account.
func (s *Service) Activate(ctx context.Context, id uuid.UUID) error {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	user.Activate()

	return s.repo.Save(ctx, user)
}
