package storage

import (
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrInvalidMimeType is returned when a MIME type is not allowed
	ErrInvalidMimeType = errors.New("invalid or unsupported MIME type")

	// DefaultAllowedMimeTypes are the default allowed MIME types for photos
	DefaultAllowedMimeTypes = []string{
		"image/jpeg",
		"image/png",
		"image/webp",
		"image/gif",
	}
)

// MimeTypeValidator validates MIME types against an allowed list.
type MimeTypeValidator struct {
	allowedTypes map[string]bool
}

// NewMimeTypeValidator creates a new MIME type validator.
// If no types are provided, uses DefaultAllowedMimeTypes.
func NewMimeTypeValidator(allowedTypes []string) *MimeTypeValidator {
	if len(allowedTypes) == 0 {
		allowedTypes = DefaultAllowedMimeTypes
	}

	typeMap := make(map[string]bool)
	for _, t := range allowedTypes {
		typeMap[strings.ToLower(strings.TrimSpace(t))] = true
	}

	return &MimeTypeValidator{
		allowedTypes: typeMap,
	}
}

// Validate checks if a MIME type is allowed.
func (v *MimeTypeValidator) Validate(mimeType string) error {
	normalized := strings.ToLower(strings.TrimSpace(mimeType))

	// Remove any parameters (e.g., "image/jpeg; charset=utf-8" -> "image/jpeg")
	if idx := strings.Index(normalized, ";"); idx != -1 {
		normalized = strings.TrimSpace(normalized[:idx])
	}

	if normalized == "" {
		return fmt.Errorf("%w: empty MIME type", ErrInvalidMimeType)
	}

	if !v.allowedTypes[normalized] {
		return fmt.Errorf("%w: %s", ErrInvalidMimeType, mimeType)
	}

	return nil
}

// IsAllowed checks if a MIME type is allowed (boolean version).
func (v *MimeTypeValidator) IsAllowed(mimeType string) bool {
	return v.Validate(mimeType) == nil
}

// AllowedTypes returns a slice of allowed MIME types.
func (v *MimeTypeValidator) AllowedTypes() []string {
	types := make([]string, 0, len(v.allowedTypes))
	for t := range v.allowedTypes {
		types = append(types, t)
	}
	return types
}

// ValidateMimeType is a convenience function that validates against DefaultAllowedMimeTypes.
func ValidateMimeType(mimeType string) error {
	validator := NewMimeTypeValidator(nil)
	return validator.Validate(mimeType)
}
