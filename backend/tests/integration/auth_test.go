//go:build integration
// +build integration

package integration

import (
	"io"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// Registration Tests
// =============================================================================

func TestRegister_Success(t *testing.T) {
	ts := NewTestServer(t)

	email := "register_success_" + uuid.New().String()[:8] + "@example.com"
	resp := ts.Post("/auth/register", map[string]string{
		"email":     email,
		"full_name": "Test User",
		"password":  "password123",
	})

	RequireStatus(t, resp, http.StatusOK)

	// Register now returns tokens (and sets auth cookies); the user object is no
	// longer echoed in the body.
	result := ParseResponse[struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}](t, resp)

	assert.NotEmpty(t, result.Token)
	assert.NotEmpty(t, result.RefreshToken)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	ts := NewTestServer(t)

	// First registration
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "duplicate@example.com",
		"full_name": "Test User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Duplicate registration
	resp = ts.Post("/auth/register", map[string]string{
		"email":     "duplicate@example.com",
		"full_name": "Another User",
		"password":  "password456",
	})
	RequireStatus(t, resp, http.StatusConflict)
	resp.Body.Close()
}

func TestRegister_InvalidEmail(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/register", map[string]string{
		"email":     "invalid-email",
		"full_name": "Test User",
		"password":  "password123",
	})

	RequireStatus(t, resp, http.StatusUnprocessableEntity)
	resp.Body.Close()
}

func TestRegister_ShortPassword(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/register", map[string]string{
		"email":     "test@example.com",
		"full_name": "Test User",
		"password":  "short",
	})

	RequireStatus(t, resp, http.StatusUnprocessableEntity)
	resp.Body.Close()
}

func TestRegister_MissingFields(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/register", map[string]string{
		"email": "test@example.com",
	})

	RequireStatus(t, resp, http.StatusUnprocessableEntity)
	resp.Body.Close()
}

// =============================================================================
// Login Tests
// =============================================================================

func TestLogin_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register user first
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "login@example.com",
		"full_name": "Login User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Login
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "login@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	// Login returns tokens (and sets auth cookies); the user object is no
	// longer echoed in the body.
	result := ParseResponse[struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}](t, resp)

	assert.NotEmpty(t, result.Token)
	assert.NotEmpty(t, result.RefreshToken)
}

func TestLogin_InvalidCredentials(t *testing.T) {
	ts := NewTestServer(t)

	// Register user first
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "cred@example.com",
		"full_name": "Cred User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Login with wrong password
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "cred@example.com",
		"password": "wrongpassword",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestLogin_NonExistentUser(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/login", map[string]string{
		"email":    "nonexistent@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

// =============================================================================
// Token Refresh Tests
// =============================================================================

func TestRefreshToken_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "refresh@example.com",
		"full_name": "Refresh User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "refresh@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		RefreshToken string `json:"refresh_token"`
	}
	loginResult = ParseResponse[struct {
		RefreshToken string `json:"refresh_token"`
	}](t, resp)

	// Refresh token
	resp = ts.Post("/auth/refresh", map[string]string{
		"refresh_token": loginResult.RefreshToken,
	})
	RequireStatus(t, resp, http.StatusOK)

	var refreshResult struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
	refreshResult = ParseResponse[struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}](t, resp)

	assert.NotEmpty(t, refreshResult.Token)
	assert.NotEmpty(t, refreshResult.RefreshToken)
}

func TestRefreshToken_InvalidToken(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Post("/auth/refresh", map[string]string{
		"refresh_token": "invalid-token",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

// =============================================================================
// Session Revocation Tests (AUTH-12 / F2 / F3) + is_current (AUTH-07)
// =============================================================================

// authTokens holds the JSON-body tokens returned by login plus the email used,
// so the same user can be logged in again later (F3 re-inspection).
type authTokens struct {
	Email        string `json:"-"`
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}

// loginExisting logs in an already-registered user by email and returns tokens.
func loginExisting(t *testing.T, ts *TestServer, email string) authTokens {
	t.Helper()
	resp := ts.Post("/auth/login", map[string]string{
		"email":    email,
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	tokens := ParseResponse[authTokens](t, resp)
	tokens.Email = email
	require.NotEmpty(t, tokens.Token, "login must return an access token")
	require.NotEmpty(t, tokens.RefreshToken, "login must return a refresh token")
	return tokens
}

// registerAndLogin registers a fresh unique user and logs in, returning the
// access + refresh tokens (and the email) captured from the login JSON body.
func registerAndLogin(t *testing.T, ts *TestServer) authTokens {
	t.Helper()
	email := "session_" + uuid.New().String()[:8] + "@example.com"

	resp := ts.Post("/auth/register", map[string]string{
		"email":     email,
		"full_name": "Session User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	return loginExisting(t, ts, email)
}

// TestLogout_RevokesSession proves AUTH-12 / F2: after logout, replaying the
// old refresh token is rejected 401 because the server-side session row was
// revoked (revocation is server-authoritative, keyed by HashToken). A revert
// of the logout-revocation fix (f49e4b48) fails the final assertion here.
func TestLogout_RevokesSession(t *testing.T) {
	ts := NewTestServer(t)

	tokens := registerAndLogin(t, ts)

	// Logout carries the refresh_token COOKIE (the handler reads the cookie,
	// not a body field). Stock Post() sends no cookies, so this must be a
	// cookie-bearing request.
	resp := ts.PostWithCookie("/auth/logout", nil, "refresh_token", tokens.RefreshToken)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("logout: expected 200/204, got %d. Body: %s", resp.StatusCode, string(body))
	}
	resp.Body.Close()

	// Replaying the now-revoked refresh token must be rejected.
	resp = ts.Post("/auth/refresh", map[string]string{
		"refresh_token": tokens.RefreshToken,
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	errResp := ParseErrorResponse(t, resp)
	assert.Contains(t, errResp.Detail, "revoked",
		"refresh after logout must report the session was revoked")
}

// TestRefresh_RevokedSession_NoNewSession guards F3: a revoked refresh token
// must NOT be able to mint a brand-new session (no legacy-token resurrection
// fallback). After logout, a second refresh attempt still 401s, and the user's
// session list does not regrow — proving no new row was created.
func TestRefresh_RevokedSession_NoNewSession(t *testing.T) {
	ts := NewTestServer(t)

	tokens := registerAndLogin(t, ts)

	// Revoke via logout.
	resp := ts.PostWithCookie("/auth/logout", nil, "refresh_token", tokens.RefreshToken)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("logout: expected 200/204, got %d. Body: %s", resp.StatusCode, string(body))
	}
	resp.Body.Close()

	// First replay -> 401.
	resp = ts.Post("/auth/refresh", map[string]string{"refresh_token": tokens.RefreshToken})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()

	// Second replay -> still 401, NOT 200. A resurrection bug would 200 here.
	resp = ts.Post("/auth/refresh", map[string]string{"refresh_token": tokens.RefreshToken})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()

	// Re-login the SAME user to inspect the session list. After logout the user
	// had zero sessions; this fresh login creates exactly one. If the revoked-
	// token replays had resurrected sessions, the same user would now have more
	// than one. The fresh refresh token differs from the revoked one, so the
	// revoked session id (if any) would still be listed separately.
	fresh := loginExisting(t, ts, tokens.Email)
	ts.SetToken(fresh.Token)
	resp = ts.RequestWithCookies(http.MethodGet, "/users/me/sessions", nil, map[string]string{
		"access_token":  fresh.Token,
		"refresh_token": fresh.RefreshToken,
	})
	RequireStatus(t, resp, http.StatusOK)
	var sessions []sessionView
	sessions = ParseResponse[[]sessionView](t, resp)

	// Exactly one session: the fresh login. No resurrected sessions from the
	// revoked-token replays.
	assert.Len(t, sessions, 1,
		"revoked-token refresh replays must not create new sessions (F3)")
}

// TestSessions_CurrentSessionMarked guards AUTH-07: with the refresh cookie
// present, CurrentSession resolves the active session so exactly one listed
// session is is_current=true, and revoke-all-others succeeds (NOT 400
// "current session not found").
func TestSessions_CurrentSessionMarked(t *testing.T) {
	ts := NewTestServer(t)

	tokens := registerAndLogin(t, ts)
	ts.SetToken(tokens.Token)

	// Sessions GET must carry BOTH cookies: access_token authenticates and
	// refresh_token lets CurrentSession resolve is_current.
	resp := ts.RequestWithCookies(http.MethodGet, "/users/me/sessions", nil, map[string]string{
		"access_token":  tokens.Token,
		"refresh_token": tokens.RefreshToken,
	})
	RequireStatus(t, resp, http.StatusOK)
	var sessions []sessionView
	sessions = ParseResponse[[]sessionView](t, resp)
	require.NotEmpty(t, sessions, "user should have at least one session")

	currentCount := 0
	for _, s := range sessions {
		if s.IsCurrent {
			currentCount++
		}
	}
	assert.Equal(t, 1, currentCount,
		"exactly one session must be marked is_current when the refresh cookie is present")

	// revoke-all-others must succeed (context carries the current session id).
	resp = ts.RequestWithCookies(http.MethodDelete, "/users/me/sessions", nil, map[string]string{
		"access_token":  tokens.Token,
		"refresh_token": tokens.RefreshToken,
	})
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("revoke-all-others: expected 200/204 (NOT 400), got %d. Body: %s",
			resp.StatusCode, string(body))
	}
	resp.Body.Close()
}

// sessionView mirrors the session.SessionResponse JSON shape for assertions.
type sessionView struct {
	ID        uuid.UUID `json:"id"`
	IsCurrent bool      `json:"is_current"`
}

// =============================================================================
// User Profile Tests
// =============================================================================

func TestGetMe_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "me@example.com",
		"full_name": "Me User",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "me@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		Token string `json:"token"`
	}
	loginResult = ParseResponse[struct {
		Token string `json:"token"`
	}](t, resp)

	// Get me
	ts.SetToken(loginResult.Token)
	resp = ts.Get("/users/me")
	RequireStatus(t, resp, http.StatusOK)

	var meResult struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	}
	meResult = ParseResponse[struct {
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	}](t, resp)

	assert.Equal(t, "me@example.com", meResult.Email)
	assert.Equal(t, "Me User", meResult.FullName)
}

func TestGetMe_Unauthorized(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/users/me")
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

func TestUpdateMe_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "update@example.com",
		"full_name": "Original Name",
		"password":  "password123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "update@example.com",
		"password": "password123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		Token string `json:"token"`
	}
	loginResult = ParseResponse[struct {
		Token string `json:"token"`
	}](t, resp)

	// Update profile
	ts.SetToken(loginResult.Token)
	resp = ts.Patch("/users/me", map[string]string{
		"full_name": "Updated Name",
	})
	RequireStatus(t, resp, http.StatusOK)

	var updateResult struct {
		FullName string `json:"full_name"`
	}
	updateResult = ParseResponse[struct {
		FullName string `json:"full_name"`
	}](t, resp)

	assert.Equal(t, "Updated Name", updateResult.FullName)
}

func TestUpdatePassword_Success(t *testing.T) {
	ts := NewTestServer(t)

	// Register and login
	resp := ts.Post("/auth/register", map[string]string{
		"email":     "password@example.com",
		"full_name": "Password User",
		"password":  "oldpassword123",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = ts.Post("/auth/login", map[string]string{
		"email":    "password@example.com",
		"password": "oldpassword123",
	})
	RequireStatus(t, resp, http.StatusOK)

	var loginResult struct {
		Token string `json:"token"`
	}
	loginResult = ParseResponse[struct {
		Token string `json:"token"`
	}](t, resp)

	// Update password
	ts.SetToken(loginResult.Token)
	resp = ts.Patch("/users/me/password", map[string]string{
		"current_password": "oldpassword123",
		"new_password":     "newpassword456",
	})
	RequireStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	// Verify can login with new password
	ts.SetToken("")
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "password@example.com",
		"password": "newpassword456",
	})
	RequireStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Verify cannot login with old password
	resp = ts.Post("/auth/login", map[string]string{
		"email":    "password@example.com",
		"password": "oldpassword123",
	})
	RequireStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()
}

// =============================================================================
// Health Check Tests
// =============================================================================

func TestHealthCheck(t *testing.T) {
	ts := NewTestServer(t)

	resp := ts.Get("/health")
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var result struct {
		Status string `json:"status"`
	}
	result = ParseResponse[struct {
		Status string `json:"status"`
	}](t, resp)

	assert.Equal(t, "healthy", result.Status)
}

// =============================================================================
// Rate Limiting Tests
// =============================================================================

func TestAuthEndpoints_RateLimited(t *testing.T) {
	ts := NewTestServer(t)

	// Auth endpoints are rate limited to 20 requests per minute per IP.
	// Make 20 requests - all should succeed (even with invalid credentials).
	const authRateLimit = 20
	for i := 0; i < authRateLimit; i++ {
		resp := ts.Post("/auth/login", map[string]string{
			"email":    "ratelimit@example.com",
			"password": "wrongpassword",
		})
		// Should get 401 (invalid credentials) not 429 (rate limited)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "request %d should not be rate limited", i+1)
		resp.Body.Close()
	}

	// The next request should be rate limited.
	resp := ts.Post("/auth/login", map[string]string{
		"email":    "ratelimit@example.com",
		"password": "wrongpassword",
	})
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode, "request over the limit should be rate limited")
	assert.NotEmpty(t, resp.Header.Get("Retry-After"), "should have Retry-After header")
	resp.Body.Close()
}

func TestAuthEndpoints_RateLimitAppliesToAllAuthRoutes(t *testing.T) {
	ts := NewTestServer(t)

	// Mix of different auth endpoints - all share the same per-IP rate limit
	// of 20 requests/minute. Spend the full budget across login, register and
	// refresh so the next request trips the limiter regardless of endpoint.
	const authRateLimit = 20
	for i := 0; i < authRateLimit; i++ {
		switch i % 3 {
		case 0: // login attempt
			resp := ts.Post("/auth/login", map[string]string{
				"email":    "mixed@example.com",
				"password": "wrongpassword",
			})
			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
			resp.Body.Close()
		case 1: // register attempt (fails validation but still counts)
			resp := ts.Post("/auth/register", map[string]string{
				"email":     "invalid-email",
				"full_name": "Test",
				"password":  "password123",
			})
			assert.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
			resp.Body.Close()
		default: // refresh token attempt
			resp := ts.Post("/auth/refresh", map[string]string{
				"refresh_token": "invalid-token",
			})
			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
			resp.Body.Close()
		}
	}

	// The next request should be rate limited regardless of endpoint.
	resp := ts.Post("/auth/login", map[string]string{
		"email":    "mixed@example.com",
		"password": "wrongpassword",
	})
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode, "request over the limit should be rate limited")
	resp.Body.Close()
}
