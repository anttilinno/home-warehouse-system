import { useContext } from "react";
import { SSEStatusContext, type SSEStatus } from "./SSEProvider";

// useSSEStatus — the coarse status selector for chrome (TopBar ONLINE dot,
// PageHeader LAST SYNC). Reads the STATUS context only, so it re-renders ONLY
// when `connected`/`lastEventAt` actually change — never on event-fan-out traffic
// (the split-context guarantee, RESEARCH §Pattern 1 / Pitfall 5). Throws outside
// SSEProvider so a missing-provider bug fails loudly at render.
export function useSSEStatus(): SSEStatus {
  const ctx = useContext(SSEStatusContext);
  if (ctx === undefined) {
    throw new Error("useSSEStatus must be used within an SSEProvider");
  }
  return ctx;
}
