package workspace

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
)

// MemberAdder is an interface for adding members (to avoid circular dependencies).
type MemberAdder interface {
	Save(ctx context.Context, member *member.Member) error
}

// ServiceInterface defines the workspace service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateWorkspaceInput) (*Workspace, error)
	GetByID(ctx context.Context, id uuid.UUID) (*Workspace, error)
	GetBySlug(ctx context.Context, slug string) (*Workspace, error)
	GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*Workspace, error)
	Update(ctx context.Context, id uuid.UUID, input UpdateWorkspaceInput) (*Workspace, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

// Service handles workspace business logic.
type Service struct {
	repo       Repository
	memberRepo MemberAdder
}

// NewService creates a new workspace service.
func NewService(repo Repository, memberRepo MemberAdder) *Service {
	return &Service{
		repo:       repo,
		memberRepo: memberRepo,
	}
}

// CreateWorkspaceInput holds the input for creating a workspace.
type CreateWorkspaceInput struct {
	Name        string
	Slug        string
	Description *string
	IsPersonal  bool
	CreatedBy   uuid.UUID // User ID of the creator
}

// Create creates a new workspace and adds the creator as owner.
func (s *Service) Create(ctx context.Context, input CreateWorkspaceInput) (*Workspace, error) {
	// Check if slug is already taken
	exists, err := s.repo.ExistsBySlug(ctx, input.Slug)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrSlugTaken
	}

	// Create workspace entity
	workspace, err := NewWorkspace(input.Name, input.Slug, input.Description, input.IsPersonal)
	if err != nil {
		return nil, err
	}

	// Persist workspace
	if err := s.repo.Save(ctx, workspace); err != nil {
		return nil, err
	}

	// Add creator as owner if memberRepo is configured and CreatedBy is provided
	if s.memberRepo != nil && input.CreatedBy != uuid.Nil {
		ownerMember, err := member.NewMember(workspace.ID(), input.CreatedBy, member.RoleOwner, nil)
		if err != nil {
			// Log error but don't fail workspace creation
			// In production, this should be handled in a transaction
			return workspace, nil
		}
		if err := s.memberRepo.Save(ctx, ownerMember); err != nil {
			// Log error but don't fail workspace creation
			// In production, this should be handled in a transaction
			return workspace, nil
		}
	}

	return workspace, nil
}

// GetByID retrieves a workspace by ID.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Workspace, error) {
	workspace, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if workspace == nil {
		return nil, ErrWorkspaceNotFound
	}
	return workspace, nil
}

// GetBySlug retrieves a workspace by slug.
func (s *Service) GetBySlug(ctx context.Context, slug string) (*Workspace, error) {
	workspace, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if workspace == nil {
		return nil, ErrWorkspaceNotFound
	}
	return workspace, nil
}

// GetUserWorkspaces retrieves all workspaces for a user.
func (s *Service) GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*Workspace, error) {
	return s.repo.FindByUserID(ctx, userID)
}

// UpdateWorkspaceInput holds the input for updating a workspace.
type UpdateWorkspaceInput struct {
	Name        string
	Description *string
}

// Update updates a workspace.
func (s *Service) Update(ctx context.Context, id uuid.UUID, input UpdateWorkspaceInput) (*Workspace, error) {
	workspace, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if err := workspace.Update(input.Name, input.Description); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, workspace); err != nil {
		return nil, err
	}

	return workspace, nil
}

// Delete deletes a workspace.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	workspace, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if workspace.IsPersonal() {
		return ErrCannotDeletePersonal
	}

	return s.repo.Delete(ctx, id)
}
