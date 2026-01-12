package location

import (
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

var (
	ErrLocationNotFound    = shared.NewDomainError(shared.ErrNotFound, "location not found")
	ErrShortCodeTaken      = shared.NewDomainError(shared.ErrAlreadyExists, "short code is already taken")
	ErrCyclicParent        = shared.NewDomainError(shared.ErrInvalidInput, "cyclic parent reference not allowed")
	ErrHasContainers       = shared.NewDomainError(shared.ErrConflict, "location has containers")
)
