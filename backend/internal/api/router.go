package api

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/api/health"
	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/domain/analytics"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/notification"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/pushsubscription"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/domain/barcode"
	"github.com/antti/home-warehouse/go-backend/internal/domain/batch"
	"github.com/antti/home-warehouse/go-backend/internal/domain/events"
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
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/movement"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/importjob"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/pendingchange"
	infraEvents "github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queue"
	"github.com/antti/home-warehouse/go-backend/internal/infra/webpush"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
	"github.com/redis/go-redis/v9"
)

// NewRouter creates and configures the main router.
func NewRouter(pool *pgxpool.Pool, cfg *config.Config) chi.Router {
	r := chi.NewRouter()

	// Create structured logger
	logger := appMiddleware.NewLogger(cfg.DebugMode)

	// Global middleware
	r.Use(middleware.RequestID)  // Must be first to generate request IDs
	r.Use(middleware.RealIP)
	r.Use(appMiddleware.StructuredLogger(logger))  // Structured logging with user context
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(appMiddleware.CORS)

	// Create JWT service
	jwtService := jwt.NewService(cfg.JWTSecret, cfg.JWTExpirationHours)

	// Create event broadcaster for SSE
	broadcaster := infraEvents.NewBroadcaster()

	// Initialize Redis for background jobs
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}
	redisOpts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("failed to parse Redis URL: %v", err)
	}
	redisClient := redis.NewClient(redisOpts)
	importQueue := queue.NewQueue(redisClient, "imports")

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
	healthHandler := health.NewHandler(pool)
	huma.Get(api, "/health", healthHandler.Health)

	// Register additional documentation routes (Redoc UI)
	RegisterDocsRoutes(r)

	// Initialize transaction manager
	txManager := postgres.NewTxManager(pool)

	// Initialize repositories
	// Auth repositories
	userRepo := postgres.NewUserRepository(pool)
	workspaceRepo := postgres.NewWorkspaceRepository(pool)
	memberRepo := postgres.NewMemberRepository(pool)
	notificationRepo := postgres.NewNotificationRepository(pool)
	pushSubscriptionRepo := postgres.NewPushSubscriptionRepository(pool)
	// Phase 1 repositories
	categoryRepo := postgres.NewCategoryRepository(pool)
	locationRepo := postgres.NewLocationRepository(pool)
	containerRepo := postgres.NewContainerRepository(pool)
	// Phase 2 repositories
	companyRepo := postgres.NewCompanyRepository(pool)
	labelRepo := postgres.NewLabelRepository(pool)
	// Phase 3 repositories
	itemRepo := postgres.NewItemRepository(pool)
	itemPhotoRepo := postgres.NewItemPhotoRepository(pool, txManager)
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
	importJobRepo := postgres.NewImportJobRepository(pool)
	pendingChangeRepo := postgres.NewPendingChangeRepository(pool)

	// Initialize web push sender (optional - only if VAPID keys are configured)
	var pushSender *webpush.Sender
	if cfg.VAPIDPublicKey != "" && cfg.VAPIDPrivateKey != "" {
		pushSender = webpush.NewSender(
			cfg.VAPIDPublicKey,
			cfg.VAPIDPrivateKey,
			cfg.VAPIDSubscriber,
			pushSubscriptionRepo,
		)
		log.Println("Web push notifications enabled")
	} else {
		log.Println("Web push notifications disabled (VAPID keys not configured)")
	}

	// Initialize services
	// Auth services
	userSvc := user.NewService(userRepo)
	workspaceSvc := workspace.NewService(workspaceRepo, memberRepo)
	memberSvc := member.NewService(memberRepo)
	notificationSvc := notification.NewService(notificationRepo)
	pushSubscriptionSvc := pushsubscription.NewService(pushSubscriptionRepo)
	// Phase 1 services
	categorySvc := category.NewService(categoryRepo)
	locationSvc := location.NewService(locationRepo)
	containerSvc := container.NewService(containerRepo)
	// Phase 2 services
	companySvc := company.NewService(companyRepo)
	labelSvc := label.NewService(labelRepo)
	// Phase 3 services
	itemSvc := item.NewService(itemRepo)

	// Initialize storage and image processor for item photos
	uploadDir := getUploadDir()
	photoStorageDir := getPhotoStorageDir()
	photoStorage, err := storage.NewLocalStorage(photoStorageDir)
	if err != nil {
		log.Fatalf("failed to initialize photo storage: %v", err)
	}
	imageProcessor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
	itemPhotoSvc := itemphoto.NewService(itemPhotoRepo, photoStorage, imageProcessor, uploadDir)
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
	workspaceBackupSvc := importexport.NewWorkspaceBackupService(queries.New(pool))
	syncSvc := sync.NewService(syncRepo)
	// Barcode service
	barcodeSvc := barcode.NewService()
	// Batch service (for PWA offline sync)
	batchSvc := batch.NewService(itemSvc, locationSvc, containerSvc, inventorySvc, categorySvc, labelSvc, companySvc)
	// Pending change service (for approval workflow)
	pendingChangeSvc := pendingchange.NewService(
		pendingChangeRepo,
		memberRepo,
		userRepo,
		itemRepo,
		categoryRepo,
		locationRepo,
		containerRepo,
		inventoryRepo,
		borrowerRepo,
		loanRepo,
		labelRepo,
		broadcaster,
	)
	// Enable push notifications for approval workflow if configured
	if pushSender != nil {
		pendingChangeSvc.SetPushSender(pushSender)
	}

	// Create handlers with dependencies
	userHandler := user.NewHandler(userSvc, jwtService, workspaceSvc)
	analyticsHandler := analytics.NewHandler(analyticsSvc)
	importExportHandler := importexport.NewHandler(importExportSvc, workspaceBackupSvc)
	syncHandler := sync.NewHandler(syncSvc)

	// Rate limiter for auth endpoints (5 requests per minute per IP)
	authRateLimiter := appMiddleware.NewRateLimiter(5, time.Minute)

	// Register public routes with rate limiting for auth endpoints
	r.Group(func(r chi.Router) {
		r.Use(appMiddleware.RateLimit(authRateLimiter))
		rateLimitedConfig := huma.DefaultConfig("Home Warehouse API", "1.0.0")
		rateLimitedConfig.DocsPath = ""
		rateLimitedConfig.OpenAPIPath = ""
		rateLimitedAPI := humachi.New(r, rateLimitedConfig)
		userHandler.RegisterPublicRoutes(rateLimitedAPI)
	})

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

		// Register push subscription routes (user-level)
		pushsubscription.RegisterRoutes(protectedAPI, pushSubscriptionSvc)

		// Workspace-scoped routes
		r.Route("/workspaces/{workspace_id}", func(r chi.Router) {
			r.Use(appMiddleware.Workspace(appMiddleware.NewMemberAdapter(memberRepo)))

			// Apply approval middleware to intercept member operations
			// This must come after Workspace middleware (which sets the role in context)
			pendingChangeAdapter := pendingchange.NewMiddlewareAdapter(pendingChangeSvc)
			r.Use(appMiddleware.ApprovalMiddleware(pendingChangeAdapter))

			// Register SSE endpoint (uses Chi directly, not Huma)
			eventsHandler := events.NewHandler(broadcaster)
			eventsHandler.RegisterRoutes(r)

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
			category.RegisterRoutes(wsAPI, categorySvc, broadcaster)
			location.RegisterRoutes(wsAPI, locationSvc, broadcaster)
			container.RegisterRoutes(wsAPI, containerSvc, broadcaster)

			// Register Phase 2 domain routes (supporting data)
			company.RegisterRoutes(wsAPI, companySvc, broadcaster)
			label.RegisterRoutes(wsAPI, labelSvc, broadcaster)

			// Register Phase 3 domain routes (core inventory)
			item.RegisterRoutes(wsAPI, itemSvc, broadcaster)
			inventory.RegisterRoutes(wsAPI, inventorySvc, broadcaster)

			// Register item photo routes
			photoURLGenerator := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
				if isThumbnail {
					return fmt.Sprintf("%s/api/v1/workspaces/%s/items/%s/photos/%s/thumbnail",
						cfg.BackendURL, workspaceID, itemID, photoID)
				}
				return fmt.Sprintf("%s/api/v1/workspaces/%s/items/%s/photos/%s",
					cfg.BackendURL, workspaceID, itemID, photoID)
			}
			itemphoto.RegisterRoutes(wsAPI, itemPhotoSvc, broadcaster, photoURLGenerator)

			// Register photo upload and serve handlers (use Chi directly for multipart)
			storageGetter := &photoStorageGetter{storage: photoStorage}
			itemphoto.RegisterUploadHandler(r, itemPhotoSvc, broadcaster, photoURLGenerator)
			itemphoto.RegisterServeHandler(r, itemPhotoSvc, storageGetter)

			// Register Phase 4 domain routes (loans & borrowers)
			borrower.RegisterRoutes(wsAPI, borrowerSvc, broadcaster)
			loan.RegisterRoutes(wsAPI, loanSvc, broadcaster)

			// Register Phase 5 domain routes (activity & sync)
			activity.RegisterRoutes(wsAPI, activitySvc)
			deleted.RegisterRoutes(wsAPI, deletedSvc)
			favorite.RegisterRoutes(wsAPI, favoriteSvc, broadcaster)
			movement.RegisterRoutes(wsAPI, movementSvc)
			attachment.RegisterRoutes(wsAPI, attachmentSvc, broadcaster)

			// Register analytics routes
			analyticsHandler.RegisterRoutes(wsAPI)

			// Register import/export and sync routes
			importExportHandler.RegisterRoutes(wsAPI)
			syncHandler.RegisterRoutes(wsAPI)

			// Register import job routes
			importjob.RegisterRoutes(wsAPI, importJobRepo, importQueue, broadcaster)

			// Register upload handler (uses Chi directly for multipart form data)
			uploadHandler := importjob.NewUploadHandler(importJobRepo, importQueue)
			uploadHandler.RegisterUploadRoutes(r)

			// Register batch operations (for PWA offline sync)
			batch.RegisterRoutes(wsAPI, batchSvc)

			// Register pending change management routes (approval workflow)
			pendingchange.RegisterRoutes(wsAPI, pendingChangeSvc, userRepo)
		})
	})

	return r
}

// getUploadDir returns the configured temporary upload directory for processing files
func getUploadDir() string {
	dir := os.Getenv("PHOTO_UPLOAD_DIR")
	if dir == "" {
		dir = "/tmp/photo-uploads"
	}

	// Create directory if it doesn't exist
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("Warning: failed to create upload directory %s: %v", dir, err)
	}

	return dir
}

// getPhotoStorageDir returns the configured permanent storage directory for photos
func getPhotoStorageDir() string {
	dir := os.Getenv("PHOTO_STORAGE_DIR")
	if dir == "" {
		dir = "./uploads/photos"
	}

	// Create directory if it doesn't exist
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("Warning: failed to create photo storage directory %s: %v", dir, err)
	}

	return dir
}


// photoStorageGetter implements the StorageGetter interface
type photoStorageGetter struct {
	storage *storage.LocalStorage
}

func (g *photoStorageGetter) GetStorage() itemphoto.Storage {
	return g.storage
}
