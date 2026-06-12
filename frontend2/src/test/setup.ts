import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// Register the shared MSW server for the whole jsdom unit-test run. Loaded via
// vitest.config.ts `setupFiles` alongside test-utils.tsx. `onUnhandledRequest:
// "error"` surfaces any endpoint a test forgot to handle, keeping fixtures
// honest. Tests override per-case with `server.use(...)`.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
