package authelia

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// Cookie parameters -- kept in lockstep with the user and oauth handlers so all
// three authentication methods produce interchangeable sessions.
const (
	accessTokenCookie  = "access_token"
	refreshTokenCookie = "refresh_token"

	accessTokenMaxAge  = 24 * 60 * 60     // 24 hours
	refreshTokenMaxAge = 7 * 24 * 60 * 60 // 7 days
)

// sharedSecretHeader is injected by the reverse proxy in front of Authelia and
// MUST be stripped from any client-supplied request by that same proxy. It is
// the trust boundary for the Remote-* identity headers.
const sharedSecretHeader = "X-Authelia-Shared-Secret"

// Handler exchanges Authelia's trusted identity headers for application JWT
// cookies.
type Handler struct {
	svc          *Service
	jwt          *jwt.Service
	sessionSvc   session.ServiceInterface
	sharedSecret string
	isSecure     bool
}

// NewHandler creates a new Authelia auth handler.
func NewHandler(svc *Service, jwtSvc *jwt.Service, sessionSvc session.ServiceInterface, cfg *config.Config) *Handler {
	return &Handler{
		svc:          svc,
		jwt:          jwtSvc,
		sessionSvc:   sessionSvc,
		sharedSecret: cfg.AutheliaSharedSecret,
		isSecure:     strings.HasPrefix(cfg.AppURL, "https"),
	}
}

// LoginInput carries the headers Authelia and the ingress inject. The struct is
// the API contract: huma reads each header by name.
type LoginInput struct {
	SharedSecret  string `header:"X-Authelia-Shared-Secret"`
	RemoteUser    string `header:"Remote-User"`
	RemoteEmail   string `header:"Remote-Email"`
	RemoteName    string `header:"Remote-Name"`
	RemoteGroups  string `header:"Remote-Groups"`
	UserAgent     string `header:"User-Agent"`
	XForwardedFor string `header:"X-Forwarded-For"`
	XRealIP       string `header:"X-Real-IP"`
}

// LoginOutput sets the same auth cookies as the email/password and OAuth flows.
type LoginOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

// Login validates the Authelia trust header, resolves (or provisions) the local
// user, and issues JWT cookies. POST /auth/authelia/login.
func (h *Handler) Login(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	// Trust gate: constant-time compare against the ingress-injected secret.
	// Rejects both a wrong secret and a missing one (empty != configured secret).
	if subtle.ConstantTimeCompare([]byte(input.SharedSecret), []byte(h.sharedSecret)) != 1 {
		return nil, huma.Error401Unauthorized("invalid or missing Authelia trust header")
	}

	email := strings.TrimSpace(input.RemoteEmail)
	if email == "" {
		return nil, huma.Error401Unauthorized("Authelia did not supply an authenticated identity")
	}

	fullName := firstNonEmpty(strings.TrimSpace(input.RemoteName), strings.TrimSpace(input.RemoteUser), localPart(email))

	u, isNew, err := h.svc.ResolveUser(ctx, email, fullName)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to resolve Authelia user")
	}

	accessToken, err := h.jwt.GenerateToken(u.ID(), u.Email(), u.FullName(), u.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to issue access token")
	}
	refreshToken, err := h.jwt.GenerateRefreshToken(u.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to issue refresh token")
	}

	// Track the session so it appears in device management and can be revoked.
	ip := clientIP(input.XForwardedFor, input.XRealIP)
	if _, err := h.sessionSvc.Create(ctx, u.ID(), refreshToken, input.UserAgent, ip); err != nil {
		return nil, huma.Error500InternalServerError("failed to create session")
	}

	slog.InfoContext(ctx, "authelia login",
		"user_id", u.ID(),
		"email", email,
		"groups", input.RemoteGroups,
		"new_user", isNew,
	)

	out := &LoginOutput{
		SetCookie: []http.Cookie{
			{Name: accessTokenCookie, Value: accessToken, Path: "/", MaxAge: accessTokenMaxAge, HttpOnly: true, Secure: h.isSecure, SameSite: http.SameSiteLaxMode},
			{Name: refreshTokenCookie, Value: refreshToken, Path: "/", MaxAge: refreshTokenMaxAge, HttpOnly: true, Secure: h.isSecure, SameSite: http.SameSiteLaxMode},
		},
	}
	out.Body.Token = accessToken
	out.Body.RefreshToken = refreshToken
	return out, nil
}

// firstNonEmpty returns the first non-empty argument, or "" if all are empty.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// localPart returns the portion of an email before the "@".
func localPart(email string) string {
	if i := strings.IndexByte(email, '@'); i > 0 {
		return email[:i]
	}
	return email
}

// clientIP extracts the originating client IP from forwarded headers, matching
// the convention used by the email/password and OAuth login handlers.
func clientIP(xForwardedFor, xRealIP string) string {
	if xForwardedFor != "" {
		if i := strings.IndexByte(xForwardedFor, ','); i >= 0 {
			return strings.TrimSpace(xForwardedFor[:i])
		}
		return strings.TrimSpace(xForwardedFor)
	}
	return strings.TrimSpace(xRealIP)
}
