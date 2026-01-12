package company

import "github.com/antti/home-warehouse/go-backend/internal/shared"

var (
	ErrCompanyNotFound = shared.NewDomainError(shared.ErrNotFound, "company not found")
	ErrNameTaken       = shared.NewDomainError(shared.ErrAlreadyExists, "company name is already taken")
)
