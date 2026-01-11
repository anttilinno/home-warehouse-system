package category

import (
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Domain-specific errors for the category domain.
var (
	ErrCategoryNotFound = shared.NewDomainError(shared.ErrNotFound, "category not found")
	ErrCyclicParent     = shared.NewDomainError(shared.ErrInvalidInput, "cyclic parent reference not allowed")
	ErrHasChildren      = shared.NewDomainError(shared.ErrConflict, "category has child categories")
)
