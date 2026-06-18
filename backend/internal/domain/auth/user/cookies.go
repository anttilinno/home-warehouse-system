package user

import (
	"net/http"
	"os"
)

const (
	// Cookie names
	accessTokenCookie  = "access_token"
	refreshTokenCookie = "refresh_token"

	// Cookie max ages
	accessTokenMaxAge  = 24 * 60 * 60     // 24 hours (matches JWT expiry)
	refreshTokenMaxAge = 7 * 24 * 60 * 60 // 7 days
)

// secureCookies controls the Secure flag on auth cookies. It is configured at
// startup via SetSecureCookies from config.SecureCookies() — the single source
// of truth for production detection — and defaults to the APP_ENV check for
// callers that never configure it (e.g. legacy tests).
var secureCookies = os.Getenv("APP_ENV") == "production"

// SetSecureCookies configures whether auth cookies carry the Secure flag.
// Call once at startup with config.SecureCookies().
func SetSecureCookies(secure bool) {
	secureCookies = secure
}

// isSecureCookie returns true if cookies should be secure (HTTPS only)
func isSecureCookie() bool {
	return secureCookies
}

// createAuthCookie creates an HTTP cookie for authentication
func createAuthCookie(name, value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   isSecureCookie(),
		SameSite: http.SameSiteLaxMode,
	}
}

// clearAuthCookie creates a cookie that clears the auth cookie
func clearAuthCookie(name string) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isSecureCookie(),
		SameSite: http.SameSiteLaxMode,
	}
}
