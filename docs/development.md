# Development

## Database Commands

- **Start all containers (PostgreSQL + Redis):**
  ```bash
  mise run dc-up
  ```

- **Stop all containers:**
  ```bash
  mise run dc-down
  ```

- **Run database migrations:**
  ```bash
  mise run migrate
  ```

- **Create new migration:**
  ```bash
  mise run migrate-new
  ```

- **Reset database (drop and recreate with fresh migrations):**
  ```bash
  mise run db-reset
  ```

- **Fresh database (complete reset including data volume):**
  ```bash
  mise run db-fresh
  ```

## Backend

See [backend.md](backend.md) for backend commands.

## Frontend

See [frontend.md](frontend.md) for frontend commands.
