package user

import (
	"context"
	"fmt"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// Handler holds dependencies for user HTTP handlers.
type Handler struct {
	svc            ServiceInterface
	jwtService     jwt.ServiceInterface
	workspaceSvc   workspace.ServiceInterface
}

// NewHandler creates a new user handler.
func NewHandler(svc ServiceInterface, jwtService jwt.ServiceInterface, workspaceSvc workspace.ServiceInterface) *Handler {
	return &Handler{
		svc:            svc,
		jwtService:     jwtService,
		workspaceSvc:   workspaceSvc,
	}
}

// RegisterPublicRoutes registers public user routes (no auth required).
func (h *Handler) RegisterPublicRoutes(api huma.API) {
	huma.Post(api, "/auth/register", h.register)
	huma.Post(api, "/auth/login", h.login)
	huma.Post(api, "/auth/refresh", h.refreshToken)
}

// RegisterProtectedRoutes registers protected user routes (auth required).
func (h *Handler) RegisterProtectedRoutes(api huma.API) {
	huma.Get(api, "/users/me", h.getMe)
	huma.Get(api, "/users/me/workspaces", h.getMyWorkspaces)
	huma.Patch(api, "/users/me", h.updateMe)
	huma.Patch(api, "/users/me/password", h.updatePassword)
	huma.Patch(api, "/users/me/preferences", h.updatePreferences)
}

// RegisterAdminRoutes registers admin-only user routes (superuser required).
func (h *Handler) RegisterAdminRoutes(api huma.API) {
	huma.Get(api, "/users", h.listUsers)
	huma.Get(api, "/users/{id}", h.getUserByID)
	huma.Post(api, "/users/{id}/deactivate", h.deactivateUser)
	huma.Post(api, "/users/{id}/activate", h.activateUser)
}

func (h *Handler) register(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
	user, err := h.svc.Create(ctx, CreateUserInput{
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

	// Create a personal workspace for the new user
	workspaceName := fmt.Sprintf("%s's Workspace", user.FullName())
	workspaceSlug := fmt.Sprintf("user-%s", user.ID().String())
	_, err = h.workspaceSvc.Create(ctx, workspace.CreateWorkspaceInput{
		Name:        workspaceName,
		Slug:        workspaceSlug,
		Description: nil,
		IsPersonal:  true,
		CreatedBy:   user.ID(),
	})
	if err != nil {
		// Log error but don't fail registration
		// In production, this should be handled in a transaction or retry mechanism
	}

	// Generate token for the new user
	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate token")
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate refresh token")
	}

	return &RegisterOutput{
		Body: struct {
			Token        string `json:"token"`
			RefreshToken string `json:"refresh_token"`
		}{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) login(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	user, err := h.svc.Authenticate(ctx, input.Body.Email, input.Body.Password)
	if err != nil {
		return nil, huma.Error401Unauthorized("invalid credentials")
	}

	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate token")
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate refresh token")
	}

	return &LoginOutput{
		Body: struct {
			Token        string `json:"token"`
			RefreshToken string `json:"refresh_token"`
		}{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) refreshToken(ctx context.Context, input *RefreshTokenInput) (*RefreshTokenOutput, error) {
	userID, err := h.jwtService.ValidateRefreshToken(input.Body.RefreshToken)
	if err != nil {
		if err == jwt.ErrExpiredToken {
			return nil, huma.Error401Unauthorized("refresh token has expired")
		}
		return nil, huma.Error401Unauthorized("invalid refresh token")
	}

	user, err := h.svc.GetByID(ctx, userID)
	if err != nil {
		return nil, huma.Error401Unauthorized("user not found")
	}

	if !user.IsActive() {
		return nil, huma.Error401Unauthorized("user is deactivated")
	}

	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate token")
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate refresh token")
	}

	return &RefreshTokenOutput{
		Body: RefreshTokenResponse{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) getMe(ctx context.Context, input *struct{}) (*GetMeOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	user, err := h.svc.GetByID(ctx, authUser.ID)
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
}

func (h *Handler) getMyWorkspaces(ctx context.Context, input *struct{}) (*GetMyWorkspacesOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	workspaces, err := h.workspaceSvc.GetUserWorkspaces(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to get workspaces")
	}

	result := make([]WorkspaceResponse, len(workspaces))
	for i, ws := range workspaces {
		result[i] = WorkspaceResponse{
			ID:          ws.ID(),
			Name:        ws.Name(),
			Slug:        ws.Slug(),
			Description: ws.Description(),
			IsPersonal:  ws.IsPersonal(),
		}
	}

	return &GetMyWorkspacesOutput{
		Body: result,
	}, nil
}

func (h *Handler) updateMe(ctx context.Context, input *UpdateMeInput) (*UpdateMeOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	user, err := h.svc.UpdateProfile(ctx, authUser.ID, UpdateProfileInput{
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
}

func (h *Handler) updatePassword(ctx context.Context, input *UpdatePasswordInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	err := h.svc.UpdatePassword(ctx, authUser.ID, input.Body.CurrentPassword, input.Body.NewPassword)
	if err != nil {
		if err == ErrInvalidPassword {
			return nil, huma.Error400BadRequest("current password is incorrect")
		}
		return nil, huma.Error400BadRequest(err.Error())
	}

	return nil, nil
}

func (h *Handler) updatePreferences(ctx context.Context, input *UpdatePrefsRequest) (*UpdatePrefsResponse, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	user, err := h.svc.UpdatePreferences(ctx, authUser.ID, UpdatePreferencesInput{
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
}

// Admin handlers

func (h *Handler) listUsers(ctx context.Context, input *ListUsersInput) (*ListUsersOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	pagination := shared.Pagination{
		Page:     input.Page,
		PageSize: input.PageSize,
	}
	if pagination.Page == 0 {
		pagination.Page = 1
	}
	if pagination.PageSize == 0 {
		pagination.PageSize = 20
	}

	result, err := h.svc.List(ctx, pagination)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to list users")
	}

	users := make([]UserAdminResponse, len(result.Items))
	for i, u := range result.Items {
		users[i] = UserAdminResponse{
			ID:          u.ID(),
			Email:       u.Email(),
			FullName:    u.FullName(),
			IsActive:    u.IsActive(),
			IsSuperuser: u.IsSuperuser(),
			DateFormat:  u.DateFormat(),
			Language:    u.Language(),
			Theme:       u.Theme(),
			CreatedAt:   u.CreatedAt(),
			UpdatedAt:   u.UpdatedAt(),
		}
	}

	return &ListUsersOutput{
		Body: ListUsersResponse{
			Users:      users,
			Total:      result.Total,
			Page:       result.Page,
			PageSize:   result.PageSize,
			TotalPages: result.TotalPages,
		},
	}, nil
}

func (h *Handler) getUserByID(ctx context.Context, input *GetUserByIDInput) (*GetUserByIDOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	user, err := h.svc.GetByID(ctx, input.ID)
	if err != nil {
		if err == ErrUserNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		return nil, huma.Error500InternalServerError("failed to get user")
	}

	return &GetUserByIDOutput{
		Body: UserAdminResponse{
			ID:          user.ID(),
			Email:       user.Email(),
			FullName:    user.FullName(),
			IsActive:    user.IsActive(),
			IsSuperuser: user.IsSuperuser(),
			DateFormat:  user.DateFormat(),
			Language:    user.Language(),
			Theme:       user.Theme(),
			CreatedAt:   user.CreatedAt(),
			UpdatedAt:   user.UpdatedAt(),
		},
	}, nil
}

func (h *Handler) deactivateUser(ctx context.Context, input *DeactivateUserInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	// Prevent deactivating yourself
	if authUser.ID == input.ID {
		return nil, huma.Error400BadRequest("cannot deactivate yourself")
	}

	err := h.svc.Deactivate(ctx, input.ID)
	if err != nil {
		if err == ErrUserNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		return nil, huma.Error500InternalServerError("failed to deactivate user")
	}

	return nil, nil
}

func (h *Handler) activateUser(ctx context.Context, input *ActivateUserInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	err := h.svc.Activate(ctx, input.ID)
	if err != nil {
		if err == ErrUserNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		return nil, huma.Error500InternalServerError("failed to activate user")
	}

	return nil, nil
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
	Body struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

type LoginInput struct {
	Body struct {
		Email    string `json:"email" required:"true" format:"email"`
		Password string `json:"password" required:"true"`
	}
}

type LoginOutput struct {
	Body struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

type RefreshTokenInput struct {
	Body struct {
		RefreshToken string `json:"refresh_token" required:"true"`
	}
}

type RefreshTokenOutput struct {
	Body RefreshTokenResponse
}

type RefreshTokenResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
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

type WorkspaceResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description *string   `json:"description"`
	IsPersonal  bool      `json:"is_personal"`
}

type GetMyWorkspacesOutput struct {
	Body []WorkspaceResponse
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
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	FullName    string    `json:"full_name"`
	IsActive    bool      `json:"is_active"`
	IsSuperuser bool      `json:"is_superuser"`
	DateFormat  string    `json:"date_format"`
	Language    string    `json:"language"`
	Theme       string    `json:"theme"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
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

// Legacy functions for backward compatibility - deprecated

// RegisterPublicRoutes registers public user routes (no auth required).
// Deprecated: Use Handler.RegisterPublicRoutes instead.
func RegisterPublicRoutes(api huma.API, svc ServiceInterface) {
	// This is a legacy function that doesn't support JWT
	// Applications should migrate to using Handler with JWT service
	huma.Post(api, "/auth/register", func(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
		_, err := svc.Create(ctx, CreateUserInput{
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

		// This legacy endpoint doesn't have JWT service, so it returns empty tokens
		// Applications should migrate to using Handler with JWT service
		return &RegisterOutput{
			Body: struct {
				Token        string `json:"token"`
				RefreshToken string `json:"refresh_token"`
			}{
				Token:        "",
				RefreshToken: "",
			},
		}, nil
	})

	huma.Post(api, "/auth/login", func(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
		_, err := svc.Authenticate(ctx, input.Body.Email, input.Body.Password)
		if err != nil {
			return nil, huma.Error401Unauthorized("invalid credentials")
		}
		return nil, huma.Error500InternalServerError("JWT service not configured - use Handler with JWT service")
	})
}

// RegisterProtectedRoutes registers protected user routes (auth required).
// Deprecated: Use Handler.RegisterProtectedRoutes instead.
func RegisterProtectedRoutes(api huma.API, svc ServiceInterface) {
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
