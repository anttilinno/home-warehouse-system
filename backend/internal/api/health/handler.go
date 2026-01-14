package health

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Version is the application version, set at build time
var Version = "dev"

// Handler handles health check requests.
type Handler struct {
	pool *pgxpool.Pool
}

// NewHandler creates a new health handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{
		pool: pool,
	}
}

// HealthInput is the input for the health check endpoint.
type HealthInput struct{}

// HealthResponse is the response for the health check endpoint.
type HealthResponse struct {
	Body HealthBody
}

// HealthBody is the response body for health check.
type HealthBody struct {
	Status  string            `json:"status" doc:"Overall system status: healthy, degraded, or unhealthy"`
	Version string            `json:"version" doc:"Application version"`
	Checks  map[string]string `json:"checks" doc:"Individual dependency health checks"`
}

// Health performs health checks on all dependencies and returns the overall status.
func (h *Handler) Health(ctx context.Context, input *HealthInput) (*HealthResponse, error) {
	checks := make(map[string]string)

	// Database check with timeout
	dbCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	if err := h.pool.Ping(dbCtx); err != nil {
		checks["database"] = "unhealthy"
	} else {
		checks["database"] = "healthy"
	}

	// Determine overall status
	status := "healthy"
	for _, checkStatus := range checks {
		if checkStatus == "unhealthy" {
			status = "degraded"
			break
		}
	}

	return &HealthResponse{
		Body: HealthBody{
			Status:  status,
			Version: Version,
			Checks:  checks,
		},
	}, nil
}
