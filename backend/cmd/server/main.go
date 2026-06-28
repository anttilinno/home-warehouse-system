package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/pprof"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/antti/home-warehouse/go-backend/internal/api"
	"github.com/antti/home-warehouse/go-backend/internal/config"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists (ignore error if not found)
	_ = godotenv.Load()

	// Load configuration
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	// Connect to database (config.Load already folds the GO_DATABASE_URL
	// override into cfg.DatabaseURL).
	pool, err := postgres.NewPool(context.Background(), cfg.DatabaseURL, cfg.DatabaseMaxConn, cfg.DatabaseMinConn)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Create router
	router := api.NewRouter(pool, cfg)

	// Create server. The listen address comes from config (SERVER_HOST /
	// SERVER_PORT); the bare PORT env var is kept as an override for
	// backward compatibility with existing deployments.
	port := strconv.Itoa(cfg.ServerPort)
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}
	addr := net.JoinHostPort(cfg.ServerHost, port)

	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Disabled: SSE requires long-lived writes; per-route timeouts handled by middleware
		IdleTimeout:  60 * time.Second,
	}

	// Optional pprof endpoint for profiling under load. Off unless PPROF_ADDR
	// is set (e.g. "localhost:6060"), so it is never exposed in production by
	// default. Handlers are registered on a private mux — not DefaultServeMux —
	// so importing pprof has no global side effect.
	if pprofAddr := os.Getenv("PPROF_ADDR"); pprofAddr != "" {
		go func() {
			pprofMux := http.NewServeMux()
			pprofMux.HandleFunc("/debug/pprof/", pprof.Index)
			pprofMux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
			pprofMux.HandleFunc("/debug/pprof/profile", pprof.Profile)
			pprofMux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
			pprofMux.HandleFunc("/debug/pprof/trace", pprof.Trace)
			fmt.Printf("pprof listening on http://%s/debug/pprof/\n", pprofAddr)
			pprofSrv := &http.Server{Addr: pprofAddr, Handler: pprofMux, ReadHeaderTimeout: 5 * time.Second}
			if err := pprofSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("pprof server error: %v", err)
			}
		}()
	}

	// Start server in goroutine
	go func() {
		fmt.Printf("Starting server on http://%s\n", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("\nShutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server forced to shutdown: %v", err)
	}

	fmt.Println("Server stopped")
}
