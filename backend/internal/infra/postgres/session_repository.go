package postgres

import (
	"context"
	"errors"
	"net/netip"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
)

// SessionRepository implements session.Repository using PostgreSQL.
type SessionRepository struct {
	pool *pgxpool.Pool
}

// NewSessionRepository creates a new SessionRepository.
func NewSessionRepository(pool *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{pool: pool}
}

// Save persists a new session.
func (r *SessionRepository) Save(ctx context.Context, s *session.Session) error {
	query := `
		INSERT INTO auth.user_sessions (
			id, user_id, refresh_token_hash, device_info, ip_address, user_agent, last_active_at, expires_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	// Parse IP address to netip.Addr for PostgreSQL INET type
	var ipAddr *netip.Addr
	if ipStr := s.IPAddress(); ipStr != "" {
		if addr, err := netip.ParseAddr(ipStr); err == nil {
			ipAddr = &addr
		}
	}

	// Handle nullable strings
	var deviceInfo, userAgent *string
	if di := s.DeviceInfo(); di != "" {
		deviceInfo = &di
	}
	if ua := s.UserAgent(); ua != "" {
		userAgent = &ua
	}

	_, err := r.pool.Exec(ctx, query,
		s.ID(),
		s.UserID(),
		s.TokenHash(),
		deviceInfo,
		ipAddr,
		userAgent,
		s.LastActiveAt(),
		s.ExpiresAt(),
		s.CreatedAt(),
	)
	return err
}

// FindByID finds a session by ID.
func (r *SessionRepository) FindByID(ctx context.Context, id uuid.UUID) (*session.Session, error) {
	query := `
		SELECT id, user_id, refresh_token_hash, device_info, ip_address, user_agent, last_active_at, expires_at, created_at
		FROM auth.user_sessions
		WHERE id = $1 AND expires_at > now()
	`

	row := r.pool.QueryRow(ctx, query, id)
	return r.scanSession(row)
}

// FindByTokenHash finds a session by its refresh token hash.
func (r *SessionRepository) FindByTokenHash(ctx context.Context, hash string) (*session.Session, error) {
	query := `
		SELECT id, user_id, refresh_token_hash, device_info, ip_address, user_agent, last_active_at, expires_at, created_at
		FROM auth.user_sessions
		WHERE refresh_token_hash = $1 AND expires_at > now()
	`

	row := r.pool.QueryRow(ctx, query, hash)
	return r.scanSession(row)
}

// FindByUserID returns all active sessions for a user.
func (r *SessionRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*session.Session, error) {
	query := `
		SELECT id, user_id, refresh_token_hash, device_info, ip_address, user_agent, last_active_at, expires_at, created_at
		FROM auth.user_sessions
		WHERE user_id = $1 AND expires_at > now()
		ORDER BY last_active_at DESC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*session.Session
	for rows.Next() {
		s, err := r.scanSessionFromRows(rows)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}

	return sessions, rows.Err()
}

// UpdateActivity updates a session's activity.
func (r *SessionRepository) UpdateActivity(ctx context.Context, id uuid.UUID, newTokenHash string) error {
	query := `
		UPDATE auth.user_sessions
		SET last_active_at = now(), refresh_token_hash = $2
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, id, newTokenHash)
	return err
}

// Delete removes a specific session.
func (r *SessionRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	query := `DELETE FROM auth.user_sessions WHERE id = $1 AND user_id = $2`
	_, err := r.pool.Exec(ctx, query, id, userID)
	return err
}

// DeleteAllExcept removes all sessions except the specified one.
func (r *SessionRepository) DeleteAllExcept(ctx context.Context, userID, exceptID uuid.UUID) error {
	query := `DELETE FROM auth.user_sessions WHERE user_id = $1 AND id != $2`
	_, err := r.pool.Exec(ctx, query, userID, exceptID)
	return err
}

// DeleteAllForUser removes all sessions for a user.
func (r *SessionRepository) DeleteAllForUser(ctx context.Context, userID uuid.UUID) error {
	query := `DELETE FROM auth.user_sessions WHERE user_id = $1`
	_, err := r.pool.Exec(ctx, query, userID)
	return err
}

// scanSession scans a single row into a Session.
func (r *SessionRepository) scanSession(row pgx.Row) (*session.Session, error) {
	var (
		id           uuid.UUID
		userID       uuid.UUID
		tokenHash    string
		deviceInfo   *string
		ipAddress    *netip.Addr
		userAgent    *string
		lastActiveAt time.Time
		expiresAt    time.Time
		createdAt    time.Time
	)

	err := row.Scan(&id, &userID, &tokenHash, &deviceInfo, &ipAddress, &userAgent, &lastActiveAt, &expiresAt, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	// Convert nullable fields
	di := ""
	if deviceInfo != nil {
		di = *deviceInfo
	}
	ip := ""
	if ipAddress != nil {
		ip = ipAddress.String()
	}
	ua := ""
	if userAgent != nil {
		ua = *userAgent
	}

	return session.Reconstitute(id, userID, tokenHash, di, ip, ua, lastActiveAt, expiresAt, createdAt), nil
}

// scanSessionFromRows scans a row from Rows into a Session.
func (r *SessionRepository) scanSessionFromRows(rows pgx.Rows) (*session.Session, error) {
	var (
		id           uuid.UUID
		userID       uuid.UUID
		tokenHash    string
		deviceInfo   *string
		ipAddress    *netip.Addr
		userAgent    *string
		lastActiveAt time.Time
		expiresAt    time.Time
		createdAt    time.Time
	)

	err := rows.Scan(&id, &userID, &tokenHash, &deviceInfo, &ipAddress, &userAgent, &lastActiveAt, &expiresAt, &createdAt)
	if err != nil {
		return nil, err
	}

	// Convert nullable fields
	di := ""
	if deviceInfo != nil {
		di = *deviceInfo
	}
	ip := ""
	if ipAddress != nil {
		ip = ipAddress.String()
	}
	ua := ""
	if userAgent != nil {
		ua = *userAgent
	}

	return session.Reconstitute(id, userID, tokenHash, di, ip, ua, lastActiveAt, expiresAt, createdAt), nil
}
