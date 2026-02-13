package factory

import (
	"github.com/brianvoe/gofakeit/v7"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
)

// UserOpt is a functional option for customizing a User.
type UserOpt func(*user.User)

// User creates a new User entity with realistic fake data.
// Options can be used to override specific fields.
func (f *Factory) User(opts ...UserOpt) *user.User {
	email := gofakeit.Email()
	fullName := gofakeit.Name()
	password := gofakeit.Password(true, true, true, true, false, 12)

	u, err := user.NewUser(email, fullName, password)
	if err != nil {
		panic("factory: failed to create user: " + err.Error())
	}

	for _, opt := range opts {
		opt(u)
	}

	return u
}

// WithEmail sets the user's email.
func WithEmail(email string) UserOpt {
	return func(u *user.User) {
		// Use Reconstruct to modify the email since User doesn't expose a setter
		*u = *user.Reconstruct(
			u.ID(),
			email,
			u.FullName(),
			u.PasswordHash(),
			u.IsActive(),
			u.IsSuperuser(),
			u.DateFormat(),
			u.Language(),
			u.Theme(),
			u.TimeFormat(),
			u.ThousandSeparator(),
			u.DecimalSeparator(),
			u.AvatarPath(),
			u.NotificationPreferences(),
			u.CreatedAt(),
			u.UpdatedAt(),
		)
	}
}

// WithFullName sets the user's full name.
func WithFullName(fullName string) UserOpt {
	return func(u *user.User) {
		_ = u.UpdateProfile(fullName)
	}
}

// WithSuperuser sets the user as a superuser.
func WithSuperuser(isSuperuser bool) UserOpt {
	return func(u *user.User) {
		*u = *user.Reconstruct(
			u.ID(),
			u.Email(),
			u.FullName(),
			u.PasswordHash(),
			u.IsActive(),
			isSuperuser,
			u.DateFormat(),
			u.Language(),
			u.Theme(),
			u.TimeFormat(),
			u.ThousandSeparator(),
			u.DecimalSeparator(),
			u.AvatarPath(),
			u.NotificationPreferences(),
			u.CreatedAt(),
			u.UpdatedAt(),
		)
	}
}
