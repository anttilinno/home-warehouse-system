# Structured Logging

The backend uses Go's `slog` package for structured JSON logging with automatic user/workspace context extraction.

## Log Format

### Production Mode (JSON)

```json
{
  "time": "2026-01-14T17:30:45.123Z",
  "level": "INFO",
  "msg": "request completed",
  "method": "GET",
  "path": "/api/items",
  "status": 200,
  "duration_ms": 45,
  "request_id": "abc123-def456",
  "remote_addr": "192.168.1.100:54321",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_email": "user@example.com",
  "workspace_id": "660e8400-e29b-41d4-a716-446655440000",
  "workspace_role": "admin"
}
```

### Development Mode (Text)

```
time=2026-01-14T17:30:45.123+02:00 level=INFO msg="request completed" method=GET path=/api/items status=200 duration_ms=45 request_id=abc123-def456 user_id=550e8400-e29b-41d4-a716-446655440000 workspace_id=660e8400-e29b-41d4-a716-446655440000
```

## Log Levels

Logs are automatically leveled based on HTTP status code:

- **INFO** (200-399): Normal requests
- **WARN** (400-499): Client errors (bad requests, validation failures)
- **ERROR** (500-599): Server errors (crashes, database failures)

## Context Fields

The logger automatically extracts these fields from request context:

| Field | Source | When Available |
|-------|--------|----------------|
| `method` | HTTP method | Always |
| `path` | URL path | Always |
| `status` | HTTP status code | Always |
| `duration_ms` | Request duration | Always |
| `request_id` | Chi middleware.RequestID | Always (if middleware enabled) |
| `remote_addr` | Client IP | Always |
| `user_id` | JWT claims | Authenticated requests only |
| `user_email` | JWT claims | Authenticated requests only |
| `is_superuser` | JWT claims | Superuser requests only |
| `workspace_id` | Workspace middleware | Workspace-scoped requests only |
| `workspace_role` | Workspace middleware | Workspace-scoped requests only |

## Configuration

Set the `DEBUG` environment variable to control log format:

```bash
# Production: JSON format
DEBUG=false go run ./cmd/server

# Development: Human-readable text format with source locations
DEBUG=true go run ./cmd/server
```

## Usage in Code

The logger is configured globally in `router.go` and applied to all requests:

```go
logger := appMiddleware.NewLogger(cfg.DebugMode)
r.Use(appMiddleware.StructuredLogger(logger))
```

## Log Aggregation

JSON logs are designed for ingestion by log aggregation services:

- **Elasticsearch/Kibana**: Index by `request_id`, `user_id`, `workspace_id`
- **Datadog**: Use automatic field extraction
- **CloudWatch Logs**: Parse JSON and create metric filters
- **Grafana Loki**: Query by labels (`level`, `method`, `status`)

### Example Queries

**Find all errors for a specific user:**
```
user_id="550e8400-e29b-41d4-a716-446655440000" AND level="ERROR"
```

**Track slow requests (>500ms):**
```
duration_ms > 500
```

**Monitor workspace activity:**
```
workspace_id="660e8400-e29b-41d4-a716-446655440000" AND method IN ("POST", "PUT", "DELETE")
```

## Testing

All logging functionality is tested in `logger_test.go`:

```bash
go test ./internal/api/middleware -v -run TestStructuredLogger
```

## Performance

Structured logging adds minimal overhead:
- ~50-100μs per request (negligible compared to typical request duration)
- Zero allocations for field extraction from context
- Buffered JSON encoding for production use
