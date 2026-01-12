package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad(t *testing.T) {
	t.Run("loads defaults when no env vars set", func(t *testing.T) {
		// Clear any existing env vars
		os.Clearenv()

		cfg := Load()

		assert.Equal(t, "postgresql://wh:wh@localhost:5432/warehouse_dev", cfg.DatabaseURL)
		assert.Equal(t, 25, cfg.DatabaseMaxConn)
		assert.Equal(t, 5, cfg.DatabaseMinConn)
		assert.Equal(t, "redis://localhost:6379/0", cfg.RedisURL)
		assert.Equal(t, "change-me-in-production", cfg.JWTSecret)
		assert.Equal(t, "HS256", cfg.JWTAlgorithm)
		assert.Equal(t, 24, cfg.JWTExpirationHours)
		assert.Equal(t, "0.0.0.0", cfg.ServerHost)
		assert.Equal(t, 8080, cfg.ServerPort)
		assert.Equal(t, "http://localhost:3000", cfg.AppURL)
		assert.Equal(t, "http://localhost:8080", cfg.BackendURL)
		assert.False(t, cfg.DebugMode)
	})

	t.Run("loads from environment variables", func(t *testing.T) {
		os.Clearenv()

		os.Setenv("DATABASE_URL", "postgresql://custom:custom@localhost:5432/custom_db")
		os.Setenv("DATABASE_MAX_CONN", "50")
		os.Setenv("DATABASE_MIN_CONN", "10")
		os.Setenv("REDIS_URL", "redis://localhost:6380/1")
		os.Setenv("JWT_SECRET", "custom-secret")
		os.Setenv("JWT_ALGORITHM", "HS512")
		os.Setenv("JWT_EXPIRATION_HOURS", "48")
		os.Setenv("SERVER_HOST", "localhost")
		os.Setenv("SERVER_PORT", "3000")
		os.Setenv("SERVER_TIMEOUT_SECONDS", "120")
		os.Setenv("RESEND_API_KEY", "re_test_key")
		os.Setenv("EMAIL_FROM_ADDRESS", "test@example.com")
		os.Setenv("EMAIL_FROM_NAME", "Test App")
		os.Setenv("GOOGLE_CLIENT_ID", "google_client_id")
		os.Setenv("GOOGLE_CLIENT_SECRET", "google_secret")
		os.Setenv("GITHUB_CLIENT_ID", "github_client_id")
		os.Setenv("GITHUB_CLIENT_SECRET", "github_secret")
		os.Setenv("APP_URL", "https://app.example.com")
		os.Setenv("BACKEND_URL", "https://api.example.com")
		os.Setenv("DEBUG", "true")

		cfg := Load()

		assert.Equal(t, "postgresql://custom:custom@localhost:5432/custom_db", cfg.DatabaseURL)
		assert.Equal(t, 50, cfg.DatabaseMaxConn)
		assert.Equal(t, 10, cfg.DatabaseMinConn)
		assert.Equal(t, "redis://localhost:6380/1", cfg.RedisURL)
		assert.Equal(t, "custom-secret", cfg.JWTSecret)
		assert.Equal(t, "HS512", cfg.JWTAlgorithm)
		assert.Equal(t, 48, cfg.JWTExpirationHours)
		assert.Equal(t, "localhost", cfg.ServerHost)
		assert.Equal(t, 3000, cfg.ServerPort)
		assert.Equal(t, "re_test_key", cfg.ResendAPIKey)
		assert.Equal(t, "test@example.com", cfg.EmailFromAddress)
		assert.Equal(t, "Test App", cfg.EmailFromName)
		assert.Equal(t, "google_client_id", cfg.GoogleClientID)
		assert.Equal(t, "google_secret", cfg.GoogleClientSecret)
		assert.Equal(t, "github_client_id", cfg.GitHubClientID)
		assert.Equal(t, "github_secret", cfg.GitHubClientSecret)
		assert.Equal(t, "https://app.example.com", cfg.AppURL)
		assert.Equal(t, "https://api.example.com", cfg.BackendURL)
		assert.True(t, cfg.DebugMode)

		os.Clearenv()
	})

	t.Run("handles invalid int values with defaults", func(t *testing.T) {
		os.Clearenv()

		os.Setenv("DATABASE_MAX_CONN", "invalid")
		os.Setenv("SERVER_PORT", "not_a_number")

		cfg := Load()

		// Should fall back to defaults
		assert.Equal(t, 25, cfg.DatabaseMaxConn)
		assert.Equal(t, 8080, cfg.ServerPort)

		os.Clearenv()
	})

	t.Run("handles invalid bool values with defaults", func(t *testing.T) {
		os.Clearenv()

		os.Setenv("DEBUG", "not_a_bool")

		cfg := Load()

		// Should fall back to default
		assert.False(t, cfg.DebugMode)

		os.Clearenv()
	})
}

func TestValidate(t *testing.T) {
	t.Run("passes validation with valid config", func(t *testing.T) {
		cfg := &Config{
			DatabaseURL:  "postgresql://localhost/db",
			JWTSecret:    "secure-secret",
			ServerPort:   8080,
			DebugMode:    false,
		}

		err := cfg.Validate()
		assert.NoError(t, err)
	})

	t.Run("fails validation with empty database URL", func(t *testing.T) {
		cfg := &Config{
			DatabaseURL:  "",
			JWTSecret:    "secure-secret",
			ServerPort:   8080,
			DebugMode:    false,
		}

		err := cfg.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "DATABASE_URL")
	})

	t.Run("fails validation with default JWT secret in production", func(t *testing.T) {
		cfg := &Config{
			DatabaseURL:  "postgresql://localhost/db",
			JWTSecret:    "change-me-in-production",
			ServerPort:   8080,
			DebugMode:    false,
		}

		err := cfg.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "JWT_SECRET")
	})

	t.Run("allows default JWT secret in debug mode", func(t *testing.T) {
		cfg := &Config{
			DatabaseURL:  "postgresql://localhost/db",
			JWTSecret:    "change-me-in-production",
			ServerPort:   8080,
			DebugMode:    true,
		}

		err := cfg.Validate()
		assert.NoError(t, err)
	})

	t.Run("fails validation with invalid server port", func(t *testing.T) {
		cfg := &Config{
			DatabaseURL:  "postgresql://localhost/db",
			JWTSecret:    "secure-secret",
			ServerPort:   0,
			DebugMode:    false,
		}

		err := cfg.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "SERVER_PORT")
	})

	t.Run("fails validation with port too high", func(t *testing.T) {
		cfg := &Config{
			DatabaseURL:  "postgresql://localhost/db",
			JWTSecret:    "secure-secret",
			ServerPort:   70000,
			DebugMode:    false,
		}

		err := cfg.Validate()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "SERVER_PORT")
	})
}
