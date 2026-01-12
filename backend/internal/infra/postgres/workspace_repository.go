package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// WorkspaceRepository implements workspace.Repository using PostgreSQL.
type WorkspaceRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewWorkspaceRepository creates a new WorkspaceRepository.
func NewWorkspaceRepository(pool *pgxpool.Pool) *WorkspaceRepository {
	return &WorkspaceRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// Save persists a workspace (create or update).
func (r *WorkspaceRepository) Save(ctx context.Context, w *workspace.Workspace) error {
	// Check if workspace already exists
	existing, err := r.queries.GetWorkspaceByID(ctx, w.ID())
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if existing.ID != uuid.Nil {
		// Update existing workspace
		_, err = r.queries.UpdateWorkspace(ctx, queries.UpdateWorkspaceParams{
			ID:          w.ID(),
			Name:        w.Name(),
			Description: w.Description(),
		})
		return err
	}

	// Create new workspace
	_, err = r.queries.CreateWorkspace(ctx, queries.CreateWorkspaceParams{
		ID:          w.ID(),
		Name:        w.Name(),
		Slug:        w.Slug(),
		Description: w.Description(),
		IsPersonal:  w.IsPersonal(),
	})
	return err
}

// FindByID retrieves a workspace by ID.
func (r *WorkspaceRepository) FindByID(ctx context.Context, id uuid.UUID) (*workspace.Workspace, error) {
	row, err := r.queries.GetWorkspaceByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return workspace.Reconstruct(
		row.ID,
		row.Name,
		row.Slug,
		row.Description,
		row.IsPersonal,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	), nil
}

// FindBySlug retrieves a workspace by slug.
func (r *WorkspaceRepository) FindBySlug(ctx context.Context, slug string) (*workspace.Workspace, error) {
	row, err := r.queries.GetWorkspaceBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return workspace.Reconstruct(
		row.ID,
		row.Name,
		row.Slug,
		row.Description,
		row.IsPersonal,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	), nil
}

// FindByUserID retrieves all workspaces for a user.
func (r *WorkspaceRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*workspace.Workspace, error) {
	rows, err := r.queries.ListWorkspacesByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	workspaces := make([]*workspace.Workspace, 0, len(rows))
	for _, row := range rows {
		workspaces = append(workspaces, workspace.Reconstruct(
			row.ID,
			row.Name,
			row.Slug,
			row.Description,
			row.IsPersonal,
			row.CreatedAt.Time,
			row.UpdatedAt.Time,
		))
	}

	return workspaces, nil
}

// Delete removes a workspace by ID.
func (r *WorkspaceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteWorkspace(ctx, id)
}

// ExistsBySlug checks if a workspace with the given slug exists.
func (r *WorkspaceRepository) ExistsBySlug(ctx context.Context, slug string) (bool, error) {
	return r.queries.WorkspaceExistsBySlug(ctx, slug)
}
