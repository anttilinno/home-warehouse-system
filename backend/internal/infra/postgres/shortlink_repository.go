package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/shortlink"
)

// ShortlinkRepository resolves a short_code across items, containers, and
// locations, scoped to a set of workspace IDs. It implements
// shortlink.Resolver.
type ShortlinkRepository struct {
	pool *pgxpool.Pool
}

// NewShortlinkRepository creates a new shortlink repository.
func NewShortlinkRepository(pool *pgxpool.Pool) *ShortlinkRepository {
	return &ShortlinkRepository{pool: pool}
}

// resolveShortCodeSQL is a single UNION ALL across the three short_code-bearing
// tables. A literal sort key (0 for items) keeps item rows first so the handler
// can pick the highest-priority single match. short_code is parameterized ($1)
// and the workspace scope is bound as a uuid[] via $2 — no string concat
// (mitigates T-uzt-02 cross-tenant leak and T-uzt-03 injection).
const resolveShortCodeSQL = `
SELECT 'item' AS entity_type, id, workspace_id, 0 AS sort_key
  FROM warehouse.items
 WHERE short_code = $1 AND workspace_id = ANY($2)
UNION ALL
SELECT 'container' AS entity_type, id, workspace_id, 1 AS sort_key
  FROM warehouse.containers
 WHERE short_code = $1 AND workspace_id = ANY($2)
UNION ALL
SELECT 'location' AS entity_type, id, workspace_id, 2 AS sort_key
  FROM warehouse.locations
 WHERE short_code = $1 AND workspace_id = ANY($2)
ORDER BY sort_key`

// Resolve returns every match for code within workspaceIDs, item rows first.
// A code with no match returns an empty slice and a nil error.
func (r *ShortlinkRepository) Resolve(ctx context.Context, code string, workspaceIDs []uuid.UUID) ([]shortlink.Match, error) {
	if len(workspaceIDs) == 0 {
		return nil, nil
	}

	rows, err := r.pool.Query(ctx, resolveShortCodeSQL, code, workspaceIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var matches []shortlink.Match
	for rows.Next() {
		var (
			entityType  string
			id          uuid.UUID
			workspaceID uuid.UUID
			sortKey     int
		)
		if err := rows.Scan(&entityType, &id, &workspaceID, &sortKey); err != nil {
			return nil, err
		}
		matches = append(matches, shortlink.Match{
			Type:        entityType,
			ID:          id,
			WorkspaceID: workspaceID,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return matches, nil
}
