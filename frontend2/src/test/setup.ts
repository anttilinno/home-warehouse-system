import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// Register the shared MSW server for the whole jsdom unit-test run. Loaded via
// vitest.config.ts `setupFiles` alongside test-utils.tsx. `onUnhandledRequest:
// "error"` surfaces any endpoint a test forgot to handle, keeping fixtures
// honest. Tests override per-case with `server.use(...)`.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── EventSource test stub ────────────────────────────────────────────────────
// jsdom ships NO `EventSource` (Phase 6 RESEARCH Pitfall 1 — verified via JSDOM
// probe → undefined). SSEProvider constructs `new EventSource(url, { withCredentials })`,
// so without this stub every SSE unit test throws `EventSource is not defined`.
// The stub lives here (shared setup) so the whole unit suite — not just the SSE
// spec — can mount the provider tree.
//
// Faithful-but-minimal: it records `url` + `withCredentials`, tracks named-event
// handlers, flips `readyState` to CLOSED on `close()`, and exposes a test-facing
// `emit(type, dataObj)` that builds a `MessageEvent`-like `{ data: JSON.stringify }`
// and invokes the registered handlers for that event name. A closed instance
// delivers nothing (guards the unmount/auth-expired "no further events" cases).
// Every live instance registers on `MockEventSource.instances` so a test can
// assert "exactly one open connection" and reach the latest instance; the
// registry is reset in `afterEach`.

type SSEHandler = (event: { data: string }) => void;

export class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  /** All instances created during the current test (reset each `afterEach`). */
  static instances: MockEventSource[] = [];

  /** Convenience: the most recently constructed (live or closed) instance. */
  static get last(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }

  /** Count of instances that have NOT been closed (the "open connections"). */
  static get openCount(): number {
    return MockEventSource.instances.filter(
      (i) => i.readyState !== MockEventSource.CLOSED,
    ).length;
  }

  static reset(): void {
    MockEventSource.instances = [];
  }

  readonly url: string;
  readonly withCredentials: boolean;
  readyState: number = MockEventSource.CONNECTING;

  private readonly handlers = new Map<string, Set<SSEHandler>>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    this.readyState = MockEventSource.OPEN;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: SSEHandler): void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
  }

  removeEventListener(type: string, handler: SSEHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  /**
   * Test-facing: deliver a named SSE event. `dataObj` is JSON-stringified into a
   * `MessageEvent`-like `{ data }`. A closed instance is inert (no delivery), so
   * tests can assert that unmount / auth-expired truly stopped the stream.
   */
  emit(type: string, dataObj: unknown): void {
    if (this.readyState === MockEventSource.CLOSED) return;
    const data = typeof dataObj === "string" ? dataObj : JSON.stringify(dataObj);
    for (const handler of this.handlers.get(type) ?? []) {
      handler({ data });
    }
  }

  /** Test-facing: simulate a transport error (drives the reconnect/backoff path). */
  emitError(): void {
    if (this.readyState === MockEventSource.CLOSED) return;
    for (const handler of this.handlers.get("error") ?? []) {
      handler({ data: "" });
    }
  }
}

// Install on the global so `new EventSource(...)` in app code resolves to the stub.
(globalThis as { EventSource?: unknown }).EventSource =
  MockEventSource as unknown as typeof EventSource;

afterEach(() => MockEventSource.reset());
