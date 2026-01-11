package label

import "github.com/antti/home-warehouse/go-backend/internal/shared"

var (
	ErrLabelNotFound   = shared.NewDomainError(shared.ErrNotFound, "label not found")
	ErrNameTaken       = shared.NewDomainError(shared.ErrAlreadyExists, "label name is already taken")
	ErrInvalidColor    = shared.NewDomainError(shared.ErrInvalidInput, "invalid color format")
)
