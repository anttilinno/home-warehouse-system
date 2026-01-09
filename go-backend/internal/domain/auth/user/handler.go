package user

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RegisterPublicRoutes registers public user routes (no auth required).
func RegisterPublicRoutes(api huma.API, svc *Service) {
	huma.Post(api, "/auth/register", func(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
		user, err := svc.Create(ctx, CreateUserInput{
			Email:    input.Body.Email,
			FullName: input.Body.FullName,
			Password: input.Body.Password,
		})
		if err != nil {
			if shared.IsAlreadyExists(err) {
				return nil, huma.Error409Conflict("email is already taken")
			}
			if shared.IsInvalidInput(err) {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, huma.Error500InternalServerError("failed to create user")
		}

		return &RegisterOutput{
			Body: UserResponse{
				ID:         user.ID(),
				Email:      user.Email(),
				FullName:   user.FullName(),
				DateFormat: user.DateFormat(),
				Language:   user.Language(),
				Theme:      user.Theme(),
			},
		}, nil
	})

	huma.Post(api, "/auth/login", func(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
		user, err := svc.Authenticate(ctx, input.Body.Email, input.Body.Password)
		if err != nil {
			return nil, huma.Error401Unauthorized("invalid credentials")
		}

		// TODO: Generate JWT token
		token := "placeholder-token"

		return &LoginOutput{
			Body: LoginResponse{
				Token: token,
				User: UserResponse{
					ID:         user.ID(),
					Email:      user.Email(),
					FullName:   user.FullName(),
					DateFormat: user.DateFormat(),
					Language:   user.Language(),
					Theme:      user.Theme(),
				},
			},
		}, nil
	})
}

// RegisterProtectedRoutes registers protected user routes (auth required).
func RegisterProtectedRoutes(api huma.API, svc *Service) {
	huma.Get(api, "/users/me", func(ctx context.Context, input *struct{}) (*GetMeOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		user, err := svc.GetByID(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}

		return &GetMeOutput{
			Body: UserResponse{
				ID:         user.ID(),
				Email:      user.Email(),
				FullName:   user.FullName(),
				DateFormat: user.DateFormat(),
				Language:   user.Language(),
				Theme:      user.Theme(),
			},
		}, nil
	})

	huma.Patch(api, "/users/me", func(ctx context.Context, input *UpdateMeInput) (*UpdateMeOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		user, err := svc.UpdateProfile(ctx, authUser.ID, UpdateProfileInput{
			FullName: input.Body.FullName,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateMeOutput{
			Body: UserResponse{
				ID:         user.ID(),
				Email:      user.Email(),
				FullName:   user.FullName(),
				DateFormat: user.DateFormat(),
				Language:   user.Language(),
				Theme:      user.Theme(),
			},
		}, nil
	})

	huma.Patch(api, "/users/me/password", func(ctx context.Context, input *UpdatePasswordInput) (*struct{}, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		err := svc.UpdatePassword(ctx, authUser.ID, input.Body.CurrentPassword, input.Body.NewPassword)
		if err != nil {
			if err == ErrInvalidPassword {
				return nil, huma.Error400BadRequest("current password is incorrect")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	huma.Patch(api, "/users/me/preferences", func(ctx context.Context, input *UpdatePrefsRequest) (*UpdatePrefsResponse, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		user, err := svc.UpdatePreferences(ctx, authUser.ID, UpdatePreferencesInput{
			DateFormat: input.Body.DateFormat,
			Language:   input.Body.Language,
			Theme:      input.Body.Theme,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdatePrefsResponse{
			Body: UserResponse{
				ID:         user.ID(),
				Email:      user.Email(),
				FullName:   user.FullName(),
				DateFormat: user.DateFormat(),
				Language:   user.Language(),
				Theme:      user.Theme(),
			},
		}, nil
	})
}

// Request/Response types

type RegisterInput struct {
	Body struct {
		Email    string `json:"email" required:"true" format:"email"`
		FullName string `json:"full_name" required:"true" minLength:"1"`
		Password string `json:"password" required:"true" minLength:"8"`
	}
}

type RegisterOutput struct {
	Body UserResponse
}

type LoginInput struct {
	Body struct {
		Email    string `json:"email" required:"true" format:"email"`
		Password string `json:"password" required:"true"`
	}
}

type LoginOutput struct {
	Body LoginResponse
}

type LoginResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type UserResponse struct {
	ID         uuid.UUID `json:"id"`
	Email      string    `json:"email"`
	FullName   string    `json:"full_name"`
	DateFormat string    `json:"date_format"`
	Language   string    `json:"language"`
	Theme      string    `json:"theme"`
}

type GetMeOutput struct {
	Body UserResponse
}

type UpdateMeInput struct {
	Body struct {
		FullName string `json:"full_name" required:"true" minLength:"1"`
	}
}

type UpdateMeOutput struct {
	Body UserResponse
}

type UpdatePasswordInput struct {
	Body struct {
		CurrentPassword string `json:"current_password" required:"true"`
		NewPassword     string `json:"new_password" required:"true" minLength:"8"`
	}
}

type UpdatePrefsRequestBody struct {
	DateFormat string `json:"date_format,omitempty"`
	Language   string `json:"language,omitempty"`
	Theme      string `json:"theme,omitempty"`
}

type UpdatePrefsRequest struct {
	Body UpdatePrefsRequestBody
}

type UpdatePrefsResponse struct {
	Body UserResponse
}
