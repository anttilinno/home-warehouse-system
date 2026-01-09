# Backend

The backend is built with Litestar and runs on Granian ASGI server.

## Commands

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

- **Run RQ worker for loan jobs:**
  ```bash
  mise run rq-worker
  ```

- **Seed database with sample data:**
  ```bash
  mise run seed
  ```
