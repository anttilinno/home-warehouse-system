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
	// Check if the company already exists (mirror CategoryRepository.Save):
	// Save is an upsert, so an existing row must be UPDATEd rather than
	// re-INSERTed (which would violate companies_pkey).
	existing, err := r.queries.GetCompany(ctx, queries.GetCompanyParams{
		ID:          c.ID(),
		WorkspaceID: c.WorkspaceID(),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if existing.ID != uuid.Nil {
		// Handle archive/restore state transitions.
		if c.IsArchived() && !existing.IsArchived {
			return r.queries.ArchiveCompany(ctx, queries.ArchiveCompanyParams{
				ID:          c.ID(),
				WorkspaceID: c.WorkspaceID(),
			})
		}
		if !c.IsArchived() && existing.IsArchived {
			return r.queries.RestoreCompany(ctx, queries.RestoreCompanyParams{
				ID:          c.ID(),
				WorkspaceID: c.WorkspaceID(),
			})
		}

		_, err = r.queries.UpdateCompany(ctx, queries.UpdateCompanyParams{
			ID:          c.ID(),
			WorkspaceID: c.WorkspaceID(),
			Name:        c.Name(),
			Website:     c.Website(),
			Notes:       c.Notes(),
		})
		return err
	}

	_, err = r.queries.CreateCompany(ctx, queries.CreateCompanyParams{
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

func (r *CompanyRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return r.queries.DeleteCompany(ctx, queries.DeleteCompanyParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
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
