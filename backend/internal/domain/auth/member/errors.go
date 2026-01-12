package member

import (
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Domain-specific errors for the member domain.
var (
	ErrMemberNotFound      = shared.NewDomainError(shared.ErrNotFound, "member not found")
	ErrAlreadyMember       = shared.NewDomainError(shared.ErrAlreadyExists, "user is already a member")
	ErrCannotRemoveOwner   = shared.NewDomainError(shared.ErrForbidden, "cannot remove the last owner")
	ErrInsufficientRole    = shared.NewDomainError(shared.ErrForbidden, "insufficient role to perform this action")
	ErrCannotChangeOwnRole = shared.NewDomainError(shared.ErrForbidden, "cannot change your own role")
)
