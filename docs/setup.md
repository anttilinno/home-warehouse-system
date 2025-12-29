# Setup

## Tech Stack

- Python 3.14
- uv - Python package manager
- bun - JavaScript runtime and package manager
- dbmate - Database migration tool
- [Claude Code](https://claude.ai/code) - AI coding assistant (see `.claude/CLAUDE.md` for project context)

## Prerequisites

- [mise](https://mise.jdx.dev/) - Tool version manager
- Docker - For running PostgreSQL and Redis

## Installation

1. Install mise if you haven't already:
   ```bash
   curl https://mise.run | sh
   ```

2. Install project dependencies:
   ```bash
   mise install
   ```

3. Start the database and Redis:
   ```bash
   mise run dc-up
   ```

4. Run database migrations:
   ```bash
   mise run migrate
   ```

5. Install frontend dependencies:
   ```bash
   mise run fe-install
   ```

## Environment Variables

The following environment variables are set by mise (for local development):

- `DATABASE_URL` - PostgreSQL connection string (default: `postgresql+asyncpg://wh:wh@localhost:5432/warehouse_dev`)
- `DBMATE_DATABASE_URL` - PostgreSQL connection string for dbmate migrations
- `APP_DEBUG` - Enable debug mode

Additional environment variables (see `backend/.env.example`):

- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379/0`)
- `SECRET_KEY` - JWT signing key (**must change in production**)
- `JWT_ALGORITHM` - JWT algorithm (default: `HS256`)
- `JWT_EXPIRATION_HOURS` - Token expiration time (default: `24`)

> **Note:** All credentials in this repository are examples for local development only. Do not use in production.

## Project Structure

```
.
├── backend/             # Python backend (Litestar)
│   ├── src/            # Source code
│   ├── db/             # Database migrations
│   └── e2e/            # End-to-end tests
├── docs/               # Documentation
├── frontend/           # Next.js frontend
└── docker-compose.yml  # PostgreSQL + Redis
```
