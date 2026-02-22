package oauth

import (
	"context"

	"github.com/google/uuid"
	"golang.org/x/oauth2"

	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

// UserService defines what the OAuth service needs from the user domain.
type UserService interface {
	GetByEmail(ctx context.Context, email string) (*user.User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*user.User, error)
	CreateOAuthUser(ctx context.Context, input user.CreateOAuthUserInput) (*user.User, error)
}

// WorkspaceCreator creates a personal workspace for new OAuth users.
// This MUST reuse the same workspace creation logic as email/password registration (Pitfall 8-E).
type WorkspaceCreator interface {
	CreatePersonalWorkspace(ctx context.Context, userID uuid.UUID, fullName string) error
}

// Service handles OAuth business logic including provider config,
// user resolution (find-or-create), and account linking/unlinking.
type Service struct {
	oauthRepo Repository
	userSvc   UserService
	wsCreator WorkspaceCreator
}

// NewService creates a new OAuth service.
func NewService(repo Repository, userSvc UserService, wsCreator WorkspaceCreator) *Service {
	return &Service{
		oauthRepo: repo,
		userSvc:   userSvc,
		wsCreator: wsCreator,
	}
}

// FindOrCreateUser resolves an OAuth profile to a local user.
//
// Flow:
//  1. Check for existing OAuth link (return user if found).
//  2. SECURITY: Reject unverified provider emails (Pitfall 8-B).
//  3. Check for existing user by email (auto-link if found).
//  4. Create new user + personal workspace + OAuth link.
//
// Returns the user, whether a new user was created, and any error.
func (s *Service) FindOrCreateUser(ctx context.Context, profile OAuthProfile) (foundUser *user.User, isNewUser bool, err error) {
	// Step 1: Check existing OAuth link
	existing, err := s.oauthRepo.FindByProviderAndID(ctx, profile.Provider, profile.ProviderUserID)
	if err != nil {
		return nil, false, err
	}
	if existing != nil {
		// Load the linked user
		u, err := s.userSvc.GetByID(ctx, existing.UserID())
		if err != nil {
			return nil, false, err
		}
		return u, false, nil
	}

	// Step 2: CRITICAL SECURITY CHECK -- never auto-link unverified emails
	if !profile.EmailVerified {
		return nil, false, ErrEmailNotVerified
	}

	// Step 3: Check existing user by email
	existingUser, err := s.userSvc.GetByEmail(ctx, profile.Email)
	if err == nil && existingUser != nil {
		// Auto-link to existing user
		if _, err := s.oauthRepo.Create(ctx, existingUser.ID(), profile); err != nil {
			return nil, false, err
		}
		return existingUser, false, nil
	}

	// Step 4: Create new user, personal workspace, and OAuth link
	newUser, err := s.userSvc.CreateOAuthUser(ctx, user.CreateOAuthUserInput{
		Email:    profile.Email,
		FullName: profile.FullName,
	})
	if err != nil {
		return nil, false, err
	}

	if err := s.wsCreator.CreatePersonalWorkspace(ctx, newUser.ID(), profile.FullName); err != nil {
		return nil, false, err
	}

	if _, err := s.oauthRepo.Create(ctx, newUser.ID(), profile); err != nil {
		return nil, false, err
	}

	return newUser, true, nil
}

// ListAccounts returns all OAuth accounts linked to a user.
func (s *Service) ListAccounts(ctx context.Context, userID uuid.UUID) ([]*OAuthAccount, error) {
	return s.oauthRepo.ListByUserID(ctx, userID)
}

// UnlinkAccount removes an OAuth provider link from a user.
// It prevents removing the last authentication method when no password is set (Pitfall 8-F).
func (s *Service) UnlinkAccount(ctx context.Context, userID uuid.UUID, provider string, hasPassword bool) error {
	count, err := s.oauthRepo.CountByUserID(ctx, userID)
	if err != nil {
		return err
	}

	if count <= 1 && !hasPassword {
		return ErrCannotUnlinkLastAuth
	}

	return s.oauthRepo.DeleteByProvider(ctx, userID, provider)
}

// GetProviderConfig returns the OAuth2 config for a given provider name.
// Used by the handler to initiate OAuth flows and handle callbacks.
func GetProviderConfig(provider string, cfg *config.Config) (*oauth2.Config, error) {
	switch provider {
	case "google":
		return GoogleConfig(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.BackendURL), nil
	case "github":
		return GitHubConfig(cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.BackendURL), nil
	default:
		return nil, ErrProviderNotSupported
	}
}
