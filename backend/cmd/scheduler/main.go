package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/imageprocessor"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
	"github.com/antti/home-warehouse/go-backend/internal/infra/webpush"
	"github.com/antti/home-warehouse/go-backend/internal/jobs"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load configuration
	cfg := config.Load()

	// Get database URL from environment (override config if GO_DATABASE_URL is set)
	dbURL := os.Getenv("GO_DATABASE_URL")
	if dbURL == "" {
		dbURL = cfg.DatabaseURL
	}

	// Get Redis URL
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	// Connect to database
	dbPool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Test database connection
	if err := dbPool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to database successfully")

	// Initialize push subscription repository for web push sender
	pushSubscriptionRepo := postgres.NewPushSubscriptionRepository(dbPool)

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

	// Create scheduler with default config
	schedulerConfig := jobs.DefaultSchedulerConfig(redisURL)
	scheduler := jobs.NewScheduler(dbPool, schedulerConfig)

	// Initialize storage and image processor for thumbnail processing
	uploadDir := getUploadDir()
	photoStorageDir := getPhotoStorageDir()
	photoStorage, err := storage.NewLocalStorage(photoStorageDir)
	if err != nil {
		log.Fatalf("Failed to initialize photo storage: %v", err)
	}
	imgProcessor := imageprocessor.NewProcessor(imageprocessor.DefaultConfig())
	broadcaster := events.NewBroadcaster()

	// Register task handlers
	// Note: emailSender is nil - implement when email service is added
	cleanupConfig := jobs.DefaultCleanupConfig()
	thumbnailConfig := &jobs.ThumbnailConfig{
		Processor:   imgProcessor,
		Storage:     photoStorage,
		Broadcaster: broadcaster,
		UploadDir:   uploadDir,
	}
	mux := scheduler.RegisterHandlers(nil, pushSender, cleanupConfig, thumbnailConfig)

	// Register scheduled/periodic tasks
	if err := scheduler.RegisterScheduledTasks(); err != nil {
		log.Fatalf("Failed to register scheduled tasks: %v", err)
	}

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start health check server on port 8082
	healthMux := http.NewServeMux()
	healthMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","scheduler":"running"}`)
	})

	healthServer := &http.Server{
		Addr:    ":8082",
		Handler: healthMux,
	}

	go func() {
		log.Println("Health check server starting on :8082")
		if err := healthServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Health check server error: %v", err)
		}
	}()

	// Start scheduler in goroutine
	go func() {
		log.Println("Starting job scheduler...")
		if err := scheduler.Start(mux); err != nil {
			log.Fatalf("Scheduler error: %v", err)
		}
	}()

	log.Println("Job scheduler started successfully")
	log.Println("Scheduled tasks:")
	log.Println("  - Loan reminders: daily at 9 AM")
	log.Println("  - Repair reminders: daily at 9 AM")
	log.Println("  - Deleted records cleanup: weekly Sunday 3 AM")
	log.Println("  - Activity logs cleanup: weekly Sunday 4 AM")

	// Wait for shutdown signal
	<-sigChan
	log.Println("Shutdown signal received, stopping scheduler...")

	// Cancel context
	cancel()

	// Shutdown health check server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := healthServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("Health server shutdown error: %v", err)
	}

	// Stop scheduler gracefully
	scheduler.Stop()

	log.Println("Scheduler stopped")
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
