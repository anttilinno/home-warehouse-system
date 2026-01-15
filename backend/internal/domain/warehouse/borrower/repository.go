package borrower

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Repository interface {
	Save(ctx context.Context, borrower *Borrower) error
	FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*Borrower, error)
	FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Borrower, int, error)
	Delete(ctx context.Context, id uuid.UUID) error
	HasActiveLoans(ctx context.Context, id uuid.UUID) (bool, error)
	Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*Borrower, error)
}
