package oauth

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	userID := uuid.New()
	createdAt := time.Now().Add(-time.Hour)
	updatedAt := time.Now()

	account := Reconstruct(
		id, userID,
		"google", "provider-user-id", "user@example.com", "Jane Doe", "https://example.com/avatar.png",
		createdAt, updatedAt,
	)

	if account.ID() != id {
		t.Errorf("ID() = %v, want %v", account.ID(), id)
	}
	if account.UserID() != userID {
		t.Errorf("UserID() = %v, want %v", account.UserID(), userID)
	}
	if account.Provider() != "google" {
		t.Errorf("Provider() = %q, want %q", account.Provider(), "google")
	}
	if account.ProviderUserID() != "provider-user-id" {
		t.Errorf("ProviderUserID() = %q, want %q", account.ProviderUserID(), "provider-user-id")
	}
	if account.Email() != "user@example.com" {
		t.Errorf("Email() = %q, want %q", account.Email(), "user@example.com")
	}
	if account.DisplayName() != "Jane Doe" {
		t.Errorf("DisplayName() = %q, want %q", account.DisplayName(), "Jane Doe")
	}
	if account.AvatarURL() != "https://example.com/avatar.png" {
		t.Errorf("AvatarURL() = %q, want %q", account.AvatarURL(), "https://example.com/avatar.png")
	}
	if !account.CreatedAt().Equal(createdAt) {
		t.Errorf("CreatedAt() = %v, want %v", account.CreatedAt(), createdAt)
	}
	if !account.UpdatedAt().Equal(updatedAt) {
		t.Errorf("UpdatedAt() = %v, want %v", account.UpdatedAt(), updatedAt)
	}
}
