package workspace

import (
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Domain-specific errors for the workspace domain.
var (
	ErrWorkspaceNotFound     = shared.NewDomainError(shared.ErrNotFound, "workspace not found")
	ErrSlugTaken             = shared.NewDomainError(shared.ErrAlreadyExists, "workspace slug is already taken")
	ErrCannotDeletePersonal  = shared.NewDomainError(shared.ErrForbidden, "cannot delete personal workspace")
)
