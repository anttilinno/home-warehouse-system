package importjob

import "github.com/antti/home-warehouse/go-backend/internal/shared"

var (
	ErrImportJobNotFound = shared.NewDomainError(shared.ErrNotFound, "import job not found")
	ErrInvalidFile       = shared.NewDomainError(shared.ErrInvalidInput, "invalid file format")
	ErrFileTooLarge      = shared.NewDomainError(shared.ErrInvalidInput, "file size exceeds maximum allowed")
	ErrInvalidEntityType = shared.NewDomainError(shared.ErrInvalidInput, "invalid entity type")
)
