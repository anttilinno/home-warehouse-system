## Project Structure

```
.
├── backend/             # Go backend (API server)
│   ├── cmd/server/      # Entry point
│   ├── internal/        # Application code
│   │   ├── api/         # HTTP handlers, middleware, router
│   │   ├── domain/      # Business logic (DDD)
│   │   └── jobs/        # Background jobs
│   ├── db/
│   │   ├── migrations/  # Database migrations
│   │   └── queries/     # sqlc queries
│   └── tests/           # Integration tests
├── frontend/            # Next.js frontend
├── db/                  # Schema dump
├── docker/              # Docker configs
└── docs/                # Documentation
```