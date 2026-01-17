package storage

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	// Default configuration values
	DefaultStoragePath      = "./uploads/photos"
	DefaultMaxFileSizeMB    = 10
	DefaultAllowedTypesStr  = "image/jpeg,image/png,image/webp"
)

// Config holds storage configuration.
type Config struct {
	// StoragePath is the base directory for storing photos
	StoragePath string

	// MaxFileSizeMB is the maximum allowed file size in megabytes
	MaxFileSizeMB int

	// AllowedMimeTypes is a list of allowed MIME types
	AllowedMimeTypes []string
}

// LoadConfigFromEnv loads storage configuration from environment variables.
func LoadConfigFromEnv() (*Config, error) {
	cfg := &Config{
		StoragePath:   getEnvOrDefault("PHOTO_STORAGE_PATH", DefaultStoragePath),
		MaxFileSizeMB: DefaultMaxFileSizeMB,
		AllowedMimeTypes: strings.Split(
			getEnvOrDefault("PHOTO_ALLOWED_TYPES", DefaultAllowedTypesStr),
			",",
		),
	}

	// Parse max file size
	if sizeStr := os.Getenv("PHOTO_MAX_FILE_SIZE_MB"); sizeStr != "" {
		size, err := strconv.Atoi(sizeStr)
		if err != nil {
			return nil, fmt.Errorf("invalid PHOTO_MAX_FILE_SIZE_MB: %w", err)
		}
		if size <= 0 {
			return nil, fmt.Errorf("PHOTO_MAX_FILE_SIZE_MB must be positive")
		}
		cfg.MaxFileSizeMB = size
	}

	// Trim whitespace from MIME types
	for i, t := range cfg.AllowedMimeTypes {
		cfg.AllowedMimeTypes[i] = strings.TrimSpace(t)
	}

	return cfg, nil
}

// MaxFileSizeBytes returns the maximum file size in bytes.
func (c *Config) MaxFileSizeBytes() int64 {
	return int64(c.MaxFileSizeMB) * 1024 * 1024
}

// Validate checks if the configuration is valid.
func (c *Config) Validate() error {
	if c.StoragePath == "" {
		return fmt.Errorf("storage path cannot be empty")
	}

	if c.MaxFileSizeMB <= 0 {
		return fmt.Errorf("max file size must be positive")
	}

	if len(c.AllowedMimeTypes) == 0 {
		return fmt.Errorf("at least one MIME type must be allowed")
	}

	return nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
