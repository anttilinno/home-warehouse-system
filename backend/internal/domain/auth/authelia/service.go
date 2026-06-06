// Package authelia adds reverse-proxy forward-auth as an authentication method.
//
// Authelia (running at the k3s ingress) authenticates the user upstream and
// injects identity headers (Remote-User, Remote-Email, Remote-Name,
// Remote-Groups) on proxied requests. This package trusts those headers -- but
// only when accompanied by the ingress-injected shared secret (see handler.go)
// -- maps the identity to a local user (provisioning on first sight, like
// OAuth), and mints the application's own JWT cookies so every other endpoint
// keeps using the existing JWTAuth middleware unchanged.
package authelia

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

// UserService is what the Authelia service needs from the user domain.
type UserService interface {
	GetByEmail(ctx context.Context, email string) (*user.User, error)
	CreateOAuthUser(ctx context.Context, input user.CreateOAuthUserInput) (*user.User, error)
}

// WorkspaceCreator creates a personal workspace for first-time users. It MUST
// reuse the same logic as email/password and OAuth signup (Pitfall 8-E).
type WorkspaceCreator interface {
	CreatePersonalWorkspace(ctx context.Context, userID uuid.UUID, fullName string) error
}

// Service resolves an Authelia-authenticated identity to a local user.
type Service struct {
	userSvc   UserService
	wsCreator WorkspaceCreator
}

// NewService creates a new Authelia service.
func NewService(userSvc UserService, wsCreator WorkspaceCreator) *Service {
	return &Service{userSvc: userSvc, wsCreator: wsCreator}
}

// ResolveUser returns the local user for an Authelia identity, creating a
// passwordless user + personal workspace on first sight.
//
// Authelia is the authority here: it has already authenticated the user before
// the request reached us, so unlike the OAuth flow there is no provider-email
// verification step -- the trust boundary is the shared secret enforced by the
// handler, not the email itself.
func (s *Service) ResolveUser(ctx context.Context, email, fullName string) (foundUser *user.User, isNew bool, err error) {
	existing, err := s.userSvc.GetByEmail(ctx, email)
	if err == nil && existing != nil {
		return existing, false, nil
	}

	newUser, err := s.userSvc.CreateOAuthUser(ctx, user.CreateOAuthUserInput{
		Email:    email,
		FullName: fullName,
	})
	if err != nil {
		return nil, false, err
	}

	if err := s.wsCreator.CreatePersonalWorkspace(ctx, newUser.ID(), fullName); err != nil {
		return nil, false, err
	}

	return newUser, true, nil
}
