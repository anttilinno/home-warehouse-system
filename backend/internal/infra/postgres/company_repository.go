package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/company"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type CompanyRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewCompanyRepository(pool *pgxpool.Pool) *CompanyRepository {
	return &CompanyRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *CompanyRepository) Save(ctx context.Context, c *company.Company) error {
	_, err := r.queries.CreateCompany(ctx, queries.CreateCompanyParams{
		ID:          c.ID(),
		WorkspaceID: c.WorkspaceID(),
		Name:        c.Name(),
		Website:     c.Website(),
		Notes:       c.Notes(),
	})
	return err
}

func (r *CompanyRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*company.Company, error) {
	row, err := r.queries.GetCompany(ctx, queries.GetCompanyParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToCompany(row), nil
}

func (r *CompanyRepository) FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*company.Company, error) {
	row, err := r.queries.GetCompanyByName(ctx, queries.GetCompanyByNameParams{
		WorkspaceID: workspaceID,
		Name:        name,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToCompany(row), nil
}

func (r *CompanyRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*company.Company, int, error) {
	rows, err := r.queries.ListCompanies(ctx, queries.ListCompaniesParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	companies := make([]*company.Company, 0, len(rows))
	for _, row := range rows {
		companies = append(companies, r.rowToCompany(row))
	}

	return companies, len(companies), nil
}

func (r *CompanyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteCompany(ctx, id)
}

func (r *CompanyRepository) NameExists(ctx context.Context, workspaceID uuid.UUID, name string) (bool, error) {
	return r.queries.CompanyNameExists(ctx, queries.CompanyNameExistsParams{
		WorkspaceID: workspaceID,
		Name:        name,
	})
}

func (r *CompanyRepository) rowToCompany(row queries.WarehouseCompany) *company.Company {
	return company.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.Name,
		row.Website,
		row.Notes,
		row.IsArchived,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
