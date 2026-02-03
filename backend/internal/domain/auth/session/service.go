package session

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrSessionNotFound = errors.New("session not found")
	ErrUnauthorized    = errors.New("unauthorized to access this session")
)

// ServiceInterface defines session service operations.
type ServiceInterface interface {
	Create(ctx context.Context, userID uuid.UUID, refreshToken, userAgent, ipAddress string) (*Session, error)
	FindByTokenHash(ctx context.Context, tokenHash string) (*Session, error)
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]*Session, error)
	UpdateActivity(ctx context.Context, sessionID uuid.UUID, newRefreshToken string) error
	Revoke(ctx context.Context, userID, sessionID uuid.UUID) error
	RevokeAllExcept(ctx context.Context, userID, currentSessionID uuid.UUID) error
	RevokeAll(ctx context.Context, userID uuid.UUID) error
}

// Service handles session business logic.
type Service struct {
	repo            Repository
	refreshDuration time.Duration
}

// NewService creates a new session service.
func NewService(repo Repository) *Service {
	return &Service{
		repo:            repo,
		refreshDuration: 7 * 24 * time.Hour, // Match JWT refresh token expiry
	}
}

// Create creates a new session.
func (s *Service) Create(ctx context.Context, userID uuid.UUID, refreshToken, userAgent, ipAddress string) (*Session, error) {
	expiresAt := time.Now().Add(s.refreshDuration)
	session := NewSession(userID, refreshToken, userAgent, ipAddress, expiresAt)
	if err := s.repo.Save(ctx, session); err != nil {
		return nil, err
	}
	return session, nil
}

// FindByTokenHash finds a session by its refresh token hash.
func (s *Service) FindByTokenHash(ctx context.Context, tokenHash string) (*Session, error) {
	session, err := s.repo.FindByTokenHash(ctx, tokenHash)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, ErrSessionNotFound
	}
	return session, nil
}

// FindByUserID returns all active sessions for a user.
func (s *Service) FindByUserID(ctx context.Context, userID uuid.UUID) ([]*Session, error) {
	return s.repo.FindByUserID(ctx, userID)
}

// UpdateActivity updates session activity on token refresh.
func (s *Service) UpdateActivity(ctx context.Context, sessionID uuid.UUID, newRefreshToken string) error {
	return s.repo.UpdateActivity(ctx, sessionID, HashToken(newRefreshToken))
}

// Revoke deletes a specific session.
func (s *Service) Revoke(ctx context.Context, userID, sessionID uuid.UUID) error {
	return s.repo.Delete(ctx, sessionID, userID)
}

// RevokeAllExcept deletes all sessions except the specified one.
func (s *Service) RevokeAllExcept(ctx context.Context, userID, currentSessionID uuid.UUID) error {
	return s.repo.DeleteAllExcept(ctx, userID, currentSessionID)
}

// RevokeAll deletes all sessions for a user.
func (s *Service) RevokeAll(ctx context.Context, userID uuid.UUID) error {
	return s.repo.DeleteAllForUser(ctx, userID)
}
