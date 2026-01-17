package storage

import (
	"os"
	"testing"
)

func TestLoadConfigFromEnv(t *testing.T) {
	// Save original env vars
	origPath := os.Getenv("PHOTO_STORAGE_PATH")
	origSize := os.Getenv("PHOTO_MAX_FILE_SIZE_MB")
	origTypes := os.Getenv("PHOTO_ALLOWED_TYPES")

	// Restore env vars after test
	defer func() {
		os.Setenv("PHOTO_STORAGE_PATH", origPath)
		os.Setenv("PHOTO_MAX_FILE_SIZE_MB", origSize)
		os.Setenv("PHOTO_ALLOWED_TYPES", origTypes)
	}()

	t.Run("loads default config when no env vars set", func(t *testing.T) {
		os.Unsetenv("PHOTO_STORAGE_PATH")
		os.Unsetenv("PHOTO_MAX_FILE_SIZE_MB")
		os.Unsetenv("PHOTO_ALLOWED_TYPES")

		cfg, err := LoadConfigFromEnv()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if cfg.StoragePath != DefaultStoragePath {
			t.Errorf("expected storage path %s, got %s", DefaultStoragePath, cfg.StoragePath)
		}

		if cfg.MaxFileSizeMB != DefaultMaxFileSizeMB {
			t.Errorf("expected max file size %d, got %d", DefaultMaxFileSizeMB, cfg.MaxFileSizeMB)
		}

		if len(cfg.AllowedMimeTypes) == 0 {
			t.Error("expected default MIME types, got empty list")
		}
	})

	t.Run("loads custom config from env vars", func(t *testing.T) {
		os.Setenv("PHOTO_STORAGE_PATH", "/custom/path")
		os.Setenv("PHOTO_MAX_FILE_SIZE_MB", "20")
		os.Setenv("PHOTO_ALLOWED_TYPES", "image/jpeg,image/png")

		cfg, err := LoadConfigFromEnv()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		if cfg.StoragePath != "/custom/path" {
			t.Errorf("expected storage path /custom/path, got %s", cfg.StoragePath)
		}

		if cfg.MaxFileSizeMB != 20 {
			t.Errorf("expected max file size 20, got %d", cfg.MaxFileSizeMB)
		}

		if len(cfg.AllowedMimeTypes) != 2 {
			t.Errorf("expected 2 MIME types, got %d", len(cfg.AllowedMimeTypes))
		}
	})

	t.Run("returns error for invalid max file size", func(t *testing.T) {
		os.Setenv("PHOTO_MAX_FILE_SIZE_MB", "not-a-number")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Fatal("expected error for invalid max file size")
		}
	})

	t.Run("returns error for zero max file size", func(t *testing.T) {
		os.Setenv("PHOTO_MAX_FILE_SIZE_MB", "0")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Fatal("expected error for zero max file size")
		}
	})

	t.Run("returns error for negative max file size", func(t *testing.T) {
		os.Setenv("PHOTO_MAX_FILE_SIZE_MB", "-5")

		_, err := LoadConfigFromEnv()
		if err == nil {
			t.Fatal("expected error for negative max file size")
		}
	})

	t.Run("trims whitespace from MIME types", func(t *testing.T) {
		os.Unsetenv("PHOTO_MAX_FILE_SIZE_MB")
		os.Setenv("PHOTO_ALLOWED_TYPES", " image/jpeg , image/png ")

		cfg, err := LoadConfigFromEnv()
		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		for _, mimeType := range cfg.AllowedMimeTypes {
			if mimeType != "image/jpeg" && mimeType != "image/png" {
				t.Errorf("expected trimmed MIME type, got %q", mimeType)
			}
		}
	})
}

func TestConfig_MaxFileSizeBytes(t *testing.T) {
	tests := []struct {
		name          string
		maxFileSizeMB int
		expected      int64
	}{
		{
			name:          "1 MB",
			maxFileSizeMB: 1,
			expected:      1024 * 1024,
		},
		{
			name:          "10 MB",
			maxFileSizeMB: 10,
			expected:      10 * 1024 * 1024,
		},
		{
			name:          "100 MB",
			maxFileSizeMB: 100,
			expected:      100 * 1024 * 1024,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{
				MaxFileSizeMB: tt.maxFileSizeMB,
			}

			result := cfg.MaxFileSizeBytes()
			if result != tt.expected {
				t.Errorf("expected %d bytes, got %d", tt.expected, result)
			}
		})
	}
}

func TestConfig_Validate(t *testing.T) {
	t.Run("valid config", func(t *testing.T) {
		cfg := &Config{
			StoragePath:      "/path/to/storage",
			MaxFileSizeMB:    10,
			AllowedMimeTypes: []string{"image/jpeg", "image/png"},
		}

		err := cfg.Validate()
		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
	})

	t.Run("empty storage path", func(t *testing.T) {
		cfg := &Config{
			StoragePath:      "",
			MaxFileSizeMB:    10,
			AllowedMimeTypes: []string{"image/jpeg"},
		}

		err := cfg.Validate()
		if err == nil {
			t.Error("expected error for empty storage path")
		}
	})

	t.Run("zero max file size", func(t *testing.T) {
		cfg := &Config{
			StoragePath:      "/path/to/storage",
			MaxFileSizeMB:    0,
			AllowedMimeTypes: []string{"image/jpeg"},
		}

		err := cfg.Validate()
		if err == nil {
			t.Error("expected error for zero max file size")
		}
	})

	t.Run("negative max file size", func(t *testing.T) {
		cfg := &Config{
			StoragePath:      "/path/to/storage",
			MaxFileSizeMB:    -5,
			AllowedMimeTypes: []string{"image/jpeg"},
		}

		err := cfg.Validate()
		if err == nil {
			t.Error("expected error for negative max file size")
		}
	})

	t.Run("empty MIME types", func(t *testing.T) {
		cfg := &Config{
			StoragePath:      "/path/to/storage",
			MaxFileSizeMB:    10,
			AllowedMimeTypes: []string{},
		}

		err := cfg.Validate()
		if err == nil {
			t.Error("expected error for empty MIME types")
		}
	})
}
