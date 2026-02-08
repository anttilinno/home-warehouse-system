package user

import (
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// User represents a user in the system.
type User struct {
	id                uuid.UUID
	email             string
	fullName          string
	passwordHash      string
	isActive          bool
	isSuperuser       bool
	dateFormat        string
	language          string
	theme             string
	timeFormat        string
	thousandSeparator string
	decimalSeparator  string
	avatarPath        *string
	createdAt         time.Time
	updatedAt         time.Time
}

// NewUser creates a new user with the given parameters.
func NewUser(email, fullName, password string) (*User, error) {
	if email == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "email", "email is required")
	}
	if fullName == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "full_name", "full name is required")
	}
	if len(password) < 8 {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "password", "password must be at least 8 characters")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, shared.NewDomainError(shared.ErrInternal, "failed to hash password")
	}

	now := time.Now()
	return &User{
		id:                uuid.New(),
		email:             email,
		fullName:          fullName,
		passwordHash:      string(hash),
		isActive:          true,
		isSuperuser:       false,
		dateFormat:        "YYYY-MM-DD",
		language:          "en",
		theme:             "system",
		timeFormat:        "24h",
		thousandSeparator: ",",
		decimalSeparator:  ".",
		avatarPath:        nil,
		createdAt:         now,
		updatedAt:         now,
	}, nil
}

// Reconstruct recreates a user from stored data.
func Reconstruct(
	id uuid.UUID,
	email, fullName, passwordHash string,
	isActive, isSuperuser bool,
	dateFormat, language, theme string,
	timeFormat, thousandSeparator, decimalSeparator string,
	avatarPath *string,
	createdAt, updatedAt time.Time,
) *User {
	return &User{
		id:                id,
		email:             email,
		fullName:          fullName,
		passwordHash:      passwordHash,
		isActive:          isActive,
		isSuperuser:       isSuperuser,
		dateFormat:        dateFormat,
		language:          language,
		theme:             theme,
		timeFormat:        timeFormat,
		thousandSeparator: thousandSeparator,
		decimalSeparator:  decimalSeparator,
		avatarPath:        avatarPath,
		createdAt:         createdAt,
		updatedAt:         updatedAt,
	}
}

// ID returns the user's ID.
func (u *User) ID() uuid.UUID { return u.id }

// Email returns the user's email.
func (u *User) Email() string { return u.email }

// FullName returns the user's full name.
func (u *User) FullName() string { return u.fullName }

// PasswordHash returns the user's password hash.
func (u *User) PasswordHash() string { return u.passwordHash }

// IsActive returns whether the user is active.
func (u *User) IsActive() bool { return u.isActive }

// IsSuperuser returns whether the user is a superuser.
func (u *User) IsSuperuser() bool { return u.isSuperuser }

// DateFormat returns the user's preferred date format.
func (u *User) DateFormat() string { return u.dateFormat }

// Language returns the user's preferred language.
func (u *User) Language() string { return u.language }

// Theme returns the user's preferred theme.
func (u *User) Theme() string { return u.theme }

// TimeFormat returns the user's preferred time format (12h or 24h).
func (u *User) TimeFormat() string { return u.timeFormat }

// ThousandSeparator returns the user's preferred thousand separator.
func (u *User) ThousandSeparator() string { return u.thousandSeparator }

// DecimalSeparator returns the user's preferred decimal separator.
func (u *User) DecimalSeparator() string { return u.decimalSeparator }

// AvatarPath returns the user's avatar storage path.
func (u *User) AvatarPath() *string { return u.avatarPath }

// CreatedAt returns when the user was created.
func (u *User) CreatedAt() time.Time { return u.createdAt }

// UpdatedAt returns when the user was last updated.
func (u *User) UpdatedAt() time.Time { return u.updatedAt }

// CheckPassword verifies a password against the stored hash.
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.passwordHash), []byte(password))
	return err == nil
}

// UpdateProfile updates the user's profile information.
func (u *User) UpdateProfile(fullName string) error {
	if fullName == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "full_name", "full name is required")
	}
	u.fullName = fullName
	u.updatedAt = time.Now()
	return nil
}

// UpdatePassword changes the user's password.
func (u *User) UpdatePassword(newPassword string) error {
	if len(newPassword) < 8 {
		return shared.NewFieldError(shared.ErrInvalidInput, "password", "password must be at least 8 characters")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return shared.NewDomainError(shared.ErrInternal, "failed to hash password")
	}

	u.passwordHash = string(hash)
	u.updatedAt = time.Now()
	return nil
}

// UpdatePreferences updates the user's preferences.
// Returns an error if thousand_separator and decimal_separator are both non-empty and equal.
func (u *User) UpdatePreferences(dateFormat, language, theme, timeFormat, thousandSeparator, decimalSeparator string) error {
	// Validate separator conflict: resolve effective values after update
	effectiveThousand := u.thousandSeparator
	if thousandSeparator != "" {
		effectiveThousand = thousandSeparator
	}
	effectiveDecimal := u.decimalSeparator
	if decimalSeparator != "" {
		effectiveDecimal = decimalSeparator
	}
	if effectiveThousand == effectiveDecimal {
		return shared.NewFieldError(shared.ErrInvalidInput, "thousand_separator", "thousand separator and decimal separator must be different")
	}

	if dateFormat != "" {
		u.dateFormat = dateFormat
	}
	if language != "" {
		u.language = language
	}
	if theme != "" {
		u.theme = theme
	}
	if timeFormat != "" {
		u.timeFormat = timeFormat
	}
	if thousandSeparator != "" {
		u.thousandSeparator = thousandSeparator
	}
	if decimalSeparator != "" {
		u.decimalSeparator = decimalSeparator
	}
	u.updatedAt = time.Now()
	return nil
}

// Deactivate marks the user as inactive.
func (u *User) Deactivate() {
	u.isActive = false
	u.updatedAt = time.Now()
}

// Activate marks the user as active.
func (u *User) Activate() {
	u.isActive = true
	u.updatedAt = time.Now()
}

// UpdateAvatar updates the user's avatar path.
func (u *User) UpdateAvatar(path *string) {
	u.avatarPath = path
	u.updatedAt = time.Now()
}

// UpdateEmail updates the user's email address.
func (u *User) UpdateEmail(email string) error {
	if email == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "email", "email is required")
	}
	u.email = email
	u.updatedAt = time.Now()
	return nil
}
