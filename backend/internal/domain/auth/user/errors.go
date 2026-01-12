package user

import (
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Domain-specific errors for the user domain.
var (
	ErrUserNotFound    = shared.NewDomainError(shared.ErrNotFound, "user not found")
	ErrEmailTaken      = shared.NewDomainError(shared.ErrAlreadyExists, "email is already taken")
	ErrInvalidPassword = shared.NewDomainError(shared.ErrInvalidInput, "invalid password")
	ErrInactiveUser    = shared.NewDomainError(shared.ErrForbidden, "user account is inactive")
)
