// Public barrel for the SSE feature module. Chrome + future feature phases
// import from here, never from the individual files.
export { SSEProvider } from "./SSEProvider";
export type { SSEStatus } from "./SSEProvider";
export { useSSE } from "./useSSE";
export { useSSEStatus } from "./useSSEStatus";
export type { SSEEvent } from "./types";
