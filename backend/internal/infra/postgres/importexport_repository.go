package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// ImportExportRepository handles import/export database operations
type ImportExportRepository struct {
	q *queries.Queries
}

// NewImportExportRepository creates a new import/export repository from a pool
func NewImportExportRepository(pool *pgxpool.Pool) *ImportExportRepository {
	return &ImportExportRepository{q: queries.New(pool)}
}

// NewImportExportRepositoryFromQueries creates a new import/export repository from queries
func NewImportExportRepositoryFromQueries(q *queries.Queries) *ImportExportRepository {
	return &ImportExportRepository{q: q}
}

// ListAllItems returns all items in a workspace
func (r *ImportExportRepository) ListAllItems(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseItem, error) {
	return r.q.ListAllItems(ctx, queries.ListAllItemsParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
}

// CreateItem creates a new item
func (r *ImportExportRepository) CreateItem(ctx context.Context, params queries.CreateItemParams) (queries.WarehouseItem, error) {
	return r.q.CreateItem(ctx, params)
}

// GetCategoryByName gets a category by name
func (r *ImportExportRepository) GetCategoryByName(ctx context.Context, workspaceID uuid.UUID, name string) (*queries.WarehouseCategory, error) {
	cat, err := r.q.GetCategoryByName(ctx, queries.GetCategoryByNameParams{
		WorkspaceID: workspaceID,
		Name:        name,
	})
	if err != nil {
		return nil, nil // Not found
	}
	return &cat, nil
}

// ListAllLocations returns all locations in a workspace
func (r *ImportExportRepository) ListAllLocations(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseLocation, error) {
	return r.q.ListAllLocations(ctx, queries.ListAllLocationsParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
}

// CreateLocation creates a new location
func (r *ImportExportRepository) CreateLocation(ctx context.Context, params queries.CreateLocationParams) (queries.WarehouseLocation, error) {
	return r.q.CreateLocation(ctx, params)
}

// GetLocationByName gets a location by name
func (r *ImportExportRepository) GetLocationByName(ctx context.Context, workspaceID uuid.UUID, name string) (*queries.WarehouseLocation, error) {
	loc, err := r.q.GetLocationByName(ctx, queries.GetLocationByNameParams{
		WorkspaceID: workspaceID,
		Name:        name,
	})
	if err != nil {
		return nil, nil // Not found
	}
	return &loc, nil
}

// ListAllCategories returns all categories in a workspace
func (r *ImportExportRepository) ListAllCategories(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseCategory, error) {
	return r.q.ListAllCategories(ctx, queries.ListAllCategoriesParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
}

// CreateCategory creates a new category
func (r *ImportExportRepository) CreateCategory(ctx context.Context, params queries.CreateCategoryParams) (queries.WarehouseCategory, error) {
	return r.q.CreateCategory(ctx, params)
}

// ListAllContainers returns all containers in a workspace
func (r *ImportExportRepository) ListAllContainers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseContainer, error) {
	return r.q.ListAllContainers(ctx, queries.ListAllContainersParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
}

// CreateContainer creates a new container
func (r *ImportExportRepository) CreateContainer(ctx context.Context, params queries.CreateContainerParams) (queries.WarehouseContainer, error) {
	return r.q.CreateContainer(ctx, params)
}

// ListAllLabels returns all labels in a workspace
func (r *ImportExportRepository) ListAllLabels(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseLabel, error) {
	return r.q.ListAllLabels(ctx, queries.ListAllLabelsParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
}

// CreateLabel creates a new label
func (r *ImportExportRepository) CreateLabel(ctx context.Context, params queries.CreateLabelParams) (queries.WarehouseLabel, error) {
	return r.q.CreateLabel(ctx, params)
}

// ListAllCompanies returns all companies in a workspace
func (r *ImportExportRepository) ListAllCompanies(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseCompany, error) {
	return r.q.ListAllCompanies(ctx, queries.ListAllCompaniesParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
}

// CreateCompany creates a new company
func (r *ImportExportRepository) CreateCompany(ctx context.Context, params queries.CreateCompanyParams) (queries.WarehouseCompany, error) {
	return r.q.CreateCompany(ctx, params)
}

// ListAllBorrowers returns all borrowers in a workspace
func (r *ImportExportRepository) ListAllBorrowers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseBorrower, error) {
	return r.q.ListAllBorrowers(ctx, queries.ListAllBorrowersParams{
		WorkspaceID:     workspaceID,
		IncludeArchived: includeArchived,
	})
}

// CreateBorrower creates a new borrower
func (r *ImportExportRepository) CreateBorrower(ctx context.Context, params queries.CreateBorrowerParams) (queries.WarehouseBorrower, error) {
	return r.q.CreateBorrower(ctx, params)
}
