package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// UserRepository implements user.Repository using PostgreSQL.
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// Save persists a user (create or update).
func (r *UserRepository) Save(ctx context.Context, u *user.User) error {
	query := `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			full_name = EXCLUDED.full_name,
			password_hash = EXCLUDED.password_hash,
			is_active = EXCLUDED.is_active,
			date_format = EXCLUDED.date_format,
			language = EXCLUDED.language,
			theme = EXCLUDED.theme,
			updated_at = EXCLUDED.updated_at
	`

	_, err := r.pool.Exec(ctx, query,
		u.ID(),
		u.Email(),
		u.FullName(),
		u.PasswordHash(),
		u.IsActive(),
		u.IsSuperuser(),
		u.DateFormat(),
		u.Language(),
		u.Theme(),
		u.CreatedAt(),
		u.UpdatedAt(),
	)

	return err
}

// FindByID retrieves a user by ID.
func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	query := `
		SELECT id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, created_at, updated_at
		FROM auth.users
		WHERE id = $1
	`

	row := r.pool.QueryRow(ctx, query, id)
	return r.scanUser(row)
}

// FindByEmail retrieves a user by email.
func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*user.User, error) {
	query := `
		SELECT id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, created_at, updated_at
		FROM auth.users
		WHERE email = $1
	`

	row := r.pool.QueryRow(ctx, query, email)
	return r.scanUser(row)
}

// List retrieves users with pagination.
func (r *UserRepository) List(ctx context.Context, pagination shared.Pagination) ([]*user.User, int, error) {
	// Get total count
	var total int
	countQuery := `SELECT COUNT(*) FROM auth.users WHERE is_active = true`
	if err := r.pool.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get users
	query := `
		SELECT id, email, full_name, password_hash, is_active, is_superuser, date_format, language, theme, created_at, updated_at
		FROM auth.users
		WHERE is_active = true
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, pagination.Limit(), pagination.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []*user.User
	for rows.Next() {
		u, err := r.scanUserFromRows(rows)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}

	return users, total, nil
}

// Delete removes a user by ID.
func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM auth.users WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}

// ExistsByEmail checks if a user with the given email exists.
func (r *UserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = $1)`
	var exists bool
	err := r.pool.QueryRow(ctx, query, email).Scan(&exists)
	return exists, err
}

// scanUser scans a single row into a User.
func (r *UserRepository) scanUser(row pgx.Row) (*user.User, error) {
	var (
		id           uuid.UUID
		email        string
		fullName     string
		passwordHash string
		isActive     bool
		isSuperuser  bool
		dateFormat   string
		language     string
		theme        string
		createdAt    pgtype.Timestamptz
		updatedAt    pgtype.Timestamptz
	)

	err := row.Scan(&id, &email, &fullName, &passwordHash, &isActive, &isSuperuser, &dateFormat, &language, &theme, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return user.Reconstruct(id, email, fullName, passwordHash, isActive, isSuperuser, dateFormat, language, theme, createdAt.Time, updatedAt.Time), nil
}

// scanUserFromRows scans a row from Rows into a User.
func (r *UserRepository) scanUserFromRows(rows pgx.Rows) (*user.User, error) {
	var (
		id           uuid.UUID
		email        string
		fullName     string
		passwordHash string
		isActive     bool
		isSuperuser  bool
		dateFormat   string
		language     string
		theme        string
		createdAt    pgtype.Timestamptz
		updatedAt    pgtype.Timestamptz
	)

	err := rows.Scan(&id, &email, &fullName, &passwordHash, &isActive, &isSuperuser, &dateFormat, &language, &theme, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}

	return user.Reconstruct(id, email, fullName, passwordHash, isActive, isSuperuser, dateFormat, language, theme, createdAt.Time, updatedAt.Time), nil
}
