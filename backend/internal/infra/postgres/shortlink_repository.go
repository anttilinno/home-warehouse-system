package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/shortlink"
)

// ShortlinkRepository resolves a short_code against the global
// warehouse.short_codes registry (migration 005), scoped to a set of
// workspace IDs. It implements shortlink.Resolver.
type ShortlinkRepository struct {
	pool *pgxpool.Pool
}

// NewShortlinkRepository creates a new shortlink repository.
func NewShortlinkRepository(pool *pgxpool.Pool) *ShortlinkRepository {
	return &ShortlinkRepository{pool: pool}
}

// resolveShortCodeSQL is a single PK lookup against the registry. Codes are
// globally unique (short_codes_pkey), so at most one row exists; the
// workspace scope is bound as a uuid[] via $2 and acts as the membership
// check — a code registered to a foreign workspace resolves to no rows
// (mitigates T-uzt-02 cross-tenant leak and T-uzt-03 injection: no string
// concat). entity_type is the uppercase favorite_type_enum; lower() maps it
// onto the shortlink.Type* tags.
const resolveShortCodeSQL = `
SELECT lower(entity_type::text), entity_id, workspace_id
  FROM warehouse.short_codes
 WHERE code = $1 AND workspace_id = ANY($2)`

// Resolve returns the registry match for code within workspaceIDs, or
// (nil, nil) when the code is unknown or owned by a foreign workspace.
func (r *ShortlinkRepository) Resolve(ctx context.Context, code string, workspaceIDs []uuid.UUID) (*shortlink.Match, error) {
	if len(workspaceIDs) == 0 {
		return nil, nil
	}

	var m shortlink.Match
	err := r.pool.QueryRow(ctx, resolveShortCodeSQL, code, workspaceIDs).
		Scan(&m.Type, &m.ID, &m.WorkspaceID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}
