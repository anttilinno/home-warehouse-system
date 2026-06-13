import { useContext, useEffect, useRef } from "react";
import { SSESubscribeContext } from "./SSEProvider";
import type { SSEEvent } from "./types";

// useSSE — subscribe to the live SSE stream. The `onEvent` callback is kept in a
// ref and re-pointed each render, so the actual `subscribe(...)` runs ONCE (empty
// deps): a consumer re-rendering with a new closure does NOT churn the
// subscription (RESEARCH §"Subscribe hook contract"). Cleanup unsubscribes on
// unmount. Throws outside SSEProvider.
export function useSSE({ onEvent }: { onEvent: (event: SSEEvent) => void }): void {
  const ctx = useContext(SSESubscribeContext);
  if (ctx === undefined) {
    throw new Error("useSSE must be used within an SSEProvider");
  }
  const { subscribe } = ctx;

  const cbRef = useRef(onEvent);
  useEffect(() => {
    cbRef.current = onEvent;
  });

  useEffect(
    () => subscribe((event) => cbRef.current?.(event)),
    [subscribe],
  );
}
