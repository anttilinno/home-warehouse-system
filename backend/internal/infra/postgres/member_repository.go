package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MemberRepository implements member.Repository using PostgreSQL.
type MemberRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewMemberRepository creates a new MemberRepository.
func NewMemberRepository(pool *pgxpool.Pool) *MemberRepository {
	return &MemberRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// Save persists a member (create or update).
func (r *MemberRepository) Save(ctx context.Context, m *member.Member) error {
	// Convert invited_by to pgtype.UUID
	var invitedBy pgtype.UUID
	if m.InvitedBy() != nil {
		invitedBy = pgtype.UUID{Bytes: *m.InvitedBy(), Valid: true}
	}

	_, err := r.queries.CreateMember(ctx, queries.CreateMemberParams{
		ID:          m.ID(),
		WorkspaceID: m.WorkspaceID(),
		UserID:      m.UserID(),
		Role:        queries.AuthWorkspaceRoleEnum(m.Role()),
		InvitedBy:   invitedBy,
	})
	return err
}

// FindByWorkspaceAndUser retrieves a member by workspace and user ID.
func (r *MemberRepository) FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (*member.Member, error) {
	row, err := r.queries.GetMember(ctx, queries.GetMemberParams{
		WorkspaceID: workspaceID,
		UserID:      userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	// Convert invited_by
	var invitedBy *uuid.UUID
	if row.InvitedBy.Valid {
		id := uuid.UUID(row.InvitedBy.Bytes)
		invitedBy = &id
	}

	return member.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.UserID,
		member.Role(row.Role),
		invitedBy,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	), nil
}

// ListByWorkspace retrieves all members in a workspace.
func (r *MemberRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*member.Member, error) {
	rows, err := r.queries.ListMembersByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	members := make([]*member.Member, 0, len(rows))
	for _, row := range rows {
		// Convert invited_by
		var invitedBy *uuid.UUID
		if row.InvitedBy.Valid {
			id := uuid.UUID(row.InvitedBy.Bytes)
			invitedBy = &id
		}

		members = append(members, member.Reconstruct(
			row.ID,
			row.WorkspaceID,
			row.UserID,
			member.Role(row.Role),
			invitedBy,
			row.CreatedAt.Time,
			row.UpdatedAt.Time,
		))
	}

	return members, nil
}

// Delete removes a member.
func (r *MemberRepository) Delete(ctx context.Context, workspaceID, userID uuid.UUID) error {
	return r.queries.DeleteMember(ctx, queries.DeleteMemberParams{
		WorkspaceID: workspaceID,
		UserID:      userID,
	})
}

// CountOwners counts the number of owners in a workspace.
func (r *MemberRepository) CountOwners(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	return r.queries.CountWorkspaceOwners(ctx, workspaceID)
}

// Exists checks if a member exists.
func (r *MemberRepository) Exists(ctx context.Context, workspaceID, userID uuid.UUID) (bool, error) {
	return r.queries.MemberExists(ctx, queries.MemberExistsParams{
		WorkspaceID: workspaceID,
		UserID:      userID,
	})
}
