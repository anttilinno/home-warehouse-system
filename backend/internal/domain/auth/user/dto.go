package user

import (
	"net/http"
	"time"

	"github.com/google/uuid"
)

type RegisterInput struct {
	Body struct {
		Email    string `json:"email" required:"true" format:"email"`
		FullName string `json:"full_name" required:"true" minLength:"1"`
		Password string `json:"password" required:"true" minLength:"8"`
	}
}

type RegisterOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

type LoginInput struct {
	UserAgent     string `header:"User-Agent"`
	XForwardedFor string `header:"X-Forwarded-For"`
	XRealIP       string `header:"X-Real-IP"`
	Body          struct {
		Email    string `json:"email" required:"true" format:"email"`
		Password string `json:"password" required:"true"`
	}
}

type LoginOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

type RefreshTokenInput struct {
	Body struct {
		RefreshToken string `json:"refresh_token,omitempty"`
	}
}

type RefreshTokenOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      RefreshTokenResponse
}

type RefreshTokenResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}

// LogoutInput reads the refresh token from the auth cookie so the server-side
// session can be revoked. The cookie is optional — logout always succeeds.
type LogoutInput struct {
	RefreshToken string `cookie:"refresh_token" required:"false"`
}

type LogoutOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
}

type UserResponse struct {
	ID                      uuid.UUID       `json:"id"`
	Email                   string          `json:"email"`
	FullName                string          `json:"full_name"`
	HasPassword             bool            `json:"has_password"`
	DateFormat              string          `json:"date_format"`
	TimeFormat              string          `json:"time_format"`
	ThousandSeparator       string          `json:"thousand_separator"`
	DecimalSeparator        string          `json:"decimal_separator"`
	Language                string          `json:"language"`
	Theme                   string          `json:"theme"`
	NotificationPreferences map[string]bool `json:"notification_preferences"`
	AvatarURL               *string         `json:"avatar_url,omitempty"`
}

type GetMeOutput struct {
	Body UserResponse
}

type UserWorkspaceSummary struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description *string   `json:"description"`
	IsPersonal  bool      `json:"is_personal"`
	Role        string    `json:"role"`
}

type GetMyWorkspacesOutput struct {
	Body []UserWorkspaceSummary
}

type UpdateMeInput struct {
	Body struct {
		FullName string `json:"full_name,omitempty" minLength:"1"`
		Email    string `json:"email,omitempty" format:"email"`
	}
}

type UpdateMeOutput struct {
	Body UserResponse
}

type UpdatePasswordInput struct {
	Body struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password" required:"true" minLength:"8"`
	}
}

type UpdatePrefsRequestBody struct {
	DateFormat              string          `json:"date_format,omitempty"`
	TimeFormat              string          `json:"time_format,omitempty"`
	ThousandSeparator       string          `json:"thousand_separator,omitempty"`
	DecimalSeparator        string          `json:"decimal_separator,omitempty"`
	Language                string          `json:"language,omitempty"`
	Theme                   string          `json:"theme,omitempty"`
	NotificationPreferences map[string]bool `json:"notification_preferences,omitempty"`
}

type UpdatePrefsRequest struct {
	Body UpdatePrefsRequestBody
}

type UpdatePrefsResponse struct {
	Body UserResponse
}

// Admin request/response types

type ListUsersInput struct {
	Page     int `query:"page" minimum:"1" default:"1"`
	PageSize int `query:"page_size" minimum:"1" maximum:"100" default:"20"`
}

type ListUsersOutput struct {
	Body ListUsersResponse
}

type ListUsersResponse struct {
	Users      []UserAdminResponse `json:"users"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"page_size"`
	TotalPages int                 `json:"total_pages"`
}

type UserAdminResponse struct {
	ID                      uuid.UUID       `json:"id"`
	Email                   string          `json:"email"`
	FullName                string          `json:"full_name"`
	HasPassword             bool            `json:"has_password"`
	IsActive                bool            `json:"is_active"`
	IsSuperuser             bool            `json:"is_superuser"`
	DateFormat              string          `json:"date_format"`
	TimeFormat              string          `json:"time_format"`
	ThousandSeparator       string          `json:"thousand_separator"`
	DecimalSeparator        string          `json:"decimal_separator"`
	Language                string          `json:"language"`
	Theme                   string          `json:"theme"`
	NotificationPreferences map[string]bool `json:"notification_preferences"`
	CreatedAt               time.Time       `json:"created_at"`
	UpdatedAt               time.Time       `json:"updated_at"`
}

type GetUserByIDInput struct {
	ID uuid.UUID `path:"id" format:"uuid"`
}

type GetUserByIDOutput struct {
	Body UserAdminResponse
}

type DeactivateUserInput struct {
	ID uuid.UUID `path:"id" format:"uuid"`
}

type ActivateUserInput struct {
	ID uuid.UUID `path:"id" format:"uuid"`
}

// CanDeleteAccountOutput for GET /users/me/can-delete
type CanDeleteAccountOutput struct {
	Body CanDeleteAccountResponse
}

type CanDeleteAccountResponse struct {
	CanDelete          bool                   `json:"can_delete"`
	BlockingWorkspaces []BlockingWorkspaceDTO `json:"blocking_workspaces"`
}

type BlockingWorkspaceDTO struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Slug string    `json:"slug"`
}

// DeleteAccountInput for DELETE /users/me
type DeleteAccountInput struct {
	Body struct {
		Confirmation string `json:"confirmation" required:"true"`
	}
}

type DeleteAccountOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
}
