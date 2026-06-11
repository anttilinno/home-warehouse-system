package config

import (
	"errors"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all application configuration.
type Config struct {
	// Database
	DatabaseURL     string
	DatabaseMaxConn int
	DatabaseMinConn int

	// Redis
	RedisURL string

	// JWT
	JWTSecret          string
	JWTAlgorithm       string
	JWTExpirationHours int

	// Server
	ServerHost    string
	ServerPort    int
	ServerTimeout time.Duration

	// MaxBodyBytes is the global HTTP request body size cap (bytes).
	MaxBodyBytes int64

	// Email (Resend)
	ResendAPIKey     string
	EmailFromAddress string
	EmailFromName    string

	// OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string

	// Authelia (reverse-proxy forward-auth SSO)
	// When enabled, the backend trusts Authelia's Remote-* identity headers on
	// POST /auth/authelia/login -- but ONLY when the request also carries the
	// shared secret header that the ingress injects (and strips from client
	// input). The secret is the trust boundary: chi's RealIP middleware rewrites
	// RemoteAddr from X-Forwarded-For, so source-IP gating would be spoofable.
	AutheliaEnabled      bool
	AutheliaSharedSecret string

	// Web Push (VAPID)
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubscriber string // Usually mailto:email or URL

	// Paperless-ngx DMS integration. Key material for encrypting per-workspace
	// API tokens at rest (AES-256-GCM). Empty disables token storage.
	PaperlessTokenKey string

	// URLs
	AppURL     string // Frontend URL
	BackendURL string

	// AppEnv is the deployment environment name (APP_ENV, e.g. "production").
	AppEnv string

	// Feature Flags
	DebugMode bool
}

// IsProduction reports whether the app is running in a production deployment.
// This is the single source of truth for "are we in prod" decisions (cookie
// Secure flag, OAuth state cookies, secret validation). Production is signaled
// either by APP_ENV=production or by an https APP_URL.
func (c *Config) IsProduction() bool {
	return c.AppEnv == "production" || strings.HasPrefix(c.AppURL, "https://")
}

// SecureCookies reports whether auth cookies must carry the Secure flag.
func (c *Config) SecureCookies() bool {
	return c.IsProduction()
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		// Database. GO_DATABASE_URL takes precedence over DATABASE_URL: some
		// deployments share an env file with the legacy (non-Go) stack where
		// DATABASE_URL points elsewhere, and historically cmd/server and
		// cmd/worker read GO_DATABASE_URL directly. Folding the override here
		// keeps a single source of truth for all binaries.
		DatabaseURL:     getEnv("GO_DATABASE_URL", getEnv("DATABASE_URL", "postgresql://wh:wh@localhost:5432/warehouse_dev")),
		DatabaseMaxConn: getEnvInt("DATABASE_MAX_CONN", 25),
		DatabaseMinConn: getEnvInt("DATABASE_MIN_CONN", 5),

		// Redis
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379/0"),

		// JWT
		// No usable default: Validate() rejects empty/weak secrets and only
		// substitutes a clearly-logged dev fallback when DebugMode is on.
		JWTSecret:          getEnv("JWT_SECRET", ""),
		JWTAlgorithm:       getEnv("JWT_ALGORITHM", "HS256"),
		JWTExpirationHours: getEnvInt("JWT_EXPIRATION_HOURS", 24),

		// Server
		ServerHost:    getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort:    getEnvInt("SERVER_PORT", 8080),
		ServerTimeout: time.Duration(getEnvInt("SERVER_TIMEOUT_SECONDS", 60)) * time.Second,
		MaxBodyBytes:  int64(getEnvInt("MAX_BODY_SIZE_MB", 64)) << 20,

		// Email
		ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
		EmailFromAddress: getEnv("EMAIL_FROM_ADDRESS", "noreply@example.com"),
		EmailFromName:    getEnv("EMAIL_FROM_NAME", "Home Warehouse"),

		// OAuth
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),

		// Authelia
		AutheliaEnabled:      getEnvBool("AUTHELIA_ENABLED", false),
		AutheliaSharedSecret: getEnv("AUTHELIA_SHARED_SECRET", ""),

		// Web Push (VAPID)
		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDSubscriber: getEnv("VAPID_SUBSCRIBER", ""),

		// Paperless-ngx DMS integration
		PaperlessTokenKey: getEnv("PAPERLESS_TOKEN_KEY", ""),

		// URLs
		AppURL:     getEnv("APP_URL", "http://localhost:3000"),
		BackendURL: getEnv("BACKEND_URL", "http://localhost:8080"),
		AppEnv:     getEnv("APP_ENV", ""),

		// Feature Flags
		DebugMode: getEnvBool("DEBUG", false),
	}
}

// minJWTSecretLength is the minimum accepted JWT secret length in bytes.
const minJWTSecretLength = 32

// devFallbackJWTSecret is only ever used when DebugMode is on and no usable
// JWT_SECRET is configured. It is intentionally obvious and logged loudly.
const devFallbackJWTSecret = "dev-only-insecure-jwt-secret-do-not-use!"

// Validate checks that required configuration values are present and valid.
func (c *Config) Validate() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	if c.JWTSecret == "" || c.JWTSecret == "change-me-in-production" || len(c.JWTSecret) < minJWTSecretLength {
		if !c.DebugMode {
			return errors.New("JWT_SECRET must be set to a random value of at least 32 characters")
		}
		// Dev-only fallback, clearly logged so it can never sneak into prod.
		slog.Warn("JWT_SECRET is missing or weak; using an INSECURE dev-only fallback because DEBUG=true. Never run production like this.")
		c.JWTSecret = devFallbackJWTSecret
	}
	if c.ServerPort < 1 || c.ServerPort > 65535 {
		return errors.New("SERVER_PORT must be between 1 and 65535")
	}
	// Refuse to trust Authelia headers without a shared secret -- otherwise any
	// client could forge Remote-Email and impersonate any user.
	if c.AutheliaEnabled && c.AutheliaSharedSecret == "" {
		return errors.New("AUTHELIA_SHARED_SECRET is required when AUTHELIA_ENABLED is true")
	}
	return nil
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		i, err := strconv.Atoi(value)
		if err != nil {
			slog.Warn("ignoring malformed integer environment variable; using default",
				"key", key, "value", value, "default", defaultValue)
			return defaultValue
		}
		return i
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		b, err := strconv.ParseBool(value)
		if err != nil {
			slog.Warn("ignoring malformed boolean environment variable; using default",
				"key", key, "value", value, "default", defaultValue)
			return defaultValue
		}
		return b
	}
	return defaultValue
}
