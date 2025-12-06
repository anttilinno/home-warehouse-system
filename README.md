# Home Warehouse System

A home warehouse management system for tracking inventory, locations, containers, and loans.

## Prerequisites

- [mise](https://mise.jdx.dev/) - Tool version manager
- Docker - For running PostgreSQL database

## Setup

1. Install mise if you haven't already:
   ```bash
   curl https://mise.run | sh
   ```

2. Install project dependencies:
   ```bash
   mise install
   ```

3. Start the database:
   ```bash
   mise run db-up
   ```

4. Run database migrations:
   ```bash
   mise run migrate
   ```

5. Install frontend dependencies:
   ```bash
   mise run fe-install
   ```

## Development

### Database Commands

- **Start PostgreSQL container:**
  ```bash
  mise run db-up
  ```

- **Stop PostgreSQL container:**
  ```bash
  mise run db-down
  ```

- **Run database migrations:**
  ```bash
  mise run migrate
  ```

- **Create new migration:**
  ```bash
  mise run migrate-new
  ```

### Backend Commands

The backend is built with Litestar and runs on Granian ASGI server.

- **Run backend development server:**
  ```bash
  mise run dev
  ```
  Server runs with auto-reload enabled.

- **Run all tests:**
  ```bash
  mise run test
  ```

- **Run unit tests only:**
  ```bash
  mise run test-unit
  ```

- **Run E2E tests:**
  ```bash
  mise run test-e2e
  ```

- **Run linter:**
  ```bash
  mise run lint
  ```

- **Format code:**
  ```bash
  mise run format
  ```

### Frontend Commands

The frontend is built with Vue 3, PrimeVue, and Tailwind CSS.

- **Install frontend dependencies:**
  ```bash
  mise run fe-install
  ```

- **Run frontend development server:**
  ```bash
  mise run fe-dev
  ```

- **Build frontend for production:**
  ```bash
  mise run fe-build
  ```

## Tools Managed by mise

- Python 3.14
- uv - Python package manager
- bun - JavaScript runtime and package manager
- dbmate - Database migration tool

## Environment Variables

The following environment variable is set by mise:

- `DATABASE_URL` - PostgreSQL connection string (default: `postgres://warehouse:warehouse@localhost:5432/warehouse_dev?sslmode=disable`)

## Project Structure

```
.
├── backend/          # Python backend (Litestar)
│   ├── src/         # Source code
│   ├── db/          # Database migrations
│   └── e2e/         # End-to-end tests
├── frontend/        # Vue.js frontend
└── docker-compose.yml  # PostgreSQL service
```
