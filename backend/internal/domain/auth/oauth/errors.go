package oauth

import (
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Domain-specific errors for the OAuth domain.
var (
	ErrEmailNotVerified    = shared.NewDomainError(shared.ErrForbidden, "provider email is not verified, cannot auto-link")
	ErrProviderNotSupported = shared.NewDomainError(shared.ErrInvalidInput, "unknown OAuth provider")
	ErrAccountAlreadyLinked = shared.NewDomainError(shared.ErrConflict, "this provider is already linked to this user")
	ErrCannotUnlinkLastAuth = shared.NewDomainError(shared.ErrConflict, "cannot unlink sole authentication method when no password is set")
	ErrOAuthAccountNotFound = shared.NewDomainError(shared.ErrNotFound, "OAuth account not found")
)
