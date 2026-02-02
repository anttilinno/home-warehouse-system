# Phase 25: Frontend Unit Testing - Research

**Researched:** 2026-01-31
**Domain:** Frontend unit testing (React hooks, offline sync, component testing)
**Confidence:** HIGH

## Summary

This phase adds comprehensive unit tests for critical frontend functionality: the offline mutation system (useOfflineMutation hook and SyncManager), form management (MultiStepForm with draft persistence), and UI components (BarcodeScanner and FloatingActionButton). Phase 22 established the test infrastructure with Vitest, React Testing Library, entity factories, and mock utilities, so this phase focuses on writing tests that exercise edge cases and prevent regressions.

The testing approach follows established patterns from the existing codebase: mocking external dependencies with `vi.mock()`, using `renderHook` with `act()` and `waitFor` for async hook testing, and leveraging the test utilities in `lib/test-utils/`. Component tests for BarcodeScanner and FloatingActionButton require additional mocking strategies for browser APIs (mediaDevices) and animation libraries (motion).

**Primary recommendation:** Use the established test patterns from `use-global-search.test.ts` as the template. Mock IndexedDB via the existing offline-mock utilities, mock navigation APIs for BarcodeScanner, and either mock or use zero-duration animations for motion components.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner | Already configured in Phase 22, fast, ESM native |
| @testing-library/react | ^16.3.2 | Component/hook testing | Already installed, industry standard for React |
| @vitest/coverage-v8 | ^4.0.18 | Coverage reporting | Already configured, V8 native coverage |
| jsdom | ^27.4.0 | DOM environment | Already configured in vitest.config.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/dom | ^10.4.1 | DOM queries | Already installed, used by RTL |
| lib/test-utils | (local) | Entity factories, offline/sync mocks | All tests needing mock data |

### Already Available (No New Dependencies)
The project already has all required testing dependencies installed. No new packages needed.

## Architecture Patterns

### Recommended Test File Structure
```
frontend/
├── lib/
│   ├── hooks/
│   │   ├── use-offline-mutation.ts
│   │   └── __tests__/
│   │       ├── use-offline-mutation.test.ts    # 25-01
│   │       └── use-global-search.test.ts       # (existing)
│   └── sync/
│       ├── sync-manager.ts
│       └── __tests__/
│           ├── sync-manager-ordering.test.ts   # (existing)
│           └── sync-manager.test.ts            # 25-02 (new)
├── components/
│   ├── forms/
│   │   ├── multi-step-form.tsx
│   │   └── __tests__/
│   │       └── multi-step-form.test.tsx        # 25-03
│   ├── scanner/
│   │   ├── barcode-scanner.tsx
│   │   └── __tests__/
│   │       └── barcode-scanner.test.tsx        # 25-04
│   └── fab/
│       ├── floating-action-button.tsx
│       └── __tests__/
│           └── floating-action-button.test.tsx # 25-05
```

### Pattern 1: Hook Testing with Dependency Mocking
**What:** Test hooks by mocking their dependencies and using renderHook
**When to use:** All custom hook tests (useOfflineMutation, form hooks)
**Example:**
```typescript
// Source: Existing pattern from use-global-search.test.ts
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOfflineMutation } from "../use-offline-mutation";
import * as mutationQueue from "@/lib/sync/mutation-queue";
import * as syncManager from "@/lib/sync/sync-manager";
import * as offlineDb from "@/lib/db/offline-db";

// Mock all external dependencies
vi.mock("@/lib/sync/mutation-queue");
vi.mock("@/lib/sync/sync-manager");
vi.mock("@/lib/db/offline-db");

describe("useOfflineMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementations
    vi.mocked(mutationQueue.queueMutation).mockResolvedValue({
      id: 1,
      idempotencyKey: "test-key-123",
      operation: "create",
      entity: "items",
      payload: {},
      timestamp: Date.now(),
      retries: 0,
      status: "pending",
    });
  });

  it("queues mutation and returns idempotency key", async () => {
    const { result } = renderHook(() =>
      useOfflineMutation({
        entity: "items",
        operation: "create",
      })
    );

    let tempId: string;
    await act(async () => {
      tempId = await result.current.mutate({ name: "Test Item" });
    });

    expect(tempId!).toBe("test-key-123");
    expect(mutationQueue.queueMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "items",
        operation: "create",
        payload: { name: "Test Item" },
      })
    );
  });
});
```

### Pattern 2: Class Testing with Instance Methods
**What:** Test SyncManager class methods by instantiating and mocking dependencies
**When to use:** SyncManager comprehensive tests
**Example:**
```typescript
// Source: Pattern for testing SyncManager class
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { SyncManager, ENTITY_SYNC_ORDER } from "../sync-manager";
import * as mutationQueue from "../mutation-queue";
import { createMutationEntry } from "@/lib/test-utils";

vi.mock("../mutation-queue");

describe("SyncManager.processQueue", () => {
  let manager: SyncManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    manager = new SyncManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it("processes mutations in entity order", async () => {
    const mutations = [
      createMutationEntry({ entity: "items", id: 1 }),
      createMutationEntry({ entity: "categories", id: 2 }),
    ];
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue(mutations);
    vi.mocked(mutationQueue.updateMutationStatus).mockResolvedValue();
    vi.mocked(mutationQueue.removeMutation).mockResolvedValue();

    // Mock fetch for API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    await manager.processQueue();

    // Verify categories processed before items
    const fetchCalls = vi.mocked(global.fetch).mock.calls;
    // Assert order based on ENTITY_SYNC_ORDER
  });
});
```

### Pattern 3: Component Testing with Browser API Mocks
**What:** Test components that use browser APIs by mocking those APIs
**When to use:** BarcodeScanner (mediaDevices), components using navigator
**Example:**
```typescript
// Source: Pattern for mocking browser APIs
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BarcodeScanner } from "../barcode-scanner";

// Mock the dynamic import
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ Scanner: React.FC }>) => {
    const MockScanner = (props: { onScan: (r: unknown[]) => void; onError: (e: Error) => void }) => (
      <div data-testid="mock-scanner" />
    );
    MockScanner.displayName = "MockScanner";
    return MockScanner;
  },
}));

// Mock scanner polyfill
vi.mock("@/lib/scanner", () => ({
  initBarcodePolyfill: vi.fn().mockResolvedValue(undefined),
  SUPPORTED_FORMATS: ["qr_code", "ean_13"],
}));

describe("BarcodeScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock navigator.mediaDevices.getUserMedia
    const mockStream = {
      getTracks: () => [{ stop: vi.fn(), getCapabilities: () => ({}) }],
      getVideoTracks: () => [{ stop: vi.fn(), getCapabilities: () => ({}) }],
    };

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    });

    // Mock iOS detection
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      writable: true,
      configurable: true,
    });
  });

  it("shows loading state during initialization", () => {
    render(<BarcodeScanner onScan={vi.fn()} />);
    expect(screen.getByText(/initializing/i)).toBeInTheDocument();
  });

  it("handles permission denied error", async () => {
    const mockError = new Error("Permission denied");
    mockError.name = "NotAllowedError";
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(mockError);

    const onError = vi.fn();
    render(<BarcodeScanner onScan={vi.fn()} onError={onError} />);

    await waitFor(() => {
      expect(screen.getByText(/camera access denied/i)).toBeInTheDocument();
    });
  });
});
```

### Pattern 4: Animation Component Testing
**What:** Test motion/framer-motion components by mocking the library or using zero-duration
**When to use:** FloatingActionButton with radial menu animations
**Example:**
```typescript
// Source: Pattern for mocking motion library
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FloatingActionButton } from "../floating-action-button";
import userEvent from "@testing-library/user-event";

// Mock motion to render children without animation
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<{ [key: string]: unknown }>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

// Mock haptic feedback
vi.mock("@/lib/hooks/use-haptic", () => ({
  triggerHaptic: vi.fn(),
}));

describe("FloatingActionButton", () => {
  const mockActions = [
    { id: "add", icon: <span>+</span>, label: "Add Item", onClick: vi.fn() },
    { id: "scan", icon: <span>S</span>, label: "Scan", onClick: vi.fn() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles menu open/closed on click", async () => {
    render(<FloatingActionButton actions={mockActions} />);

    const button = screen.getByRole("button", { name: /open quick actions/i });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-label", "Close quick actions");
  });

  it("closes menu on Escape key", async () => {
    render(<FloatingActionButton actions={mockActions} />);

    const button = screen.getByRole("button", { name: /open quick actions/i });
    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");

    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("calls action onClick and closes menu", async () => {
    render(<FloatingActionButton actions={mockActions} />);

    await userEvent.click(screen.getByRole("button", { name: /open quick actions/i }));

    const addButton = screen.getByRole("menuitem", { name: "Add Item" });
    await userEvent.click(addButton);

    expect(mockActions[0].onClick).toHaveBeenCalled();
  });
});
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Test behavior (what the user sees/does), not internal state
- **Not waiting for async operations:** Always use `waitFor` or `act` for state updates
- **Incomplete mock setup:** Ensure all dependencies are mocked before each test
- **Sharing state between tests:** Use `beforeEach`/`afterEach` to reset mocks and state
- **Testing animations directly:** Mock motion library rather than testing animation timing

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity test data | Manual object creation | `lib/test-utils/factories.ts` | Consistent defaults, type-safe |
| Offline state mocking | Manual IndexedDB mocking | `lib/test-utils/offline-mock.ts` | Handles all store types |
| Sync state mocking | Custom sync mocks | `lib/test-utils/sync-mock.ts` | Pre-built mock implementations |
| Hook rendering | Manual component wrapper | `renderHook` from RTL | Handles hook lifecycle correctly |
| Async state assertions | Manual timers/polling | `waitFor` from RTL | Handles retries, timeouts |
| User interactions | `fireEvent` for everything | `userEvent` from RTL | Realistic event sequences |

**Key insight:** Phase 22 created the test utilities specifically for this phase. Use them rather than rebuilding mocking infrastructure in each test file.

## Common Pitfalls

### Pitfall 1: Not Mocking useTransition
**What goes wrong:** Tests hang or timeout when testing hooks using `useTransition`
**Why it happens:** useTransition schedules low-priority updates that don't complete without interaction
**How to avoid:**
- Wrap state-updating code in `act()`
- Use `waitFor` to wait for state changes
- The existing hook uses `startTransition`, which is internally called; just ensure assertions wait for updates
**Warning signs:** Tests timeout, "not wrapped in act()" warnings

### Pitfall 2: Incomplete BroadcastChannel Mocking
**What goes wrong:** Tests fail with "BroadcastChannel is not defined"
**Why it happens:** jsdom doesn't implement BroadcastChannel
**How to avoid:**
```typescript
// In vitest.setup.ts or test file
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(name: string) { this.name = name; }
  postMessage = vi.fn();
  close = vi.fn();
}
global.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
```
**Warning signs:** ReferenceError in sync-manager tests

### Pitfall 3: Not Resetting navigator.onLine
**What goes wrong:** Tests pass individually but fail when run together
**Why it happens:** Object.defineProperty changes persist between tests
**How to avoid:** Reset in afterEach:
```typescript
afterEach(() => {
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
});
```
**Warning signs:** Flaky tests, order-dependent failures

### Pitfall 4: Dynamic Import Testing
**What goes wrong:** Components using `next/dynamic` don't render correctly in tests
**Why it happens:** Dynamic imports need special handling in test environment
**How to avoid:** Mock the dynamic import to return a synchronous component:
```typescript
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    // Return a mock component or load synchronously for testing
    const Component = (props: unknown) => <div data-testid="dynamic-mock" />;
    return Component;
  },
}));
```
**Warning signs:** "Loading..." state never resolves, component not found

### Pitfall 5: Testing IndexedDB Operations Directly
**What goes wrong:** Tests are slow and flaky with real IndexedDB operations
**Why it happens:** IndexedDB is async and has cross-test state bleeding
**How to avoid:** Always mock the `@/lib/db/offline-db` module:
```typescript
vi.mock("@/lib/db/offline-db", () => ({
  getDB: vi.fn().mockResolvedValue({
    add: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    getAllFromIndex: vi.fn().mockResolvedValue([]),
    countFromIndex: vi.fn().mockResolvedValue(0),
  }),
  put: vi.fn().mockResolvedValue(undefined),
}));
```
**Warning signs:** Slow tests, "IDBDatabase" not defined errors

## Code Examples

Verified patterns from official sources and existing codebase:

### Testing useOfflineMutation Queue and Retry Logic
```typescript
// Source: Pattern from existing test files + RTL docs
describe("useOfflineMutation", () => {
  describe("queue behavior", () => {
    it("queues mutation before optimistic update", async () => {
      const onMutate = vi.fn();
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
          onMutate,
        })
      );

      await act(async () => {
        await result.current.mutate({ name: "New Item" });
      });

      // Verify queue was called before onMutate
      const queueCallOrder = vi.mocked(mutationQueue.queueMutation).mock.invocationCallOrder[0];
      const onMutateCallOrder = onMutate.mock.invocationCallOrder[0];
      expect(queueCallOrder).toBeLessThan(onMutateCallOrder);
    });

    it("writes optimistic data to IndexedDB for creates", async () => {
      const { result } = renderHook(() =>
        useOfflineMutation({
          entity: "items",
          operation: "create",
        })
      );

      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      expect(offlineDb.put).toHaveBeenCalledWith("items", expect.objectContaining({
        id: "test-key-123",
        name: "Test",
        _pending: true,
      }));
    });
  });

  describe("network state handling", () => {
    it("triggers sync when online", async () => {
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

      const { result } = renderHook(() =>
        useOfflineMutation({ entity: "items", operation: "create" })
      );

      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      expect(syncManager.syncManager?.processQueue).toHaveBeenCalled();
    });

    it("does not trigger sync when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      const { result } = renderHook(() =>
        useOfflineMutation({ entity: "items", operation: "create" })
      );

      await act(async () => {
        await result.current.mutate({ name: "Test" });
      });

      expect(syncManager.syncManager?.processQueue).not.toHaveBeenCalled();
    });
  });
});
```

### Testing SyncManager Conflict Resolution
```typescript
// Source: Pattern for testing conflict handling
describe("SyncManager conflict handling", () => {
  it("auto-resolves non-critical conflicts with LWW", async () => {
    vi.mocked(mutationQueue.getPendingMutations).mockResolvedValue([
      createMutationEntry({
        entity: "items",
        operation: "update",
        entityId: "item-1",
        payload: { name: "Local Name" },
      }),
    ]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({
        server_data: { name: "Server Name", updated_at: new Date().toISOString() },
      }),
    });

    const listener = vi.fn();
    manager.subscribe(listener);

    await manager.processQueue();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CONFLICT_AUTO_RESOLVED" })
    );
    expect(mutationQueue.removeMutation).toHaveBeenCalled();
  });

  it("queues critical conflicts for user review", async () => {
    // Similar pattern but with critical field (e.g., quantity)
  });
});
```

### Testing MultiStepForm Navigation
```typescript
// Source: Pattern for form component testing
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiStepForm } from "../multi-step-form";
import { z } from "zod";

// Mock form draft hook
vi.mock("@/lib/hooks/use-form-draft", () => ({
  useFormDraft: () => ({
    loadDraft: vi.fn().mockResolvedValue(null),
    saveDraft: vi.fn(),
    clearDraft: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock iOS keyboard hook
vi.mock("@/lib/hooks/use-ios-keyboard", () => ({
  useIOSKeyboard: () => ({
    isKeyboardOpen: false,
    getFixedBottomStyle: () => ({}),
  }),
}));

const testSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const testSteps = [
  { id: "step1", label: "Name" },
  { id: "step2", label: "Email" },
];

describe("MultiStepForm", () => {
  it("validates current step before advancing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MultiStepForm
        schema={testSchema}
        defaultValues={{ name: "", email: "" }}
        steps={testSteps}
        onSubmit={onSubmit}
        formType="test"
        stepFields={[["name"], ["email"]]}
      >
        {({ currentStep, goNext }) => (
          <>
            <div data-testid="step">{currentStep}</div>
            <button onClick={() => goNext()}>Next</button>
          </>
        )}
      </MultiStepForm>
    );

    await waitFor(() => {
      expect(screen.getByTestId("step")).toHaveTextContent("0");
    });

    // Try to advance without valid input
    await user.click(screen.getByText("Next"));

    // Should still be on step 0 due to validation
    expect(screen.getByTestId("step")).toHaveTextContent("0");
  });

  it("persists draft on value changes", async () => {
    // Test draft persistence
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| enzyme | React Testing Library | 2019+ | Focus on user behavior, not implementation |
| Jest | Vitest | 2023+ | Faster, ESM native, Vite integration |
| @testing-library/react-hooks | renderHook in @testing-library/react | RTL v14+ | Merged into main library |
| fireEvent for all interactions | userEvent for realistic interactions | 2022+ | More accurate event simulation |
| Manual timer management | vi.useFakeTimers() | Vitest built-in | Consistent timer mocking |

**Deprecated/outdated:**
- `@testing-library/react-hooks`: Merged into `@testing-library/react` v14+, already using correct version
- `enzyme`: Not compatible with React 18+, use RTL instead
- `react-test-renderer`: Limited use case, RTL preferred for most tests

## Open Questions

Things that couldn't be fully resolved:

1. **BarcodeScanner dynamic import testing depth**
   - What we know: Can mock `next/dynamic` to return mock component
   - What's unclear: How deep to test actual scanner behavior vs mocking entirely
   - Recommendation: Mock the Scanner component entirely, test BarcodeScanner's state management and error handling

2. **Motion library mocking strategy**
   - What we know: Can mock `motion/react` to render static divs
   - What's unclear: Whether to test animation completion callbacks
   - Recommendation: Mock animations, focus on state changes and interactions, not animation timing

3. **Form draft IndexedDB timing**
   - What we know: useFormDraft has debounced saves (1000ms)
   - What's unclear: Whether to use fake timers or just mock the hook
   - Recommendation: Mock useFormDraft entirely for component tests, test the hook separately if needed

## Sources

### Primary (HIGH confidence)
- [Vitest Timer Mocking](https://vitest.dev/guide/mocking/timers) - Fake timer configuration
- [React Testing Library API](https://testing-library.com/docs/react-testing-library/api) - renderHook, act, waitFor
- Existing codebase: `frontend/lib/hooks/__tests__/use-global-search.test.ts` - Established patterns
- Existing codebase: `frontend/lib/sync/__tests__/sync-manager-ordering.test.ts` - SyncManager test patterns
- Existing codebase: `frontend/lib/test-utils/` - Factory and mock utilities

### Secondary (MEDIUM confidence)
- [Testing React hooks with Vitest](https://www.thisdot.co/blog/how-to-test-react-custom-hooks-and-components-with-vitest) - Hook testing patterns
- [Testing Framer Motion components](https://dev.to/pgarciacamou/mocking-framer-motion-v9-7jh) - Motion mocking strategies

### Tertiary (LOW confidence)
- Community patterns for getUserMedia mocking - Need validation with actual test runs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project dependencies, well-documented
- Architecture: HIGH - Following established codebase patterns
- Pitfalls: HIGH - Based on official docs and existing test file patterns

**Research date:** 2026-01-31
**Valid until:** 60 days (testing libraries are stable)
