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
// The three LEFT JOINs are mutually exclusive (entity_type picks exactly one),
// so COALESCE yields the owning entity's display name — needed by the JSON
// resolve route, which reports "already used by <name>" on a code conflict.
const resolveShortCodeSQL = `
SELECT lower(sc.entity_type::text), sc.entity_id, sc.workspace_id,
       COALESCE(i.name, l.name, c.name, '')
  FROM warehouse.short_codes sc
  LEFT JOIN warehouse.items i
         ON sc.entity_type = 'ITEM' AND i.id = sc.entity_id
  LEFT JOIN warehouse.locations l
         ON sc.entity_type = 'LOCATION' AND l.id = sc.entity_id
  LEFT JOIN warehouse.containers c
         ON sc.entity_type = 'CONTAINER' AND c.id = sc.entity_id
 WHERE sc.code = $1 AND sc.workspace_id = ANY($2)`

// Resolve returns the registry match for code within workspaceIDs, or
// (nil, nil) when the code is unknown or owned by a foreign workspace.
func (r *ShortlinkRepository) Resolve(ctx context.Context, code string, workspaceIDs []uuid.UUID) (*shortlink.Match, error) {
	if len(workspaceIDs) == 0 {
		return nil, nil
	}

	var m shortlink.Match
	err := r.pool.QueryRow(ctx, resolveShortCodeSQL, code, workspaceIDs).
		Scan(&m.Type, &m.ID, &m.WorkspaceID, &m.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}
