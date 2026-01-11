package config

import (
	"errors"
	"os"
	"strconv"
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

	// Email (Resend)
	ResendAPIKey     string
	EmailFromAddress string
	EmailFromName    string

	// OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string

	// URLs
	AppURL     string // Frontend URL
	BackendURL string

	// Feature Flags
	DebugMode bool
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		// Database
		DatabaseURL:     getEnv("DATABASE_URL", "postgresql://wh:wh@localhost:5432/warehouse_dev"),
		DatabaseMaxConn: getEnvInt("DATABASE_MAX_CONN", 25),
		DatabaseMinConn: getEnvInt("DATABASE_MIN_CONN", 5),

		// Redis
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379/0"),

		// JWT
		JWTSecret:          getEnv("JWT_SECRET", "change-me-in-production"),
		JWTAlgorithm:       getEnv("JWT_ALGORITHM", "HS256"),
		JWTExpirationHours: getEnvInt("JWT_EXPIRATION_HOURS", 24),

		// Server
		ServerHost:    getEnv("SERVER_HOST", "0.0.0.0"),
		ServerPort:    getEnvInt("SERVER_PORT", 8080),
		ServerTimeout: time.Duration(getEnvInt("SERVER_TIMEOUT_SECONDS", 60)) * time.Second,

		// Email
		ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
		EmailFromAddress: getEnv("EMAIL_FROM_ADDRESS", "noreply@example.com"),
		EmailFromName:    getEnv("EMAIL_FROM_NAME", "Home Warehouse"),

		// OAuth
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),

		// URLs
		AppURL:     getEnv("APP_URL", "http://localhost:3000"),
		BackendURL: getEnv("BACKEND_URL", "http://localhost:8080"),

		// Feature Flags
		DebugMode: getEnvBool("DEBUG", false),
	}
}

// Validate checks that required configuration values are present and valid.
func (c *Config) Validate() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	if c.JWTSecret == "change-me-in-production" && !c.DebugMode {
		return errors.New("JWT_SECRET must be changed in production")
	}
	if c.ServerPort < 1 || c.ServerPort > 65535 {
		return errors.New("SERVER_PORT must be between 1 and 65535")
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
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}
