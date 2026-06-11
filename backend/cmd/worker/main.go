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
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queue"
	"github.com/antti/home-warehouse/go-backend/internal/worker"
)

// drainTimeout bounds how long shutdown waits for an in-flight import to
// finish. If exceeded, the process exits anyway; the queue's in-flight list
// recovers the job on the next worker start.
const drainTimeout = 60 * time.Second

func main() {
	// Load .env file if it exists (ignore error if not found)
	_ = godotenv.Load()

	// Load configuration (DATABASE_URL with GO_DATABASE_URL precedence,
	// REDIS_URL — same single source of truth as cmd/server).
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize database
	dbPool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Test database connection
	if err := dbPool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	// Initialize Redis
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
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

	// Start worker in goroutine; done closes when Start returns, i.e. after
	// any in-flight import has drained (Start treats ctx cancel as a drain
	// signal, not a kill switch).
	done := make(chan struct{})
	go func() {
		defer close(done)
		log.Println("Worker started, waiting for jobs...")
		if err := w.Start(ctx); err != nil {
			log.Printf("Worker error: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-sigChan
	log.Println("Shutdown signal received, draining worker...")

	// Cancel context to stop dequeuing; in-flight job keeps running.
	cancel()

	// Shutdown health check server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := healthServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("Health server shutdown error: %v", err)
	}

	// Wait for the worker loop to drain, bounded by drainTimeout.
	select {
	case <-done:
		log.Println("Worker drained")
	case <-time.After(drainTimeout):
		log.Printf("Worker drain timed out after %s; exiting with a job in flight (it will be recovered from the in-flight list on next start)", drainTimeout)
	}

	log.Println("Worker stopped")
}
