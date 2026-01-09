package api

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
)

// NewRouter creates and configures the main router.
func NewRouter(pool *pgxpool.Pool) chi.Router {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(appMiddleware.CORS)

	// Create Huma API
	config := huma.DefaultConfig("Home Warehouse API", "1.0.0")
	config.Info.Description = "Go backend for Home Warehouse System"
	api := humachi.New(r, config)

	// Health check endpoint
	huma.Get(api, "/health", func(ctx context.Context, input *struct{}) (*HealthResponse, error) {
		return &HealthResponse{Body: HealthBody{Status: "ok"}}, nil
	})

	// Initialize repositories
	userRepo := postgres.NewUserRepository(pool)

	// Initialize services
	userSvc := user.NewService(userRepo)

	// Register public routes (no auth)
	user.RegisterPublicRoutes(api, userSvc)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.Auth)

		protectedAPI := humachi.New(r, config)

		// Register protected user routes
		user.RegisterProtectedRoutes(protectedAPI, userSvc)

		// Workspace-scoped routes will go here
		// r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
		//     r.Use(appMiddleware.Workspace)
		//     wsAPI := humachi.New(r, config)
		//     // Register domain routes...
		// })
	})

	return r
}

// HealthBody is the response body for health check.
type HealthBody struct {
	Status string `json:"status"`
}

// HealthResponse is the response for health check.
type HealthResponse struct {
	Body HealthBody
}
