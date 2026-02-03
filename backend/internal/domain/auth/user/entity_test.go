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

	u.UpdatePreferences("DD/MM/YYYY", "fr", "dark")

	assert.Equal(t, "DD/MM/YYYY", u.DateFormat())
	assert.Equal(t, "fr", u.Language())
	assert.Equal(t, "dark", u.Theme())
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

	u := user.Reconstruct(
		id,
		"test@example.com",
		"John Doe",
		"$2a$10$hashedpassword",
		true,
		false,
		"YYYY-MM-DD",
		"en",
		"system",
		&avatarPath,
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
	assert.Equal(t, &avatarPath, u.AvatarPath())
}
