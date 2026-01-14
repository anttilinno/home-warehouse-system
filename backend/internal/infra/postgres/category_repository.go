package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// CategoryRepository implements category.Repository using PostgreSQL.
type CategoryRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewCategoryRepository creates a new CategoryRepository.
func NewCategoryRepository(pool *pgxpool.Pool) *CategoryRepository {
	return &CategoryRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// Save persists a category (create or update).
func (r *CategoryRepository) Save(ctx context.Context, c *category.Category) error {
	// Convert parent category ID
	var parentCategoryID pgtype.UUID
	if c.ParentCategoryID() != nil {
		parentCategoryID = pgtype.UUID{Bytes: *c.ParentCategoryID(), Valid: true}
	}

	// Check if category exists
	existing, err := r.queries.GetCategory(ctx, queries.GetCategoryParams{
		ID:          c.ID(),
		WorkspaceID: c.WorkspaceID(),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if existing.ID != uuid.Nil {
		// Update existing category
		_, err = r.queries.UpdateCategory(ctx, queries.UpdateCategoryParams{
			ID:               c.ID(),
			Name:             c.Name(),
			ParentCategoryID: parentCategoryID,
			Description:      c.Description(),
		})
		return err
	}

	// Create new category
	_, err = r.queries.CreateCategory(ctx, queries.CreateCategoryParams{
		ID:               c.ID(),
		WorkspaceID:      c.WorkspaceID(),
		Name:             c.Name(),
		ParentCategoryID: parentCategoryID,
		Description:      c.Description(),
	})
	return err
}

// FindByID retrieves a category by ID.
func (r *CategoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*category.Category, error) {
	row, err := r.queries.GetCategory(ctx, queries.GetCategoryParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToCategory(row), nil
}

// FindByWorkspace retrieves all categories in a workspace.
func (r *CategoryRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	rows, err := r.queries.ListCategories(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	categories := make([]*category.Category, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, r.rowToCategory(row))
	}

	return categories, nil
}

// FindByParent retrieves all categories with a specific parent.
func (r *CategoryRepository) FindByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*category.Category, error) {
	rows, err := r.queries.ListCategoriesByParent(ctx, queries.ListCategoriesByParentParams{
		WorkspaceID:      workspaceID,
		ParentCategoryID: pgtype.UUID{Bytes: parentID, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	categories := make([]*category.Category, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, r.rowToCategory(row))
	}

	return categories, nil
}

// FindRootCategories retrieves all root categories (no parent).
func (r *CategoryRepository) FindRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	rows, err := r.queries.ListRootCategories(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	categories := make([]*category.Category, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, r.rowToCategory(row))
	}

	return categories, nil
}

// Delete removes a category by ID.
func (r *CategoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteCategory(ctx, id)
}

// HasChildren checks if a category has children.
func (r *CategoryRepository) HasChildren(ctx context.Context, id uuid.UUID) (bool, error) {
	return r.queries.HasChildren(ctx, pgtype.UUID{Bytes: id, Valid: true})
}

// rowToCategory converts a database row to a Category entity.
func (r *CategoryRepository) rowToCategory(row queries.WarehouseCategory) *category.Category {
	// Convert parent category ID
	var parentCategoryID *uuid.UUID
	if row.ParentCategoryID.Valid {
		id := uuid.UUID(row.ParentCategoryID.Bytes)
		parentCategoryID = &id
	}

	return category.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.Name,
		parentCategoryID,
		row.Description,
		row.IsArchived,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
