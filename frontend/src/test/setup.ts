// jsdom ships no IndexedDB; the offline query-cache persister (idb-keyval) needs
// it, so any test that mounts App/auth flows or hits purgePersistedCache() throws
// "indexedDB is not defined" without this. fake-indexeddb/auto installs a spec
// implementation on the global before anything imports the persister.
import "fake-indexeddb/auto";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";

// ── Blob.stream polyfill ─────────────────────────────────────────────────────
// jsdom (29.x) shadows the global `Blob` with its own implementation that ships
// NO `.stream()`. jsdom does NOT provide `Response`, so it stays the runtime's
// native one — and runtimes that consume a Blob body via streaming (observed in
// CI: `new Response(new Blob([...]))` in the blob-download specs) call
// `blob.stream()` and throw `object.stream is not a function`. Local runtimes
// that consume via `arrayBuffer()` don't hit it, so the failure is CI-only and
// hard to see. Polyfill minimally when absent; no-op where `.stream()` exists.
if (
  typeof Blob !== "undefined" &&
  typeof Blob.prototype.stream !== "function"
) {
  Blob.prototype.stream = function stream(): ReadableStream<
    Uint8Array<ArrayBuffer>
  > {
    const blob = this;
    return new ReadableStream<Uint8Array<ArrayBuffer>>({
      async start(controller) {
        controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
        controller.close();
      },
    });
  };
}

// ── matchMedia test stub ─────────────────────────────────────────────────────
// jsdom ships NO `window.matchMedia`. The Dark Mode ThemeProvider calls it to
// follow `prefers-color-scheme` while the pref is `system` (the default), so
// without this stub every test that mounts the provider tree throws
// `matchMedia is not a function`. Minimal: reports not-matched (→ light) with
// no-op listener registration. Tests that need dark can override per-case.
if (typeof globalThis.window !== "undefined" && !globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Register the shared MSW server for the whole jsdom unit-test run. Loaded via
// vitest.config.ts `setupFiles` alongside test-utils.tsx. `onUnhandledRequest:
// "error"` surfaces any endpoint a test forgot to handle, keeping fixtures
// honest. Tests override per-case with `server.use(...)`.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ── ResizeObserver test stub ─────────────────────────────────────────────────
// jsdom ships NO `ResizeObserver`. RetroTable observes its scroller to toggle
// the right-edge overflow cue, so every test that renders a RetroTable would
// throw `ResizeObserver is not defined` without this. Minimal no-op: it never
// fires (jsdom has no layout), which is fine — the cue is a visual affordance,
// and the initial `update()` call still runs against the (zero-size) element.
if (typeof globalThis.ResizeObserver === "undefined") {
  class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
    MockResizeObserver;
}

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
    const data =
      typeof dataObj === "string" ? dataObj : JSON.stringify(dataObj);
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
(globalThis as { EventSource?: unknown }).EventSource = MockEventSource;

afterEach(() => MockEventSource.reset());

// ── Camera (getUserMedia) test stub ──────────────────────────────────────────
// Phase 11 (Scan). jsdom ships NO `navigator.mediaDevices`, so any feature code
// that probes torch support or that mounts a scanner without the scanner-mock
// (e.g. the useTorch capability hook) would throw `Cannot read properties of
// undefined (reading 'getUserMedia')`. This stub (mirroring MockEventSource: a
// static registry installed on the global, reset each afterEach) resolves
// getUserMedia to a fake MediaStream whose single video track exposes
// `getCapabilities()` (torch overridable, default false), `applyConstraints()`
// (records the last constraints), and a no-op `stop()`. Per-test override of the
// torch capability via `MockMediaDevices.torchSupported = true` BEFORE the call.

class FakeMediaStreamTrack {
  readonly kind = "video";
  stopped = false;
  appliedConstraints: MediaTrackConstraintSet[] = [];

  getCapabilities(): MediaTrackCapabilities & { torch?: boolean } {
    return { torch: MockMediaDevices.torchSupported };
  }

  applyConstraints(constraints?: MediaTrackConstraints): Promise<void> {
    const advanced = constraints?.advanced ?? [];
    this.appliedConstraints.push(...advanced);
    return Promise.resolve();
  }

  stop(): void {
    this.stopped = true;
  }
}

class FakeMediaStream {
  readonly track = new FakeMediaStreamTrack();
  getVideoTracks(): FakeMediaStreamTrack[] {
    return [this.track];
  }
  getTracks(): FakeMediaStreamTrack[] {
    return [this.track];
  }
}

class MockMediaDevices {
  /** Whether the fake video track reports torch support. Reset each afterEach. */
  static torchSupported = false;

  /** Every stream handed out during the current test (reset each afterEach). */
  static streams: FakeMediaStream[] = [];

  static reset(): void {
    MockMediaDevices.torchSupported = false;
    MockMediaDevices.streams = [];
  }

  getUserMedia(
    _constraints?: MediaStreamConstraints,
  ): Promise<FakeMediaStream> {
    const stream = new FakeMediaStream();
    MockMediaDevices.streams.push(stream);
    return Promise.resolve(stream);
  }
}

// Install a fake `navigator.mediaDevices` carrying the mock getUserMedia. jsdom's
// `navigator` exists but lacks `mediaDevices`; define it as configurable so the
// reset is idempotent across the whole suite.
Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: new MockMediaDevices(),
});

export { MockMediaDevices, FakeMediaStream, FakeMediaStreamTrack };

// ── BarcodeDetector test stub ────────────────────────────────────────────────
// Phase 11 (Scan). jsdom ships NO global `BarcodeDetector`. The scanner stack
// (barcode-detector/polyfill) and any feature-detection probe (`'BarcodeDetector'
// in globalThis`) must not throw. This minimal stub class defines the global so
// probes succeed; its async `detect()` returns no codes by default (component
// tests drive decodes through the scanner-mock's onScan, not through this).

class MockBarcodeDetector {
  static getSupportedFormats(): Promise<string[]> {
    return Promise.resolve(["qr_code", "upc_a", "ean_13", "code_128"]);
  }
  constructor(_opts?: { formats?: string[] }) {}
  detect(_source?: unknown): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}

(globalThis as { BarcodeDetector?: unknown }).BarcodeDetector =
  MockBarcodeDetector as unknown;

afterEach(() => MockMediaDevices.reset());
