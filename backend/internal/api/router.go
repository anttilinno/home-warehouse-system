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
	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/domain/analytics"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/notification"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/domain/barcode"
	"github.com/antti/home-warehouse/go-backend/internal/domain/batch"
	"github.com/antti/home-warehouse/go-backend/internal/domain/importexport"
	"github.com/antti/home-warehouse/go-backend/internal/domain/sync"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/company"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/deleted"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/favorite"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/movement"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// NewRouter creates and configures the main router.
func NewRouter(pool *pgxpool.Pool, cfg *config.Config) chi.Router {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(appMiddleware.CORS)

	// Create JWT service
	jwtService := jwt.NewService(cfg.JWTSecret, cfg.JWTExpirationHours)

	// Create Huma API with OpenAPI configuration
	humaAPIConfig := huma.DefaultConfig("Home Warehouse API", "1.0.0")
	humaAPIConfig.Info.Description = "Go backend for Home Warehouse System - a comprehensive inventory management solution for home and small business use. Features include item tracking, location management, loan tracking, and PWA offline support."
	humaAPIConfig.Info.Contact = &huma.Contact{
		Name:  "Home Warehouse Team",
		Email: "support@example.com",
	}
	humaAPIConfig.Info.License = &huma.License{
		Name: "MIT",
		URL:  "https://opensource.org/licenses/MIT",
	}
	// Configure servers for OpenAPI spec
	humaAPIConfig.Servers = []*huma.Server{
		{URL: "http://localhost:8080", Description: "Local development server"},
	}
	// DocsPath defaults to /docs which shows the Scalar UI
	// OpenAPI JSON is available at /openapi.json by default
	api := humachi.New(r, humaAPIConfig)

	// Health check endpoint
	huma.Get(api, "/health", func(ctx context.Context, input *struct{}) (*HealthResponse, error) {
		return &HealthResponse{Body: HealthBody{Status: "ok"}}, nil
	})

	// Register additional documentation routes (Redoc UI)
	RegisterDocsRoutes(r)

	// Initialize repositories
	// Auth repositories
	userRepo := postgres.NewUserRepository(pool)
	workspaceRepo := postgres.NewWorkspaceRepository(pool)
	memberRepo := postgres.NewMemberRepository(pool)
	notificationRepo := postgres.NewNotificationRepository(pool)
	// Phase 1 repositories
	categoryRepo := postgres.NewCategoryRepository(pool)
	locationRepo := postgres.NewLocationRepository(pool)
	containerRepo := postgres.NewContainerRepository(pool)
	// Phase 2 repositories
	companyRepo := postgres.NewCompanyRepository(pool)
	labelRepo := postgres.NewLabelRepository(pool)
	// Phase 3 repositories
	itemRepo := postgres.NewItemRepository(pool)
	inventoryRepo := postgres.NewInventoryRepository(pool)
	// Phase 4 repositories
	borrowerRepo := postgres.NewBorrowerRepository(pool)
	loanRepo := postgres.NewLoanRepository(pool)
	// Phase 5 repositories
	fileRepo := postgres.NewFileRepository(pool)
	attachmentRepo := postgres.NewAttachmentRepository(pool)
	activityRepo := postgres.NewActivityRepository(pool)
	deletedRepo := postgres.NewDeletedRepository(pool)
	favoriteRepo := postgres.NewFavoriteRepository(pool)
	movementRepo := postgres.NewMovementRepository(pool)
	analyticsRepo := postgres.NewAnalyticsRepository(pool)
	importExportRepo := postgres.NewImportExportRepository(pool)
	syncRepo := postgres.NewSyncRepository(pool)

	// Initialize services
	// Auth services
	userSvc := user.NewService(userRepo)
	workspaceSvc := workspace.NewService(workspaceRepo, memberRepo)
	memberSvc := member.NewService(memberRepo)
	notificationSvc := notification.NewService(notificationRepo)
	// Phase 1 services
	categorySvc := category.NewService(categoryRepo)
	locationSvc := location.NewService(locationRepo)
	containerSvc := container.NewService(containerRepo)
	// Phase 2 services
	companySvc := company.NewService(companyRepo)
	labelSvc := label.NewService(labelRepo)
	// Phase 3 services
	itemSvc := item.NewService(itemRepo)
	// Phase 5 services (movement service created before inventory to allow dependency)
	movementSvc := movement.NewService(movementRepo)
	inventorySvc := inventory.NewService(inventoryRepo, movementSvc)
	// Phase 4 services
	borrowerSvc := borrower.NewService(borrowerRepo)
	loanSvc := loan.NewService(loanRepo, inventoryRepo)
	// Phase 5 services (continued)
	attachmentSvc := attachment.NewService(fileRepo, attachmentRepo)
	activitySvc := activity.NewService(activityRepo)
	deletedSvc := deleted.NewService(deletedRepo)
	favoriteSvc := favorite.NewService(favoriteRepo)
	// Analytics service
	analyticsSvc := analytics.NewService(analyticsRepo)
	// Import/Export and Sync services
	importExportSvc := importexport.NewService(importExportRepo)
	syncSvc := sync.NewService(syncRepo)
	// Barcode service
	barcodeSvc := barcode.NewService()
	// Batch service (for PWA offline sync)
	batchSvc := batch.NewService(itemSvc, locationSvc, containerSvc, inventorySvc, categorySvc, labelSvc, companySvc)

	// Create handlers with dependencies
	userHandler := user.NewHandler(userSvc, jwtService, workspaceSvc)
	analyticsHandler := analytics.NewHandler(analyticsSvc)
	importExportHandler := importexport.NewHandler(importExportSvc)
	syncHandler := sync.NewHandler(syncSvc)

	// Register public routes (no auth)
	userHandler.RegisterPublicRoutes(api)

	// Register barcode lookup (public, no auth required)
	barcode.RegisterRoutes(api, barcodeSvc)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.JWTAuth(jwtService))

		// Create protected API config without docs (docs are already registered publicly)
		protectedConfig := huma.DefaultConfig("Home Warehouse API", "1.0.0")
		protectedConfig.DocsPath = ""
		protectedConfig.OpenAPIPath = ""
		protectedAPI := humachi.New(r, protectedConfig)

		// Register protected user routes
		userHandler.RegisterProtectedRoutes(protectedAPI)

		// Register admin routes (requires superuser check in handler)
		userHandler.RegisterAdminRoutes(protectedAPI)

		// Register workspace management routes (user-level)
		workspace.RegisterRoutes(protectedAPI, workspaceSvc)

		// Register notification routes (user-level)
		notification.RegisterRoutes(protectedAPI, notificationSvc)

		// Workspace-scoped routes
		r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
			r.Use(appMiddleware.Workspace(appMiddleware.NewMemberAdapter(memberRepo)))
			// Create workspace API config without docs
			wsConfig := huma.DefaultConfig("Home Warehouse API", "1.0.0")
			wsConfig.DocsPath = ""
			wsConfig.OpenAPIPath = ""
			wsAPI := humachi.New(r, wsConfig)

			// Register single-workspace routes (get, update, delete on "/")
			workspace.RegisterWorkspaceScopedRoutes(wsAPI, workspaceSvc)

			// Register workspace member routes (auth domain)
			member.RegisterRoutes(wsAPI, memberSvc)

			// Register Phase 1 domain routes (hierarchical data)
			category.RegisterRoutes(wsAPI, categorySvc)
			location.RegisterRoutes(wsAPI, locationSvc)
			container.RegisterRoutes(wsAPI, containerSvc)

			// Register Phase 2 domain routes (supporting data)
			company.RegisterRoutes(wsAPI, companySvc)
			label.RegisterRoutes(wsAPI, labelSvc)

			// Register Phase 3 domain routes (core inventory)
			item.RegisterRoutes(wsAPI, itemSvc)
			inventory.RegisterRoutes(wsAPI, inventorySvc)

			// Register Phase 4 domain routes (loans & borrowers)
			borrower.RegisterRoutes(wsAPI, borrowerSvc)
			loan.RegisterRoutes(wsAPI, loanSvc)

			// Register Phase 5 domain routes (activity & sync)
			activity.RegisterRoutes(wsAPI, activitySvc)
			deleted.RegisterRoutes(wsAPI, deletedSvc)
			favorite.RegisterRoutes(wsAPI, favoriteSvc)
			movement.RegisterRoutes(wsAPI, movementSvc)
			attachment.RegisterRoutes(wsAPI, attachmentSvc)

			// Register analytics routes
			analyticsHandler.RegisterRoutes(wsAPI)

			// Register import/export and sync routes
			importExportHandler.RegisterRoutes(wsAPI)
			syncHandler.RegisterRoutes(wsAPI)

			// Register batch operations (for PWA offline sync)
			batch.RegisterRoutes(wsAPI, batchSvc)
		})
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
