package container

import "github.com/antti/home-warehouse/go-backend/internal/shared"

var (
	ErrContainerNotFound = shared.NewDomainError(shared.ErrNotFound, "container not found")
	ErrShortCodeTaken    = shared.NewDomainError(shared.ErrAlreadyExists, "short code is already taken")
	ErrHasInventory      = shared.NewDomainError(shared.ErrConflict, "container has inventory")
)
