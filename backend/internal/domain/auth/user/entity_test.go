package user_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

func TestNewUser(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		fullName string
		password string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "valid user",
			email:    "test@example.com",
			fullName: "John Doe",
			password: "SecurePass123!",
			wantErr:  false,
		},
		{
			name:     "missing email",
			email:    "",
			fullName: "John Doe",
			password: "SecurePass123!",
			wantErr:  true,
			errMsg:   "email",
		},
		{
			name:     "missing full name",
			email:    "test@example.com",
			fullName: "",
			password: "SecurePass123!",
			wantErr:  true,
			errMsg:   "full_name",
		},
		{
			name:     "password too short",
			email:    "test@example.com",
			fullName: "John Doe",
			password: "short",
			wantErr:  true,
			errMsg:   "password must be at least 8 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u, err := user.NewUser(tt.email, tt.fullName, tt.password)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, u)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, u)
				assert.Equal(t, tt.email, u.Email())
				assert.Equal(t, tt.fullName, u.FullName())
				assert.True(t, u.IsActive())
				assert.False(t, u.IsSuperuser())
				// Verify password was hashed
				assert.NotEqual(t, tt.password, u.PasswordHash())
			}
		})
	}
}

func TestUser_CheckPassword(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "SecurePass123!")
	assert.NoError(t, err)

	t.Run("correct password", func(t *testing.T) {
		valid := u.CheckPassword("SecurePass123!")
		assert.True(t, valid)
	})

	t.Run("incorrect password", func(t *testing.T) {
		valid := u.CheckPassword("WrongPassword")
		assert.False(t, valid)
	})
}

func TestUser_UpdateProfile(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "SecurePass123!")
	assert.NoError(t, err)

	err = u.UpdateProfile("Jane Doe")

	assert.NoError(t, err)
	assert.Equal(t, "Jane Doe", u.FullName())
}

func TestUser_UpdateProfile_EmptyName(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "SecurePass123!")
	assert.NoError(t, err)

	err = u.UpdateProfile("")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "full_name")
}

func TestUser_UpdatePreferences(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "SecurePass123!")
	assert.NoError(t, err)

	err = u.UpdatePreferences("DD/MM/YYYY", "fr", "dark", "12h", ".", ",", nil)
	assert.NoError(t, err)

	assert.Equal(t, "DD/MM/YYYY", u.DateFormat())
	assert.Equal(t, "fr", u.Language())
	assert.Equal(t, "dark", u.Theme())
	assert.Equal(t, "12h", u.TimeFormat())
	assert.Equal(t, ".", u.ThousandSeparator())
	assert.Equal(t, ",", u.DecimalSeparator())
}

func TestUser_UpdatePreferences_ConflictingSeparators(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "SecurePass123!")
	assert.NoError(t, err)

	err = u.UpdatePreferences("", "", "", "", ".", ".", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "thousand separator and decimal separator must be different")
}

func TestUser_UpdatePassword(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "OldPassword123")
	assert.NoError(t, err)
	oldHash := u.PasswordHash()

	err = u.UpdatePassword("NewPassword456")

	assert.NoError(t, err)
	assert.NotEqual(t, oldHash, u.PasswordHash())
	assert.True(t, u.CheckPassword("NewPassword456"))
	assert.False(t, u.CheckPassword("OldPassword123"))
}

func TestUser_UpdatePassword_TooShort(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "OldPassword123")
	assert.NoError(t, err)

	err = u.UpdatePassword("short")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "password must be at least 8 characters")
}

func TestUser_Deactivate(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "SecurePass123!")
	assert.NoError(t, err)

	assert.True(t, u.IsActive())

	u.Deactivate()

	assert.False(t, u.IsActive())
}

func TestUser_Activate(t *testing.T) {
	u, err := user.NewUser("test@example.com", "John Doe", "SecurePass123!")
	assert.NoError(t, err)

	u.Deactivate()
	assert.False(t, u.IsActive())

	u.Activate()

	assert.True(t, u.IsActive())
}

func TestUser_Reconstruct(t *testing.T) {
	id := uuid.New()
	now := time.Now()
	avatarPath := "/avatars/test/avatar.jpg"

	notifPrefs := map[string]bool{"enabled": true, "loans": false}

	u := user.Reconstruct(
		id,
		"test@example.com",
		"John Doe",
		"$2a$10$hashedpassword",
		true,
		true,
		false,
		"YYYY-MM-DD",
		"en",
		"system",
		"24h",
		",",
		".",
		&avatarPath,
		notifPrefs,
		now,
		now,
	)

	assert.NotNil(t, u)
	assert.Equal(t, id, u.ID())
	assert.Equal(t, "test@example.com", u.Email())
	assert.Equal(t, "John Doe", u.FullName())
	assert.Equal(t, "$2a$10$hashedpassword", u.PasswordHash())
	assert.True(t, u.IsActive())
	assert.False(t, u.IsSuperuser())
	assert.Equal(t, "YYYY-MM-DD", u.DateFormat())
	assert.Equal(t, "en", u.Language())
	assert.Equal(t, "system", u.Theme())
	assert.Equal(t, "24h", u.TimeFormat())
	assert.Equal(t, ",", u.ThousandSeparator())
	assert.Equal(t, ".", u.DecimalSeparator())
	assert.Equal(t, &avatarPath, u.AvatarPath())
	assert.Equal(t, notifPrefs, u.NotificationPreferences())
	assert.True(t, u.HasPassword())
}

func TestNewOAuthUser(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		fullName string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "valid OAuth user",
			email:    "oauth@example.com",
			fullName: "OAuth User",
			wantErr:  false,
		},
		{
			name:     "missing email",
			email:    "",
			fullName: "OAuth User",
			wantErr:  true,
			errMsg:   "email",
		},
		{
			name:     "missing full name",
			email:    "oauth@example.com",
			fullName: "",
			wantErr:  true,
			errMsg:   "full_name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u, err := user.NewOAuthUser(tt.email, tt.fullName)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, u)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, u)
				assert.Equal(t, tt.email, u.Email())
				assert.Equal(t, tt.fullName, u.FullName())
				assert.True(t, u.IsActive())
				assert.False(t, u.IsSuperuser())
				assert.Empty(t, u.PasswordHash())
				assert.False(t, u.HasPassword())
				// Verify default preferences
				assert.Equal(t, "YYYY-MM-DD", u.DateFormat())
				assert.Equal(t, "en", u.Language())
				assert.Equal(t, "system", u.Theme())
				assert.Equal(t, "24h", u.TimeFormat())
				assert.Equal(t, ",", u.ThousandSeparator())
				assert.Equal(t, ".", u.DecimalSeparator())
				assert.Nil(t, u.AvatarPath())
			}
		})
	}
}

func TestUser_CheckPassword_EmptyHash(t *testing.T) {
	// Simulate an OAuth-only user with empty password hash
	u, err := user.NewOAuthUser("oauth@example.com", "OAuth User")
	assert.NoError(t, err)

	t.Run("returns false for any password", func(t *testing.T) {
		assert.False(t, u.CheckPassword("anypassword"))
	})

	t.Run("returns false for empty password", func(t *testing.T) {
		assert.False(t, u.CheckPassword(""))
	})
}

func TestUser_UpdatePassword_SetsHasPassword(t *testing.T) {
	// Start with OAuth-only user (no password)
	u, err := user.NewOAuthUser("oauth@example.com", "OAuth User")
	assert.NoError(t, err)
	assert.False(t, u.HasPassword())

	// Set a password
	err = u.UpdatePassword("NewPassword123")
	assert.NoError(t, err)
	assert.True(t, u.HasPassword())
	assert.True(t, u.CheckPassword("NewPassword123"))
}
