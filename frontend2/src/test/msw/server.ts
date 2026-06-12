import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Shared MSW node server for jsdom unit tests (Phase 05 Plan 02). Reused by
// Plans 03/04/05 to mock auth endpoints. Lifecycle (listen/resetHandlers/close)
// is registered in src/test/setup.ts so every vitest run shares one server.
export const server = setupServer(...handlers);
