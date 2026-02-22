package oauth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

const (
	// oauthStateCookie is the cookie name for CSRF state + PKCE verifier.
	oauthStateCookie = "oauth_state"
	// oauthCodePrefix is the Redis key prefix for one-time codes.
	oauthCodePrefix = "oauth_code:"
	// oauthCodeTTL is how long a one-time code is valid.
	oauthCodeTTL = 60 * time.Second
	// oauthStateCookieMaxAge is how long the CSRF state cookie lives (10 min).
	oauthStateCookieMaxAge = 600

	// Cookie names (matching user handler)
	accessTokenCookie  = "access_token"
	refreshTokenCookie = "refresh_token"
	// Cookie max ages (matching user handler)
	accessTokenMaxAge  = 24 * 60 * 60     // 24 hours
	refreshTokenMaxAge = 7 * 24 * 60 * 60 // 7 days
)

// RedisClient defines the minimal Redis interface needed by the OAuth handler.
// This avoids importing the Redis package directly.
type RedisClient interface {
	Set(ctx context.Context, key, value string, expiration time.Duration) error
	GetDel(ctx context.Context, key string) (string, error)
}

// SessionService defines the session creation interface for the OAuth handler.
type SessionService interface {
	Create(ctx context.Context, userID uuid.UUID, refreshToken, userAgent, ipAddress string) (*session.Session, error)
}

// Handler holds dependencies for OAuth HTTP handlers.
type Handler struct {
	service         *Service
	jwtService      jwt.ServiceInterface
	sessionSvc      SessionService
	redisClient     RedisClient
	cfg             *config.Config
	providerConfigs map[string]*oauth2.Config
}

// NewHandler creates a new OAuth handler.
func NewHandler(svc *Service, jwtSvc jwt.ServiceInterface, sessionSvc SessionService, redisClient RedisClient, cfg *config.Config) *Handler {
	providerConfigs := make(map[string]*oauth2.Config)

	// Build provider configs from environment
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		providerConfigs["google"] = GoogleConfig(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.BackendURL)
	}
	if cfg.GitHubClientID != "" && cfg.GitHubClientSecret != "" {
		providerConfigs["github"] = GitHubConfig(cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.BackendURL)
	}

	return &Handler{
		service:         svc,
		jwtService:      jwtSvc,
		sessionSvc:      sessionSvc,
		redisClient:     redisClient,
		cfg:             cfg,
		providerConfigs: providerConfigs,
	}
}

// Initiate handles GET /auth/oauth/{provider} -- redirects to the provider's authorization URL.
// This is a raw Chi handler (not Huma) because it performs a redirect.
func (h *Handler) Initiate(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")

	providerCfg, ok := h.providerConfigs[provider]
	if !ok {
		http.Error(w, `{"error":"invalid_provider","message":"unsupported OAuth provider"}`, http.StatusBadRequest)
		return
	}

	// Generate PKCE verifier
	verifier := oauth2.GenerateVerifier()

	// Generate CSRF state: 32 bytes, base64url encoded
	stateBytes := make([]byte, 32)
	if _, err := rand.Read(stateBytes); err != nil {
		http.Error(w, `{"error":"server_error","message":"failed to generate state"}`, http.StatusInternalServerError)
		return
	}
	state := base64.RawURLEncoding.EncodeToString(stateBytes)

	// Store state and verifier in a single HttpOnly cookie
	isSecure := strings.HasPrefix(h.cfg.AppURL, "https")
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    state + "|" + verifier,
		Path:     "/",
		MaxAge:   oauthStateCookieMaxAge,
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
	})

	// Build authorization URL with PKCE challenge
	authURL := providerCfg.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// Callback handles GET /auth/oauth/{provider}/callback -- processes the provider's response.
// This is a raw Chi handler (not Huma) because it performs redirects.
func (h *Handler) Callback(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")

	providerCfg, ok := h.providerConfigs[provider]
	if !ok {
		redirectWithError(w, r, h.cfg.AppURL, "provider_unavailable")
		return
	}

	// Read CSRF state cookie
	cookie, err := r.Cookie(oauthStateCookie)
	if err != nil {
		redirectWithError(w, r, h.cfg.AppURL, "invalid_state")
		return
	}

	// Parse cookie value: state|verifier
	parts := strings.SplitN(cookie.Value, "|", 2)
	if len(parts) != 2 {
		redirectWithError(w, r, h.cfg.AppURL, "invalid_state")
		return
	}
	expectedState := parts[0]
	verifier := parts[1]

	// Validate state matches query param (CSRF check -- Pitfall 8-C)
	actualState := r.URL.Query().Get("state")
	if actualState != expectedState {
		redirectWithError(w, r, h.cfg.AppURL, "invalid_state")
		return
	}

	// Delete the state cookie immediately
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})

	// Check for OAuth error in query params (user denied, etc.)
	if oauthErr := r.URL.Query().Get("error"); oauthErr != "" {
		redirectWithError(w, r, h.cfg.AppURL, "authorization_cancelled")
		return
	}

	// Exchange authorization code for token with PKCE verifier
	code := r.URL.Query().Get("code")
	token, err := providerCfg.Exchange(r.Context(), code, oauth2.VerifierOption(verifier))
	if err != nil {
		log.Printf("OAuth token exchange error: %v", err)
		redirectWithError(w, r, h.cfg.AppURL, "server_error")
		return
	}

	// Fetch user profile from provider
	var profile *OAuthProfile
	switch provider {
	case "google":
		profile, err = FetchGoogleProfile(r.Context(), token, providerCfg)
	case "github":
		profile, err = FetchGitHubProfile(r.Context(), token, providerCfg)
	default:
		redirectWithError(w, r, h.cfg.AppURL, "provider_unavailable")
		return
	}
	if err != nil {
		log.Printf("OAuth profile fetch error: %v", err)
		redirectWithError(w, r, h.cfg.AppURL, "server_error")
		return
	}

	// Resolve user: find existing or create new
	user, _, err := h.service.FindOrCreateUser(r.Context(), *profile)
	if err != nil {
		if errors.Is(err, ErrEmailNotVerified) {
			redirectWithError(w, r, h.cfg.AppURL, "email_not_verified")
			return
		}
		log.Printf("OAuth FindOrCreateUser error: %v", err)
		redirectWithError(w, r, h.cfg.AppURL, "server_error")
		return
	}

	// Generate JWT tokens
	accessToken, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
	if err != nil {
		log.Printf("OAuth JWT generation error: %v", err)
		redirectWithError(w, r, h.cfg.AppURL, "server_error")
		return
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		log.Printf("OAuth refresh token generation error: %v", err)
		redirectWithError(w, r, h.cfg.AppURL, "server_error")
		return
	}

	// Create session (same as login handler)
	if h.sessionSvc != nil {
		userAgent := r.Header.Get("User-Agent")
		ipAddress := r.Header.Get("X-Forwarded-For")
		if ipAddress == "" {
			ipAddress = r.Header.Get("X-Real-IP")
		}
		_, _ = h.sessionSvc.Create(r.Context(), user.ID(), refreshToken, userAgent, ipAddress)
	}

	// Generate one-time code: 32 bytes, base64url encoded
	codeBytes := make([]byte, 32)
	if _, err := rand.Read(codeBytes); err != nil {
		log.Printf("OAuth code generation error: %v", err)
		redirectWithError(w, r, h.cfg.AppURL, "server_error")
		return
	}
	oneTimeCode := base64.RawURLEncoding.EncodeToString(codeBytes)

	// Store tokens in Redis with the one-time code as key
	redisValue := accessToken + "|" + refreshToken
	if err := h.redisClient.Set(r.Context(), oauthCodePrefix+oneTimeCode, redisValue, oauthCodeTTL); err != nil {
		log.Printf("OAuth Redis set error: %v", err)
		redirectWithError(w, r, h.cfg.AppURL, "server_error")
		return
	}

	// Redirect to frontend with one-time code
	redirectURL := fmt.Sprintf("%s/auth/callback?code=%s", h.cfg.AppURL, oneTimeCode)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

// ExchangeInput is the request body for the token exchange endpoint.
type ExchangeInput struct {
	Body struct {
		Code string `json:"code" required:"true" minLength:"1"`
	}
}

// ExchangeOutput is the response body for the token exchange endpoint.
type ExchangeOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

// ExchangeCode handles POST /auth/oauth/exchange -- consumes a one-time code and returns JWT tokens.
func (h *Handler) ExchangeCode(ctx context.Context, input *ExchangeInput) (*ExchangeOutput, error) {
	code := input.Body.Code
	if code == "" {
		return nil, huma.Error400BadRequest("code is required")
	}

	// Read and delete from Redis (atomic get-del)
	value, err := h.redisClient.GetDel(ctx, oauthCodePrefix+code)
	if err != nil || value == "" {
		return nil, huma.Error401Unauthorized("invalid or expired code")
	}

	// Parse value: accessToken|refreshToken
	parts := strings.SplitN(value, "|", 2)
	if len(parts) != 2 {
		return nil, huma.Error500InternalServerError("invalid token data")
	}

	accessToken := parts[0]
	refreshToken := parts[1]

	isSecure := strings.HasPrefix(h.cfg.AppURL, "https")

	return &ExchangeOutput{
		SetCookie: []http.Cookie{
			{
				Name:     accessTokenCookie,
				Value:    accessToken,
				Path:     "/",
				MaxAge:   accessTokenMaxAge,
				HttpOnly: true,
				Secure:   isSecure,
				SameSite: http.SameSiteLaxMode,
			},
			{
				Name:     refreshTokenCookie,
				Value:    refreshToken,
				Path:     "/",
				MaxAge:   refreshTokenMaxAge,
				HttpOnly: true,
				Secure:   isSecure,
				SameSite: http.SameSiteLaxMode,
			},
		},
		Body: struct {
			Token        string `json:"token"`
			RefreshToken string `json:"refresh_token"`
		}{
			Token:        accessToken,
			RefreshToken: refreshToken,
		},
	}, nil
}

// ListAccountsOutput is the response for listing linked OAuth accounts.
type ListAccountsOutput struct {
	Body struct {
		Accounts []AccountResponse `json:"accounts"`
	}
}

// AccountResponse represents a single linked OAuth account.
type AccountResponse struct {
	Provider       string    `json:"provider"`
	ProviderUserID string    `json:"provider_user_id"`
	Email          string    `json:"email"`
	DisplayName    string    `json:"display_name"`
	AvatarURL      string    `json:"avatar_url"`
	CreatedAt      time.Time `json:"created_at"`
}

// ListAccounts handles GET /auth/oauth/accounts -- returns linked OAuth providers.
func (h *Handler) ListAccounts(ctx context.Context, input *struct{}) (*ListAccountsOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	accounts, err := h.service.ListAccounts(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to list OAuth accounts")
	}

	result := make([]AccountResponse, len(accounts))
	for i, a := range accounts {
		result[i] = AccountResponse{
			Provider:       a.Provider(),
			ProviderUserID: a.ProviderUserID(),
			Email:          a.Email(),
			DisplayName:    a.DisplayName(),
			AvatarURL:      a.AvatarURL(),
			CreatedAt:      a.CreatedAt(),
		}
	}

	return &ListAccountsOutput{
		Body: struct {
			Accounts []AccountResponse `json:"accounts"`
		}{
			Accounts: result,
		},
	}, nil
}

// UnlinkInput is the request for unlinking an OAuth provider.
type UnlinkInput struct {
	Provider string `path:"provider"`
}

// UnlinkAccount handles DELETE /auth/oauth/accounts/{provider} -- removes a provider link.
func (h *Handler) UnlinkAccount(ctx context.Context, input *UnlinkInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	// Load user to check HasPassword (needed by service to prevent lockout)
	user, err := h.service.userSvc.GetByID(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to load user")
	}

	err = h.service.UnlinkAccount(ctx, authUser.ID, input.Provider, user.HasPassword())
	if err != nil {
		if errors.Is(err, ErrCannotUnlinkLastAuth) {
			return nil, huma.Error409Conflict("cannot unlink sole authentication method when no password is set")
		}
		if errors.Is(err, ErrOAuthAccountNotFound) || shared.IsNotFound(err) {
			return nil, huma.Error404NotFound("OAuth account not found")
		}
		return nil, huma.Error500InternalServerError("failed to unlink OAuth account")
	}

	return nil, nil
}

// redirectWithError redirects to the frontend callback with an error code.
// Error codes: invalid_state, authorization_cancelled, email_not_verified,
// server_error, provider_unavailable.
func redirectWithError(w http.ResponseWriter, r *http.Request, appURL, errorCode string) {
	redirectURL := fmt.Sprintf("%s/auth/callback?error=%s", appURL, errorCode)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
