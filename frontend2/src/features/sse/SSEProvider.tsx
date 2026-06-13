import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { queryClient } from "@/lib/queryClient";
import { KNOWN_EVENT_TYPES, prefixesFor } from "./invalidationMap";
import type { SSEEvent } from "./types";

// SSEProvider — the single app-wide EventSource (PROV-02). It owns ONE cookie-
// authenticated connection to the workspace SSE endpoint, drives the generic
// `entity_type → query-key-prefix` invalidation dispatcher, fans events out to
// `useSSE` subscribers, and exposes a COARSE status selector to chrome.
//
// SPLIT CONTEXTS (RESEARCH §Pattern 1, REQUIRED): a STATUS context holds the only
// useState-backed values (`connected`, `lastEventAt`); a SUBSCRIBE context exposes
// a `subscribe(handler)` backed by a ref-held Set. Event traffic mutates the ref,
// never status state, so `useSSEStatus` consumers (TopBar, PageHeader) do NOT
// re-render on every event (Pitfall 5). Mounts inside WorkspaceProvider where a
// valid wsId + authenticated session are guaranteed.

export interface SSEStatus {
  /** True once the `connected` open frame has arrived; false on error/close. */
  connected: boolean;
  /** Coarsely-updated (≥1 s) timestamp of the last domain event, or null. */
  lastEventAt: Date | null;
}

type SSEHandler = (event: SSEEvent) => void;

interface SSESubscribeValue {
  /** Register a handler; returns its cleanup. Mutates a ref — no re-render. */
  subscribe: (handler: SSEHandler) => () => void;
}

// `undefined` sentinel so the hooks can throw a clear outside-provider error.
export const SSEStatusContext = createContext<SSEStatus | undefined>(undefined);
export const SSESubscribeContext = createContext<SSESubscribeValue | undefined>(
  undefined,
);

// Backoff: capped exponential. base 2 s, factor 1.5, cap 30 s, max 10 attempts
// (RESEARCH §Pattern 5 — Claude's discretion, legacy-aligned defaults).
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_FACTOR = 1.5;
const BACKOFF_CAP_MS = 30_000;
const MAX_ATTEMPTS = 10;
// Coarsen lastEventAt so an event burst doesn't thrash the header (≥1 s ticks).
const LAST_EVENT_TICK_MS = 1_000;

function backoffDelay(attempt: number): number {
  return Math.min(
    BACKOFF_BASE_MS * BACKOFF_FACTOR ** Math.max(0, attempt - 1),
    BACKOFF_CAP_MS,
  );
}

export function SSEProvider({ children }: { children: ReactNode }) {
  const { currentWorkspaceId } = useWorkspace();

  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  // Subscriber fan-out — held in a ref so add/remove never re-renders status
  // consumers (the whole point of the split context).
  const subscribersRef = useRef<Set<SSEHandler>>(new Set());

  const subscribe = useCallback((handler: SSEHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  // Coarse lastEventAt tick — only flips state at most once per LAST_EVENT_TICK_MS.
  const lastTickRef = useRef(0);
  const markEvent = useCallback(() => {
    const now = Date.now();
    if (now - lastTickRef.current >= LAST_EVENT_TICK_MS) {
      lastTickRef.current = now;
      setLastEventAt(new Date(now));
    }
  }, []);

  // Connection lifecycle. Re-runs on wsId change (close old → open new). A null
  // wsId means "not ready yet" — open nothing.
  useEffect(() => {
    if (!currentWorkspaceId) return;

    const wsId = currentWorkspaceId;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let stopped = false; // set by auth-expired / cleanup — halts reconnect

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const dispatchInvalidation = (event: SSEEvent) => {
      // Normalize the entity_type at the dispatch boundary — the backend emits an
      // uppercase "ITEM" outlier (RESEARCH §Pitfall 3). `prefixesFor` lowercases
      // again defensively, but doing it here keeps the gotcha visible at the
      // dispatch site and is the load-bearing toLowerCase for the hard gate.
      const entityType = event.entity_type.toLowerCase();
      for (const prefix of prefixesFor(entityType)) {
        queryClient.invalidateQueries({ queryKey: [...prefix, wsId] });
      }
    };

    const handleNamedEvent = (raw: MessageEvent) => {
      let event: SSEEvent;
      try {
        event = JSON.parse(raw.data as string) as SSEEvent;
      } catch {
        return; // malformed payload → ignore (Tampering/DoS mitigation T-06-02)
      }
      markEvent();
      dispatchInvalidation(event);
      // Fan out to useSSE subscribers (snapshot to tolerate unsubscribe-in-handler).
      for (const handler of [...subscribersRef.current]) {
        handler(event);
      }
    };

    const open = () => {
      if (stopped) return;
      // Cookie auth ONLY — withCredentials attaches the HttpOnly access_token.
      // NEVER a token in the URL (T-06-01: leaks via logs/Referer).
      es = new EventSource(`/api/workspaces/${wsId}/sse`, {
        withCredentials: true,
      });

      es.addEventListener("connected", () => {
        attempts = 0; // healthy open resets backoff
        setConnected(true);
      });

      // One listener per known backend event name — EventSource matches names
      // EXACTLY, so there is no wildcard/`message` path (RESEARCH §Pattern 2).
      // `connected` is handled above; skip it in the domain loop.
      for (const type of KNOWN_EVENT_TYPES) {
        if (type === "connected") continue;
        es.addEventListener(type, handleNamedEvent);
      }

      es.addEventListener("error", () => {
        setConnected(false);
        // EventSource auto-reconnects, but we add an explicit capped backoff and
        // an attempt cap so a dead endpoint doesn't hammer (T-06-04).
        es?.close();
        if (stopped || attempts >= MAX_ATTEMPTS) return;
        attempts += 1;
        clearReconnect();
        reconnectTimer = setTimeout(open, backoffDelay(attempts));
      });
    };

    // Session loss is signalled once by api.ts — close + halt reconnect. Do NOT
    // add a getMe probe (RESEARCH §Pattern 5).
    const onAuthExpired = () => {
      stopped = true;
      clearReconnect();
      setConnected(false);
      es?.close();
    };
    window.addEventListener("auth-expired", onAuthExpired);

    // Nice-to-have: nudge a reconnect when the tab/network comes back, but only
    // if the stream is currently down and we haven't been stopped.
    const onWake = () => {
      if (stopped) return;
      if (!es || es.readyState === 2 /* CLOSED */) {
        attempts = 0;
        clearReconnect();
        open();
      }
    };
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onWake();
    });

    open();

    return () => {
      stopped = true;
      clearReconnect();
      window.removeEventListener("auth-expired", onAuthExpired);
      window.removeEventListener("online", onWake);
      es?.close(); // StrictMode + wsId-switch: MUST close to avoid leaks (Pitfall 4)
      setConnected(false);
    };
  }, [currentWorkspaceId, markEvent]);

  const statusValue = useMemo<SSEStatus>(
    () => ({ connected, lastEventAt }),
    [connected, lastEventAt],
  );
  const subscribeValue = useMemo<SSESubscribeValue>(
    () => ({ subscribe }),
    [subscribe],
  );

  return (
    <SSEStatusContext.Provider value={statusValue}>
      <SSESubscribeContext.Provider value={subscribeValue}>
        {children}
      </SSESubscribeContext.Provider>
    </SSEStatusContext.Provider>
  );
}
