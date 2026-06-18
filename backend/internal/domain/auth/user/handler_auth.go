package user

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

func (h *Handler) register(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
	user, err := h.svc.Create(ctx, CreateUserInput{
		Email:    input.Body.Email,
		FullName: input.Body.FullName,
		Password: input.Body.Password,
	})
	if err != nil {
		if shared.IsAlreadyExists(err) {
			return nil, huma.Error409Conflict(msgEmailAlreadyTaken)
		}
		if shared.IsInvalidInput(err) {
			return nil, appMiddleware.MapDomainError(err)
		}
		return nil, huma.Error500InternalServerError("failed to create user")
	}

	// Create a personal workspace for the new user
	workspaceName := fmt.Sprintf("%s's Workspace", user.FullName())
	workspaceSlug := fmt.Sprintf("user-%s", user.ID().String())
	_, err = h.workspaceSvc.Create(ctx, workspace.CreateWorkspaceInput{
		Name:        workspaceName,
		Slug:        workspaceSlug,
		Description: nil,
		IsPersonal:  true,
		CreatedBy:   user.ID(),
	})
	if err != nil {
		// Don't fail registration if the personal workspace can't be created.
		// In production this should be a transaction or retry; for now, log it.
		slog.ErrorContext(ctx, "register: failed to create personal workspace",
			"user_id", user.ID(), "error", err)
	}

	// Generate token for the new user
	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError(msgFailedGenerateToken)
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError(msgFailedGenerateRefreshToken)
	}

	return &RegisterOutput{
		SetCookie: []http.Cookie{
			*createAuthCookie(accessTokenCookie, token, accessTokenMaxAge),
			*createAuthCookie(refreshTokenCookie, refreshToken, refreshTokenMaxAge),
		},
		Body: struct {
			Token        string `json:"token"`
			RefreshToken string `json:"refresh_token"`
		}{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) login(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	user, err := h.svc.Authenticate(ctx, input.Body.Email, input.Body.Password)
	if err != nil {
		return nil, huma.Error401Unauthorized("invalid credentials")
	}

	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError(msgFailedGenerateToken)
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError(msgFailedGenerateRefreshToken)
	}

	// Create session if session service is configured
	if h.sessionSvc != nil {
		ipAddress := getClientIPFromHeaders(input.XForwardedFor, input.XRealIP)
		_, _ = h.sessionSvc.Create(ctx, user.ID(), refreshToken, input.UserAgent, ipAddress)
	}

	return &LoginOutput{
		SetCookie: []http.Cookie{
			*createAuthCookie(accessTokenCookie, token, accessTokenMaxAge),
			*createAuthCookie(refreshTokenCookie, refreshToken, refreshTokenMaxAge),
		},
		Body: struct {
			Token        string `json:"token"`
			RefreshToken string `json:"refresh_token"`
		}{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) refreshToken(ctx context.Context, input *RefreshTokenInput) (*RefreshTokenOutput, error) {
	userID, err := h.jwtService.ValidateRefreshToken(input.Body.RefreshToken)
	if err != nil {
		if err == jwt.ErrExpiredToken {
			return nil, huma.Error401Unauthorized("refresh token has expired")
		}
		return nil, huma.Error401Unauthorized("invalid refresh token")
	}

	// Validate session exists (if session service is configured).
	// A missing session means it was revoked (or never existed) — reject.
	// There is deliberately NO "legacy token" fallback: re-creating a session
	// here would let a revoked refresh JWT mint itself a fresh session and
	// defeat Revoke/RevokeAll entirely.
	var currentSession *session.Session
	if h.sessionSvc != nil {
		tokenHash := session.HashToken(input.Body.RefreshToken)
		currentSession, err = h.sessionSvc.FindByTokenHash(ctx, tokenHash)
		if err != nil {
			return nil, huma.Error401Unauthorized("session has been revoked")
		}
	}

	user, err := h.svc.GetByID(ctx, userID)
	if err != nil {
		return nil, huma.Error401Unauthorized(msgUserNotFound)
	}

	if !user.IsActive() {
		return nil, huma.Error401Unauthorized("user is deactivated")
	}

	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError(msgFailedGenerateToken)
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError(msgFailedGenerateRefreshToken)
	}

	// Rotate the session's token hash
	if h.sessionSvc != nil && currentSession != nil {
		_ = h.sessionSvc.UpdateActivity(ctx, currentSession.ID(), refreshToken)
	}

	return &RefreshTokenOutput{
		SetCookie: []http.Cookie{
			*createAuthCookie(accessTokenCookie, token, accessTokenMaxAge),
			*createAuthCookie(refreshTokenCookie, refreshToken, refreshTokenMaxAge),
		},
		Body: RefreshTokenResponse{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) logout(ctx context.Context, input *LogoutInput) (*LogoutOutput, error) {
	// Revoke the server-side session so the refresh token cannot be replayed
	// after logout. Missing/invalid tokens are handled gracefully — the
	// cookies are cleared either way.
	if h.sessionSvc != nil && input.RefreshToken != "" {
		tokenHash := session.HashToken(input.RefreshToken)
		if sess, err := h.sessionSvc.FindByTokenHash(ctx, tokenHash); err == nil && sess != nil {
			_ = h.sessionSvc.Revoke(ctx, sess.UserID(), sess.ID())
		}
	}

	return &LogoutOutput{
		SetCookie: []http.Cookie{
			*clearAuthCookie(accessTokenCookie),
			*clearAuthCookie(refreshTokenCookie),
		},
	}, nil
}
