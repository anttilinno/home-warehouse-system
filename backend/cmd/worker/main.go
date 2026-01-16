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
	"github.com/redis/go-redis/v9"

	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queue"
	"github.com/antti/home-warehouse/go-backend/internal/worker"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load configuration from environment
	dbURL := os.Getenv("GO_DATABASE_URL")
	if dbURL == "" {
		log.Fatal("GO_DATABASE_URL is required")
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	// Initialize database
	dbPool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Test database connection
	if err := dbPool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Initialize Redis
	redisOpts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	redisClient := redis.NewClient(redisOpts)
	defer redisClient.Close()

	// Test Redis connection
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	log.Println("Connected to database and Redis successfully")

	// Initialize components
	importJobRepo := postgres.NewImportJobRepository(dbPool)
	broadcaster := events.NewBroadcaster()
	importQueue := queue.NewQueue(redisClient, "imports")

	// Create worker
	w := worker.NewImportWorker(importQueue, importJobRepo, broadcaster, dbPool)

	// Setup graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start health check server on port 8081
	healthMux := http.NewServeMux()
	healthMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","worker":"running"}`)
	})

	healthServer := &http.Server{
		Addr:    ":8081",
		Handler: healthMux,
	}

	go func() {
		log.Println("Health check server starting on :8081")
		if err := healthServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("Health check server error: %v", err)
		}
	}()

	// Start worker in goroutine
	go func() {
		log.Println("Worker started, waiting for jobs...")
		if err := w.Start(ctx); err != nil {
			log.Printf("Worker error: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-sigChan
	log.Println("Shutdown signal received, stopping worker...")

	// Cancel context to stop worker
	cancel()

	// Shutdown health check server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := healthServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("Health server shutdown error: %v", err)
	}

	// Give worker time to finish current job
	time.Sleep(5 * time.Second)

	log.Println("Worker stopped")
}
