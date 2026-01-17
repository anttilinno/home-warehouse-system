package storage

import (
	"testing"
)

func TestNewMimeTypeValidator(t *testing.T) {
	t.Run("creates validator with custom types", func(t *testing.T) {
		allowedTypes := []string{"image/jpeg", "image/png"}
		validator := NewMimeTypeValidator(allowedTypes)

		if validator == nil {
			t.Fatal("expected validator instance, got nil")
		}

		if len(validator.allowedTypes) != 2 {
			t.Errorf("expected 2 allowed types, got %d", len(validator.allowedTypes))
		}
	})

	t.Run("uses default types when empty list provided", func(t *testing.T) {
		validator := NewMimeTypeValidator(nil)

		if validator == nil {
			t.Fatal("expected validator instance, got nil")
		}

		if len(validator.allowedTypes) == 0 {
			t.Error("expected default types, got empty list")
		}
	})

	t.Run("normalizes MIME types to lowercase", func(t *testing.T) {
		allowedTypes := []string{"IMAGE/JPEG", "Image/PNG"}
		validator := NewMimeTypeValidator(allowedTypes)

		if !validator.allowedTypes["image/jpeg"] {
			t.Error("expected lowercase image/jpeg to be allowed")
		}
		if !validator.allowedTypes["image/png"] {
			t.Error("expected lowercase image/png to be allowed")
		}
	})

	t.Run("trims whitespace from types", func(t *testing.T) {
		allowedTypes := []string{"  image/jpeg  ", " image/png"}
		validator := NewMimeTypeValidator(allowedTypes)

		if !validator.allowedTypes["image/jpeg"] {
			t.Error("expected trimmed image/jpeg to be allowed")
		}
		if !validator.allowedTypes["image/png"] {
			t.Error("expected trimmed image/png to be allowed")
		}
	})
}

func TestMimeTypeValidator_Validate(t *testing.T) {
	validator := NewMimeTypeValidator([]string{"image/jpeg", "image/png", "image/webp"})

	tests := []struct {
		name        string
		mimeType    string
		expectError bool
	}{
		{
			name:        "valid JPEG",
			mimeType:    "image/jpeg",
			expectError: false,
		},
		{
			name:        "valid PNG",
			mimeType:    "image/png",
			expectError: false,
		},
		{
			name:        "valid WebP",
			mimeType:    "image/webp",
			expectError: false,
		},
		{
			name:        "case insensitive",
			mimeType:    "IMAGE/JPEG",
			expectError: false,
		},
		{
			name:        "with whitespace",
			mimeType:    "  image/png  ",
			expectError: false,
		},
		{
			name:        "with parameters",
			mimeType:    "image/jpeg; charset=utf-8",
			expectError: false,
		},
		{
			name:        "invalid type",
			mimeType:    "image/gif",
			expectError: true,
		},
		{
			name:        "empty type",
			mimeType:    "",
			expectError: true,
		},
		{
			name:        "non-image type",
			mimeType:    "application/pdf",
			expectError: true,
		},
		{
			name:        "malformed type",
			mimeType:    "notamimetype",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.Validate(tt.mimeType)
			if tt.expectError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.expectError && err != nil {
				t.Errorf("expected no error, got %v", err)
			}
		})
	}
}

func TestMimeTypeValidator_IsAllowed(t *testing.T) {
	validator := NewMimeTypeValidator([]string{"image/jpeg", "image/png"})

	tests := []struct {
		name     string
		mimeType string
		expected bool
	}{
		{
			name:     "allowed type",
			mimeType: "image/jpeg",
			expected: true,
		},
		{
			name:     "disallowed type",
			mimeType: "image/gif",
			expected: false,
		},
		{
			name:     "empty type",
			mimeType: "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validator.IsAllowed(tt.mimeType)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestMimeTypeValidator_AllowedTypes(t *testing.T) {
	allowedTypes := []string{"image/jpeg", "image/png", "image/webp"}
	validator := NewMimeTypeValidator(allowedTypes)

	result := validator.AllowedTypes()

	if len(result) != len(allowedTypes) {
		t.Errorf("expected %d types, got %d", len(allowedTypes), len(result))
	}

	// Check that all types are present (order may differ)
	typeMap := make(map[string]bool)
	for _, mimeType := range result {
		typeMap[mimeType] = true
	}

	for _, mimeType := range allowedTypes {
		if !typeMap[mimeType] {
			t.Errorf("expected type %s to be in allowed list", mimeType)
		}
	}
}

func TestValidateMimeType(t *testing.T) {
	tests := []struct {
		name        string
		mimeType    string
		expectError bool
	}{
		{
			name:        "default allowed JPEG",
			mimeType:    "image/jpeg",
			expectError: false,
		},
		{
			name:        "default allowed PNG",
			mimeType:    "image/png",
			expectError: false,
		},
		{
			name:        "default allowed WebP",
			mimeType:    "image/webp",
			expectError: false,
		},
		{
			name:        "not in defaults",
			mimeType:    "image/bmp",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateMimeType(tt.mimeType)
			if tt.expectError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.expectError && err != nil {
				t.Errorf("expected no error, got %v", err)
			}
		})
	}
}
