package session

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines session persistence operations.
type Repository interface {
	Save(ctx context.Context, session *Session) error
	FindByID(ctx context.Context, id uuid.UUID) (*Session, error)
	FindByTokenHash(ctx context.Context, hash string) (*Session, error)
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]*Session, error)
	UpdateActivity(ctx context.Context, id uuid.UUID, newTokenHash string) error
	Delete(ctx context.Context, id, userID uuid.UUID) error
	DeleteAllExcept(ctx context.Context, userID, exceptID uuid.UUID) error
	DeleteAllForUser(ctx context.Context, userID uuid.UUID) error
}
